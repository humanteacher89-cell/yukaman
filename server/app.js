// 육아맨 서버(2026-11-04) — Cloudflare Pages Functions + D1. 화면(public/)과 같은 주소라 따로 허용(CORS)할 것이 없다.
// 약속: 응답은 늘 JSON — {ok:true, …} 또는 {ok:false, error:'이름'}(HTTP 상태도 함께). 글자는 모두 다듬어(trim) 길이 한도를 넘기면 거절.
// 쓰기와 '내 정보'는 머리글 Authorization: Bearer <기기 토큰>. 토큰은 폰이 만든 임의 글자(16~80자)이고, 서버는 SHA-256 해시만 둔다.
//  GET    /api/posts?cat=&q=&before=&limit=   글 목록(최신순). before = 이 번호보다 작은 글부터(더 보기). 응답 next = 다음 before 값(없으면 null)
//  GET    /api/posts/<id>                      글 하나 + 댓글
//  POST   /api/join {nick}                     닉네임 정하기(기기 토큰 등록). 이미 등록된 토큰이면 그 사용자를 돌려줌(existing:true)
//  GET    /api/me                              내 정보 + 내 글 + 내 댓글
//  PATCH  /api/me {nick}                       닉네임 바꾸기(하루 3번)
//  POST   /api/posts {cat,title,body}          글쓰기(한 시간 10개)
//  DELETE /api/posts/<id>                      내 글 지우기(deleted에 시각만 적음)
//  POST   /api/posts/<id>/comments {body}      댓글(한 시간 60개)
//  DELETE /api/comments/<id>                   내 댓글 지우기
//  GET    /api/health                          살아 있나
// 저장하는 개인정보: 닉네임 · 기기 토큰 해시 · 쓴 글·댓글. 횟수 제한용 기기 주소(IP)는 해시 16자로 10분만(가입에만).

const CATS = ['question', 'tip', 'daily', 'leave', 'play', 'gear'];           // public/app.js CATS와 같게
const LIM = { nick: [2, 12], title: [2, 60], body: [1, 3000], comment: [1, 1000], list: 20, listMax: 50 };
const RATE = { join: [5, 600000], post: [10, 3600000], comment: [60, 3600000], nick: [3, 86400000] };   // [횟수, 기간 ms]

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
const no = (error, status = 400) => json({ ok: false, error }, status);
const str = (v, n) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
const len = s => Array.from(s).length;
const nickKey = s => s.replace(/\s+/g, '').toLowerCase();
const nowIso = () => new Date().toISOString();
const tokenOk = t => /^[A-Za-z0-9_-]{16,80}$/.test(t);

async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
}

function checkNick(nick) {
  const n = len(nick);
  if (n < LIM.nick[0] || n > LIM.nick[1]) return 'nick_len';
  if (!/^[가-힣A-Za-z0-9 _.]+$/.test(nick)) return 'nick_chars';
  return '';
}

export async function handleApi(request, env) {
  try {
    if (!env || !env.DB) return no('no_db', 500);
    const u = new URL(request.url);
    const seg = u.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const m = request.method;
    const isId = s => /^\d{1,12}$/.test(s || '');
    if (seg[0] === 'posts' && !seg[1]) {
      if (m === 'GET') return listPosts(env.DB, u.searchParams);
      if (m === 'POST') return createPost(request, env);
    }
    if (seg[0] === 'posts' && isId(seg[1]) && !seg[2]) {
      if (m === 'GET') return getPost(env.DB, +seg[1]);
      if (m === 'DELETE') return deletePost(request, env, +seg[1]);
    }
    if (seg[0] === 'posts' && isId(seg[1]) && seg[2] === 'comments' && !seg[3] && m === 'POST') return addComment(request, env, +seg[1]);
    if (seg[0] === 'comments' && isId(seg[1]) && !seg[2] && m === 'DELETE') return deleteComment(request, env, +seg[1]);
    if (seg[0] === 'join' && !seg[1] && m === 'POST') return join(request, env);
    if (seg[0] === 'me' && !seg[1]) {
      if (m === 'GET') return me(request, env);
      if (m === 'PATCH') return rename(request, env);
    }
    if (seg[0] === 'health' && !seg[1] && m === 'GET') return json({ ok: true, app: 'yukaman', time: nowIso() });
    return no('not_found', 404);
  } catch (e) {
    console.error('api', e && e.stack || e);
    return no('server', 500);
  }
}

// ----- 공통 -----
function bearer(request) {
  const h = request.headers.get('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

async function auth(request, db) {
  const token = bearer(request);
  if (!tokenOk(token)) return { err: no('login', 401) };
  const hash = await sha256('tok|' + token);
  const user = await db.prepare('SELECT id, nick, created FROM users WHERE token_hash = ?1').bind(hash).first();
  if (!user) return { err: no('unknown_user', 401), hash };
  return { user, hash };
}

async function readJson(request) {
  try { const b = await request.json(); return b && typeof b === 'object' ? b : null; } catch (e) { return null; }
}

// 횟수 제한: 기간 안의 기록이 max 이상이면 거절, 아니면 기록하고 허용
async function allow(db, who, kind) {
  const [max, win] = RATE[kind];
  const t = Date.now();
  await db.prepare('DELETE FROM acts WHERE who = ?1 AND kind = ?2 AND at < ?3').bind(who, kind, t - win).run();
  const c = await db.prepare('SELECT COUNT(*) AS n FROM acts WHERE who = ?1 AND kind = ?2').bind(who, kind).first();
  if (c && c.n >= max) return false;
  await db.prepare('INSERT INTO acts (who, kind, at) VALUES (?1, ?2, ?3)').bind(who, kind, t).run();
  return true;
}
const ipKey = async request => 'ip:' + (await sha256('ip|' + (request.headers.get('CF-Connecting-IP') || 'local'))).slice(0, 16);

const rowPost = r => ({ id: r.id, cat: r.cat, title: r.title, preview: r.preview, created: r.created, comments: r.comment_count, nick: r.nick, uid: r.uid });
const pubUser = u => ({ id: u.id, nick: u.nick, created: u.created });

// ----- 글 -----
async function listPosts(db, sp) {
  const cat = str(sp.get('cat'), 20), q = str(sp.get('q'), 60), before = +sp.get('before') || 0;
  const limit = Math.min(Math.max(+sp.get('limit') || LIM.list, 1), LIM.listMax);
  const where = ['p.deleted IS NULL'], args = [];
  if (cat && CATS.includes(cat)) { where.push('p.cat = ?'); args.push(cat); }
  if (q) {
    const like = '%' + q.replace(/[\\%_]/g, c => '\\' + c) + '%';
    where.push("(p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\')");
    args.push(like, like);
  }
  if (before) { where.push('p.id < ?'); args.push(before); }
  args.push(limit + 1);
  const sql = 'SELECT p.id, p.cat, p.title, substr(p.body, 1, 140) AS preview, p.created, p.comment_count, u.nick, u.id AS uid '
    + 'FROM posts p JOIN users u ON u.id = p.user_id WHERE ' + where.join(' AND ') + ' ORDER BY p.id DESC LIMIT ?';
  const rs = await db.prepare(sql).bind(...args).all();
  const rows = rs.results || [];
  const more = rows.length > limit;
  if (more) rows.pop();
  return json({ ok: true, posts: rows.map(rowPost), next: more ? rows[rows.length - 1].id : null });
}

async function getPost(db, id) {
  const p = await db.prepare('SELECT p.id, p.cat, p.title, p.body, p.created, p.comment_count, u.nick, u.id AS uid '
    + 'FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?1 AND p.deleted IS NULL').bind(id).first();
  if (!p) return no('not_found', 404);
  const cs = await db.prepare('SELECT c.id, c.body, c.created, u.nick, u.id AS uid FROM comments c JOIN users u ON u.id = c.user_id '
    + 'WHERE c.post_id = ?1 AND c.deleted IS NULL ORDER BY c.id').bind(id).all();
  return json({ ok: true,
    post: { id: p.id, cat: p.cat, title: p.title, body: p.body, created: p.created, comments: p.comment_count, nick: p.nick, uid: p.uid },
    comments: (cs.results || []).map(c => ({ id: c.id, body: c.body, created: c.created, nick: c.nick, uid: c.uid })) });
}

async function createPost(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  const b = await readJson(request);
  if (!b) return no('bad_json');
  const cat = str(b.cat, 20), title = str(b.title, 200), text = str(b.body, 5000);
  if (!CATS.includes(cat)) return no('cat');
  if (len(title) < LIM.title[0] || len(title) > LIM.title[1]) return no('title_len');
  if (len(text) < LIM.body[0] || len(text) > LIM.body[1]) return no('body_len');
  if (!(await allow(env.DB, 'u:' + a.user.id, 'post'))) return no('limit', 429);
  const created = nowIso();
  const r = await env.DB.prepare('INSERT INTO posts (user_id, cat, title, body, created) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(a.user.id, cat, title, text, created).run();
  const id = r.meta && r.meta.last_row_id;
  return json({ ok: true, id, post: { id, cat, title, body: text, created, comments: 0, nick: a.user.nick, uid: a.user.id } });
}

async function deletePost(request, env, id) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  const p = await env.DB.prepare('SELECT user_id FROM posts WHERE id = ?1 AND deleted IS NULL').bind(id).first();
  if (!p) return no('not_found', 404);
  if (p.user_id !== a.user.id) return no('forbidden', 403);
  await env.DB.prepare('UPDATE posts SET deleted = ?1 WHERE id = ?2').bind(nowIso(), id).run();
  return json({ ok: true });
}

// ----- 댓글 -----
async function addComment(request, env, postId) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  const b = await readJson(request);
  if (!b) return no('bad_json');
  const text = str(b.body, 2000);
  if (len(text) < LIM.comment[0] || len(text) > LIM.comment[1]) return no('comment_len');
  const p = await env.DB.prepare('SELECT id FROM posts WHERE id = ?1 AND deleted IS NULL').bind(postId).first();
  if (!p) return no('not_found', 404);
  if (!(await allow(env.DB, 'u:' + a.user.id, 'comment'))) return no('limit', 429);
  const created = nowIso();
  const [r] = await env.DB.batch([
    env.DB.prepare('INSERT INTO comments (post_id, user_id, body, created) VALUES (?1, ?2, ?3, ?4)').bind(postId, a.user.id, text, created),
    env.DB.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?1').bind(postId)
  ]);
  const id = r.meta && r.meta.last_row_id;
  return json({ ok: true, comment: { id, body: text, created, nick: a.user.nick, uid: a.user.id } });
}

async function deleteComment(request, env, id) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  const c = await env.DB.prepare('SELECT user_id, post_id FROM comments WHERE id = ?1 AND deleted IS NULL').bind(id).first();
  if (!c) return no('not_found', 404);
  if (c.user_id !== a.user.id) return no('forbidden', 403);
  await env.DB.batch([
    env.DB.prepare('UPDATE comments SET deleted = ?1 WHERE id = ?2').bind(nowIso(), id),
    env.DB.prepare('UPDATE posts SET comment_count = CASE WHEN comment_count > 0 THEN comment_count - 1 ELSE 0 END WHERE id = ?1').bind(c.post_id)
  ]);
  return json({ ok: true });
}

// ----- 사용자 -----
async function join(request, env) {
  const db = env.DB;
  const token = bearer(request);
  if (!tokenOk(token)) return no('login', 401);
  const hash = await sha256('tok|' + token);
  const have = await db.prepare('SELECT id, nick, created FROM users WHERE token_hash = ?1').bind(hash).first();
  if (have) return json({ ok: true, user: pubUser(have), existing: true });
  const b = await readJson(request);
  const nick = str(b && b.nick, 40);
  const bad = checkNick(nick);
  if (bad) return no(bad);
  if (await db.prepare('SELECT 1 AS x FROM users WHERE nick_key = ?1').bind(nickKey(nick)).first()) return no('nick_taken', 409);
  if (!(await allow(db, await ipKey(request), 'join'))) return no('limit', 429);
  const created = nowIso();
  try {
    const r = await db.prepare('INSERT INTO users (nick, nick_key, token_hash, created, last_seen) VALUES (?1, ?2, ?3, ?4, ?4)')
      .bind(nick, nickKey(nick), hash, created).run();
    return json({ ok: true, user: { id: r.meta && r.meta.last_row_id, nick, created } });
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) return no('nick_taken', 409);
    throw e;
  }
}

async function me(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  const db = env.DB, uid = a.user.id;
  const [ps, cs] = await db.batch([
    db.prepare('SELECT id, cat, title, substr(body, 1, 140) AS preview, created, comment_count FROM posts WHERE user_id = ?1 AND deleted IS NULL ORDER BY id DESC LIMIT 100').bind(uid),
    db.prepare('SELECT c.id, c.body, c.created, c.post_id, p.title AS post_title FROM comments c JOIN posts p ON p.id = c.post_id '
      + 'WHERE c.user_id = ?1 AND c.deleted IS NULL AND p.deleted IS NULL ORDER BY c.id DESC LIMIT 100').bind(uid),
    db.prepare('UPDATE users SET last_seen = ?1 WHERE id = ?2').bind(nowIso(), uid)
  ]);
  return json({ ok: true, user: pubUser(a.user),
    posts: (ps.results || []).map(r => rowPost({ ...r, nick: a.user.nick, uid })),
    comments: (cs.results || []).map(c => ({ id: c.id, body: c.body, created: c.created, post_id: c.post_id, post_title: c.post_title })) });
}

async function rename(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  const b = await readJson(request);
  const nick = str(b && b.nick, 40);
  const bad = checkNick(nick);
  if (bad) return no(bad);
  if (nick === a.user.nick) return json({ ok: true, user: pubUser(a.user) });
  const other = await env.DB.prepare('SELECT id FROM users WHERE nick_key = ?1').bind(nickKey(nick)).first();
  if (other && other.id !== a.user.id) return no('nick_taken', 409);
  if (!(await allow(env.DB, 'u:' + a.user.id, 'nick'))) return no('limit', 429);
  try {
    await env.DB.prepare('UPDATE users SET nick = ?1, nick_key = ?2 WHERE id = ?3').bind(nick, nickKey(nick), a.user.id).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) return no('nick_taken', 409);
    throw e;
  }
  return json({ ok: true, user: { id: a.user.id, nick, created: a.user.created } });
}

// 육아맨 서버(2026-11-04) — Cloudflare Pages Functions + D1. 화면(public/)과 같은 주소라 따로 허용(CORS)할 것이 없다.
// 약속: 응답은 늘 JSON — {ok:true, …} 또는 {ok:false, error:'이름'}(HTTP 상태도 함께). 글자는 모두 다듬어(trim) 길이 한도를 넘기면 거절.
// 쓰기와 '내 정보'는 머리글 Authorization: Bearer <기기 토큰>. 토큰은 폰이 만든 임의 글자(16~80자)이고, 서버는 SHA-256 해시만 둔다.
// 커뮤니티는 읽기(목록·글·검색)도 쓰기도 '인증 아빠'만(verified = 1. 2026-11-04 휴먼쌤 "인증 아빠만"). 인증 길 둘: 초대 코드(바로) · 신청서(관리자 승인).
//  GET    /api/posts?cat=&q=&before=&limit=   글 목록(최신순, 인증 아빠만). before = 이 번호보다 작은 글부터(더 보기). 응답 next = 다음 before 값(없으면 null)
//  GET    /api/posts/<id>                      글 하나 + 댓글(인증 아빠만)
//  POST   /api/join {nick, invite?}            닉네임 정하기(기기 토큰 등록). 코드가 맞으면 바로 인증. 이미 등록된 토큰이면 그 사용자(existing:true)
//  GET    /api/me                              내 정보(인증 상태·신청 상태·초대 코드) + 내 글 + 내 댓글
//  PATCH  /api/me {nick}                       닉네임 바꾸기(하루 3번)
//  POST   /api/verify/code {code}              초대 코드로 인증
//  POST   /api/verify/apply {stage,answer,pledge}  신청서(관리자가 읽고 승인)
//  POST   /api/invites                         초대 코드 만들기(인증 아빠 3개, 관리자 제한 없음)
//  POST   /api/posts {cat,title,body}          글쓰기(한 시간 10개)
//  DELETE /api/posts/<id>                      내 글 지우기(관리자는 모두). deleted에 시각만 적음
//  POST   /api/posts/<id>/comments {body}      댓글(한 시간 60개)
//  DELETE /api/comments/<id>                   내 댓글 지우기(관리자는 모두)
//  GET    /api/admin/queue                     관리자: 대기 신청서 + 최근 회원
//  POST   /api/admin/decide {id, approve}      관리자: 승인·거절(답변은 지움)
//  POST   /api/admin/user {user_id, action}    관리자: unverify(인증 해제) · block(해제 + 재신청 막기) · unblock · verify
//  POST   /api/admin/invites {count, note}     관리자: 운영 초대 코드 만들기
//  GET    /api/health                          살아 있나
// 저장하는 개인정보: 닉네임 · 기기 토큰 해시 · 쓴 글·댓글 · 대기 중인 신청 답변. 횟수 제한용 기기 주소(IP)는 해시 16자로 짧게(가입·코드 시도에만).

const CATS = ['question', 'tip', 'daily', 'leave', 'play', 'gear'];           // public/app.js CATS와 같게
const STAGES = ['raising', 'expecting'];
const LIM = { nick: [2, 12], title: [2, 60], body: [1, 3000], comment: [1, 1000], answer: [20, 500], list: 20, listMax: 50 };
const RATE = {                                        // [횟수, 기간 ms]
  join: [5, 600000], post: [10, 3600000], comment: [60, 3600000], nick: [3, 86400000],
  code: [10, 600000], apply: [3, 86400000], invite: [10, 86400000]
};
const INVITE_MAX = 3;                                 // 인증 아빠 한 사람이 만들 수 있는 초대 코드
const RESERVED = /(육아맨|운영자|관리자|자료실|공식|admin|official)/i;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
const no = (error, status = 400) => json({ ok: false, error }, status);
const str = (v, n) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
const len = s => Array.from(s).length;
const nickKey = s => s.replace(/\s+/g, '').toLowerCase();
const nowIso = () => new Date().toISOString();
const tokenOk = t => /^[A-Za-z0-9_-]{16,80}$/.test(t);
const normCode = s => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const showCode = c => (c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c);

async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
}

function checkNick(nick) {
  const n = len(nick);
  if (n < LIM.nick[0] || n > LIM.nick[1]) return 'nick_len';
  if (!/^[가-힣A-Za-z0-9 _.]+$/.test(nick)) return 'nick_chars';
  if (RESERVED.test(nick.replace(/\s+/g, ''))) return 'nick_reserved';
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
      if (m === 'GET') return listPosts(request, env, u.searchParams);
      if (m === 'POST') return createPost(request, env);
    }
    if (seg[0] === 'posts' && isId(seg[1]) && !seg[2]) {
      if (m === 'GET') return getPost(request, env, +seg[1]);
      if (m === 'DELETE') return deletePost(request, env, +seg[1]);
    }
    if (seg[0] === 'posts' && isId(seg[1]) && seg[2] === 'comments' && !seg[3] && m === 'POST') return addComment(request, env, +seg[1]);
    if (seg[0] === 'comments' && isId(seg[1]) && !seg[2] && m === 'DELETE') return deleteComment(request, env, +seg[1]);
    if (seg[0] === 'join' && !seg[1] && m === 'POST') return join(request, env);
    if (seg[0] === 'me' && !seg[1]) {
      if (m === 'GET') return me(request, env);
      if (m === 'PATCH') return rename(request, env);
    }
    if (seg[0] === 'verify' && seg[1] === 'code' && m === 'POST') return verifyCode(request, env);
    if (seg[0] === 'verify' && seg[1] === 'apply' && m === 'POST') return verifyApply(request, env);
    if (seg[0] === 'invites' && !seg[1] && m === 'POST') return createInvite(request, env);
    if (seg[0] === 'admin') return admin(request, env, seg[1], m);
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

const USER_COLS = 'id, nick, created, role, verified, verified_how, blocked';
async function auth(request, db) {
  const token = bearer(request);
  if (!tokenOk(token)) return { err: no('login', 401) };
  const hash = await sha256('tok|' + token);
  const user = await db.prepare('SELECT ' + USER_COLS + ' FROM users WHERE token_hash = ?1').bind(hash).first();
  if (!user) return { err: no('unknown_user', 401), hash };
  return { user, hash };
}
const isAdmin = u => u && u.role === 'admin';
const canWrite = u => u && !u.blocked && (u.verified === 1 || u.role === 'admin' || u.role === 'official');
// 커뮤니티 읽기 자격은 쓰기와 같다. 글이 있는지 없는지도 자격을 본 뒤에야 알려 준다.
async function reader(request, db) {
  const a = await auth(request, db);
  if (a.err) return a;
  if (!canWrite(a.user)) return { err: no(a.user.blocked ? 'blocked' : 'verify', 403) };
  return a;
}

async function readJson(request) {
  try { const b = await request.json(); return b && typeof b === 'object' ? b : null; } catch (e) { return null; }
}

// 횟수 제한: 기간 안의 기록이 max 이상이면 거절, 아니면 기록하고 허용
async function allow(db, who, kind) {
  const [max, win] = RATE[kind];
  const t = Date.now();
  await db.prepare('DELETE FROM acts WHERE who = ?1 AND kind = ?2 AND at < ?3').bind(who, kind, t - win).run();
  // 다시 오지 않는 기기의 기록도 남지 않게 가끔 통째로 비운다(가장 긴 제한이 하루)
  if (Math.random() < 0.02) await db.prepare('DELETE FROM acts WHERE at < ?1').bind(t - 2 * 86400000).run();
  const c = await db.prepare('SELECT COUNT(*) AS n FROM acts WHERE who = ?1 AND kind = ?2').bind(who, kind).first();
  if (c && c.n >= max) return false;
  await db.prepare('INSERT INTO acts (who, kind, at) VALUES (?1, ?2, ?3)').bind(who, kind, t).run();
  return true;
}
const ipKey = async request => 'ip:' + (await sha256('ip|' + (request.headers.get('CF-Connecting-IP') || 'local'))).slice(0, 16);

const BADGE = "CASE WHEN u.role = 'official' THEN 'official' WHEN u.verified = 1 THEN 'dad' ELSE '' END AS badge";
const rowPost = r => ({ id: r.id, cat: r.cat, title: r.title, preview: r.preview, created: r.created, comments: r.comment_count, nick: r.nick, uid: r.uid, badge: r.badge || '' });
const pubUser = u => ({ id: u.id, nick: u.nick, created: u.created, verified: u.verified === 1 && !u.blocked, role: u.role, how: u.verified_how || '', blocked: !!u.blocked });

// ----- 글 -----
async function listPosts(request, env, sp) {
  const a = await reader(request, env.DB);
  if (a.err) return a.err;
  const db = env.DB;
  const cat = str(sp.get('cat'), 20), q = str(sp.get('q'), 60), before = +sp.get('before') || 0;
  const limit = Math.min(Math.max(+sp.get('limit') || LIM.list, 1), LIM.listMax);
  const where = ['p.deleted IS NULL'], args = [];
  if (cat && CATS.includes(cat)) { where.push('p.cat = ?'); args.push(cat); }
  if (q) {
    // 띄어 쓴 낱말은 모두 들어 있어야 찾는다(최대 5개)
    q.split(/\s+/).filter(Boolean).slice(0, 5).forEach(w => {
      const like = '%' + w.replace(/[\\%_]/g, c => '\\' + c) + '%';
      where.push("(p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\')");
      args.push(like, like);
    });
  }
  if (before) { where.push('p.id < ?'); args.push(before); }
  args.push(limit + 1);
  const sql = 'SELECT p.id, p.cat, p.title, substr(p.body, 1, 140) AS preview, p.created, p.comment_count, u.nick, u.id AS uid, ' + BADGE + ' '
    + 'FROM posts p JOIN users u ON u.id = p.user_id WHERE ' + where.join(' AND ') + ' ORDER BY p.id DESC LIMIT ?';
  const rs = await db.prepare(sql).bind(...args).all();
  const rows = rs.results || [];
  const more = rows.length > limit;
  if (more) rows.pop();
  return json({ ok: true, posts: rows.map(rowPost), next: more ? rows[rows.length - 1].id : null });
}

async function getPost(request, env, id) {
  const a = await reader(request, env.DB);
  if (a.err) return a.err;
  const db = env.DB;
  const p = await db.prepare('SELECT p.id, p.cat, p.title, p.body, p.created, p.comment_count, u.nick, u.id AS uid, ' + BADGE + ' '
    + 'FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?1 AND p.deleted IS NULL').bind(id).first();
  if (!p) return no('not_found', 404);
  const cs = await db.prepare('SELECT c.id, c.body, c.created, u.nick, u.id AS uid, ' + BADGE + ' FROM comments c JOIN users u ON u.id = c.user_id '
    + 'WHERE c.post_id = ?1 AND c.deleted IS NULL ORDER BY c.id').bind(id).all();
  return json({ ok: true,
    post: { id: p.id, cat: p.cat, title: p.title, body: p.body, created: p.created, comments: p.comment_count, nick: p.nick, uid: p.uid, badge: p.badge || '' },
    comments: (cs.results || []).map(c => ({ id: c.id, body: c.body, created: c.created, nick: c.nick, uid: c.uid, badge: c.badge || '' })) });
}

async function createPost(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  if (!canWrite(a.user)) return no(a.user.blocked ? 'blocked' : 'verify', 403);
  const b = await readJson(request);
  if (!b) return no('bad_json');
  const cat = str(b.cat, 20), title = str(b.title, 200), text = str(b.body, 5000);
  if (!CATS.includes(cat)) return no('cat');
  if (len(title) < LIM.title[0] || len(title) > LIM.title[1]) return no('title_len');
  if (len(text) < LIM.body[0] || len(text) > LIM.body[1]) return no('body_len');
  if (!isAdmin(a.user) && !(await allow(env.DB, 'u:' + a.user.id, 'post'))) return no('limit', 429);
  const created = nowIso();
  const r = await env.DB.prepare('INSERT INTO posts (user_id, cat, title, body, created) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(a.user.id, cat, title, text, created).run();
  const id = r.meta && r.meta.last_row_id;
  return json({ ok: true, id, post: { id, cat, title, body: text, created, comments: 0, nick: a.user.nick, uid: a.user.id, badge: 'dad' } });
}

async function deletePost(request, env, id) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  const p = await env.DB.prepare('SELECT user_id FROM posts WHERE id = ?1 AND deleted IS NULL').bind(id).first();
  if (!p) return no('not_found', 404);
  if (p.user_id !== a.user.id && !isAdmin(a.user)) return no('forbidden', 403);
  await env.DB.prepare('UPDATE posts SET deleted = ?1 WHERE id = ?2').bind(nowIso(), id).run();
  return json({ ok: true });
}

// ----- 댓글 -----
async function addComment(request, env, postId) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  if (!canWrite(a.user)) return no(a.user.blocked ? 'blocked' : 'verify', 403);
  const b = await readJson(request);
  if (!b) return no('bad_json');
  const text = str(b.body, 2000);
  if (len(text) < LIM.comment[0] || len(text) > LIM.comment[1]) return no('comment_len');
  const p = await env.DB.prepare('SELECT id FROM posts WHERE id = ?1 AND deleted IS NULL').bind(postId).first();
  if (!p) return no('not_found', 404);
  if (!isAdmin(a.user) && !(await allow(env.DB, 'u:' + a.user.id, 'comment'))) return no('limit', 429);
  const created = nowIso();
  const [r] = await env.DB.batch([
    env.DB.prepare('INSERT INTO comments (post_id, user_id, body, created) VALUES (?1, ?2, ?3, ?4)').bind(postId, a.user.id, text, created),
    env.DB.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?1').bind(postId)
  ]);
  const id = r.meta && r.meta.last_row_id;
  return json({ ok: true, comment: { id, body: text, created, nick: a.user.nick, uid: a.user.id, badge: 'dad' } });
}

async function deleteComment(request, env, id) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  const c = await env.DB.prepare('SELECT user_id, post_id FROM comments WHERE id = ?1 AND deleted IS NULL').bind(id).first();
  if (!c) return no('not_found', 404);
  if (c.user_id !== a.user.id && !isAdmin(a.user)) return no('forbidden', 403);
  await env.DB.batch([
    env.DB.prepare('UPDATE comments SET deleted = ?1 WHERE id = ?2').bind(nowIso(), id),
    env.DB.prepare('UPDATE posts SET comment_count = CASE WHEN comment_count > 0 THEN comment_count - 1 ELSE 0 END WHERE id = ?1').bind(c.post_id)
  ]);
  return json({ ok: true });
}

// ----- 아빠 인증 -----
// 코드 쓰기: 조건부 UPDATE로 한 번만 쓰이게 한다(동시에 눌러도 한 사람만). 성공하면 {ok:true, role}, 아니면 {error}
async function useInvite(db, user, codeRaw) {
  const code = normCode(codeRaw);
  if (code.length < 4) return { error: 'code_bad' };
  const inv = await db.prepare('SELECT code, owner_id, kind, used_by, revoked FROM invites WHERE code = ?1').bind(code).first();
  if (!inv || inv.revoked) return { error: 'code_bad' };
  if (inv.used_by != null) return { error: 'code_used' };
  const at = nowIso();
  const r = await db.prepare('UPDATE invites SET used_by = ?1, used_at = ?2 WHERE code = ?3 AND used_by IS NULL AND revoked = 0').bind(user.id, at, code).run();
  if (!r.meta || !r.meta.changes) return { error: 'code_used' };
  const role = inv.kind === 'admin' ? 'admin' : (user.role || 'user');
  await db.prepare("UPDATE users SET verified = 1, verified_how = ?1, verified_at = ?2, invited_by = ?3, role = ?4 WHERE id = ?5")
    .bind(inv.kind === 'admin' ? 'admin' : 'invite', at, inv.owner_id, role, user.id).run();
  return { ok: true, role };
}

async function verifyCode(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  if (a.user.blocked) return no('blocked', 403);
  if (!(await allow(env.DB, await ipKey(request), 'code'))) return no('limit', 429);
  const b = await readJson(request);
  // 이미 인증한 사람도 관리자 코드는 쓸 수 있게 코드를 먼저 본다(아빠 코드를 낭비하지 않게 kind를 확인)
  if (a.user.verified === 1) {
    const inv = await env.DB.prepare('SELECT kind FROM invites WHERE code = ?1').bind(normCode(b && b.code)).first();
    if (!inv || inv.kind !== 'admin') return json({ ok: true, user: pubUser(a.user), already: true });
  }
  const r = await useInvite(env.DB, a.user, b && b.code);
  if (r.error) return no(r.error);
  const u = await env.DB.prepare('SELECT ' + USER_COLS + ' FROM users WHERE id = ?1').bind(a.user.id).first();
  return json({ ok: true, user: pubUser(u) });
}

async function verifyApply(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  if (a.user.blocked) return no('blocked', 403);
  if (a.user.verified === 1) return json({ ok: true, user: pubUser(a.user), already: true });
  const b = await readJson(request);
  if (!b) return no('bad_json');
  const stage = str(b.stage, 20), answer = str(b.answer, 1000);
  if (!STAGES.includes(stage)) return no('stage');
  if (len(answer) < LIM.answer[0] || len(answer) > LIM.answer[1]) return no('answer_len');
  if (b.pledge !== true) return no('pledge');
  const open = await env.DB.prepare("SELECT id FROM applications WHERE user_id = ?1 AND status = 'pending'").bind(a.user.id).first();
  if (open) return json({ ok: true, pending: true, user: pubUser(a.user) });
  if (!(await allow(env.DB, 'u:' + a.user.id, 'apply'))) return no('limit', 429);
  await env.DB.prepare('INSERT INTO applications (user_id, stage, answer, created) VALUES (?1, ?2, ?3, ?4)').bind(a.user.id, stage, answer, nowIso()).run();
  return json({ ok: true, pending: true, user: pubUser(a.user) });
}

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';       // 헷갈리는 글자(I·O·0·1) 뺌
function newCode() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, x => ALPHA[x % ALPHA.length]).join('');
}

async function insertInvite(db, ownerId, kind, note) {
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try {
      await db.prepare('INSERT INTO invites (code, owner_id, kind, note, created) VALUES (?1, ?2, ?3, ?4, ?5)').bind(code, ownerId, kind, note || '', nowIso()).run();
      return code;
    } catch (e) { if (!/UNIQUE/i.test(String(e && e.message))) throw e; }
  }
  throw new Error('code collision');
}

async function createInvite(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  if (!canWrite(a.user)) return no(a.user.blocked ? 'blocked' : 'verify', 403);
  if (!isAdmin(a.user)) {
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM invites WHERE owner_id = ?1 AND revoked = 0').bind(a.user.id).first();
    if (c && c.n >= INVITE_MAX) return no('invite_max');
    if (!(await allow(env.DB, 'u:' + a.user.id, 'invite'))) return no('limit', 429);
  }
  const code = await insertInvite(env.DB, a.user.id, 'dad', '');
  return json({ ok: true, invite: { code: showCode(code), used: false } });
}

async function myInvites(db, uid) {
  const r = await db.prepare('SELECT i.code, i.used_by, i.created, u.nick AS used_nick FROM invites i LEFT JOIN users u ON u.id = i.used_by '
    + 'WHERE i.owner_id = ?1 AND i.revoked = 0 ORDER BY i.created').bind(uid).all();
  return (r.results || []).map(x => ({ code: showCode(x.code), used: x.used_by != null, nick: x.used_nick || '' }));
}

// ----- 사용자 -----
async function join(request, env) {
  const db = env.DB;
  const token = bearer(request);
  if (!tokenOk(token)) return no('login', 401);
  const hash = await sha256('tok|' + token);
  const have = await db.prepare('SELECT ' + USER_COLS + ' FROM users WHERE token_hash = ?1').bind(hash).first();
  if (have) return json({ ok: true, user: pubUser(have), existing: true });
  const b = await readJson(request);
  const nick = str(b && b.nick, 40);
  const bad = checkNick(nick);
  if (bad) return no(bad);
  if (await db.prepare('SELECT 1 AS x FROM users WHERE nick_key = ?1').bind(nickKey(nick)).first()) return no('nick_taken', 409);
  const ip = await ipKey(request);
  if (!(await allow(db, ip, 'join'))) return no('limit', 429);
  const created = nowIso();
  let uid;
  try {
    const r = await db.prepare('INSERT INTO users (nick, nick_key, token_hash, created, last_seen) VALUES (?1, ?2, ?3, ?4, ?4)')
      .bind(nick, nickKey(nick), hash, created).run();
    uid = r.meta && r.meta.last_row_id;
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) return no('nick_taken', 409);
    throw e;
  }
  let inviteError = '';
  if (b && b.invite) {
    if (await allow(db, ip, 'code')) {
      const res = await useInvite(db, { id: uid, role: 'user' }, b.invite);
      inviteError = res.error || '';
    } else inviteError = 'limit';
  }
  const u = await db.prepare('SELECT ' + USER_COLS + ' FROM users WHERE id = ?1').bind(uid).first();
  return json({ ok: true, user: pubUser(u), invite_error: inviteError });
}

async function me(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  const db = env.DB, uid = a.user.id;
  const [ps, cs, ap] = await db.batch([
    db.prepare('SELECT id, cat, title, substr(body, 1, 140) AS preview, created, comment_count FROM posts WHERE user_id = ?1 AND deleted IS NULL ORDER BY id DESC LIMIT 100').bind(uid),
    db.prepare('SELECT c.id, c.body, c.created, c.post_id, p.title AS post_title FROM comments c JOIN posts p ON p.id = c.post_id '
      + 'WHERE c.user_id = ?1 AND c.deleted IS NULL AND p.deleted IS NULL ORDER BY c.id DESC LIMIT 100').bind(uid),
    db.prepare('SELECT status, created FROM applications WHERE user_id = ?1 ORDER BY id DESC LIMIT 1').bind(uid),
    db.prepare('UPDATE users SET last_seen = ?1 WHERE id = ?2').bind(nowIso(), uid)
  ]);
  const invites = a.user.verified === 1 ? await myInvites(db, uid) : [];
  const badge = a.user.role === 'official' ? 'official' : (a.user.verified === 1 ? 'dad' : '');
  return json({ ok: true, user: pubUser(a.user), application: (ap.results || [])[0] || null, invites, invite_max: isAdmin(a.user) ? null : INVITE_MAX,
    posts: (ps.results || []).map(r => rowPost({ ...r, nick: a.user.nick, uid, badge })),
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
  return json({ ok: true, user: pubUser({ ...a.user, nick }) });
}

// ----- 관리자(휴먼쌤) -----
async function admin(request, env, what, method) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  if (!isAdmin(a.user)) return no('forbidden', 403);
  const db = env.DB;
  if (what === 'queue' && method === 'GET') {
    const [q, us, inv] = await db.batch([
      db.prepare("SELECT ap.id, ap.user_id, ap.stage, ap.answer, ap.created, u.nick FROM applications ap JOIN users u ON u.id = ap.user_id WHERE ap.status = 'pending' ORDER BY ap.id"),
      db.prepare("SELECT u.id, u.nick, u.created, u.verified, u.verified_how, u.blocked, u.role, i.nick AS inviter, (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id AND p.deleted IS NULL) AS posts "
        + "FROM users u LEFT JOIN users i ON i.id = u.invited_by WHERE u.role != 'official' ORDER BY u.id DESC LIMIT 200"),
      db.prepare("SELECT code, note, used_by, created FROM invites WHERE owner_id IS NULL OR owner_id = ?1 ORDER BY created DESC LIMIT 50").bind(a.user.id)
    ]);
    return json({ ok: true, queue: q.results || [], users: us.results || [],
      invites: (inv.results || []).map(x => ({ code: showCode(x.code), note: x.note, used: x.used_by != null })) });
  }
  if (what === 'decide' && method === 'POST') {
    const b = await readJson(request);
    const id = +(b && b.id) || 0;
    const ap = await db.prepare("SELECT id, user_id FROM applications WHERE id = ?1 AND status = 'pending'").bind(id).first();
    if (!ap) return no('not_found', 404);
    const at = nowIso(), ok = !!(b && b.approve);
    const stmts = [db.prepare("UPDATE applications SET status = ?1, answer = '', decided_at = ?2, decided_by = ?3 WHERE id = ?4").bind(ok ? 'approved' : 'rejected', at, a.user.id, id)];
    if (ok) stmts.push(db.prepare("UPDATE users SET verified = 1, verified_how = 'apply', verified_at = ?1 WHERE id = ?2").bind(at, ap.user_id));
    await db.batch(stmts);
    return json({ ok: true });
  }
  if (what === 'user' && method === 'POST') {
    const b = await readJson(request);
    const id = +(b && b.user_id) || 0, action = String(b && b.action || '');
    const u = await db.prepare('SELECT id, role FROM users WHERE id = ?1').bind(id).first();
    if (!u) return no('not_found', 404);
    if (u.role !== 'user') return no('forbidden', 403);        // 관리자·자료실 계정은 여기서 못 바꾼다
    const sql = {
      verify: "UPDATE users SET verified = 1, blocked = 0, verified_how = 'admin', verified_at = ?1 WHERE id = ?2",
      unverify: "UPDATE users SET verified = 0, verified_how = '', verified_at = ?1 WHERE id = ?2",
      block: "UPDATE users SET verified = 0, blocked = 1, verified_how = '', verified_at = ?1 WHERE id = ?2",
      unblock: "UPDATE users SET blocked = 0, verified_at = ?1 WHERE id = ?2"
    }[action];
    if (!sql) return no('bad_json');
    await db.prepare(sql).bind(nowIso(), id).run();
    return json({ ok: true });
  }
  if (what === 'invites' && method === 'POST') {
    const b = await readJson(request);
    const count = Math.min(Math.max(+(b && b.count) || 1, 1), 20), note = str(b && b.note, 60);
    const codes = [];
    for (let i = 0; i < count; i++) codes.push(showCode(await insertInvite(db, a.user.id, 'dad', note)));
    return json({ ok: true, codes });
  }
  return no('not_found', 404);
}

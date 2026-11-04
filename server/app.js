// 육아맨 서버(2026-11-04) — Cloudflare Pages Functions + D1. 화면(public/)과 같은 주소라 따로 허용(CORS)할 것이 없다.
// 약속: 응답은 늘 JSON — {ok:true, …} 또는 {ok:false, error:'이름'}(HTTP 상태도 함께). 글자는 모두 다듬어(trim) 길이 한도를 넘기면 거절.
// 쓰기와 '내 정보'는 머리글 Authorization: Bearer <기기 토큰>. 토큰은 폰이 만든 임의 글자(16~80자)이고, 서버는 SHA-256 해시만 둔다.
// 커뮤니티는 읽기(목록·글·검색)도 쓰기도 '인증 아빠'만(verified = 1. 2026-11-04 휴먼쌤 "인증 아빠만"). 인증 길 둘: 초대 코드(바로) · 신청서(관리자 승인).
//  GET    /api/posts?cat=&q=&before=&limit=   글 목록(최신순, 인증 아빠만). before = 이 번호보다 작은 글부터(더 보기). 응답 next = 다음 before 값(없으면 null)
//  GET    /api/posts/<id>                      글 하나 + 댓글(인증 아빠만)
//  POST   /api/join {nick, invite?}            닉네임 정하기(기기 토큰 등록). 코드가 맞으면 바로 인증. 이미 등록된 토큰이면 그 사용자(existing:true).
//                                              새 가입이면 복구 코드(recovery, 12자)를 한 번만 돌려준다 — 서버는 해시만 둔다.
//  POST   /api/recover {code}                  복구 코드로 이 기기(새 토큰)를 그 계정에 붙인다. 이전 기기의 토큰은 그 자리에서 끊기고, 새 복구 코드를 돌려준다(한 번 쓰면 바뀜)
//  POST   /api/recovery/new                    복구 코드 새로 만들기(이전 코드는 무효)
//  POST   /api/logout                          이 기기의 토큰 끊기(계정은 남고, 복구 코드로만 돌아온다)
//  GET    /api/me                              내 정보(인증 상태·신청 상태·초대 코드·복구 코드 있는지) + 내 글 + 내 댓글
//  PATCH  /api/me {nick}                       닉네임 바꾸기(7일에 1번)
//  DELETE /api/me {confirm:true}               탈퇴: 내 글·댓글 내용을 비우고 계정 줄을 지운다(관리자·자료실 계정은 안 됨)
//  POST   /api/verify/code {code}              초대 코드로 인증
//  POST   /api/verify/apply {stage,answer,pledge}  신청서(관리자가 읽고 승인)
//  POST   /api/invites                         초대 코드 만들기(인증 아빠 3개, 관리자 제한 없음)
//  POST   /api/posts {cat,title,body}          글쓰기(한 시간 10개)
//  DELETE /api/posts/<id>                      내 글 지우기(관리자는 모두). deleted에 시각을 적고 제목·본문과 달린 댓글 내용을 비운다(11-04 검수 5)
//  POST   /api/posts/<id>/comments {body}      댓글(한 시간 60개)
//  DELETE /api/comments/<id>                   내 댓글 지우기(관리자는 모두). 내용을 비운다
//  POST   /api/reports {kind, id, reason}      글·댓글 신고(인증 아빠, 하루 10건, 같은 대상은 한 번). 관리자 화면 신고함에 쌓인다
//  POST   /api/me/seen                         내 글의 새 댓글을 봤다고 표시(MY 배지 끄기)
//  GET    /api/admin/queue                     관리자: 대기 신청서 + 신고함 + 최근 회원
//  POST   /api/admin/decide {id, approve}      관리자: 승인·거절(답변은 지움)
//  POST   /api/admin/report {id, action}       관리자: hide(대상 글·댓글 숨기기 = 내용 비움) · keep(그대로 둠). 같은 대상의 신고는 함께 처리
//  POST   /api/admin/user {user_id, action}    관리자: unverify(인증 해제) · block(해제 + 재신청 막기 + 안 쓴 초대 코드 폐기) · unblock · verify · logout(기기 토큰 끊기) · hide_all(그 회원의 글·댓글 모두 숨김)
//  POST   /api/admin/invites {count, note}     관리자: 운영 초대 코드 만들기
//  GET    /api/health                          살아 있나
// 저장하는 개인정보: 닉네임 · 기기 토큰 해시 · 복구 코드 해시 · 쓴 글·댓글 · 대기 중인 신청 답변(결정 뒤 지움) · 누가 초대했는지 · 마지막 접속 시각.
//   횟수 제한용 기기 주소(IP)는 해시 16자로 짧게(가입·코드·복구 시도에만, 이틀 안에 지움). 지운 글·댓글은 내용을 비우고 시각만 남긴다. 탈퇴하면 계정 줄을 지운다.

const CATS = ['question', 'tip', 'daily', 'leave', 'play', 'school', 'gear'];           // public/app.js CATS와 같게('school' = 학교·학습, 검수 23)
const AGES = ['expect', 'baby', 'kid', 'low', 'high', 'teen'];   // 아이 나이 칸(public/app.js AGES와 같게). 글에 붙이면 또래 아빠들 글로 거른다(11-04 UI 3안 '아이 나이 길')
const STAGES = ['raising', 'expecting'];
const LIM = { nick: [2, 12], title: [2, 60], body: [1, 3000], comment: [1, 1000], answer: [20, 500], list: 20, listMax: 50 };
const RATE = {                                        // [횟수, 기간 ms]
  join: [20, 600000], post: [10, 3600000], comment: [60, 3600000], nick: [1, 7 * 86400000],   // 닉네임은 7일에 1번(사칭 방어, 검수 16)
  code: [10, 600000], apply: [3, 86400000], invite: [10, 86400000], recover: [10, 600000], report: [10, 86400000]
};
const INVITE_MAX = 3;                                 // 인증 아빠 한 사람이 만들 수 있는 초대 코드
// 운영진처럼 보이는 이름 막기(검수 16). 띄어쓰기·특수문자를 지우고 닮은 글자(0→o, 1→i, 3→e, 5→s)를 접은 뒤 본다.
const RESERVED = /(육아맨|운영|관리|자료실|공식|스태프|스탭|매니저|마스터|휴먼쌤|휴먼샘|admin|official|staff|manager|master|moderator|yukaman|humanssaem)/i;
const foldNick = s => s.replace(/[\s_.\-]+/g, '').toLowerCase().replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/5/g, 's');

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
const showCode = c => (c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c.length === 12 ? c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8) : c);
// 끊긴 기기 자리에 두는 값. 폰이 만드는 토큰 꼴(16~80자 영숫자)과 달라 어떤 토큰의 해시와도 맞지 않고, 줄마다 달라 UNIQUE에도 걸리지 않는다.
const offToken = id => 'off|' + id + '|' + nowIso() + '|' + Math.random().toString(36).slice(2);

async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
}

function checkNick(nick) {
  const n = len(nick);
  if (n < LIM.nick[0] || n > LIM.nick[1]) return 'nick_len';
  if (!/^[가-힣A-Za-z0-9 _.]+$/.test(nick)) return 'nick_chars';
  if (RESERVED.test(foldNick(nick))) return 'nick_reserved';
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
    if (seg[0] === 'reports' && !seg[1] && m === 'POST') return report(request, env);
    if (seg[0] === 'me' && seg[1] === 'seen' && !seg[2] && m === 'POST') return seenComments(request, env);
    if (seg[0] === 'join' && !seg[1] && m === 'POST') return join(request, env);
    if (seg[0] === 'recover' && !seg[1] && m === 'POST') return recover(request, env);
    if (seg[0] === 'recovery' && seg[1] === 'new' && !seg[2] && m === 'POST') return recoveryNew(request, env);
    if (seg[0] === 'logout' && !seg[1] && m === 'POST') return logout(request, env);
    if (seg[0] === 'me' && !seg[1]) {
      if (m === 'GET') return me(request, env);
      if (m === 'PATCH') return rename(request, env);
      if (m === 'DELETE') return deleteMe(request, env);
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

const USER_COLS = 'id, nick, created, role, verified, verified_how, blocked, recovery_hash, comments_seen';
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

const BADGE = "CASE WHEN u.role = 'official' THEN 'official' WHEN u.role = 'admin' THEN 'admin' WHEN u.verified = 1 THEN 'dad' ELSE '' END AS badge";
const badgeOf = u => (u.role === 'official' ? 'official' : u.role === 'admin' ? 'admin' : u.verified === 1 ? 'dad' : '');
const rowPost = r => ({ id: r.id, cat: r.cat, age: r.age || '', title: r.title, preview: r.preview, created: r.created, comments: r.comment_count, nick: r.nick, uid: r.uid, badge: r.badge || '' });
const pubUser = u => ({ id: u.id, nick: u.nick, created: u.created, verified: u.verified === 1 && !u.blocked, role: u.role, how: u.verified_how || '', blocked: !!u.blocked });

// ----- 글 -----
async function listPosts(request, env, sp) {
  const a = await reader(request, env.DB);
  if (a.err) return a.err;
  const db = env.DB;
  const cat = str(sp.get('cat'), 20), age = str(sp.get('age'), 10), q = str(sp.get('q'), 60), before = +sp.get('before') || 0;
  const limit = Math.min(Math.max(+sp.get('limit') || LIM.list, 1), LIM.listMax);
  // 자료실 계정 글은 가이드 Q&A·정보에 있으니 커뮤니티 목록·검색에는 아빠들 글만(검수 15)
  const where = ['p.deleted IS NULL', "u.role != 'official'"], args = [];
  if (cat && CATS.includes(cat)) { where.push('p.cat = ?'); args.push(cat); }
  if (age && AGES.includes(age)) { where.push('p.age = ?'); args.push(age); }
  const words = q ? q.split(/\s+/).filter(Boolean).slice(0, 5) : [];
  if (before) { where.push('p.id < ?'); args.push(before); }
  const head = 'SELECT p.id, p.cat, p.age, p.title, substr(p.body, 1, 140) AS preview, p.created, p.comment_count, u.nick, u.id AS uid, ' + BADGE + ' FROM posts p JOIN users u ON u.id = p.user_id WHERE ';
  const tail = ' ORDER BY p.id DESC LIMIT ?';
  let rows = null;
  // 검색 색인(FTS5 trigram, 검수 27): 세 글자 이상인 낱말은 색인으로, 짧은 낱말이나 색인이 없을 때는 LIKE로(글 전체를 훑음)
  if (words.length && words.every(w => Array.from(w).length >= 3)) {
    const match = words.map(w => '"' + w.replace(/"/g, '""') + '"').join(' AND ');
    try {
      const rs = await db.prepare(head + where.concat(['p.id IN (SELECT rowid FROM posts_fts WHERE posts_fts MATCH ?)']).join(' AND ') + tail).bind(...args, match, limit + 1).all();
      rows = rs.results || [];
    } catch (e) { rows = null; }
  }
  if (rows === null) {
    const w2 = where.slice(), a2 = args.slice();
    words.forEach(w => {
      const like = '%' + w.replace(/[\\%_]/g, c => '\\' + c) + '%';
      w2.push("(p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\')");
      a2.push(like, like);
    });
    const rs = await db.prepare(head + w2.join(' AND ') + tail).bind(...a2, limit + 1).all();
    rows = rs.results || [];
  }
  const more = rows.length > limit;
  if (more) rows.pop();
  return json({ ok: true, posts: rows.map(rowPost), next: more ? rows[rows.length - 1].id : null });
}

async function getPost(request, env, id) {
  const a = await reader(request, env.DB);
  if (a.err) return a.err;
  const db = env.DB;
  const p = await db.prepare('SELECT p.id, p.cat, p.age, p.title, p.body, p.created, p.comment_count, u.nick, u.id AS uid, ' + BADGE + ' '
    + 'FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?1 AND p.deleted IS NULL').bind(id).first();
  if (!p) return no('not_found', 404);
  const cs = await db.prepare('SELECT c.id, c.body, c.created, u.nick, u.id AS uid, ' + BADGE + ' FROM comments c JOIN users u ON u.id = c.user_id '
    + 'WHERE c.post_id = ?1 AND c.deleted IS NULL ORDER BY c.id').bind(id).all();
  return json({ ok: true,
    post: { id: p.id, cat: p.cat, age: p.age || '', title: p.title, body: p.body, created: p.created, comments: p.comment_count, nick: p.nick, uid: p.uid, badge: p.badge || '' },
    comments: (cs.results || []).map(c => ({ id: c.id, body: c.body, created: c.created, nick: c.nick, uid: c.uid, badge: c.badge || '' })) });
}

async function createPost(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  if (!canWrite(a.user)) return no(a.user.blocked ? 'blocked' : 'verify', 403);
  const b = await readJson(request);
  if (!b) return no('bad_json');
  const cat = str(b.cat, 20), age = str(b.age, 10), title = str(b.title, 200), text = str(b.body, 5000);
  if (!CATS.includes(cat)) return no('cat');
  if (age && !AGES.includes(age)) return no('age');
  if (len(title) < LIM.title[0] || len(title) > LIM.title[1]) return no('title_len');
  if (len(text) < LIM.body[0] || len(text) > LIM.body[1]) return no('body_len');
  if (!isAdmin(a.user) && !(await allow(env.DB, 'u:' + a.user.id, 'post'))) return no('limit', 429);
  const created = nowIso();
  const r = await env.DB.prepare('INSERT INTO posts (user_id, cat, age, title, body, created) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(a.user.id, cat, age, title, text, created).run();
  const id = r.meta && r.meta.last_row_id;
  return json({ ok: true, id, post: { id, cat, age, title, body: text, created, comments: 0, nick: a.user.nick, uid: a.user.id, badge: badgeOf(a.user) } });
}

async function deletePost(request, env, id) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  const p = await env.DB.prepare('SELECT user_id FROM posts WHERE id = ?1 AND deleted IS NULL').bind(id).first();
  if (!p) return no('not_found', 404);
  if (p.user_id !== a.user.id && !isAdmin(a.user)) return no('forbidden', 403);
  // 내용은 바로 비운다(아이 정보를 실수로 적은 글이 DB에 남지 않게). 달린 댓글도 글과 함께 사라지므로 내용을 비운다.
  const at = nowIso();
  await env.DB.batch([
    env.DB.prepare("UPDATE posts SET deleted = ?1, title = '', body = '' WHERE id = ?2").bind(at, id),
    env.DB.prepare("UPDATE comments SET body = '', deleted = COALESCE(deleted, ?1) WHERE post_id = ?2").bind(at, id)
  ]);
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
  return json({ ok: true, comment: { id, body: text, created, nick: a.user.nick, uid: a.user.id, badge: badgeOf(a.user) } });
}

// ----- 신고(검수 21) -----
async function report(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  if (!canWrite(a.user)) return no(a.user.blocked ? 'blocked' : 'verify', 403);
  const b = await readJson(request);
  if (!b) return no('bad_json');
  const kind = b.kind === 'comment' ? 'comment' : b.kind === 'post' ? 'post' : '';
  const id = +b.id || 0, reason = str(b.reason, 300);
  if (!kind || !id) return no('bad_json');
  const row = kind === 'post'
    ? await env.DB.prepare('SELECT user_id FROM posts WHERE id = ?1 AND deleted IS NULL').bind(id).first()
    : await env.DB.prepare('SELECT user_id FROM comments WHERE id = ?1 AND deleted IS NULL').bind(id).first();
  if (!row) return no('not_found', 404);
  if (row.user_id === a.user.id) return no('own');
  const dup = await env.DB.prepare('SELECT id FROM reports WHERE kind = ?1 AND target_id = ?2 AND user_id = ?3').bind(kind, id, a.user.id).first();
  if (dup) return json({ ok: true, already: true });
  if (!(await allow(env.DB, 'u:' + a.user.id, 'report'))) return no('limit', 429);
  await env.DB.prepare('INSERT INTO reports (kind, target_id, user_id, reason, created) VALUES (?1, ?2, ?3, ?4, ?5)').bind(kind, id, a.user.id, reason, nowIso()).run();
  return json({ ok: true });
}

// 글·댓글 숨기기 = 지우기와 같다(내용을 비움). 관리자 신고 처리와 '모두 숨김'이 쓴다.
function hidePostStmts(db, id, at) {
  return [
    db.prepare("UPDATE posts SET deleted = COALESCE(deleted, ?1), title = '', body = '' WHERE id = ?2").bind(at, id),
    db.prepare("UPDATE comments SET body = '', deleted = COALESCE(deleted, ?1) WHERE post_id = ?2").bind(at, id)
  ];
}
function hideCommentStmts(db, id, postId, at) {
  return [
    db.prepare("UPDATE comments SET deleted = ?1, body = '' WHERE id = ?2 AND deleted IS NULL").bind(at, id),
    db.prepare('UPDATE posts SET comment_count = (SELECT COUNT(*) FROM comments c WHERE c.post_id = posts.id AND c.deleted IS NULL) WHERE id = ?1').bind(postId)
  ];
}

// 내 글에 새 댓글이 달렸는지(검수 22): 마지막으로 본 시각 뒤에 남이 단 댓글 수
async function newCommentCount(db, user) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM comments c JOIN posts p ON p.id = c.post_id WHERE p.user_id = ?1 AND c.user_id != ?1 AND c.deleted IS NULL AND p.deleted IS NULL AND c.created > ?2')
    .bind(user.id, user.comments_seen || '').first();
  return r ? r.n : 0;
}
async function seenComments(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  await env.DB.prepare('UPDATE users SET comments_seen = ?1 WHERE id = ?2').bind(nowIso(), a.user.id).run();
  return json({ ok: true });
}

async function deleteComment(request, env, id) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  const c = await env.DB.prepare('SELECT user_id, post_id FROM comments WHERE id = ?1 AND deleted IS NULL').bind(id).first();
  if (!c) return no('not_found', 404);
  if (c.user_id !== a.user.id && !isAdmin(a.user)) return no('forbidden', 403);
  await env.DB.batch([
    env.DB.prepare("UPDATE comments SET deleted = ?1, body = '' WHERE id = ?2").bind(nowIso(), id),
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
  await db.batch([
    db.prepare("UPDATE users SET verified = 1, verified_how = ?1, verified_at = ?2, invited_by = ?3, role = ?4 WHERE id = ?5").bind(inv.kind === 'admin' ? 'admin' : 'invite', at, inv.owner_id, role, user.id),
    db.prepare("UPDATE applications SET status = 'approved', answer = '', decided_at = ?1 WHERE user_id = ?2 AND status = 'pending'").bind(at, user.id)   // 코드로 인증하면 대기 중인 신청 답변도 지운다
  ]);
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
// 복구 코드: 폰을 바꾸거나 저장소가 지워졌을 때 같은 계정으로 돌아오는 유일한 길. 12자(초대 코드와 같은 글자판), 서버는 SHA-256만 둔다.
function newRecovery() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, x => ALPHA[x % ALPHA.length]).join('');
}
const recHash = code => sha256('rec|' + code);
async function setRecovery(db, uid) {
  const code = newRecovery();
  await db.prepare('UPDATE users SET recovery_hash = ?1 WHERE id = ?2').bind(await recHash(code), uid).run();
  return showCode(code);
}

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
  const recovery = await setRecovery(db, uid);
  const u = await db.prepare('SELECT ' + USER_COLS + ' FROM users WHERE id = ?1').bind(uid).first();
  return json({ ok: true, user: pubUser(u), invite_error: inviteError, recovery });
}

// 복구: 새 기기의 토큰 + 복구 코드 → 그 계정의 토큰을 이 기기로 바꾼다(이전 기기는 끊김). 코드는 한 번 쓰면 새 코드로 바뀐다.
async function recover(request, env) {
  const db = env.DB;
  const token = bearer(request);
  if (!tokenOk(token)) return no('login', 401);
  if (!(await allow(db, await ipKey(request), 'recover'))) return no('limit', 429);
  const b = await readJson(request);
  const code = normCode(b && b.code);
  if (code.length !== 12) return no('recovery_bad');
  const user = await db.prepare('SELECT ' + USER_COLS + ' FROM users WHERE recovery_hash = ?1').bind(await recHash(code)).first();
  if (!user || user.role === 'official') return no('recovery_bad');
  const hash = await sha256('tok|' + token);
  const other = await db.prepare('SELECT id FROM users WHERE token_hash = ?1').bind(hash).first();
  if (other && other.id !== user.id) return no('token_in_use', 409);      // 이 기기에 이미 다른 계정이 있다(화면은 복구 전에 토큰을 새로 만든다)
  await db.prepare('UPDATE users SET token_hash = ?1, last_seen = ?2 WHERE id = ?3').bind(hash, nowIso(), user.id).run();
  const recovery = await setRecovery(db, user.id);
  return json({ ok: true, user: pubUser(user), recovery });
}

async function recoveryNew(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  if (a.user.role === 'official') return no('forbidden', 403);
  if (!(await allow(env.DB, 'u:' + a.user.id, 'recover'))) return no('limit', 429);
  return json({ ok: true, recovery: await setRecovery(env.DB, a.user.id) });
}

// 이 기기 끊기. 계정은 남고 복구 코드로만 돌아온다(관리자 폰을 잃었을 때도 다른 기기에서 복구하면 그 순간 옛 기기가 끊긴다).
async function logout(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  await env.DB.prepare('UPDATE users SET token_hash = ?1 WHERE id = ?2').bind(offToken(a.user.id), a.user.id).run();
  return json({ ok: true });
}

// 탈퇴: 글·댓글 내용을 비우고(지운 표시), 내 글에 달린 남의 댓글도 글과 함께 사라지니 비운다. 안 쓴 초대 코드는 막고, 신청서·횟수 기록·계정 줄을 지운다.
async function deleteMe(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  if (a.user.role !== 'user') return no('forbidden', 403);          // 관리자는 먼저 넘겨 주고, 자료실 계정은 로그인이 없다
  const b = await readJson(request);
  if (!b || b.confirm !== true) return no('bad_json');
  const db = env.DB, uid = a.user.id, at = nowIso();
  await db.batch([
    db.prepare("UPDATE comments SET body = '', deleted = COALESCE(deleted, ?1) WHERE user_id = ?2").bind(at, uid),
    db.prepare('UPDATE posts SET comment_count = (SELECT COUNT(*) FROM comments c WHERE c.post_id = posts.id AND c.deleted IS NULL) '
      + 'WHERE id IN (SELECT post_id FROM comments WHERE user_id = ?1)').bind(uid),
    db.prepare("UPDATE comments SET body = '', deleted = COALESCE(deleted, ?1) WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?2)").bind(at, uid),
    db.prepare("UPDATE posts SET title = '', body = '', deleted = COALESCE(deleted, ?1) WHERE user_id = ?2").bind(at, uid),
    db.prepare('UPDATE invites SET revoked = 1 WHERE owner_id = ?1 AND used_by IS NULL').bind(uid),
    db.prepare('DELETE FROM applications WHERE user_id = ?1').bind(uid),
    db.prepare('DELETE FROM acts WHERE who = ?1').bind('u:' + uid),
    db.prepare('DELETE FROM users WHERE id = ?1').bind(uid)
  ]);
  return json({ ok: true });
}

async function me(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  const db = env.DB, uid = a.user.id;
  const [ps, cs, ap] = await db.batch([
    db.prepare('SELECT id, cat, age, title, substr(body, 1, 140) AS preview, created, comment_count FROM posts WHERE user_id = ?1 AND deleted IS NULL ORDER BY id DESC LIMIT 100').bind(uid),
    db.prepare('SELECT c.id, c.body, c.created, c.post_id, p.title AS post_title FROM comments c JOIN posts p ON p.id = c.post_id '
      + 'WHERE c.user_id = ?1 AND c.deleted IS NULL AND p.deleted IS NULL ORDER BY c.id DESC LIMIT 100').bind(uid),
    db.prepare('SELECT status, created FROM applications WHERE user_id = ?1 ORDER BY id DESC LIMIT 1').bind(uid),
    db.prepare('UPDATE users SET last_seen = ?1 WHERE id = ?2').bind(nowIso(), uid)
  ]);
  const invites = a.user.verified === 1 ? await myInvites(db, uid) : [];
  const badge = badgeOf(a.user);
  // 내 글에 달린 새 댓글(남이 단 것, 마지막으로 본 뒤): 수와 최근 20개
  const newN = await newCommentCount(db, a.user);
  const recent = newN ? await db.prepare('SELECT c.id, c.body, c.created, c.post_id, p.title AS post_title, u.nick FROM comments c JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = c.user_id '
    + 'WHERE p.user_id = ?1 AND c.user_id != ?1 AND c.deleted IS NULL AND p.deleted IS NULL AND c.created > ?2 ORDER BY c.id DESC LIMIT 20').bind(uid, a.user.comments_seen || '').all() : { results: [] };
  return json({ ok: true, user: pubUser(a.user), application: (ap.results || [])[0] || null, invites, invite_max: isAdmin(a.user) ? null : INVITE_MAX, has_recovery: !!a.user.recovery_hash,
    new_comments: newN, new_list: (recent.results || []).map(c => ({ id: c.id, body: c.body, created: c.created, post_id: c.post_id, post_title: c.post_title, nick: c.nick })),
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
    const [q, us, inv, rp] = await db.batch([
      db.prepare("SELECT ap.id, ap.user_id, ap.stage, ap.answer, ap.created, u.nick FROM applications ap JOIN users u ON u.id = ap.user_id WHERE ap.status = 'pending' ORDER BY ap.id"),
      db.prepare("SELECT u.id, u.nick, u.created, u.verified, u.verified_how, u.blocked, u.role, i.nick AS inviter, (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id AND p.deleted IS NULL) AS posts "
        + "FROM users u LEFT JOIN users i ON i.id = u.invited_by WHERE u.role != 'official' ORDER BY u.id DESC LIMIT 200"),
      db.prepare("SELECT code, note, used_by, created FROM invites WHERE owner_id IS NULL OR owner_id = ?1 ORDER BY created DESC LIMIT 50").bind(a.user.id),
      // 신고함: 대기 중인 신고를 대상별로 묶어 신고 수와 대상의 앞부분을 함께
      db.prepare("SELECT r.kind, r.target_id, COUNT(*) AS n, MIN(r.created) AS first_at, GROUP_CONCAT(r.reason, ' / ') AS reasons, "
        + "CASE WHEN r.kind = 'post' THEN (SELECT p.title FROM posts p WHERE p.id = r.target_id) ELSE '' END AS title, "
        + "CASE WHEN r.kind = 'post' THEN (SELECT substr(p.body, 1, 160) FROM posts p WHERE p.id = r.target_id) ELSE (SELECT substr(c.body, 1, 160) FROM comments c WHERE c.id = r.target_id) END AS preview, "
        + "CASE WHEN r.kind = 'post' THEN (SELECT u.nick FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = r.target_id) ELSE (SELECT u.nick FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = r.target_id) END AS author, "
        + "CASE WHEN r.kind = 'post' THEN r.target_id ELSE (SELECT c.post_id FROM comments c WHERE c.id = r.target_id) END AS post_id, "
        + "CASE WHEN r.kind = 'post' THEN (SELECT p.deleted FROM posts p WHERE p.id = r.target_id) ELSE (SELECT c.deleted FROM comments c WHERE c.id = r.target_id) END AS gone "
        + "FROM reports r WHERE r.handled IS NULL GROUP BY r.kind, r.target_id ORDER BY first_at")
    ]);
    return json({ ok: true, queue: q.results || [], users: us.results || [], reports: rp.results || [],
      invites: (inv.results || []).map(x => ({ code: showCode(x.code), note: x.note, used: x.used_by != null })) });
  }
  if (what === 'report' && method === 'POST') {
    const b = await readJson(request);
    const kind = b && b.kind === 'comment' ? 'comment' : 'post', id = +(b && b.id) || 0, action = String(b && b.action || '');
    if (!id || !['hide', 'keep'].includes(action)) return no('bad_json');
    const at = nowIso();
    const stmts = [];
    if (action === 'hide') {
      if (kind === 'post') stmts.push(...hidePostStmts(db, id, at));
      else {
        const c = await db.prepare('SELECT post_id FROM comments WHERE id = ?1').bind(id).first();
        if (c) stmts.push(...hideCommentStmts(db, id, c.post_id, at));
      }
    }
    stmts.push(db.prepare('UPDATE reports SET handled = ?1, handled_by = ?2, result = ?3 WHERE kind = ?4 AND target_id = ?5 AND handled IS NULL').bind(at, a.user.id, action === 'hide' ? 'hidden' : 'kept', kind, id));
    await db.batch(stmts);
    return json({ ok: true });
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
    const at = nowIso();
    if (action === 'hide_all') {                                 // 그 회원의 글·댓글을 모두 숨긴다(내용 비움). 계정은 남는다
      await db.batch([
        db.prepare("UPDATE comments SET body = '', deleted = COALESCE(deleted, ?1) WHERE user_id = ?2").bind(at, id),
        db.prepare('UPDATE posts SET comment_count = (SELECT COUNT(*) FROM comments c WHERE c.post_id = posts.id AND c.deleted IS NULL) WHERE id IN (SELECT post_id FROM comments WHERE user_id = ?1)').bind(id),
        db.prepare("UPDATE comments SET body = '', deleted = COALESCE(deleted, ?1) WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?2)").bind(at, id),
        db.prepare("UPDATE posts SET title = '', body = '', deleted = COALESCE(deleted, ?1) WHERE user_id = ?2").bind(at, id)
      ]);
      return json({ ok: true });
    }
    const sql = {
      verify: "UPDATE users SET verified = 1, blocked = 0, verified_how = 'admin', verified_at = ?1 WHERE id = ?2",
      unverify: "UPDATE users SET verified = 0, verified_how = '', verified_at = ?1 WHERE id = ?2",
      block: "UPDATE users SET verified = 0, blocked = 1, verified_how = '', verified_at = ?1 WHERE id = ?2",
      unblock: "UPDATE users SET blocked = 0, verified_at = ?1 WHERE id = ?2",
      logout: 'UPDATE users SET token_hash = ?1 WHERE id = ?2'            // 그 회원의 기기를 끊는다(복구 코드로만 돌아옴)
    }[action];
    if (!sql) return no('bad_json');
    const stmts = [db.prepare(sql).bind(action === 'logout' ? offToken(id) : at, id)];
    if (action === 'block') stmts.push(db.prepare('UPDATE invites SET revoked = 1 WHERE owner_id = ?1 AND used_by IS NULL').bind(id));   // 안 쓴 초대 코드로 새 기기가 돌아오지 못하게(검수 16)
    await db.batch(stmts);
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

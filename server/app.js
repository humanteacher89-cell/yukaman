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
//  GET    /api/posts/hot                       지금 뜨는 글(최근 7일 다른 사람 2명 이상이 댓글, 인증 아빠만, 3개까지)
//  GET    /api/qna                             답이 올라간 Q&A(누구나)
//  POST   /api/qna {kind, ref, text}           질문하기(kind=question) · 가이드 글 제보(kind=fix, ref=글 번호). 누구나, 기기 주소당 하루 5건. 관리자 화면에 쌓인다
//  POST   /api/admin/qna {id, action, question, answer}  관리자: answer(답을 올려 공개) · delete(지움)
//  POST   /api/verify/identity {id}            본인인증(포트원 조회 결과로 만 19세 이상 남성 확인, 1인 1계정). PORTONE_API_SECRET이 없으면 identity_off
//  GET    /api/login/kakao/start               카카오 동의 화면 주소(화면이 redirect_uri와 state를 붙여 이동). KAKAO_REST_KEY가 없으면 kakao_off
//  POST   /api/login/kakao {code, redirect_uri}  카카오 로그인: 있던 회원이면 이 기기를 그 계정에 붙이고, 처음이면 need_nick(이어서 /join으로 닉네임). 인증 전 계정이면 카카오를 연결해 인증
//  POST   /api/me/leave-kakao {code, redirect_uri}  카카오 회원 탈퇴: 같은 카카오 계정인지 확인하고 연결을 끊은 뒤 지운다(카카오 정책)
//  GET    /api/health                          살아 있나
// 저장하는 개인정보: 닉네임 · 기기 토큰 해시 · 복구 코드 해시 · 쓴 글·댓글 · 대기 중인 신청 답변(결정 뒤 지움) · 누가 초대했는지 · 마지막 접속 시각.
//   횟수 제한용 기기 주소(IP)는 해시 16자로 짧게(가입·코드·복구 시도에만, 이틀 안에 지움). 지운 글·댓글은 내용을 비우고 시각만 남긴다. 탈퇴하면 계정 줄을 지운다.

const CATS = ['question', 'tip', 'daily', 'leave', 'play', 'school', 'gear'];           // public/app.js CATS와 같게('school' = 학교·학습, 검수 23)
const AGES = ['expect', 'baby', 'kid', 'low', 'high', 'teen'];   // 아이 나이 칸(public/app.js AGES와 같게). 글에 붙이면 또래 아빠들 글로 거른다(11-04 UI 3안 '아이 나이 길')
const STAGES = ['raising', 'expecting'];
const LIM = { title: [2, 60], body: [1, 3000], comment: [1, 1000], answer: [20, 500], ask: [5, 300], qa: [2, 1000], list: 20, listMax: 50 };
const RATE = {                                        // [횟수, 기간 ms]
  join: [20, 600000], post: [10, 3600000], comment: [60, 3600000], nick: [1, 7 * 86400000],   // 닉네임은 7일에 1번(사칭 방어, 검수 16)
  code: [10, 600000], apply: [3, 86400000], invite: [10, 86400000], recover: [10, 600000], report: [10, 86400000], ask: [5, 86400000], identity: [10, 600000], kakao: [30, 600000]
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

// 닉네임 = 별명/거주지/자녀 출생연도 끝 2자리(11-05 휴먼쌤). 예: 든든이/청주/24. 이미 가입한 사람의 옛 닉네임은 바꿀 때까지 그대로 둔다. public/app.js NICK_RE와 같게
const NICK_RE = /^[가-힣A-Za-z0-9]{2,8}\/[가-힣]{2,6}\/\d{2}$/;
function checkNick(nick) {
  if (!NICK_RE.test(nick)) return 'nick_form';
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
    if (seg[0] === 'posts' && seg[1] === 'hot' && !seg[2] && m === 'GET') return hotPosts(request, env);
    if (seg[0] === 'qna' && !seg[1]) {
      if (m === 'GET') return qnaList(env);
      if (m === 'POST') return ask(request, env);
    }
    if (seg[0] === 'posts' && isId(seg[1]) && !seg[2]) {
      if (m === 'GET') return getPost(request, env, +seg[1]);
      if (m === 'DELETE') return deletePost(request, env, +seg[1]);
    }
    if (seg[0] === 'posts' && isId(seg[1]) && seg[2] === 'comments' && !seg[3] && m === 'POST') return addComment(request, env, +seg[1]);
    if (seg[0] === 'comments' && isId(seg[1]) && !seg[2] && m === 'DELETE') return deleteComment(request, env, +seg[1]);
    if (seg[0] === 'reports' && !seg[1] && m === 'POST') return report(request, env);
    if (seg[0] === 'me' && seg[1] === 'seen' && !seg[2] && m === 'POST') return seenComments(request, env);
    if (seg[0] === 'login' && seg[1] === 'kakao' && seg[2] === 'start' && !seg[3] && m === 'GET') return kakaoStart(env);
    if (seg[0] === 'login' && seg[1] === 'kakao' && !seg[2] && m === 'POST') return kakaoLogin(request, env);
    if (seg[0] === 'me' && seg[1] === 'leave-kakao' && !seg[2] && m === 'POST') return kakaoLeave(request, env);
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
    if (seg[0] === 'verify' && seg[1] === 'identity' && m === 'POST') return verifyIdentity(request, env);
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

const USER_COLS = 'id, nick, created, role, verified, verified_how, blocked, recovery_hash, comments_seen, kakao_hash';
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
const pubUser = u => ({ id: u.id, nick: u.nick, created: u.created, verified: u.verified === 1 && !u.blocked, role: u.role, how: u.verified_how || '', blocked: !!u.blocked, kakao: !!u.kakao_hash });

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

// 지금 뜨는 글(11-05 휴먼쌤 "핫한 글이 있으면 상위로"): 최근 7일 안에 글쓴이가 아닌 사람 2명 이상이 댓글을 단 글. 혼자 댓글을 달아 올릴 수 없게 사람 수로 센다
const HOT_MIN = 2, HOT_DAYS = 7, HOT_MAX = 3;
async function hotPosts(request, env) {
  const a = await reader(request, env.DB);
  if (a.err) return a.err;
  const since = new Date(Date.now() - HOT_DAYS * 86400000).toISOString();
  const rs = await env.DB.prepare('SELECT * FROM (SELECT p.id, p.cat, p.age, p.title, substr(p.body, 1, 140) AS preview, p.created, p.comment_count, u.nick, u.id AS uid, ' + BADGE + ', '
    + '(SELECT COUNT(DISTINCT c.user_id) FROM comments c WHERE c.post_id = p.id AND c.deleted IS NULL AND c.user_id != p.user_id AND c.created > ?1) AS heat '
    + "FROM posts p JOIN users u ON u.id = p.user_id WHERE p.deleted IS NULL AND u.role != 'official' AND p.comment_count >= ?2) WHERE heat >= ?2 ORDER BY heat DESC, comment_count DESC, id DESC LIMIT ?3")
    .bind(since, HOT_MIN, HOT_MAX).all();
  return json({ ok: true, posts: (rs.results || []).map(rowPost) });
}

// ----- Q&A · 제보(11-05 휴먼쌤 "하단에 '질문하기' 기능을 추가해서 관리자가 해당 질문을 보고 추가할 수 있도록") -----
// 답을 올리기 전에는 공개되지 않는다. 쓴 사람은 저장하지 않고, 도배를 막는 횟수 기록(기기 주소 해시)만 이틀 안에 지운다.
async function qnaList(env) {
  const rs = await env.DB.prepare("SELECT id, question, answer, answered_at FROM qna WHERE status = 'published' ORDER BY answered_at DESC LIMIT 100").all();
  return json({ ok: true, items: rs.results || [] });
}
async function ask(request, env) {
  const b = await readJson(request);
  if (!b) return no('bad_json');
  const kind = b.kind === 'fix' ? 'fix' : 'question', ref = str(b.ref, 40), text = str(b.text, 600);
  if (ref && !/^[A-Za-z0-9-]+$/.test(ref)) return no('bad_json');
  if (len(text) < LIM.ask[0] || len(text) > LIM.ask[1]) return no('ask_len');
  if (!(await allow(env.DB, await ipKey(request), 'ask'))) return no('limit', 429);
  await env.DB.prepare('INSERT INTO qna (kind, ref, question, created) VALUES (?1, ?2, ?3, ?4)').bind(kind, ref, text, nowIso()).run();
  return json({ ok: true });
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

// 본인인증(11-05 휴먼쌤 "본인인증+닉네임"): 화면이 포트원으로 인증을 마치면 번호를 보내고, 서버가 포트원에 직접 물어 결과를 믿는다.
// 만 19세 이상 남성만 통과. 저장하는 것은 중복 가입을 막는 값(DI, 없으면 CI)의 해시뿐이고 이름·전화번호·생년월일·성별은 판단 뒤 버린다.
// 막힌 계정의 해시는 남아 다른 계정으로 다시 인증하지 못한다. 탈퇴하면 계정 줄과 함께 지워진다.
async function verifyIdentity(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  if (a.user.blocked) return no('blocked', 403);
  if (!env.PORTONE_API_SECRET) return no('identity_off', 503);
  if (a.user.verified === 1) return json({ ok: true, user: pubUser(a.user), already: true });
  const b = await readJson(request);
  const id = str(b && b.id, 80);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return no('identity_bad');
  if (!(await allow(env.DB, await ipKey(request), 'identity'))) return no('limit', 429);
  let d;
  try {
    const res = await fetch((env.PORTONE_API_BASE || 'https://api.portone.io') + '/identity-verifications/' + encodeURIComponent(id), { headers: { Authorization: 'PortOne ' + env.PORTONE_API_SECRET } });
    if (!res.ok) return no('identity_bad');
    d = await res.json();
  } catch (e) { return no('identity_bad', 502); }
  const c = d && d.status === 'VERIFIED' ? d.verifiedCustomer : null;
  const key = c && (c.di || c.ci);
  const m = c && String(c.birthDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!key || !m) return no('identity_bad');
  const adult = new Date(+m[1] + 19, +m[2] - 1, +m[3]).getTime() <= Date.now();
  if (!adult || String(c.gender || '').toUpperCase() !== 'MALE') return no('identity_denied', 403);
  const hash = await sha256('id|' + key);
  const other = await env.DB.prepare('SELECT id FROM users WHERE identity_hash = ?1').bind(hash).first();
  if (other && other.id !== a.user.id) return no('identity_dup', 409);
  const at = nowIso();
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET identity_hash = ?1, verified = 1, verified_how = 'identity', verified_at = ?2 WHERE id = ?3").bind(hash, at, a.user.id),
    env.DB.prepare("UPDATE applications SET status = 'approved', answer = '', decided_at = ?1 WHERE user_id = ?2 AND status = 'pending'").bind(at, a.user.id)
  ]);
  const u = await env.DB.prepare('SELECT ' + USER_COLS + ' FROM users WHERE id = ?1').bind(a.user.id).first();
  return json({ ok: true, user: pubUser(u) });
}

// 카카오 로그인(11-05 휴먼쌤 "카카오로 바꿔줘"). 사업자 없이 쓸 수 있다. 저장은 회원번호의 해시뿐이고 프로필·이메일·전화번호와 카카오 토큰은 저장하지 않는다.
// 키는 wrangler.toml [vars] KAKAO_REST_KEY, 비밀 코드는 wrangler pages secret KAKAO_CLIENT_SECRET(카카오 기본값이 켜짐이라 토큰 요청에 넣는다).
const kakaoAuthBase = env => env.KAKAO_AUTH_BASE || 'https://kauth.kakao.com';
const kakaoApiBase = env => env.KAKAO_API_BASE || 'https://kapi.kakao.com';
const KAKAO_PENDING_MS = 30 * 60000;      // 카카오를 마치고 닉네임을 정할 때까지 기다리는 시간

function kakaoStart(env) {
  if (!env.KAKAO_REST_KEY) return no('kakao_off', 503);
  return json({ ok: true, url: kakaoAuthBase(env) + '/oauth/authorize?response_type=code&client_id=' + encodeURIComponent(env.KAKAO_REST_KEY) });
}
// 인가 코드 → 토큰 → 회원번호. 다른 앱의 코드는 client_id가 달라 카카오가 거절한다. redirect_uri는 이 서버 주소만 받는다
async function kakaoIdentify(request, env, b) {
  const code = str(b && b.code, 600), redirect = str(b && b.redirect_uri, 300);
  let same = false;
  try { same = new URL(redirect).origin === new URL(request.url).origin; } catch (e) { same = false; }
  if (!code || !same) return { err: no('kakao_bad') };
  try {
    const form = new URLSearchParams({ grant_type: 'authorization_code', client_id: env.KAKAO_REST_KEY, redirect_uri: redirect, code });
    if (env.KAKAO_CLIENT_SECRET) form.set('client_secret', env.KAKAO_CLIENT_SECRET);
    const t = await fetch(kakaoAuthBase(env) + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: form.toString() });
    if (!t.ok) { console.error('kakao token', t.status); return { err: no('kakao_bad') }; }
    const token = (await t.json()).access_token;
    if (!token) return { err: no('kakao_bad') };
    const u = await fetch(kakaoApiBase(env) + '/v2/user/me', { headers: { Authorization: 'Bearer ' + token } });
    if (!u.ok) { console.error('kakao me', u.status); return { err: no('kakao_bad') }; }
    const id = (await u.json()).id;
    if (!id) return { err: no('kakao_bad') };
    return { token, hash: await sha256('kakao|' + id) };
  } catch (e) { console.error('kakao', e && e.message); return { err: no('kakao_bad', 502) }; }
}
async function kakaoLogin(request, env) {
  if (!env.KAKAO_REST_KEY) return no('kakao_off', 503);
  const db = env.DB, token = bearer(request);
  if (!tokenOk(token)) return no('login', 401);
  if (!(await allow(db, await ipKey(request), 'kakao'))) return no('limit', 429);
  const k = await kakaoIdentify(request, env, await readJson(request));
  if (k.err) return k.err;
  const hash = await sha256('tok|' + token), at = nowIso();
  const owner = await db.prepare('SELECT ' + USER_COLS + ' FROM users WHERE kakao_hash = ?1').bind(k.hash).first();
  const here = await db.prepare('SELECT ' + USER_COLS + ' FROM users WHERE token_hash = ?1').bind(hash).first();
  if (owner) {
    if (here && here.id !== owner.id) return no('kakao_taken', 409);
    await db.prepare('UPDATE users SET token_hash = ?1, last_seen = ?2 WHERE id = ?3').bind(hash, at, owner.id).run();   // 새 기기면 이 기기로 옮긴다(이전 기기는 끊김)
    return json({ ok: true, user: pubUser(owner) });
  }
  if (here) {                    // 카카오 없이 가입한 계정: 카카오를 이어 붙이고 인증한다
    if (here.kakao_hash) return no('kakao_taken', 409);
    if (here.blocked) return no('blocked', 403);
    await db.batch([
      db.prepare("UPDATE users SET kakao_hash = ?1, verified = 1, verified_how = CASE WHEN verified = 1 THEN verified_how ELSE 'kakao' END, verified_at = COALESCE(verified_at, ?2) WHERE id = ?3").bind(k.hash, at, here.id),
      db.prepare("UPDATE applications SET status = 'approved', answer = '', decided_at = ?1 WHERE user_id = ?2 AND status = 'pending'").bind(at, here.id)
    ]);
    const u = await db.prepare('SELECT ' + USER_COLS + ' FROM users WHERE id = ?1').bind(here.id).first();
    return json({ ok: true, user: pubUser(u), linked: true });
  }
  // 처음 온 사람: 닉네임을 받을 때까지 이 기기와 묶어 둔다
  await db.batch([
    db.prepare('DELETE FROM kakao_pending WHERE created < ?1').bind(new Date(Date.now() - KAKAO_PENDING_MS).toISOString()),
    db.prepare('INSERT OR REPLACE INTO kakao_pending (token_hash, kakao_hash, created) VALUES (?1, ?2, ?3)').bind(hash, k.hash, at)
  ]);
  return json({ ok: true, need_nick: true });
}
// 탈퇴: 카카오 정책상 연결도 끊어야 한다. 회원번호를 저장하지 않으므로 다시 로그인해서 받은 토큰으로 끊는다. 막힌 계정은 내용만 지우고 재가입을 막도록 줄을 남긴다
async function kakaoLeave(request, env) {
  if (!env.KAKAO_REST_KEY) return no('kakao_off', 503);
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  if (a.user.role !== 'user' || !a.user.kakao_hash) return no('forbidden', 403);
  if (!(await allow(env.DB, await ipKey(request), 'kakao'))) return no('limit', 429);
  const k = await kakaoIdentify(request, env, await readJson(request));
  if (k.err) return k.err;
  if (k.hash !== a.user.kakao_hash) return no('kakao_mismatch', 403);
  try {
    const r = await fetch(kakaoApiBase(env) + '/v1/user/unlink', { method: 'POST', headers: { Authorization: 'Bearer ' + k.token } });
    if (!r.ok) { console.error('kakao unlink', r.status); return no('kakao_bad', 502); }
  } catch (e) { return no('kakao_bad', 502); }
  await eraseUser(env.DB, a.user.id, !!a.user.blocked);
  return json({ ok: true });
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
  // 카카오를 마치고 온 기기면 바로 인증(11-05 휴먼쌤). 복구 코드는 필요 없다(카카오로 다시 들어오면 된다)
  const pend = await db.prepare('SELECT kakao_hash FROM kakao_pending WHERE token_hash = ?1 AND created >= ?2').bind(hash, new Date(Date.now() - KAKAO_PENDING_MS).toISOString()).first();
  if (pend && await db.prepare('SELECT 1 AS x FROM users WHERE kakao_hash = ?1').bind(pend.kakao_hash).first()) {   // 같은 카카오로 다른 기기에서 먼저 가입을 마쳤다
    await db.prepare('DELETE FROM kakao_pending WHERE token_hash = ?1').bind(hash).run();
    return no('kakao_used', 409);
  }
  let uid;
  try {
    const r = await (pend
      ? db.prepare("INSERT INTO users (nick, nick_key, token_hash, created, last_seen, kakao_hash, verified, verified_how, verified_at) VALUES (?1, ?2, ?3, ?4, ?4, ?5, 1, 'kakao', ?4)").bind(nick, nickKey(nick), hash, created, pend.kakao_hash)
      : db.prepare('INSERT INTO users (nick, nick_key, token_hash, created, last_seen) VALUES (?1, ?2, ?3, ?4, ?4)').bind(nick, nickKey(nick), hash, created)).run();
    uid = r.meta && r.meta.last_row_id;
    if (pend) await db.prepare('DELETE FROM kakao_pending WHERE token_hash = ?1').bind(hash).run();
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
  const recovery = pend ? undefined : await setRecovery(db, uid);
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
function eraseUser(db, uid, keepRow) {
  const at = nowIso();
  return db.batch([
    db.prepare("UPDATE comments SET body = '', deleted = COALESCE(deleted, ?1) WHERE user_id = ?2").bind(at, uid),
    db.prepare('UPDATE posts SET comment_count = (SELECT COUNT(*) FROM comments c WHERE c.post_id = posts.id AND c.deleted IS NULL) '
      + 'WHERE id IN (SELECT post_id FROM comments WHERE user_id = ?1)').bind(uid),
    db.prepare("UPDATE comments SET body = '', deleted = COALESCE(deleted, ?1) WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?2)").bind(at, uid),
    db.prepare("UPDATE posts SET title = '', body = '', deleted = COALESCE(deleted, ?1) WHERE user_id = ?2").bind(at, uid),
    db.prepare('UPDATE invites SET revoked = 1 WHERE owner_id = ?1 AND used_by IS NULL').bind(uid),
    db.prepare('DELETE FROM applications WHERE user_id = ?1').bind(uid),
    db.prepare('DELETE FROM acts WHERE who = ?1').bind('u:' + uid),
    keepRow ? db.prepare('UPDATE users SET token_hash = ?1 WHERE id = ?2').bind(offToken(uid), uid) : db.prepare('DELETE FROM users WHERE id = ?1').bind(uid)
  ]);
}
async function deleteMe(request, env) {
  const a = await auth(request, env.DB);
  if (a.err) return a.err;
  if (a.user.role !== 'user') return no('forbidden', 403);          // 관리자는 먼저 넘겨 주고, 자료실 계정은 로그인이 없다
  if (a.user.kakao_hash && env.KAKAO_REST_KEY) return no('kakao_leave');   // 카카오로 들어온 사람은 카카오 연결도 끊어야 한다(/api/me/leave-kakao)
  const b = await readJson(request);
  if (!b || b.confirm !== true) return no('bad_json');
  await eraseUser(env.DB, a.user.id);
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
    const [q, us, inv, rp, qa, qp] = await db.batch([
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
        + "FROM reports r WHERE r.handled IS NULL GROUP BY r.kind, r.target_id ORDER BY first_at"),
      db.prepare("SELECT id, kind, ref, question, created FROM qna WHERE status = 'pending' ORDER BY id"),
      db.prepare("SELECT id, question, answer, answered_at FROM qna WHERE status = 'published' ORDER BY answered_at DESC LIMIT 50")
    ]);
    return json({ ok: true, queue: q.results || [], users: us.results || [], reports: rp.results || [], qna: qa.results || [], qna_published: qp.results || [],
      invites: (inv.results || []).map(x => ({ code: showCode(x.code), note: x.note, used: x.used_by != null })) });
  }
  if (what === 'qna' && method === 'POST') {
    const b = await readJson(request);
    const id = +(b && b.id) || 0, action = String(b && b.action || '');
    const row = await db.prepare('SELECT id FROM qna WHERE id = ?1').bind(id).first();
    if (!row) return no('not_found', 404);
    if (action === 'delete') {
      await db.prepare('DELETE FROM qna WHERE id = ?1').bind(id).run();
      return json({ ok: true });
    }
    if (action !== 'answer') return no('bad_json');
    const question = str(b.question, 600), answer = str(b.answer, 2000);       // 질문은 관리자가 다듬어(개인정보 지우기) 올릴 수 있다
    if (len(question) < LIM.ask[0] || len(question) > LIM.ask[1]) return no('ask_len');
    if (len(answer) < LIM.qa[0] || len(answer) > LIM.qa[1]) return no('answer_len');
    await db.prepare("UPDATE qna SET question = ?1, answer = ?2, status = 'published', answered_at = ?3, answered_by = ?4 WHERE id = ?5").bind(question, answer, nowIso(), a.user.id, id).run();
    return json({ ok: true });
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

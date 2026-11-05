// 육아맨 서버 시험: 내 컴퓨터 미리 보기(deploy.py dev --fresh)에 대고 돌린다. 공개 주소에는 돌리지 않는다.
//   node test/api-test.mjs [http://127.0.0.1:8799]
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMock } from './mock-kakao.mjs';
const BASE = (process.argv[2] || 'http://127.0.0.1:8799') + '/api';
if (!/127\.0\.0\.1|localhost/.test(BASE)) throw new Error('내 컴퓨터 주소에서만 돌립니다');
// 시험 DB(내 컴퓨터의 가짜 D1)에 바로 쓰기. 복무일처럼 API로 만들 수 없는 것만
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
function localSql(sql) {
  let d = ROOT, js = process.env.WRANGLER_JS;
  while (!js && dirname(d) !== d) { d = dirname(d); const p = join(d, 'tools', 'cf-wrangler', 'node_modules', 'wrangler', 'bin', 'wrangler.js'); if (existsSync(p)) js = p; }
  execFileSync(process.execPath, [js, 'd1', 'execute', 'yukaman', '--local', '--command', sql], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
}
let n = 0;
const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, '0')).join('');
const stamp = String(Date.now() % 100000);
async function call(method, path, token, body) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
}
const ok = (cond, what) => { n++; assert.ok(cond, what); };
const A = rnd(), B = rnd(), C = rnd(), ADMIN = rnd();
const N = s => s + '/청주/24';     // 닉네임 = 별명/거주지/자녀 출생연도 끝 2자리(11-05)

// 커뮤니티는 읽기도 쓰기도 인증 아빠만. 로그인이 없으면 목록·글·검색 모두 내용 없이 401
let r = await call('GET', '/posts?limit=2');
ok(r.status === 401 && r.data.error === 'login' && !r.data.posts, '토큰 없으면 목록 401');
r = await call('GET', '/posts/1');
ok(r.status === 401 && r.data.error === 'login' && !r.data.post, '토큰 없으면 글 401');
r = await call('GET', '/posts/999999');
ok(r.status === 401, '없는 글도 자격부터 본다');
r = await call('GET', '/posts?q=' + encodeURIComponent('육아휴직'));
ok(r.status === 401 && !r.data.posts, '토큰 없으면 검색 401');
r = await call('GET', '/posts?limit=2', rnd());
ok(r.status === 401 && r.data.error === 'unknown_user' && !r.data.posts, '모르는 기기 401');
r = await call('POST', '/posts', null, { cat: 'tip', title: '제목입니다', body: '내용' });
ok(r.status === 401 && r.data.error === 'login', '토큰 없으면 401');

// 닉네임
r = await call('POST', '/join', A, { terms: true, nick: N('육아맨운영자') });
ok(r.data.error === 'nick_reserved', '운영 사칭 이름 막기');
r = await call('POST', '/join', A, { terms: true, nick: 'a' });
ok(r.data.error === 'nick_form', '세 칸이 아닌 닉네임');
for (const bad of ['시험/청주', '시험/청주/2024', '시험/청주/ab', 'a/청주/24', '띄어 쓰기/청주/24', '시험/qq/24']) {
  r = await call('POST', '/join', A, { terms: true, nick: bad });
  ok(r.data.error === 'nick_form', '닉네임 꼴 막기 ' + bad);
}
r = await call('POST', '/join', A, { terms: true, nick: N('시험A' + stamp) });
ok(r.data.ok && r.data.user.verified === false, '가입: 인증 전');
const recA = r.data.recovery;
ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(recA || ''), '가입 때 복구 코드 12자');
r = await call('POST', '/join', A, { terms: true, nick: '다른이름' + stamp });
ok(r.data.existing === true && !r.data.recovery, '같은 기기는 기존 사용자(복구 코드 다시 안 줌)');
r = await call('POST', '/join', B, { terms: true, nick: N('시험A' + stamp) });
ok(r.data.error === 'nick_taken', '같은 닉네임 막기');

// 인증 전에는 못 읽고 못 쓴다
r = await call('GET', '/posts?limit=2', A);
ok(r.status === 403 && r.data.error === 'verify' && !r.data.posts, '인증 전 목록 금지');
r = await call('GET', '/posts/1', A);
ok(r.status === 403 && r.data.error === 'verify' && !r.data.post && !r.data.comments, '인증 전 글 금지');
r = await call('GET', '/posts?q=' + encodeURIComponent('육아휴직'), A);
ok(r.status === 403 && !r.data.posts, '인증 전 검색 금지');
r = await call('POST', '/posts', A, { cat: 'tip', title: '제목입니다', body: '내용' });
ok(r.status === 403 && r.data.error === 'verify', '인증 전 글쓰기 금지');
r = await call('POST', '/posts/1/comments', A, { body: '댓글' });
ok(r.status === 403 && r.data.error === 'verify', '인증 전 댓글 금지');
r = await call('POST', '/invites', A, {});
ok(r.status === 403, '인증 전 초대 금지');

// 초대 코드
r = await call('POST', '/verify/code', A, { code: 'ZZZZ-ZZZZ' });
ok(r.data.error === 'code_bad', '틀린 코드');
r = await call('POST', '/verify/code', A, { code: 'test-dads' });
ok(r.data.ok && r.data.user.verified === true && r.data.user.how === 'invite', '코드로 인증(대소문자·하이픈 무시)');
r = await call('GET', '/posts?limit=2', A);
ok(r.status === 200 && r.data.posts.every(p => p.badge !== 'official'), '인증 뒤 읽기, 자료실 글은 목록에 없음');
r = await call('GET', '/posts/1', A);
ok(r.status === 200 && r.data.post.badge === 'official', '자료실 글은 번호로는 열림');
r = await call('POST', '/join', C, { terms: true, nick: N('시험C' + stamp), invite: 'TESTDADS' });
ok(r.data.ok && r.data.user.verified === false && r.data.invite_error === 'code_used', '쓴 코드는 다시 못 씀, 가입은 됨');

// 글·댓글·검색
r = await call('POST', '/posts', A, { cat: 'etc', title: '시험 글 ' + stamp, body: '독특한낱말' + stamp + ' 내용입니다' });
ok(r.data.ok && r.data.post.badge === 'dad', '인증 뒤 글쓰기');
const pid = r.data.id;
r = await call('GET', '/posts?q=' + encodeURIComponent('독특한낱말' + stamp), A);
ok(r.data.posts.length === 1 && r.data.posts[0].id === pid, '본문 검색');
r = await call('GET', '/posts?q=' + encodeURIComponent('독특한낱말' + stamp + ' 없는낱말'), A);
ok(r.data.posts.length === 0, '낱말 모두 있어야 찾음');
r = await call('GET', '/posts?q=' + encodeURIComponent('100%_'), A);
ok(r.status === 200, '특수문자 검색 오류 없음');
r = await call('GET', '/posts?q=' + encodeURIComponent('낱말'), A);
ok(r.data.posts.some(p => p.id === pid), '두 글자 검색(색인 대신 LIKE)');
r = await call('GET', '/posts?cat=etc&limit=50', A);
ok(r.data.posts.every(p => p.cat === 'etc') && r.data.posts.length > 0, '분류');
for (const cat of ['leave', 'play', 'gear', 'question', 'tip', 'vent']) {
  r = await call('POST', '/posts', A, { cat, title: '분류 시험 ' + cat + stamp, body: '분류 시험 내용' });
  ok(r.data.ok && r.data.post.cat === cat, '새 분류 ' + cat);
}
r = await call('POST', '/posts', A, { cat: 'daily', title: '없어진 분류 ' + stamp, body: '없어진 분류' });
ok(!r.data.ok && r.data.error === 'cat', '없어진 분류는 거절');
// 아이 나이 칸(11-04 UI 3안): 글에 붙이면 또래 글로 거른다
r = await call('POST', '/posts', A, { cat: 'question', age: 'baby', title: '나이 글 ' + stamp, body: '아이 나이 칸 시험' });
ok(r.data.ok && r.data.post.age === 'baby', '아이 나이 칸으로 글쓰기');
const apid = r.data.id;
r = await call('GET', '/posts?age=baby&limit=50', A);
ok(r.data.posts.some(p => p.id === apid) && r.data.posts.every(p => p.age === 'baby'), '아이 나이로 거르기');
r = await call('GET', '/posts?age=kid&limit=50', A);
ok(r.data.posts.every(p => p.id !== apid), '다른 나이에는 안 나옴');
r = await call('POST', '/posts', A, { cat: 'question', age: 'adult', title: '나이 틀림 ' + stamp, body: '틀린 값' });
ok(r.data.error === 'age', '모르는 나이 값은 거절');
r = await call('GET', `/posts/${apid}`, A);
ok(r.data.post.age === 'baby' && r.data.post.cat === 'question', '글 하나에도 나이 칸');
r = await call('GET', '/posts?limit=50', A);
ok(r.data.posts.some(p => p.id === pid && p.age === ''), '나이 없는 글은 빈 값');
r = await call('POST', `/posts/${pid}/comments`, A, { body: '<script>alert(1)</script> 댓글' });
ok(r.data.ok, '댓글');
const cid = r.data.comment.id;
r = await call('GET', `/posts/${pid}`);
ok(r.status === 401 && !r.data.comments, '토큰 없으면 댓글도 못 봄');
r = await call('GET', `/posts/${pid}`, A);
ok(r.data.comments.length === 1 && r.data.post.comments === 1, '댓글 수');

// 남의 것은 못 지운다
r = await call('DELETE', `/posts/${pid}`, C);
ok(r.status === 403, '남의 글 삭제 금지');
r = await call('DELETE', `/comments/${cid}`, C);
ok(r.status === 403, '남의 댓글 삭제 금지');

// 초대 코드 만들기: 3개까지, 다른 사람이 쓰면 인증되고 초대한 사람이 남는다
const codes = [];
for (let i = 0; i < 3; i++) { r = await call('POST', '/invites', A, {}); ok(r.data.ok, '초대 만들기'); codes.push(r.data.invite.code); }
ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(codes[0]), '코드 꼴');
r = await call('POST', '/invites', A, {});
ok(r.data.error === 'invite_max', '3개 넘게 못 만듦');
r = await call('POST', '/verify/code', C, { code: codes[0] });
ok(r.data.user.verified === true, '받은 코드로 인증');
r = await call('GET', '/posts?limit=1', C);
ok(r.status === 200 && r.data.posts.length === 1, '받은 코드로 인증한 뒤 읽기');
r = await call('GET', '/me', A);
ok(r.data.invites.length === 3 && r.data.invites[0].used === true && r.data.invites[0].nick === N('시험C' + stamp), '누가 썼는지 보임');

// 사칭 이름 막기
for (const bad of ['운영진', '휴먼쌤', 'yukaman', 'adm1n', '매니저1']) {
  r = await call('POST', '/join', rnd(), { terms: true, nick: N(bad) });
  ok(r.data.error === 'nick_reserved', '사칭 이름 막기 ' + bad);
}

// 새 댓글 배지: A의 글에 C가 댓글 → A에게 1, 보면 0. 내 댓글은 세지 않는다(앞서 A가 단 댓글)
r = await call('GET', '/me', A);
ok(r.data.new_comments === 0, '내가 단 댓글은 새 댓글 아님');
r = await call('POST', `/posts/${pid}/comments`, C, { body: 'C의 댓글' });
const ccid = r.data.comment.id;
r = await call('GET', '/me', A);
ok(r.data.new_comments === 1 && r.data.new_list[0].nick === N('시험C' + stamp) && r.data.new_list[0].post_id === pid, '새 댓글 1');
r = await call('POST', '/me/seen', A, {});
ok(r.data.ok, '봤음');
r = await call('GET', '/me', A);
ok(r.data.new_comments === 0, '본 뒤 0');

// 신고
r = await call('POST', '/reports', A, { kind: 'post', id: pid, reason: '내 글' });
ok(r.data.error === 'own', '내 글은 신고 못 함');
r = await call('POST', '/reports', C, { kind: 'post', id: pid, reason: '광고 같아요' });
ok(r.data.ok && !r.data.already, '글 신고');
r = await call('POST', '/reports', C, { kind: 'post', id: pid, reason: '또' });
ok(r.data.already === true, '같은 대상은 한 번');
r = await call('POST', '/reports', A, { kind: 'comment', id: ccid, reason: '욕설' });
ok(r.data.ok, '댓글 신고');
r = await call('POST', '/reports', rnd(), { kind: 'post', id: pid });
ok(r.status === 401, '모르는 기기는 신고 못 함');
r = await call('POST', '/reports', C, { kind: 'post', id: 999999 });
ok(r.status === 404, '없는 글 신고');
// C의 초대 코드: 막히면 폐기돼야 한다
r = await call('POST', '/invites', C, {});
const cCode = r.data.invite.code;

// 신청서 → 관리자 승인 → 답변 지움
r = await call('POST', '/join', B, { terms: true, nick: N('시험B' + stamp) });
ok(r.data.ok, 'B 가입');
r = await call('POST', '/verify/apply', B, { stage: 'raising', answer: '짧음', pledge: true });
ok(r.data.error === 'answer_len', '답변 짧음');
r = await call('POST', '/verify/apply', B, { stage: 'raising', answer: '요즘 아이가 밤에 자주 깨서 교대로 재우고 있어요. 힘들지만 웃는 얼굴이 좋아요.', pledge: false });
ok(r.data.error === 'pledge', '약속 필요');
r = await call('POST', '/verify/apply', B, { stage: 'raising', answer: '요즘 아이가 밤에 자주 깨서 교대로 재우고 있어요. 힘들지만 웃는 얼굴이 좋아요.', pledge: true });
ok(r.data.pending === true && r.data.user.verified === false, '신청 접수');
r = await call('GET', '/admin/queue', A);
ok(r.status === 403, '일반 회원은 관리자 화면 금지');

// 관리자 코드
r = await call('POST', '/join', ADMIN, { terms: true, nick: N('시험관' + stamp), invite: 'TESTADMN' });
ok(r.data.user.role === 'admin' && r.data.user.verified === true, '관리자 코드');
const recAdmin = r.data.recovery;
r = await call('POST', '/posts', ADMIN, { cat: 'tip', title: '운영 안내 ' + stamp, body: '운영 글' });
ok(r.data.post.badge === 'admin', '관리자 글에 운영 표시');
await call('DELETE', `/posts/${r.data.id}`, ADMIN);
// 신고함: 대상별로 묶임, 그대로 두기 · 숨기기
r = await call('GET', '/admin/queue', ADMIN);
ok(r.data.reports.length === 2 && r.data.reports.find(x => x.kind === 'post').target_id === pid && r.data.reports.find(x => x.kind === 'post').reasons.includes('광고'), '신고함');
r = await call('POST', '/admin/report', A, { kind: 'post', id: pid, action: 'keep' });
ok(r.status === 403, '일반 회원은 신고 처리 금지');
r = await call('POST', '/admin/report', ADMIN, { kind: 'post', id: pid, action: 'keep' });
ok(r.data.ok, '그대로 둠');
r = await call('GET', `/posts/${pid}`, A);
ok(r.status === 200 && r.data.comments.length === 2, '그대로 두면 글이 남음');
r = await call('POST', '/admin/report', ADMIN, { kind: 'comment', id: ccid, action: 'hide' });
ok(r.data.ok, '댓글 숨김');
r = await call('GET', `/posts/${pid}`, A);
ok(r.data.comments.length === 1 && r.data.post.comments === 1, '숨긴 댓글 사라짐, 수도 맞음');
r = await call('GET', '/admin/queue', ADMIN);
ok(r.data.reports.length === 0, '신고함 비움');
r = await call('GET', '/admin/queue', ADMIN);
const app = r.data.queue.find(q => q.nick === N('시험B' + stamp));
ok(app && app.answer.includes('밤에'), '대기 목록');
r = await call('POST', '/admin/decide', ADMIN, { id: app.id, approve: true });
ok(r.data.ok, '승인');
r = await call('GET', '/admin/queue', ADMIN);
ok(!r.data.queue.find(q => q.id === app.id), '대기에서 빠짐');
r = await call('GET', '/me', B);
ok(r.data.user.verified === true && r.data.user.how === 'apply' && r.data.application.status === 'approved', 'B 인증');
r = await call('GET', '/posts?q=' + encodeURIComponent('밤에 자주 깨서'), B);
ok(r.status === 200 && r.data.posts.length === 0, '승인 뒤 읽기 · 신청 답변은 글로 안 나옴');
r = await call('GET', '/posts?limit=1', ADMIN);
ok(r.status === 200, '관리자 읽기');

// 해제·막기
const uid = (await call('GET', '/me', C)).data.user.id;
r = await call('POST', '/admin/user', ADMIN, { user_id: uid, action: 'block' });
ok(r.data.ok, '막기');
r = await call('POST', '/join', rnd(), { terms: true, nick: N('새기기' + stamp), invite: cCode });
ok(r.data.invite_error === 'code_bad' && r.data.user.verified === false, '막힌 회원의 안 쓴 초대 코드는 폐기됨');
r = await call('POST', '/posts', C, { cat: 'tip', title: '제목입니다', body: '내용' });
ok(r.status === 403 && r.data.error === 'blocked', '막힌 회원 글 금지');
r = await call('GET', '/posts?limit=1', C);
ok(r.status === 403 && r.data.error === 'blocked' && !r.data.posts, '막힌 회원 읽기 금지');
const bid = (await call('GET', '/me', B)).data.user.id;
r = await call('POST', '/admin/user', ADMIN, { user_id: bid, action: 'unverify' });
ok(r.data.ok, '인증 해제');
r = await call('GET', '/posts?limit=1', B);
ok(r.status === 403 && r.data.error === 'verify' && !r.data.posts, '인증이 풀리면 읽기도 막힘');
r = await call('GET', '/me', B);
ok(r.status === 200 && r.data.user.verified === false, '내 정보는 볼 수 있음');
r = await call('POST', '/verify/code', C, { code: codes[1] });
ok(r.data.error === 'blocked', '막힌 회원 재인증 금지');
r = await call('POST', '/admin/user', ADMIN, { user_id: 1, action: 'block' });
ok(r.status === 403, '자료실 계정은 못 바꿈');

// 관리자는 글을 지울 수 있고, 지운 글은 안 보인다
r = await call('DELETE', `/posts/${pid}`, ADMIN);
ok(r.data.ok, '관리자 삭제');
r = await call('GET', `/posts/${pid}`, A);
ok(r.status === 404, '지운 글 404');
r = await call('GET', '/posts?q=' + encodeURIComponent('독특한낱말' + stamp), A);
ok(r.data.posts.length === 0, '지운 글은 색인 검색에도 없음');
// 그 회원 글 모두 숨김
r = await call('POST', '/posts', A, { cat: 'tip', title: '숨길 글 ' + stamp, body: '숨길내용' + stamp });
const aid = (await call('GET', '/me', A)).data.user.id;
r = await call('POST', '/admin/user', ADMIN, { user_id: aid, action: 'hide_all' });
ok(r.data.ok, '모두 숨김');
r = await call('GET', '/me', A);
ok(r.data.posts.length === 0, '그 회원 글이 모두 사라짐');

// 복구 코드: 새 기기(D)가 A의 코드로 들어오면 A의 옛 기기는 끊기고 코드는 새것으로 바뀐다
const D = rnd(), E = rnd();
r = await call('POST', '/recover', D, { code: 'ZZZZ-ZZZZ-ZZZZ' });
ok(r.data.error === 'recovery_bad', '틀린 복구 코드');
r = await call('POST', '/recover', D, { code: recA.toLowerCase() });
ok(r.data.ok && r.data.user.nick === N('시험A' + stamp) && r.data.recovery && r.data.recovery !== recA, '복구: 같은 계정, 새 코드');
const recA2 = r.data.recovery;
r = await call('GET', '/me', A);
ok(r.status === 401 && r.data.error === 'unknown_user', '옛 기기는 끊김');
r = await call('GET', '/me', D);
ok(r.status === 200 && r.data.user.nick === N('시험A' + stamp) && r.data.has_recovery === true, '새 기기로 내 정보');
r = await call('POST', '/recover', E, { code: recA });
ok(r.data.error === 'recovery_bad', '쓴 복구 코드는 다시 못 씀');
r = await call('POST', '/recovery/new', D, {});
ok(r.data.ok && r.data.recovery && r.data.recovery !== recA2, '복구 코드 새로 만들기');
const recA3 = r.data.recovery;
r = await call('POST', '/recover', E, { code: recA2 });
ok(r.data.error === 'recovery_bad', '새로 만들면 이전 코드 무효');
r = await call('POST', '/recover', B, { code: recAdmin });
ok(r.status === 409 && r.data.error === 'token_in_use', '다른 계정이 있는 기기로는 복구 못 함');
r = await call('POST', '/recover', E, { code: recA3 });
ok(r.data.ok && r.data.user.nick === N('시험A' + stamp), '새 코드로 복구');
r = await call('GET', '/posts?limit=1', E);
ok(r.status === 200, '복구한 기기는 인증 상태 그대로');
r = await call('GET', '/me', D);
ok(r.status === 401, '복구하면 그 전 기기도 끊김');

// 로그아웃: 계정은 남고 기기만 끊긴다
r = await call('POST', '/logout', E, {});
ok(r.data.ok, '로그아웃');
r = await call('GET', '/me', E);
ok(r.status === 401 && r.data.error === 'unknown_user', '로그아웃 뒤 모르는 기기');

// 탈퇴: 글·댓글 내용이 비고 계정 줄이 지워진다. 관리자는 못 한다
r = await call('POST', '/admin/user', ADMIN, { user_id: bid, action: 'verify' });
ok(r.data.ok, 'B 다시 인증');
r = await call('POST', '/posts', B, { cat: 'etc', title: '탈퇴 전 글 ' + stamp, body: '지워질내용' + stamp });
ok(r.data.ok, 'B 글');
const bpid = r.data.id;
r = await call('DELETE', '/me', B, {});
ok(r.data.error === 'bad_json', '탈퇴는 confirm:true 필요');
r = await call('DELETE', '/me', ADMIN, { confirm: true });
ok(r.status === 403, '관리자는 탈퇴 못 함');
r = await call('DELETE', '/me', B, { confirm: true });
ok(r.data.ok, '탈퇴');
r = await call('GET', '/me', B);
ok(r.status === 401 && r.data.error === 'unknown_user', '탈퇴 뒤 모르는 기기');
r = await call('GET', `/posts/${bpid}`, ADMIN);
ok(r.status === 404, '탈퇴한 사람 글은 404');
r = await call('GET', '/posts?q=' + encodeURIComponent('지워질내용' + stamp), ADMIN);
ok(r.data.posts.length === 0, '탈퇴한 글은 검색에도 없음');
r = await call('GET', '/admin/queue', ADMIN);
ok(!r.data.users.find(x => x.id === bid), '회원 목록에서 사라짐');

// 관리자가 회원 기기 끊기
r = await call('POST', '/admin/user', ADMIN, { user_id: uid, action: 'logout' });
ok(r.data.ok, '관리자 끊기');
r = await call('GET', '/me', C);
ok(r.status === 401 && r.data.error === 'unknown_user', '끊긴 기기');

r = await call('GET', '/nope');
ok(r.status === 404, '없는 주소');

// Q&A · 제보: 누구나 보내고, 관리자가 답해야 공개된다
r = await call('GET', '/qna');
ok(r.status === 200 && r.data.items.length === 0, '처음엔 올라간 Q&A 없음');
r = await call('POST', '/qna', null, { text: '짧음' });
ok(r.data.error === 'ask_len', '질문이 너무 짧음');
r = await call('POST', '/qna', null, { kind: 'fix', ref: 'bad ref!', text: '상한액이 바뀌었어요' });
ok(r.data.error === 'bad_json', '이상한 글 번호');
r = await call('POST', '/qna', null, { text: '육아휴직 중에 이사해도 되나요? ' + stamp });
ok(r.data.ok, '로그인 없이 질문');
r = await call('POST', '/qna', null, { kind: 'fix', ref: 'leave-apply', text: '상한액이 바뀌었어요 ' + stamp });
ok(r.data.ok, '글 제보');
r = await call('GET', '/qna');
ok(r.data.items.length === 0, '답하기 전에는 공개 안 됨');
r = await call('GET', '/admin/queue', E);
ok(r.status === 401, '끊긴 기기는 관리자 화면 금지');
r = await call('GET', '/admin/queue', ADMIN);
const qq = r.data.qna.find(x => x.kind === 'question'), qf = r.data.qna.find(x => x.kind === 'fix');
ok(qq && qf && qf.ref === 'leave-apply', '관리자 화면에 질문과 제보');
const G = rnd();
r = await call('POST', '/join', G, { terms: true, nick: N('일반' + stamp) });
ok(r.data.ok, '일반 회원');
r = await call('POST', '/admin/qna', G, { id: qq.id, action: 'delete' });
ok(r.status === 403, '일반 회원은 답변 금지');
r = await call('POST', '/admin/qna', ADMIN, { id: qq.id, action: 'answer', question: '육아휴직 중 이사', answer: '' });
ok(r.data.error === 'answer_len', '빈 답변');
r = await call('POST', '/admin/qna', ADMIN, { id: qq.id, action: 'answer', question: '육아휴직 중에 이사해도 되나요?', answer: '돼요. 시험 답변이에요.' });
ok(r.data.ok, '답변 올리기');
r = await call('GET', '/qna');
ok(r.data.items.length === 1 && r.data.items[0].answer.includes('시험 답변') && !('uid' in r.data.items[0]), '답하면 누구나 봄');
r = await call('POST', '/admin/qna', ADMIN, { id: qf.id, action: 'delete' });
ok(r.data.ok, '제보 처리 완료');
r = await call('GET', '/admin/queue', ADMIN);
ok(r.data.qna.length === 0 && r.data.qna_published.length === 1, '대기는 비고 올라간 것만 남음');
r = await call('POST', '/admin/qna', ADMIN, { id: qq.id, action: 'delete' });
r = await call('GET', '/qna');
ok(r.data.ok && r.data.items.length === 0, 'Q&A 내리기');

// 지금 뜨는 글: 글쓴이가 아닌 두 사람이 댓글을 달아야 뜬다
r = await call('GET', '/posts/hot');
ok(r.status === 401, '인기 글도 인증 아빠만');
r = await call('GET', '/posts/hot', G);
ok(r.status === 403, '인증 전 인기 글 금지');
r = await call('POST', '/posts', ADMIN, { cat: 'tip', title: '뜨는 글 ' + stamp, body: '뜨는 글 내용' });
const hid = r.data.id;
const H1 = rnd(), H2 = rnd();
for (const [t, nm] of [[H1, '인기하'], [H2, '인기둘']]) {
  r = await call('POST', '/join', t, { terms: true, nick: N(nm + stamp) });
  ok(r.data.ok, '인기 시험 가입');
  r = await call('POST', '/admin/user', ADMIN, { user_id: r.data.user.id, action: 'verify' });
  ok(r.data.ok, '인기 시험 인증');
}
await call('POST', `/posts/${hid}/comments`, ADMIN, { body: '글쓴이 댓글은 안 센다' });
await call('POST', `/posts/${hid}/comments`, H1, { body: '첫 사람' });
await call('POST', `/posts/${hid}/comments`, H1, { body: '같은 사람 또' });
r = await call('GET', '/posts/hot', H1);
ok(r.status === 200 && !r.data.posts.find(p => p.id === hid), '한 사람 댓글로는 안 뜸');
await call('POST', `/posts/${hid}/comments`, H2, { body: '둘째 사람' });
r = await call('GET', '/posts/hot', H1);
ok(r.data.posts.length >= 1 && r.data.posts[0].id === hid && r.data.posts[0].comments === 4, '두 사람이 달면 뜸');
await call('DELETE', `/posts/${hid}`, ADMIN);
r = await call('GET', '/posts/hot', H1);
ok(!r.data.posts.find(p => p.id === hid), '지운 글은 안 뜸');

// 계급: 글 3점(하루 2개까지) · 남의 글 댓글 2점(글마다 1번, 하루 5개까지) · 내 글에 남이 단 댓글 1점(글마다 사람당 1번) · 후임 10점(10명까지). 지운 것은 빠진다. 진급은 점수와 복무일을 둘 다
const R1 = rnd(), R2 = rnd(), R3 = rnd();
const rids = {};
for (const [t, nm] of [[R1, '계급하'], [R2, '계급둘'], [R3, '계급셋']]) {
  r = await call('POST', '/join', t, { terms: true, nick: N(nm + stamp) });
  rids[t] = r.data.user.id;
  await call('POST', '/admin/user', ADMIN, { user_id: r.data.user.id, action: 'verify' });
}
const pts = async t => { const x = await call('GET', '/me', t); return [x.data.points, x.data.rank]; };
assert.deepStrictEqual(await pts(R1), [0, 0]); n++;      // 입대: 이병 0점
r = await call('POST', '/posts', R1, { cat: 'tip', title: '계급 글 하나', body: '내용입니다' });
const rp1 = r.data.id;
ok(r.data.post.rank === 0, '글 하나로는 아직 이병');
assert.deepStrictEqual(await pts(R1), [3, 0]); n++;
const rp2 = (await call('POST', '/posts', R1, { cat: 'tip', title: '계급 글 둘', body: '내용입니다' })).data.id;
await call('POST', '/posts', R1, { cat: 'tip', title: '계급 글 셋', body: '내용입니다' });
assert.deepStrictEqual(await pts(R1), [6, 0], '글은 하루 2개까지'); n++;
await call('POST', `/posts/${rp1}/comments`, R1, { body: '내 글에 내 댓글' });
assert.deepStrictEqual(await pts(R1), [6, 0], '내 글에 내 댓글은 0점'); n++;
r = await call('POST', `/posts/${rp1}/comments`, R2, { body: '첫 댓글' });
const rc1 = r.data.comment.id;
ok(r.data.comment.rank === 0, '댓글 응답에 계급');
await call('POST', `/posts/${rp1}/comments`, R2, { body: '같은 글 또' });
assert.deepStrictEqual(await pts(R2), [2, 0], '같은 글 댓글은 2점 한 번'); n++;
assert.deepStrictEqual(await pts(R1), [7, 0], '내 글에 남의 댓글 1점, 같은 사람은 한 번'); n++;
await call('POST', `/posts/${rp2}/comments`, R2, { body: '다른 글' });
await call('POST', `/posts/${rp1}/comments`, R3, { body: '다른 사람' });
await call('POST', `/posts/${rp2}/comments`, R3, { body: '다른 사람' });
assert.deepStrictEqual(await pts(R1), [10, 0], '10점이어도 복무 전이면 이병'); n++;
assert.deepStrictEqual(await pts(R2), [4, 0]); n++;
// 복무일은 시험 DB의 가입 시각을 앞당겨 만든다(서버에 시험용 뒷문을 두지 않으려고)
const backdate = (uid, days) => localSql(`UPDATE users SET created = '${new Date(Date.now() - days * 86400000 - 60000).toISOString()}' WHERE id = ${uid}`);
backdate(rids[R1], 7);
r = await call('GET', '/me', R1);
ok(r.data.days === 7 && r.data.rank === 0, '복무 7일이어도 점수 10점이면 이병');
// 점수 20점 채우기: R1의 다른 글에 네 사람이 댓글(뒤의 '지금 뜨는 글' 시험에 걸리지 않게 끝나면 지운다)
const R4 = rnd(), R5 = rnd();
for (const [t, nm] of [[R4, '계급넷'], [R5, '계급닷']]) {
  r = await call('POST', '/join', t, { terms: true, nick: N(nm + stamp) });
  rids[t] = r.data.user.id;
  await call('POST', '/admin/user', ADMIN, { user_id: r.data.user.id, action: 'verify' });
}
const rpFill = [];
for (const w of ['넷', '다섯', '여섯']) rpFill.push((await call('POST', '/posts', R1, { cat: 'tip', title: '계급 글 ' + w, body: '내용입니다' })).data.id);   // 글은 오늘 2개까지라 글 점수는 그대로
for (const t of [R2, R3, R4, R5]) await call('POST', `/posts/${rpFill[0]}/comments`, t, { body: '댓글입니다' });     // 4점
for (const t of [R4, R5]) { await call('POST', `/posts/${rpFill[1]}/comments`, t, { body: '댓글입니다' }); await call('POST', `/posts/${rpFill[2]}/comments`, t, { body: '댓글입니다' }); }   // 4점
assert.deepStrictEqual(await pts(R1), [18, 0]); n++;
await call('POST', `/posts/${rpFill[0]}/comments`, R3, { body: '또 댓글' });
assert.deepStrictEqual(await pts(R1), [18, 0], '같은 사람 같은 글은 한 번'); n++;
const rp5 = (await call('POST', '/posts', R2, { cat: 'tip', title: '계급 남의 글', body: '내용입니다' })).data.id;
await call('POST', `/posts/${rp5}/comments`, R1, { body: '남의 글 댓글' });
assert.deepStrictEqual(await pts(R1), [20, 1], '20점 + 복무 7일이면 일병'); n++;
r = await call('GET', '/posts?limit=20', R1);
const rrow = r.data.posts.find(p => p.id === rp1);
ok(rrow && rrow.rank === 1 && rrow.points === undefined, '목록에 계급만, 점수는 안 보임');
r = await call('GET', `/posts/${rp1}`, R3);
ok(r.data.post.rank === 1 && r.data.comments.every(c => c.points === undefined && c.rank === (c.uid === rids[R1] ? 1 : 0)), '글·댓글에 계급만');
backdate(rids[R1], 6);
assert.deepStrictEqual(await pts(R1), [20, 0], '점수 20점이어도 복무 6일이면 이병'); n++;
backdate(rids[R1], 7);
const r2before = (await pts(R2))[0];
await call('DELETE', `/comments/${rc1}`, R2);
assert.deepStrictEqual((await pts(R2))[0], r2before, '같은 글에 댓글이 남아 있으면 그대로'); n++;
await call('DELETE', `/posts/${rp2}`, R1);
ok((await pts(R1))[1] === 0, '지운 글과 거기 달린 댓글 점수 빠지고, 내려가면 계급도');
assert.deepStrictEqual((await pts(R2))[0], r2before - 2, '지운 글에 단 댓글 점수도 빠짐'); n++;
for (const id of rpFill) await call('DELETE', `/posts/${id}`, R1);
// 남의 글 댓글은 하루 5개 글까지 점수
const R6 = rnd();
r = await call('POST', '/join', R6, { terms: true, nick: N('계급여' + stamp) });
await call('POST', '/admin/user', ADMIN, { user_id: r.data.user.id, action: 'verify' });
const six = [];
for (let i = 0; i < 6; i++) six.push((await call('POST', '/posts', R5, { cat: 'tip', title: '댓글 상한 글 ' + i, body: '내용입니다' })).data.id);
for (const id of six) await call('POST', `/posts/${id}/comments`, R6, { body: '댓글입니다' });
assert.deepStrictEqual((await pts(R6))[0], 10, '남의 글 댓글은 하루 5개까지'); n++;
r = await call('GET', '/me', ADMIN);
ok(r.data.rank === null && r.data.ref === null, '운영 계정은 계급과 초대 링크 없음');
r = await call('POST', '/posts', ADMIN, { cat: 'tip', title: '운영 글 계급', body: '내용입니다' });
ok(r.data.post.rank === null, '운영 글에 계급 없음');
await call('DELETE', `/posts/${r.data.id}`, ADMIN);

// 아빠 초대 링크: 한 사람당 하나, 여러 번 쓴다. 가입한 사람이 글이나 댓글을 써야 10점, 10명까지. 인증은 하지 않는다
const refOf = async t => (await call('GET', '/me', t)).data.ref;
localSql("DELETE FROM acts WHERE kind IN ('join', 'code')");     // 시험 기기 하나에서 가입이 많아 횟수 제한(10분에 20번)을 비운다
const IV = rnd();
r = await call('POST', '/join', IV, { terms: true, nick: N('초대자' + stamp) });
const ivId = r.data.user.id;
r = await call('GET', '/me', IV);
ok(r.data.ref === null, '인증 전에는 초대 링크 없음');
await call('POST', '/admin/user', ADMIN, { user_id: ivId, action: 'verify' });
const ref1 = await refOf(IV);
ok(ref1 && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(ref1.code) && ref1.joined === 0 && ref1.counted === 0, '초대 링크 코드');
ok((await refOf(IV)).code === ref1.code, '다시 열어도 같은 코드');
r = await call('GET', '/me', IV);
ok(r.data.invites.length === 0, '초대 링크는 초대 코드 목록에 안 섞임');
const iv1Tok = rnd(), iv2Tok = rnd();
r = await call('POST', '/join', iv1Tok, { terms: true, nick: N('후임일' + stamp), invite: ref1.code });
const iv1 = r.data.user.id;
ok(r.data.ok && r.data.invite_error === '' && r.data.user.verified === false, '초대 링크만으로는 인증되지 않음');
r = await call('POST', '/join', iv2Tok, { terms: true, nick: N('후임둘' + stamp), invite: ref1.code });
const iv2 = r.data.user.id;
ok(r.data.invite_error === '', '초대 링크는 여러 사람이 씀');
r = await refOf(IV);
ok(r.joined === 2 && r.counted === 0, '들어왔어도 활동 전에는 점수 인정 0명');
assert.deepStrictEqual(await pts(IV), [0, 0], '가입만으로는 0점'); n++;
await call('POST', '/admin/user', ADMIN, { user_id: iv1, action: 'verify' });
assert.deepStrictEqual(await pts(IV), [0, 0], '인증만으로도 0점'); n++;
r = await call('POST', '/posts', iv1Tok, { cat: 'tip', title: '후임의 첫 글', body: '내용입니다' });
const ivPost = r.data.id;
assert.deepStrictEqual(await pts(IV), [10, 0], '후임이 글을 쓰면 10점'); n++;
r = await refOf(IV);
ok(r.joined === 2 && r.counted === 1, '점수 인정 1명');
await call('DELETE', `/posts/${ivPost}`, iv1Tok);
assert.deepStrictEqual(await pts(IV), [0, 0], '후임이 글을 지우면 점수도 빠짐'); n++;
r = await call('POST', '/posts', iv1Tok, { cat: 'tip', title: '후임의 다시 쓴 글', body: '내용입니다' });
assert.deepStrictEqual(await pts(IV), [10, 0]); n++;
await call('POST', '/admin/user', ADMIN, { user_id: iv1, action: 'block' });
assert.deepStrictEqual(await pts(IV), [0, 0], '막힌 후임은 점수에서 빠짐'); n++;
await call('POST', '/admin/user', ADMIN, { user_id: iv1, action: 'unblock' });
await call('POST', '/admin/user', ADMIN, { user_id: iv1, action: 'verify' });
await call('POST', '/admin/user', ADMIN, { user_id: iv2, action: 'verify' });
await call('POST', '/posts', iv2Tok, { cat: 'tip', title: '후임둘의 글', body: '내용입니다' });
assert.deepStrictEqual((await pts(IV))[0], 20, '후임 2명 20점'); n++;
backdate(ivId, 7);
assert.deepStrictEqual(await pts(IV), [20, 1], '초대 점수로도 진급, 복무는 그대로 필요'); n++;
// 11명 들어와도 10명까지(가입 횟수 제한을 피해 시험 DB에 바로 넣는다)
const fakeAt = new Date().toISOString(), fakeIds = Array.from({ length: 11 }, (_, i) => 900000 + i);
localSql(fakeIds.map(id => `INSERT INTO users (id, nick, nick_key, token_hash, created, verified, invited_by) VALUES (${id}, '가짜${id}/청주/24', '가짜${id}/청주/24', 'fake${id}', '${fakeAt}', 1, ${ivId})`).join('; ')
  + '; ' + fakeIds.map(id => `INSERT INTO posts (user_id, cat, title, body, created) VALUES (${id}, 'tip', '가짜 글', '내용', '${fakeAt}')`).join('; '));
r = await call('GET', '/me', IV);
ok(r.data.points === 100 && r.data.ref.joined === 13 && r.data.ref.counted === 13, '초대 점수는 10명까지(100점)');
ok(r.data.rank === 1, '100점이어도 복무 7일이면 일병');
backdate(ivId, 90);
ok((await call('GET', '/me', IV)).data.rank === 2, '초대만으로는 상병까지(병장은 150점)');
localSql(`DELETE FROM posts WHERE user_id >= 900000; DELETE FROM users WHERE id >= 900000`);
// 이미 가입한 사람은 초대 점수가 되지 않고, 초대 링크로 인증도 못 한다
const ivOld = rnd();
await call('POST', '/join', ivOld, { terms: true, nick: N('옛회원' + stamp) });
r = await call('POST', '/verify/code', ivOld, { code: ref1.code });
ok(r.data.error === 'code_bad', '초대 링크로는 인증 코드를 대신하지 못함');
const refBefore = (await refOf(IV)).joined;
r = await call('POST', '/verify/code', R1, { code: ref1.code });
ok(r.data.already === true && (await refOf(IV)).joined === refBefore, '이미 가입한 아빠가 링크를 열어도 점수 안 됨');
// 막힌 사람의 초대 링크는 못 쓴다
await call('POST', '/admin/user', ADMIN, { user_id: ivId, action: 'block' });
r = await call('POST', '/join', rnd(), { terms: true, nick: N('막힌자' + stamp), invite: ref1.code });
ok(r.data.invite_error === 'code_bad', '막힌 회원의 초대 링크는 폐기됨');
await call('POST', '/admin/user', ADMIN, { user_id: ivId, action: 'unblock' });

// 비속어: 글·댓글·닉네임을 서버에서 막고, 육아 글에 흔한 말은 통과시킨다(자세한 목록은 test/badwords-test.mjs)
r = await call('POST', '/posts', R1, { cat: 'tip', title: '시1발 제목입니다', body: '내용입니다' });
ok(r.status === 400 && r.data.error === 'bad_word' && r.data.word, '제목 욕설 막기');
r = await call('POST', '/posts', R1, { cat: 'tip', title: '평범한 제목', body: '진짜 ㅅㅂ 힘들어요' });
ok(r.status === 400 && r.data.error === 'bad_word', '본문 욕설 막기');
r = await call('POST', `/posts/${rp1}/comments`, R2, { body: '이 새끼 뭐야' });
ok(r.status === 400 && r.data.error === 'bad_word', '댓글 욕설 막기');
r = await call('POST', '/join', rnd(), { terms: true, nick: N('병신아빠') });
ok(r.data.error === 'nick_bad', '닉네임 욕설 막기');
r = await call('POST', `/posts/${rp1}/comments`, R2, { body: '이유식 씹는 연습은 오후 3시 발표 뒤에 해요. 내 새끼 자지 않아요.' });
ok(r.status === 200 && r.data.ok, '육아 글에 흔한 말은 통과');
await call('DELETE', `/comments/${r.data.comment.id}`, R2);

// 본인인증: 가짜 포트원(.dev.vars PORTONE_API_BASE)에 물어본다. 내 컴퓨터에서만
const K = { male: { status: 'VERIFIED', verifiedCustomer: { name: '시험', gender: 'MALE', birthDate: '1985-03-01', di: 'di-male-' + stamp } },
  dup: { status: 'VERIFIED', verifiedCustomer: { name: '시험', gender: 'MALE', birthDate: '1985-03-01', di: 'di-male-' + stamp } },
  female: { status: 'VERIFIED', verifiedCustomer: { name: '시험', gender: 'FEMALE', birthDate: '1985-03-01', di: 'di-f-' + stamp } },
  teen: { status: 'VERIFIED', verifiedCustomer: { name: '시험', gender: 'MALE', birthDate: new Date().getFullYear() - 10 + '-01-01', di: 'di-t-' + stamp } },
  ready: { status: 'READY' }, cionly: { status: 'VERIFIED', verifiedCustomer: { gender: 'MALE', birthDate: '1990-01-01', ci: 'ci-' + stamp } } };
const mock = await startMock(8798, K);
const I1 = rnd(), I2 = rnd();
r = await call('POST', '/join', I1, { terms: true, nick: N('본인' + stamp) });
ok(r.data.ok && r.data.user.verified === false, '본인인증 전 가입');
r = await call('POST', '/verify/identity', null, { id: 'case-male' });
ok(r.status === 401, '본인인증도 가입 뒤');
r = await call('POST', '/verify/identity', I1, { id: 'x' });
ok(r.data.error === 'identity_bad', '이상한 번호');
r = await call('POST', '/verify/identity', I1, { id: 'case-ready' });
ok(r.data.error === 'identity_bad', '끝나지 않은 인증');
r = await call('POST', '/verify/identity', I1, { id: 'case-nobody' });
ok(r.data.error === 'identity_bad', '없는 인증');
r = await call('POST', '/verify/identity', I1, { id: 'case-female' });
ok(r.status === 403 && r.data.error === 'identity_denied', '남성이 아니면 거절');
r = await call('POST', '/verify/identity', I1, { id: 'case-teen' });
ok(r.status === 403 && r.data.error === 'identity_denied', '미성년 거절');
r = await call('POST', '/verify/identity', I1, { id: 'case-male' });
ok(r.data.ok && r.data.user.verified === true && r.data.user.how === 'identity', '본인인증으로 인증');
r = await call('GET', '/posts?limit=1', I1);
ok(r.status === 200, '본인인증 뒤 읽기');
r = await call('POST', '/join', I2, { terms: true, nick: N('둘째' + stamp) });
r = await call('POST', '/verify/identity', I2, { id: 'case-dup' });
ok(r.status === 409 && r.data.error === 'identity_dup', '같은 사람의 두 번째 계정 막기');
r = await call('POST', '/verify/identity', I2, { id: 'case-cionly' });
ok(r.data.ok && r.data.user.verified === true, 'DI가 없으면 CI로');

// 카카오 로그인: 가짜 카카오(같은 8798). 처음이면 닉네임, 있던 회원이면 이 기기로, 탈퇴하면 연결도 끊는다
const RED = BASE.replace(/\/api$/, '') + '/';
const KA = rnd(), KB = rnd(), KC = rnd();
r = await call('GET', '/login/kakao/start');
ok(r.data.ok && r.data.url.includes('/oauth/authorize') && r.data.url.includes('client_id=test-key'), '동의 화면 주소');
r = await call('POST', '/login/kakao', null, { code: 'k1', redirect_uri: RED });
ok(r.status === 401, '기기 토큰 없으면 거절');
r = await call('POST', '/login/kakao', KA, { code: 'nope', redirect_uri: RED });
ok(r.data.error === 'kakao_bad', '카카오가 거절한 코드');
r = await call('POST', '/login/kakao', KA, { code: 'k1', redirect_uri: 'https://evil.example/' });
ok(r.data.error === 'kakao_bad', '다른 주소로 돌아가는 요청 거절');
r = await call('POST', '/login/kakao', KA, { code: 'k1', redirect_uri: RED });
ok(r.data.ok && r.data.need_nick === true && !r.data.user, '처음이면 닉네임 먼저');
r = await call('GET', '/me', KA);
ok(r.status === 401, '닉네임 전에는 계정 없음');
r = await call('POST', '/join', KA, { terms: true, nick: '잘못된꼴' });
ok(r.data.error === 'nick_form', '카카오 뒤에도 닉네임 꼴 검사');
r = await call('POST', '/join', KA, { terms: true, nick: N('카카오' + stamp) });
ok(r.data.ok && r.data.user.verified === true && r.data.user.how === 'kakao' && r.data.user.kakao === true && !r.data.recovery, '카카오 + 닉네임이면 바로 인증, 복구 코드 없음');
r = await call('GET', '/posts?limit=1', KA);
ok(r.status === 200, '가입 뒤 커뮤니티 읽기');
r = await call('POST', '/login/kakao', KB, { code: 'k1', redirect_uri: RED });
ok(r.data.ok && !r.data.need_nick && r.data.user.nick === N('카카오' + stamp), '새 기기는 같은 계정으로');
r = await call('GET', '/me', KA);
ok(r.status === 401, '새 기기로 옮기면 이전 기기는 끊김');
r = await call('POST', '/login/kakao', KB, { code: 'k2', redirect_uri: RED });
ok(r.status === 409 && r.data.error === 'kakao_taken', '다른 카카오 계정은 이 기기에 못 붙임');
r = await call('POST', '/login/kakao', KB, { code: 'k1', redirect_uri: RED });
ok(r.data.ok && r.data.user.kakao === true, '같은 기기 다시 로그인');
// 카카오 없이 가입한 계정 잇기(앞에서 만든 인증 전 G)
r = await call('POST', '/login/kakao', G, { code: 'k3', redirect_uri: RED });
ok(r.data.ok && r.data.linked === true && r.data.user.verified === true && r.data.user.how === 'kakao', '옛 계정에 카카오 잇기');
r = await call('POST', '/login/kakao', KC, { code: 'k3', redirect_uri: RED });
ok(r.data.ok && r.data.user.kakao === true, '이은 계정은 새 기기에서 카카오로 복귀');
// 막힌 회원은 카카오로 다시 와도 막혀 있다
const gid = r.data.user.id;
r = await call('POST', '/admin/user', ADMIN, { user_id: gid, action: 'block' });
ok(r.data.ok, '막기');
r = await call('POST', '/login/kakao', rnd(), { code: 'k3', redirect_uri: RED });
ok(r.data.ok && r.data.user.blocked === true && r.data.user.verified === false, '막힌 회원은 다시 와도 막힘');
// 탈퇴: 카카오를 거쳐야 하고, 연결을 끊고, 다시 오면 새 가입이다
r = await call('DELETE', '/me', KB, { confirm: true });
ok(r.data.error === 'kakao_leave', '카카오 회원은 그냥 탈퇴 안 됨');
r = await call('POST', '/me/leave-kakao', KB, { code: 'k4', redirect_uri: RED });
ok(r.status === 403 && r.data.error === 'kakao_mismatch', '다른 카카오 계정으로 탈퇴 안 됨');
r = await call('POST', '/me/leave-kakao', KB, { code: 'k1', redirect_uri: RED });
ok(r.data.ok && mock.unlinked.includes(1001), '탈퇴하면 카카오 연결도 끊김');
r = await call('GET', '/me', KB);
ok(r.status === 401, '탈퇴 뒤 계정 없음');
r = await call('POST', '/login/kakao', rnd(), { code: 'k1', redirect_uri: RED });
ok(r.data.need_nick === true, '탈퇴 뒤 다시 오면 새 가입');
// 같은 카카오로 두 기기에서 동시에 처음 가입: 먼저 마친 쪽만, 뒤의 기기는 안내 뒤 카카오로 같은 계정에
const KD = rnd(), KE = rnd();
await call('POST', '/login/kakao', KD, { code: 'k2', redirect_uri: RED });
await call('POST', '/login/kakao', KE, { code: 'k2', redirect_uri: RED });
r = await call('POST', '/join', KD, { terms: true, nick: N('먼저' + stamp) });
ok(r.data.ok && r.data.user.kakao === true, '먼저 마친 기기 가입');
r = await call('POST', '/join', KE, { terms: true, nick: N('나중' + stamp) });
ok(r.status === 409 && r.data.error === 'kakao_used', '같은 카카오로 두 번 가입 안 됨');
r = await call('POST', '/login/kakao', KE, { code: 'k2', redirect_uri: RED });
ok(r.data.ok && r.data.user.nick === N('먼저' + stamp), '뒤의 기기는 카카오로 같은 계정에');
// 연결 해제 웹훅: 사용자가 카카오 쪽에서 끊었을 때. 대표 어드민 키로 확인하고 탈퇴와 같게 지운다
const hook = async (method, query, key, body) => {
  const res = await fetch(BASE + '/kakao/unlink' + query, { method, headers: { ...(key ? { Authorization: 'KakaoAK ' + key } : {}), ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body });
  return { status: res.status, data: await res.json() };
};
const AK = 'test-admin-key';
r = await hook('GET', '?app_id=1&user_id=1002&referrer_type=UNLINK_FROM_APPS');
ok(r.status === 403, '웹훅: 키 없으면 거절');
r = await hook('GET', '?app_id=1&user_id=1002&referrer_type=UNLINK_FROM_APPS', 'wrong-key');
ok(r.status === 403, '웹훅: 틀린 키 거절');
r = await call('GET', '/me', KE);
ok(r.status === 200, '웹훅: 거절되면 계정은 그대로');
r = await hook('GET', '?app_id=1&user_id=999999&referrer_type=UNLINK_FROM_APPS', AK);
ok(r.status === 200 && r.data.ok, '웹훅: 없는 사용자도 200');
r = await hook('GET', '?app_id=1&user_id=1002&referrer_type=UNLINK_FROM_APPS', AK);
ok(r.status === 200 && r.data.ok, '웹훅: GET으로 끊기');
r = await call('GET', '/me', KE);
ok(r.status === 401, '웹훅: 끊으면 계정이 지워짐');
r = await call('POST', '/login/kakao', rnd(), { code: 'k2', redirect_uri: RED });
ok(r.data.need_nick === true, '웹훅: 다시 오면 새 가입');
const KF = rnd();
await call('POST', '/login/kakao', KF, { code: 'k4', redirect_uri: RED });
r = await call('POST', '/join', KF, { terms: true, nick: N('넷째' + stamp) });
ok(r.data.ok && r.data.user.kakao === true, '웹훅 시험용 가입');
r = await hook('POST', '', AK, 'app_id=1&user_id=1004&referrer_type=ACCOUNT_DELETE');
ok(r.status === 200, '웹훅: POST 본문으로 끊기');
r = await call('GET', '/me', KF);
ok(r.status === 401, '웹훅: POST로도 지워짐');
r = await hook('GET', '?app_id=1&user_id=1003&referrer_type=UNLINK_FROM_APPS', AK);
ok(r.status === 200, '웹훅: 막힌 계정 끊기');
r = await call('POST', '/login/kakao', rnd(), { code: 'k3', redirect_uri: RED });
ok(r.data.ok && r.data.user && r.data.user.blocked === true, '웹훅: 막힌 계정은 줄이 남아 다시 와도 막힘');
const KG = rnd();
await call('POST', '/login/kakao', KG, { code: 'k1', redirect_uri: RED });
await hook('GET', '?app_id=1&user_id=1001&referrer_type=INCOMPLETE_SIGN_UP', AK);
r = await call('POST', '/join', KG, { terms: true, nick: N('다섯째' + stamp) });
ok(r.data.ok && r.data.user.kakao === false && r.data.user.verified === false, '웹훅: 닉네임 전이면 대기 기록도 지워짐');
r = await call('POST', '/login/kakao', ADMIN, { code: 'ui9', redirect_uri: RED });
ok(r.data.ok && r.data.user.role === 'admin' && r.data.user.kakao === true, '관리자도 카카오 잇기');
await hook('GET', '?app_id=1&user_id=2000&referrer_type=UNLINK_FROM_APPS', AK);
r = await call('GET', '/me', ADMIN);
ok(r.status === 200 && r.data.user.role === 'admin' && r.data.user.kakao === false, '웹훅: 관리자는 지우지 않고 연결만 풀림');

// ----- Play 등록(11-05): 약관 동의 · 심사용 입구 · 사용자 차단 -----
const REVIEW = 'REVW-2345-TEST';      // .dev.vars REVIEW_CODE와 같게
r = await call('POST', '/join', rnd(), { nick: N('약관' + stamp) });
ok(r.data.error === 'terms', '동의 없으면 가입 안 됨');
r = await call('POST', '/join', rnd(), { nick: N('약관' + stamp), terms: 'yes' });
ok(r.data.error === 'terms', '동의 값이 true가 아니면 가입 안 됨');
r = await call('POST', '/join', rnd(), { terms: true, nick: N('심사계정') });
ok(r.data.error === 'nick_reserved', '심사 이름은 일반 회원이 못 씀');
r = await call('POST', '/login/review', null, { code: REVIEW });
ok(r.status === 401, '심사 입구: 기기 토큰 없으면 거절');
const RV = rnd();
r = await call('POST', '/login/review', RV, { code: 'WRONG' });
ok(r.data.error === 'review_bad', '심사 입구: 짧은 코드 거절');
r = await call('POST', '/login/review', RV, { code: 'ABCD-EFGH-2345' });
ok(r.data.error === 'review_bad' && (await call('GET', '/me', RV)).status === 401, '심사 입구: 틀린 코드면 계정 없음');
r = await call('POST', '/login/review', RV, { code: REVIEW });
ok(r.data.ok && r.data.user.verified === true && r.data.user.how === 'review' && r.data.user.kakao === false && r.data.user.terms === false && r.data.user.role === 'user', '심사 입구: 맞는 코드면 인증된 심사용 계정');
const rvId = r.data.user.id;
r = await call('GET', '/posts?limit=1', RV);
ok(r.status === 200 && Array.isArray(r.data.posts), '심사용 계정은 커뮤니티를 읽는다');
// 약관 전에 만든 계정(terms_at 없음)은 첫 글·댓글 때 막히고, 동의하면 된다
r = await call('POST', '/posts', RV, { cat: 'tip', title: '심사 글입니다', body: '내용' });
ok(r.status === 403 && r.data.error === 'terms', '동의 전 글쓰기 막힘');
r = await call('POST', '/me/terms', RV, {});
ok(r.data.error === 'terms', 'agree 없으면 동의 안 됨');
r = await call('POST', '/me/terms', null, { agree: true });
ok(r.status === 401, '동의도 로그인이 있어야 한다');
r = await call('POST', '/me/terms', RV, { agree: true });
ok(r.data.ok && r.data.user.terms === true, '약관 동의');
r = await call('POST', '/posts', RV, { cat: 'tip', title: '심사 글입니다', body: '내용' });
ok(r.data.ok && r.data.id, '동의 뒤 글쓰기');
const rvPost = r.data.id;
const RV2 = rnd();
r = await call('POST', '/login/review', RV2, { code: REVIEW.replace(/-/g, '').toLowerCase() });
ok(r.data.ok && r.data.user.id === rvId && r.data.user.terms === true, '심사 입구: 코드는 여러 번 쓰고 같은 계정, 소문자·띄어쓰기 무시');
r = await call('GET', '/me', RV);
ok(r.status === 401, '심사 입구: 이전 기기는 끊김');
// 차단: 내 화면에서만 사라진다
const BA = rnd(), BB = rnd();
await call('POST', '/login/kakao', BA, { code: 'k5', redirect_uri: RED });
await call('POST', '/login/kakao', BB, { code: 'k6', redirect_uri: RED });
r = await call('POST', '/join', BA, { terms: true, nick: N('차단자' + stamp) });
ok(r.data.ok && r.data.user.terms === true, '가입하면 약관 동의가 남는다');
const baId = r.data.user.id;
r = await call('POST', '/join', BB, { terms: true, nick: N('상대' + stamp) });
const bbId = r.data.user.id;
r = await call('POST', '/login/review', BA, { code: REVIEW });
ok(r.status === 409 && r.data.error === 'token_in_use', '심사 입구: 다른 계정이 있는 기기는 거절');
const bbWord = '차단시험글' + stamp;
r = await call('POST', '/posts', BB, { cat: 'tip', title: bbWord, body: '상대가 쓴 글' });
const bbPost = r.data.id;
await call('POST', `/posts/${bbPost}/comments`, BA, { body: '내 댓글' });
await call('POST', `/posts/${bbPost}/comments`, RV2, { body: '심사 계정 댓글' });
r = await call('POST', `/posts/${rvPost}/comments`, BB, { body: '상대 댓글' });
const bbCmt = r.data.comment.id;
r = await call('POST', '/posts', BA, { cat: 'tip', title: '내가 쓴 글입니다', body: '내 글' });
const baPost = r.data.id;
await call('POST', '/me/seen', BA);
await new Promise(done => setTimeout(done, 5));
await call('POST', `/posts/${baPost}/comments`, BB, { body: '상대가 내 글에' });
await call('POST', `/posts/${baPost}/comments`, RV2, { body: '심사 계정이 내 글에' });
r = await call('GET', '/me', BA);
ok(r.data.new_comments === 2 && Array.isArray(r.data.blocks) && r.data.blocks.length === 0, '차단 전: 새 댓글 2개, 차단 목록 비어 있음');
r = await call('GET', '/posts/hot', BA);
ok(r.data.posts.some(p => p.id === bbPost), '차단 전: 지금 뜨는 글에 보임');
r = await call('POST', '/blocks', null, { user_id: bbId });
ok(r.status === 401, '차단: 로그인이 있어야 한다');
r = await call('POST', '/blocks', BA, {});
ok(r.data.error === 'bad_json', '차단: 번호가 없으면 거절');
r = await call('POST', '/blocks', BA, { user_id: baId });
ok(r.data.error === 'block_self', '나는 차단할 수 없다');
r = await call('POST', '/blocks', BA, { user_id: 99999999 });
ok(r.status === 404, '없는 사람은 차단할 수 없다');
r = await call('POST', '/blocks', BA, { user_id: (await call('GET', '/me', ADMIN)).data.user.id });
ok(r.status === 403 && r.data.error === 'block_staff', '운영 계정은 차단할 수 없다');
r = await call('POST', '/blocks', BA, { user_id: bbId });
ok(r.data.ok, '차단');
r = await call('POST', '/blocks', BA, { user_id: bbId });
ok(r.data.ok, '두 번 차단해도 그대로');
r = await call('GET', '/posts?limit=50', BA);
ok(!r.data.posts.some(p => p.uid === bbId), '차단 뒤 목록에서 사라짐');
r = await call('GET', '/posts?q=' + encodeURIComponent(bbWord), BA);
ok(r.data.posts.length === 0, '차단 뒤 검색에서 사라짐(색인)');
r = await call('GET', '/posts?q=' + encodeURIComponent('차단'), BA);
ok(!r.data.posts.some(p => p.uid === bbId), '차단 뒤 검색에서 사라짐(짧은 낱말)');
r = await call('GET', '/posts/hot', BA);
ok(!r.data.posts.some(p => p.id === bbPost), '차단 뒤 지금 뜨는 글에서 사라짐');
r = await call('GET', `/posts/${bbPost}`, BA);
ok(r.status === 403 && r.data.error === 'user_blocked' && !r.data.post, '차단한 사람의 글은 열리지 않음');
r = await call('GET', `/posts/${rvPost}`, BA);
ok(r.status === 200 && !r.data.comments.some(c => c.id === bbCmt), '남의 글에서도 차단한 사람의 댓글이 사라짐');
r = await call('GET', '/me', BA);
ok(r.data.new_comments === 1 && r.data.new_list.length === 1 && r.data.blocks.length === 1 && r.data.blocks[0].id === bbId, '차단 뒤 새 댓글에서 빠지고 차단 목록에 보임');
r = await call('GET', '/posts?limit=50', BB);
ok(r.data.posts.some(p => p.id === baPost), '차단당한 쪽은 그대로 본다');
r = await call('GET', `/posts/${bbPost}`, RV2);
ok(r.status === 200, '다른 사람에게는 그대로 보임');
r = await call('DELETE', `/blocks/${bbId}`, BA);
ok(r.data.ok, '차단 풀기');
r = await call('GET', `/posts/${bbPost}`, BA);
ok(r.status === 200, '풀면 다시 보임');
await call('POST', '/blocks', BA, { user_id: bbId });
// 탈퇴: 차단 줄과 신고한 사람 번호를 지운다
r = await call('POST', '/reports', BB, { kind: 'post', id: baPost, reason: '시험 신고' });
ok(r.data.ok, '탈퇴 시험용 신고');
r = await call('POST', '/me/leave-kakao', BB, { code: 'k6', redirect_uri: RED });
ok(r.data.ok, '차단당한 사람 탈퇴');
r = await call('GET', '/me', BA);
ok(r.data.blocks.length === 0, '탈퇴하면 차단 줄도 지워짐');
r = await call('GET', '/admin/queue', ADMIN);
ok(r.data.reports.some(x => x.kind === 'post' && x.target_id === baPost), '탈퇴해도 처리 전 신고는 남음');
// 심사자가 탈퇴를 시험해도 다음 입장 때 다시 만든다
r = await call('DELETE', '/me', RV2, { confirm: true });
ok(r.data.ok, '심사용 계정 탈퇴');
r = await call('GET', '/me', RV2);
ok(r.status === 401, '심사용 계정 지워짐');
const RV3 = rnd();
r = await call('POST', '/login/review', RV3, { code: REVIEW });
ok(r.data.ok && r.data.user.verified === true && r.data.user.terms === false && r.data.user.id !== undefined, '탈퇴 뒤 심사 입구로 새 계정');
mock.server.close();

console.log('통과', n, '건');

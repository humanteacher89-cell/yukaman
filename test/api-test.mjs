// 육아맨 서버 시험: 내 컴퓨터 미리 보기(deploy.py dev --fresh)에 대고 돌린다. 공개 주소에는 돌리지 않는다.
//   node test/api-test.mjs [http://127.0.0.1:8799]
import assert from 'node:assert';
const BASE = (process.argv[2] || 'http://127.0.0.1:8799') + '/api';
if (!/127\.0\.0\.1|localhost/.test(BASE)) throw new Error('내 컴퓨터 주소에서만 돌립니다');
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
r = await call('POST', '/join', A, { nick: '육아맨 운영자' });
ok(r.data.error === 'nick_reserved', '운영 사칭 이름 막기');
r = await call('POST', '/join', A, { nick: 'a' });
ok(r.data.error === 'nick_len', '짧은 닉네임');
r = await call('POST', '/join', A, { nick: '시험A' + stamp });
ok(r.data.ok && r.data.user.verified === false, '가입: 인증 전');
const recA = r.data.recovery;
ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(recA || ''), '가입 때 복구 코드 12자');
r = await call('POST', '/join', A, { nick: '다른이름' + stamp });
ok(r.data.existing === true && !r.data.recovery, '같은 기기는 기존 사용자(복구 코드 다시 안 줌)');
r = await call('POST', '/join', B, { nick: '시험A' + stamp });
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
r = await call('POST', '/join', C, { nick: '시험C' + stamp, invite: 'TESTDADS' });
ok(r.data.ok && r.data.user.verified === false && r.data.invite_error === 'code_used', '쓴 코드는 다시 못 씀, 가입은 됨');

// 글·댓글·검색
r = await call('POST', '/posts', A, { cat: 'daily', title: '시험 글 ' + stamp, body: '독특한낱말' + stamp + ' 내용입니다' });
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
r = await call('GET', '/posts?cat=daily&limit=50', A);
ok(r.data.posts.every(p => p.cat === 'daily') && r.data.posts.length > 0, '분류');
r = await call('POST', '/posts', A, { cat: 'school', title: '돌봄교실 질문 ' + stamp, body: '학교 분류' });
ok(r.data.ok, '학교·학습 분류');
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
ok(r.data.invites.length === 3 && r.data.invites[0].used === true && r.data.invites[0].nick === '시험C' + stamp, '누가 썼는지 보임');

// 사칭 이름 막기
for (const bad of ['운영진', '휴먼쌤', 'yukaman', 'adm1n', 'a d m i n', '매니저1']) {
  r = await call('POST', '/join', rnd(), { nick: bad });
  ok(r.data.error === 'nick_reserved', '사칭 이름 막기 ' + bad);
}

// 새 댓글 배지: A의 글에 C가 댓글 → A에게 1, 보면 0. 내 댓글은 세지 않는다(앞서 A가 단 댓글)
r = await call('GET', '/me', A);
ok(r.data.new_comments === 0, '내가 단 댓글은 새 댓글 아님');
r = await call('POST', `/posts/${pid}/comments`, C, { body: 'C의 댓글' });
const ccid = r.data.comment.id;
r = await call('GET', '/me', A);
ok(r.data.new_comments === 1 && r.data.new_list[0].nick === '시험C' + stamp && r.data.new_list[0].post_id === pid, '새 댓글 1');
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
r = await call('POST', '/join', B, { nick: '시험B' + stamp });
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
r = await call('POST', '/join', ADMIN, { nick: '시험관' + stamp, invite: 'TESTADMN' });
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
const app = r.data.queue.find(q => q.nick === '시험B' + stamp);
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
r = await call('POST', '/join', rnd(), { nick: '새기기' + stamp, invite: cCode });
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
ok(r.data.ok && r.data.user.nick === '시험A' + stamp && r.data.recovery && r.data.recovery !== recA, '복구: 같은 계정, 새 코드');
const recA2 = r.data.recovery;
r = await call('GET', '/me', A);
ok(r.status === 401 && r.data.error === 'unknown_user', '옛 기기는 끊김');
r = await call('GET', '/me', D);
ok(r.status === 200 && r.data.user.nick === '시험A' + stamp && r.data.has_recovery === true, '새 기기로 내 정보');
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
ok(r.data.ok && r.data.user.nick === '시험A' + stamp, '새 코드로 복구');
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
r = await call('POST', '/posts', B, { cat: 'daily', title: '탈퇴 전 글 ' + stamp, body: '지워질내용' + stamp });
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

console.log('통과', n, '건');

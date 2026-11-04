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

// 읽기는 누구나, 쓰기는 로그인·인증
let r = await call('GET', '/posts?limit=2');
ok(r.status === 200 && r.data.posts.length === 2, '읽기');
ok(r.data.posts[0].badge === 'official', '자료실 글 표시');
const firstId = r.data.posts[0].id;
r = await call('POST', '/posts', null, { cat: 'tip', title: '제목입니다', body: '내용' });
ok(r.status === 401 && r.data.error === 'login', '토큰 없으면 401');

// 닉네임
r = await call('POST', '/join', A, { nick: '육아맨 운영자' });
ok(r.data.error === 'nick_reserved', '운영 사칭 이름 막기');
r = await call('POST', '/join', A, { nick: 'a' });
ok(r.data.error === 'nick_len', '짧은 닉네임');
r = await call('POST', '/join', A, { nick: '시험A' + stamp });
ok(r.data.ok && r.data.user.verified === false, '가입: 인증 전');
r = await call('POST', '/join', A, { nick: '다른이름' + stamp });
ok(r.data.existing === true, '같은 기기는 기존 사용자');
r = await call('POST', '/join', B, { nick: '시험A' + stamp });
ok(r.data.error === 'nick_taken', '같은 닉네임 막기');

// 인증 전에는 못 쓴다
r = await call('POST', '/posts', A, { cat: 'tip', title: '제목입니다', body: '내용' });
ok(r.status === 403 && r.data.error === 'verify', '인증 전 글 금지');
r = await call('POST', `/posts/${firstId}/comments`, A, { body: '댓글' });
ok(r.status === 403 && r.data.error === 'verify', '인증 전 댓글 금지');
r = await call('POST', '/invites', A, {});
ok(r.status === 403, '인증 전 초대 금지');

// 초대 코드
r = await call('POST', '/verify/code', A, { code: 'ZZZZ-ZZZZ' });
ok(r.data.error === 'code_bad', '틀린 코드');
r = await call('POST', '/verify/code', A, { code: 'test-dads' });
ok(r.data.ok && r.data.user.verified === true && r.data.user.how === 'invite', '코드로 인증(대소문자·하이픈 무시)');
r = await call('POST', '/join', C, { nick: '시험C' + stamp, invite: 'TESTDADS' });
ok(r.data.ok && r.data.user.verified === false && r.data.invite_error === 'code_used', '쓴 코드는 다시 못 씀, 가입은 됨');

// 글·댓글·검색
r = await call('POST', '/posts', A, { cat: 'daily', title: '시험 글 ' + stamp, body: '독특한낱말' + stamp + ' 내용입니다' });
ok(r.data.ok && r.data.post.badge === 'dad', '인증 뒤 글쓰기');
const pid = r.data.id;
r = await call('GET', '/posts?q=' + encodeURIComponent('독특한낱말' + stamp));
ok(r.data.posts.length === 1 && r.data.posts[0].id === pid, '본문 검색');
r = await call('GET', '/posts?q=' + encodeURIComponent('독특한낱말' + stamp + ' 없는낱말'));
ok(r.data.posts.length === 0, '낱말 모두 있어야 찾음');
r = await call('GET', '/posts?q=' + encodeURIComponent('100%_'));
ok(r.status === 200, '특수문자 검색 오류 없음');
r = await call('GET', '/posts?cat=leave&limit=50');
ok(r.data.posts.every(p => p.cat === 'leave') && r.data.posts.length > 0, '분류');
r = await call('POST', `/posts/${pid}/comments`, A, { body: '<script>alert(1)</script> 댓글' });
ok(r.data.ok, '댓글');
const cid = r.data.comment.id;
r = await call('GET', `/posts/${pid}`);
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
r = await call('GET', '/me', A);
ok(r.data.invites.length === 3 && r.data.invites[0].used === true && r.data.invites[0].nick === '시험C' + stamp, '누가 썼는지 보임');

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
r = await call('GET', '/admin/queue', ADMIN);
const app = r.data.queue.find(q => q.nick === '시험B' + stamp);
ok(app && app.answer.includes('밤에'), '대기 목록');
r = await call('POST', '/admin/decide', ADMIN, { id: app.id, approve: true });
ok(r.data.ok, '승인');
r = await call('GET', '/admin/queue', ADMIN);
ok(!r.data.queue.find(q => q.id === app.id), '대기에서 빠짐');
r = await call('GET', '/me', B);
ok(r.data.user.verified === true && r.data.user.how === 'apply' && r.data.application.status === 'approved', 'B 인증');
r = await call('GET', '/posts?q=' + encodeURIComponent('밤에 자주 깨서'));
ok(r.data.posts.length === 0, '신청 답변은 글로 안 나옴');

// 해제·막기
const uid = (await call('GET', '/me', C)).data.user.id;
r = await call('POST', '/admin/user', ADMIN, { user_id: uid, action: 'block' });
ok(r.data.ok, '막기');
r = await call('POST', '/posts', C, { cat: 'tip', title: '제목입니다', body: '내용' });
ok(r.status === 403 && r.data.error === 'blocked', '막힌 회원 글 금지');
r = await call('POST', '/verify/code', C, { code: codes[1] });
ok(r.data.error === 'blocked', '막힌 회원 재인증 금지');
r = await call('POST', '/admin/user', ADMIN, { user_id: 1, action: 'block' });
ok(r.status === 403, '자료실 계정은 못 바꿈');

// 관리자는 글을 지울 수 있고, 지운 글은 안 보인다
r = await call('DELETE', `/posts/${pid}`, ADMIN);
ok(r.data.ok, '관리자 삭제');
r = await call('GET', `/posts/${pid}`);
ok(r.status === 404, '지운 글 404');
r = await call('GET', '/nope');
ok(r.status === 404, '없는 주소');

console.log('통과', n, '건');

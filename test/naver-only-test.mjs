// LOGIN_METHOD=naver일 때 성별 확인을 돌아갈 길이 모두 닫히는지 본다. 같은 가짜 D1에 서버를 하나 더 띄운다.
//   미리 보기(deploy.py dev)를 한 번 띄워 표를 만든 뒤, 가짜 카카오를 켜 두지 않은 채로: node test/naver-only-test.mjs
import assert from 'node:assert';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMock } from './mock-kakao.mjs';

const PORT = 8796, ORIGIN = 'http://127.0.0.1:' + PORT, BASE = ORIGIN + '/api', RED = ORIGIN + '/';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let WRANGLER = process.env.WRANGLER_JS;
for (let d = ROOT; !WRANGLER && dirname(d) !== d; d = dirname(d)) { const p = join(dirname(d), 'tools', 'cf-wrangler', 'node_modules', 'wrangler', 'bin', 'wrangler.js'); if (existsSync(p)) WRANGLER = p; }
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
const localSql = sql => execFileSync(process.execPath, [WRANGLER, 'd1', 'execute', 'yukaman', '--local', '--command', sql], { cwd: ROOT, stdio: 'ignore', env });
const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join('');
const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, '0')).join('');
const stamp = String(Date.now() % 100000);
const N = s => s + stamp + '/청주/24';
let n = 0;
const ok = (cond, what) => { n++; assert.ok(cond, what); };
async function call(method, path, token, body) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
}
const NV = code => ({ code, state: 'st', redirect_uri: RED });

const mock = await startMock(8798);
const child = spawn(process.execPath, [WRANGLER, 'pages', 'dev', 'public', '--port', String(PORT), '--ip', '127.0.0.1', '--binding', 'LOGIN_METHOD=naver'], { cwd: ROOT, stdio: 'ignore', env });
const stop = () => { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' }); } catch (e) { child.kill(); } mock.server.close(); };

try {
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    try { up = (await fetch(BASE + '/health')).ok; } catch (e) { await new Promise(done => setTimeout(done, 1000)); }
  }
  assert.ok(up, '시험 서버가 뜨지 않음');
  localSql("DELETE FROM acts WHERE kind IN ('join', 'code', 'naver', 'kakao', 'apply', 'invite')");

  // 네이버를 거치지 않으면 가입하지 못한다
  let r = await call('POST', '/join', rnd(), { terms: true, nick: N('맨몸') });
  ok(r.status === 403 && r.data.error === 'naver_required', '네이버 없는 가입 막기');
  r = await call('POST', '/join', rnd(), { terms: true, nick: N('코드만'), invite: 'TESTDAD2' });
  ok(r.status === 403 && r.data.error === 'naver_required', '초대 코드만으로 가입 막기');

  // 네이버 + 남성이면 된다, 여성은 안 된다
  const D1 = rnd();
  r = await call('POST', '/login/naver', rnd(), NV('nf'));
  ok(r.status === 403 && r.data.error === 'naver_not_dad', '여성 계정 거절');
  r = await call('POST', '/login/naver', D1, NV('n' + stamp + '11'));
  ok(r.data.need_nick === true, '남성 계정은 닉네임으로');
  r = await call('POST', '/join', D1, { terms: true, nick: N('네이버') });
  ok(r.data.ok && r.data.user.verified === true && r.data.user.how === 'naver', '네이버 가입은 바로 인증');

  // 회원이 초대 코드를 만들어 돌아갈 수 없다. 아빠 초대 링크는 남는다
  r = await call('POST', '/invites', D1, {});
  ok(r.status === 403 && r.data.error === 'naver_required', '회원의 초대 코드 만들기 막기');
  const ref = (await call('GET', '/me', D1)).data.ref;
  ok(ref && ref.code, '아빠 초대 링크는 그대로');
  const D2 = rnd();
  await call('POST', '/login/naver', D2, NV('n' + stamp + '12'));
  r = await call('POST', '/join', D2, { terms: true, nick: N('후임'), invite: ref.code });
  ok(r.data.ok && r.data.invite_error === '' && r.data.user.how === 'naver', '초대 링크 + 네이버 가입');
  ok((await call('GET', '/me', D1)).data.ref.joined === 1, '초대한 아빠에게 잡힘');

  // 카카오: 새 가입은 닫고, 이미 가입한 회원은 들어온다
  r = await call('POST', '/login/kakao', rnd(), { code: 'k7', redirect_uri: RED });
  ok(r.status === 403 && r.data.error === 'kakao_closed', '카카오 새 가입 막기');
  const oldKakao = await sha('kakao|1008'), at = new Date().toISOString();
  localSql(`DELETE FROM users WHERE id >= 910000; INSERT INTO users (id, nick, nick_key, token_hash, created, verified, verified_how, kakao_hash, terms_at) VALUES (910000, '옛카카오${stamp}/청주/24', '옛카카오${stamp}/청주/24', 'off-910000', '${at}', 1, 'kakao', '${oldKakao}', '${at}')`);
  const K1 = rnd();
  r = await call('POST', '/login/kakao', K1, { code: 'k8', redirect_uri: RED });
  ok(r.data.ok && r.data.user && r.data.user.id === 910000, '이미 카카오로 가입한 회원은 들어옴');
  r = await call('POST', '/login/naver', K1, NV('n' + stamp + '13'));
  ok(r.status === 409 && r.data.error === 'naver_taken', '카카오 회원에 네이버를 잇지 않음');

  // 인증 전 옛 계정: 신청서와 아빠 코드는 막고, 관리자 코드와 네이버 잇기는 된다
  const OLD1 = rnd(), OLD2 = rnd();
  localSql(`INSERT INTO users (id, nick, nick_key, token_hash, created, terms_at) VALUES (910001, '옛계정${stamp}/청주/24', '옛계정${stamp}/청주/24', '${await sha('tok|' + OLD1)}', '${at}', '${at}'), (910002, '옛둘${stamp}/청주/24', '옛둘${stamp}/청주/24', '${await sha('tok|' + OLD2)}', '${at}', '${at}');`
    + ` INSERT OR REPLACE INTO invites (code, owner_id, kind, note, created) VALUES ('NVDADCDE', NULL, 'dad', '시험', '${at}'), ('NVADMCDE', NULL, 'admin', '시험', '${at}')`);
  r = await call('POST', '/verify/apply', OLD1, { stage: 'raising', answer: '아이를 키우고 있는 아빠입니다. 잘 부탁드려요.', pledge: true });
  ok(r.status === 403 && r.data.error === 'naver_required', '신청서 막기');
  r = await call('POST', '/verify/code', OLD1, { code: 'NVDADCDE' });
  ok(r.status === 403 && r.data.error === 'naver_required', '아빠 코드로 인증 막기');
  r = await call('POST', '/login/naver', OLD1, NV('nf'));
  ok(r.data.error === 'naver_not_dad' && (await call('GET', '/me', OLD1)).data.user.verified === false, '옛 계정도 여성 계정이면 인증 안 됨');
  r = await call('POST', '/login/naver', OLD1, NV('n' + stamp + '14'));
  ok(r.data.linked === true && r.data.user.verified === true && r.data.user.how === 'naver', '옛 계정에 남성 네이버를 이으면 인증');
  r = await call('POST', '/verify/code', OLD2, { code: 'NVADMCDE' });
  ok(r.data.ok && r.data.user.role === 'admin', '관리자 코드는 그대로');
  r = await call('POST', '/verify/code', D1, { code: 'NVDADCDE' });
  ok(r.data.already === true, '이미 인증한 사람에게는 그대로 already');

  console.log('통과', n, '건');
} finally {
  stop();
}

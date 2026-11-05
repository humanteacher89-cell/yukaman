// 시험용 가짜 카카오 + 가짜 포트원(내 컴퓨터 전용). 서버의 .dev.vars가 이 주소를 보게 한다.
//   node test/mock-kakao.mjs   화면 확인할 때 혼자 띄운다(8798). test/api-test.mjs는 직접 불러 쓴다.
// 인가 코드 k1·k2…는 회원번호가 정해져 있고, ui로 시작하면 화면 확인용 회원이다. 그 밖의 코드는 카카오가 거절한다.
import http from 'node:http';

const KEY = 'test-key', SECRET = 'test-kakao-secret';
const idOf = code => ({ k1: 1001, k2: 1002, k3: 1003, k4: 1004, k5: 1005, k6: 1006, k7: 1007, k8: 1008 })[code] || (String(code).startsWith('ui') ? 2000 : 0);
// 가짜 네이버(11-05): 코드마다 회원번호와 성별이 정해져 있다. n + 숫자는 남성 · nf 여성 · nu 성별 모름 · nx 성별을 주지 않음(동의 안 함). 실제 네이버처럼 토큰 실패도 200으로 {error}를 준다
const NAVER_ID = 'test-naver', NAVER_SECRET = 'test-naver-secret';
const naverOf = code => {
  if (/^n\d+$/.test(code)) return { id: 'nv-' + code, gender: 'M' };
  return { nf: { id: 'nv-f', gender: 'F' }, nu: { id: 'nv-u', gender: 'U' }, nx: { id: 'nv-x' } }[code] || null;
};

export async function startMock(port, identity = {}) {
  const unlinked = [], naverUnlinked = [], naverPrompts = [];
  let uiNaver = 'n1';      // 화면 확인: 동의 화면 없이 이 코드로 돌려보낸다. GET /mock/naver-code?code=nf 로 바꾼다
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://mock');
    const send = (status, obj) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
    if (u.pathname === '/mock/naver-code') { uiNaver = u.searchParams.get('code') || 'n1'; send(200, { ok: true, code: uiNaver }); return; }
    if (u.pathname === '/oauth2.0/authorize') {
      if (u.searchParams.get('auth_type')) naverPrompts.push(u.searchParams.get('auth_type'));
      const back = new URL(u.searchParams.get('redirect_uri'));
      back.searchParams.set('code', uiNaver);
      back.searchParams.set('state', u.searchParams.get('state') || '');
      res.writeHead(302, { Location: back.href });
      res.end();
      return;
    }
    if (u.pathname === '/oauth2.0/token' && req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        const p = new URLSearchParams(body), grant = p.get('grant_type');
        if (p.get('client_id') !== NAVER_ID || p.get('client_secret') !== NAVER_SECRET) { send(200, { error: 'invalid_client', error_description: 'bad client' }); return; }
        if (grant === 'delete') {
          if (p.get('service_provider') !== 'NAVER' || !String(p.get('access_token')).startsWith('nat-')) { send(200, { error: 'invalid_request', error_description: 'bad token' }); return; }
          naverUnlinked.push(p.get('access_token').slice(4));
          send(200, { access_token: p.get('access_token'), result: 'success' });
          return;
        }
        if (grant !== 'authorization_code' || !p.get('state') || !naverOf(p.get('code'))) { send(200, { error: 'invalid_request', error_description: 'bad code' }); return; }
        send(200, { access_token: 'nat-' + p.get('code'), refresh_token: 'r', token_type: 'bearer', expires_in: '3600' });
      });
      return;
    }
    if (u.pathname === '/v1/nid/me') {
      const who = naverOf(String(req.headers.authorization || '').replace(/^Bearer nat-/, ''));
      if (!who) { send(401, { resultcode: '024', message: 'Authentication failed' }); return; }
      send(200, { resultcode: '00', message: 'success', response: who });
      return;
    }
    const bearer = String(req.headers.authorization || '').replace(/^Bearer at-/, '');
    if (u.pathname === '/oauth/authorize') {          // 동의 화면 없이 바로 돌려보낸다(화면 확인용)
      const back = new URL(u.searchParams.get('redirect_uri'));
      back.searchParams.set('code', 'ui1');
      back.searchParams.set('state', u.searchParams.get('state') || '');
      res.writeHead(302, { Location: back.href });
      res.end();
      return;
    }
    if (u.pathname === '/oauth/token' && req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        const p = new URLSearchParams(body), code = p.get('code');
        if (p.get('client_id') !== KEY || p.get('client_secret') !== SECRET || !idOf(code) || p.get('grant_type') !== 'authorization_code') { send(400, { error: 'invalid_grant' }); return; }
        send(200, { access_token: 'at-' + code, token_type: 'bearer' });
      });
      return;
    }
    if (u.pathname === '/v2/user/me') { const id = idOf(bearer); send(id ? 200 : 401, id ? { id } : { code: -401 }); return; }
    if (u.pathname === '/v1/user/unlink' && req.method === 'POST') { const id = idOf(bearer); if (id) unlinked.push(id); send(id ? 200 : 401, id ? { id } : { code: -401 }); return; }
    if (u.pathname.startsWith('/identity-verifications/')) {
      const id = decodeURIComponent(u.pathname.split('/').pop()).replace('case-', '');
      const okAuth = req.headers.authorization === 'PortOne test-secret';
      send(okAuth && identity[id] ? 200 : 404, okAuth && identity[id] ? identity[id] : { message: 'not found' });
      return;
    }
    send(404, { message: 'not found' });
  });
  await new Promise(done => server.listen(port, '127.0.0.1', done));
  return { server, unlinked, naverUnlinked, naverPrompts };
}

if (process.argv[1] && process.argv[1].endsWith('mock-kakao.mjs')) startMock(8798).then(() => console.log('가짜 카카오 8798'));

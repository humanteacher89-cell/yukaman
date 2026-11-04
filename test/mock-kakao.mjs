// 시험용 가짜 카카오 + 가짜 포트원(내 컴퓨터 전용). 서버의 .dev.vars가 이 주소를 보게 한다.
//   node test/mock-kakao.mjs   화면 확인할 때 혼자 띄운다(8798). test/api-test.mjs는 직접 불러 쓴다.
// 인가 코드 k1·k2…는 회원번호가 정해져 있고, ui로 시작하면 화면 확인용 회원이다. 그 밖의 코드는 카카오가 거절한다.
import http from 'node:http';

const KEY = 'test-key', SECRET = 'test-kakao-secret';
const idOf = code => ({ k1: 1001, k2: 1002, k3: 1003, k4: 1004 })[code] || (String(code).startsWith('ui') ? 2000 : 0);

export async function startMock(port, identity = {}) {
  const unlinked = [];
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://mock');
    const send = (status, obj) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
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
  return { server, unlinked };
}

if (process.argv[1] && process.argv[1].endsWith('mock-kakao.mjs')) startMock(8798).then(() => console.log('가짜 카카오 8798'));

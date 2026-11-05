// 육아맨 서비스 워커 — 홈 화면에 추가한 앱이 바로 열리게 하는 최소한의 것.
// 늘 인터넷에서 먼저 받고(고친 화면이 바로 보이게), 3초 안에 안 오거나 끊겼으면 저장해 둔 화면을 쓴다(검수 18). 서버 주소(/api)는 저장하지 않는다.
// 끊겨도 가이드·계산기·자료실은 볼 수 있게 미리 받아 둔다.
// CACHE 이름 규칙: 화면 파일(index.html·app.js·style.css·guide-data.js·official-data.js·calc.js·library.json)을 고쳐 올릴 때마다 숫자를 하나 올린다. 안 올리면 옛 화면이 한 번 더 보일 수 있다.
const CACHE = 'yukaman-v17';
const TIMEOUT = 3000;
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'calc.js', 'config.js', 'guide-data.js', 'official-data.js', 'law-data.js', 'sample-data.js', 'manifest.json', 'data/library.json', 'icons/logo.svg', 'icons/icon-192.png', 'icons/og.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== self.location.origin || /^\/api(\/|$)/.test(u.pathname)) return;
  const fromCache = () => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('./') : undefined));
  const net = fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  });
  const slow = new Promise(resolve => setTimeout(() => resolve('timeout'), TIMEOUT));
  e.respondWith(
    Promise.race([net, slow]).then(r => (r === 'timeout' ? fromCache().then(c => c || net) : r)).catch(() => fromCache().then(c => c || Response.error()))
  );
});

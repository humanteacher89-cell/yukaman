// PC 화면 시험(11-06 A안). public/을 정적 서버로 열면 화면이 시험 모드(이 기기 localStorage)로 돌아 운영 서버와 닿지 않는다.
//   node test/pc-test.mjs        크롬이 기본 자리에 없으면 환경 변수 CHROME에 경로를 준다. 크롬을 CDP로 몰아 메뉴 · 계산기 · 시트 · 글쓰기 · 창 크기를 눌러 본다.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 18790, DEBUG = 9340, URL_ = `http://127.0.0.1:${PORT}/index.html`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = http.createServer((q, a) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  if (p.startsWith('/api')) { a.writeHead(404, { 'Content-Type': 'text/html' }); a.end('no api'); return; }     // 화면이 시험 모드로 바뀐다
  const f = path.join(PUBLIC, p === '/' ? 'index.html' : p);
  fs.readFile(f, (e, b) => { if (e) { a.writeHead(404); a.end(); return; } a.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); a.end(b); });
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yk-pc-'));
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
let list = [];
for (let i = 0; i < 50 && !list.length; i++) { try { list = await (await fetch(`http://127.0.0.1:${DEBUG}/json/list`)).json(); } catch { /* 뜨는 중 */ } await sleep(200); }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
let id = 0; const wait = new Map(), errors = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && wait.has(m.id)) { const [ok, no] = wait.get(m.id); wait.delete(m.id); m.error ? no(new Error(JSON.stringify(m.error))) : ok(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
};
const send = (method, params = {}) => new Promise((ok, no) => { const i = ++id; wait.set(i, [ok, no]); ws.send(JSON.stringify({ id: i, method, params })); });
const q = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const viewport = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
// 해시만 바뀌면 다시 읽지 않으므로 빈 화면을 거친다
const open = async hash => { await send('Page.navigate', { url: 'about:blank' }); await sleep(40); await send('Page.navigate', { url: URL_ + hash }); for (let i = 0; i < 60; i++) { try { if (await q('document.readyState') === 'complete') break; } catch { /* 옮기는 중 */ } await sleep(100); } await sleep(500); };
let pass = 0, failed = 0;
const ok = (name, v) => { if (v) pass++; else { failed++; console.log('실패', name); } };

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setBypassServiceWorker', { bypass: true });
await viewport(1440, 900);
await open('');
// 로그인한 아빠 + 아이 날짜(이 기기 localStorage에만)
await q(`(() => {
  const S = window.YK_SAMPLE, at = h => new Date(Date.now() - (h || 0) * 3600e3).toISOString(), T = 'testtoken-pc-layout-0001';
  localStorage.setItem('yk.local', JSON.stringify({ v: 3, seq: { user: 200, post: 100, comment: 100 }, invites: [],
    users: S.users.map(u => ({ id: u.id, nick: u.nick + '/청주/25', created: at(u.h), token: null, verified: true })).concat([{ id: 101, nick: '시험아빠/청주/26', created: at(288), token: T, verified: true }]),
    posts: S.posts.map(p => ({ id: p.id, user_id: p.user_id, cat: p.cat, age: p.age || '', title: p.title, body: p.body, created: at(p.h), deleted: null })),
    comments: S.comments.map(c => ({ id: c.id, post_id: c.post_id, user_id: c.user_id, body: c.body, created: at(c.h), deleted: null })) }));
  localStorage.setItem('yk.token', JSON.stringify(T));
  localStorage.setItem('yk.me', JSON.stringify({ id: 101, nick: '시험아빠/청주/26', created: at(288), verified: true, role: 'user', terms: true }));
  localStorage.setItem('yk.calc', JSON.stringify({ job: 'worker', pay: 400, start: '2027-03-02', end: '2028-03-01', mode: 'both', spouseJob: 'worker', spouseMonths: 6, birth: '2026-10-20', due: '', kids: [{ birth: '2026-10-20', due: '' }], kid: 0 }));
})()`);
await open('#/');

// 틀과 홈
ok('왼쪽 메뉴', await q(`getComputedStyle(document.querySelector('#side')).display !== 'none'`));
ok('아래 탭 숨음', await q(`getComputedStyle(document.querySelector('#tabbar')).display === 'none'`));
ok('지금 챙길 것 7개', await q(`[...document.querySelectorAll('.tli')].filter(x => !x.hidden).length === 7 && !document.querySelector('#tlMore')`));
ok('아이 칸이 제목 띠 안에', await q(`!!document.querySelector('.phead .kidseg') && !!document.querySelector('.phead #kidAdd')`));
// 메뉴
await q(`[...document.querySelectorAll('#side .sv')].find(x => x.textContent.includes('심리')).click()`); await sleep(300);
ok('메뉴 → 심리', (await q('location.hash')) === '#/guide/mind' && await q(`document.querySelector('#side .sv.on').textContent.includes('심리')`));
await q(`[...document.querySelectorAll('#side .nv')].find(x => x.textContent.includes('커뮤니티')).click()`); await sleep(500);
ok('커뮤니티 분류 8칸', await q(`document.querySelectorAll('#side .subs .sv').length === 8`));
await q(`[...document.querySelectorAll('#side .sv')].find(x => x.textContent.includes('질문')).click()`); await sleep(500);
ok('분류 거르기', await q(`(() => { const b = [...document.querySelectorAll('#list .badge')]; return b.length > 0 && b.every(x => x.textContent.includes('질문')); })()`));
ok('오른쪽 뜨는 글', await q(`document.querySelectorAll('#railHot .hotrow').length > 0`));
ok('오른쪽 계급', await q(`!!document.querySelector('#railRank .rkhead')`));
ok('본문에 뜨는 글 중복 없음', await q(`document.querySelector('#hotBox').innerHTML === ''`));
ok('메뉴에 계급', await q(`document.querySelector('.meb').textContent.includes('이병')`));
// 계산기: 일반과 6+6을 나란히(월 통상임금 400만원, 12개월)
await q(`location.hash = '#/calc/leave'`); await sleep(500);
const cards = () => q(`[...document.querySelectorAll('.rescard strong')].map(x => x.textContent)`);
const n = await cards();
ok('일반 2,310만원 · 6+6 2,910만원', n[0] === '2,310만원' && n[1] === '2,910만원');
ok('차액 +600만원', await q(`document.querySelector('.rescard .up').textContent === '+600만원'`));
ok('달마다 줄: 3개월째 6+6 300만원', await q(`[...document.querySelectorAll('.calctbl.twoc tr')].some(r => r.textContent.startsWith('3개월째') && r.querySelector('td.up') && r.querySelector('td.up').textContent.startsWith('월 300만원'))`));
ok('챙길 날짜가 오른쪽 칸에', await q(`document.querySelector('#railCalc .rdates').textContent.includes('2027.01.31') && !document.querySelector('#calcOut .rdates')`));
await q(`document.querySelector('[data-pick-mode=general]').click()`); await sleep(200);
ok('칸을 누르면 상황이 바뀜', await q(`document.querySelector('#cMode .on').dataset.m === 'general'`));
ok('다시 그려도 오른쪽 칸 하나씩', await q(`document.querySelectorAll('#railCalc .rdates').length === 1 && document.querySelectorAll('#railCalc .rbox').length === 1`));
await q(`document.querySelector('[data-pick-mode=both]').click()`); await sleep(200);
await q(`(() => { const i = document.querySelector('#cBirth'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(200);
ok('아이 날짜 없으면 6+6 금액 없음', await q(`!!document.querySelector('.rescard strong.none') && document.querySelector('#bothMore').open`));
await q(`(() => { const i = document.querySelector('#cBirth'); i.value = '2026-10-20'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(200);
// 시트는 가운데 창
await q(`location.hash = '#/'`); await sleep(400);
await q(`document.querySelector('#kidEdit').click()`); await sleep(300);
ok('시트가 가운데', await q(`(() => { const b = document.querySelector('#sheet .sheet').getBoundingClientRect(); return Math.abs((b.left + b.right) / 2 - innerWidth / 2) < 2 && b.bottom < innerHeight - 10; })()`));
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(150);
ok('Esc로 닫힘', await q(`document.querySelector('#sheet').hidden`));
// 글쓰기 · 댓글
await q(`document.querySelector('#side .wbtn').click()`); await sleep(300);
ok('글쓰기는 오른쪽 칸 없음', (await q('location.hash')) === '#/write' && await q(`document.querySelector('#rail').hidden`));
await q(`document.querySelector('[data-tpl=free]').click()`); await sleep(200);
await q(`(() => { const set = (s, v) => { const i = document.querySelector(s); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }; document.querySelector('#catpick [data-pick=tip]').click(); set('#wtitle', 'PC에서 쓴 시험 글입니다'); set('#wbody', 'PC 화면 시험 내용입니다.'); document.querySelector('#wform button[type=submit]').click(); })()`); await sleep(700);
ok('글 올리기', /^#\/p\/\d+/.test(await q('location.hash')));
await q(`(() => { const t = document.querySelector('#cbody'); t.value = 'PC 댓글 시험'; t.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#composer button[type=submit]').click(); })()`); await sleep(500);
ok('댓글 달림', await q(`document.querySelector('#cmts').textContent.includes('PC 댓글 시험')`));
ok('댓글 칸이 본문 안', await q(`(() => { const b = document.querySelector('#composer').getBoundingClientRect(); return b.left >= 252 && b.right <= innerWidth - 336 + 1; })()`));
// MY: 계정 칸이 오른쪽으로 옮겨도 단추가 듣는다
await q(`location.hash = '#/me'`); await sleep(500);
ok('MY 계정 칸이 오른쪽에', await q(`!!document.querySelector('#rail #meSide #themeBox') && !document.querySelector('#view #themeBox')`));
await q(`document.querySelector('#themeBox [data-theme-pick=dark]').click()`); await sleep(150);
ok('화면 밝기 단추', await q(`document.documentElement.dataset.theme === 'dark'`));
await q(`document.querySelector('#themeBox [data-theme-pick=auto]').click()`); await sleep(100);
// 창 크기
await q(`location.hash = '#/calc/leave'`); await sleep(400);
await viewport(1200, 800); await sleep(500);
ok('1200폭: 오른쪽 칸 숨고 날짜는 본문으로', await q(`document.querySelector('#rail').hidden && !!document.querySelector('#calcOut .rdates')`));
await viewport(900, 800); await sleep(500);
ok('900폭: 폰 화면(메뉴 없음, 탭 있음, 나란히 칸 없음)', await q(`document.querySelector('#side').hidden && getComputedStyle(document.querySelector('#tabbar')).display !== 'none' && !document.querySelector('.rescard')`));
await viewport(1440, 900); await sleep(500);
ok('1440폭으로 돌아옴', await q(`!document.querySelector('#side').hidden && !!document.querySelector('.rescard') && !!document.querySelector('#railCalc .rdates')`));
// 폭마다 가로 넘침 없음
for (const w of [1100, 1280, 1366, 1440, 1920]) {
  await viewport(w, 900); await sleep(300);
  for (const h of ['#/', '#/guide/leave', '#/calc/leave', '#/community', '#/me']) { await q(`location.hash = '${h}'`); await sleep(350); ok(`${w}폭 ${h} 가로 넘침 없음`, await q('document.documentElement.scrollWidth <= innerWidth')); }
}
ok('화면 오류 없음', errors.length === 0);
if (errors.length) console.log([...new Set(errors)].slice(0, 5));

console.log(`통과 ${pass} 건, 실패 ${failed} 건`);
try { await send('Browser.close'); } catch { /* 닫힘 */ }
proc.kill(); server.close();
await sleep(300);
fs.rmSync(dir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);

/* 육아맨 화면(2026-11-04, 앱개발부).
   해시 주소: #/ 홈 · #/guide[/<분류>] 아빠 가이드 · #/g/<id> 가이드 글 · #/calc[/<종류>] 계산기 · #/library 자료실
              #/community[/<분류>] 커뮤니티 · #/p/<번호> 글 · #/write 글쓰기 · #/me MY · #/join/<코드> 초대 · #/admin 관리자
   커뮤니티 글·댓글·인증: 서버(/api, server/app.js)가 있으면 서버에, 없으면(정적 서버·파일로 열기) 시험 모드 — 견본 글(sample-data.js) + 이 기기(localStorage)에만.
   가이드 글: guide-data.js · 자료실: data/library.json · 계산: calc.js(법령 기준, test/calc-test.js). 사진·영상 없음 — 줄글 + 댓글만, 검색 됨(11-04 휴먼쌤).
   아빠 인증: 읽기는 누구나, 글·댓글은 인증 아빠만. 초대 코드(바로) 또는 신청서(관리자 승인). 서류·아이 정보는 받지 않는다. */
(function () {
  'use strict';
  const CFG = window.YK_CONFIG || {};
  const GD = window.YK_GUIDES || { cats: [], items: [] };
  const K = window.YK_CALC;
  const CATS = [
    { key: 'question', name: '질문·고민', e: '🙋' },
    { key: 'tip', name: '정보·꿀팁', e: '💡' },
    { key: 'daily', name: '일상·자랑', e: '🎉' },
    { key: 'leave', name: '육아휴직·제도', e: '📋' },
    { key: 'play', name: '놀이·나들이', e: '⚽' },
    { key: 'gear', name: '용품·장비', e: '🍼' }
  ];
  const CAT = {}; CATS.forEach(c => { CAT[c.key] = c; });
  const GCAT = {}; GD.cats.forEach(c => { GCAT[c.key] = c; });
  const LIM = { nick: [2, 12], title: [2, 60], body: [1, 3000], comment: [1, 1000], answer: [20, 500] };   // server/app.js LIM과 같게
  const PAGE = 20;
  const RESERVED = /(육아맨|운영자|관리자|자료실|공식|admin|official)/i;
  const MSG = {
    login: '닉네임을 먼저 정해 주세요', unknown_user: '이 기기의 닉네임 기록이 없어요. 다시 정해 주세요',
    nick_taken: '이미 쓰는 닉네임이에요', nick_len: '닉네임은 2~12자로 해 주세요', nick_chars: '닉네임은 한글·영문·숫자만 쓸 수 있어요', nick_reserved: '운영 계정과 헷갈리는 이름은 쓸 수 없어요',
    limit: '너무 자주 했어요. 잠시 뒤에 다시 해 주세요', title_len: '제목은 2~60자로 해 주세요', body_len: '내용을 적어 주세요(3000자까지)',
    comment_len: '댓글은 1~1000자로 해 주세요', cat: '분류를 골라 주세요', not_found: '글을 찾을 수 없어요(지워졌을 수 있어요)',
    forbidden: '내가 쓴 것만 지울 수 있어요', bad_json: '보낼 내용이 잘못됐어요', server: '서버에 문제가 있어요. 잠시 뒤 다시 해 주세요', network: '인터넷 연결을 확인해 주세요',
    verify: '글과 댓글은 인증한 아빠만 쓸 수 있어요', blocked: '이용이 제한된 계정이에요',
    code_bad: '맞지 않는 초대 코드예요', code_used: '이미 쓴 초대 코드예요', stage: '지금 상황을 골라 주세요', answer_len: '이야기는 20자 이상으로 적어 주세요', pledge: '약속에 체크해 주세요', invite_max: '초대 코드는 3개까지 만들 수 있어요'
  };

  // ----- 도구 -----
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.prototype.slice.call((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const rich = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const len = s => Array.from(String(s || '')).length;
  const fmtNum = n => Number(n || 0).toLocaleString('ko-KR');
  // 1,684,210 → '168만 4,210원' / 25,000,000 → '2,500만원'
  function won(n) {
    n = Math.round(n || 0);
    const sign = n < 0 ? '-' : ''; n = Math.abs(n);
    if (n < 10000) return sign + fmtNum(n) + '원';
    const man = Math.floor(n / 10000), rest = n % 10000;
    return sign + fmtNum(man) + '만' + (rest ? ' ' + fmtNum(rest) : '') + '원';
  }
  const dot = s => (s ? String(s).replace(/-/g, '.') : '');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('yk.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('yk.' + k, JSON.stringify(v)); } catch (e) { /* 비공개 창 등 */ } },
    del(k) { try { localStorage.removeItem('yk.' + k); } catch (e) { /* 무시 */ } }
  };
  function ago(iso) {
    const t = new Date(iso).getTime(); if (!t) return '';
    const d = Date.now() - t;
    if (d < 60e3) return '방금';
    if (d < 3600e3) return Math.floor(d / 60e3) + '분 전';
    if (d < 86400e3) return Math.floor(d / 3600e3) + '시간 전';
    if (d < 7 * 86400e3) return Math.floor(d / 86400e3) + '일 전';
    const dt = new Date(t);
    return (dt.getFullYear() !== new Date().getFullYear() ? dt.getFullYear() + '.' : '') + (dt.getMonth() + 1) + '.' + dt.getDate();
  }
  function ymd(iso) { const dt = new Date(iso); if (!dt.getTime()) return ''; return dt.getFullYear() + '.' + String(dt.getMonth() + 1).padStart(2, '0') + '.' + String(dt.getDate()).padStart(2, '0'); }
  const first = s => Array.from(String(s || '?'))[0] || '?';
  const CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.7 11.5 12.5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const vbadge = b => (b === 'official' ? '<span class="vb of">자료</span>' : b === 'dad' ? '<span class="vb" title="인증 아빠" aria-label="인증 아빠">' + CHECK + '</span>' : '');
  const avatar = nick => '<span class="avatar">' + esc(first(nick)) + '</span>';
  const who = (nick, badge) => '<span class="nick">' + avatar(nick) + esc(nick) + vbadge(badge) + '</span>';
  const nickKey = s => String(s).replace(/\s+/g, '').toLowerCase();
  const clean = (s, n) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim().slice(0, n);
  function checkNick(nick) { const n = len(nick); if (n < LIM.nick[0] || n > LIM.nick[1]) return 'nick_len'; if (!/^[가-힣A-Za-z0-9 _.]+$/.test(nick)) return 'nick_chars'; if (RESERVED.test(nick.replace(/\s+/g, ''))) return 'nick_reserved'; return ''; }
  function checkPost(p) { if (!CAT[p.cat]) return 'cat'; const t = len(p.title), b = len(p.body); if (t < LIM.title[0] || t > LIM.title[1]) return 'title_len'; if (b < LIM.body[0] || b > LIM.body[1]) return 'body_len'; return ''; }
  const ICON = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M4 12 20 4l-4 16-4-7z"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>'
  };
  const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#2563EB"/><circle cx="25" cy="23" r="9.5" fill="#fff"/><path d="M9 51c0-9.5 7.2-16 16-16s16 6.5 16 16z" fill="#fff"/><circle cx="46" cy="33" r="6.5" fill="#FFD166"/><path d="M35 51c0-6.5 4.9-11 11-11s11 4.5 11 11z" fill="#FFD166"/></svg>';

  // ----- 나(닉네임 + 기기 토큰) -----
  function randomToken() { const a = new Uint8Array(24); crypto.getRandomValues(a); let s = ''; a.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function token() { let t = store.get('token'); if (!t || !/^[A-Za-z0-9_-]{16,80}$/.test(t)) { t = randomToken(); store.set('token', t); } return t; }
  let me = store.get('me', null);
  function setMe(u) { me = u ? { id: u.id, nick: u.nick, created: u.created, verified: !!u.verified, role: u.role || 'user', how: u.how || '', blocked: !!u.blocked } : null; if (me) store.set('me', me); else store.del('me'); }
  const canWrite = () => me && !me.blocked && (me.verified || me.role === 'admin');
  const pub = u => ({ id: u.id, nick: u.nick, created: u.created, verified: !!u.verified, role: 'user', how: u.how || '', blocked: false });
  let pendingInvite = '';

  // ----- 서버 / 시험 모드 -----
  function ApiError(code, status) { this.name = 'ApiError'; this.code = code; this.status = status || 400; this.message = code; }
  ApiError.prototype = Object.create(Error.prototype);
  let mode = (!CFG.API_URL || location.protocol === 'file:') ? 'local' : 'server';

  function qs(p) { const u = new URLSearchParams(); Object.keys(p || {}).forEach(k => { if (p[k] !== '' && p[k] != null && p[k] !== false) u.set(k, p[k]); }); const s = u.toString(); return s ? '?' + s : ''; }
  const remote = {
    async call(method, path, body) {
      const headers = { Authorization: 'Bearer ' + token() };
      if (body) headers['Content-Type'] = 'application/json';
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
      let res;
      try { res = await fetch(CFG.API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal, cache: 'no-store' }); }
      finally { clearTimeout(tm); }
      const ct = res.headers.get('Content-Type') || '';
      if (ct.indexOf('application/json') < 0) throw new ApiError('no_api', res.status);
      const data = await res.json();
      if (!data || !data.ok) throw new ApiError((data && data.error) || 'server', res.status);
      return data;
    },
    listPosts: p => remote.call('GET', '/posts' + qs(p)),
    getPost: id => remote.call('GET', '/posts/' + id),
    join: (nick, invite) => remote.call('POST', '/join', { nick, invite }),
    me: () => remote.call('GET', '/me'),
    rename: nick => remote.call('PATCH', '/me', { nick }),
    createPost: p => remote.call('POST', '/posts', p),
    deletePost: id => remote.call('DELETE', '/posts/' + id),
    addComment: (id, body) => remote.call('POST', '/posts/' + id + '/comments', { body }),
    deleteComment: id => remote.call('DELETE', '/comments/' + id),
    verifyCode: code => remote.call('POST', '/verify/code', { code }),
    verifyApply: b => remote.call('POST', '/verify/apply', b),
    createInvite: () => remote.call('POST', '/invites', {}),
    adminQueue: () => remote.call('GET', '/admin/queue'),
    adminDecide: (id, approve) => remote.call('POST', '/admin/decide', { id, approve }),
    adminUser: (user_id, action) => remote.call('POST', '/admin/user', { user_id, action }),
    adminInvites: (count, note) => remote.call('POST', '/admin/invites', { count, note })
  };

  // 시험 모드: 견본 글 + 이 기기(localStorage). 서버와 같은 응답 꼴. 코드는 아무 글자나, 신청서는 바로 승인된다.
  const local = {
    db: null,
    load() { if (this.db) return this.db; let d = store.get('local'); if (!d || d.v !== 2) d = this.seed(); this.db = d; return d; },
    seed() {
      const S = window.YK_SAMPLE || { users: [], posts: [], comments: [] };
      const at = h => new Date(Date.now() - (h || 0) * 3600e3).toISOString();
      const d = { v: 2, seq: { user: 100, post: 100, comment: 100 }, invites: [],
        users: S.users.map(u => ({ id: u.id, nick: u.nick, created: at(u.h), token: null, verified: true })),
        posts: S.posts.map(p => ({ id: p.id, user_id: p.user_id, cat: p.cat, title: p.title, body: p.body, created: at(p.h), deleted: null })),
        comments: S.comments.map(c => ({ id: c.id, post_id: c.post_id, user_id: c.user_id, body: c.body, created: at(c.h), deleted: null })) };
      store.set('local', d); return d;
    },
    save() { store.set('local', this.db); },
    u(uid) { return this.db.users.find(x => x.id === uid) || { nick: '?' }; },
    badge(uid) { return this.u(uid).verified ? 'dad' : ''; },
    user() { return this.load().users.find(u => u.token && u.token === token()) || null; },
    need() { const u = this.user(); if (!u) throw new ApiError('login', 401); return u; },
    needDad() { const u = this.need(); if (!u.verified) throw new ApiError('verify', 403); return u; },
    card(p) { const d = this.db; return { id: p.id, cat: p.cat, title: p.title, preview: p.body.slice(0, 140), created: p.created, comments: d.comments.filter(c => c.post_id === p.id && !c.deleted).length, nick: this.u(p.user_id).nick, uid: p.user_id, badge: this.badge(p.user_id) }; },
    async listPosts(p) {
      const d = this.load(), limit = p.limit || PAGE, words = String(p.q || '').toLowerCase().split(/\s+/).filter(Boolean);
      let rows = d.posts.filter(x => { if (x.deleted || (p.cat && x.cat !== p.cat) || (p.before && x.id >= p.before)) return false; const hay = (x.title + '\n' + x.body).toLowerCase(); return words.every(w => hay.indexOf(w) >= 0); }).sort((a, b) => b.id - a.id);
      const more = rows.length > limit; rows = rows.slice(0, limit);
      return { ok: true, posts: rows.map(x => this.card(x)), next: more ? rows[rows.length - 1].id : null };
    },
    async getPost(id) {
      const d = this.load(); const p = d.posts.find(x => x.id === id && !x.deleted); if (!p) throw new ApiError('not_found', 404);
      const post = this.card(p); post.body = p.body;
      return { ok: true, post, comments: d.comments.filter(c => c.post_id === id && !c.deleted).map(c => ({ id: c.id, body: c.body, created: c.created, nick: this.u(c.user_id).nick, uid: c.user_id, badge: this.badge(c.user_id) })) };
    },
    async join(nick, invite) {
      const d = this.load(); const have = this.user(); if (have) return { ok: true, user: pub(have), existing: true };
      const bad = checkNick(nick); if (bad) throw new ApiError(bad);
      if (d.users.some(u => nickKey(u.nick) === nickKey(nick))) throw new ApiError('nick_taken', 409);
      const u = { id: d.seq.user++, nick, created: new Date().toISOString(), token: token(), verified: !!invite, how: invite ? 'invite' : '' }; d.users.push(u); this.save();
      return { ok: true, user: pub(u) };
    },
    async me() {
      const u = this.need(); const d = this.db;
      return { ok: true, user: pub(u), application: null, invites: d.invites, invite_max: 3,
        posts: d.posts.filter(p => p.user_id === u.id && !p.deleted).sort((a, b) => b.id - a.id).map(p => this.card(p)),
        comments: d.comments.filter(c => c.user_id === u.id && !c.deleted).sort((a, b) => b.id - a.id)
          .map(c => { const p = d.posts.find(x => x.id === c.post_id && !x.deleted); return p ? { id: c.id, body: c.body, created: c.created, post_id: c.post_id, post_title: p.title } : null; }).filter(Boolean) };
    },
    async rename(nick) { const u = this.need(); const bad = checkNick(nick); if (bad) throw new ApiError(bad); if (this.db.users.some(x => x.id !== u.id && nickKey(x.nick) === nickKey(nick))) throw new ApiError('nick_taken', 409); u.nick = nick; this.save(); return { ok: true, user: pub(u) }; },
    async createPost(p) {
      const u = this.needDad(); const bad = checkPost(p); if (bad) throw new ApiError(bad); const d = this.db;
      const post = { id: d.seq.post++, user_id: u.id, cat: p.cat, title: p.title, body: p.body, created: new Date().toISOString(), deleted: null }; d.posts.push(post); this.save();
      const c = this.card(post); c.body = post.body; return { ok: true, id: post.id, post: c };
    },
    async deletePost(id) { const u = this.need(); const p = this.db.posts.find(x => x.id === id && !x.deleted); if (!p) throw new ApiError('not_found', 404); if (p.user_id !== u.id) throw new ApiError('forbidden', 403); p.deleted = new Date().toISOString(); this.save(); return { ok: true }; },
    async addComment(id, body) {
      const u = this.needDad(); body = clean(body, 2000); if (len(body) < 1 || len(body) > LIM.comment[1]) throw new ApiError('comment_len');
      const d = this.db; if (!d.posts.find(x => x.id === id && !x.deleted)) throw new ApiError('not_found', 404);
      const c = { id: d.seq.comment++, post_id: id, user_id: u.id, body, created: new Date().toISOString(), deleted: null }; d.comments.push(c); this.save();
      return { ok: true, comment: { id: c.id, body, created: c.created, nick: u.nick, uid: u.id, badge: 'dad' } };
    },
    async deleteComment(id) { const u = this.need(); const c = this.db.comments.find(x => x.id === id && !x.deleted); if (!c) throw new ApiError('not_found', 404); if (c.user_id !== u.id) throw new ApiError('forbidden', 403); c.deleted = new Date().toISOString(); this.save(); return { ok: true }; },
    async verifyCode(code) { const u = this.need(); if (String(code || '').replace(/[^A-Za-z0-9]/g, '').length < 4) throw new ApiError('code_bad'); u.verified = true; u.how = 'invite'; this.save(); return { ok: true, user: pub(u) }; },
    async verifyApply() { const u = this.need(); u.verified = true; u.how = 'apply'; this.save(); return { ok: true, user: pub(u), instant: true }; },
    async createInvite() { this.needDad(); const d = this.db; if (d.invites.length >= 3) throw new ApiError('invite_max'); const c = { code: 'TEST-' + String(1000 + d.invites.length), used: false }; d.invites.push(c); this.save(); return { ok: true, invite: c }; }
  };

  async function api(name) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (mode === 'local') { if (!local[name]) throw new ApiError('server'); return local[name].apply(local, args); }
    try { return await remote[name].apply(remote, args); }
    catch (e) { if (e && e.code === 'no_api') { setMode('local'); if (!local[name]) throw new ApiError('server'); return local[name].apply(local, args); } throw e; }
  }
  function setMode(m) { if (mode === m) return; mode = m; if (m === 'local') { const u = local.user(); setMe(u ? pub(u) : null); } }

  // ----- 알림 -----
  let toastTimer = 0;
  function toast(msg, kind) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (kind ? ' ' + kind : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, 2600); }
  function fail(e, after) {
    let code = 'server';
    if (e && e.name === 'ApiError') code = e.code; else if (e && (e.name === 'AbortError' || e.name === 'TypeError')) code = 'network';
    if (code === 'unknown_user') { setMe(null); toast(MSG.unknown_user, 'err'); openSheet(after); return; }
    if (code === 'login') { openSheet(after); return; }
    if (code === 'verify') { if (me) { me.verified = false; store.set('me', me); } openVerify(after); return; }
    toast(MSG[code] || MSG.server, 'err');
    if (window.console && code === 'server') console.warn('yukaman', e);
  }
  const errText = e => { const code = e && e.code; return MSG[code] || (e && e.name === 'TypeError' ? MSG.network : MSG.server); };
  const empty = (title, sub) => '<div class="empty"><div class="big">🍼</div>' + esc(title) + (sub ? '<br><span style="font-weight:600;font-size:13px">' + esc(sub) + '</span>' : '') + '</div>';
  const mockBadge = () => '<div class="mock" id="mockBadge"><span>🧪</span><span>시험 모드예요. 커뮤니티 글은 지어낸 견본이고, 쓴 글은 이 기기에만 저장돼요.</span></div>';

  // ----- 화면 틀 -----
  const view = $('#view'), appbar = $('#appbar'), app = $('#app'), fab = $('#fab');
  const bar = h => { appbar.innerHTML = h; };
  const brandBar = (right) => '<div class="brand"><span class="logo">' + LOGO + '</span><span>육아맨</span></div><div class="fill"></div>' + (right || '');
  const backBtn = to => '<button class="circ" data-back="' + esc(to) + '" aria-label="뒤로">' + ICON.back + '</button>';
  function setTab(name) { $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name)); }
  function go(h, replace) { if (replace) location.replace(h); else location.hash = h; }
  let navDepth = 0;
  function back(to) { if (navDepth > 0 && history.length > 1) { navDepth -= 2; history.back(); } else go(to); }

  function parse() {
    const s = location.hash.replace(/^#\/?/, '').split('/').map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } });
    if (s[0] === 'guide') return { name: 'guide', cat: s[1] && GCAT[s[1]] ? s[1] : (GD.cats[0] ? GD.cats[0].key : '') };
    if (s[0] === 'g' && s[1]) return { name: 'garticle', id: s[1] };
    if (s[0] === 'calc') return { name: 'calc', tab: CALC_TABS.some(t => t.key === s[1]) ? s[1] : 'leave' };
    if (s[0] === 'library') return { name: 'library' };
    if (s[0] === 'community') return { name: 'community', cat: s[1] && CAT[s[1]] ? s[1] : '' };
    if (s[0] === 'p' && /^\d+$/.test(s[1] || '')) return { name: 'post', id: +s[1] };
    if (s[0] === 'write') return { name: 'write' };
    if (s[0] === 'me') return { name: 'me' };
    if (s[0] === 'join') return { name: 'join', code: s[1] || '' };
    if (s[0] === 'admin') return { name: 'admin' };
    return { name: 'home' };
  }
  async function render() {
    const r = parse();
    closeSheet(); app.classList.remove('notab', 'composing'); fab.hidden = true;
    try {
      if (r.name === 'home') await renderHome();
      else if (r.name === 'guide') renderGuide(r.cat);
      else if (r.name === 'garticle') renderGuideItem(r.id);
      else if (r.name === 'calc') renderCalc(r.tab);
      else if (r.name === 'library') await renderLibrary();
      else if (r.name === 'community') await renderCommunity(r.cat);
      else if (r.name === 'post') await renderPost(r.id);
      else if (r.name === 'write') renderWrite();
      else if (r.name === 'me') await renderMe();
      else if (r.name === 'admin') await renderAdmin();
      else if (r.name === 'join') { pendingInvite = r.code; go('#/me', true); }
    } catch (e) { fail(e); }
  }
  window.addEventListener('hashchange', () => { navDepth++; render(); });

  // ----- 계산기 공통 상태(이 기기에만 저장) -----
  const CALC_TABS = [
    { key: 'leave', name: '육아휴직 급여', e: '💰' },
    { key: 'reduce', name: '단축근무 급여', e: '⏰' },
    { key: 'paternity', name: '배우자 출산휴가', e: '🏥' },
    { key: 'dates', name: '내 아이 날짜', e: '📅' }
  ];
  function nextFirst() { const d = new Date(); const t = new Date(d.getFullYear(), d.getMonth() + 1, 1); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-01'; }
  const calcS = Object.assign({ pay: 350, start: nextFirst(), months: 12, end: '', mode: 'general', spouseMonths: 6, spousePay: '', company: '', birth: '', due: '', before: 40, after: 30, rMonths: 12, priority: true, days: 20 }, store.get('calc', {}));
  if (!K.parse(calcS.start)) calcS.start = nextFirst();
  if (!K.parse(calcS.end)) calcS.end = K.addDays(K.addMonths(calcS.start, 12), -1);
  const saveCalc = () => store.set('calc', calcS);
  const toWon = v => Math.round((parseFloat(v) || 0) * 10000);

  // 홈·가이드의 계산기 카드: 월급만 넣으면 바로 계산된다(일반 12개월). 자세히는 #/calc/leave
  function quickCalc(man) { const s = '2027-01-01'; return K.leaveBenefit({ ordinary: toWon(man), start: s, end: K.addDays(K.addMonths(s, 12), -1) }); }
  // 달마다 받는 돈을 함께 보여 준다. 월 250만원을 넘으면 상한에 걸려 총액이 같으니, 고장처럼 보이지 않게 까닭을 적는다
  function quickNote(man) {
    const r = quickCalc(man), m = [r.rows[0].paid, r.rows[3].paid, r.rows[6].paid];
    return '1~3개월 월 ' + won(m[0]) + ' · 4~6개월 월 ' + won(m[1]) + ' · 7개월부터 월 ' + won(m[2]) + (toWon(man) >= 2500000 ? '<br>법정 상한에 걸려 월급이 더 많아도 금액이 같아요.' : '');
  }
  function calcCard() {
    return '<div class="gcalc" id="qcalc"><div class="top"><b>💰 육아휴직 급여 계산기</b><a class="fold" href="#/calc/leave">자세히</a></div>'
      + '<div class="big"><label class="qpay">내 월 통상임금 <input id="qPay" type="number" inputmode="decimal" min="0" max="3000" step="10" value="' + esc(calcS.pay) + '" aria-label="월 통상임금(만원)"> 만원</label>'
      + '<strong id="qTotal">' + won(quickCalc(calcS.pay).total) + '</strong><em>12개월 쉬면 받는 돈(일반 기준)</em><small class="qnote" id="qNote">' + quickNote(calcS.pay) + '</small></div></div>';
  }
  function bindCalcCard() {
    const p = $('#qPay'); if (!p) return;
    p.addEventListener('input', () => { calcS.pay = parseFloat(p.value) || 0; saveCalc(); $('#qTotal').textContent = won(quickCalc(calcS.pay).total); $('#qNote').innerHTML = quickNote(calcS.pay); });
  }

  // ----- 홈 -----
  async function renderHome() {
    setTab('home');
    bar(brandBar());
    view.innerHTML = '<section class="pad"><div class="loading">불러오는 중…</div></section>';
    let posts = [], err = null;
    try { posts = (await api('listPosts', { limit: 4 })).posts; } catch (e) { err = e; }
    const feat = GD.items.filter(g => g.home).slice(0, 3);
    view.innerHTML = '<section class="pad">'
      + '<div class="hero"><p class="hi">' + (me ? esc(me.nick) + '님, 안녕하세요' : '육아하는 아빠들의 동네') + '</p><h1>서로 묻고, 알려 주고,<br>자랑하는 곳</h1><p>아빠 가이드로 제도를 챙기고,<br>커뮤니티에서 아빠끼리 솔직하게.</p><div class="mascot">' + LOGO + '</div></div>'
      + (mode === 'local' ? mockBadge() : '')
      + '<div class="sec"><h2>아빠 가이드</h2><a class="all" href="#/guide">전체 보기 →</a></div>'
      + calcCard()
      + '<div class="glist" style="margin-top:8px">' + feat.map(grow).join('') + '<a class="grow" href="#/library"><span class="ge">🗂️</span><span class="tx"><b>남성 육아휴직 자료실</b><small>법령 · 통계 · 연구 · 판례 · 경험담을 키워드로</small></span></a></div>'
      + '<div class="sec"><h2>커뮤니티 새 글</h2><a class="all" href="#/community">전체 보기 →</a></div>'
      + '<div class="list" id="homeList">' + (err ? empty('글을 못 불러왔어요', '잠시 뒤 다시 열어 주세요') : (posts.length ? posts.map(pcard).join('') : empty('아직 글이 없어요', '첫 글을 써 보세요!'))) + '</div>'
      + '<p class="foot-note">육아맨 ' + esc(CFG.VERSION || '') + ' · 사진·영상 없이 줄글로 · 인증한 아빠끼리</p>'
      + '</section>';
    window.scrollTo(0, 0);
    bindCalcCard();
    if (err) fail(err);
  }

  // ----- 아빠 가이드 -----
  const tagCls = t => t === 'NEW' ? 'new' : t === '인기' ? 'hot' : t === '필수' ? '' : 'gray';
  function grow(g) {
    return '<a class="grow" href="#/g/' + esc(g.id) + '"><span class="ge">' + esc(g.e) + '</span><span class="tx"><b>' + esc(g.title) + '</b><small>' + esc(g.sub) + '</small></span>'
      + (g.tag ? '<span class="tag ' + tagCls(g.tag) + '">' + esc(g.tag) + '</span>' : '') + '</a>';
  }
  function guideChips(cur) {
    return '<div class="chips">' + GD.cats.map(c => '<a class="chip' + (c.key === cur ? ' on' : '') + '" href="#/guide/' + c.key + '"><span class="e">' + c.e + '</span>' + esc(c.name) + '</a>').join('')
      + '<a class="chip' + (cur === 'library' ? ' on' : '') + '" href="#/library"><span class="e">🗂️</span>자료실</a></div>';
  }
  function renderGuide(cat) {
    setTab('guide');
    bar(brandBar());
    const items = GD.items.filter(g => g.cat === cat);
    view.innerHTML = '<section class="pad">'
      + '<h1 class="htitle">아빠 가이드 📚</h1><p class="hsub">아빠 육아의 모든 것, 한 곳에</p>'
      + guideChips(cat)
      + (cat === 'leave' ? calcCard() + '<a class="grow" href="#/calc" style="margin-top:8px"><span class="ge">🧮</span><span class="tx"><b>계산기 모음</b><small>육아휴직 · 단축근무 · 배우자 출산휴가 · 내 아이 날짜</small></span></a>' : '')
      + '<div class="glist">' + (items.length ? items.map(grow).join('') : empty('준비 중이에요', '곧 글이 올라와요')) + '</div>'
      + '<div class="draft"><span>📌</span><span>제도·금액은 ' + esc(K.RULES.checkedAt.replace(/-/g, '.')) + ' 법령 원문 기준이에요. 내 경우는 고용노동부 1350이나 고용센터에서 확인해 주세요.</span></div>'
      + '</section>';
    window.scrollTo(0, 0);
    bindCalcCard();
  }
  function blocks(b) {
    return (b || []).map(x => x.h ? '<h2>' + esc(x.h) + '</h2>' : x.p ? '<p>' + rich(x.p) + '</p>'
      : x.ul ? '<ul>' + x.ul.map(i => '<li>' + rich(i) + '</li>').join('') + '</ul>' : x.ol ? '<ol>' + x.ol.map(i => '<li>' + rich(i) + '</li>').join('') + '</ol>'
      : x.tip ? '<div class="tipbox">💡 ' + rich(x.tip) + '</div>' : x.tpl ? '<pre class="tpl">' + esc(x.tpl) + '</pre>'
      : x.go ? '<a class="btn primary golink" href="' + esc(x.go) + '">' + esc(x.t) + '</a>' : '').join('');
  }
  function renderGuideItem(id) {
    setTab('guide');
    const g = GD.items.find(x => x.id === id);
    if (!g) { bar(backBtn('#/guide') + '<div class="fill atitle">아빠 가이드</div>'); view.innerHTML = '<section class="pad">' + empty('글을 찾을 수 없어요', '') + '</section>'; return; }
    const c = GCAT[g.cat] || {};
    bar(backBtn('#/guide/' + g.cat) + '<div class="fill atitle">아빠 가이드 · ' + esc(c.name || '') + '</div>');
    const note = g.status === '공식 근거' ? '<div class="draft"><span>✅</span><span>' + esc(dot(g.updated)) + '에 법령 원문·고용노동부 자료로 확인했어요. 법률 자문은 아니니 내 경우는 1350이나 고용센터에서 확인해 주세요.</span></div>'
      : g.status === '일반 조언' ? '<div class="draft"><span>✍️</span><span>육아맨이 정리한 일반적인 조언이에요. 집마다 다를 수 있어요.</span></div>' : '';
    view.innerHTML = '<section class="pad"><article class="garticle">'
      + '<div class="meta"><span class="badge c-etc">' + esc(c.e || '') + ' ' + esc(c.name || '') + '</span>' + (g.tag ? '<span class="tag ' + tagCls(g.tag) + '">' + esc(g.tag) + '</span>' : '') + '</div>'
      + '<h1>' + esc(g.title) + '</h1><p class="gsub">' + esc(g.sub) + '</p>' + note
      + blocks(g.body)
      + (g.sources && g.sources.length ? '<div class="srcs"><b>출처</b><ul>' + g.sources.map(s => '<li><a href="' + esc(s.u) + '" target="_blank" rel="noopener">' + esc(s.t) + '</a></li>').join('') + '</ul></div>' : '')
      + '</article>'
      + (g.community && CAT[g.community] ? '<a class="glink" href="#/community/' + esc(g.community) + '"><span>💬 커뮤니티 "' + esc(CAT[g.community].name) + '"에서 이야기 나누기</span><span>→</span></a>' : '')
      + '</section>';
    window.scrollTo(0, 0);
  }

  // ----- 계산기 -----
  function renderCalc(tab) {
    setTab('guide');
    bar(backBtn('#/guide/leave') + '<div class="fill atitle">계산기</div>');
    const chips = '<div class="chips">' + CALC_TABS.map(t => '<a class="chip' + (t.key === tab ? ' on' : '') + '" href="#/calc/' + t.key + '"><span class="e">' + t.e + '</span>' + esc(t.name) + '</a>').join('') + '</div>';
    view.innerHTML = '<section class="pad">' + chips + '<div id="calcForm"></div><div id="calcOut"></div></section>';
    window.scrollTo(0, 0);
    ({ leave: calcLeave, reduce: calcReduce, paternity: calcPaternity, dates: calcDates })[tab]();
  }
  const manField = (id, label, val, hint) => '<label class="lbl" for="' + id + '">' + esc(label) + '</label><div class="unit"><input class="inp" id="' + id + '" type="number" inputmode="decimal" min="0" step="1" value="' + esc(val) + '"><span>만원</span></div>' + (hint ? '<small class="hint">' + esc(hint) + '</small>' : '');
  const dateField = (id, label, val) => '<label class="dfield"><span>' + esc(label) + '</span><input class="inp" id="' + id + '" type="date" value="' + esc(val) + '"></label>';
  const ORD_HELP = '<details class="dt"><summary>통상임금이 뭔가요?</summary><p>일한 대가로 매달 똑같이 받는 돈이에요. 기본급에 매달 고정으로 나오는 수당을 더해요. 성과급·초과근무수당처럼 달마다 달라지는 돈은 보통 빠져요. 정확한 금액은 회사 인사팀에 물어보세요.</p>'
    + '<div class="two"><label class="dfield"><span>기본급(만원)</span><input class="inp" id="ordBase" type="number" inputmode="decimal"></label><label class="dfield"><span>고정 수당 합(만원)</span><input class="inp" id="ordFix" type="number" inputmode="decimal"></label></div><button type="button" class="btn line small" id="ordAdd">더해서 넣기</button></details>';
  function bindOrd(onChange) {
    const b = $('#ordAdd'); if (!b) return;
    b.addEventListener('click', () => { const v = (parseFloat($('#ordBase').value) || 0) + (parseFloat($('#ordFix').value) || 0); const p = $('#cPay'); p.value = v; calcS.pay = v; saveCalc(); onChange(); toast('더해서 넣었어요'); });
  }
  function bindInputs(map, onChange) {
    Object.keys(map).forEach(id => { const el = $('#' + id); if (!el) return; const fn = () => { map[id](el); saveCalc(); onChange(); }; el.addEventListener('input', fn); el.addEventListener('change', fn); });
  }
  const WARN = {
    dates: '시작일과 끝나는 날을 확인해 주세요.',
    short: '30일 미만이면 급여가 나오지 않아요. 단기 육아휴직(1주 또는 2주)은 7일 이상이면 돼요.',
    over12: '12개월을 넘는 기간은 부모가 각각 3개월 이상 쓰거나, 한부모·중증 장애아동의 부모일 때 쓸 수 있어요.',
    over18: '육아휴직은 가장 길어도 18개월이에요. 끝나는 날을 앞당겨 주세요.',
    noCommon: '6+6은 부모가 모두 써야 적용돼요. 배우자 사용 기간이 없으면 일반 기준으로 계산돼요.',
    hours: '단축 후 시간이 단축 전보다 짧아야 해요.',
    range: '단축 후 근로시간은 주 15시간 이상 35시간 이하여야 해요.',
    over36: '단축근무는 기본 1년에, 육아휴직을 안 쓴 기간의 두 배를 더해 가장 길어도 3년이에요.'
  };
  const warnBox = list => (list || []).map(k => '<div class="warn">⚠️ ' + esc(WARN[k] || k) + '</div>').join('');
  function groupRows(rows) {
    const out = [];
    rows.forEach(r => { const g = out[out.length - 1]; if (g && r.full && g.full && g.paid === r.paid && g.rate === r.rate && g.cap === r.cap) g.to = r.no; else out.push({ from: r.no, to: r.no, paid: r.paid, rate: r.rate, cap: r.cap, full: r.full, days: r.days, special: r.special, cut: r.cut }); });
    return out;
  }
  function calcLeave() {
    $('#calcForm').innerHTML = '<div class="form">'
      + manField('cPay', '내 월 통상임금', calcS.pay) + ORD_HELP
      + '<span class="lbl">휴직 기간</span><div class="two">' + dateField('cStart', '시작일', calcS.start) + dateField('cEnd', '끝나는 날', calcS.end) + '</div>'
      + '<div class="quick" id="cQuick">' + [3, 6, 12, 18].map(m => '<button type="button" class="chip" data-m="' + m + '">' + m + '개월</button>').join('') + '</div>'
      + '<span class="lbl">내 상황</span><div class="seg" id="cMode"><button type="button" data-m="general">일반</button><button type="button" data-m="both">부모 모두(6+6)</button><button type="button" data-m="single">한부모</button></div>'
      + '<div id="bothBox" hidden><label class="lbl" for="cSpouse">배우자가 쓰는 기간</label><div class="unit"><input class="inp" id="cSpouse" type="number" inputmode="numeric" min="0" max="18" value="' + esc(calcS.spouseMonths) + '"><span>개월</span></div>'
      + manField('cSpousePay', '배우자 월 통상임금 (선택)', calcS.spousePay, '넣으면 우리 집 합계도 보여 드려요.')
      + '<div style="margin-top:12px">' + dateField('cBirth', '아이 태어난 날 (선택)', calcS.birth) + '</div><small class="hint">넣으면 6+6으로 시작할 수 있는 마지막 날을 확인해요. 저장은 이 기기에만 돼요.</small></div>'
      + '<details class="dt"><summary>휴직 중에 회사에서 돈을 받나요?</summary><p>회사에서 받는 돈과 급여를 합해 통상임금을 넘으면, 넘는 만큼 급여에서 빠져요.</p>' + manField('cCompany', '매달 받는 금액', calcS.company) + '</details>'
      + '</div>';
    const out = () => {
      const r = K.leaveBenefit({ ordinary: toWon(calcS.pay), start: calcS.start, end: calcS.end, mode: calcS.mode, spouseMonths: calcS.spouseMonths, companyPay: toWon(calcS.company) });
      $$('#cMode button').forEach(b => b.classList.toggle('on', b.dataset.m === calcS.mode));
      $('#bothBox').hidden = calcS.mode !== 'both';
      let compare = '', house = '', birthNote = '';
      if (calcS.mode !== 'general' && r.rows.length) {
        const g = K.leaveBenefit({ ordinary: toWon(calcS.pay), start: calcS.start, end: calcS.end, companyPay: toWon(calcS.company) });
        if (r.total > g.total) compare = '<p class="cline">일반 기준보다 <b>' + won(r.total - g.total) + '</b> 더 받아요.</p>';
      }
      if (calcS.mode === 'both' && toWon(calcS.spousePay) > 0 && +calcS.spouseMonths > 0) {
        const sEnd = K.addDays(K.addMonths(calcS.start, Math.min(18, +calcS.spouseMonths)), -1);
        const s = K.leaveBenefit({ ordinary: toWon(calcS.spousePay), start: calcS.start, end: sEnd, mode: 'both', spouseMonths: r.fullMonths });
        house = '<p class="cline">배우자 ' + s.months + '개월 <b>' + won(s.total) + '</b> · 우리 집 합계 <b>' + won(r.total + s.total) + '</b></p>';
      }
      if (calcS.mode === 'both' && K.parse(calcS.birth)) {
        const d = K.childDates({ birth: calcS.birth });
        birthNote = calcS.start > d.bothStartBy
          ? '<div class="warn">⚠️ 시작일이 생후 18개월(' + dot(d.bothStartBy) + ')을 넘어요. 부모 모두 그날까지 휴직을 시작해야 6+6이 돼요.</div>'
          : '<p class="cline ok">시작일이 생후 18개월(' + dot(d.bothStartBy) + ') 안이에요. 배우자도 그날까지 시작해야 해요.</p>';
      }
      const tbl = groupRows(r.rows).map(g => '<tr><td>' + (g.full ? (g.from === g.to ? g.from + '개월째' : g.from + '~' + g.to + '개월째') : g.from + '개월째 ' + g.days + '일') + (g.special ? ' <span class="six">6+6</span>' : '') + '<small>' + Math.round(g.rate * 100) + '% · 상한 ' + (g.cap / 10000) + '만원' + (g.cut ? ' · ' + won(g.cut) + ' 감액' : '') + '</small></td><td>' + (g.full ? '월 ' : '') + won(g.paid) + '</td></tr>').join('');
      $('#calcOut').innerHTML = warnBox(r.warnings) + birthNote + (r.rows.length ? '<div class="result"><small>' + r.months + '개월' + (r.days % 1 ? '' : '') + ' 받는 돈' + (calcS.mode === 'both' && r.common ? ' · 6+6 ' + r.common + '개월' : '') + '</small><strong>' + won(r.total) + '</strong>' + compare + house + '<table class="calctbl">' + tbl + '</table></div>'
        + '<div class="about"><b>챙길 날짜</b><ul><li>회사에 신청: <b>' + dot(r.applyBy) + '</b>까지(시작 30일 전)</li><li>급여 신청: <b>' + dot(r.claimFrom) + '</b>부터 <b>' + dot(r.claimTo) + '</b>까지 고용24에서</li></ul></div>' : '')
        + basis('고용보험법 시행령 제95조·제95조의3·제98조(시행 2026.9.18.)', 'https://m.work24.go.kr/cm/c/f/1100/selecSimulate12.do?systClId=SC00000251&systId=SI00000402', '시작 전 같은 회사 6개월 이상 근무, 고용보험 가입 180일 이상이어야 해요. 실제 금액은 고용센터가 정해요.');
    };
    const setMonths = m => { calcS.end = K.addDays(K.addMonths(calcS.start, m), -1); $('#cEnd').value = calcS.end; saveCalc(); out(); };
    bindInputs({
      cPay: el => { calcS.pay = parseFloat(el.value) || 0; }, cStart: el => { if (K.parse(el.value)) calcS.start = el.value; }, cEnd: el => { if (K.parse(el.value)) calcS.end = el.value; },
      cSpouse: el => { calcS.spouseMonths = parseInt(el.value, 10) || 0; }, cSpousePay: el => { calcS.spousePay = el.value; }, cBirth: el => { calcS.birth = el.value; }, cCompany: el => { calcS.company = el.value; }
    }, out);
    $('#cQuick').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (b) setMonths(+b.dataset.m); });
    $('#cMode').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (b) { calcS.mode = b.dataset.m; saveCalc(); out(); } });
    bindOrd(out);
    out();
  }
  function basis(law, simUrl, extra) {
    return '<p class="calcnote">' + esc(extra || '') + ' 근거: ' + esc(law) + ', ' + esc(dot(K.RULES.checkedAt)) + ' 확인. <a href="' + esc(simUrl) + '" target="_blank" rel="noopener">고용24 공식 모의계산</a>에서 한 번 더 확인해 보세요.</p>';
  }
  function calcReduce() {
    $('#calcForm').innerHTML = '<div class="form">' + manField('cPay', '내 월 통상임금', calcS.pay) + ORD_HELP
      + '<div class="two" style="margin-top:12px"><label class="dfield"><span>단축 전 주 근로시간</span><input class="inp" id="cBefore" type="number" inputmode="numeric" value="' + esc(calcS.before) + '"></label><label class="dfield"><span>단축 후 주 근로시간</span><input class="inp" id="cAfter" type="number" inputmode="numeric" value="' + esc(calcS.after) + '"></label></div>'
      + '<div class="quick" id="cHours">' + [35, 30, 25, 20, 15].map(h => '<button type="button" class="chip" data-h="' + h + '">주 ' + h + '시간</button>').join('') + '</div>'
      + '<label class="lbl" for="cMonths">단축 기간</label><div class="unit"><input class="inp" id="cMonths" type="number" inputmode="numeric" min="1" max="36" value="' + esc(calcS.rMonths) + '"><span>개월</span></div></div>';
    const out = () => {
      const r = K.reduceBenefit({ ordinary: toWon(calcS.pay), before: calcS.before, after: calcS.after, months: calcS.rMonths });
      $('#calcOut').innerHTML = warnBox(r.warnings) + (r.cut > 0 ? '<div class="result"><small>단축근무 중 한 달 수입(어림)</small><strong>' + won(r.monthly) + '</strong>'
        + '<table class="calctbl"><tr><td>회사 임금<small>일한 시간에 비례한 어림값</small></td><td>' + won(r.wage) + '</td></tr>'
        + '<tr><td>정부 급여 · 첫 ' + r.firstHours + '시간<small>통상임금 100%, 상한 250만원</small></td><td>' + won(r.first) + '</td></tr>'
        + (r.restHours ? '<tr><td>정부 급여 · 나머지 ' + r.restHours + '시간<small>통상임금 80%, 상한 160만원</small></td><td>' + won(r.rest) + '</td></tr>' : '')
        + (r.reduced ? '<tr><td>감액<small>임금과 급여의 합이 통상임금을 넘는 만큼</small></td><td>-' + won(r.reduced) + '</td></tr>' : '')
        + '<tr class="sum"><td>정부 급여 ' + r.months + '개월 합계</td><td>' + won(r.totalGov) + '</td></tr></table>'
        + '<p class="cline">평소 통상임금보다 한 달에 <b>' + won(Math.max(0, r.lost)) + '</b> 줄고, 주 <b>' + r.cut + '시간</b>을 아이와 더 보내요.</p></div>' : '')
        + basis('고용보험법 시행령 제104조의2(2026.1.1.부터 상한 250만·160만원, 하한 50만원)', 'https://m.work24.go.kr/cm/c/f/1100/selecSimulate13.do?systClId=SC00000252&systId=SI00000397&systCnntId=CI00001582', '실제 회사 임금은 임금 규정에 따라 달라요.');
    };
    bindInputs({ cPay: el => { calcS.pay = parseFloat(el.value) || 0; }, cBefore: el => { calcS.before = parseFloat(el.value) || 0; }, cAfter: el => { calcS.after = parseFloat(el.value) || 0; }, cMonths: el => { calcS.rMonths = parseInt(el.value, 10) || 1; } }, out);
    $('#cHours').addEventListener('click', ev => { const b = ev.target.closest('[data-h]'); if (b) { calcS.after = +b.dataset.h; $('#cAfter').value = calcS.after; saveCalc(); out(); } });
    bindOrd(out);
    out();
  }
  function calcPaternity() {
    $('#calcForm').innerHTML = '<div class="form">' + manField('cPay', '내 월 통상임금', calcS.pay) + ORD_HELP
      + '<span class="lbl">회사 규모</span><div class="seg" id="cPri"><button type="button" data-p="1">우선지원대상기업</button><button type="button" data-p="0">그 밖의 회사</button></div>'
      + '<small class="hint">우선지원대상기업은 대체로 중소기업이에요. 업종별 기준이 있어 회사 인사팀에 물어보면 바로 알 수 있어요.</small>'
      + '<span class="lbl">아이 날짜</span><div class="two">' + dateField('cDue', '출산 예정일', calcS.due) + dateField('cBirth', '태어난 날', calcS.birth) + '</div></div>';
    const out = () => {
      const r = K.paternityPay({ ordinary: toWon(calcS.pay), priority: calcS.priority });
      $$('#cPri button').forEach(b => b.classList.toggle('on', (b.dataset.p === '1') === !!calcS.priority));
      const d = K.childDates({ birth: calcS.birth, due: calcS.due });
      $('#calcOut').innerHTML = '<div class="result"><small>20일 동안 받는 돈(통상임금 기준)</small><strong>' + won(r.total) + '</strong>'
        + '<table class="calctbl"><tr><td>정부 급여<small>' + (calcS.priority ? '20일 상한 ' + won(r.capAll) : '우선지원대상기업이 아니면 없음') + '</small></td><td>' + won(r.gov) + '</td></tr>'
        + '<tr><td>회사가 주는 몫<small>유급 휴가라 나머지는 회사 몫</small></td><td>' + won(r.company) + '</td></tr></table></div>'
        + (d.paternityFrom ? '<div class="about"><b>쓸 수 있는 기간</b><ul><li><b>' + dot(d.paternityFrom) + '</b>부터 <b>' + dot(d.paternityTo) + '</b>까지</li><li>20일을 3번까지 나눠 쓸 수 있어요.</li><li>날짜를 적은 문서로 회사에 알려요.</li></ul></div>' : '<div class="about">출산 예정일이나 태어난 날을 넣으면 쓸 수 있는 기간을 알려 드려요.</div>')
        + basis('남녀고용평등법 제18조의2(시행 2026.9.18.), 고용노동부 2026 급여 상한', 'https://www.work24.go.kr/', '1일 통상임금은 월 통상임금 ÷ 209시간 × 8시간으로 어림했어요. 끝나는 날은 태어난 날에 120일을 더한 값이니 회사와 확인해 주세요.');
    };
    bindInputs({ cPay: el => { calcS.pay = parseFloat(el.value) || 0; }, cDue: el => { calcS.due = el.value; }, cBirth: el => { calcS.birth = el.value; } }, out);
    $('#cPri').addEventListener('click', ev => { const b = ev.target.closest('[data-p]'); if (b) { calcS.priority = b.dataset.p === '1'; saveCalc(); out(); } });
    bindOrd(out);
    out();
  }
  function calcDates() {
    $('#calcForm').innerHTML = '<div class="form"><span class="lbl">아이 날짜</span><div class="two">' + dateField('cBirth', '태어난 날', calcS.birth) + dateField('cDue', '출산 예정일', calcS.due) + '</div><small class="hint">날짜는 이 기기에만 저장돼요. 서버로 보내지 않아요.</small></div>';
    const out = () => {
      const d = K.childDates({ birth: calcS.birth, due: calcS.due });
      const row = (t, v, n) => '<tr><td>' + esc(t) + (n ? '<small>' + esc(n) + '</small>' : '') + '</td><td>' + dot(v) + '</td></tr>';
      $('#calcOut').innerHTML = d.paternityFrom ? '<div class="result"><table class="calctbl">'
        + row('배우자 출산전후휴가 시작 가능', d.paternityFrom, '출산 예정일 50일 전')
        + row('배우자 출산전후휴가 마지막', d.paternityTo, '출산 후 120일')
        + row('6+6 시작 마지막 날', d.bothStartBy, '부모 모두 생후 18개월 안에 시작')
        + row('육아휴직 시작 마지막 날', d.leaveStartBy, '만 8세 이하 또는 초2 이하 중 늦은 날')
        + row('단축근무 시작 마지막 날', d.reduceStartBy, '만 12세 이하 또는 초6 이하 중 늦은 날')
        + '</table></div><p class="calcnote">초등학교는 만 6세가 되는 해의 다음 해 3월 입학으로 계산했어요. 입학을 앞당기거나 늦췄으면 달라져요. 시작일이 이 날 안이면, 쉬는 도중 나이를 넘어도 이어서 쓸 수 있어요. 근거: 남녀고용평등법 제18조의2·제19조·제19조의2.</p>'
        : '<div class="about">태어난 날이나 출산 예정일을 넣으면 챙길 날짜를 보여 드려요.</div>';
    };
    bindInputs({ cDue: el => { calcS.due = el.value; }, cBirth: el => { calcS.birth = el.value; } }, out);
    out();
  }

  // ----- 자료실 -----
  const lib = { items: null, q: '', topic: '' };
  async function loadLibrary() {
    if (lib.items) return lib.items;
    const res = await fetch('data/library.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('library ' + res.status);
    const data = await res.json();
    lib.items = data.items || []; lib.topics = data.topics || []; lib.updated = data.updated || '';
    lib.items.forEach(x => { x._hay = [x.title, x.publisher, x.summary, x.type, x.topic, (x.facts || []).join(' ')].join(' ').toLowerCase(); });
    return lib.items;
  }
  function lcard(x) {
    return '<a class="lcard" href="' + esc(x.url) + '" target="_blank" rel="noopener"><div class="meta"><span class="badge c-etc">' + esc(x.topic) + '</span>' + (x.official ? '<span class="tag">공식</span>' : '<span class="time">' + esc(x.type) + '</span>') + '</div>'
      + '<h3>' + esc(x.title) + '</h3><small>' + esc(x.publisher || '') + (x.date ? ' · ' + esc(dot(x.date)) : '') + '</small><p>' + esc(x.summary || '') + '</p>'
      + (x.facts && x.facts.length ? '<ul>' + x.facts.slice(0, 3).map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' : '') + '</a>';
  }
  function paintLibrary() {
    const box = $('#libList'); if (!box) return;
    const words = lib.q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = lib.items.filter(x => (!lib.topic || x.topic === lib.topic) && words.every(w => x._hay.indexOf(w) >= 0));
    $('#libCount').textContent = rows.length + '건';
    box.innerHTML = rows.length ? rows.slice(0, 100).map(lcard).join('') + (rows.length > 100 ? '<p class="foot-note">앞 100건만 보여 드려요. 키워드를 더 넣어 보세요.</p>' : '') : empty('찾는 자료가 없어요', '다른 말로 찾아보세요');
  }
  async function renderLibrary() {
    setTab('guide');
    bar(brandBar());
    view.innerHTML = '<section class="pad"><h1 class="htitle">자료실 🗂️</h1><p class="hsub">남성 육아휴직 자료를 한 곳에. 제목을 누르면 원문이 열려요.</p>' + guideChips('library') + '<div class="loading" id="libLoad">불러오는 중…</div></section>';
    window.scrollTo(0, 0);
    try { await loadLibrary(); } catch (e) { $('#libLoad').outerHTML = empty('자료를 못 불러왔어요', '잠시 뒤 다시 열어 주세요'); return; }
    const sec = $('#view section');
    $('#libLoad').remove();
    sec.insertAdjacentHTML('beforeend', '<div class="searchbar"><input id="libQ" type="search" placeholder="키워드 검색: 6+6, 복직, 판례, 후기" enterkeyhint="search" autocomplete="off" value="' + esc(lib.q) + '"></div>'
      + '<div class="chips" id="libTopics"><button type="button" class="chip' + (!lib.topic ? ' on' : '') + '" data-t="">전체</button>' + lib.topics.map(t => '<button type="button" class="chip' + (lib.topic === t ? ' on' : '') + '" data-t="' + esc(t) + '">' + esc(t) + '</button>').join('') + '</div>'
      + '<div class="sec" style="margin-top:4px"><h2 style="font-size:15px">' + (lib.updated ? esc(dot(lib.updated)) + ' 모음' : '자료') + '</h2><span id="libCount"></span></div><div class="list" id="libList"></div>'
      + '<p class="calcnote">링크와 육아맨의 짧은 요약만 모았어요. 숫자는 그 자료가 나온 때 기준이고, 내용은 원문을 확인해 주세요.</p>');
    $('#libQ').addEventListener('input', ev => { lib.q = ev.target.value.trim(); paintLibrary(); });
    $('#libTopics').addEventListener('click', ev => { const b = ev.target.closest('[data-t]'); if (!b) return; lib.topic = b.dataset.t; $$('#libTopics .chip').forEach(x => x.classList.toggle('on', x === b)); paintLibrary(); });
    paintLibrary();
  }

  // ----- 커뮤니티 -----
  const listState = { cat: '', q: '', posts: [], next: null, scroll: 0, keep: false };
  function chip(key, name, e, cur) { return '<a class="chip' + (key === cur ? ' on' : '') + '" href="#/community' + (key ? '/' + key : '') + '"><span class="e">' + e + '</span>' + esc(name) + '</a>'; }
  function pcard(p) {
    const c = CAT[p.cat] || { name: p.cat, e: '' };
    return '<a class="pcard" href="#/p/' + p.id + '" data-keep="1"><div class="meta"><span class="badge c-' + (CAT[p.cat] ? esc(p.cat) : 'etc') + '">' + c.e + ' ' + esc(c.name) + '</span><span class="time">' + ago(p.created) + '</span></div>'
      + '<h3>' + esc(p.title) + '</h3><p>' + esc(p.preview || '') + '</p>'
      + '<div class="foot">' + who(p.nick, p.badge) + '<span class="cmt">' + ICON.chat + ' ' + (p.comments || 0) + '</span></div></a>';
  }
  async function renderCommunity(cat) {
    setTab('community'); fab.hidden = false;
    bar(brandBar('<button class="searchcta" id="btnSearch" aria-label="키워드 검색"><span class="bubble" id="searchBubble">키워드 검색</span><span class="sc">' + ICON.search + '</span></button>'));
    const reuse = listState.keep && listState.cat === cat && listState.posts.length > 0;
    listState.keep = false;
    if (!reuse) { listState.cat = cat; listState.q = ''; listState.posts = []; listState.next = null; }
    const q = listState.q;
    view.innerHTML = '<section class="pad">'
      + '<h1 class="htitle">커뮤니티 💬</h1><p class="hsub">사진·영상 없이 줄글로, 아빠끼리 솔직하게</p>'
      + '<div class="chips">' + chip('', '전체', '🏠', cat) + CATS.map(c => chip(c.key, c.name, c.e, cat)).join('') + '</div>'
      + '<div class="searchbar" id="searchbar"' + (q ? '' : ' hidden') + '><input id="q" type="search" placeholder="키워드로 글 찾기 (예: 복직, 이유식)" enterkeyhint="search" autocomplete="off" value="' + esc(q) + '"><button type="button" class="sgo" id="qgo">찾기</button><button type="button" class="sx" id="qx" aria-label="검색 지우기">✕</button></div>'
      + (mode === 'local' ? mockBadge() : '')
      + (me && !canWrite() ? '<button type="button" class="notice vcta" id="vcta"><span class="e">✅</span><span>글과 댓글은 인증한 아빠만 쓸 수 있어요. <b>아빠 인증하기</b></span></button>' : '')
      + '<div class="list" id="list"></div><button type="button" class="more" id="more" hidden>더 보기</button>'
      + '</section>';
    const syncBubble = () => { const b = $('#searchBubble'); if (b) b.hidden = !$('#searchbar').hidden; };
    syncBubble();
    const doSearch = () => { listState.q = $('#q').value.trim(); $('#q').blur(); loadList(false); };
    $('#btnSearch').addEventListener('click', () => { const sb = $('#searchbar'); sb.hidden = !sb.hidden; syncBubble(); if (!sb.hidden) $('#q').focus(); else if (listState.q) { listState.q = ''; loadList(false); } });
    $('#q').addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); doSearch(); } });
    $('#qgo').addEventListener('click', doSearch);
    $('#qx').addEventListener('click', () => { $('#q').value = ''; $('#searchbar').hidden = true; syncBubble(); if (listState.q) { listState.q = ''; loadList(false); } });
    $('#more').addEventListener('click', () => loadList(true));
    const v = $('#vcta'); if (v) v.addEventListener('click', () => openVerify(() => render()));
    if (reuse) { paintList(); window.scrollTo(0, listState.scroll); } else { window.scrollTo(0, 0); await loadList(false); }
  }
  async function loadList(more) {
    const list = $('#list'), btn = $('#more'); if (!list) return;
    if (!more) list.innerHTML = '<div class="loading">불러오는 중…</div>';
    if (btn) { btn.disabled = true; btn.textContent = '불러오는 중…'; }
    try {
      const r = await api('listPosts', { cat: listState.cat, q: listState.q, before: more ? listState.next : '', limit: PAGE });
      listState.posts = more ? listState.posts.concat(r.posts) : r.posts; listState.next = r.next;
      if (mode === 'local' && !$('#mockBadge') && $('#list')) $('#list').insertAdjacentHTML('beforebegin', mockBadge());
      paintList();
    } catch (e) { if (!more) list.innerHTML = empty('글을 못 불러왔어요', '잠시 뒤 다시 열어 주세요'); fail(e); }
    finally { if (btn) { btn.disabled = false; btn.textContent = '더 보기'; } }
  }
  function paintList() {
    const list = $('#list'), btn = $('#more'); if (!list) return;
    const q = listState.q;
    list.innerHTML = (q ? '<div class="sec" style="margin:4px 2px 2px"><h2 style="font-size:15px">"' + esc(q) + '" 검색 결과</h2><span>' + listState.posts.length + (listState.next ? '+' : '') + '개</span></div>' : '')
      + (listState.posts.length ? listState.posts.map(pcard).join('') : empty(q ? '검색 결과가 없어요' : '아직 글이 없어요', q ? '다른 말로 찾아보세요' : '첫 글을 써 보세요!'));
    if (btn) btn.hidden = !listState.next;
  }

  // ----- 글 하나 + 댓글 -----
  const cmtDrafts = {};
  function cmtItem(c) {
    const mine = me && (c.uid === me.id || me.role === 'admin');
    return '<div class="cmt-item" id="c' + c.id + '"><div class="top">' + who(c.nick, c.badge) + '<span class="right"><span class="time">' + ago(c.created) + '</span>'
      + (mine ? '<button type="button" class="del" data-del-cmt="' + c.id + '">삭제</button>' : '') + '</span></div><div class="txt">' + rich(c.body) + '</div></div>';
  }
  async function renderPost(id) {
    setTab('community'); app.classList.add('notab', 'composing');
    bar(backBtn('#/community') + '<div class="fill atitle">글</div><span id="postAct"></span>');
    view.innerHTML = '<section class="pad"><div class="loading">불러오는 중…</div></section>';
    window.scrollTo(0, 0);
    let r;
    try { r = await api('getPost', id); }
    catch (e) { view.innerHTML = '<section class="pad">' + empty('글을 찾을 수 없어요', '지워졌거나 주소가 틀렸어요') + '</section>'; app.classList.remove('composing'); if (!(e && e.code === 'not_found')) fail(e); return; }
    const p = r.post, c = CAT[p.cat] || { name: p.cat, e: '' }, mine = me && (p.uid === me.id || me.role === 'admin');
    if (mine) $('#postAct').innerHTML = '<button type="button" class="abtn danger" id="delPost">삭제</button>';
    const ph = !me ? '닉네임을 정하면 댓글을 쓸 수 있어요' : canWrite() ? '댓글을 남겨 보세요' : '아빠 인증을 하면 댓글을 쓸 수 있어요';
    view.innerHTML = '<section class="pad">'
      + '<article class="post"><div class="meta"><span class="badge c-' + (CAT[p.cat] ? esc(p.cat) : 'etc') + '">' + c.e + ' ' + esc(c.name) + '</span><span class="time">' + ago(p.created) + '</span></div>'
      + '<h1>' + esc(p.title) + '</h1><div class="byline">' + who(p.nick, p.badge) + '<span>' + ymd(p.created) + '</span></div>'
      + '<div class="body">' + rich(p.body) + '</div></article>'
      + '<div class="sec"><h2>댓글 <span id="cmtN">' + r.comments.length + '</span></h2></div>'
      + '<div class="cmts" id="cmts">' + (r.comments.length ? r.comments.map(cmtItem).join('') : empty('첫 댓글을 남겨 보세요', '')) + '</div>'
      + '</section>'
      + '<form class="composer" id="composer"><textarea id="cbody" rows="1" placeholder="' + esc(ph) + '" maxlength="1000"></textarea><button class="send" type="submit" aria-label="보내기">' + ICON.send + '</button></form>';
    const form = $('#composer'), ta = $('#cbody');
    ta.value = cmtDrafts[id] || '';     // 인증 창을 다녀와 화면이 다시 그려져도 쓰던 댓글이 남게
    ta.addEventListener('input', () => { cmtDrafts[id] = ta.value; });
    autosize(ta);
    const submit = async () => {
      const body = ta.value.trim();
      if (!me) { openSheet(submit); return; }
      if (!canWrite()) { openVerify(submit); return; }
      if (!body) return;
      const btn = $('.send', form); btn.disabled = true;
      try {
        const rr = await api('addComment', id, body);
        ta.value = ''; delete cmtDrafts[id]; autosize(ta);
        const box = $('#cmts'); if (box.querySelector('.empty')) box.innerHTML = '';
        box.insertAdjacentHTML('beforeend', cmtItem(rr.comment)); $('#cmtN').textContent = box.querySelectorAll('.cmt-item').length;
        listState.posts = []; toast('댓글을 남겼어요');
        $('#c' + rr.comment.id).scrollIntoView({ block: 'nearest' });
      } catch (e) { fail(e, submit); }
      finally { btn.disabled = false; }
    };
    form.addEventListener('submit', ev => { ev.preventDefault(); submit(); });
    const del = $('#delPost');
    if (del) del.addEventListener('click', async () => {
      if (!confirm('이 글을 지울까요? 댓글도 함께 보이지 않게 돼요.')) return;
      try { await api('deletePost', id); listState.posts = []; toast('글을 지웠어요'); go('#/community', true); } catch (e) { fail(e); }
    });
  }
  async function delComment(cid) {
    if (!confirm('이 댓글을 지울까요?')) return;
    try { await api('deleteComment', cid); const el = $('#c' + cid); if (el) el.remove(); const n = $('#cmtN'); if (n) n.textContent = $$('#cmts .cmt-item').length; listState.posts = []; toast('댓글을 지웠어요'); }
    catch (e) { fail(e); }
  }
  function autosize(ta) { const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; }; ta.addEventListener('input', fit); fit(); }

  // ----- 글쓰기 -----
  function renderWrite() {
    setTab('community'); app.classList.add('notab');
    bar(backBtn('#/community') + '<div class="fill atitle">글쓰기</div><button class="abtn" id="submitTop" type="submit" form="wform">올리기</button>');
    const d = store.get('draft', null) || {};
    view.innerHTML = '<section class="pad">'
      + (!canWrite() ? '<button type="button" class="notice vcta" id="vcta" style="margin-bottom:8px"><span class="e">✅</span><span>글은 인증한 아빠만 올릴 수 있어요. 써 둔 글은 이 기기에 남아요. <b>' + (me ? '아빠 인증하기' : '시작하기') + '</b></span></button>' : '')
      + '<form class="form" id="wform" novalidate>'
      + '<span class="lbl">분류</span><div class="catpick" id="catpick">' + CATS.map(c => '<button type="button" class="chip' + (d.cat === c.key ? ' on' : '') + '" data-pick="' + c.key + '"><span class="e">' + c.e + '</span>' + esc(c.name) + '</button>').join('') + '</div>'
      + '<label class="lbl" for="wtitle">제목</label><input class="inp" id="wtitle" maxlength="60" placeholder="한 줄로 요약해 주세요" value="' + esc(d.title || '') + '" autocomplete="off">'
      + '<label class="lbl" for="wbody">내용</label><textarea class="inp" id="wbody" maxlength="3000" placeholder="아빠들에게 묻고 싶은 것, 알려 주고 싶은 것을 편하게 적어 주세요. 사진·영상 없이 글로만 올라가요.">' + esc(d.body || '') + '</textarea>'
      + '<div class="cnt"><span id="wcnt">' + len(d.body || '') + '</span>/3000</div>'
      + '<div class="notice"><span class="e">🔒</span><span>아이의 이름·얼굴·어린이집 이름 같은 개인정보는 적지 말아 주세요. 글은 모두에게 보여요.</span></div>'
      + '<button class="btn primary" type="submit" style="margin-top:14px">올리기</button>'
      + '</form></section>';
    window.scrollTo(0, 0);
    const form = $('#wform'), title = $('#wtitle'), body = $('#wbody');
    let picked = d.cat && CAT[d.cat] ? d.cat : '';
    $('#catpick').addEventListener('click', ev => { const b = ev.target.closest('[data-pick]'); if (!b) return; picked = b.dataset.pick; $$('#catpick .chip').forEach(x => x.classList.toggle('on', x === b)); saveDraft(); });
    const saveDraft = () => { store.set('draft', { cat: picked, title: title.value, body: body.value }); $('#wcnt').textContent = len(body.value); };
    title.addEventListener('input', saveDraft); body.addEventListener('input', saveDraft);
    title.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); body.focus(); } });
    const v = $('#vcta');
    if (v) v.addEventListener('click', () => { const after = () => render(); if (!me) openSheet(after); else openVerify(after); });
    const submit = async () => {
      const p = { cat: picked, title: clean(title.value, 200), body: clean(body.value, 5000) };
      const bad = checkPost(p);
      if (bad) { toast(MSG[bad], 'err'); (bad === 'cat' ? $('#catpick') : bad === 'title_len' ? title : body).scrollIntoView({ block: 'center' }); if (bad !== 'cat') (bad === 'title_len' ? title : body).focus(); return; }
      if (!me) { openSheet(submit); return; }
      if (!canWrite()) { openVerify(submit); return; }
      const btns = $$('#submitTop, #wform .btn'); btns.forEach(b => { b.disabled = true; });
      try { const r = await api('createPost', p); store.del('draft'); listState.posts = []; toast('글을 올렸어요'); go('#/p/' + r.id, true); }
      catch (e) { fail(e, submit); }
      finally { btns.forEach(b => { b.disabled = false; }); }
    };
    form.addEventListener('submit', ev => { ev.preventDefault(); submit(); });
  }

  // ----- MY -----
  let meSeg = 'posts';
  function aboutBox() {
    return '<div class="about"><b>육아맨은</b> 육아하는 아빠들이 서로 묻고, 알려 주고, 자랑하는 곳이에요.<ul>'
      + '<li>저장하는 것: 닉네임, 내가 쓴 글·댓글, 인증 신청 내용(결정 뒤 지움). 이메일·전화번호·서류·아이 정보는 받지 않아요.</li>'
      + '<li>사진·영상 없이 글로만. 글은 모두 읽을 수 있고, 쓰기는 인증한 아빠만 해요.</li>'
      + '<li>내 글·댓글은 내가 지울 수 있어요. 이 기기의 브라우저 저장소를 지우면 닉네임과 연결이 끊겨요.</li>'
      + (mode === 'local' ? '<li>지금은 시험 모드라 글이 이 기기에만 저장돼요.</li>' : '') + '</ul></div>';
  }
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
  function installBox() {
    const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (standalone || !coarse) return '';
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    return '<div class="install"><span class="logo">' + LOGO + '</span><div class="tx"><b>홈 화면에 추가하면 앱처럼</b><small>' + (ios ? '공유 단추 → "홈 화면에 추가"' : '주소창 없이 바로 열려요') + '</small></div>' + (ios ? '' : '<button type="button" class="inbtn" id="installBtn">추가</button>') + '</div>';
  }
  function bindInstall() { const b = $('#installBtn'); if (!b) return; b.addEventListener('click', async () => { if (deferredPrompt) { deferredPrompt.prompt(); try { await deferredPrompt.userChoice; } catch (e) { /* 무시 */ } deferredPrompt = null; } else toast('브라우저 메뉴에서 "홈 화면에 추가"를 눌러 주세요'); }); }
  const inviteLink = code => location.origin + location.pathname + '#/join/' + encodeURIComponent(code);
  async function shareInvite(code) {
    const url = inviteLink(code), text = '육아맨에 초대해요. 초대 코드: ' + code;
    if (navigator.share) { try { await navigator.share({ title: '육아맨 초대', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text + '\n' + url); toast('초대 코드와 주소를 복사했어요'); }
    catch (e) { window.prompt('이 글을 복사해 보내 주세요', text + ' ' + url); }
  }
  function inviteBox(r) {
    const used = r.invites || [], max = r.invite_max;
    return '<div class="about" id="inviteBox"><b>아빠 초대하기</b><p class="sm">아는 아빠에게 코드를 보내면 바로 인증돼요.' + (max ? ' 한 사람당 ' + max + '개까지예요.' : '') + '</p>'
      + used.map(i => '<div class="irow"><code>' + esc(i.code) + '</code>' + (i.used ? '<span class="time">' + esc(i.nick || '사용함') + ' 님이 씀</span>' : '<button type="button" class="edit" data-share="' + esc(i.code) + '">보내기</button>') + '</div>').join('')
      + (!max || used.length < max ? '<button type="button" class="btn line small" id="newInvite">초대 코드 만들기</button>' : '') + '</div>';
  }
  function statusBox(r) {
    const u = r.user || me;
    if (u.blocked) return '<div class="vstate bad">이용이 제한된 계정이에요.</div>';
    if (u.verified || u.role === 'admin') return '<div class="vstate ok">' + CHECK + '<span><b>인증 아빠</b>' + (u.role === 'admin' ? ' · 관리자' : '') + '</span></div>';
    const ap = r.application;
    if (ap && ap.status === 'pending') return '<div class="vstate wait"><span><b>인증 신청을 확인하고 있어요.</b><br>승인되면 여기에 바로 표시돼요. 초대 코드가 생기면 먼저 쓸 수도 있어요.</span><button type="button" class="edit" id="doVerify">코드 넣기</button></div>';
    return '<div class="vstate"><span><b>아직 인증 전이에요.</b><br>글과 댓글은 인증한 아빠만 쓸 수 있어요.' + (ap && ap.status === 'rejected' ? ' 지난 신청은 승인되지 않았어요. 다시 신청할 수 있어요.' : '') + '</span><button type="button" class="edit" id="doVerify">인증하기</button></div>';
  }
  async function renderMe() {
    setTab('me');
    bar(brandBar());
    if (!me) {
      view.innerHTML = '<section class="pad"><h1 class="htitle">MY</h1>'
        + '<div class="profile" style="margin-top:12px"><span class="big">👋</span><div class="tx"><b>아직 닉네임이 없어요</b><small>닉네임을 정하고 아빠 인증을 하면 글과 댓글을 쓸 수 있어요. 이메일·서류는 받지 않아요.</small></div></div>'
        + '<button type="button" class="btn primary" id="startBtn" style="margin-top:12px">시작하기</button>' + installBox() + aboutBox() + '</section>';
      $('#startBtn').addEventListener('click', () => openSheet(() => render()));
      bindInstall(); window.scrollTo(0, 0);
      if (pendingInvite) openSheet(() => render());
      return;
    }
    view.innerHTML = '<section class="pad"><div class="loading">불러오는 중…</div></section>';
    let r;
    try { r = await api('me'); } catch (e) { view.innerHTML = '<section class="pad">' + empty('내 정보를 못 불러왔어요', '잠시 뒤 다시 열어 주세요') + '</section>'; fail(e, () => render()); return; }
    setMe(r.user);
    view.innerHTML = '<section class="pad"><h1 class="htitle">MY</h1>'
      + '<div class="profile" style="margin-top:12px"><span class="big">' + esc(first(r.user.nick)) + '</span><div class="tx"><b>' + esc(r.user.nick) + '</b><small>' + ymd(r.user.created) + '부터 육아맨 · 글 ' + r.posts.length + ' · 댓글 ' + r.comments.length + '</small></div><button type="button" class="edit" id="editNick">닉네임 바꾸기</button></div>'
      + statusBox(r)
      + (r.user.role === 'admin' ? '<a class="glink" href="#/admin"><span>🛠️ 관리자 화면: 인증 신청 · 초대 코드 · 회원</span><span>→</span></a>' : '')
      + (canWrite() ? inviteBox(r) : '')
      + '<div class="seg" style="margin-top:16px"><button type="button" class="' + (meSeg === 'posts' ? 'on' : '') + '" data-seg="posts">내 글 ' + r.posts.length + '</button><button type="button" class="' + (meSeg === 'comments' ? 'on' : '') + '" data-seg="comments">내 댓글 ' + r.comments.length + '</button></div>'
      + '<div class="list" id="meList"></div>' + installBox() + aboutBox() + '</section>';
    const paint = () => {
      $('#meList').innerHTML = meSeg === 'posts'
        ? (r.posts.length ? r.posts.map(pcard).join('') : empty('아직 쓴 글이 없어요', canWrite() ? '커뮤니티에서 첫 글을 써 보세요' : '아빠 인증을 하면 쓸 수 있어요'))
        : (r.comments.length ? r.comments.map(c => '<a class="mycmt" href="#/p/' + c.post_id + '"><small>' + esc(c.post_title) + ' · ' + ago(c.created) + '</small><p>' + esc(c.body) + '</p></a>').join('') : empty('아직 쓴 댓글이 없어요', ''));
    };
    paint();
    $$('.seg[style] button').forEach(b => b.addEventListener('click', () => { meSeg = b.dataset.seg; $$('.seg[style] button').forEach(x => x.classList.toggle('on', x === b)); paint(); }));
    $('#editNick').addEventListener('click', () => openSheet(() => render(), 'rename'));
    const dv = $('#doVerify'); if (dv) dv.addEventListener('click', () => openVerify(() => render()));
    const ni = $('#newInvite');
    if (ni) ni.addEventListener('click', async () => { ni.disabled = true; try { await api('createInvite'); render(); } catch (e) { ni.disabled = false; fail(e); } });
    const ib = $('#inviteBox');
    if (ib) ib.addEventListener('click', ev => { const b = ev.target.closest('[data-share]'); if (b) shareInvite(b.dataset.share); });
    bindInstall(); window.scrollTo(0, 0);
    if (pendingInvite && !canWrite()) openVerify(() => render());
    else if (pendingInvite) { pendingInvite = ''; }
    else if (r.user.verified && r.user.how === 'apply' && !store.get('welcomed')) { store.set('welcomed', true); toast('아빠 인증이 승인됐어요'); }
  }

  // ----- 관리자 -----
  async function renderAdmin() {
    setTab('me');
    bar(backBtn('#/me') + '<div class="fill atitle">관리자</div>');
    if (!me || me.role !== 'admin' || mode === 'local') { view.innerHTML = '<section class="pad">' + empty('관리자만 볼 수 있어요', '') + '</section>'; return; }
    view.innerHTML = '<section class="pad"><div class="loading">불러오는 중…</div></section>';
    let r;
    try { r = await api('adminQueue'); } catch (e) { view.innerHTML = '<section class="pad">' + empty('못 불러왔어요', '') + '</section>'; fail(e); return; }
    const STAGE = { raising: '아이를 키워요', expecting: '곧 아빠가 돼요' };
    const urow = u => {
      const state = u.role === 'admin' ? '관리자' : u.blocked ? '막힘' : u.verified ? '인증(' + ({ invite: '초대', apply: '신청', admin: '관리자' }[u.verified_how] || '') + ')' : '인증 전';
      const acts = u.role !== 'user' ? '' : u.blocked ? '<button type="button" class="edit" data-u="' + u.id + '" data-a="unblock">풀기</button>'
        : (u.verified ? '<button type="button" class="edit" data-u="' + u.id + '" data-a="unverify">해제</button>' : '<button type="button" class="edit" data-u="' + u.id + '" data-a="verify">인증</button>') + '<button type="button" class="edit" data-u="' + u.id + '" data-a="block">막기</button>';
      return '<div class="urow"><div class="tx"><b>' + esc(u.nick) + '</b><small>' + state + (u.inviter ? ' · 초대: ' + esc(u.inviter) : '') + ' · 글 ' + u.posts + ' · ' + ymd(u.created) + '</small></div><div class="acts">' + acts + '</div></div>';
    };
    view.innerHTML = '<section class="pad">'
      + '<div class="sec"><h2>인증 신청</h2><span>' + r.queue.length + '건</span></div>'
      + (r.queue.length ? r.queue.map(q => '<div class="appl" data-id="' + q.id + '"><div class="meta"><b>' + esc(q.nick) + '</b><span class="time">' + ago(q.created) + '</span></div><small>' + esc(STAGE[q.stage] || '') + '</small><p>' + esc(q.answer) + '</p><div class="two"><button type="button" class="btn primary small" data-d="1">승인</button><button type="button" class="btn line small" data-d="0">거절</button></div></div>').join('') : '<div class="about">대기 중인 신청이 없어요.</div>')
      + '<p class="calcnote">승인·거절하면 신청 내용은 바로 지워져요.</p>'
      + '<div class="sec"><h2>초대 코드</h2></div><div class="about"><div class="two"><input class="inp" id="invNote" placeholder="어디에 쓸 코드인가요(메모)" maxlength="60"><button type="button" class="btn primary small" id="invMake">5개 만들기</button></div>'
      + '<div id="invList">' + r.invites.map(i => '<div class="irow"><code>' + esc(i.code) + '</code><span class="time">' + (i.used ? '사용함' : esc(i.note || '안 씀')) + '</span>' + (i.used ? '' : '<button type="button" class="edit" data-share="' + esc(i.code) + '">보내기</button>') + '</div>').join('') + '</div></div>'
      + '<div class="sec"><h2>회원</h2><span>' + r.users.length + '명</span></div>' + r.users.map(urow).join('')
      + '</section>';
    window.scrollTo(0, 0);
    view.addEventListener('click', adminClick);
  }
  async function adminClick(ev) {
    if (parse().name !== 'admin') { view.removeEventListener('click', adminClick); return; }
    const d = ev.target.closest('[data-d]');
    const u = ev.target.closest('[data-u]');
    const sh = ev.target.closest('[data-share]');
    const mk = ev.target.closest('#invMake');
    try {
      if (d) { const card = d.closest('.appl'); await api('adminDecide', +card.dataset.id, d.dataset.d === '1'); toast(d.dataset.d === '1' ? '승인했어요' : '거절했어요'); view.removeEventListener('click', adminClick); render(); }
      else if (u) { if (u.dataset.a === 'block' && !confirm('이 회원을 막을까요? 인증이 풀리고 다시 신청할 수 없어요.')) return; await api('adminUser', +u.dataset.u, u.dataset.a); toast('바꿨어요'); view.removeEventListener('click', adminClick); render(); }
      else if (sh) shareInvite(sh.dataset.share);
      else if (mk) { mk.disabled = true; await api('adminInvites', 5, $('#invNote').value.trim()); toast('코드 5개를 만들었어요'); view.removeEventListener('click', adminClick); render(); }
    } catch (e) { fail(e); }
  }

  // ----- 바텀시트: 닉네임 · 아빠 인증 -----
  let sheetAfter = null;
  const sheetEl = () => $('#sheet');
  function showSheet(html, after) {
    sheetAfter = typeof after === 'function' ? after : null;
    const sh = sheetEl(); sh.hidden = false; sh.innerHTML = html;
    sh.onclick = ev => { if (ev.target === sh) closeSheet(); };
  }
  function openSheet(after, kind) {
    const rename = kind === 'rename';
    showSheet('<div class="sheet" role="dialog" aria-modal="true" aria-label="' + (rename ? '닉네임 바꾸기' : '닉네임 정하기') + '"><div class="grip"></div>'
      + '<h2>' + (rename ? '닉네임 바꾸기' : '육아맨에 온 걸 환영해요 👋') + '</h2>'
      + '<p>' + (rename ? '하루 3번까지 바꿀 수 있어요. 지난 글의 이름도 함께 바뀌어요.' : '아빠들이 서로 묻고, 알려 주고, 자랑하는 곳이에요. 이메일이나 서류는 받지 않아요.') + '</p>'
      + '<label class="lbl" for="nick">닉네임</label><input class="inp" id="nick" maxlength="12" placeholder="예: 초보대디" autocomplete="off" enterkeyhint="done" value="' + (rename && me ? esc(me.nick) : '') + '">'
      + '<small class="hint">2~12자 · 한글·영문·숫자 · 글에 그대로 보여요</small>'
      + (rename ? '' : '<label class="lbl" for="invite">초대 코드 (있으면)</label><input class="inp code" id="invite" maxlength="12" placeholder="없으면 비워 두세요" autocomplete="off" autocapitalize="characters" value="' + esc(pendingInvite) + '">'
        + '<label class="chk"><input type="checkbox" id="agree"> 서로 존중하고, 아이의 이름·얼굴 같은 개인정보는 올리지 않을게요.</label>')
      + '<div class="err" id="nickErr" hidden></div>'
      + '<button type="button" class="btn primary" id="joinBtn">' + (rename ? '바꾸기' : '다음') + '</button>'
      + '<button type="button" class="btn ghost" id="laterBtn">' + (rename ? '취소' : '둘러보기만 할래요') + '</button></div>', after);
    $('#laterBtn').addEventListener('click', closeSheet);
    $('#joinBtn').addEventListener('click', () => doJoin(rename));
    $('#nick').addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); doJoin(rename); } });
    setTimeout(() => { const n = $('#nick'); if (n) n.focus(); }, 60);
  }
  async function doJoin(rename) {
    const nickEl = $('#nick'), err = $('#nickErr'); if (!nickEl) return;
    const nick = nickEl.value.trim();
    const bad = checkNick(nick); if (bad) { err.hidden = false; err.textContent = MSG[bad]; return; }
    if (!rename && !$('#agree').checked) { err.hidden = false; err.textContent = '약속에 체크해 주세요'; return; }
    const btn = $('#joinBtn'); btn.disabled = true;
    try {
      const invite = rename ? '' : ($('#invite').value || '').trim();
      const r = rename ? await api('rename', nick) : await api('join', nick, invite);
      setMe(r.user);
      const f = sheetAfter;
      if (rename) { toast('닉네임을 바꿨어요'); closeSheet(); if (f) f(); else render(); return; }
      if (r.user.verified) { pendingInvite = ''; toast('반가워요, ' + r.user.nick + '님! 인증됐어요'); closeSheet(); if (f) f(); else render(); return; }
      closeSheet();
      if (r.invite_error) toast(MSG[r.invite_error] || MSG.code_bad, 'err');
      openVerify(f);
    } catch (e) { err.hidden = false; err.textContent = errText(e); }
    finally { btn.disabled = false; }
  }
  // 아빠 인증: 초대 코드(바로) · 신청서(운영자 승인)
  function openVerify(after) {
    if (!me) { openSheet(after); return; }
    let tab = 'code', stage = '';
    showSheet('<div class="sheet" role="dialog" aria-modal="true" aria-label="아빠 인증"><div class="grip"></div><h2>아빠 인증</h2>'
      + '<p>글과 댓글은 인증한 아빠만 쓸 수 있어요. 읽기는 지금도 돼요. 서류나 사진은 받지 않아요.</p>'
      + '<div class="seg" id="vTabs"><button type="button" class="on" data-t="code">초대 코드</button><button type="button" data-t="apply">코드가 없어요</button></div>'
      + '<div id="vCode"><label class="lbl" for="vcode">초대 코드</label><input class="inp code" id="vcode" maxlength="12" placeholder="ABCD-2345" autocomplete="off" autocapitalize="characters" value="' + esc(pendingInvite) + '"><small class="hint">먼저 가입한 아빠에게 받은 코드를 넣으면 바로 인증돼요.</small></div>'
      + '<div id="vApply" hidden><span class="lbl">지금 상황</span><div class="catpick" id="vStage"><button type="button" class="chip" data-s="raising">아이를 키워요</button><button type="button" class="chip" data-s="expecting">곧 아빠가 돼요</button></div>'
      + '<label class="lbl" for="vans">요즘 육아 이야기를 두세 문장으로</label><textarea class="inp" id="vans" maxlength="500" rows="4" placeholder="요즘 가장 힘든 일이나 좋은 일을 적어 주세요. 운영자가 읽고 승인해요."></textarea>'
      + '<small class="hint">아이 이름·어린이집처럼 알아볼 수 있는 정보는 적지 말아 주세요. 승인·거절 뒤 이 글은 지워져요.</small>'
      + '<label class="chk"><input type="checkbox" id="vpledge"> 저는 아이를 키우거나 곧 태어날 아이를 기다리는 아빠예요. 거짓이면 인증이 취소돼도 괜찮아요.</label></div>'
      + '<div class="err" id="vErr" hidden></div>'
      + '<button type="button" class="btn primary" id="vGo">인증하기</button>'
      + '<button type="button" class="btn ghost" id="vLater">나중에 할게요</button></div>', after);
    const setTabV = t => { tab = t; $$('#vTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); $('#vCode').hidden = t !== 'code'; $('#vApply').hidden = t !== 'apply'; $('#vGo').textContent = t === 'code' ? '인증하기' : '신청하기'; $('#vErr').hidden = true; };
    $('#vTabs').addEventListener('click', ev => { const b = ev.target.closest('[data-t]'); if (b) setTabV(b.dataset.t); });
    $('#vStage').addEventListener('click', ev => { const b = ev.target.closest('[data-s]'); if (!b) return; stage = b.dataset.s; $$('#vStage .chip').forEach(x => x.classList.toggle('on', x === b)); });
    $('#vLater').addEventListener('click', () => { pendingInvite = ''; closeSheet(); if (['me', 'community', 'home'].includes(parse().name)) render(); });
    $('#vGo').addEventListener('click', async () => {
      const err = $('#vErr'), btn = $('#vGo'); err.hidden = true;
      const show = m => { err.hidden = false; err.textContent = m; };
      let body = null;
      if (tab === 'code') { if (!$('#vcode').value.trim()) return show('초대 코드를 넣어 주세요'); }
      else {
        const answer = $('#vans').value.trim();
        if (!stage) return show(MSG.stage);
        if (len(answer) < LIM.answer[0]) return show(MSG.answer_len);
        if (!$('#vpledge').checked) return show(MSG.pledge);
        body = { stage, answer, pledge: true };
      }
      btn.disabled = true;
      try {
        const r = tab === 'code' ? await api('verifyCode', $('#vcode').value.trim()) : await api('verifyApply', body);
        if (r.user) setMe(r.user);
        const f = sheetAfter;
        pendingInvite = '';
        if (canWrite()) { toast(r.instant ? '시험 모드라 바로 인증됐어요' : '인증됐어요. 반가워요!'); closeSheet(); if (f) f(); else render(); }
        else { closeSheet(); toast('신청을 받았어요. 승인되면 MY에 표시돼요'); render(); }
      } catch (e) { show(errText(e)); }
      finally { btn.disabled = false; }
    });
  }
  function closeSheet() { const sh = sheetEl(); if (!sh) return; sh.hidden = true; sh.innerHTML = ''; sheetAfter = null; }

  // ----- 공통 클릭 -----
  document.addEventListener('click', ev => {
    if (!ev.target || !ev.target.closest) return;
    const keep = ev.target.closest('a[data-keep]'); if (keep) { listState.keep = true; listState.scroll = window.scrollY; }
    const b = ev.target.closest('[data-back]'); if (b) { ev.preventDefault(); back(b.dataset.back); return; }
    const dc = ev.target.closest('[data-del-cmt]'); if (dc) { delComment(+dc.dataset.delCmt); }
  });

  // ----- 시작 -----
  if (mode === 'local') { const u = local.user(); setMe(u ? pub(u) : null); }
  render();
  // 승인·해제가 다른 기기에서 일어나도 다음에 열 때 맞춘다(화면을 막지 않는다)
  if (me && mode === 'server') api('me').then(r => { setMe(r.user); }).catch(e => { if (e && e.code === 'unknown_user') setMe(null); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
})();

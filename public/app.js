/* 육아맨 화면(2026-11-04, 앱개발부).
   해시 주소: #/ 홈 · #/guide[/<분류>] 아빠 가이드 · #/g/<가이드 id> 가이드 글 · #/community[/<분류>] 커뮤니티 · #/p/<글 번호> 글 · #/write 글쓰기 · #/me MY
   커뮤니티 글·댓글: 서버(/api, server/app.js)가 있으면 서버에, 없으면(정적 서버·파일로 열기) 시험 모드 — 견본 글(sample-data.js) + 이 폰(localStorage)에만 저장.
   가이드 글·급여 계산기 기준: guide-data.js(저장소 안의 글, 서버 없음). 사진·영상 없음 — 줄글 + 댓글만, 검색 됨(11-04 휴먼쌤). */
(function () {
  'use strict';
  const CFG = window.YK_CONFIG || {};
  const GD = window.YK_GUIDES || { cats: [], items: [], calc: null };
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
  const LIM = { nick: [2, 12], title: [2, 60], body: [1, 3000], comment: [1, 1000] };   // server/app.js LIM과 같게
  const PAGE = 20;
  const MSG = {
    login: '닉네임을 먼저 정해 주세요', unknown_user: '이 기기의 닉네임 기록이 없어요. 다시 정해 주세요',
    nick_taken: '이미 쓰는 닉네임이에요', nick_len: '닉네임은 2~12자로 해 주세요', nick_chars: '닉네임은 한글·영문·숫자만 쓸 수 있어요',
    limit: '너무 자주 올렸어요. 잠시 뒤에 다시 해 주세요', title_len: '제목은 2~60자로 해 주세요', body_len: '내용을 적어 주세요(3000자까지)',
    comment_len: '댓글은 1~1000자로 해 주세요', cat: '분류를 골라 주세요', not_found: '글을 찾을 수 없어요(지워졌을 수 있어요)',
    forbidden: '내가 쓴 것만 지울 수 있어요', bad_json: '보낼 내용이 잘못됐어요', server: '서버에 문제가 있어요. 잠시 뒤 다시 해 주세요', network: '인터넷 연결을 확인해 주세요'
  };

  // ----- 도구 -----
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.prototype.slice.call((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const rich = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const len = s => Array.from(String(s || '')).length;
  const fmtNum = n => Number(n || 0).toLocaleString('ko-KR');
  const fmtMan = n => fmtNum(n) + '만원';
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
  const avatar = nick => '<span class="avatar">' + esc(first(nick)) + '</span>';
  const nickKey = s => String(s).replace(/\s+/g, '').toLowerCase();
  const clean = (s, n) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim().slice(0, n);
  function checkNick(nick) { const n = len(nick); if (n < LIM.nick[0] || n > LIM.nick[1]) return 'nick_len'; if (!/^[가-힣A-Za-z0-9 _.]+$/.test(nick)) return 'nick_chars'; return ''; }
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
  function setMe(u) { me = u ? { id: u.id, nick: u.nick, created: u.created } : null; if (me) store.set('me', me); else store.del('me'); }
  const pub = u => ({ id: u.id, nick: u.nick, created: u.created });

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
    join: nick => remote.call('POST', '/join', { nick }),
    me: () => remote.call('GET', '/me'),
    rename: nick => remote.call('PATCH', '/me', { nick }),
    createPost: p => remote.call('POST', '/posts', p),
    deletePost: id => remote.call('DELETE', '/posts/' + id),
    addComment: (id, body) => remote.call('POST', '/posts/' + id + '/comments', { body }),
    deleteComment: id => remote.call('DELETE', '/comments/' + id)
  };

  // 시험 모드: 견본 글 + 이 기기(localStorage). 서버와 같은 응답 꼴.
  const local = {
    db: null,
    load() { if (this.db) return this.db; let d = store.get('local'); if (!d || d.v !== 1) d = this.seed(); this.db = d; return d; },
    seed() {
      const S = window.YK_SAMPLE || { users: [], posts: [], comments: [] };
      const at = h => new Date(Date.now() - (h || 0) * 3600e3).toISOString();
      const d = { v: 1, seq: { user: 100, post: 100, comment: 100 },
        users: S.users.map(u => ({ id: u.id, nick: u.nick, created: at(u.h), token: null })),
        posts: S.posts.map(p => ({ id: p.id, user_id: p.user_id, cat: p.cat, title: p.title, body: p.body, created: at(p.h), deleted: null })),
        comments: S.comments.map(c => ({ id: c.id, post_id: c.post_id, user_id: c.user_id, body: c.body, created: at(c.h), deleted: null })) };
      store.set('local', d); return d;
    },
    save() { store.set('local', this.db); },
    nick(uid) { const u = this.db.users.find(x => x.id === uid); return u ? u.nick : '?'; },
    user() { return this.load().users.find(u => u.token && u.token === token()) || null; },
    need() { const u = this.user(); if (!u) throw new ApiError('login', 401); return u; },
    card(p) { const d = this.db; return { id: p.id, cat: p.cat, title: p.title, preview: p.body.slice(0, 140), created: p.created, comments: d.comments.filter(c => c.post_id === p.id && !c.deleted).length, nick: this.nick(p.user_id), uid: p.user_id }; },
    async listPosts(p) {
      const d = this.load(), limit = p.limit || PAGE, q = String(p.q || '').toLowerCase();
      let rows = d.posts.filter(x => !x.deleted && (!p.cat || x.cat === p.cat) && (!q || (x.title + '\n' + x.body).toLowerCase().indexOf(q) >= 0) && (!p.before || x.id < p.before)).sort((a, b) => b.id - a.id);
      const more = rows.length > limit; rows = rows.slice(0, limit);
      return { ok: true, posts: rows.map(x => this.card(x)), next: more ? rows[rows.length - 1].id : null };
    },
    async getPost(id) {
      const d = this.load(); const p = d.posts.find(x => x.id === id && !x.deleted); if (!p) throw new ApiError('not_found', 404);
      const post = this.card(p); post.body = p.body;
      return { ok: true, post, comments: d.comments.filter(c => c.post_id === id && !c.deleted).map(c => ({ id: c.id, body: c.body, created: c.created, nick: this.nick(c.user_id), uid: c.user_id })) };
    },
    async join(nick) {
      const d = this.load(); const have = this.user(); if (have) return { ok: true, user: pub(have), existing: true };
      const bad = checkNick(nick); if (bad) throw new ApiError(bad);
      if (d.users.some(u => nickKey(u.nick) === nickKey(nick))) throw new ApiError('nick_taken', 409);
      const u = { id: d.seq.user++, nick, created: new Date().toISOString(), token: token() }; d.users.push(u); this.save();
      return { ok: true, user: pub(u) };
    },
    async me() {
      const u = this.need(); const d = this.db;
      return { ok: true, user: pub(u),
        posts: d.posts.filter(p => p.user_id === u.id && !p.deleted).sort((a, b) => b.id - a.id).map(p => this.card(p)),
        comments: d.comments.filter(c => c.user_id === u.id && !c.deleted).sort((a, b) => b.id - a.id)
          .map(c => { const p = d.posts.find(x => x.id === c.post_id && !x.deleted); return p ? { id: c.id, body: c.body, created: c.created, post_id: c.post_id, post_title: p.title } : null; }).filter(Boolean) };
    },
    async rename(nick) { const u = this.need(); const bad = checkNick(nick); if (bad) throw new ApiError(bad); if (this.db.users.some(x => x.id !== u.id && nickKey(x.nick) === nickKey(nick))) throw new ApiError('nick_taken', 409); u.nick = nick; this.save(); return { ok: true, user: pub(u) }; },
    async createPost(p) {
      const u = this.need(); const bad = checkPost(p); if (bad) throw new ApiError(bad); const d = this.db;
      const post = { id: d.seq.post++, user_id: u.id, cat: p.cat, title: p.title, body: p.body, created: new Date().toISOString(), deleted: null }; d.posts.push(post); this.save();
      const c = this.card(post); c.body = post.body; return { ok: true, id: post.id, post: c };
    },
    async deletePost(id) { const u = this.need(); const p = this.db.posts.find(x => x.id === id && !x.deleted); if (!p) throw new ApiError('not_found', 404); if (p.user_id !== u.id) throw new ApiError('forbidden', 403); p.deleted = new Date().toISOString(); this.save(); return { ok: true }; },
    async addComment(id, body) {
      const u = this.need(); body = clean(body, 2000); if (len(body) < 1 || len(body) > LIM.comment[1]) throw new ApiError('comment_len');
      const d = this.db; if (!d.posts.find(x => x.id === id && !x.deleted)) throw new ApiError('not_found', 404);
      const c = { id: d.seq.comment++, post_id: id, user_id: u.id, body, created: new Date().toISOString(), deleted: null }; d.comments.push(c); this.save();
      return { ok: true, comment: { id: c.id, body, created: c.created, nick: u.nick, uid: u.id } };
    },
    async deleteComment(id) { const u = this.need(); const c = this.db.comments.find(x => x.id === id && !x.deleted); if (!c) throw new ApiError('not_found', 404); if (c.user_id !== u.id) throw new ApiError('forbidden', 403); c.deleted = new Date().toISOString(); this.save(); return { ok: true }; }
  };

  async function api(name) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (mode === 'local') return local[name].apply(local, args);
    try { return await remote[name].apply(remote, args); }
    catch (e) { if (e && e.code === 'no_api') { setMode('local'); return local[name].apply(local, args); } throw e; }
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
    toast(MSG[code] || MSG.server, 'err');
    if (window.console && code === 'server') console.warn('yukaman', e);
  }
  const empty = (title, sub) => '<div class="empty"><div class="big">🍼</div>' + esc(title) + (sub ? '<br><span style="font-weight:600;font-size:13px">' + esc(sub) + '</span>' : '') + '</div>';
  const mockBadge = () => '<div class="mock" id="mockBadge"><span>🧪</span><span>시험 모드 — 커뮤니티 글은 견본이고, 쓴 글은 이 기기에만 저장돼요.</span></div>';

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
    if (s[0] === 'community') return { name: 'community', cat: s[1] && CAT[s[1]] ? s[1] : '' };
    if (s[0] === 'p' && /^\d+$/.test(s[1] || '')) return { name: 'post', id: +s[1] };
    if (s[0] === 'write') return { name: 'write' };
    if (s[0] === 'me') return { name: 'me' };
    return { name: 'home' };
  }
  async function render() {
    const r = parse();
    closeSheet(); app.classList.remove('notab', 'composing'); fab.hidden = true;
    try {
      if (r.name === 'home') await renderHome();
      else if (r.name === 'guide') renderGuide(r.cat);
      else if (r.name === 'garticle') renderGuideItem(r.id);
      else if (r.name === 'community') await renderCommunity(r.cat);
      else if (r.name === 'post') await renderPost(r.id);
      else if (r.name === 'write') renderWrite();
      else if (r.name === 'me') await renderMe();
    } catch (e) { fail(e); }
  }
  window.addEventListener('hashchange', () => { navDepth++; render(); });

  // ----- 홈 -----
  async function renderHome() {
    setTab('home');
    bar(brandBar());
    view.innerHTML = '<section class="pad"><div class="loading">불러오는 중…</div></section>';
    let posts = [], err = null;
    try { posts = (await api('listPosts', { limit: 4 })).posts; } catch (e) { err = e; }
    const C = GD.calc, feat = GD.items.filter(g => g.home).slice(0, 3);
    view.innerHTML = '<section class="pad">'
      + '<div class="hero"><p class="hi">' + (me ? esc(me.nick) + '님, 안녕하세요' : '육아하는 아빠들의 동네') + '</p><h1>서로 묻고, 알려 주고,<br>자랑하는 곳</h1><p>아빠 가이드로 제도를 챙기고,<br>커뮤니티에서 아빠끼리 솔직하게.</p><div class="mascot">' + LOGO + '</div></div>'
      + (mode === 'local' ? mockBadge() : '')
      + '<div class="sec"><h2>아빠 가이드</h2><a class="all" href="#/guide">전체 보기 →</a></div>'
      + (C ? '<a class="gcalc" href="#/guide/leave" style="display:block;margin-top:0"><div class="top"><b>💰 육아휴직 급여 계산기</b><span class="fold">열기</span></div><div class="big"><small>월급 ' + fmtNum(C.example) + '만원 기준</small><strong>연 ' + fmtMan(calcTotal(C.example, 12, false)) + '</strong><em>탭해서 내 급여로 계산해 보세요</em></div></a>' : '')
      + '<div class="glist" style="margin-top:8px">' + feat.map(grow).join('') + '</div>'
      + '<div class="sec"><h2>커뮤니티 새 글</h2><a class="all" href="#/community">전체 보기 →</a></div>'
      + '<div class="list" id="homeList">' + (err ? empty('글을 못 불러왔어요', '잠시 뒤 다시 열어 주세요') : (posts.length ? posts.map(pcard).join('') : empty('아직 글이 없어요', '첫 글을 써 보세요!'))) + '</div>'
      + '<p class="foot-note">육아맨 ' + esc(CFG.VERSION || '') + ' · 사진·영상 없이 줄글로 · 닉네임만으로 시작</p>'
      + '</section>';
    window.scrollTo(0, 0);
    if (err) fail(err);
  }

  // ----- 아빠 가이드 -----
  const tagCls = t => t === 'NEW' ? 'new' : t === '인기' ? 'hot' : t === '필수' ? '' : 'gray';
  function grow(g) {
    return '<a class="grow" href="#/g/' + esc(g.id) + '"><span class="ge">' + esc(g.e) + '</span><span class="tx"><b>' + esc(g.title) + '</b><small>' + esc(g.sub) + '</small></span>'
      + (g.tag ? '<span class="tag ' + tagCls(g.tag) + '">' + esc(g.tag) + '</span>' : '') + '</a>';
  }
  function renderGuide(cat) {
    setTab('guide');
    bar(brandBar());
    const items = GD.items.filter(g => g.cat === cat);
    view.innerHTML = '<section class="pad">'
      + '<h1 class="htitle">아빠 가이드 📚</h1><p class="hsub">아빠 육아의 모든 것, 한 곳에</p>'
      + '<div class="chips">' + GD.cats.map(c => '<a class="chip' + (c.key === cat ? ' on' : '') + '" href="#/guide/' + c.key + '"><span class="e">' + c.e + '</span>' + esc(c.name) + '</a>').join('') + '</div>'
      + (cat === 'leave' && GD.calc ? calcBox() : '')
      + '<div class="glist">' + (items.length ? items.map(grow).join('') : empty('준비 중이에요', '곧 글이 올라와요')) + '</div>'
      + '<div class="draft"><span>✍️</span><span>가이드 글은 육아맨 초안이에요(확인 전). 제도·금액은 고용24(work24.go.kr)와 회사 인사팀에서 꼭 다시 확인해 주세요.</span></div>'
      + '</section>';
    window.scrollTo(0, 0);
    bindCalc();
  }
  function blocks(b) {
    return (b || []).map(x => x.h ? '<h2>' + esc(x.h) + '</h2>' : x.p ? '<p>' + rich(x.p) + '</p>'
      : x.ul ? '<ul>' + x.ul.map(i => '<li>' + rich(i) + '</li>').join('') + '</ul>' : x.ol ? '<ol>' + x.ol.map(i => '<li>' + rich(i) + '</li>').join('') + '</ol>'
      : x.tip ? '<div class="tipbox">💡 ' + rich(x.tip) + '</div>' : x.tpl ? '<pre class="tpl">' + esc(x.tpl) + '</pre>' : '').join('');
  }
  function renderGuideItem(id) {
    setTab('guide');
    const g = GD.items.find(x => x.id === id);
    if (!g) { bar(backBtn('#/guide') + '<div class="fill atitle">아빠 가이드</div>'); view.innerHTML = '<section class="pad">' + empty('글을 찾을 수 없어요', '') + '</section>'; return; }
    const c = GCAT[g.cat] || {};
    bar(backBtn('#/guide/' + g.cat) + '<div class="fill atitle">아빠 가이드 · ' + esc(c.name || '') + '</div>');
    view.innerHTML = '<section class="pad"><article class="garticle">'
      + '<div class="meta"><span class="badge c-etc">' + esc(c.e || '') + ' ' + esc(c.name || '') + '</span>' + (g.tag ? '<span class="tag ' + tagCls(g.tag) + '">' + esc(g.tag) + '</span>' : '') + '</div>'
      + '<h1>' + esc(g.title) + '</h1><p class="gsub">' + esc(g.sub) + '</p>'
      + (g.status !== '검증' ? '<div class="draft"><span>✍️</span><span>초안(확인 전) · ' + esc(g.updated || '') + ' 기준. 제도·금액은 바뀔 수 있어 고용24·인사팀에서 꼭 확인해 주세요.</span></div>' : '')
      + (g.calc && GD.calc ? calcBox() : '')
      + blocks(g.body)
      + (g.sources && g.sources.length ? '<div class="srcs"><b>출처</b><ul>' + g.sources.map(s => '<li><a href="' + esc(s.u) + '" target="_blank" rel="noopener">' + esc(s.t) + '</a></li>').join('') + '</ul></div>' : '')
      + '</article>'
      + (g.community && CAT[g.community] ? '<a class="glink" href="#/community/' + esc(g.community) + '"><span>💬 커뮤니티 "' + esc(CAT[g.community].name) + '"에서 아빠들 경험 보기</span><span>→</span></a>' : '')
      + '</section>';
    window.scrollTo(0, 0);
    bindCalc();
  }

  // 육아휴직 급여 계산기(기준은 guide-data.js calc)
  const calcState = { pay: 0, months: 12, both: false, open: false };
  function calcRows(pay, months, both) {
    const C = GD.calc, rows = [];
    for (let m = 1; m <= months; m++) {
      let rate = 1, cap;
      if (both && m <= 6) cap = C.six.caps[m - 1];
      else { const b = C.base.find(x => m <= x.to) || C.base[C.base.length - 1]; rate = b.rate; cap = b.cap; }
      let v = Math.min(pay * rate, cap);
      if (C.floor) v = Math.max(v, Math.min(C.floor, pay));
      rows.push({ m, v: Math.round(v), rate, cap });
    }
    return rows;
  }
  const calcTotal = (pay, months, both) => calcRows(pay, months, both).reduce((s, r) => s + r.v, 0);
  function groupRows(rows) { const out = []; rows.forEach(r => { const g = out[out.length - 1]; if (g && g.v === r.v && g.cap === r.cap && g.rate === r.rate) g.to = r.m; else out.push({ from: r.m, to: r.m, v: r.v, cap: r.cap, rate: r.rate }); }); return out; }
  function calcResult() {
    const C = GD.calc, pay = calcState.pay || C.example, rows = calcRows(pay, calcState.months, calcState.both), total = rows.reduce((s, r) => s + r.v, 0);
    return {
      big: '<small>월급(통상임금) ' + fmtNum(pay) + '만원 · ' + calcState.months + '개월' + (calcState.both ? ' · 6+6' : '') + ' 기준</small><strong>' + (calcState.months === 12 ? '연 ' : '총 ') + fmtMan(total) + '</strong><em>' + (calcState.open ? '아래에서 내 급여로 바꿔 보세요' : '펼쳐서 내 급여로 계산해 보세요') + '</em>',
      tbl: groupRows(rows).map(g => '<tr><td>' + (g.from === g.to ? g.from + '개월' : g.from + '~' + g.to + '개월') + ' <span style="color:var(--mute);font-weight:600">' + (g.rate === 1 ? '100%' : Math.round(g.rate * 100) + '%') + ' · 상한 ' + g.cap + '</span></td><td>월 ' + fmtNum(g.v) + '만원</td></tr>').join('')
        + '<tr class="sum"><td>합계</td><td>' + fmtMan(total) + '</td></tr>'
    };
  }
  function calcBox() {
    const C = GD.calc, pay = calcState.pay || C.example, r = calcResult();
    return '<div class="gcalc" id="calc"><div class="top"><b>💰 육아휴직 급여 계산기</b><button type="button" class="fold" id="calcFold">' + (calcState.open ? '접기' : '펼치기') + '</button></div>'
      + '<div class="big" id="calcBig">' + r.big + '</div>'
      + '<div id="calcBody"' + (calcState.open ? '' : ' hidden') + '><div class="calcform">'
      + '<label>월 통상임금(만원)<input class="inp" id="calcPay" type="number" inputmode="numeric" min="0" max="2000" step="10" value="' + pay + '"></label>'
      + '<label>휴직 기간<select class="inp" id="calcMonths">' + [3, 6, 9, 12, 18].map(m => '<option value="' + m + '"' + (m === calcState.months ? ' selected' : '') + '>' + m + '개월</option>').join('') + '</select></label>'
      + '<label class="chk"><input type="checkbox" id="calcBoth"' + (calcState.both ? ' checked' : '') + '> 배우자도 같은 아이로 육아휴직을 써요 (6+6 부모육아휴직제, 생후 18개월 안)</label></div>'
      + '<table class="calctbl" id="calcTbl">' + r.tbl + '</table>'
      + '<p class="calcnote">' + esc(C.note) + '</p></div></div>';
  }
  function bindCalc() {
    const box = $('#calc'); if (!box) return;
    const upd = () => {
      const pay = $('#calcPay'), mo = $('#calcMonths'), both = $('#calcBoth');
      if (pay) calcState.pay = Math.max(0, Math.min(2000, Math.round(+pay.value || 0)));
      if (mo) calcState.months = +mo.value || 12;
      if (both) calcState.both = both.checked;
      const r = calcResult(); const b = $('#calcBig'), t = $('#calcTbl'); if (b) b.innerHTML = r.big; if (t) t.innerHTML = r.tbl;
    };
    $('#calcFold').addEventListener('click', () => {
      calcState.open = !calcState.open; if (!calcState.pay) calcState.pay = GD.calc.example;
      $('#calcBody').hidden = !calcState.open; $('#calcFold').textContent = calcState.open ? '접기' : '펼치기'; upd();
      if (calcState.open) { const p = $('#calcPay'); if (p) { p.focus(); p.select(); } }
    });
    ['#calcPay', '#calcMonths', '#calcBoth'].forEach(s => { const el = $(s); if (el) { el.addEventListener('change', upd); el.addEventListener('input', upd); } });
  }

  // ----- 커뮤니티 -----
  const listState = { cat: '', q: '', posts: [], next: null, scroll: 0, keep: false };
  function chip(key, name, e, cur) { return '<a class="chip' + (key === cur ? ' on' : '') + '" href="#/community' + (key ? '/' + key : '') + '"><span class="e">' + e + '</span>' + esc(name) + '</a>'; }
  function pcard(p) {
    const c = CAT[p.cat] || { name: p.cat, e: '' };
    return '<a class="pcard" href="#/p/' + p.id + '" data-keep="1"><div class="meta"><span class="badge c-' + (CAT[p.cat] ? esc(p.cat) : 'etc') + '">' + c.e + ' ' + esc(c.name) + '</span><span class="time">' + ago(p.created) + '</span></div>'
      + '<h3>' + esc(p.title) + '</h3><p>' + esc(p.preview || '') + '</p>'
      + '<div class="foot"><span class="nick">' + avatar(p.nick) + esc(p.nick) + '</span><span class="cmt">' + ICON.chat + ' ' + (p.comments || 0) + '</span></div></a>';
  }
  async function renderCommunity(cat) {
    setTab('community'); fab.hidden = false;
    bar(brandBar('<button class="circ" id="btnSearch" aria-label="검색">' + ICON.search + '</button>'));
    const reuse = listState.keep && listState.cat === cat && listState.posts.length > 0;
    listState.keep = false;
    if (!reuse) { listState.cat = cat; listState.q = ''; listState.posts = []; listState.next = null; }
    const q = listState.q;
    view.innerHTML = '<section class="pad">'
      + '<h1 class="htitle">커뮤니티 💬</h1><p class="hsub">사진·영상 없이 줄글로, 아빠끼리 솔직하게</p>'
      + '<div class="chips">' + chip('', '전체', '🏠', cat) + CATS.map(c => chip(c.key, c.name, c.e, cat)).join('') + '</div>'
      + '<div class="searchbar" id="searchbar"' + (q ? '' : ' hidden') + '><input id="q" type="search" placeholder="제목·내용 검색" enterkeyhint="search" autocomplete="off" value="' + esc(q) + '"><button type="button" class="sx" id="qx" aria-label="검색 지우기">✕</button></div>'
      + (mode === 'local' ? mockBadge() : '')
      + '<div class="list" id="list"></div><button type="button" class="more" id="more" hidden>더 보기</button>'
      + '</section>';
    $('#btnSearch').addEventListener('click', () => { const sb = $('#searchbar'); sb.hidden = !sb.hidden; if (!sb.hidden) $('#q').focus(); else if (listState.q) { listState.q = ''; loadList(false); } });
    $('#q').addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); listState.q = $('#q').value.trim(); $('#q').blur(); loadList(false); } });
    $('#qx').addEventListener('click', () => { $('#q').value = ''; $('#searchbar').hidden = true; if (listState.q) { listState.q = ''; loadList(false); } });
    $('#more').addEventListener('click', () => loadList(true));
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
  function cmtItem(c) {
    const mine = me && c.uid === me.id;
    return '<div class="cmt-item" id="c' + c.id + '"><div class="top"><span class="nick">' + avatar(c.nick) + esc(c.nick) + '</span><span class="right"><span class="time">' + ago(c.created) + '</span>'
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
    const p = r.post, c = CAT[p.cat] || { name: p.cat, e: '' }, mine = me && p.uid === me.id;
    if (mine) $('#postAct').innerHTML = '<button type="button" class="abtn danger" id="delPost">삭제</button>';
    view.innerHTML = '<section class="pad">'
      + '<article class="post"><div class="meta"><span class="badge c-' + (CAT[p.cat] ? esc(p.cat) : 'etc') + '">' + c.e + ' ' + esc(c.name) + '</span><span class="time">' + ago(p.created) + '</span></div>'
      + '<h1>' + esc(p.title) + '</h1><div class="byline"><span class="nick">' + avatar(p.nick) + esc(p.nick) + '</span><span>' + ymd(p.created) + '</span></div>'
      + '<div class="body">' + rich(p.body) + '</div></article>'
      + '<div class="sec"><h2>댓글 <span id="cmtN">' + r.comments.length + '</span></h2></div>'
      + '<div class="cmts" id="cmts">' + (r.comments.length ? r.comments.map(cmtItem).join('') : empty('첫 댓글을 남겨 보세요', '')) + '</div>'
      + '</section>'
      + '<form class="composer" id="composer"><textarea id="cbody" rows="1" placeholder="' + (me ? '댓글을 남겨 보세요' : '닉네임을 정하면 댓글을 쓸 수 있어요') + '" maxlength="1000"></textarea><button class="send" type="submit" aria-label="보내기">' + ICON.send + '</button></form>';
    const form = $('#composer'), ta = $('#cbody');
    autosize(ta);
    const submit = async () => {
      const body = ta.value.trim(); if (!body) return;
      if (!me) { openSheet(submit); return; }
      const btn = $('.send', form); btn.disabled = true;
      try {
        const rr = await api('addComment', id, body);
        ta.value = ''; autosize(ta);
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
    view.innerHTML = '<section class="pad"><form class="form" id="wform" novalidate>'
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
    const submit = async () => {
      const p = { cat: picked, title: clean(title.value, 200), body: clean(body.value, 5000) };
      const bad = checkPost(p);
      if (bad) { toast(MSG[bad], 'err'); (bad === 'cat' ? $('#catpick') : bad === 'title_len' ? title : body).scrollIntoView({ block: 'center' }); if (bad !== 'cat') (bad === 'title_len' ? title : body).focus(); return; }
      if (!me) { openSheet(submit); return; }
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
      + '<li>저장하는 것: 닉네임, 내가 쓴 글·댓글뿐. 이메일·전화번호·아이 정보는 받지 않아요.</li>'
      + '<li>사진·영상 없이 글로만. 글은 모두에게 보여요.</li>'
      + '<li>내 글·댓글은 내가 지울 수 있어요. 이 기기의 브라우저 저장소를 지우면 닉네임과 연결이 끊겨요.</li>'
      + (mode === 'local' ? '<li>지금은 시험 모드 — 글이 이 기기에만 저장돼요.</li>' : '') + '</ul></div>';
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
  async function renderMe() {
    setTab('me');
    bar(brandBar());
    if (!me) {
      view.innerHTML = '<section class="pad"><h1 class="htitle">MY</h1>'
        + '<div class="profile" style="margin-top:12px"><span class="big">👋</span><div class="tx"><b>아직 닉네임이 없어요</b><small>닉네임만 정하면 글과 댓글을 쓸 수 있어요. 로그인·이메일 없음.</small></div></div>'
        + '<button type="button" class="btn primary" id="startBtn" style="margin-top:12px">닉네임 정하고 시작하기</button>' + installBox() + aboutBox() + '</section>';
      $('#startBtn').addEventListener('click', () => openSheet(() => render()));
      bindInstall(); window.scrollTo(0, 0); return;
    }
    view.innerHTML = '<section class="pad"><div class="loading">불러오는 중…</div></section>';
    let r;
    try { r = await api('me'); } catch (e) { view.innerHTML = '<section class="pad">' + empty('내 정보를 못 불러왔어요', '잠시 뒤 다시 열어 주세요') + '</section>'; fail(e, () => render()); return; }
    setMe(r.user);
    view.innerHTML = '<section class="pad"><h1 class="htitle">MY</h1>'
      + '<div class="profile" style="margin-top:12px"><span class="big">' + esc(first(r.user.nick)) + '</span><div class="tx"><b>' + esc(r.user.nick) + '</b><small>' + ymd(r.user.created) + '부터 육아맨 · 글 ' + r.posts.length + ' · 댓글 ' + r.comments.length + '</small></div><button type="button" class="edit" id="editNick">닉네임 바꾸기</button></div>'
      + '<div class="seg"><button type="button" class="' + (meSeg === 'posts' ? 'on' : '') + '" data-seg="posts">내 글 ' + r.posts.length + '</button><button type="button" class="' + (meSeg === 'comments' ? 'on' : '') + '" data-seg="comments">내 댓글 ' + r.comments.length + '</button></div>'
      + '<div class="list" id="meList"></div>' + installBox() + aboutBox() + '</section>';
    const paint = () => {
      $('#meList').innerHTML = meSeg === 'posts'
        ? (r.posts.length ? r.posts.map(pcard).join('') : empty('아직 쓴 글이 없어요', '커뮤니티에서 첫 글을 써 보세요'))
        : (r.comments.length ? r.comments.map(c => '<a class="mycmt" href="#/p/' + c.post_id + '"><small>' + esc(c.post_title) + ' · ' + ago(c.created) + '</small><p>' + esc(c.body) + '</p></a>').join('') : empty('아직 쓴 댓글이 없어요', ''));
    };
    paint();
    $$('.seg button').forEach(b => b.addEventListener('click', () => { meSeg = b.dataset.seg; $$('.seg button').forEach(x => x.classList.toggle('on', x === b)); paint(); }));
    $('#editNick').addEventListener('click', () => openSheet(() => render(), 'rename'));
    bindInstall(); window.scrollTo(0, 0);
  }

  // ----- 바텀시트: 닉네임 정하기 · 바꾸기 -----
  let sheetAfter = null;
  function openSheet(after, kind) {
    sheetAfter = typeof after === 'function' ? after : null;
    const rename = kind === 'rename';
    const sh = $('#sheet'); sh.hidden = false;
    sh.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + (rename ? '닉네임 바꾸기' : '닉네임 정하기') + '"><div class="grip"></div>'
      + '<h2>' + (rename ? '닉네임 바꾸기' : '육아맨에 온 걸 환영해요 👋') + '</h2>'
      + '<p>' + (rename ? '하루 3번까지 바꿀 수 있어요. 지난 글의 이름도 함께 바뀌어요.' : '육아하는 아빠들이 서로 묻고, 알려 주고, 자랑하는 곳이에요. 닉네임 하나면 바로 시작할 수 있어요. 로그인·이메일 없음.') + '</p>'
      + '<label class="lbl" for="nick">닉네임</label><input class="inp" id="nick" maxlength="12" placeholder="예: 초보대디" autocomplete="off" enterkeyhint="done" value="' + (rename && me ? esc(me.nick) : '') + '">'
      + '<small class="hint">2~12자 · 한글·영문·숫자 · 글에 그대로 보여요</small>'
      + (rename ? '' : '<label class="chk"><input type="checkbox" id="agree"> 서로 존중하고, 아이의 이름·얼굴 같은 개인정보는 올리지 않을게요.</label>')
      + '<div class="err" id="nickErr" hidden></div>'
      + '<button type="button" class="btn primary" id="joinBtn">' + (rename ? '바꾸기' : '시작하기') + '</button>'
      + '<button type="button" class="btn ghost" id="laterBtn">' + (rename ? '취소' : '둘러보기만 할래요') + '</button></div>';
    $('#laterBtn').addEventListener('click', closeSheet);
    sh.addEventListener('click', ev => { if (ev.target === sh) closeSheet(); });
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
      const r = await api(rename ? 'rename' : 'join', nick);
      setMe(r.user);
      if (r.existing && r.user.nick !== nick) toast('이 기기는 이미 "' + r.user.nick + '"으로 등록돼 있어요');
      else toast(rename ? '닉네임을 바꿨어요' : '반가워요, ' + r.user.nick + '님!');
      const f = sheetAfter; closeSheet(); if (f) f(); else render();
    } catch (e) {
      const code = e && e.code; err.hidden = false; err.textContent = MSG[code] || (e && e.name === 'TypeError' ? MSG.network : MSG.server);
    } finally { btn.disabled = false; }
  }
  function closeSheet() { const sh = $('#sheet'); if (!sh) return; sh.hidden = true; sh.innerHTML = ''; sheetAfter = null; }

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
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
})();

/* 육아맨 화면(2026-11-04, 앱개발부).
   해시 주소: #/ 홈 · #/guide[/<분류>] 아빠 가이드 · #/g/<id> 가이드 글 · #/calc[/<종류>] 계산기 · #/library 자료실
              #/community[/<분류>] 커뮤니티 · #/p/<번호> 글 · #/write 글쓰기 · #/me MY · #/join/<코드> 초대 · #/admin 관리자
   커뮤니티 글·댓글·인증: 서버(/api, server/app.js)에. 시험 모드(견본 글 sample-data.js + 이 기기 localStorage)는 config.js API_URL이 비었거나, 파일로 열었거나, 내 컴퓨터(localhost)에서 /api가 없을 때만.
   운영 주소에서는 서버가 JSON이 아닌 것을 돌려줘도(오류 페이지·와이파이 로그인 페이지) 시험 모드로 바꾸지 않고 "서버에 연결할 수 없어요"만 보인다(11-04 검수 1).
   계정: 기기 토큰(localStorage) + 가입 때 한 번 보여 주는 복구 코드(폰 바꿀 때) · 이 기기 로그아웃 · 탈퇴(11-04 검수 3·5).
   가이드 글: guide-data.js · 자료실: data/library.json · 계산: calc.js(법령 기준, test/calc-test.js). 사진·영상 없음 — 줄글 + 댓글만, 검색 됨(11-04 휴먼쌤).
   아빠 인증: 커뮤니티는 읽기도 쓰기도 인증 아빠만(2026-11-04 휴먼쌤 "인증 아빠만"), 가이드·계산기·자료실은 누구나. 초대 코드(바로) 또는 신청서(관리자 승인). 서류·아이 정보는 받지 않는다. */
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
    { key: 'school', name: '학교·학습', e: '🏫' },
    { key: 'gear', name: '용품·장비', e: '🍼' }
  ];
  const CAT = {}; CATS.forEach(c => { CAT[c.key] = c; });
  const GCAT = {}; GD.cats.forEach(c => { GCAT[c.key] = c; });
  const LIM = { nick: [2, 12], title: [2, 60], body: [1, 3000], comment: [1, 1000], answer: [20, 500] };   // server/app.js LIM과 같게
  const PAGE = 20;
  const RESERVED = /(육아맨|운영|관리|자료실|공식|스태프|스탭|매니저|마스터|휴먼쌤|휴먼샘|admin|official|staff|manager|master|moderator|yukaman|humanssaem)/i;   // server/app.js와 같게
  const foldNick = s => s.replace(/[\s_.\-]+/g, '').toLowerCase().replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/5/g, 's');
  const MSG = {
    login: '닉네임을 먼저 정해 주세요', unknown_user: '이 기기의 닉네임 기록이 없어요. 다시 정해 주세요',
    nick_taken: '이미 쓰는 닉네임이에요', nick_len: '닉네임은 2~12자로 해 주세요', nick_chars: '닉네임은 한글·영문·숫자만 쓸 수 있어요', nick_reserved: '운영 계정과 헷갈리는 이름은 쓸 수 없어요',
    limit: '너무 자주 했어요. 잠시 뒤에 다시 해 주세요', title_len: '제목은 2~60자로 해 주세요', body_len: '내용을 적어 주세요(3000자까지)',
    comment_len: '댓글은 1~1000자로 해 주세요', cat: '분류를 골라 주세요', not_found: '글을 찾을 수 없어요(지워졌을 수 있어요)',
    forbidden: '내가 쓴 것만 지울 수 있어요', bad_json: '보낼 내용이 잘못됐어요', server: '서버에 문제가 있어요. 잠시 뒤 다시 해 주세요', network: '인터넷 연결을 확인해 주세요',
    own: '내가 쓴 글은 신고할 수 없어요', no_api: '서버에 연결할 수 없어요. 잠시 뒤 다시 열어 주세요', recovery_bad: '맞지 않는 복구 코드예요', token_in_use: '이 기기에 이미 다른 닉네임이 있어요',
    verify: '커뮤니티는 인증한 아빠만 읽고 쓸 수 있어요', blocked: '이용이 제한된 계정이에요',
    code_bad: '맞지 않는 초대 코드예요', code_used: '이미 쓴 초대 코드예요', stage: '지금 상황을 골라 주세요', answer_len: '이야기는 20자 이상으로 적어 주세요', pledge: '약속에 체크해 주세요', invite_max: '초대 코드는 3개까지 만들 수 있어요'
  };

  // ----- 도구 -----
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.prototype.slice.call((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // 주소에 쓰는 글자만 링크로(한글 조사 "…com에서"가 붙지 않게). 끝의 문장 부호는 뺀다
  const rich = s => esc(s).replace(/https?:\/\/[A-Za-z0-9\-._~:\/?#\[\]@!$&;=%+,*()]+/g, m => { const t = m.replace(/(&#39;|&quot;|[.,;:!?)\]])+$/, ''); return '<a href="' + t + '" target="_blank" rel="noopener">' + t + '</a>' + m.slice(t.length); });
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
  const vbadge = b => (b === 'official' ? '<span class="vb of">자료</span>' : b === 'admin' ? '<span class="vb of">운영</span>' : b === 'dad' ? '<span class="vb" title="인증 아빠" aria-label="인증 아빠">' + CHECK + '</span>' : '');
  const avatar = nick => '<span class="avatar">' + esc(first(nick)) + '</span>';
  const who = (nick, badge) => '<span class="nick">' + avatar(nick) + esc(nick) + vbadge(badge) + '</span>';
  const nickKey = s => String(s).replace(/\s+/g, '').toLowerCase();
  const clean = (s, n) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim().slice(0, n);
  function checkNick(nick) { const n = len(nick); if (n < LIM.nick[0] || n > LIM.nick[1]) return 'nick_len'; if (!/^[가-힣A-Za-z0-9 _.]+$/.test(nick)) return 'nick_chars'; if (RESERVED.test(foldNick(nick))) return 'nick_reserved'; return ''; }
  function checkPost(p) { if (!CAT[p.cat]) return 'cat'; const t = len(p.title), b = len(p.body); if (t < LIM.title[0] || t > LIM.title[1]) return 'title_len'; if (b < LIM.body[0] || b > LIM.body[1]) return 'body_len'; return ''; }
  const ICON = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M4 12 20 4l-4 16-4-7z"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>'
  };
  const LOGO = '<svg aria-hidden="true" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#14213D"/><path transform="translate(4.5086 36.9683) scale(0.0208)" d="M678 -464H204Q121 -464 72.5 -508.5Q24 -553 24 -642Q24 -746 72 -786Q120 -826 204 -827H678Q767 -827 812.5 -786.5Q858 -746 858 -642Q858 -552 811 -507.5Q764 -463 678 -464ZM581 -653H301Q296 -653 294 -652Q292 -651 292 -644Q292 -637 294 -636Q296 -635 301 -635H581Q586 -635 588 -636Q590 -637 590 -644Q590 -651 588 -652Q586 -653 581 -653ZM869 -442V-244H743V-212H842V42H563V-1H32V-212H140V-244H14V-442ZM383 -212H500V-244H383Z M1692 -583H1755V-304H1692V42H1422V-822H1692ZM1395 -620V-199Q1396 -110 1336 -55.5Q1276 -1 1148 -1Q1065 -1 1008 -27Q951 -53 921.5 -97.5Q892 -142 891 -197V-617Q891 -671 920 -715.5Q949 -760 1006.5 -786Q1064 -812 1148 -812Q1232 -812 1286 -787Q1340 -762 1366.5 -719Q1393 -676 1395 -620ZM1157 -285V-528Q1157 -532 1155.5 -537Q1154 -542 1143 -542Q1133 -542 1131.5 -537Q1130 -532 1130 -528V-285Q1130 -282 1131.5 -277Q1133 -272 1143 -272Q1154 -272 1155.5 -277Q1157 -282 1157 -285Z M2439 -426H2408V-246H2237V-813H2408V-669H2439V-822H2619V-228H2439ZM1782 -795H2214V-313H1782ZM1989 -476H2007V-632H1989ZM2106 -286V-196H2628V42H1818V-286Z" fill="#FFFFFF" stroke="#14213D" stroke-width="33.3" stroke-linejoin="round"/><rect y="41.6" width="64" height="7.04" fill="#FFC914"/></svg>';   // 띠 로고 1(11-04 휴먼쌤 확정): 남색 타일 + 육아맨(Gasoek One, 두께 10% 줄임) + 노란 밑줄 띠. tools/make_logo.py가 구운 선 — icons/logo.svg · tools/build_icons.py와 같게
  const WORDMARK = '<svg aria-hidden="true" viewBox="0 0 308.8055 134"><path transform="translate(2.389 95.1669) scale(0.1151)" d="M678 -464H204Q121 -464 72.5 -508.5Q24 -553 24 -642Q24 -746 72 -786Q120 -826 204 -827H678Q767 -827 812.5 -786.5Q858 -746 858 -642Q858 -552 811 -507.5Q764 -463 678 -464ZM581 -653H301Q296 -653 294 -652Q292 -651 292 -644Q292 -637 294 -636Q296 -635 301 -635H581Q586 -635 588 -636Q590 -637 590 -644Q590 -651 588 -652Q586 -653 581 -653ZM869 -442V-244H743V-212H842V42H563V-1H32V-212H140V-244H14V-442ZM383 -212H500V-244H383Z M1692 -583H1755V-304H1692V42H1422V-822H1692ZM1395 -620V-199Q1396 -110 1336 -55.5Q1276 -1 1148 -1Q1065 -1 1008 -27Q951 -53 921.5 -97.5Q892 -142 891 -197V-617Q891 -671 920 -715.5Q949 -760 1006.5 -786Q1064 -812 1148 -812Q1232 -812 1286 -787Q1340 -762 1366.5 -719Q1393 -676 1395 -620ZM1157 -285V-528Q1157 -532 1155.5 -537Q1154 -542 1143 -542Q1133 -542 1131.5 -537Q1130 -532 1130 -528V-285Q1130 -282 1131.5 -277Q1133 -272 1143 -272Q1154 -272 1155.5 -277Q1157 -282 1157 -285Z M2439 -426H2408V-246H2237V-813H2408V-669H2439V-822H2619V-228H2439ZM1782 -795H2214V-313H1782ZM1989 -476H2007V-632H1989ZM2106 -286V-196H2628V42H1818V-286Z" fill="currentColor" style="stroke:var(--bg,#fff)" stroke-width="33.3" stroke-linejoin="round"/><rect y="110" width="308.8055" height="24" fill="#FFC914"/></svg>';   // 앱 바 글자 로고. 글자색은 currentColor, 깎는 선은 바탕색(--bg)

  // 글꼴은 화면을 막지 않게(index.html media=print → 여기서 all)
  (function () { const f = document.getElementById('fontcss'); if (f) requestAnimationFrame(() => { f.media = 'all'; }); })();
  // 다크 모드: 저장값 auto(기기 따름) · light · dark. <html data-theme>로 CSS가 바뀐다(검수 25)
  function applyTheme() {
    const pref = store.get('theme', 'auto');
    const dark = pref === 'dark' || (pref === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', dark ? '#141A26' : '#FFFBF0');
  }
  applyTheme();
  if (window.matchMedia) { const q = matchMedia('(prefers-color-scheme: dark)'); if (q.addEventListener) q.addEventListener('change', applyTheme); }

  // ----- 나(닉네임 + 기기 토큰) -----
  function randomToken() { const a = new Uint8Array(24); crypto.getRandomValues(a); let s = ''; a.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function token() { let t = store.get('token'); if (!t || !/^[A-Za-z0-9_-]{16,80}$/.test(t)) { t = randomToken(); store.set('token', t); } return t; }
  let me = store.get('me', null);
  function setMe(u) { me = u ? { id: u.id, nick: u.nick, created: u.created, verified: !!u.verified, role: u.role || 'user', how: u.how || '', blocked: !!u.blocked } : null; if (me) store.set('me', me); else store.del('me'); }
  const canWrite = () => me && !me.blocked && (me.verified || me.role === 'admin');
  const canRead = canWrite;   // 커뮤니티 읽기 자격은 쓰기와 같다
  const pub = u => ({ id: u.id, nick: u.nick, created: u.created, verified: !!u.verified, role: 'user', how: u.how || '', blocked: false });
  // 초대 링크(#/join/코드)의 코드는 이 기기에 남겨 둔다 — 주소가 #/me로 바뀌거나 새로고침해도 사라지지 않게(11-04 검수 6). 쓰이면 지운다.
  let pendingInvite = store.get('invite', '');
  let invitePrompted = false;          // 이번에 열어 둔 동안 초대 시트를 한 번만 자동으로 띄운다("둘러보기"를 눌렀는데 MY마다 다시 뜨지 않게)
  const keepInvite = code => { pendingInvite = code; store.set('invite', code); };
  const clearInvite = () => { pendingInvite = ''; store.del('invite'); };

  // ----- 서버 / 시험 모드 -----
  function ApiError(code, status) { this.name = 'ApiError'; this.code = code; this.status = status || 400; this.message = code; }
  ApiError.prototype = Object.create(Error.prototype);
  let mode = (!CFG.API_URL || location.protocol === 'file:') ? 'local' : 'server';
  // /api가 JSON이 아닌 것을 돌려줄 때 시험 모드로 바꾸는 것은 내 컴퓨터(정적 서버로 public/만 열었을 때)에서만. 운영 주소에서는 오류로 알린다.
  const DEV_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

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
    adminInvites: (count, note) => remote.call('POST', '/admin/invites', { count, note }),
    recover: code => remote.call('POST', '/recover', { code }),
    recoveryNew: () => remote.call('POST', '/recovery/new', {}),
    logout: () => remote.call('POST', '/logout', {}),
    deleteMe: () => remote.call('DELETE', '/me', { confirm: true }),
    report: (kind, id, reason) => remote.call('POST', '/reports', { kind, id, reason }),
    seen: () => remote.call('POST', '/me/seen', {}),
    adminReport: (kind, id, action) => remote.call('POST', '/admin/report', { kind, id, action })
  };

  // 시험 모드: 견본 글 + 이 기기(localStorage). 서버와 같은 응답 꼴. 코드는 아무 글자나, 신청서는 바로 승인된다.
  const local = {
    db: null,
    load() { if (this.db) return this.db; let d = store.get('local'); if (!d || d.v !== 3) d = this.seed(); this.db = d; return d; },
    seed() {
      const S = window.YK_SAMPLE || { users: [], posts: [], comments: [] };
      const at = h => new Date(Date.now() - (h || 0) * 3600e3).toISOString();
      const d = { v: 3, seq: { user: 100, post: 100, comment: 100 }, invites: [],
        users: S.users.map(u => ({ id: u.id, nick: u.nick, created: at(u.h), token: null, verified: true })),
        posts: S.posts.map(p => ({ id: p.id, user_id: p.user_id, cat: p.cat, age: p.age || '', title: p.title, body: p.body, created: at(p.h), deleted: null })),
        comments: S.comments.map(c => ({ id: c.id, post_id: c.post_id, user_id: c.user_id, body: c.body, created: at(c.h), deleted: null })) };
      store.set('local', d); return d;
    },
    save() { store.set('local', this.db); },
    u(uid) { return this.db.users.find(x => x.id === uid) || { nick: '?' }; },
    badge(uid) { return this.u(uid).verified ? 'dad' : ''; },
    user() { return this.load().users.find(u => u.token && u.token === token()) || null; },
    need() { const u = this.user(); if (!u) throw new ApiError('login', 401); return u; },
    needDad() { const u = this.need(); if (!u.verified) throw new ApiError('verify', 403); return u; },
    card(p) { const d = this.db; return { id: p.id, cat: p.cat, age: p.age || '', title: p.title, preview: p.body.slice(0, 140), created: p.created, comments: d.comments.filter(c => c.post_id === p.id && !c.deleted).length, nick: this.u(p.user_id).nick, uid: p.user_id, badge: this.badge(p.user_id) }; },
    async listPosts(p) {
      this.needDad();
      const d = this.load(), limit = p.limit || PAGE, words = String(p.q || '').toLowerCase().split(/\s+/).filter(Boolean);
      let rows = d.posts.filter(x => { if (x.deleted || (p.cat && x.cat !== p.cat) || (p.age && x.age !== p.age) || (p.before && x.id >= p.before)) return false; const hay = (x.title + '\n' + x.body).toLowerCase(); return words.every(w => hay.indexOf(w) >= 0); }).sort((a, b) => b.id - a.id);
      const more = rows.length > limit; rows = rows.slice(0, limit);
      return { ok: true, posts: rows.map(x => this.card(x)), next: more ? rows[rows.length - 1].id : null };
    },
    async getPost(id) {
      this.needDad();
      const d = this.load(); const p = d.posts.find(x => x.id === id && !x.deleted); if (!p) throw new ApiError('not_found', 404);
      const post = this.card(p); post.body = p.body;
      return { ok: true, post, comments: d.comments.filter(c => c.post_id === id && !c.deleted).map(c => ({ id: c.id, body: c.body, created: c.created, nick: this.u(c.user_id).nick, uid: c.user_id, badge: this.badge(c.user_id) })) };
    },
    async join(nick, invite) {
      const d = this.load(); const have = this.user(); if (have) return { ok: true, user: pub(have), existing: true };
      const bad = checkNick(nick); if (bad) throw new ApiError(bad);
      if (d.users.some(u => nickKey(u.nick) === nickKey(nick))) throw new ApiError('nick_taken', 409);
      const u = { id: d.seq.user++, nick, created: new Date().toISOString(), token: token(), verified: !!invite, how: invite ? 'invite' : '', recovery: this.newRec() }; d.users.push(u); this.save();
      return { ok: true, user: pub(u), recovery: u.recovery };
    },
    async report() { this.needDad(); return { ok: true }; },
    async seen() { return { ok: true }; },
    newRec() { const d = this.load(); d.seq.rec = (d.seq.rec || 0) + 1; return 'TEST-' + String(1000 + d.seq.rec) + '-RCVR'; },
    async recover(code) {
      const d = this.load(), c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const u = d.users.find(x => x.recovery && x.recovery.replace(/-/g, '') === c); if (!u) throw new ApiError('recovery_bad');
      u.token = token(); u.recovery = this.newRec(); this.save(); return { ok: true, user: pub(u), recovery: u.recovery };
    },
    async recoveryNew() { const u = this.need(); u.recovery = this.newRec(); this.save(); return { ok: true, recovery: u.recovery }; },
    async logout() { const u = this.need(); u.token = null; this.save(); return { ok: true }; },
    async deleteMe() {
      const u = this.need(), d = this.db, at = new Date().toISOString();
      d.posts.filter(p => p.user_id === u.id).forEach(p => { p.deleted = p.deleted || at; p.title = ''; p.body = ''; });
      d.comments.filter(c => c.user_id === u.id).forEach(c => { c.deleted = c.deleted || at; c.body = ''; });
      d.users = d.users.filter(x => x.id !== u.id); this.save(); return { ok: true };
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
      const post = { id: d.seq.post++, user_id: u.id, cat: p.cat, age: AGE[p.age] ? p.age : '', title: p.title, body: p.body, created: new Date().toISOString(), deleted: null }; d.posts.push(post); this.save();
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
    catch (e) { if (e && e.code === 'no_api' && DEV_HOST) { setMode('local'); if (!local[name]) throw new ApiError('server'); return local[name].apply(local, args); } throw e; }
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
    if (window.console && (code === 'server' || code === 'no_api')) console.warn('yukaman', e);
  }
  // 서버가 커뮤니티 읽기를 막았을 때(인증 해제·막힘·모르는 기기): 내 정보를 맞추고 true를 돌려준다. 화면은 잠금으로 바꾼다.
  function readDenied(e) {
    const code = e && e.code;
    if (code === 'verify') { if (me) { me.verified = false; store.set('me', me); } return true; }
    if (code === 'blocked') { if (me) { me.blocked = true; store.set('me', me); } return true; }
    if (code === 'unknown_user') { setMe(null); return true; }
    return code === 'login';
  }
  const errText = e => { const code = e && e.code; return MSG[code] || (e && e.name === 'TypeError' ? MSG.network : MSG.server); };
  const empty = (title, sub) => '<div class="empty"><div class="big">🍼</div>' + esc(title) + (sub ? '<br><span style="font-weight:600;font-size:13px">' + esc(sub) + '</span>' : '') + '</div>';
  const mockBadge = () => '<div class="mock" id="mockBadge"><span>🧪</span><span>시험 모드예요. 커뮤니티 글은 지어낸 견본이고, 쓴 글은 이 기기에만 저장돼요.</span></div>';

  // ----- 화면 틀 -----
  const view = $('#view'), appbar = $('#appbar'), app = $('#app'), fab = $('#fab');
  const bar = h => { appbar.innerHTML = h; };
  const brandBar = (right) => '<div class="brand"><span class="logo">' + LOGO + '</span><span class="wm" role="img" aria-label="육아맨">' + WORDMARK + '</span></div><div class="fill"></div>' + (right || '');
  const backBtn = to => '<button class="circ" data-back="' + esc(to) + '" aria-label="뒤로">' + ICON.back + '</button>';
  function setTab(name) { $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name)); }
  function go(h, replace) { if (replace) { if (location.hash !== h) navReplace = true; location.replace(h); } else location.hash = h; }
  // 앱 안에서 지나온 주소를 기억한다. 시스템 뒤로 가기로 돌아와도 어긋나지 않고, 앱 첫 화면이면 밖으로 나가는 대신 목록으로 간다.
  const navStack = [location.hash];
  let navReplace = false;
  function trackNav() {
    const h = location.hash;
    if (navReplace) { navReplace = false; navStack[navStack.length - 1] = h; return; }
    if (navStack.length > 1 && navStack[navStack.length - 2] === h) navStack.pop(); else navStack.push(h);
  }
  function back(to) { if (navStack.length > 1) history.back(); else go(to, true); }
  // 늦게 온 응답이 지금 화면을 덮어쓰지 않게 화면마다 번호를 둔다
  let renderSeq = 0;

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
    if (s[0] === 'terms') return { name: 'legal', kind: 'terms' };
    if (s[0] === 'privacy') return { name: 'legal', kind: 'privacy' };
    return { name: 'home' };
  }
  async function render() {
    const r = parse();
    renderSeq++;
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
      else if (r.name === 'legal') renderLegal(r.kind);
      else if (r.name === 'join') { if (r.code) { keepInvite(r.code); invitePrompted = false; } go('#/me', true); }
    } catch (e) { fail(e); }
  }
  window.addEventListener('hashchange', () => { trackNav(); render(); });

  // ----- 계산기 공통 상태(이 기기에만 저장) -----
  const CALC_TABS = [
    { key: 'leave', name: '육아휴직 급여', e: '💰' },
    { key: 'reduce', name: '단축근무 급여', e: '⏰' },
    { key: 'paternity', name: '배우자 출산휴가', e: '🏥' },
    { key: 'dates', name: '내 아이 날짜', e: '📅' }
  ];
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  // 기본 시작일: 회사 신청 기한(30일 전)이 아직 남은 가장 가까운 1일(11-04 검수 9 — 다음 달 1일로 두면 이미 지난 기한을 챙기라고 한다)
  function nextFirst() { const d = new Date(); let t = new Date(d.getFullYear(), d.getMonth() + 1, 1); if ((t - d) / 86400000 < 31) t = new Date(d.getFullYear(), d.getMonth() + 2, 1); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-01'; }
  const calcS = Object.assign({ pay: 350, start: nextFirst(), months: 12, end: '', mode: 'general', spouseMonths: 6, spouseInsured: true, spousePay: '', company: '', birth: '', due: '', before: 40, after: 30, rMonths: 12, priority: true, days: 20 }, store.get('calc', {}));
  if (!K.parse(calcS.start)) calcS.start = nextFirst();
  if (!K.parse(calcS.end)) calcS.end = K.addDays(K.addMonths(calcS.start, 12), -1);
  const saveCalc = () => store.set('calc', calcS);
  const toWon = v => Math.round((parseFloat(v) || 0) * 10000);

  // 홈·가이드의 계산기 카드: 월급만 넣으면 바로 계산된다(일반 12개월). 자세히는 #/calc/leave
  function quickCalc(man) { const s = '2027-01-01'; return K.leaveBenefit({ ordinary: toWon(man), start: s, end: K.addDays(K.addMonths(s, 12), -1) }); }
  // 달마다 받는 돈을 함께 보여 준다. 월 250만원을 넘으면 상한에 걸려 총액이 같으니, 고장처럼 보이지 않게 까닭을 적는다
  function quickNote(man) {
    if (!toWon(man)) return '월 통상임금을 넣으면 바로 계산돼요.';
    const r = quickCalc(man), m = [r.rows[0].paid, r.rows[3].paid, r.rows[6].paid];
    return '1~3개월 월 ' + won(m[0]) + ' · 4~6개월 월 ' + won(m[1]) + ' · 7개월부터 월 ' + won(m[2]) + (toWon(man) >= 2500000 ? '<br>법정 상한에 걸려 월급이 더 많아도 금액이 같아요.' : '');
  }
  const quickTotal = man => (toWon(man) ? won(quickCalc(man).total) : '—');     // 0원이면 하한 70만원으로 계산된 840만원이 나와 버리니 비워 둔다
  function calcCard() {
    return '<div class="gcalc" id="qcalc"><div class="top"><b>💰 육아휴직 급여 계산기</b><a class="fold" href="#/calc/leave">자세히</a></div>'
      + '<div class="big"><label class="qpay">내 월 통상임금 <input id="qPay" type="number" inputmode="decimal" min="0" max="3000" step="10" value="' + esc(calcS.pay) + '" aria-label="월 통상임금(만원)"> 만원</label>'
      + '<strong id="qTotal">' + quickTotal(calcS.pay) + '</strong><em>12개월 쉬면 받는 돈(일반 기준)</em><small class="qnote" id="qNote">' + quickNote(calcS.pay) + '</small></div></div>';
  }
  function bindCalcCard() {
    const p = $('#qPay'); if (!p) return;
    p.addEventListener('input', () => { calcS.pay = parseFloat(p.value) || 0; saveCalc(); $('#qTotal').textContent = quickTotal(calcS.pay); $('#qNote').innerHTML = quickNote(calcS.pay); });
  }

  // ----- 홈 -----
  // 내 아이 나이로 보기(검수 11). 고른 값은 이 기기에만. ids = 지금 쓸 수 있는 글
  const AGES = [
    { key: 'expect', name: '곧 태어나요', note: '배우자 출산휴가는 예정일 50일 전부터, 위험이 있으면 임신 중에도 육아휴직을 쓸 수 있어요.', ids: ['policy-pregnancy', 'policy-paternity', 'leave-66', 'leave-apply', 'ivf-leave'] },
    { key: 'baby', name: '0~18개월', note: '6+6은 부모 모두 고용보험 가입자이고 생후 18개월 안에 시작할 때만이에요. 지금이 기회일 수 있어요.', ids: ['birth-2weeks', 'policy-paternity', 'leave-66', 'leave-apply', 'policy-shorter-hours', 'baby-care', 'mind-dad-blues', 'play-0-12'] },
    { key: 'kid', name: '미취학', note: '육아휴직과 단축근무 모두 쓸 수 있어요. 어린이집이 쉬는 날에는 단기 육아휴직과 가족돌봄휴가가 있어요.', ids: ['leave-apply', 'leave-short', 'policy-shorter-hours', 'family-care', 'play-weekend', 'mind-anger'] },
    { key: 'low', name: '초1~2', note: '육아휴직은 초2까지(또는 만 8세 이하)예요. 방학에는 단기 육아휴직 1~2주를 쓸 수 있어요.', ids: ['leave-apply', 'leave-short', 'policy-shorter-hours', 'family-care', 'play-school'] },
    { key: 'high', name: '초3~6', note: '육아휴직은 만 9세 생일 전까지만 돼요. 주로 쓰는 것은 단축근무(초6 또는 만 12세까지)와 가족돌봄휴가예요.', ids: ['policy-shorter-hours', 'family-care', 'play-school', 'mind-anger', 'leave-rights'] },
    { key: 'teen', name: '중학생~', note: '단축근무는 만 13세 생일 전까지만 돼요. 아이가 아플 때는 나이 제한 없는 가족돌봄휴가가 있어요.', ids: ['family-care', 'policy-shorter-hours', 'mind-couple'] }
  ];
  const AGE = {}; AGES.forEach(a => { AGE[a.key] = a; });
  // 홈 '아이 나이 길'(UI 3안, 11-04 휴먼쌤 선택): 계산기 '내 아이 날짜'에 넣은 생일·예정일(이 기기에만)로 나이 칸을 맞추고, 직접 고른 값이 있으면 그것을 쓴다
  const daysTo = s => { const t = K.parse(s); return t == null ? null : Math.round((t - K.parse(todayStr())) / 86400000); };
  const kidDates = () => ({ birth: K.parse(calcS.birth) != null ? calcS.birth : '', due: K.parse(calcS.due) != null ? calcS.due : '' });
  function kidMonths(birth) { const b = new Date(K.parse(birth)), t = new Date(K.parse(todayStr())); return (t.getUTCFullYear() - b.getUTCFullYear()) * 12 + (t.getUTCMonth() - b.getUTCMonth()) - (t.getUTCDate() < b.getUTCDate() ? 1 : 0); }
  function ageKeyAuto() {
    const k = kidDates();
    if (!k.birth) return k.due && daysTo(k.due) >= 0 ? 'expect' : '';
    const months = kidMonths(k.birth);
    if (months < 0) return 'expect';
    if (months < 18) return 'baby';
    // 초등학교는 만 6세가 되는 해의 다음 해 3월 입학(계산기와 같은 기준). 학년도는 3월에 시작한다
    const b = new Date(K.parse(k.birth)), t = new Date(K.parse(todayStr()));
    const grade = (t.getUTCMonth() >= 2 ? t.getUTCFullYear() : t.getUTCFullYear() - 1) - (b.getUTCFullYear() + 7) + 1;
    return grade < 1 ? 'kid' : grade <= 2 ? 'low' : grade <= 6 ? 'high' : 'teen';
  }
  const currentAge = () => { const m = store.get('age', ''); return AGE[m] ? m : ageKeyAuto(); };
  function kidLine() {
    const k = kidDates();
    if (k.birth) { const m = Math.max(0, kidMonths(k.birth)), b = new Date(K.parse(k.birth)); return (m < 24 ? '생후 ' + m + '개월' : '만 ' + Math.floor(m / 12) + '세') + ' · ' + b.getUTCFullYear() + '년 ' + (b.getUTCMonth() + 1) + '월생'; }
    if (k.due) { const n = daysTo(k.due); return '출산 예정 ' + dot(k.due) + (n >= 0 ? ' · D-' + n : ''); }
    return '';
  }
  const agesRow = cur => '<div class="ages" id="ages" role="group" aria-label="아이 나이">' + AGES.map(x => '<button type="button" class="chip' + (x.key === cur ? ' on' : '') + '" data-age="' + x.key + '" aria-pressed="' + (x.key === cur) + '">' + esc(x.name) + '</button>').join('') + '</div>';
  function kidCard() {
    const line = kidLine();
    return '<div class="kid"><span class="tx"><small>우리 아이</small><b>' + (line ? esc(line) : '생일이나 예정일을 넣으면 기한을 D-데이로 보여 드려요') + '</b></span><button type="button" class="edit" id="kidEdit">' + (line ? '날짜 고치기' : '날짜 넣기') + '</button></div>';
  }
  // 날짜만 고치는 시트(11-04 휴먼쌤 "계산기로 이동해서 불편해"). 계산기 '내 아이 날짜'와 같은 값(calcS)을 쓴다. 날짜를 바꾸면 손으로 고른 나이 칸은 풀고 날짜를 따른다
  function openKidDates() {
    const k = kidDates();
    showSheet('<div class="sheet" role="dialog" aria-modal="true" aria-label="우리 아이 날짜"><div class="grip"></div><h2>우리 아이 날짜</h2><p>둘 중 하나만 넣어도 돼요. 이 기기에만 저장하고 서버로 보내지 않아요.</p>'
      + '<div class="two" style="margin-top:14px">' + dateField('kBirth', '태어난 날', k.birth) + dateField('kDue', '출산 예정일', k.due) + '</div>'
      + '<div class="err" id="kErr" hidden></div>'
      + '<button type="button" class="btn primary" id="kSave">저장</button>'
      + (k.birth || k.due ? '<button type="button" class="btn line" id="kClear">날짜 지우기</button>' : '')
      + '<button type="button" class="btn ghost" id="kCancel">취소</button></div>');
    const done = msg => { saveCalc(); store.del('age'); closeSheet(); toast(msg); render(); };
    $('#kSave').addEventListener('click', () => {
      const b = $('#kBirth').value, due = $('#kDue').value, err = $('#kErr');
      if (b && b > todayStr()) { err.hidden = false; err.textContent = '태어난 날이 오늘보다 뒤예요. 아직 태어나지 않았다면 출산 예정일 칸에 넣어 주세요'; return; }
      calcS.birth = b; calcS.due = due; done('날짜를 저장했어요');
    });
    const c = $('#kClear'); if (c) c.addEventListener('click', () => { calcS.birth = ''; calcS.due = ''; done('날짜를 지웠어요'); });
    $('#kCancel').addEventListener('click', closeSheet);
  }
  // 나이마다 지금 챙길 것, 순서대로. by = 마지막 날(날짜를 넣었을 때), from = 시작할 수 있는 날, lab = 날짜가 없을 때의 기준. 근거는 각 가이드 글에
  function tlItems(key, d) {
    const L = {
      expect: [
        { t: '배우자 출산휴가 신청 가능', s: '20일 유급. 예정일 50일 전부터 쓸 수 있어요(3번까지 나눠서)', by: d.paternityFrom, from: true, lab: '예정일 50일 전부터', h: '#/g/policy-paternity' },
        { t: '임신 중 육아휴직', s: '유산·조산 위험이 있으면 임신 중에도 쓸 수 있어요', lab: '임신 중', h: '#/g/policy-pregnancy' },
        { t: '태어나고 2주 안에 할 일', s: '출생신고 1개월 · 부모급여 60일 · 첫만남이용권', lab: '출생 뒤', h: '#/g/birth-2weeks' },
        { t: '6+6 시작 기한', s: '부모 모두 생후 18개월 안에 시작해야 첫 6개월 상한이 올라가요', by: d.bothStartBy, lab: '생후 18개월 안', h: '#/calc/leave', go: '우리 집 금액 계산하기' }
      ],
      baby: [
        { t: '배우자 출산휴가 마지막 날', s: '출산 후 120일 안에 20일을 다 써야 해요(3번까지 나눠서)', by: d.paternityTo, lab: '출생 후 120일 안', h: '#/g/policy-paternity' },
        { t: '출생신고', s: '출생 후 1개월 안. 늦으면 과태료', by: d.birthReportBy, lab: '출생 후 1개월 안', h: '#/g/birth-2weeks' },
        { t: '부모급여 신청', s: '60일 안에 신청하면 태어난 달부터 받아요', by: d.parentPayBy, lab: '출생 후 60일 안', h: '#/g/birth-2weeks' },
        { t: '6+6 시작 기한', s: '부모 모두 생후 18개월 안에 시작해야 첫 6개월 상한이 월 최대 450만원까지 올라가요', by: d.bothStartBy, lab: '생후 18개월 안', h: '#/calc/leave', go: '우리 집 금액 계산하기' },
        { t: '육아휴직 급여 신청', s: '휴직 시작 1개월 뒤부터, 끝난 뒤 12개월 안에 고용24에서', lab: '휴직 뒤 12개월 안', h: '#/g/leave-apply' },
        { t: '첫만남이용권', s: '2024년 이후 출생아는 2년 안에 신청·사용', by: d.firstVoucherBy, lab: '2년 안', h: '#/g/birth-2weeks' },
        { t: '육아기 근로시간 단축', s: '주 15~35시간. 휴직을 안 쓴 기간은 2배로 쓸 수 있어요', by: d.reduceStartBy, lab: '만 12세 또는 초6까지', h: '#/g/policy-shorter-hours' }
      ],
      kid: [
        { t: '육아휴직 시작 기한', s: '만 8세 이하 또는 초2 이하, 늦은 날까지 시작하면 돼요', by: d.leaveStartBy, lab: '만 8세 또는 초2까지', h: '#/g/leave-apply' },
        { t: '단기 육아휴직 1~2주', s: '어린이집이 쉬는 날, 방학에 짧게', lab: '휴원·방학에', h: '#/g/leave-short' },
        { t: '육아기 근로시간 단축', s: '주 15~35시간, 휴직 안 쓴 기간은 2배로', by: d.reduceStartBy, lab: '만 12세 또는 초6까지', h: '#/g/policy-shorter-hours' },
        { t: '가족돌봄휴가', s: '어린이집이 쉬는 날, 아이가 아픈 날', lab: '해마다 10일', h: '#/g/family-care' }
      ],
      high: [
        { t: '육아휴직', s: '만 8세 이하 또는 초2 이하까지만 시작할 수 있어요', by: d.leaveStartBy, lab: '초2까지', h: '#/g/leave-apply' },
        { t: '육아기 근로시간 단축 시작 기한', s: '만 12세 이하 또는 초6 이하, 늦은 날까지', by: d.reduceStartBy, lab: '만 12세 또는 초6까지', h: '#/g/policy-shorter-hours' },
        { t: '가족돌봄휴가', s: '아이가 아프거나 학교가 쉬는 날', lab: '해마다 10일', h: '#/g/family-care' },
        { t: '학교 가는 아이와 아빠', s: '방학 · 돌봄 · 학습, 초등 아빠가 챙길 것', lab: '초등', h: '#/g/play-school' }
      ],
      teen: [
        { t: '육아기 근로시간 단축', s: '만 13세 생일 전까지만 시작할 수 있어요', by: d.reduceStartBy, lab: '만 13세 전', h: '#/g/policy-shorter-hours' },
        { t: '가족돌봄휴가', s: '나이 제한 없이, 아이가 아플 때', lab: '해마다 10일', h: '#/g/family-care' },
        { t: '부부가 같이 버티는 법', s: '사춘기 아이 앞에서 부부 역할 나누기', lab: '마음', h: '#/g/mind-couple' }
      ]
    };
    L.low = L.kid.map(x => (x.t === '육아휴직 시작 기한' ? Object.assign({}, x, { t: '육아휴직은 초2까지', lab: '초2 끝까지' }) : x));
    return L[key] || [];
  }
  function timeline(key, d) {
    const items = tlItems(key, d);
    if (!items.length) return '<div class="about">위에서 아이 나이를 고르면 지금 챙길 것을 순서대로 보여 드려요. 생일을 넣으면 기한이 D-데이로 바뀌어요.</div>';
    return '<div class="tl">' + items.map(x => {
      let state = '', pill = x.lab;
      const n = x.by ? daysTo(x.by) : null;
      if (n != null) {
        if (x.from) { if (n <= 0) { state = 'soon'; pill = '지금 쓸 수 있어요'; } else if (n <= 60) { state = 'soon'; pill = 'D-' + n; } else pill = dot(x.by) + '부터'; }
        else if (n < 0) { state = 'done'; pill = '끝남'; } else if (n <= 60) { state = 'soon'; pill = n ? 'D-' + n : '오늘까지'; } else pill = dot(x.by) + '까지';
      }
      return '<a class="tli ' + state + '" href="' + x.h + '"><span class="top"><b>' + esc(x.t) + '</b><span class="pill ' + state + '">' + esc(pill) + '</span></span><small>' + esc(x.s) + '</small>' + (x.go ? '<span class="go">' + esc(x.go) + ' →</span>' : '') + '</a>';
    }).join('') + '</div>';
  }
  function bindHomeAge() {
    const e = $('#kidEdit'); if (e) e.addEventListener('click', openKidDates);
    const box = $('#ages'); if (!box) return;
    box.addEventListener('click', ev => { const b = ev.target.closest('[data-age]'); if (!b) return; store.set('age', store.get('age', '') === b.dataset.age ? '' : b.dataset.age); renderHome(); });
  }
  // 커뮤니티가 비어 있을 때: 솔직하게 모집 중이라고 말한다(검수 15)
  const emptyCommunity = () => '<div class="lockbox recruit"><div class="lk">👋</div><h2>첫 아빠들을 모으고 있어요</h2><p>아직 아빠들의 글이 많지 않아요. 지금 쓰는 글이 다음 아빠의 첫 답이 돼요. 아는 아빠에게 초대 코드를 보내 함께 시작해 주세요.</p>'
    + '<a class="btn primary" href="#/write">첫 글 쓰기</a><a class="btn line" href="#/me">초대 코드 보내기</a><a class="btn ghost" href="#/guide/faq">자주 묻는 질문은 가이드 Q&amp;A·정보에</a></div>';
  async function renderHome() {
    setTab('home');
    bar(brandBar());
    const seq = renderSeq;
    // 아이 나이 길(UI 3안): 나이 칸 → 우리 아이 → 지금 챙길 것(기한 D-데이) → 이 나이에 맞는 글 → 계산기 → 또래 아빠들 글. 가이드·계산기는 서버를 기다리지 않고 바로 그린다(검수 18)
    const key = currentAge(), a = AGE[key], d = K.childDates(kidDates());
    const picks = a ? a.ids.map(id => GD.items.find(g => g.id === id)).filter(Boolean) : GD.items.filter(g => g.home).slice(0, 3);
    view.innerHTML = '<section class="pad">'
      + (mode === 'local' ? mockBadge() : '')
      + agesRow(key)
      + kidCard()
      + '<div class="sec"><h2>' + (a ? esc(a.name) + ', 지금 챙길 것' : '지금 챙길 것, 순서대로') + '</h2>' + (a ? '<span>순서대로</span>' : '') + '</div>'
      + timeline(key, d)
      + (a ? '<p class="agenote">' + esc(a.note) + '</p>' : '')
      + '<div class="sec"><h2>' + (a ? '이 나이에 맞는 글 ' + picks.length + '편' : '아빠 가이드') + '</h2><a class="all" href="#/guide">전체 보기 →</a></div>'
      + '<div class="glist" style="margin-top:8px">' + picks.slice(0, 4).map(grow).join('') + '<a class="grow" href="#/library"><span class="ge">🗂️</span><span class="tx"><b>남성 육아휴직 자료실</b><small>법령 · 통계 · 연구 · 판례 · 경험담을 키워드로</small></span></a></div>'
      + calcCard()
      + '<div id="homeCom">' + (canRead() ? '<div class="sec"><h2>' + (a ? '또래 아빠들 글' : '커뮤니티 새 글') + '</h2><a class="all" href="#/community">전체 보기 →</a></div><div class="loading">불러오는 중…</div>' : '') + '</div>'
      + '<p class="foot-note">사진·영상 없이 줄글로 · 인증한 아빠끼리<br><a href="#/terms">이용약관</a> · <a href="#/privacy">개인정보 처리방침</a></p>'
      + '</section>';
    window.scrollTo(0, 0);
    bindCalcCard(); bindHomeAge();
    let posts = [], err = null, locked = !canRead(), peers = false;
    if (!locked) {
      try {
        if (key) { posts = (await api('listPosts', { limit: 4, age: key })).posts; peers = posts.length > 0; }
        if (!posts.length) posts = (await api('listPosts', { limit: 4 })).posts;
      } catch (e) { if (readDenied(e)) locked = true; else err = e; }
    }
    if (seq !== renderSeq) return;
    const box = $('#homeCom'); if (!box) return;
    box.innerHTML = locked
      ? '<div class="sec"><h2>커뮤니티</h2></div><a class="notice vcta" id="homeLock" href="#/community"><span class="e">🔒</span><span>커뮤니티 글은 인증한 아빠만 볼 수 있어요. <b>' + (me ? '아빠 인증하기' : '시작하기') + '</b></span></a>'
      : '<div class="sec"><h2>' + (peers ? '또래 아빠들 글' : '커뮤니티 새 글') + '</h2><a class="all" href="#/community">전체 보기 →</a></div>'
        + '<div class="list" id="homeList">' + (err ? empty('글을 못 불러왔어요', '잠시 뒤 다시 열어 주세요') : (posts.length ? posts.map(pcard).join('') : emptyCommunity())) + '</div>';
    if (err) fail(err);
  }

  // ----- 약관 · 개인정보 처리방침(검수 14). 초안이다: 공개 전에 휴먼쌤이 읽고 정한다 -----
  function renderLegal(kind) {
    setTab('me');
    bar(backBtn('#/me') + '<div class="fill atitle">' + (kind === 'terms' ? '이용약관' : '개인정보 처리방침') + '</div>');
    const who = esc(CFG.OPERATOR || '운영자'), mail = CFG.CONTACT ? esc(CFG.CONTACT) : '문의처 준비 중';
    const T = kind === 'terms' ? [
      { h: '서비스' }, { p: '육아맨은 ' + who + '가 운영하는 아빠 육아 가이드와 커뮤니티예요. 가이드·계산기·자료실은 누구나, 커뮤니티는 인증한 아빠만 쓸 수 있어요.' },
      { h: '안내의 한계' }, { p: '제도·금액 안내와 계산 결과는 참고 자료이고 법률·의료·세무 자문이 아니에요. 실제 지급액과 자격은 고용센터 등 담당 기관이 정해요.' },
      { h: '지켜 주세요' }, { ul: ['아이의 이름·얼굴·어린이집 이름처럼 누구인지 알 수 있는 정보를 올리지 않아요.', '다른 사람을 비방하거나 광고·사칭 글을 올리지 않아요.', '인증 신청 내용을 거짓으로 쓰지 않아요.'] },
      { h: '운영' }, { p: '신고된 글이나 위 약속을 어긴 글은 숨길 수 있고, 되풀이되면 이용을 제한할 수 있어요. 글의 권리는 쓴 사람에게 있어요.' },
      { h: '탈퇴' }, { p: 'MY에서 언제든 탈퇴할 수 있고, 내 글과 댓글 내용이 함께 지워져요.' },
      { h: '문의' }, { p: mail }
    ] : [
      { h: '받는 것' }, { ul: ['닉네임, 내가 쓴 글·댓글, 신고 내용', '인증 신청 답변(승인·거절하면 바로 지워요)', '이 기기 토큰과 복구 코드의 해시(원래 값은 서버에 없어요)', '누가 초대했는지, 마지막 접속 시각', '가입·코드·복구 시도 횟수 제한을 위한 기기 주소(IP)의 짧은 해시(이틀 안에 지워요)'] },
      { h: '받지 않는 것' }, { p: '이메일, 전화번호, 서류, 아이 정보. 계산기에 넣은 아이 날짜와 월급은 이 기기에만 저장되고 서버로 보내지 않아요.' },
      { h: '왜 쓰나' }, { p: '커뮤니티 운영, 아빠 인증, 도배·사칭 막기에만 써요. 광고나 판매에 쓰지 않고 다른 곳에 주지 않아요.' },
      { h: '어디에 두나' }, { p: 'Cloudflare(Pages, D1)에 저장해요.' },
      { h: '언제 지우나' }, { p: '글·댓글은 지우는 즉시 내용을 비워요. 탈퇴하면 글·댓글 내용과 계정을 지워요. 막힌 계정의 기록은 재가입을 막기 위해 남을 수 있어요.' },
      { h: '문의' }, { p: who + ' · ' + mail }
    ];
    view.innerHTML = '<section class="pad"><article class="garticle"><div class="draft"><span>📝</span><span>초안이에요. 정식 공개 전에 확정해요.</span></div>' + blocks(T) + '</article></section>';
    window.scrollTo(0, 0);
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
    const note = g.status === '공식 근거' ? '<div class="draft"><span>✅</span><span>' + esc(dot(g.updated)) + '에 법령 원문과 정부·공공기관 안내로 확인했어요. 법률 자문은 아니니 내 경우는 1350이나 고용센터에서 확인해 주세요.</span></div>'
      : g.status === '일반 조언' ? '<div class="draft"><span>✍️</span><span>육아맨이 정리한 일반적인 조언이에요. 집마다 다를 수 있어요.</span></div>'
      : g.status === '자료 정리' ? '<div class="draft"><span>🗂️</span><span>육아맨 자료실이 출처가 있는 자료로 ' + esc(dot(g.updated)) + '에 정리한 글이에요. 법률 자문은 아니니 내 경우는 1350이나 고용센터에서 확인해 주세요.</span></div>' : '';
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
    pay: '월 통상임금을 넣어 주세요. 금액을 모르면 "통상임금이 뭔가요?"를 열어 기본급과 고정 수당을 더해 보세요.',
    dates: '시작일과 끝나는 날을 확인해 주세요.',
    short: '30일 미만이면 보통 급여 대상이 아니에요(고용보험법 제70조). 같은 아이로 앞서 쓴 휴직이 있으면 합쳐서 보니 고용센터에 확인해 주세요. 단기 육아휴직(1주 또는 2주)은 7일 이상이면 돼요.',
    over12: '12개월을 넘는 기간은 부모가 각각 3개월 이상 쓰거나, 한부모·중증 장애아동의 부모일 때 쓸 수 있어요.',
    over18: '육아휴직은 가장 길어도 18개월이에요. 끝나는 날을 앞당겨 주세요.',
    noCommon: '6+6은 부모가 모두 써야 적용돼요. 배우자 사용 기간이 없으면 일반 기준으로 계산돼요.',
    spouseNotInsured: '6+6은 부모가 모두 고용보험에 가입한 근로자일 때만 적용돼요(시행령 제95조의3). 배우자가 공무원·교사·자영업자·전업주부면 일반 기준이라 그렇게 계산했어요.',
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
      + '<div id="bothBox" hidden><span class="lbl">배우자의 고용보험</span><div class="seg" id="cIns"><button type="button" data-i="1">가입한 근로자</button><button type="button" data-i="0">아니에요</button></div>'
      + '<small class="hint">6+6은 부모가 모두 고용보험 피보험자일 때만이에요(시행령 제95조의3). 배우자가 공무원·교사·자영업자·프리랜서·전업주부면 "아니에요"를 골라 주세요. 그러면 일반 기준으로 계산해요.</small>'
      + '<label class="lbl" for="cSpouse">배우자가 쓰는 기간</label><div class="unit"><input class="inp" id="cSpouse" type="number" inputmode="numeric" min="0" max="18" value="' + esc(calcS.spouseMonths) + '"><span>개월</span></div>'
      + manField('cSpousePay', '배우자 월 통상임금 (선택)', calcS.spousePay, '넣으면 우리 집 합계도 보여 드려요.')
      + '<div style="margin-top:12px">' + dateField('cBirth', '아이 태어난 날 (선택)', calcS.birth) + '</div><small class="hint">넣으면 6+6으로 시작할 수 있는 마지막 날을 확인해요. 저장은 이 기기에만 돼요.</small></div>'
      + '<div id="singleBox" hidden><small class="hint">한부모는 한부모가족지원법에 따라 지원 대상으로 인정된 모 또는 부예요. 별거 중이거나 혼자 키운다는 것만으로는 아니에요(시행령 제95조의3 제3항).</small></div>'
      + '<details class="dt"><summary>휴직 중에 회사에서 돈을 받나요?</summary><p>회사에서 받는 돈과 급여를 합해 통상임금을 넘으면, 넘는 만큼 급여에서 빠져요.</p>' + manField('cCompany', '매달 받는 금액', calcS.company) + '</details>'
      + '</div>';
    const out = () => {
      const insured = calcS.spouseInsured !== false;
      const r = K.leaveBenefit({ ordinary: toWon(calcS.pay), start: calcS.start, end: calcS.end, mode: calcS.mode, spouseMonths: calcS.spouseMonths, spouseInsured: insured, companyPay: toWon(calcS.company) });
      const noPay = r.warnings.includes('pay');
      $$('#cMode button').forEach(b => b.classList.toggle('on', b.dataset.m === calcS.mode));
      $('#bothBox').hidden = calcS.mode !== 'both';
      $('#singleBox').hidden = calcS.mode !== 'single';
      $$('#cIns button').forEach(b => b.classList.toggle('on', (b.dataset.i === '1') === insured));
      let compare = '', house = '', birthNote = '';
      if (calcS.mode !== 'general' && r.rows.length && !noPay) {
        const g = K.leaveBenefit({ ordinary: toWon(calcS.pay), start: calcS.start, end: calcS.end, companyPay: toWon(calcS.company) });
        if (r.total > g.total) compare = '<p class="cline">일반 기준보다 <b>' + won(r.total - g.total) + '</b> 더 받아요.</p>';
      }
      if (calcS.mode === 'both' && insured && toWon(calcS.spousePay) > 0 && +calcS.spouseMonths > 0) {
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
      // 회사 신청 기한(시작 30일 전)이 이미 지났으면 "그날까지"가 아니라 지금 할 수 있는 일을 알려 준다(시행령 제11조 제7항: 기한 뒤 신청도 30일 안에 시작일을 정해 허용)
      const late = r.applyBy && r.applyBy < todayStr();
      const dates = '<div class="about"><b>챙길 날짜</b><ul>'
        + (late ? '<li>회사 신청 기한(시작 30일 전, <b>' + dot(r.applyBy) + '</b>)은 지났어요. 회사와 협의하면 지금도 신청할 수 있고, 기한을 넘겨 신청하면 회사는 신청일부터 30일 안에 시작일을 정해 허용해야 해요.</li>'
          : '<li>회사에 신청: <b>' + dot(r.applyBy) + '</b>까지(시작 30일 전)</li>')
        + '<li>급여 신청: <b>' + dot(r.claimFrom) + '</b>부터 <b>' + dot(r.claimTo) + '</b>까지 고용24에서</li></ul></div>';
      $('#calcOut').innerHTML = warnBox(r.warnings) + birthNote + (r.rows.length && !noPay ? '<div class="result"><small>' + r.months + '개월 받는 돈' + (calcS.mode === 'both' && r.common ? ' · 6+6 ' + r.common + '개월' : '') + '</small><strong>' + won(r.total) + '</strong>' + compare + house + '<table class="calctbl">' + tbl + '</table></div>' + dates : '')
        + basis('고용보험법 시행령 제95조·제95조의3·제98조(시행 2026.9.18.)', 'https://m.work24.go.kr/cm/c/f/1100/selecSimulate12.do?systClId=SC00000251&systId=SI00000402', '시작 전 같은 회사 6개월 이상 근무, 고용보험 피보험 단위기간 180일 이상이어야 해요. 실제 금액은 고용센터가 정해요.');
    };
    const setMonths = m => { calcS.end = K.addDays(K.addMonths(calcS.start, m), -1); $('#cEnd').value = calcS.end; saveCalc(); out(); };
    bindInputs({
      cPay: el => { calcS.pay = parseFloat(el.value) || 0; }, cStart: el => { if (K.parse(el.value)) calcS.start = el.value; }, cEnd: el => { if (K.parse(el.value)) calcS.end = el.value; },
      cSpouse: el => { calcS.spouseMonths = parseInt(el.value, 10) || 0; }, cSpousePay: el => { calcS.spousePay = el.value; }, cBirth: el => { calcS.birth = el.value; }, cCompany: el => { calcS.company = el.value; }
    }, out);
    $('#cQuick').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (b) setMonths(+b.dataset.m); });
    $('#cMode').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (b) { calcS.mode = b.dataset.m; saveCalc(); out(); } });
    $('#cIns').addEventListener('click', ev => { const b = ev.target.closest('[data-i]'); if (b) { calcS.spouseInsured = b.dataset.i === '1'; saveCalc(); out(); } });
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
      + '<span class="lbl">하교 시간에 맞춰 퇴근 시각으로 고르기</span><div class="quick" id="cOut">' + [[14, 20], [15, 25], [16, 30], [17, 35]].map(x => '<button type="button" class="chip" data-h="' + x[1] + '">오후 ' + (x[0] - 12) + '시 퇴근</button>').join('') + '</div><small class="hint">9시 출근, 점심 1시간, 주 5일로 계산했어요. 오후 3시 퇴근이면 주 25시간이에요.</small>'
      + '<label class="lbl" for="cMonths">단축 기간</label><div class="unit"><input class="inp" id="cMonths" type="number" inputmode="numeric" min="1" max="36" value="' + esc(calcS.rMonths) + '"><span>개월</span></div>'
      + '<details class="dt"><summary>마지막 달이 한 달을 못 채우나요?</summary><p>못 채운 달의 급여는 일수에 비례해 줄어요. 그 달에 쓰는 일수를 넣으면 합계에 반영해요.</p><div class="unit"><input class="inp" id="cLast" type="number" inputmode="numeric" min="0" max="30" value="' + esc(calcS.rLast || '') + '" aria-label="마지막 달 일수"><span>일</span></div></details></div>';
    const out = () => {
      const r = K.reduceBenefit({ ordinary: toWon(calcS.pay), before: calcS.before, after: calcS.after, months: calcS.rMonths, lastDays: calcS.rLast });
      $('#calcOut').innerHTML = warnBox(r.warnings) + (r.cut > 0 && !r.warnings.includes('pay') ? '<div class="result"><small>단축근무 중 한 달 수입(어림)</small><strong>' + won(r.monthly) + '</strong>'
        + '<table class="calctbl"><tr><td>회사 임금<small>일한 시간에 비례한 어림값</small></td><td>' + won(r.wage) + '</td></tr>'
        + '<tr><td>정부 급여 · 첫 ' + r.firstHours + '시간<small>통상임금 100%, 상한 250만원</small></td><td>' + won(r.first) + '</td></tr>'
        + (r.restHours ? '<tr><td>정부 급여 · 나머지 ' + r.restHours + '시간<small>통상임금 80%, 상한 160만원</small></td><td>' + won(r.rest) + '</td></tr>' : '')
        + (r.reduced ? '<tr><td>감액<small>임금과 급여의 합이 통상임금을 넘는 만큼</small></td><td>-' + won(r.reduced) + '</td></tr>' : '')
        + '<tr class="sum"><td>정부 급여 ' + r.months + '개월 합계</td><td>' + won(r.totalGov) + '</td></tr></table>'
        + '<p class="cline">평소 통상임금보다 한 달에 <b>' + won(Math.max(0, r.lost)) + '</b> 줄고, 주 <b>' + r.cut + '시간</b>을 아이와 더 보내요.</p></div>' : '')
        + basis('고용보험법 시행령 제104조의2(2026.1.1.부터 상한 250만·160만원, 하한 50만원)', 'https://m.work24.go.kr/cm/c/f/1100/selecSimulate13.do?systClId=SC00000252&systId=SI00000397&systCnntId=CI00001582', '실제 회사 임금은 임금 규정에 따라 달라요.');
    };
    bindInputs({ cPay: el => { calcS.pay = parseFloat(el.value) || 0; }, cBefore: el => { calcS.before = parseFloat(el.value) || 0; }, cAfter: el => { calcS.after = parseFloat(el.value) || 0; }, cMonths: el => { calcS.rMonths = parseInt(el.value, 10) || 1; }, cLast: el => { calcS.rLast = parseInt(el.value, 10) || 0; } }, out);
    const pickH = ev => { const b = ev.target.closest('[data-h]'); if (b) { calcS.after = +b.dataset.h; $('#cAfter').value = calcS.after; saveCalc(); out(); } };
    $('#cHours').addEventListener('click', pickH); $('#cOut').addEventListener('click', pickH);
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
      $('#calcOut').innerHTML = warnBox(r.warnings) + (r.warnings.length ? '' : '<div class="result"><small>20일 동안 받는 돈(통상임금 기준)</small><strong>' + won(r.total) + '</strong>'
        + '<table class="calctbl"><tr><td>정부 급여<small>' + (calcS.priority ? '20일 상한 ' + won(r.capAll) + ' · 하한 최저임금' : '우선지원대상기업이 아니면 없음') + '</small></td><td>' + won(r.gov) + '</td></tr>'
        + '<tr><td>회사가 주는 몫<small>유급 휴가라 나머지는 회사 몫</small></td><td>' + won(r.company) + '</td></tr></table></div>')
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
      const after = d.birthReportBy ? '<div class="result"><small>태어난 뒤 챙길 기한</small><table class="calctbl">'
        + row('출생신고', d.birthReportBy, '출생 후 1개월 안. 늦으면 과태료')
        + row('부모급여 신청', d.parentPayBy, '60일 안에 신청하면 태어난 달부터')
        + row('BCG 접종', d.bcgBy, '생후 4주 안')
        + '<tr><td>영유아 건강검진 1차<small>생후 14~35일</small></td><td>' + dot(d.check1From) + '~<br>' + dot(d.check1To) + '</td></tr>'
        + row('첫만남이용권 신청·사용', d.firstVoucherBy, '2024년 이후 출생아는 2년 안')
        + '</table></div><a class="grow" href="#/g/birth-2weeks" style="margin-top:8px"><span class="ge">👶</span><span class="tx"><b>2주 안에 아빠가 할 일</b><small>순서대로 보기</small></span></a>' : '';
      $('#calcOut').innerHTML = d.paternityFrom ? after + '<div class="result"><table class="calctbl">'
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
  const listState = { cat: '', age: '', q: '', posts: [], next: null, scroll: 0, keep: false };   // age = 아이 나이로 거르기(UI 3안). 분류를 바꿔도 유지
  const ageChip = (key, name) => '<button type="button" class="chip' + (key === listState.age ? ' on' : '') + '" data-age="' + key + '" aria-pressed="' + (key === listState.age) + '">' + esc(name) + '</button>';
  function chip(key, name, e, cur) { return '<a class="chip' + (key === cur ? ' on' : '') + '" href="#/community' + (key ? '/' + key : '') + '"><span class="e">' + e + '</span>' + esc(name) + '</a>'; }
  function pcard(p) {
    const c = CAT[p.cat] || { name: p.cat, e: '' };
    return '<a class="pcard" href="#/p/' + p.id + '" data-keep="1"><div class="meta"><span class="badges"><span class="badge c-' + (CAT[p.cat] ? esc(p.cat) : 'etc') + '">' + c.e + ' ' + esc(c.name) + '</span>' + (AGE[p.age] ? '<span class="agetag">' + esc(AGE[p.age].name) + '</span>' : '') + '</span><span class="time">' + ago(p.created) + '</span></div>'
      + '<h3>' + esc(p.title) + '</h3><p>' + esc(p.preview || '') + '</p>'
      + '<div class="foot">' + who(p.nick, p.badge) + '<span class="cmt">' + ICON.chat + ' ' + (p.comments || 0) + '</span></div></a>';
  }
  // 커뮤니티 잠금: 인증 전에는 목록·글·검색을 열지 않고, 왜 닫혀 있는지와 인증하는 길을 보여 준다
  function renderLock() {
    fab.hidden = true;
    view.innerHTML = '<section class="pad"><h1 class="htitle">커뮤니티 💬</h1><p class="hsub">사진·영상 없이 줄글로, 아빠끼리 솔직하게</p>'
      + (mode === 'local' ? mockBadge() : '')
      + '<div class="lockbox" id="lockBox"><div class="lk">🔒</div><h2>인증한 아빠만 볼 수 있어요</h2>'
      + '<p>회사 이야기, 아이 이야기를 마음 놓고 나눌 수 있게 글과 댓글, 검색을 아빠끼리만 열어 두었어요.</p>'
      + '<div class="catpick lockcats">' + CATS.map(c => '<span class="chip"><span class="e">' + c.e + '</span>' + esc(c.name) + '</span>').join('') + '</div>'
      + (me && me.blocked ? '<div class="vstate bad">이용이 제한된 계정이에요.</div>'
        : '<div id="lockCta"><button type="button" class="btn primary" id="lockGo">초대 코드가 있어요</button><button type="button" class="btn line" id="lockNo">코드가 없어요 (신청서)</button><small class="hint">코드가 있으면 바로, 신청서를 쓰면 운영자가 읽고 승인해요. 서류나 사진은 받지 않아요.</small></div>')
      + '</div>'
      + '<div class="sec"><h2>인증 전에도 볼 수 있어요</h2></div>'
      + '<div class="glist" style="margin-top:0">'
      + '<a class="grow" href="#/guide"><span class="ge">📚</span><span class="tx"><b>아빠 가이드</b><small>육아휴직 · 놀이 · 심리 · 정책</small></span></a>'
      + '<a class="grow" href="#/guide/faq"><span class="ge">🙋</span><span class="tx"><b>Q&amp;A·정보</b><small>자주 묻는 질문 · 지원금 · 복직 준비</small></span></a>'
      + '<a class="grow" href="#/calc"><span class="ge">💰</span><span class="tx"><b>계산기</b><small>육아휴직 · 단축근무 · 출산휴가 · 아이 날짜</small></span></a>'
      + '<a class="grow" href="#/library"><span class="ge">🗂️</span><span class="tx"><b>자료실</b><small>법령 · 통계 · 연구 · 판례 · 경험담</small></span></a>'
      + '</div></section>';
    window.scrollTo(0, 0);
    const after = () => render();
    const start = $('#lockGo');
    if (start) start.addEventListener('click', () => { if (!me) openSheet(after); else openVerify(after); });
    const noCode = $('#lockNo');
    if (noCode) noCode.addEventListener('click', () => { verifyStartTab = 'apply'; if (!me) openSheet(after); else openVerify(after); });
    if (!me) return;
    // 승인·해제가 다른 곳에서 일어났을 수 있으니 서버에 맞춘다. 신청 중이면 그 상태를 보여 준다.
    const wasBlocked = !!me.blocked;
    api('me').then(r => {
      if (!$('#lockBox')) return;
      setDot(r.new_comments);
      setMe(r.user);
      if (canRead()) { render(); return; }
      if (!!me.blocked !== wasBlocked) { renderLock(); return; }
      const cta = $('#lockCta');
      if (cta && r.application && r.application.status === 'pending') {
        cta.innerHTML = statusBox(r);
        const d = $('#doVerify'); if (d) d.addEventListener('click', () => openVerify(after));
      }
    }).catch(e => { if (e && e.code === 'unknown_user' && $('#lockBox')) { setMe(null); renderLock(); } });
  }
  async function renderCommunity(cat) {
    setTab('community');
    if (!canRead()) { bar(brandBar()); renderLock(); return; }
    fab.hidden = false;
    bar(brandBar('<button class="searchcta" id="btnSearch" aria-label="키워드 검색"><span class="bubble" id="searchBubble">키워드 검색</span><span class="sc">' + ICON.search + '</span></button>'));
    const reuse = listState.keep && listState.cat === cat && listState.posts.length > 0;
    listState.keep = false;
    if (!reuse) { listState.cat = cat; listState.q = ''; listState.posts = []; listState.next = null; }
    const q = listState.q;
    view.innerHTML = '<section class="pad">'
      + '<h1 class="htitle">커뮤니티 💬</h1><p class="hsub">사진·영상 없이 줄글로, 아빠끼리 솔직하게</p>'
      + '<div class="chips">' + chip('', '전체', '🏠', cat) + CATS.map(c => chip(c.key, c.name, c.e, cat)).join('') + '</div>'
      + '<div class="chips ages" id="ages2" role="group" aria-label="아이 나이로 거르기">' + ageChip('', '전체 나이') + AGES.map(x => ageChip(x.key, x.name)).join('') + '</div>'
      + '<div class="searchbar" id="searchbar"' + (q ? '' : ' hidden') + '><input id="q" type="search" placeholder="키워드로 글 찾기 (예: 복직, 이유식)" enterkeyhint="search" autocomplete="off" value="' + esc(q) + '"><button type="button" class="sgo" id="qgo">찾기</button><button type="button" class="sx" id="qx" aria-label="검색 지우기">✕</button></div>'
      + (mode === 'local' ? mockBadge() : '')
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
    $('#ages2').addEventListener('click', ev => { const b = ev.target.closest('[data-age]'); if (!b) return; listState.age = b.dataset.age; $$('#ages2 .chip').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); loadList(false); });
    if (reuse) { paintList(); window.scrollTo(0, listState.scroll); } else { window.scrollTo(0, 0); await loadList(false); }
  }
  async function loadList(more) {
    const list = $('#list'), btn = $('#more'); if (!list) return;
    if (!more) list.innerHTML = '<div class="loading">불러오는 중…</div>';
    if (btn) { btn.disabled = true; btn.textContent = '불러오는 중…'; }
    const seq = renderSeq;
    try {
      const r = await api('listPosts', { cat: listState.cat, age: listState.age, q: listState.q, before: more ? listState.next : '', limit: PAGE });
      if (seq !== renderSeq) return;
      listState.posts = more ? listState.posts.concat(r.posts) : r.posts; listState.next = r.next;
      if (mode === 'local' && !$('#mockBadge') && $('#list')) $('#list').insertAdjacentHTML('beforebegin', mockBadge());
      paintList();
    } catch (e) {
      if (readDenied(e)) { listState.posts = []; bar(brandBar()); renderLock(); return; }
      if (!more) list.innerHTML = empty('글을 못 불러왔어요', '잠시 뒤 다시 열어 주세요');
      fail(e);
    }
    finally { if (btn) { btn.disabled = false; btn.textContent = '더 보기'; } }
  }
  function paintList() {
    const list = $('#list'), btn = $('#more'); if (!list) return;
    const q = listState.q;
    list.innerHTML = (q ? '<div class="sec" style="margin:4px 2px 2px"><h2 style="font-size:15px">"' + esc(q) + '" 검색 결과</h2><span>' + listState.posts.length + (listState.next ? '+' : '') + '개</span></div>' : '')
      + (listState.posts.length ? listState.posts.map(pcard).join('') : (q ? empty('검색 결과가 없어요', '다른 말로 찾아보세요') : listState.age ? empty('이 나이대 글이 아직 없어요', '첫 글을 써 보세요!') : listState.cat ? empty('이 분류에는 아직 글이 없어요', '첫 글을 써 보세요!') : emptyCommunity()));
    if (btn) btn.hidden = !listState.next;
  }

  // ----- 글 하나 + 댓글 -----
  const cmtDrafts = {};
  function cmtItem(c) {
    const mine = me && (c.uid === me.id || me.role === 'admin');
    return '<div class="cmt-item" id="c' + c.id + '"><div class="top">' + who(c.nick, c.badge) + '<span class="right"><span class="time">' + ago(c.created) + '</span>'
      + (mine ? '<button type="button" class="del" data-del-cmt="' + c.id + '">삭제</button>' : '')
      + (me && c.uid !== me.id && canWrite() ? '<button type="button" class="del" data-report="comment" data-rid="' + c.id + '">신고</button>' : '') + '</span></div><div class="txt">' + rich(c.body) + '</div></div>';
  }
  async function renderPost(id) {
    setTab('community');
    const lockPost = () => { app.classList.remove('notab', 'composing'); bar(backBtn('#/community') + '<div class="fill atitle">글</div>'); renderLock(); };
    if (!canRead()) { lockPost(); return; }
    app.classList.add('notab', 'composing');
    bar(backBtn('#/community') + '<div class="fill atitle">글</div><span id="postAct"></span>');
    view.innerHTML = '<section class="pad"><div class="loading">불러오는 중…</div></section>';
    window.scrollTo(0, 0);
    let r;
    const seq = renderSeq;
    try { r = await api('getPost', id); if (seq !== renderSeq) return; }
    catch (e) { if (seq !== renderSeq) return; if (readDenied(e)) { lockPost(); return; } view.innerHTML = '<section class="pad">' + empty('글을 찾을 수 없어요', '지워졌거나 주소가 틀렸어요') + '</section>'; app.classList.remove('composing'); if (!(e && e.code === 'not_found')) fail(e); return; }
    const p = r.post, c = CAT[p.cat] || { name: p.cat, e: '' }, mine = me && (p.uid === me.id || me.role === 'admin');
    $('#postAct').innerHTML = (mine ? '<button type="button" class="abtn danger" id="delPost">삭제</button>' : '')
      + (me && p.uid !== me.id && canWrite() ? '<button type="button" class="abtn ghosty" data-report="post" data-rid="' + p.id + '">신고</button>' : '');
    const ph = !me ? '닉네임을 정하면 댓글을 쓸 수 있어요' : canWrite() ? '댓글을 남겨 보세요' : '아빠 인증을 하면 댓글을 쓸 수 있어요';
    view.innerHTML = '<section class="pad">'
      + '<article class="post"><div class="meta"><span class="badges"><span class="badge c-' + (CAT[p.cat] ? esc(p.cat) : 'etc') + '">' + c.e + ' ' + esc(c.name) + '</span>' + (AGE[p.age] ? '<span class="agetag">' + esc(AGE[p.age].name) + '</span>' : '') + '</span><span class="time">' + ago(p.created) + '</span></div>'
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
      if (!confirm('이 글을 지울까요? 글과 댓글 내용이 바로 지워지고 되돌릴 수 없어요.')) return;
      try { await api('deletePost', id); listState.posts = []; toast('글을 지웠어요'); go('#/community', true); } catch (e) { fail(e); }
    });
  }
  async function delComment(cid) {
    if (!confirm('이 댓글을 지울까요?')) return;
    try { await api('deleteComment', cid); const el = $('#c' + cid); if (el) el.remove(); const n = $('#cmtN'); if (n) n.textContent = $$('#cmts .cmt-item').length; listState.posts = []; toast('댓글을 지웠어요'); }
    catch (e) { fail(e); }
  }
  async function reportFlow(kind, id) {
    const reason = window.prompt('무엇이 문제인가요? 운영자가 읽고 판단해요. (아이 개인정보 노출, 비방, 광고 등)', '');
    if (reason === null) return;
    try { const r = await api('report', kind, id, reason.trim()); toast(r.already ? '이미 신고했어요' : '신고를 받았어요. 고마워요'); } catch (e) { fail(e); }
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
      + '<span class="lbl">아이 나이 <small style="font-weight:600">(선택 — 또래 아빠들이 찾기 쉬워요)</small></span><div class="catpick" id="agepick">' + AGES.map(x => '<button type="button" class="chip' + ((d.age || currentAge()) === x.key ? ' on' : '') + '" data-age="' + x.key + '">' + esc(x.name) + '</button>').join('') + '</div>'
      + '<label class="lbl" for="wtitle">제목</label><input class="inp" id="wtitle" maxlength="60" placeholder="한 줄로 요약해 주세요" value="' + esc(d.title || '') + '" autocomplete="off">'
      + '<label class="lbl" for="wbody">내용</label><textarea class="inp" id="wbody" maxlength="3000" placeholder="아빠들에게 묻고 싶은 것, 알려 주고 싶은 것을 편하게 적어 주세요. 사진·영상 없이 글로만 올라가요. 용품 이야기는 쇼핑몰 링크를 붙여 넣어도 돼요.">' + esc(d.body || '') + '</textarea>'
      + '<div class="cnt"><span id="wcnt">' + len(d.body || '') + '</span>/3000</div>'
      + '<div class="notice"><span class="e">🔒</span><span>아이의 이름·얼굴·어린이집 이름 같은 개인정보는 적지 말아 주세요. 글은 인증한 아빠들에게 보여요.</span></div>'
      + '<button class="btn primary" type="submit" style="margin-top:14px">올리기</button>'
      + '</form></section>';
    window.scrollTo(0, 0);
    const form = $('#wform'), title = $('#wtitle'), body = $('#wbody');
    let picked = d.cat && CAT[d.cat] ? d.cat : '', age = AGE[d.age || currentAge()] ? (d.age || currentAge()) : '';
    $('#catpick').addEventListener('click', ev => { const b = ev.target.closest('[data-pick]'); if (!b) return; picked = b.dataset.pick; $$('#catpick .chip').forEach(x => x.classList.toggle('on', x === b)); saveDraft(); });
    $('#agepick').addEventListener('click', ev => { const b = ev.target.closest('[data-age]'); if (!b) return; age = age === b.dataset.age ? '' : b.dataset.age; $$('#agepick .chip').forEach(x => x.classList.toggle('on', x.dataset.age === age)); saveDraft(); });
    const saveDraft = () => { store.set('draft', { cat: picked, age, title: title.value, body: body.value }); $('#wcnt').textContent = len(body.value); };
    title.addEventListener('input', saveDraft); body.addEventListener('input', saveDraft);
    title.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); body.focus(); } });
    const v = $('#vcta');
    if (v) v.addEventListener('click', () => { const after = () => render(); if (!me) openSheet(after); else openVerify(after); });
    const submit = async () => {
      const p = { cat: picked, age, title: clean(title.value, 200), body: clean(body.value, 5000) };
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
      + '<li>저장하는 것: 닉네임, 이 기기 토큰과 복구 코드의 해시, 내가 쓴 글·댓글, 인증 신청 내용(결정 뒤 지움), 누가 초대했는지, 마지막 접속 시각. 가입·코드 시도 때는 기기 주소(IP)의 짧은 해시를 이틀 안에만. 이메일·전화번호·서류·아이 정보는 받지 않아요.</li>'
      + '<li>사진·영상 없이 글로만. 커뮤니티는 인증한 아빠끼리만 읽고 써요.</li>'
      + '<li>내 글·댓글은 내가 지울 수 있고, 지우면 내용이 바로 비워져요. 탈퇴하면 글·댓글 내용과 계정이 지워져요.</li>'
      + '<li>브라우저 저장소가 지워지거나 폰을 바꾸면 복구 코드로 같은 닉네임에 돌아올 수 있어요. 코드는 MY에서 볼 수 있어요.</li>'
      + (mode === 'local' ? '<li>지금은 시험 모드라 글이 이 기기에만 저장돼요.</li>' : '') + '</ul>'
      + '<p class="sm" style="margin-top:10px">운영: ' + esc(CFG.OPERATOR || '') + ' · 문의: ' + (CFG.CONTACT ? '<a href="mailto:' + esc(CFG.CONTACT) + '">' + esc(CFG.CONTACT) + '</a>' : '준비 중') + '<br><a class="lk2" href="#/terms">이용약관</a> · <a class="lk2" href="#/privacy">개인정보 처리방침</a></p></div>';
  }
  function themeBox() {
    const cur = store.get('theme', 'auto');
    return '<div class="about" id="themeBox"><b>화면 밝기</b><div class="seg" style="margin-top:8px">' + [['auto', '기기 따라'], ['light', '밝게'], ['dark', '어둡게']].map(x => '<button type="button" class="' + (cur === x[0] ? 'on' : '') + '" data-theme-pick="' + x[0] + '">' + x[1] + '</button>').join('') + '</div></div>';
  }
  function bindTheme() {
    const b = $('#themeBox'); if (!b) return;
    b.addEventListener('click', ev => { const x = ev.target.closest('[data-theme-pick]'); if (!x) return; store.set('theme', x.dataset.themePick); applyTheme(); $$('#themeBox button').forEach(y => y.classList.toggle('on', y === x)); });
  }
  // 새 댓글 표시(아래 탭 MY의 점, 검수 22)
  function setDot(n) { const d = $('#meDot'); if (d) d.hidden = !n; }
  function newCommentsBox(r) {
    if (!r.new_comments) return '';
    return '<div class="sec"><h2>내 글의 새 댓글</h2><span>' + r.new_comments + '개</span></div><div class="list" style="margin-top:0">'
      + (r.new_list || []).map(c => '<a class="mycmt" href="#/p/' + c.post_id + '#c' + c.id + '"><small>' + esc(c.nick) + ' · ' + esc(c.post_title) + ' · ' + ago(c.created) + '</small><p>' + esc(c.body) + '</p></a>').join('') + '</div>';
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
    return '<div class="vstate"><span><b>아직 인증 전이에요.</b><br>커뮤니티는 인증한 아빠만 읽고 쓸 수 있어요.' + (ap && ap.status === 'rejected' ? ' 지난 신청은 승인되지 않았어요. 다시 신청할 수 있어요.' : '') + '</span><button type="button" class="edit" id="doVerify">인증하기</button></div>';
  }
  async function renderMe() {
    setTab('me');
    bar(brandBar());
    if (!me) {
      view.innerHTML = '<section class="pad"><h1 class="htitle">MY</h1>'
        + '<div class="profile" style="margin-top:12px"><span class="big">👋</span><div class="tx"><b>아직 닉네임이 없어요</b><small>닉네임을 정하고 아빠 인증을 하면 커뮤니티를 읽고 쓸 수 있어요. 이메일·서류는 받지 않아요.</small></div></div>'
        + (pendingInvite ? '<div class="notice vcta" style="margin-top:12px"><span class="e">🎟️</span><span>받은 초대 코드 <b>' + esc(pendingInvite) + '</b>가 있어요. 시작하기를 누르면 바로 인증돼요.</span></div>' : '')
        + '<button type="button" class="btn primary" id="startBtn" style="margin-top:12px">시작하기</button>'
        + '<button type="button" class="btn ghost" id="recoverBtn">다른 폰에서 쓰던 닉네임이 있어요 (복구 코드)</button>' + themeBox() + installBox() + aboutBox() + '</section>';
      bindTheme();
      $('#startBtn').addEventListener('click', () => openSheet(() => render()));
      $('#recoverBtn').addEventListener('click', () => openRecover(() => render()));
      bindInstall(); window.scrollTo(0, 0);
      if (pendingInvite && !invitePrompted) { invitePrompted = true; openSheet(() => render()); }
      return;
    }
    view.innerHTML = '<section class="pad"><div class="loading">불러오는 중…</div></section>';
    let r;
    const seq = renderSeq;
    try { r = await api('me'); } catch (e) { if (seq !== renderSeq) return; view.innerHTML = '<section class="pad">' + empty('내 정보를 못 불러왔어요', '잠시 뒤 다시 열어 주세요') + '</section>'; fail(e, () => render()); return; }
    if (seq !== renderSeq) return;
    setMe(r.user);
    setDot(0);
    if (r.new_comments) api('seen').catch(() => {});      // 이 화면에 보였으니 다음에는 안 뜬다
    view.innerHTML = '<section class="pad"><h1 class="htitle">MY</h1>'
      + '<div class="profile" style="margin-top:12px"><span class="big">' + esc(first(r.user.nick)) + '</span><div class="tx"><b>' + esc(r.user.nick) + '</b><small>' + ymd(r.user.created) + '부터 육아맨 · 글 ' + r.posts.length + ' · 댓글 ' + r.comments.length + '</small></div><button type="button" class="edit" id="editNick">닉네임 바꾸기</button></div>'
      + statusBox(r)
      + (r.user.role === 'admin' ? '<a class="glink" href="#/admin"><span>🛠️ 관리자 화면: 인증 신청 · 초대 코드 · 회원</span><span>→</span></a>' : '')
      + (canWrite() ? inviteBox(r) : '')
      + newCommentsBox(r)
      + '<div class="seg" id="meSegs" style="margin-top:16px"><button type="button" class="' + (meSeg === 'posts' ? 'on' : '') + '" data-seg="posts">내 글 ' + r.posts.length + '</button><button type="button" class="' + (meSeg === 'comments' ? 'on' : '') + '" data-seg="comments">내 댓글 ' + r.comments.length + '</button></div>'
      + '<div class="list" id="meList"></div>' + accountBox(r) + themeBox() + installBox() + aboutBox() + '</section>';
    const paint = () => {
      $('#meList').innerHTML = meSeg === 'posts'
        ? (r.posts.length ? r.posts.map(pcard).join('') : empty('아직 쓴 글이 없어요', canWrite() ? '커뮤니티에서 첫 글을 써 보세요' : '아빠 인증을 하면 쓸 수 있어요'))
        : (r.comments.length ? r.comments.map(c => '<a class="mycmt" href="#/p/' + c.post_id + '"><small>' + esc(c.post_title) + ' · ' + ago(c.created) + '</small><p>' + esc(c.body) + '</p></a>').join('') : empty('아직 쓴 댓글이 없어요', ''));
    };
    paint();
    $$('#meSegs button').forEach(b => b.addEventListener('click', () => { meSeg = b.dataset.seg; $$('#meSegs button').forEach(x => x.classList.toggle('on', x === b)); paint(); }));
    bindTheme();
    $('#editNick').addEventListener('click', () => openSheet(() => render(), 'rename'));
    const dv = $('#doVerify'); if (dv) dv.addEventListener('click', () => openVerify(() => render()));
    const ni = $('#newInvite');
    if (ni) ni.addEventListener('click', async () => { ni.disabled = true; try { await api('createInvite'); render(); } catch (e) { ni.disabled = false; fail(e); } });
    const ib = $('#inviteBox');
    if (ib) ib.addEventListener('click', ev => { const b = ev.target.closest('[data-share]'); if (b) shareInvite(b.dataset.share); });
    bindAccount();
    bindInstall(); window.scrollTo(0, 0);
    if (pendingInvite && canWrite()) clearInvite();
    else if (pendingInvite && !invitePrompted) { invitePrompted = true; openVerify(() => render()); }
    if (r.user.verified && r.user.how === 'apply' && !store.get('welcomed')) { store.set('welcomed', true); toast('아빠 인증이 승인됐어요'); }
  }
  // 내 계정: 복구 코드(폰 바꿀 때) · 이 기기 로그아웃 · 탈퇴(11-04 검수 3·5). 복구 코드는 서버에 해시만 있어 이 기기에 남긴 것을 보여 준다.
  function accountBox(r) {
    const rec = store.get('recovery', '');
    return '<div class="about" id="acctBox"><b>내 계정</b><p class="sm">복구 코드가 있으면 폰을 바꾸거나 저장소가 지워져도 같은 닉네임으로 돌아올 수 있어요. 어디에 적어 두세요.</p>'
      + '<div class="irow"><code>' + (rec ? esc(rec) : (r.has_recovery ? '이 기기에 코드가 없어요' : '코드 없음')) + '</code><button type="button" class="edit" id="recNew">' + (rec ? '새 코드' : '코드 받기') + '</button></div>'
      + '<div class="two" style="margin-top:10px"><button type="button" class="btn line small" id="logoutBtn">이 기기 로그아웃</button>' + (me && me.role === 'admin' ? '' : '<button type="button" class="btn line small danger" id="quitBtn">탈퇴하기</button>') + '</div></div>';
  }
  function bindAccount() {
    const rn = $('#recNew');
    if (rn) rn.addEventListener('click', async () => {
      if (store.get('recovery', '') && !confirm('새 복구 코드를 만들면 지금 코드는 쓸 수 없어요. 만들까요?')) return;
      rn.disabled = true;
      try { const x = await api('recoveryNew'); store.set('recovery', x.recovery); showRecovery(x.recovery, () => render()); } catch (e) { rn.disabled = false; fail(e); }
    });
    const lo = $('#logoutBtn');
    if (lo) lo.addEventListener('click', async () => {
      const rec = store.get('recovery', '');
      if (!confirm('이 기기에서 로그아웃할까요? 다시 들어오려면 복구 코드가 필요해요.' + (rec ? '' : ' 지금 이 기기에는 복구 코드가 없어요. 먼저 "코드 받기"를 눌러 적어 두세요.'))) return;
      try { await api('logout'); } catch (e) { if (!(e && (e.code === 'unknown_user' || e.code === 'login'))) { fail(e); return; } }
      forgetDevice(); toast('로그아웃했어요'); render();
    });
    const q = $('#quitBtn');
    if (q) q.addEventListener('click', async () => {
      if (window.prompt('탈퇴하면 내 글과 댓글 내용이 모두 지워지고 되돌릴 수 없어요. 계속하려면 "탈퇴"라고 적어 주세요.') !== '탈퇴') return;
      try { await api('deleteMe'); forgetDevice(); toast('탈퇴했어요. 그동안 고마웠어요'); go('#/', true); } catch (e) { fail(e); }
    });
  }
  // 이 기기의 계정 흔적을 지운다(토큰은 다음에 새로 만들어진다)
  function forgetDevice() { setMe(null); store.del('token'); store.del('recovery'); store.del('welcomed'); listState.posts = []; }

  // ----- 관리자 -----
  async function renderAdmin() {
    setTab('me');
    bar(backBtn('#/me') + '<div class="fill atitle">관리자</div>');
    if (!me || me.role !== 'admin' || mode === 'local') { view.innerHTML = '<section class="pad">' + empty('관리자만 볼 수 있어요', '') + '</section>'; return; }
    view.innerHTML = '<section class="pad"><div class="loading">불러오는 중…</div></section>';
    let r;
    const seq = renderSeq;
    try { r = await api('adminQueue'); } catch (e) { if (seq !== renderSeq) return; view.innerHTML = '<section class="pad">' + empty('못 불러왔어요', '') + '</section>'; fail(e); return; }
    if (seq !== renderSeq) return;
    const STAGE = { raising: '아이를 키워요', expecting: '곧 아빠가 돼요' };
    const urow = u => {
      const state = u.role === 'admin' ? '관리자' : u.blocked ? '막힘' : u.verified ? '인증(' + ({ invite: '초대', apply: '신청', admin: '관리자' }[u.verified_how] || '') + ')' : '인증 전';
      const acts = u.role !== 'user' ? '' : (u.blocked ? '<button type="button" class="edit" data-u="' + u.id + '" data-a="unblock">풀기</button>'
        : (u.verified ? '<button type="button" class="edit" data-u="' + u.id + '" data-a="unverify">해제</button>' : '<button type="button" class="edit" data-u="' + u.id + '" data-a="verify">인증</button>') + '<button type="button" class="edit" data-u="' + u.id + '" data-a="block">막기</button>')
        + '<button type="button" class="edit" data-u="' + u.id + '" data-a="logout">끊기</button>'
        + (u.posts ? '<button type="button" class="edit" data-u="' + u.id + '" data-a="hide_all">글 숨김</button>' : '');
      return '<div class="urow"><div class="tx"><b>' + esc(u.nick) + '</b><small>' + state + (u.inviter ? ' · 초대: ' + esc(u.inviter) : '') + ' · 글 ' + u.posts + ' · ' + ymd(u.created) + '</small></div><div class="acts">' + acts + '</div></div>';
    };
    view.innerHTML = '<section class="pad">'
      + '<div class="sec"><h2>인증 신청</h2><span>' + r.queue.length + '건</span></div>'
      + (r.queue.length ? r.queue.map(q => '<div class="appl" data-id="' + q.id + '"><div class="meta"><b>' + esc(q.nick) + '</b><span class="time">' + ago(q.created) + '</span></div><small>' + esc(STAGE[q.stage] || '') + '</small><p>' + esc(q.answer) + '</p><div class="two"><button type="button" class="btn primary small" data-d="1">승인</button><button type="button" class="btn line small" data-d="0">거절</button></div></div>').join('') : '<div class="about">대기 중인 신청이 없어요.</div>')
      + '<p class="calcnote">승인·거절하면 신청 내용은 바로 지워져요.</p>'
      + '<div class="sec"><h2>신고함</h2><span>' + (r.reports || []).length + '건</span></div>'
      + ((r.reports || []).length ? r.reports.map(x => '<div class="appl" data-rk="' + esc(x.kind) + '" data-rt="' + x.target_id + '"><div class="meta"><b>' + (x.kind === 'post' ? '글' : '댓글') + ' · ' + esc(x.author || '(탈퇴)') + '</b><span class="time">' + x.n + '명 · ' + ago(x.first_at) + '</span></div>'
        + (x.gone ? '<small>이미 지워진 글이에요</small>' : '<p>' + (x.title ? '<b>' + esc(x.title) + '</b>\n' : '') + esc(x.preview || '') + '</p>') + (x.reasons ? '<small>사유: ' + esc(x.reasons) + '</small>' : '')
        + (x.post_id && !x.gone ? '<a class="lk2" href="#/p/' + x.post_id + '">글 열기</a>' : '')
        + '<div class="two"><button type="button" class="btn primary small" data-rp="hide">숨기기</button><button type="button" class="btn line small" data-rp="keep">그대로 두기</button></div></div>').join('') : '<div class="about">대기 중인 신고가 없어요.</div>')
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
    const rp = ev.target.closest('[data-rp]');
    try {
      if (rp) { const c = rp.closest('.appl'); if (rp.dataset.rp === 'hide' && !confirm('숨기면 내용이 지워지고 되돌릴 수 없어요. 숨길까요?')) return; await api('adminReport', c.dataset.rk, +c.dataset.rt, rp.dataset.rp); toast('처리했어요'); view.removeEventListener('click', adminClick); render(); return; }
      if (d) { const card = d.closest('.appl'); await api('adminDecide', +card.dataset.id, d.dataset.d === '1'); toast(d.dataset.d === '1' ? '승인했어요' : '거절했어요'); view.removeEventListener('click', adminClick); render(); }
      else if (u) {
        if (u.dataset.a === 'block' && !confirm('이 회원을 막을까요? 인증이 풀리고 다시 신청할 수 없어요.')) return;
        if (u.dataset.a === 'logout' && !confirm('이 회원의 기기를 끊을까요? 복구 코드로만 돌아올 수 있어요.')) return;
        if (u.dataset.a === 'hide_all' && !confirm('이 회원의 글과 댓글을 모두 숨길까요? 내용이 지워지고 되돌릴 수 없어요.')) return;
        await api('adminUser', +u.dataset.u, u.dataset.a); toast('바꿨어요'); view.removeEventListener('click', adminClick); render();
      }
      else if (sh) shareInvite(sh.dataset.share);
      else if (mk) { mk.disabled = true; await api('adminInvites', 5, $('#invNote').value.trim()); toast('코드 5개를 만들었어요'); view.removeEventListener('click', adminClick); render(); }
    } catch (e) { fail(e); }
  }

  // ----- 바텀시트: 닉네임 · 아빠 인증 -----
  let sheetAfter = null, sheetDismiss = null, sheetFocus = null, verifyStartTab = 'code';
  const sheetEl = () => $('#sheet');
  function showSheet(html, after) {
    sheetAfter = typeof after === 'function' ? after : null;
    sheetDismiss = closeSheet;
    if (!sheetFocus) sheetFocus = document.activeElement;
    const sh = sheetEl(); sh.hidden = false; sh.innerHTML = html;
    sh.onclick = ev => { if (ev.target === sh && sheetDismiss) sheetDismiss(); };
    const first = sh.querySelector('button, input, textarea, a[href]'); if (first) setTimeout(() => { if (document.activeElement === document.body || !sh.contains(document.activeElement)) first.focus(); }, 80);
  }
  // 시트 안에 초점을 가두고 Esc로 닫는다(검수 17)
  document.addEventListener('keydown', ev => {
    const sh = sheetEl(); if (!sh || sh.hidden) return;
    if (ev.key === 'Escape') { if (sheetDismiss) sheetDismiss(); return; }
    if (ev.key !== 'Tab') return;
    const f = $$('button, input, textarea, select, a[href]', sh).filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); z.focus(); }
    else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus(); }
  });
  function openSheet(after, kind) {
    const rename = kind === 'rename';
    showSheet('<div class="sheet" role="dialog" aria-modal="true" aria-label="' + (rename ? '닉네임 바꾸기' : '닉네임 정하기') + '"><div class="grip"></div>'
      + '<h2>' + (rename ? '닉네임 바꾸기' : '육아맨에 온 걸 환영해요 👋') + '</h2>'
      + '<p>' + (rename ? '일주일에 한 번 바꿀 수 있어요. 지난 글의 이름도 함께 바뀌어요.' : '아빠들이 서로 묻고, 알려 주고, 자랑하는 곳이에요. 이메일이나 서류는 받지 않아요.') + '</p>'
      + '<label class="lbl" for="nick">닉네임</label><input class="inp" id="nick" maxlength="12" placeholder="예: 초보대디" autocomplete="off" enterkeyhint="done" value="' + (rename && me ? esc(me.nick) : '') + '">'
      + '<small class="hint">2~12자 · 한글·영문·숫자 · 글에 그대로 보여요</small>'
      + (rename ? '' : '<label class="lbl" for="invite">초대 코드 (있으면)</label><input class="inp code" id="invite" maxlength="12" placeholder="없으면 비워 두세요" autocomplete="off" autocapitalize="characters" value="' + esc(pendingInvite) + '">'
        + '<label class="chk"><input type="checkbox" id="agree"> 서로 존중하고, 아이의 이름·얼굴 같은 개인정보는 올리지 않을게요.</label>')
      + '<div class="err" id="nickErr" hidden></div>'
      + '<button type="button" class="btn primary" id="joinBtn">' + (rename ? '바꾸기' : '다음') + '</button>'
      + '<button type="button" class="btn ghost" id="laterBtn">' + (rename ? '취소' : '둘러보기만 할래요') + '</button></div>', after);
    $('#laterBtn').addEventListener('click', () => { invitePrompted = true; closeSheet(); });
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
      if (r.recovery) store.set('recovery', r.recovery);
      if (r.invite_error === 'code_bad' || r.invite_error === 'code_used') clearInvite();
      const next = () => {
        if (r.user.verified) { clearInvite(); toast('반가워요, ' + r.user.nick + '님! 인증됐어요'); if (f) f(); else render(); return; }
        if (r.invite_error) toast(MSG[r.invite_error] || MSG.code_bad, 'err');
        openVerify(f);
      };
      closeSheet();
      if (r.recovery) showRecovery(r.recovery, next); else next();     // 가입 직후 복구 코드를 한 번 보여 준다(서버는 해시만 둔다)
    } catch (e) { err.hidden = false; err.textContent = errText(e); }
    finally { btn.disabled = false; }
  }
  // 복구 코드 보여 주기(가입 직후 · 새로 만들 때 · 복구 뒤). 배경을 눌러 닫아도 다음 단계로 간다.
  function showRecovery(code, next, title) {
    showSheet('<div class="sheet" role="dialog" aria-modal="true" aria-label="복구 코드"><div class="grip"></div><h2>' + esc(title || '복구 코드를 적어 두세요') + '</h2>'
      + '<p>폰을 바꾸거나 브라우저 저장소가 지워졌을 때 이 코드로 같은 닉네임에 돌아올 수 있어요. 이메일이 없으니 이 코드가 유일한 길이에요. 한 번 쓰면 새 코드로 바뀌어요.</p>'
      + '<div class="reccode" id="recCode">' + esc(code) + '</div>'
      + '<button type="button" class="btn line" id="recCopy">복사하기</button>'
      + '<button type="button" class="btn primary" id="recOk">적어 두었어요</button></div>', null);
    const done = () => { closeSheet(); if (next) next(); };
    sheetDismiss = done;
    $('#recCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(code); toast('복사했어요. 메모 앱에 붙여 두세요'); } catch (e) { window.prompt('이 코드를 적어 두세요', code); } });
    $('#recOk').addEventListener('click', done);
  }
  // 복구 코드로 이어 쓰기: 이 기기에 남은 옛 토큰은 버리고 새 토큰으로 그 계정에 붙는다(이전 폰은 끊김)
  function openRecover(after) {
    showSheet('<div class="sheet" role="dialog" aria-modal="true" aria-label="복구 코드로 이어 쓰기"><div class="grip"></div><h2>복구 코드로 이어 쓰기</h2>'
      + '<p>가입할 때 받은 12자 복구 코드를 넣으면 그 닉네임을 이 폰에서 이어 써요. 이전 폰은 그 순간 로그아웃돼요.</p>'
      + '<label class="lbl" for="recIn">복구 코드</label><input class="inp code" id="recIn" maxlength="14" placeholder="ABCD-EFGH-2345" autocomplete="off" autocapitalize="characters">'
      + '<div class="err" id="recErr" hidden></div>'
      + '<button type="button" class="btn primary" id="recGo">이어 쓰기</button>'
      + '<button type="button" class="btn ghost" id="recLater">취소</button></div>', after);
    $('#recLater').addEventListener('click', closeSheet);
    const run = async () => {
      const err = $('#recErr'), btn = $('#recGo'), code = $('#recIn').value.trim();
      if (code.replace(/[^A-Za-z0-9]/g, '').length !== 12) { err.hidden = false; err.textContent = '복구 코드는 12자예요'; return; }
      btn.disabled = true;
      try {
        store.del('token'); setMe(null);
        const r = await api('recover', code);
        setMe(r.user); store.set('recovery', r.recovery); clearInvite();
        const f = sheetAfter; closeSheet();
        showRecovery(r.recovery, () => { toast('돌아왔어요, ' + r.user.nick + '님'); if (f) f(); else render(); }, '새 복구 코드예요');
      } catch (e) { err.hidden = false; err.textContent = errText(e); btn.disabled = false; }
    };
    $('#recGo').addEventListener('click', run);
    $('#recIn').addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); run(); } });
    setTimeout(() => { const n = $('#recIn'); if (n) n.focus(); }, 60);
  }
  // 아빠 인증: 초대 코드(바로) · 신청서(운영자 승인)
  function openVerify(after) {
    if (!me) { openSheet(after); return; }
    let tab = 'code', stage = '';
    const startApply = verifyStartTab === 'apply'; verifyStartTab = 'code';
    showSheet('<div class="sheet" role="dialog" aria-modal="true" aria-label="아빠 인증"><div class="grip"></div><h2>아빠 인증</h2>'
      + '<p>커뮤니티는 인증한 아빠만 읽고 쓸 수 있어요. 서류나 사진은 받지 않아요.</p>'
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
    if (startApply) setTabV('apply');
    $('#vStage').addEventListener('click', ev => { const b = ev.target.closest('[data-s]'); if (!b) return; stage = b.dataset.s; $$('#vStage .chip').forEach(x => x.classList.toggle('on', x === b)); });
    $('#vLater').addEventListener('click', () => { invitePrompted = true; closeSheet(); if (['me', 'community', 'home'].includes(parse().name)) render(); });
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
        if (tab === 'code') clearInvite();
        if (canWrite()) { toast(r.instant ? '시험 모드라 바로 인증됐어요' : '인증됐어요. 반가워요!'); closeSheet(); if (f) f(); else render(); }
        else { closeSheet(); toast('신청을 받았어요. 승인되면 MY에 표시돼요'); render(); }
      } catch (e) { show(errText(e)); }
      finally { btn.disabled = false; }
    });
  }
  function closeSheet() {
    const sh = sheetEl(); if (!sh) return;
    const wasOpen = !sh.hidden;
    sh.hidden = true; sh.innerHTML = ''; sheetAfter = null; sheetDismiss = null;
    if (wasOpen && sheetFocus && sheetFocus.focus && document.contains(sheetFocus)) sheetFocus.focus();
    sheetFocus = null;
  }

  // ----- 공통 클릭 -----
  document.addEventListener('click', ev => {
    if (!ev.target || !ev.target.closest) return;
    const keep = ev.target.closest('a[data-keep]'); if (keep) { listState.keep = true; listState.scroll = window.scrollY; }
    const b = ev.target.closest('[data-back]'); if (b) { ev.preventDefault(); back(b.dataset.back); return; }
    const dc = ev.target.closest('[data-del-cmt]'); if (dc) { delComment(+dc.dataset.delCmt); }
    const rb = ev.target.closest('[data-report]'); if (rb) { reportFlow(rb.dataset.report, +rb.dataset.rid); }
  });

  // ----- 시작 -----
  if (mode === 'local') { const u = local.user(); setMe(u ? pub(u) : null); }
  render();
  // 승인·해제가 다른 기기에서 일어나도 다음에 열 때 맞춘다(화면을 막지 않는다)
  // 읽기 자격이 바뀌었으면 커뮤니티가 보이는 화면을 다시 그린다(잠금 ↔ 글 목록)
  const syncMe = next => { const was = canRead(); setMe(next); if (!!was !== !!canRead() && ['home', 'community', 'post'].includes(parse().name)) render(); };
  if (me && mode === 'server') api('me').then(r => { syncMe(r.user); if (parse().name !== 'me') setDot(r.new_comments); }).catch(e => { if (e && e.code === 'unknown_user') syncMe(null); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
})();

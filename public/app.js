/* 육아맨 화면(2026-11-04, 앱개발부).
   해시 주소: #/ 홈 · #/guide[/<분류>] 아빠 가이드 · #/g/<id> 가이드 글 · #/calc[/<종류>] 계산기 · #/library 자료실
              #/community[/<분류>] 커뮤니티 · #/p/<번호> 글 · #/write 글쓰기 · #/me MY · #/join/<코드> 초대 · #/admin 관리자
   커뮤니티 글·댓글·인증: 서버(/api, server/app.js)에. 시험 모드(견본 글 sample-data.js + 이 기기 localStorage)는 config.js API_URL이 비었거나, 파일로 열었거나, 내 컴퓨터(localhost)에서 /api가 없을 때만.
   운영 주소에서는 서버가 JSON이 아닌 것을 돌려줘도(오류 페이지·와이파이 로그인 페이지) 시험 모드로 바꾸지 않고 "서버에 연결할 수 없어요"만 보인다(11-04 검수 1).
   계정: 기기 토큰(localStorage) + 가입 때 한 번 보여 주는 복구 코드(폰 바꿀 때) · 이 기기 로그아웃 · 탈퇴(11-04 검수 3·5).
   가이드 글: guide-data.js · 자료실: data/library.json · 계산: calc.js(법령 기준, test/calc-test.js). 사진·영상 없음 — 줄글 + 댓글만, 검색 됨(11-04 휴먼쌤).
   아빠 인증: 커뮤니티는 읽기도 쓰기도 인증 아빠만(2026-11-04 휴먼쌤 "인증 아빠만"), 가이드·계산기·자료실은 누구나. 초대 코드(바로) 또는 신청서(관리자 승인). 서류·아이 정보는 받지 않는다.
   카카오 로그인(11-05 휴먼쌤): config.js KAKAO_LOGIN을 켜면 카카오 + 닉네임이 곧 인증이고, 신청서·초대 코드 화면은 숨는다(관리자 코드 링크만 남음). */
(function () {
  'use strict';
  const CFG = window.YK_CONFIG || {};
  const GD = window.YK_GUIDES || { cats: [], items: [] };
  const K = window.YK_CALC;
  const CATS = [
    { key: 'leave', name: '육아휴직', e: '📋' },
    { key: 'play', name: '나들이', e: '🎡' },
    { key: 'gear', name: '용품', e: '🍼' },
    { key: 'question', name: '질문', e: '🙋' },
    { key: 'tip', name: '정보', e: '💡' },
    { key: 'vent', name: '하소연', e: '😩' },
    { key: 'etc', name: '기타', e: '💬' }
  ];
  const CAT = {}; CATS.forEach(c => { CAT[c.key] = c; });
  const GCAT = {}; GD.cats.forEach(c => { GCAT[c.key] = c; });
  const LIM = { title: [2, 60], body: [1, 3000], comment: [1, 1000], answer: [20, 500], ask: [5, 300], qa: [2, 1000] };   // server/app.js LIM과 같게
  const PAGE = 20;
  const RESERVED = /(육아맨|운영|관리|자료실|공식|스태프|스탭|매니저|마스터|휴먼쌤|휴먼샘|admin|official|staff|manager|master|moderator|yukaman|humanssaem)/i;   // server/app.js와 같게
  const foldNick = s => s.replace(/[\s_.\-]+/g, '').toLowerCase().replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/5/g, 's');
  const MSG = {
    login: '닉네임을 먼저 정해 주세요', unknown_user: '이 기기의 닉네임 기록이 없어요. 다시 정해 주세요',
    nick_taken: '이미 쓰는 닉네임이에요. 별명을 바꿔 보세요', nick_form: '별명/거주지/자녀 출생연도 끝 2자리로 적어 주세요', nick_reserved: '운영 계정과 헷갈리는 이름은 쓸 수 없어요',
    limit: '너무 자주 했어요. 잠시 뒤에 다시 해 주세요', title_len: '제목은 2~60자로 해 주세요', body_len: '내용을 적어 주세요(3000자까지)',
    comment_len: '댓글은 1~1000자로 해 주세요', cat: '분류를 골라 주세요', not_found: '글을 찾을 수 없어요(지워졌을 수 있어요)',
    forbidden: '내가 쓴 것만 지울 수 있어요', bad_json: '보낼 내용이 잘못됐어요', server: '서버에 문제가 있어요. 잠시 뒤 다시 해 주세요', network: '인터넷 연결을 확인해 주세요',
    own: '내가 쓴 글은 신고할 수 없어요', no_api: '서버에 연결할 수 없어요. 잠시 뒤 다시 열어 주세요', recovery_bad: '맞지 않는 복구 코드예요', token_in_use: '이 기기에 이미 다른 닉네임이 있어요',
    verify: '커뮤니티는 인증한 아빠만 읽고 쓸 수 있어요', blocked: '이용이 제한된 계정이에요',
    code_bad: '맞지 않는 초대 코드예요', code_used: '이미 쓴 초대 코드예요', stage: '지금 상황을 골라 주세요', answer_len: '이야기는 20자 이상으로 적어 주세요', pledge: '약속에 체크해 주세요', invite_max: '초대 코드는 3개까지 만들 수 있어요',
    ask_len: '5자 이상 300자 안으로 적어 주세요', identity_bad: '본인인증을 확인하지 못했어요. 다시 해 주세요', identity_denied: '만 19세 이상 남성만 가입할 수 있어요', identity_dup: '이미 가입한 분이에요. MY에서 복구 코드로 돌아와 주세요', identity_off: '본인인증을 준비하고 있어요',
    kakao_bad: '카카오 로그인을 확인하지 못했어요. 다시 해 주세요', kakao_off: '카카오 로그인을 준비하고 있어요', kakao_taken: '이 기기는 다른 카카오 계정과 연결돼 있어요. 로그아웃한 뒤 다시 해 주세요', kakao_mismatch: '가입할 때 쓴 카카오 계정으로 해 주세요', kakao_used: '이미 가입한 카카오 계정이에요. 카카오로 다시 시작해 주세요', kakao_leave: '카카오 연결을 끊어야 탈퇴할 수 있어요'
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
  const dotd = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[1] + '. ' + (+m[2]) + '. ' + (+m[3]) + '.' : ''; };
  // 안내는 개조식 점 목록으로(11-05 휴먼쌤 "2줄 문구는 개조식으로"). 코드에 적은 글자만 넣는다(사용자 글은 넣지 않는다)
  const notes = list => '<ul class="nlist">' + list.filter(Boolean).map(x => '<li>' + x + '</li>').join('') + '</ul>';
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
  // 계급(11-05 휴먼쌤 "1안 좋아 대신 앞에 계급이모티콘도 붙여줘 있잖아 짝대기부터해서"). 재미로만 쓰고 권한 차이는 없다. at은 server/app.js RANK_AT과 같게
  const RANKS = [
    { name: '이병', at: 0, line: '신병 왔습니다. 일단 기저귀부터.' },
    { name: '일병', at: 10, line: '분유 타는 손이 빨라졌습니다.' },
    { name: '상병', at: 30, line: '오늘 밤 야간 근무도 이상 무.' },
    { name: '병장', at: 80, line: '울음소리만 들어도 원인을 압니다.' },
    { name: '예비군', at: 200, line: '전역했지만 부르면 옵니다.' },
    { name: '민방위', at: 500, line: '후배 아빠들은 제가 챙깁니다.' }
  ];
  const rankLevel = pts => { let i = 0; while (RANKS[i + 1] && pts >= RANKS[i + 1].at) i++; return i; };
  // 계급장 그림: 그런 이모지가 없어 직접 그렸다. 작대기 1~4개(이병~병장) · 얼룩무늬(예비군복) · 노란 바탕 삼각형(민방위)
  function rankMark(i) {
    let inner = '<rect width="20" height="20" rx="4" fill="#3F5232"/>';
    if (i < 4) { const n = i + 1, top = (20 - (n * 2.4 + (n - 1) * 1.6)) / 2; for (let k = 0; k < n; k++) inner += '<rect x="4" y="' + (top + k * 4).toFixed(1) + '" width="12" height="2.4" rx=".6" fill="#FFF6D6"/>'; }
    else if (i === 4) inner = '<rect width="20" height="20" rx="4" fill="#5F6F3E"/><path d="M2 5c2-2 5-2 6 0s-1 4-3 4-4-2-3-4z" fill="#2E3A22"/><path d="M11 3c2-1 5 0 6 2s-2 3-4 3-3-4-2-5z" fill="#B3A574"/><path d="M4 13c2-2 5-1 6 1s-1 4-3 4-4-3-3-5z" fill="#B3A574"/><path d="M12 11c2-1 5 0 6 2s-1 4-3 4-4-5-3-6z" fill="#2E3A22"/>';
    else inner = '<rect width="20" height="20" rx="4" fill="#FFC914"/><path d="M10 4 16.500 15.500H3.500z" fill="#14213D"/>';
    return '<svg class="rk" viewBox="0 0 20 20" aria-hidden="true">' + inner + '</svg>';
  }
  // 계급이 있으면 동그라미 글자와 초록 체크 대신 계급장을 쓴다(카카오 가입 뒤로는 글쓴이가 모두 인증이라 체크가 구분이 안 됨). 자료실·운영 계정은 예전 그대로
  const who = (nick, badge, rank) => '<span class="nick">' + (RANKS[rank] ? rankMark(rank) + '<b class="rkn">' + RANKS[rank].name + '</b>' : avatar(nick)) + '<span class="nn">' + esc(nick) + '</span>' + (RANKS[rank] && badge === 'dad' ? '' : vbadge(badge)) + '</span>';
  const nickKey = s => String(s).replace(/\s+/g, '').toLowerCase();
  const clean = (s, n) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim().slice(0, n);
  // 닉네임 = 별명/거주지/자녀 출생연도 끝 2자리(11-05 휴먼쌤). server/app.js NICK_RE와 같게
  const NICK_RE = /^[가-힣A-Za-z0-9]{2,8}\/[가-힣]{2,6}\/\d{2}$/;
  function checkNick(nick) { if (!NICK_RE.test(nick)) return 'nick_form'; if (RESERVED.test(foldNick(nick))) return 'nick_reserved'; return ''; }
  const nickParts = s => { const m = String(s || '').match(/^([^/]+)\/([^/]+)\/(\d{2})$/); return m ? { name: m[1], place: m[2], year: m[3] } : { name: '', place: '', year: '' }; };
  function checkPost(p) { if (!CAT[p.cat]) return 'cat'; const t = len(p.title), b = len(p.body); if (t < LIM.title[0] || t > LIM.title[1]) return 'title_len'; if (b < LIM.body[0] || b > LIM.body[1]) return 'body_len'; return ''; }
  const ICON = {
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M4 12 20 4l-4 16-4-7z"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>'
  };
  const LOGO = '<svg aria-hidden="true" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#14213D"/><path transform="translate(4.5086 36.9683) scale(0.0208)" d="M678 -464H204Q121 -464 72.5 -508.5Q24 -553 24 -642Q24 -746 72 -786Q120 -826 204 -827H678Q767 -827 812.5 -786.5Q858 -746 858 -642Q858 -552 811 -507.5Q764 -463 678 -464ZM581 -653H301Q296 -653 294 -652Q292 -651 292 -644Q292 -637 294 -636Q296 -635 301 -635H581Q586 -635 588 -636Q590 -637 590 -644Q590 -651 588 -652Q586 -653 581 -653ZM869 -442V-244H743V-212H842V42H563V-1H32V-212H140V-244H14V-442ZM383 -212H500V-244H383Z M1692 -583H1755V-304H1692V42H1422V-822H1692ZM1395 -620V-199Q1396 -110 1336 -55.5Q1276 -1 1148 -1Q1065 -1 1008 -27Q951 -53 921.5 -97.5Q892 -142 891 -197V-617Q891 -671 920 -715.5Q949 -760 1006.5 -786Q1064 -812 1148 -812Q1232 -812 1286 -787Q1340 -762 1366.5 -719Q1393 -676 1395 -620ZM1157 -285V-528Q1157 -532 1155.5 -537Q1154 -542 1143 -542Q1133 -542 1131.5 -537Q1130 -532 1130 -528V-285Q1130 -282 1131.5 -277Q1133 -272 1143 -272Q1154 -272 1155.5 -277Q1157 -282 1157 -285Z M2439 -426H2408V-246H2237V-813H2408V-669H2439V-822H2619V-228H2439ZM1782 -795H2214V-313H1782ZM1989 -476H2007V-632H1989ZM2106 -286V-196H2628V42H1818V-286Z" fill="#FFFFFF" stroke="#14213D" stroke-width="33.3" stroke-linejoin="round"/><rect y="41.6" width="64" height="7.04" fill="#FFC914"/></svg>';   // 띠 로고 1(11-04 휴먼쌤 확정): 남색 타일 + 육아맨(Gasoek One, 두께 10% 줄임) + 노란 밑줄 띠. tools/make_logo.py가 구운 선 — icons/logo.svg · tools/build_icons.py와 같게
  const WORDMARK = '<svg aria-hidden="true" viewBox="0 0 308.8055 134"><path transform="translate(2.389 95.1669) scale(0.1151)" d="M678 -464H204Q121 -464 72.5 -508.5Q24 -553 24 -642Q24 -746 72 -786Q120 -826 204 -827H678Q767 -827 812.5 -786.5Q858 -746 858 -642Q858 -552 811 -507.5Q764 -463 678 -464ZM581 -653H301Q296 -653 294 -652Q292 -651 292 -644Q292 -637 294 -636Q296 -635 301 -635H581Q586 -635 588 -636Q590 -637 590 -644Q590 -651 588 -652Q586 -653 581 -653ZM869 -442V-244H743V-212H842V42H563V-1H32V-212H140V-244H14V-442ZM383 -212H500V-244H383Z M1692 -583H1755V-304H1692V42H1422V-822H1692ZM1395 -620V-199Q1396 -110 1336 -55.5Q1276 -1 1148 -1Q1065 -1 1008 -27Q951 -53 921.5 -97.5Q892 -142 891 -197V-617Q891 -671 920 -715.5Q949 -760 1006.5 -786Q1064 -812 1148 -812Q1232 -812 1286 -787Q1340 -762 1366.5 -719Q1393 -676 1395 -620ZM1157 -285V-528Q1157 -532 1155.5 -537Q1154 -542 1143 -542Q1133 -542 1131.5 -537Q1130 -532 1130 -528V-285Q1130 -282 1131.5 -277Q1133 -272 1143 -272Q1154 -272 1155.5 -277Q1157 -282 1157 -285Z M2439 -426H2408V-246H2237V-813H2408V-669H2439V-822H2619V-228H2439ZM1782 -795H2214V-313H1782ZM1989 -476H2007V-632H1989ZM2106 -286V-196H2628V42H1818V-286Z" fill="currentColor" style="stroke:var(--bg,#fff)" stroke-width="33.3" stroke-linejoin="round"/><rect y="110" width="308.8055" height="24" fill="#FFC914"/></svg>';   // 앱 바 글자 로고. 글자색은 currentColor, 깎는 선은 바탕색(--bg)

  // 앱 바 그림(11-04 휴먼쌤 "로고도 글씨니까 이상해서 … 아이 안고있는 행복한 아빠 이모지 같은걸로"). 글자 이모지는 기기마다 달라 직접 그렸다. 홈 화면 아이콘은 띠 로고 그대로
  const DAD = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M3 64v-6c0-11 8-18 19-18h6c11 0 19 7 19 18v6z" fill="#2F6FE0"/><circle cx="25" cy="22" r="15.5" fill="#FFD3A8"/><path d="M9.700 21c-.6-10 6.300-15.500 15.300-15.500 8.500 0 15.800 5.200 15.300 15.300-2.700-.2-4.800-3.800-5.700-6.300-3.600 2.800-13.300 3.300-19 1.700-1.400 1.700-3.300 4-5.900 4.800z" fill="#3B2A20"/><path d="M15.500 23.500c1.300-2 4-2 5.300 0M29.300 23.500c1.300-2 4-2 5.300 0" fill="none" stroke="#3B2A20" stroke-width="2" stroke-linecap="round"/><path d="M18.500 28c1.300 4.800 11.700 4.800 13 0z" fill="#fff" stroke="#3B2A20" stroke-width="1.600" stroke-linejoin="round"/><circle cx="14.500" cy="28" r="2.300" fill="#FFB199"/><circle cx="35.500" cy="28" r="2.300" fill="#FFB199"/><path d="M26 64c0-10 6-17 15-17h4c9 0 15 7 15 17z" fill="#FFD66B"/><circle cx="44" cy="39" r="11" fill="#FFE2C4"/><path d="M37 33.500c1.500-4.500 5.200-6 8-5.500-1 1.500-.6 3 .7 4-3 1.200-6 1.800-8.700 1.500z" fill="#3B2A20"/><path d="M38.800 39.500c.8-1.300 2.400-1.300 3.200 0M46 39.500c.8-1.300 2.400-1.300 3.200 0" fill="none" stroke="#3B2A20" stroke-width="1.700" stroke-linecap="round"/><path d="M41.300 43.500c1.300 2 4.100 2 5.400 0" fill="none" stroke="#3B2A20" stroke-width="1.600" stroke-linecap="round"/><path d="M20 64c1-5 8-8.500 16-8 5 .3 9.500 1.500 12 4.500 1.500 1.800-.3 3.500-2.200 3.500z" fill="#FFD3A8"/></svg>';
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
  function setMe(u) { me = u ? { id: u.id, nick: u.nick, created: u.created, verified: !!u.verified, role: u.role || 'user', how: u.how || '', blocked: !!u.blocked, kakao: !!u.kakao } : null; if (me) store.set('me', me); else { store.del('me'); store.del('rank'); } }
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
    adminReport: (kind, id, action) => remote.call('POST', '/admin/report', { kind, id, action }),
    hotPosts: () => remote.call('GET', '/posts/hot'),
    qnaList: () => remote.call('GET', '/qna'),
    ask: b => remote.call('POST', '/qna', b),
    adminQna: b => remote.call('POST', '/admin/qna', b),
    verifyIdentity: id => remote.call('POST', '/verify/identity', { id }),
    kakaoStart: () => remote.call('GET', '/login/kakao/start'),
    kakaoLogin: (code, redirect_uri) => remote.call('POST', '/login/kakao', { code, redirect_uri }),
    kakaoLeave: (code, redirect_uri) => remote.call('POST', '/me/leave-kakao', { code, redirect_uri })
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
    // 계급 점수: server/app.js POINTS와 같은 셈
    points(uid) {
      const d = this.db, live = d.posts.filter(p => !p.deleted), cs = d.comments.filter(c => !c.deleted && live.some(p => p.id === c.post_id)), owner = id => live.find(p => p.id === id).user_id, days = {};
      live.filter(p => p.user_id === uid).forEach(p => { const k = new Date(new Date(p.created).getTime() + 9 * 3600e3).toISOString().slice(0, 10); days[k] = (days[k] || 0) + 1; });
      return Object.keys(days).reduce((s, k) => s + 3 * Math.min(days[k], 2), 0)
        + 2 * new Set(cs.filter(c => c.user_id === uid && owner(c.post_id) !== uid).map(c => c.post_id)).size
        + new Set(cs.filter(c => c.user_id !== uid && owner(c.post_id) === uid).map(c => c.post_id + ':' + c.user_id)).size;
    },
    rank(uid) { return rankLevel(this.points(uid)); },
    card(p) { const d = this.db; return { id: p.id, cat: p.cat, age: p.age || '', title: p.title, preview: p.body.slice(0, 140), created: p.created, comments: d.comments.filter(c => c.post_id === p.id && !c.deleted).length, nick: this.u(p.user_id).nick, uid: p.user_id, badge: this.badge(p.user_id), rank: this.rank(p.user_id) }; },
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
      return { ok: true, post, comments: d.comments.filter(c => c.post_id === id && !c.deleted).map(c => ({ id: c.id, body: c.body, created: c.created, nick: this.u(c.user_id).nick, uid: c.user_id, badge: this.badge(c.user_id), rank: this.rank(c.user_id) })) };
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
      return { ok: true, user: pub(u), rank: this.rank(u.id), points: this.points(u.id), application: null, invites: d.invites, invite_max: 3,
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
      return { ok: true, comment: { id: c.id, body, created: c.created, nick: u.nick, uid: u.id, badge: 'dad', rank: this.rank(u.id) } };
    },
    async deleteComment(id) { const u = this.need(); const c = this.db.comments.find(x => x.id === id && !x.deleted); if (!c) throw new ApiError('not_found', 404); if (c.user_id !== u.id) throw new ApiError('forbidden', 403); c.deleted = new Date().toISOString(); this.save(); return { ok: true }; },
    async verifyCode(code) { const u = this.need(); if (String(code || '').replace(/[^A-Za-z0-9]/g, '').length < 4) throw new ApiError('code_bad'); u.verified = true; u.how = 'invite'; this.save(); return { ok: true, user: pub(u) }; },
    async verifyApply() { const u = this.need(); u.verified = true; u.how = 'apply'; this.save(); return { ok: true, user: pub(u), instant: true }; },
    async createInvite() { this.needDad(); const d = this.db; if (d.invites.length >= 3) throw new ApiError('invite_max'); const c = { code: 'TEST-' + String(1000 + d.invites.length), used: false }; d.invites.push(c); this.save(); return { ok: true, invite: c }; },
    async hotPosts() {
      this.needDad(); const d = this.load();
      const heat = p => new Set(d.comments.filter(c => c.post_id === p.id && !c.deleted && c.user_id !== p.user_id).map(c => c.user_id)).size;
      return { ok: true, posts: d.posts.filter(p => !p.deleted && heat(p) >= 2).sort((a, b) => heat(b) - heat(a) || b.id - a.id).slice(0, 3).map(p => this.card(p)) };
    },
    async qnaList() { return { ok: true, items: [] }; },
    async ask() { return { ok: true }; }
  };

  async function api(name) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (mode === 'local') { if (!local[name]) throw new ApiError('server'); return local[name].apply(local, args); }
    try { return await remote[name].apply(remote, args); }
    catch (e) { if (e && e.code === 'no_api' && DEV_HOST) { setMode('local'); if (!local[name]) throw new ApiError('server'); return local[name].apply(local, args); } throw e; }
  }
  function setMode(m) { if (mode === m) return; mode = m; if (m === 'local') { const u = local.user(); setMe(u ? pub(u) : null); } }
  const identityOn = () => !!(CFG.IDENTITY && CFG.IDENTITY.storeId && CFG.IDENTITY.channelKey) && mode === 'server';
  const kakaoOn = () => !!CFG.KAKAO_LOGIN && mode === 'server';
  const KAKAO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.5 3 2 6.5 2 10.8c0 2.8 1.9 5.2 4.700 6.600l-1 3.600c-.1.300.3.600.6.400l4.200-2.800c.5.100 1 .1 1.500.1 5.500 0 10-3.500 10-7.900S17.500 3 12 3z"/></svg>';
  const joinWord = () => kakaoOn() ? (me ? '카카오 연결하기' : '카카오로 시작하기') : (me ? '아빠 인증하기' : '시작하기');
  const kakaoBtn = (id, label) => '<button type="button" class="btn kakao" id="' + id + '">' + KAKAO_ICON + '<span>' + label + '</span></button>';
  // 카카오 동의 화면으로 갔다가 이 주소로 돌아온다(?code=…&state=…). 어디서 갔는지와 state를 기기에 남겨 두고, 돌아오면 시작 부분에서 마무리한다
  async function startKakao(purpose) {
    const r = await api('kakaoStart');
    const state = randomToken().slice(0, 24);
    store.set('kakaoState', { state, purpose: purpose || 'login', back: location.hash || '#/' });
    location.href = r.url + '&redirect_uri=' + encodeURIComponent(location.origin + '/') + '&state=' + encodeURIComponent(state);
  }
  const kakaoGo = () => { startKakao().catch(e => fail(e)); };
  async function finishKakao(purpose, code) {
    const red = location.origin + '/';
    try {
      if (purpose === 'leave') { await api('kakaoLeave', code, red); forgetDevice(); toast('탈퇴했어요. 그동안 고마웠어요'); go('#/', true); render(); return; }
      const r = await api('kakaoLogin', code, red);
      if (r.need_nick) { openSheet(() => render(), 'kakao'); return; }
      setMe(r.user); toast('반가워요, ' + r.user.nick + '님!'); render();
    } catch (e) { toast(errText(e), 'err'); render(); }
  }

  // ----- 알림 -----
  let toastTimer = 0;
  function toast(msg, kind) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (kind ? ' ' + kind : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, 2600); }
  // 진급 알림: 이 기기에서 마지막으로 본 계급보다 오르면 한 번. 알렸으면 true. 처음 보는 기기는 조용히 적어만 둔다
  function noteRank(level) {
    if (!RANKS[level]) return false;
    const seen = store.get('rank', null);
    store.set('rank', level);
    if (seen === null || level <= seen) return false;
    toast(RANKS[level].name + ' 진급을 축하합니다. ' + RANKS[level].line);
    return true;
  }
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
  // 부제는 11-04 휴먼쌤 말씀. 오른쪽 단추가 있는 화면(커뮤니티)은 자리가 좁아 두 줄로 접는다
  const brandBar = () => '<div class="brand"><span class="logo">' + DAD + '</span><span class="wm" role="img" aria-label="육아맨">' + WORDMARK + '</span><span class="tagline"><span>아빠 육아의</span> <span>모든 정보</span></span></div><div class="fill"></div>';
  const backBtn = to => '<button class="circ" data-back="' + esc(to) + '" aria-label="뒤로">' + ICON.back + '</button>';
  // 탭 제목(11-05 휴먼쌤 "상단에 이런 제목부분이 눈에 잘 안띄어. 심지어 홈 탭에는 이런 제목도 없어"): 노란 띠 + 그림 타일 + 큰 제목. right = 오른쪽 단추
  const pageHead = (e, t, sub, right) => '<header class="phead"><span class="pe" aria-hidden="true">' + e + '</span><div class="tx"><h1>' + esc(t) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + (right || '') + '</header>';
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
    if (s[0] === 'guide' && s[1] === 'age' && AGE[s[2]]) return { name: 'guideage', key: s[2] };
    if (s[0] === 'guide') return { name: 'guide', cat: s[1] && GCAT[s[1]] ? s[1] : '' };
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
      else if (r.name === 'guideage') renderGuideAge(r.key);
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
  const calcS = Object.assign({ job: '', pay: 350, bong: 300, cMonths: 12, cMode: 'general', cLonger: false, start: nextFirst(), months: 12, end: '', mode: 'general', spouseMonths: 6, used: 0, spousePay: '', company: '', birth: '', due: '', before: 40, after: 30, rMonths: 12, priority: true, days: 20 }, store.get('calc', {}));
  if (!calcS.spouseJob) calcS.spouseJob = calcS.spouseInsured === false ? 'none' : 'worker';   // 옛 저장값(고용보험 가입 여부) 옮기기
  delete calcS.spouseInsured;
  if (calcS.job === 'private') calcS.job = '';                  // 잠깐 있던 값. 교원과 직원으로 나눴다
  if (!K.parse(calcS.start)) calcS.start = nextFirst();
  if (!K.parse(calcS.end)) calcS.end = K.addDays(K.addMonths(calcS.start, 12), -1);
  // 아이가 둘 이상일 때(11-05 휴먼쌤 "아이가 2명 이상인 경우에는 어떻게 해야돼?" · "추천안대로"): calcS.birth·due는 '지금 고른 아이'의 날짜라 계산기는 그대로 따른다. 아이별 날짜는 kids에 둔다(이 기기에만)
  if (!Array.isArray(calcS.kids) || !calcS.kids.length) { calcS.kids = [{ birth: calcS.birth, due: calcS.due }]; calcS.kid = 0; }
  if (!calcS.kids[calcS.kid]) { calcS.kid = 0; calcS.birth = calcS.kids[0].birth; calcS.due = calcS.kids[0].due; }
  const saveCalc = () => { calcS.kids[calcS.kid] = { birth: calcS.birth, due: calcS.due }; store.set('calc', calcS); };
  const toWon = v => Math.round((parseFloat(v) || 0) * 10000);

  // 홈·가이드의 계산기 카드: 월급만 넣으면 바로 계산된다(일반 12개월). 자세히는 #/calc/leave
  function quickCalc(man) { const s = '2027-01-01'; return K.leaveBenefit({ ordinary: toWon(man), start: s, end: K.addDays(K.addMonths(s, 12), -1) }); }
  // 직종(11-04 재검토 + 휴먼쌤 "전부다 해당이 안되면 선택에 무슨 의미가 있지? 차라리 관련 정보를 보여주거나 이동하는 버튼"). 고르면 그 직종에 맞는 계산이나 정보·이동 단추가 나온다
  const JOBS = [
    { key: 'worker', name: '회사원·계약직·공무직' },
    { key: 'civil', name: '공무원·국공립 교원' },
    { key: 'pteacher', name: '사립학교 교원' },
    { key: 'pstaff', name: '사립학교 직원' },
    { key: 'self', name: '자영업·프리랜서' },
    { key: 'unknown', name: '잘 모르겠어요' }
  ];
  // 어떤 직종 기준인지 눈에 띄게(11-05 휴먼쌤 "어떤 근로자 기준인지 더 가시적으로")
  const JOB_LINE = { worker: { e: '👔', t: '회사원·계약직·공무직', s: '고용보험 근로자 기준' }, civil: { e: '🏛️', t: '공무원·국공립 교원', s: '공무원수당 규정 기준' }, pteacher: { e: '🏫', t: '사립학교 교원', s: '국공립 교원 규정 준용' } };
  const isCivilJob = () => calcS.job === 'civil' || calcS.job === 'pteacher';
  const JOB_NOTE = {
    pstaff: { t: '사립학교 직원은 학교 규정을 먼저 봐요', p: '사학연금을 적용받으면 고용보험 대상이 아니에요. 육아휴직은 남녀고용평등법대로 쓸 수 있지만, 돈은 법령에 정한 금액이 없고 학교법인 내부 규정을 따라요. 학교 행정실에 육아휴직수당 규정을 물어보세요.',
      go: [{ t: '직종별 안내 보기', h: '#/g/leave-job' }, { t: '육아휴직 신청 순서 보기', h: '#/g/leave-apply' }] },
    self: { t: '자영업·프리랜서는 육아휴직 급여 대상이 아니에요', p: '근로자가 아니면 고용보험에 가입했어도 육아휴직과 급여 대상이 아니에요(고용노동부 답변). 대신 직종과 상관없이 받는 돈이 있어요.',
      go: [{ t: '직종 상관없이 받는 돈: 부모급여·첫만남이용권·아동수당', h: '#/g/birth-2weeks' }, { t: '서울 1인 자영업 아빠 출산휴가급여', h: '#/g/leave-job' }, { t: '지역 아빠 장려금 찾기(자료실)', h: '#/library' }, { t: '실제로 회사 지시를 받고 일했다면 1350에 전화', h: 'tel:1350' }] },
    unknown: { t: '급여명세서에서 찾아 눌러 주세요', p: '',
      pick: [{ t: '고용보험료가 있어요', j: 'worker' }, { t: '공무원연금이 있어요', j: 'civil' }, { t: '사학연금이 있고 교사예요', j: 'pteacher' }, { t: '사학연금이 있고 행정직원이에요', j: 'pstaff' }, { t: '세금 3.3%만 떼요', j: 'self' }],
      go: [{ t: '고용24에서 내 고용보험 가입 이력 보기', h: 'https://www.work24.go.kr/', out: true }, { t: '그래도 모르면 1350에 전화', h: 'tel:1350' }] }
  };
  function jobBox() {
    const JL = JOB_LINE[calcS.job];
    if (JL) return '<div class="jobline"><span class="je" aria-hidden="true">' + JL.e + '</span><span class="tx"><b>' + esc(JL.t) + '</b><small>' + esc(JL.s) + '</small></span><button type="button" data-job="">직종 바꾸기</button></div>';
    const n = JOB_NOTE[calcS.job];
    const goes = list => (list || []).map(g => '<a class="jobgo" href="' + esc(g.h) + '"' + (g.out ? ' target="_blank" rel="noopener"' : '') + '><span>' + esc(g.t) + '</span><i>›</i></a>').join('');
    return '<div class="jobs"><b>어떻게 일하세요?</b><small>직종마다 받는 곳과 금액이 달라요.</small>'
      + '<div class="catpick" role="group" aria-label="직종">' + JOBS.map(j => '<button type="button" class="chip' + (j.key === calcS.job ? ' on' : '') + '" data-job="' + j.key + '" aria-pressed="' + (j.key === calcS.job) + '">' + esc(j.name) + '</button>').join('') + '</div>'
      + (n ? '<div class="jobnote"><b>' + esc(n.t) + '</b>' + (n.p ? '<p>' + esc(n.p) + '</p>' : '')
        + (n.pick || []).map(x => '<button type="button" class="jobgo" data-job="' + x.j + '"><span>' + esc(x.t) + '</span><i>›</i></button>').join('') + goes(n.go) + '</div>' : '') + '</div>';
  }
  // 공무원·교원 수당 어림(카드용). 12개월
  const civilQuick = man => K.civilBenefit({ bong: toWon(man), months: 12 });
  const civilTotal = man => (toWon(man) ? won(civilQuick(man).total) : '—');
  // 달마다 받는 돈은 문장으로 잇지 않고 줄로 나눈다(11-04 휴먼쌤 "글자수도 너무 많고")
  const qrows = m => '<span class="qrows">' + [['1~3개월', m[0]], ['4~6개월', m[1]], ['7개월부터', m[2]]].map(x => '<span><i>' + x[0] + '</i><b>월 ' + won(x[1]) + '</b></span>').join('') + '</span>';
  function civilNote(man) {
    if (!toWon(man)) return '수당을 뺀 봉급을 넣으면 바로 계산돼요.';
    const r = civilQuick(man);
    return qrows([r.rows[0].paid, r.rows[3].paid, r.rows[6].paid]);
  }
  // 달마다 받는 돈을 함께 보여 준다. 월 250만원을 넘으면 상한에 걸려 총액이 같으니, 고장처럼 보이지 않게 까닭을 적는다
  function quickNote(man) {
    if (!toWon(man)) return '월 통상임금을 넣으면 바로 계산돼요.';
    const r = quickCalc(man);
    return qrows([r.rows[0].paid, r.rows[3].paid, r.rows[6].paid]) + (toWon(man) >= 2500000 ? notes(['월급이 더 많아도 법정 상한으로 금액 동일']) : '');
  }
  const quickTotal = man => (toWon(man) ? won(quickCalc(man).total) : '—');     // 0원이면 하한 70만원으로 계산된 840만원이 나와 버리니 비워 둔다
  const W24_SIM = 'https://m.work24.go.kr/cm/c/f/1100/selecSimulate12.do?systClId=SC00000251&systId=SI00000402';
  const MPM_LEAVE = 'https://www.mpm.go.kr/mpm/info/infoBiz/bizHr05/';
  // 이 계산이 어디서 나왔는지 밝힌다(휴먼쌤 "이게 고용24에서 직접 제공하는거야?"). 고용24 것이 아니라 육아맨이 법령 숫자로 만든 어림이다
  function calcSource(civil) {
    if (!civil) return notes(['법령 숫자로 만든 육아맨 어림값(고용24 제공 아님)', '고용보험 가입 180일 이상만 수급', '실제 금액은 고용센터 결정']) + '<a class="offi" href="' + W24_SIM + '" target="_blank" rel="noopener">고용24 공식 모의계산 열기</a>';
    return notes(['수당 규정 숫자로 만든 육아맨 어림값', '실제 금액은 소속 기관 결정']) + '<a class="offi" href="' + MPM_LEAVE + '" target="_blank" rel="noopener">인사혁신처 공무원 휴직 안내 열기</a>';
  }
  function calcCard() {
    const civil = isCivilJob(), worker = calcS.job === 'worker';
    const head = '<div class="gcalc" id="qcalc"><div class="top"><b>💰 ' + (civil ? '육아휴직 수당 계산기' : '육아휴직 급여 계산기') + '</b>' + (worker || civil ? '<a class="fold" href="#/calc/leave">자세히</a>' : '') + '</div>';
    if (!worker && !civil) return head + '<div class="big">' + jobBox() + '</div></div>';
    const v = civil ? calcS.bong : calcS.pay;
    return head + '<div class="big">' + jobBox() + '<label class="qpay">' + (civil ? '내 월봉급액' : '내 월 통상임금') + ' <input id="qPay" type="number" inputmode="decimal" min="0" max="3000" step="10" value="' + esc(v) + '" aria-label="' + (civil ? '월봉급액' : '월 통상임금') + '(만원)"> 만원</label>'
      + '<strong id="qTotal">' + (civil ? civilTotal(v) : quickTotal(v)) + '</strong><em>' + (civil ? '12개월 쉴 때 수당 어림' : '부부 중 한 사람만 12개월 쉴 때 어림') + '</em><div class="qnote" id="qNote">' + (civil ? civilNote(v) : quickNote(v)) + '</div>'
      + calcSource(civil) + '</div></div>';
  }
  function bindCalcCard() {
    const box = $('#qcalc'); if (!box) return;
    box.addEventListener('click', ev => { const b = ev.target.closest('[data-job]'); if (!b) return; calcS.job = b.dataset.job; saveCalc(); box.outerHTML = calcCard(); bindCalcCard(); });
    const p = $('#qPay'); if (!p) return;
    p.addEventListener('input', () => {
      const v = parseFloat(p.value) || 0;
      if (isCivilJob()) { calcS.bong = v; $('#qTotal').textContent = civilTotal(v); $('#qNote').innerHTML = civilNote(v); }
      else { calcS.pay = v; $('#qTotal').textContent = quickTotal(v); $('#qNote').innerHTML = quickNote(v); }
      saveCalc();
    });
  }

  // ----- 홈 -----
  // 내 아이 나이로 보기(검수 11). 고른 값은 이 기기에만. ids = 지금 쓸 수 있는 글
  const AGES = [
    { key: 'expect', name: '곧 태어나요', ids: ['policy-pregnancy', 'policy-paternity', 'leave-66', 'leave-apply', 'ivf-leave'] },
    { key: 'baby', name: '0~18개월', ids: ['birth-2weeks', 'policy-paternity', 'leave-66', 'leave-apply', 'policy-shorter-hours', 'baby-care', 'mind-dad-blues', 'play-0-12'] },
    { key: 'kid', name: '미취학', ids: ['leave-apply', 'leave-short', 'policy-shorter-hours', 'family-care', 'play-weekend', 'mind-anger'] },
    { key: 'low', name: '초1~2', ids: ['leave-apply', 'leave-short', 'policy-shorter-hours', 'family-care', 'play-school'] },
    { key: 'high', name: '초3~6', ids: ['policy-shorter-hours', 'family-care', 'play-school', 'mind-anger', 'leave-rights'] },
    { key: 'teen', name: '중학생~', ids: ['family-care', 'policy-shorter-hours', 'mind-couple'] }
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
    return pageHead('👶', '우리 아이', line || '날짜를 입력하면 디데이를 알려줘요', '<button type="button" class="edit" id="kidEdit">' + (line ? '날짜 고치기' : '날짜 넣기') + '</button>');
  }
  const KID_NAMES = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째'];
  // 아이 고르기: 둘 이상일 때만 보인다. 계산기의 날짜 칸 위에도 같은 것을 둔다
  const kidSeg = () => (calcS.kids.length > 1 ? '<div class="seg kidseg" role="group" aria-label="아이 고르기">' + calcS.kids.map((_, i) => '<button type="button" class="' + (i === calcS.kid ? 'on' : '') + '" data-kid="' + i + '" aria-pressed="' + (i === calcS.kid) + '">' + KID_NAMES[i] + '</button>').join('') + '</div>' : '');
  // 홈: 아이 고르기 + 아이 추가. 첫 아이 날짜를 넣기 전에는 보이지 않는다
  function kidsRow() {
    const k = kidDates(), add = calcS.kids.length < KID_NAMES.length && (calcS.kids.length > 1 || k.birth || k.due);
    if (calcS.kids.length < 2 && !add) return '';
    return '<div class="kidrow' + (calcS.kids.length > 1 ? '' : ' one') + '">' + kidSeg() + (add ? '<button type="button" class="kidadd" id="kidAdd">+ 아이 추가</button>' : '') + '</div>';
  }
  function pickKid(i) {
    if (!calcS.kids[i] || i === calcS.kid) return;
    const y = window.scrollY;
    saveCalc(); calcS.kid = i; calcS.birth = calcS.kids[i].birth; calcS.due = calcS.kids[i].due; saveCalc();
    store.del('age');      // 손으로 고른 나이 칸은 풀고 고른 아이의 날짜를 따른다
    render(); window.scrollTo(0, y);
  }
  // 먼저 태어난 아이가 첫째. 고른 아이는 순서가 바뀌어도 그대로 따라간다
  function sortKids() { const cur = calcS.kids[calcS.kid], at = k => k.birth || k.due || '9999'; calcS.kids.sort((a, b) => (at(a) < at(b) ? -1 : at(a) > at(b) ? 1 : 0)); calcS.kid = calcS.kids.indexOf(cur); }
  // 날짜만 고치는 시트(11-04 휴먼쌤 "계산기로 이동해서 불편해"). 계산기 '내 아이 날짜'와 같은 값(calcS)을 쓴다. 날짜를 바꾸면 손으로 고른 나이 칸은 풀고 날짜를 따른다. add = 아이 한 명 더 넣기
  function openKidDates(add) {
    const many = calcS.kids.length > 1, k = add ? { birth: '', due: '' } : kidDates();
    showSheet('<div class="sheet" role="dialog" aria-modal="true" aria-label="' + (add ? '아이 추가' : '우리 아이 날짜') + '"><div class="grip"></div><h2>' + (add ? '아이 추가' : many ? KID_NAMES[calcS.kid] + ' 날짜' : '우리 아이 날짜') + '</h2><p>둘 중 하나만 넣어도 돼요. 이 기기에만 저장하고 서버로 보내지 않아요.</p>'
      + '<div class="two" style="margin-top:14px">' + dateField('kBirth', '태어난 날', k.birth) + dateField('kDue', '출산 예정일', k.due) + '</div>'
      + '<div class="err" id="kErr" hidden></div>'
      + '<button type="button" class="btn primary" id="kSave">저장</button>'
      + (!add && (many || k.birth || k.due) ? '<button type="button" class="btn line" id="kClear">' + (many ? '이 아이 지우기' : '날짜 지우기') + '</button>' : '')
      + '<button type="button" class="btn ghost" id="kCancel">취소</button></div>');
    const done = msg => { saveCalc(); sortKids(); saveCalc(); store.del('age'); closeSheet(); toast(msg); render(); };
    $('#kSave').addEventListener('click', () => {
      const b = $('#kBirth').value, due = $('#kDue').value, err = $('#kErr');
      if (b && b > todayStr()) { err.hidden = false; err.textContent = '태어난 날이 오늘보다 뒤예요. 아직 태어나지 않았다면 출산 예정일 칸에 넣어 주세요'; return; }
      if (add && !b && !due) { err.hidden = false; err.textContent = '날짜를 하나 넣어 주세요'; return; }
      if (add) { saveCalc(); calcS.kids.push({ birth: b, due: due }); calcS.kid = calcS.kids.length - 1; }
      calcS.birth = b; calcS.due = due; done(add ? '아이를 추가했어요' : '날짜를 저장했어요');
    });
    const c = $('#kClear');
    if (c) c.addEventListener('click', () => {
      if (calcS.kids.length > 1) { calcS.kids.splice(calcS.kid, 1); calcS.kid = Math.min(calcS.kid, calcS.kids.length - 1); calcS.birth = calcS.kids[calcS.kid].birth; calcS.due = calcS.kids[calcS.kid].due; done('아이를 지웠어요'); }
      else { calcS.birth = ''; calcS.due = ''; done('날짜를 지웠어요'); }
    });
    $('#kCancel').addEventListener('click', closeSheet);
  }
  // 나이마다 지금 챙길 것, 순서대로. by = 마지막 날(날짜를 넣었을 때), from = 시작할 수 있는 날, lab = 날짜가 없을 때의 기준. 근거는 각 가이드 글에
  // 설명은 한 줄로(11-04 휴먼쌤 "글자수도 너무 많고"). 자세한 조건은 눌러서 가는 가이드 글에
  function tlItems(key, d) {
    const L = {
      expect: [
        { t: '배우자 출산휴가', s: '20일 유급, 네 번까지 나눠 써요', by: d.paternityFrom, from: true, lab: '예정일 50일 전부터', h: '#/g/policy-paternity' },
        { t: '임신 중 육아휴직', s: '유산·조산 위험이 있으면 쓸 수 있어요', lab: '임신 중', h: '#/g/policy-pregnancy' },
        { t: '태어나고 2주 안에 할 일', s: '출생신고 · 부모급여 · 첫만남이용권', lab: '출생 뒤', h: '#/g/birth-2weeks' },
        { t: '6+6 시작 기한', s: '부모 모두 시작하면 상한이 올라요', by: d.bothStartBy, lab: '생후 18개월 안', h: '#/calc/leave', go: '우리 집 금액 계산하기' }
      ],
      baby: [
        { t: '배우자 출산휴가', s: '20일 유급, 네 번까지 나눠 써요', by: d.paternityTo, lab: '출생 후 120일 안', h: '#/g/policy-paternity' },
        { t: '출생신고', s: '늦으면 과태료', by: d.birthReportBy, lab: '출생 후 1개월 안', h: '#/g/birth-2weeks' },
        { t: '부모급여 신청', s: '이 안에 신청하면 태어난 달부터 받아요', by: d.parentPayBy, lab: '출생일 포함 60일', h: '#/g/birth-2weeks' },
        { t: '6+6 시작 기한', s: '부모 모두 시작하면 상한이 올라요', by: d.bothStartBy, lab: '생후 18개월 안', h: '#/calc/leave', go: '우리 집 금액 계산하기' },
        { t: '육아휴직 급여 신청', s: '시작 1개월 뒤부터 고용24에서', lab: '휴직 뒤 12개월 안', h: '#/g/leave-apply' },
        { t: '첫만남이용권', s: '2024년 이후 출생아, 신청·사용', by: d.firstVoucherBy, lab: '2년 안', h: '#/g/birth-2weeks' },
        { t: '근로시간 단축', s: '주 15~35시간, 휴직 안 쓴 기간은 2배', by: d.reduceStartBy, lab: '만 12세 또는 초6까지', h: '#/g/policy-shorter-hours' }
      ],
      kid: [
        { t: '육아휴직 시작 기한', s: '둘 중 늦은 날까지 시작하면 돼요', by: d.leaveStartBy, lab: '만 8세 또는 초2까지', h: '#/g/leave-apply' },
        { t: '단기 육아휴직', s: '1주 또는 2주, 해마다 한 번', lab: '휴원·방학·입원', h: '#/g/leave-short' },
        { t: '근로시간 단축', s: '주 15~35시간, 휴직 안 쓴 기간은 2배', by: d.reduceStartBy, lab: '만 12세 또는 초6까지', h: '#/g/policy-shorter-hours' },
        { t: '가족돌봄휴가', s: '아이가 아프거나 쉬는 날. 보통 무급', lab: '해마다 10일', h: '#/g/family-care' }
      ],
      high: [
        { t: '육아휴직', s: '만 8세 이하 또는 초2 이하까지만 시작', by: d.leaveStartBy, lab: '초2까지', h: '#/g/leave-apply' },
        { t: '근로시간 단축 기한', s: '둘 중 늦은 날까지 시작하면 돼요', by: d.reduceStartBy, lab: '만 12세 또는 초6까지', h: '#/g/policy-shorter-hours' },
        { t: '가족돌봄휴가', s: '아이가 아프거나 학교가 쉬는 날', lab: '해마다 10일', h: '#/g/family-care' },
        { t: '학교 가는 아이와 아빠', s: '방학 · 돌봄 · 학습', lab: '초등', h: '#/g/play-school' }
      ],
      teen: [
        { t: '근로시간 단축', s: '만 13세 생일 전까지만 시작해요', by: d.reduceStartBy, lab: '만 13세 전', h: '#/g/policy-shorter-hours' },
        { t: '가족돌봄휴가', s: '아이가 아프거나 다쳤을 때. 보통 무급', lab: '해마다 10일', h: '#/g/family-care' },
        { t: '부부가 같이 버티는 법', s: '사춘기 아이 앞에서 역할 나누기', lab: '마음', h: '#/g/mind-couple' }
      ]
    };
    L.low = L.kid.map(x => (x.t === '육아휴직 시작 기한' ? Object.assign({}, x, { t: '육아휴직은 초2까지', lab: '초2 끝까지' }) : x));
    return L[key] || [];
  }
  // 먼저 4개만, 끝난 것과 나머지는 '더 보기' 뒤에(11-04 휴먼쌤 "특히 홈화면이 가독성이 떨어져")
  const TL_SHOW = 4;
  function timeline(key, d) {
    const items = tlItems(key, d);
    if (!items.length) return '<div class="about">위에서 아이 나이를 고르면 순서대로 보여 드려요.</div>';
    let shown = 0;
    const rows = items.map(x => {
      let state = '', pill = x.lab;
      const n = x.by ? daysTo(x.by) : null;
      if (n != null) {
        if (x.from) { if (n <= 0) { state = 'soon'; pill = '지금 쓸 수 있어요'; } else if (n <= 60) { state = 'soon'; pill = 'D-' + n; } else pill = dot(x.by) + '부터'; }
        else if (n < 0) { state = 'done'; pill = '끝남'; } else if (n <= 60) { state = 'soon'; pill = n ? 'D-' + n : '오늘까지'; } else pill = dot(x.by) + '까지';
      }
      const hide = state === 'done' || shown >= TL_SHOW;
      if (!hide) shown++;
      return '<a class="tli ' + state + '" href="' + x.h + '"' + (hide ? ' hidden' : '') + '><span class="top"><b>' + esc(x.t) + '</b><span class="pill ' + state + '">' + esc(pill) + '</span></span><small>' + esc(x.s) + '</small>' + (x.go ? '<span class="go">' + esc(x.go) + ' →</span>' : '') + '</a>';
    }).join('');
    const rest = items.length - shown;
    return '<div class="tl">' + rows + '</div>' + (rest ? '<button type="button" class="more" id="tlMore">' + rest + '개 더 보기</button>' : '');
  }
  function bindHomeAge() {
    const e = $('#kidEdit'); if (e) e.addEventListener('click', () => openKidDates());
    const ka = $('#kidAdd'); if (ka) ka.addEventListener('click', () => openKidDates(true));
    const m = $('#tlMore'); if (m) m.addEventListener('click', () => { $$('.tli[hidden]').forEach(x => { x.hidden = false; }); m.remove(); });
    const box = $('#ages'); if (!box) return;
    box.addEventListener('click', ev => { const b = ev.target.closest('[data-age]'); if (!b) return; store.set('age', store.get('age', '') === b.dataset.age ? '' : b.dataset.age); renderHome(); });
  }
  // 그림과 이름만 있는 타일(홈·커뮤니티 잠금)
  const tile = (e, t, h) => '<a class="tile" href="' + esc(h) + '"><span class="ge">' + esc(e) + '</span><b>' + esc(t) + '</b></a>';
  // 커뮤니티가 비어 있을 때: 솔직하게 모집 중이라고 말한다(검수 15)
  const emptyCommunity = () => '<div class="lockbox recruit"><div class="lk">👋</div><h2>첫 아빠들을 모으고 있어요</h2><p>지금 쓰는 글이 다음 아빠의 첫 답이 돼요.</p>'
    + '<a class="btn primary" href="#/write">첫 글 쓰기</a>' + (kakaoOn() ? '' : '<a class="btn line" href="#/me">초대 코드 보내기</a>') + '<a class="btn ghost" href="#/guide/faq">자주 묻는 질문은 가이드 Q&amp;A에</a></div>';
  async function renderHome() {
    setTab('home');
    bar(brandBar());
    const seq = renderSeq;
    // 아이 나이 길(UI 3안): 나이 칸 → 우리 아이 → 지금 챙길 것(기한 D-데이) → 가이드로 가는 큰 버튼 → 이 나이에 맞는 글 → 또래 아빠들 글. 서버를 기다리지 않고 바로 그린다(검수 18)
    // 긴 계산기 카드는 가이드 '육아휴직' 칸에만 둔다(11-04 휴먼쌤 "특히 홈화면이 가독성이 떨어져" · "글자수도 너무 많고")
    const key = currentAge(), a = AGE[key], d = K.childDates(kidDates());
    const picks = a ? a.ids.map(id => GD.items.find(g => g.id === id)).filter(Boolean) : GD.items.filter(g => g.home).slice(0, 3);
    view.innerHTML = '<section class="pad">'
      + (mode === 'local' ? mockBadge() : '')
      + kidCard()
      + kidsRow()
      + agesRow(key)
      + '<div class="sec"><h2>' + (a ? esc(a.name) + ', 지금 챙길 것' : '지금 챙길 것') + '</h2>' + (a ? '<span>순서대로</span>' : '') + '</div>'
      + (a && calcS.job !== 'worker' ? '<a class="jobhint" href="#/g/leave-job">회사원 등 고용보험 기준이에요. <b>다른 직종 보기 ›</b></a>' : '')
      + timeline(key, d)
      + '<a class="btn primary gobig" href="#/guide">가이드 탭에서 더 많은 정보를 <span class="nw">확인하세요 →</span></a>'
      + '<div class="sec"><h2>' + (a ? '이 나이에 맞는 글' : '아빠 가이드') + '</h2>' + (!a ? '<a class="all" href="#/guide">전체 보기 →</a>' : picks.length > 4 ? '<a class="all" href="#/guide/age/' + key + '">전체 보기 →</a>' : '') + '</div>'
      + '<div class="tiles" style="margin-top:0">' + picks.slice(0, 4).map(g => tile(g.e, g.title, '#/g/' + g.id)).join('') + '</div>'
      + '<div id="homeCom">' + (canRead() ? '<div class="sec"><h2>' + (a ? '또래 아빠들 글' : '커뮤니티 새 글') + '</h2><a class="all" href="#/community">전체 보기 →</a></div><div class="loading">불러오는 중…</div>' : '') + '</div>'
      + '<p class="foot-note"><a href="#/terms">이용약관</a> · <a href="#/privacy">개인정보 처리방침</a></p>'
      + '</section>';
    window.scrollTo(0, 0);
    bindHomeAge();
    let posts = [], err = null, locked = !canRead(), peers = false;
    if (!locked) {
      try {
        if (key) { posts = (await api('listPosts', { limit: 3, age: key })).posts; peers = posts.length > 0; }
        if (!posts.length) posts = (await api('listPosts', { limit: 3 })).posts;
      } catch (e) { if (readDenied(e)) locked = true; else err = e; }
    }
    if (seq !== renderSeq) return;
    const box = $('#homeCom'); if (!box) return;
    box.innerHTML = locked
      ? '<div class="sec"><h2>커뮤니티</h2></div><a class="notice vcta" id="homeLock" href="#/community" style="margin-top:0"><span class="e">🔒</span><span>' + (kakaoOn() ? '가입한' : '인증한') + ' 아빠만 볼 수 있어요. <b>' + joinWord() + '</b></span></a>'
      : '<div class="sec"><h2>' + (peers ? '또래 아빠들 글' : '커뮤니티 새 글') + '</h2><a class="all" href="#/community">전체 보기 →</a></div>'
        + '<div class="list" id="homeList">' + (err ? empty('글을 못 불러왔어요', '잠시 뒤 다시 열어 주세요') : (posts.length ? posts.map(pcard).join('') : '<a class="notice vcta" href="#/write" style="margin-top:0"><span class="e">👋</span><span>첫 아빠들을 모으고 있어요. <b>첫 글 쓰기</b></span></a>')) + '</div>';
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
      { h: '받는 것' }, { ul: ['닉네임(별명·거주지·자녀 출생연도 끝 2자리, 다른 아빠들에게 보여요), 내가 쓴 글·댓글, 신고 내용', '카카오 로그인 회원번호의 해시(프로필·이메일·전화번호는 받지 않아요)', '본인인증을 쓰면 중복 가입을 막는 값의 해시(이름·전화번호·생년월일·성별은 확인 뒤 바로 버려요)', '질문·제보 내용(쓴 사람은 저장하지 않아요. Q&A로 올리면 공개되고, 처리하면 지워요)', '인증 신청 답변(승인·거절하면 바로 지워요)', '이 기기 토큰과 복구 코드의 해시(원래 값은 서버에 없어요)', '누가 초대했는지, 마지막 접속 시각', '가입·코드·복구 시도 횟수 제한을 위한 기기 주소(IP)의 짧은 해시(이틀 안에 지워요)'] },
      { h: '받지 않는 것' }, { p: '이메일, 서류, 아이 이름·사진. 전화번호는 본인인증 때 확인만 하고 저장하지 않아요. 계산기에 넣은 아이 날짜와 월급은 이 기기에만 저장되고 서버로 보내지 않아요.' },
      { h: '왜 쓰나' }, { p: '커뮤니티 운영, 아빠 인증, 도배·사칭 막기에만 써요. 광고나 판매에 쓰지 않고 다른 곳에 주지 않아요.' },
      { h: '어디에 두나' }, { p: 'Cloudflare(Pages, D1)에 저장해요. 로그인은 카카오가, 본인인증은 포트원과 본인확인기관이 처리해요.' },
      { h: '언제 지우나' }, { p: '글·댓글은 지우는 즉시 내용을 비워요. 탈퇴하면 글·댓글 내용과 계정을 지우고 카카오 연결도 끊어요. 막힌 계정의 기록은 재가입을 막기 위해 남을 수 있어요.' },
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
    const link = (h, e, name, on) => '<a class="chip' + (on ? ' on' : '') + '" href="' + h + '"><span class="e">' + e + '</span>' + esc(name) + '</a>';
    return '<div class="chips" data-keep="guide">' + GD.cats.map(c => link('#/guide/' + c.key, c.e, c.name, c.key === cur) + (c.key === 'faq' ? link('#/calc', '💰', '계산기', cur === 'calc') : '')).join('')
      + link('#/library', '🗂️', '자료실', cur === 'library') + '</div>';
  }
  // 가이드 탭은 표지 없이 바로 글로(11-05 휴먼쌤 "네모칸으로 버튼 누르게 하는 표지는 없는게 더 낫고"). 어느 칸이든 제목과 상단 버튼 자리가 같다
  const guideHead = cur => pageHead('📚', '아빠 가이드') + guideChips(cur);
  // 근거 법령 표시(11-05 휴먼쌤 "'2026.11.04 법령기준'은 사실이 아니지 … 실제 법령의 명칭과 유효일자를 적어서 신뢰를 확보해"). 표는 law-data.js, 글과는 출처 주소로 잇는다
  const LAW_DATA = window.YK_LAWS || { checked: '', items: [] };
  const lawsFor = list => { const urls = list.reduce((a, g) => a.concat((g.sources || []).map(s => s.u || '')), []); return LAW_DATA.items.filter(l => urls.some(u => l.match.some(m => u.indexOf(m) >= 0))); };
  function lawBox(laws) {
    if (!laws.length) return '';
    const row = l => '<li><a href="https://www.law.go.kr/법령/' + encodeURI(l.key) + '" target="_blank" rel="noopener">' + esc(l.name) + '</a><small>' + esc(l.no) + ' · ' + dotd(l.effective) + ' 시행' + (l.upcoming ? ' · ' + dotd(l.upcoming) + ' 개정 시행 예정' : '') + '</small></li>';
    const rest = laws.slice(4);     // 많으면 앞의 넷만 보이고 나머지는 접는다(글자 수를 줄이면서 다 확인할 수 있게)
    return '<div class="lawbox"><b>근거 법령과 시행일</b><ul>' + laws.slice(0, 4).map(row).join('') + '</ul>'
      + (rest.length ? '<details class="dt"><summary>법령 ' + rest.length + '개 더 보기</summary><ul>' + rest.map(row).join('') + '</ul></details>' : '')
      + '<small class="lawchk">국가법령정보센터 ' + dotd(LAW_DATA.checked) + ' 조회</small></div>';
  }
  // 글을 확인한 뒤 법령이 바뀌었거나 오래되면 스스로 알린다(최신화 장치). 시행일은 tools/check_laws.py --write가 표에 넣는다
  const daysAgo = s => Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  function lawWarn(g, laws) {
    const newer = laws.filter(l => g.updated && l.effective > g.updated);
    if (newer.length) return '<div class="warn">⚠️ 이 글을 확인한 뒤 ' + esc(newer[0].name) + '이 바뀌었어요(' + dotd(newer[0].effective) + ' 시행). 내용이 다를 수 있으니 1350에 확인해 주세요.</div>';
    if (g.status !== '일반 조언' && g.updated && daysAgo(g.updated) > 180) return '<div class="warn">⚠️ 확인한 지 6개월이 넘은 글이에요. 신청 전에 1350에 확인해 주세요.</div>';
    return '';
  }
  // Q&A(11-05 휴먼쌤 "Q&A인데 그냥 읽기 자료같은 느낌이야"): 질문을 누르면 답이 펼쳐진다. 저장된 Q&A는 서버 없이 보이고, 관리자가 답한 질문을 위에 더한다
  const qaItem = (q, a, more) => '<details class="qa"><summary><span class="qm">Q</span><b>' + esc(q) + '</b></summary><div class="qa-a"><span class="am">A</span><div><p>' + rich(a) + '</p>' + (more ? '<a class="lk2" href="' + esc(more) + '">자세히 보기 ›</a>' : '') + '</div></div></details>';
  async function renderQna() {
    setTab('guide');
    bar(brandBar());
    const items = GD.items.filter(g => g.cat === 'faq'), seq = renderSeq;
    view.innerHTML = '<section class="pad">' + guideHead('faq')
      + '<div class="qalist"><div id="qaNew"></div>' + items.map(g => qaItem(g.q, g.a, '#/g/' + g.id)).join('') + '</div>'
      + '<button type="button" class="btn primary qaask" data-ask="1">질문하기</button>'
      + notes(['운영자가 확인해서 답을 여기에 올려요', '답은 법률 자문이 아니에요'])
      + lawBox(lawsFor(items)) + '</section>';
    window.scrollTo(0, 0);
    try {
      const r = await api('qnaList');
      if (seq !== renderSeq) return;
      const box = $('#qaNew'); if (box) box.innerHTML = (r.items || []).map(x => qaItem(x.question, x.answer, '')).join('');
    } catch (e) { /* 끊겨도 저장된 Q&A는 보인다 */ }
  }
  function renderGuide(cat) {
    if (!cat) cat = 'leave';
    if (cat === 'faq') { renderQna(); return; }
    setTab('guide');
    bar(brandBar());
    const items = GD.items.filter(g => g.cat === cat);
    view.innerHTML = '<section class="pad">'
      + guideHead(cat)
      + (cat === 'leave' ? calcCard() + '<a class="grow" href="#/calc" style="margin-top:16px"><span class="ge">🧮</span><span class="tx"><b>계산기 모음</b><small>단축근무 · 출산휴가 · 아이 날짜</small></span></a>' : '')
      + '<div class="glist">' + (items.length ? items.map(grow).join('') : empty('준비 중이에요', '곧 글이 올라와요')) + '</div>'
      + lawBox(lawsFor(items))
      + '</section>';
    window.scrollTo(0, 0);
    bindCalcCard();
  }
  // 이 나이에 맞는 글 전체(홈의 '전체 보기', 11-05 휴먼쌤 "그냥 아빠가이드가 나오는데 이건 아니니까")
  function renderGuideAge(key) {
    setTab('home');
    bar(backBtn('#/') + '<div class="fill atitle">이 나이에 맞는 글</div>');
    const a = AGE[key], items = a.ids.map(id => GD.items.find(g => g.id === id)).filter(Boolean);
    view.innerHTML = '<section class="pad">' + pageHead('📖', a.name, '이 나이에 맞는 글') + '<div class="glist">' + items.map(grow).join('') + '</div></section>';
    window.scrollTo(0, 0);
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
    const laws = lawsFor([g]);
    const note = g.status === '공식 근거' ? '<div class="draft"><span>✅</span><span>' + dotd(g.updated) + ' 법령과 정부 안내로 확인. 내 경우는 1350이나 고용센터에 문의</span></div>'
      : g.status === '일반 조언' ? '<div class="draft"><span>✍️</span><span>일반적인 조언이에요. 집마다 다를 수 있어요.</span></div>'
      : g.status === '자료 정리' ? '<div class="draft"><span>🗂️</span><span>' + dotd(g.updated) + ' 출처가 있는 자료로 정리. 내 경우는 1350이나 고용센터에 문의</span></div>' : '';
    view.innerHTML = '<section class="pad"><article class="garticle">'
      + '<div class="meta"><span class="badge c-etc">' + esc(c.e || '') + ' ' + esc(c.name || '') + '</span>' + (g.tag ? '<span class="tag ' + tagCls(g.tag) + '">' + esc(g.tag) + '</span>' : '') + '</div>'
      + '<h1>' + esc(g.title) + '</h1><p class="gsub">' + esc(g.sub) + '</p>' + lawWarn(g, laws) + note
      + blocks(g.body)
      + lawBox(laws)
      + (g.sources && g.sources.length ? '<div class="srcs"><b>출처</b><ul>' + g.sources.map(s => '<li><a href="' + esc(s.u) + '" target="_blank" rel="noopener">' + esc(s.t) + '</a></li>').join('') + '</ul></div>' : '')
      + (g.status !== '일반 조언' ? '<button type="button" class="fixbtn" data-fix="' + esc(g.id) + '">내용이 달라졌나요? 알려 주기</button>' : '')
      + '</article>'
      + (g.community && CAT[g.community] ? '<a class="glink" href="#/community/' + esc(g.community) + '"><span>💬 커뮤니티 "' + esc(CAT[g.community].name) + '"에서 이야기 나누기</span><span>→</span></a>' : '')
      + '</section>';
    window.scrollTo(0, 0);
  }

  // ----- 계산기 -----
  // ----- 계산기 -----
  function renderCalc(tab) {
    setTab('guide');
    bar(brandBar());
    // 네 개를 2열 2행으로 고정한다(11-05 휴먼쌤 "스크롤 말고 그냥 2열 2행으로")
    const grid = '<div class="calcgrid">' + CALC_TABS.map(t => '<a class="chip' + (t.key === tab ? ' on' : '') + '" href="#/calc/' + t.key + '"><span class="e">' + t.e + '</span>' + esc(t.name) + '</a>').join('') + '</div>';
    view.innerHTML = '<section class="pad">' + guideHead('calc') + grid + '<div id="calcJob"></div><div id="calcForm"></div><div id="calcOut"></div></section>';
    window.scrollTo(0, 0);
    const fill = ({ leave: calcLeave, reduce: calcReduce, paternity: calcPaternity, dates: calcDates })[tab];
    // 고용보험 근로자는 세 계산기 모두, 공무원·교원은 육아휴직 수당을 계산한다. 그 밖의 직종은 정보와 이동 단추. 날짜 칸은 누구나
    const paint = () => {
      if (tab === 'dates') { fill(); return; }
      $('#calcJob').innerHTML = '<div class="' + (JOB_LINE[calcS.job] ? 'jobflat' : 'about jobwrap') + '">' + jobBox() + '</div>';
      if (calcS.job === 'worker') { fill(); return; }
      if (isCivilJob() && tab === 'leave') { calcCivil(); return; }
      $('#calcForm').innerHTML = isCivilJob() ? civilOther(tab) : ''; $('#calcOut').innerHTML = '';
    };
    $('#calcJob').addEventListener('click', ev => { const b = ev.target.closest('[data-job]'); if (!b) return; calcS.job = b.dataset.job; saveCalc(); paint(); });
    paint();
  }
  const manField = (id, label, val, hint) => '<label class="lbl" for="' + id + '">' + esc(label) + '</label><div class="unit"><input class="inp" id="' + id + '" type="number" inputmode="decimal" min="0" step="1" value="' + esc(val) + '"><span>만원</span></div>' + (hint ? '<small class="hint">' + esc(hint) + '</small>' : '');
  const dateField = (id, label, val) => '<label class="dfield"><span>' + esc(label) + '</span><input class="inp" id="' + id + '" type="date" value="' + esc(val) + '"></label>';
  // 2024-12-19 대법원 전원합의체(2020다247190, 2023다302838)로 '고정성' 요건이 없어졌다. "매달 똑같이 받는 돈"은 옛 설명이다
  const ORD_HELP = '<details class="dt"><summary>통상임금이 뭔가요?</summary><p>정해진 일의 대가로 정기적·일률적으로 주기로 한 돈이에요. 기본급과 고정 수당이 대표적이에요. 정기상여금도 들어갈 수 있어요. 2024년 12월 대법원이 "지급일에 재직 중이어야 준다"는 조건만으로는 빠지지 않는다고 판단했어요. 초과근무수당과 실적에 따라 달라지는 성과급은 보통 빠져요. 휴직 시작일 기준이고, 정확한 금액은 회사 인사팀에 물어보세요.</p>'
    + '<div class="two"><label class="dfield"><span>기본급(만원)</span><input class="inp" id="ordBase" type="number" inputmode="decimal"></label><label class="dfield"><span>고정 수당·정기상여 월 환산(만원)</span><input class="inp" id="ordFix" type="number" inputmode="decimal"></label></div><button type="button" class="btn line small" id="ordAdd">더해서 넣기</button></details>';
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
    bong: '월봉급액을 넣어 주세요. 수당을 뺀 봉급이에요.',
    over3y: '육아휴직은 자녀 1명당 3년 이내예요. 기간을 줄여 주세요.',
    spouseNoLeave: '배우자가 육아휴직을 쓸 수 없으면(자영업·프리랜서·전업) 부모가 모두 쓰는 경우가 아니라서 일반 기준으로 계산했어요.',
    needBirth: '6+6은 아이가 생후 18개월 안일 때 부모가 모두 휴직을 시작해야 해요. 아이가 태어난 날이나 출산 예정일을 넣으면 계산해 드려요.',
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
      + '<label class="lbl" for="cUsed">이 아이로 이미 쓴 육아휴직</label><div class="unit"><input class="inp" id="cUsed" type="number" inputmode="numeric" min="0" max="18" value="' + esc(calcS.used || 0) + '"><span>개월</span></div><small class="hint">처음이면 0이에요. 나눠 쓰면 앞서 쓴 달에 이어서 계산해요.</small>'
      + '<span class="lbl">내 상황</span><div class="seg" id="cMode"><button type="button" data-m="general">일반</button><button type="button" data-m="both">부모 모두(6+6)</button><button type="button" data-m="single">한부모</button></div>'
      + '<div id="bothBox" hidden><span class="lbl">배우자는</span><div class="seg" id="cIns"><button type="button" data-s="worker">회사원 등 근로자</button><button type="button" data-s="civil">공무원·국공립 교원</button><button type="button" data-s="none">자영업·프리랜서·전업</button></div>'
      + '<details class="dt"><summary>배우자 직종에 따라 달라요</summary><p>배우자가 공무원·교원이어도 근로자인 나는 6+6을 받아요. 신청할 때 배우자의 휴직 경력을 증빙해요(고용노동부 답변). 배우자가 자영업·프리랜서·전업이면 육아휴직이 없어 일반 기준이에요. 사립학교 교직원 배우자는 답변을 찾지 못했으니 1350에 먼저 물어보세요.</p></details>'
      + '<label class="lbl" for="cSpouse">배우자가 쓰는 기간</label><div class="unit"><input class="inp" id="cSpouse" type="number" inputmode="numeric" min="0" max="18" value="' + esc(calcS.spouseMonths) + '"><span>개월</span></div>'
      + '<div id="spousePayBox">' + manField('cSpousePay', '배우자 월 통상임금 (선택)', calcS.spousePay, '넣으면 우리 집 합계도 보여 드려요.') + '</div>'
      + '<span class="lbl">아이 날짜(6+6은 꼭 필요해요)</span>' + kidSeg() + '<div class="two">' + dateField('cBirth', '태어난 날', calcS.birth) + dateField('cDue', '출산 예정일', calcS.due) + '</div><small class="hint">생후 18개월 안에 시작하는지 확인해요. 저장은 이 기기에만 돼요.</small></div>'
      + '<div id="singleBox" hidden><small class="hint">한부모는 한부모가족지원법에 따라 지원 대상으로 인정된 모 또는 부예요. 별거 중이거나 혼자 키운다는 것만으로는 아니에요(시행령 제95조의3 제3항).</small></div>'
      + '<details class="dt"><summary>휴직 중에 회사에서 돈을 받나요?</summary><p>회사에서 받는 돈과 급여를 합해 통상임금을 넘으면, 넘는 만큼 급여에서 빠져요.</p>' + manField('cCompany', '매달 받는 금액', calcS.company) + '</details>'
      + '</div>';
    const out = () => {
      const sj = calcS.spouseJob;
      // 6+6: 아이 날짜를 모르면 금액을 보여 주지 않고, 생후 18개월을 넘겨 시작하면 일반 기준으로 계산한다(11-04 재검토)
      const kid = K.childDates({ birth: calcS.birth, due: calcS.due });
      const needBirth = calcS.mode === 'both' && !kid.bothStartBy;
      const past18 = calcS.mode === 'both' && kid.bothStartBy && calcS.start > kid.bothStartBy;
      const r = K.leaveBenefit({ ordinary: toWon(calcS.pay), start: calcS.start, end: calcS.end, mode: past18 ? 'general' : calcS.mode, spouseMonths: calcS.spouseMonths, spouseLeave: sj !== 'none', usedMonths: calcS.used, companyPay: toWon(calcS.company) });
      if (needBirth) r.warnings.push('needBirth');
      const noPay = r.warnings.includes('pay');
      $$('#cMode button').forEach(b => b.classList.toggle('on', b.dataset.m === calcS.mode));
      $('#bothBox').hidden = calcS.mode !== 'both';
      $('#singleBox').hidden = calcS.mode !== 'single';
      $('#spousePayBox').hidden = sj !== 'worker';
      $$('#cIns button').forEach(b => b.classList.toggle('on', b.dataset.s === sj));
      let compare = '', house = '', birthNote = '';
      if (calcS.mode !== 'general' && !past18 && r.rows.length && !noPay) {
        const g = K.leaveBenefit({ ordinary: toWon(calcS.pay), start: calcS.start, end: calcS.end, usedMonths: calcS.used, companyPay: toWon(calcS.company) });
        if (r.total > g.total) compare = '<p class="cline">일반 기준보다 <b>' + won(r.total - g.total) + '</b> 더 받아요.</p>';
      }
      if (calcS.mode === 'both' && sj === 'worker' && !past18 && toWon(calcS.spousePay) > 0 && +calcS.spouseMonths > 0) {
        const sEnd = K.addDays(K.addMonths(calcS.start, Math.min(18, +calcS.spouseMonths)), -1);
        const s = K.leaveBenefit({ ordinary: toWon(calcS.spousePay), start: calcS.start, end: sEnd, mode: 'both', spouseMonths: r.used + r.fullMonths });
        house = '<p class="cline">배우자 ' + s.months + '개월 <b>' + won(s.total) + '</b> · 우리 집 합계 <b>' + won(r.total + s.total) + '</b></p>';
      }
      if (calcS.mode === 'both' && sj === 'civil' && r.common) house = '<p class="cline">배우자는 공무원 수당 규정으로 따로 받아요. 나는 급여 신청 때 배우자의 휴직 경력을 증빙해요.</p>';
      if (kid.bothStartBy && calcS.mode === 'both') {
        const d = kid;
        birthNote = past18
          ? '<div class="warn">⚠️ 시작일이 생후 18개월(' + dot(d.bothStartBy) + ')을 넘어요. 부모 모두 그날까지 휴직을 시작해야 6+6이 돼요. 그래서 일반 기준으로 계산했어요.' + (+calcS.used ? ' 나눠 쓰는 뒤 기간이 6+6에 드는지는 고용센터에 확인해 주세요.' : '') + '</div>'
          : '<p class="cline ok">시작일이 생후 18개월(' + dot(d.bothStartBy) + ') 안이에요. 배우자도 그날까지 시작해야 해요. 내가 먼저 쓰면 일단 일반 기준으로 받고, 배우자가 쉰 뒤 차액을 더 받아요.</p>';
      }
      const tbl = groupRows(r.rows).map(g => '<tr><td>' + (g.full ? (g.from === g.to ? g.from + '개월째' : g.from + '~' + g.to + '개월째') : g.from + '개월째 ' + g.days + '일') + (g.special ? ' <span class="six">6+6</span>' : '') + '<small>' + Math.round(g.rate * 100) + '% · 상한 ' + (g.cap / 10000) + '만원' + (g.cut ? ' · ' + won(g.cut) + ' 감액' : '') + '</small></td><td>' + (g.full ? '월 ' : '') + won(g.paid) + '</td></tr>').join('');
      // 회사 신청 기한(시작 30일 전)이 이미 지났으면 "그날까지"가 아니라 지금 할 수 있는 일을 알려 준다(시행령 제11조 제7항: 기한 뒤 신청도 30일 안에 시작일을 정해 허용)
      const late = r.applyBy && r.applyBy < todayStr();
      const dates = '<div class="about"><b>챙길 날짜</b><ul>'
        + (late ? '<li>회사 신청 기한(시작 30일 전, <b>' + dot(r.applyBy) + '</b>)은 지났어요. 회사와 협의하면 지금도 신청할 수 있고, 기한을 넘겨 신청하면 회사는 신청일부터 30일 안에 시작일을 정해 허용해야 해요.</li>'
          : '<li>회사에 신청: <b>' + dot(r.applyBy) + '</b>까지(시작 30일 전)</li>')
        + '<li>급여 신청: <b>' + dot(r.claimFrom) + '</b>부터 <b>' + dot(r.claimTo) + '</b>까지 고용24에서</li></ul></div>';
      $('#calcOut').innerHTML = warnBox(r.warnings) + birthNote + (r.rows.length && !noPay && !needBirth ? '<div class="result"><small>' + r.months + '개월 받는 돈(어림)' + (r.mode === 'both' && r.common ? ' · 6+6 ' + r.common + '개월' : '') + '</small><strong>' + won(r.total) + '</strong>' + compare + house + '<table class="calctbl">' + tbl + '</table></div>' + dates : '')
        + basis('고용보험법 시행령 제95조·제95조의3·제98조(시행 2026.9.18.), 고용노동부 답변', W24_SIM, ['고용보험 가입 180일 이상만 수급', '실제 금액은 고용센터 결정'], '급여는 시작 전 고용보험 가입 기간(피보험 단위기간)이 180일 이상이어야 해요. 지난 직장 기간도 합쳐요(공백이 3년 이상이면 그 전은 빠지고, 실업급여를 받았으면 그 전은 빠져요). 그 회사에서 일한 기간이 6개월 미만이면 회사가 휴직을 거부할 수 있어요. 실제 금액은 고용센터가 정해요.');
    };
    const setMonths = m => { calcS.end = K.addDays(K.addMonths(calcS.start, m), -1); $('#cEnd').value = calcS.end; saveCalc(); out(); };
    bindInputs({
      cPay: el => { calcS.pay = parseFloat(el.value) || 0; }, cStart: el => { if (K.parse(el.value)) calcS.start = el.value; }, cEnd: el => { if (K.parse(el.value)) calcS.end = el.value; },
      cUsed: el => { calcS.used = parseInt(el.value, 10) || 0; }, cSpouse: el => { calcS.spouseMonths = parseInt(el.value, 10) || 0; }, cSpousePay: el => { calcS.spousePay = el.value; }, cBirth: el => { calcS.birth = el.value; }, cDue: el => { calcS.due = el.value; }, cCompany: el => { calcS.company = el.value; }
    }, out);
    $('#cQuick').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (b) setMonths(+b.dataset.m); });
    $('#cMode').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (b) { calcS.mode = b.dataset.m; saveCalc(); out(); } });
    $('#cIns').addEventListener('click', ev => { const b = ev.target.closest('[data-s]'); if (b) { calcS.spouseJob = b.dataset.s; saveCalc(); out(); } });
    bindOrd(out);
    out();
  }
  // 공무원·교원 육아휴직 수당(공무원수당 규정 제11조의3 등). 고용보험과 달리 월봉급액 기준이고, 나오는 기간에 끝이 있다
  function calcCivil() {
    $('#calcForm').innerHTML = '<div class="form">'
      + manField('cBong', '내 월봉급액', calcS.bong, '수당을 뺀 봉급이에요. 급여명세서의 봉급 칸을 봐요. 휴직 시작일 기준이에요.')
      + '<label class="lbl" for="cMon">쉬는 기간</label><div class="unit"><input class="inp" id="cMon" type="number" inputmode="numeric" min="1" max="36" value="' + esc(calcS.cMonths) + '"><span>개월</span></div>'
      + '<div class="quick" id="cMq">' + [6, 12, 18, 36].map(m => '<button type="button" class="chip" data-m="' + m + '">' + m + '개월</button>').join('') + '</div>'
      + '<span class="lbl">내 상황</span><div class="seg" id="cCm"><button type="button" data-m="general">일반</button><button type="button" data-m="second">두 번째로 쉬어요</button><button type="button" data-m="single">한부모</button></div>'
      + '<small class="hint">같은 자녀로 부모가 모두 쉬고 내가 두 번째면 첫 6개월 상한이 올라가요. 배우자가 회사원이어도 돼요.</small>'
      + '<label class="chk"><input type="checkbox" id="cLong"' + (calcS.cLonger ? ' checked' : '') + '> 부모가 각각 3개월 이상 쉬거나 장애 자녀의 부모예요(수당 1년 6개월까지)</label>'
      + '</div>';
    const out = () => {
      const r = K.civilBenefit({ bong: toWon(calcS.bong), months: calcS.cMonths, mode: calcS.cMode, longer: calcS.cLonger });
      $$('#cCm button').forEach(b => b.classList.toggle('on', b.dataset.m === calcS.cMode));
      const tbl = groupRows(r.rows).map(g => '<tr><td>' + (g.from === g.to ? g.from + '개월째' : g.from + '~' + g.to + '개월째') + '<small>' + Math.round(g.rate * 100) + '% · 상한 ' + (g.cap / 10000) + '만원</small></td><td>월 ' + won(g.paid) + '</td></tr>').join('');
      $('#calcOut').innerHTML = warnBox(r.warnings)
        + (r.bong && r.rows.length ? '<div class="result"><small>' + r.months + '개월 쉴 때 받는 수당(어림)</small><strong>' + won(r.total) + '</strong>'
          + (r.unpaidMonths ? '<p class="cline">수당은 ' + r.paidMonths + '개월까지예요. 나머지 ' + r.unpaidMonths + '개월은 수당이 없어요.</p>' : '')
          + '<table class="calctbl">' + tbl + '</table></div>' : '')
        + '<div class="about"><b>자녀 나이와 기간</b><ul><li>일반 공무원: 12세 이하 또는 초6 이하 자녀(국가공무원법 제71조, 지방공무원법 제63조)</li><li>교사: 만 8세 이하 또는 초2 이하 자녀(교육공무원법 제44조, 사립학교법 제59조)</li><li>자녀 1명당 3년 이내</li></ul><a class="lk2" href="#/g/leave-job">직종별 안내 보기</a></div>'
        + notes(['수당 규정 숫자로 만든 육아맨 어림값(고용24 제공 아님)', '실제 금액은 소속 기관 결정'])
        + '<details class="dt"><summary>근거와 주의할 점</summary><p>' + (calcS.job === 'pteacher' ? '사립학교 교원은 국공립 교원 규정을 준용해요(사립학교법 시행령 제24조의9). 실제 지급은 학교 행정실에 확인해 주세요. ' : '') + '근거: 공무원수당 규정 제11조의3(시행 2026.10.2.), 지방공무원 수당 규정 제11조의2(시행 2026.10.1.), ' + esc(dot(K.RULES.checkedAt)) + ' 확인.</p></details>';
    };
    bindInputs({ cBong: el => { calcS.bong = parseFloat(el.value) || 0; }, cMon: el => { calcS.cMonths = parseInt(el.value, 10) || 0; }, cLong: el => { calcS.cLonger = el.checked; } }, out);
    $('#cMq').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (b) { calcS.cMonths = +b.dataset.m; $('#cMon').value = calcS.cMonths; saveCalc(); out(); } });
    $('#cCm').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (b) { calcS.cMode = b.dataset.m; saveCalc(); out(); } });
    out();
  }
  // 공무원·교원의 단축·출산휴가 칸: 근로자용 계산식이 아니라서 안내로 보낸다
  function civilOther(tab) {
    const t = tab === 'reduce' ? '공무원·교원은 육아기 근무시간 단축수당이 따로 있어요(공무원수당 규정 제11조의3 제5항). 이 칸은 회사원 등 고용보험 근로자용이에요. 금액은 소속 기관에 확인해 주세요.'
      : '공무원·교원의 배우자 출산휴가는 복무 규정을 따라요. 이 칸은 회사원 등 고용보험 근로자용이에요. 소속 기관에 확인해 주세요.';
    return '<div class="about">' + t + '<a class="lk2" href="#/g/leave-job" style="display:block">직종별 안내 보기</a></div>';
  }
  // 어림이라는 것과 꼭 알 것만 한 줄로 두고, 자세한 근거는 접어 둔다(11-04 휴먼쌤 "글자수도 너무 많고")
  function basis(law, simUrl, short, extra) {
    return notes(['법령 숫자로 만든 육아맨 어림값(고용24 제공 아님)'].concat(short))
      + '<details class="dt"><summary>근거와 주의할 점</summary><p>' + esc(extra || '') + ' 근거: ' + esc(law) + ', ' + esc(dot(K.RULES.checkedAt)) + ' 확인.</p></details>'
      + '<a class="offi" href="' + esc(simUrl) + '" target="_blank" rel="noopener">고용24 공식 사이트에서 확인하기</a>';
  }
  function calcReduce() {
    $('#calcForm').innerHTML = '<div class="form">' + manField('cPay', '내 월 통상임금', calcS.pay) + ORD_HELP
      + '<div class="two" style="margin-top:12px"><label class="dfield"><span>단축 전 주 근로시간</span><input class="inp" id="cBefore" type="number" inputmode="numeric" value="' + esc(calcS.before) + '"></label><label class="dfield"><span>단축 후 주 근로시간</span><input class="inp" id="cAfter" type="number" inputmode="numeric" value="' + esc(calcS.after) + '"></label></div>'
      + '<div class="quick" id="cHours">' + [35, 30, 25, 20, 15].map(h => '<button type="button" class="chip" data-h="' + h + '">주 ' + h + '시간</button>').join('') + '</div>'
      + '<span class="lbl">하교 시간에 맞춰 퇴근 시각으로 고르기</span><div class="quick" id="cOut">' + [[14, 20], [15, 25], [16, 30], [17, 35]].map(x => '<button type="button" class="chip" data-h="' + x[1] + '">오후 ' + (x[0] - 12) + '시 퇴근</button>').join('') + '</div><small class="hint">9시 출근, 점심 1시간, 주 5일로 계산했어요. 오후 3시 퇴근이면 주 25시간이에요.</small>'
      + '<label class="lbl" for="cMonths">단축 기간</label><div class="unit"><input class="inp" id="cMonths" type="number" inputmode="numeric" min="1" max="36" value="' + esc(calcS.rMonths) + '"><span>개월</span></div>'
      + '<details class="dt"><summary>마지막 달이 한 달을 못 채우나요?</summary><p>못 채운 달의 급여는 그 달의 일수에 비례해 줄어요. 그 달에 쓰는 일수를 넣으면 31일 달 기준으로 어림해서 합계에 반영해요.</p><div class="unit"><input class="inp" id="cLast" type="number" inputmode="numeric" min="0" max="30" value="' + esc(calcS.rLast || '') + '" aria-label="마지막 달 일수"><span>일</span></div></details></div>';
    const out = () => {
      const r = K.reduceBenefit({ ordinary: toWon(calcS.pay), before: calcS.before, after: calcS.after, months: calcS.rMonths, lastDays: calcS.rLast });
      $('#calcOut').innerHTML = warnBox(r.warnings) + (r.cut > 0 && !r.warnings.includes('pay') ? '<div class="result"><small>단축근무 중 한 달 수입(어림)</small><strong>' + won(r.monthly) + '</strong>'
        + '<table class="calctbl"><tr><td>회사 임금<small>일한 시간에 비례한 어림값</small></td><td>' + won(r.wage) + '</td></tr>'
        + '<tr><td>정부 급여 · 첫 ' + r.firstHours + '시간<small>통상임금 100%, 상한 250만원</small></td><td>' + won(r.first) + '</td></tr>'
        + (r.restHours ? '<tr><td>정부 급여 · 나머지 ' + r.restHours + '시간<small>통상임금 80%, 상한 160만원</small></td><td>' + won(r.rest) + '</td></tr>' : '')
        + (r.reduced ? '<tr><td>감액<small>임금과 급여의 합이 통상임금을 넘는 만큼</small></td><td>-' + won(r.reduced) + '</td></tr>' : '')
        + '<tr class="sum"><td>정부 급여 ' + r.months + '개월 합계</td><td>' + won(r.totalGov) + '</td></tr></table>'
        + '<p class="cline">평소 통상임금보다 한 달에 <b>' + won(Math.max(0, r.lost)) + '</b> 줄고, 주 <b>' + r.cut + '시간</b>을 아이와 더 보내요.</p></div>' : '')
        + basis('고용보험법 시행령 제104조의2(2026.1.1.부터 상한 250만·160만원, 하한 50만원)', 'https://m.work24.go.kr/cm/c/f/1100/selecSimulate13.do?systClId=SC00000252&systId=SI00000397&systCnntId=CI00001582', ['회사 임금은 임금 규정에 따라 변동'], '회사 임금은 일한 시간에 비례해 어림했어요. 실제 회사 임금은 임금 규정에 따라 달라요.');
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
      + '<span class="lbl">아이 날짜</span>' + kidSeg() + '<div class="two">' + dateField('cDue', '출산 예정일', calcS.due) + dateField('cBirth', '태어난 날', calcS.birth) + '</div></div>';
    const out = () => {
      const r = K.paternityPay({ ordinary: toWon(calcS.pay), priority: calcS.priority });
      $$('#cPri button').forEach(b => b.classList.toggle('on', (b.dataset.p === '1') === !!calcS.priority));
      const d = K.childDates({ birth: calcS.birth, due: calcS.due });
      $('#calcOut').innerHTML = warnBox(r.warnings) + (r.warnings.length ? '' : '<div class="result"><small>20일 동안 받는 돈(통상임금 기준)</small><strong>' + won(r.total) + '</strong>'
        + '<table class="calctbl"><tr><td>정부 급여<small>' + (calcS.priority ? '20일 상한 ' + won(r.capAll) + ' · 하한 최저임금' : '우선지원대상기업이 아니면 없음') + '</small></td><td>' + won(r.gov) + '</td></tr>'
        + '<tr><td>회사가 주는 몫<small>유급 휴가라 나머지는 회사 몫</small></td><td>' + won(r.company) + '</td></tr></table></div>')
        + (d.paternityTo ? '<div class="about"><b>쓸 수 있는 기간</b><ul><li>' + (d.paternityFrom ? '<b>' + dot(d.paternityFrom) + '</b>부터' : '출산 예정일 50일 전부터') + ' <b>' + dot(d.paternityTo) + '</b>까지' + (d.birth ? '' : '(예정일 기준 어림)') + '. 마지막 날이 토·일·공휴일이면 다음 날까지예요.</li><li>20일을 네 번까지 나눠 쓸 수 있어요.</li><li>날짜를 적은 문서로 회사에 알려요.</li></ul></div>' : '<div class="about">출산 예정일이나 태어난 날을 넣으면 쓸 수 있는 기간을 알려 드려요.</div>')
        + basis('남녀고용평등법 제18조의2(시행 2026.9.18.), 고용노동부 2026 급여 상한', 'https://www.work24.go.kr/', ['실제 금액과 날짜는 회사에 확인'], '1일 통상임금은 월 통상임금 ÷ 209시간 × 8시간으로 어림했어요. 끝나는 날은 태어난 날에 120일을 더한 값이니 회사와 확인해 주세요.');
    };
    bindInputs({ cPay: el => { calcS.pay = parseFloat(el.value) || 0; }, cDue: el => { calcS.due = el.value; }, cBirth: el => { calcS.birth = el.value; } }, out);
    $('#cPri').addEventListener('click', ev => { const b = ev.target.closest('[data-p]'); if (b) { calcS.priority = b.dataset.p === '1'; saveCalc(); out(); } });
    bindOrd(out);
    out();
  }
  function calcDates() {
    $('#calcForm').innerHTML = '<div class="form"><span class="lbl">아이 날짜</span>' + kidSeg() + '<div class="two">' + dateField('cBirth', '태어난 날', calcS.birth) + dateField('cDue', '출산 예정일', calcS.due) + '</div><small class="hint">날짜는 이 기기에만 저장돼요. 서버로 보내지 않아요.</small></div>';
    const out = () => {
      const d = K.childDates({ birth: calcS.birth, due: calcS.due });
      const row = (t, v, n) => '<tr><td>' + esc(t) + (n ? '<small>' + esc(n) + '</small>' : '') + '</td><td>' + dot(v) + '</td></tr>';
      const after = d.birthReportBy ? '<div class="result"><small>태어난 뒤 챙길 기한</small><table class="calctbl">'
        + row('출생신고', d.birthReportBy, '출생 후 1개월 안. 늦으면 과태료')
        + row('부모급여 신청', d.parentPayBy, '출생일 포함 60일 안이면 태어난 달부터. 마지막 날이 휴일이면 다음 날까지')
        + row('BCG 접종', d.bcgBy, '생후 4주 안')
        + '<tr><td>영유아 건강검진 1차<small>생후 14~35일</small></td><td>' + dot(d.check1From) + '~<br>' + dot(d.check1To) + '</td></tr>'
        + row('첫만남이용권 신청·사용', d.firstVoucherBy, '2024년 이후 출생아는 2년 안')
        + '</table></div><a class="grow" href="#/g/birth-2weeks" style="margin-top:8px"><span class="ge">👶</span><span class="tx"><b>2주 안에 아빠가 할 일</b><small>순서대로 보기</small></span></a>' : '';
      const guess = d.birth ? '' : '. 예정일 기준 어림';
      $('#calcOut').innerHTML = d.paternityTo ? after + '<div class="result"><table class="calctbl">'
        + (d.paternityFrom ? row('배우자 출산전후휴가 시작 가능', d.paternityFrom, '출산 예정일 50일 전') : '')
        + row('배우자 출산전후휴가 마지막', d.paternityTo, '출산 후 120일. 마지막 날이 휴일이면 다음 날까지' + guess)
        + row('6+6 시작 마지막 날', d.bothStartBy, '부모 모두 생후 18개월 안에 시작' + guess)
        + row('육아휴직 시작 마지막 날', d.leaveStartBy, '만 8세 이하 또는 초2 이하 중 늦은 날')
        + row('단축근무 시작 마지막 날', d.reduceStartBy, '만 12세 이하 또는 초6 이하 중 늦은 날')
        + '</table></div>' + notes(['회사원 등 고용보험 근로자 기준', '공무원·교원은 <a href="#/g/leave-job">직종별 안내</a> 참고'])
        + '<details class="dt"><summary>어떻게 계산했나요</summary><p>초등학교는 만 6세가 되는 해의 다음 해 3월 입학으로 계산했어요. 입학을 앞당기거나 늦췄으면 달라져요. 시작일이 이 날 안이면, 쉬는 도중 나이를 넘어도 이어서 쓸 수 있어요. 근거: 남녀고용평등법 제18조의2·제19조·제19조의2.</p></details>'
        : '<div class="about">태어난 날이나 출산 예정일을 넣으면 챙길 날짜를 보여 드려요.</div>';
    };
    bindInputs({ cDue: el => { calcS.due = el.value; }, cBirth: el => { calcS.birth = el.value; } }, out);
    out();
  }

  // ----- 자료실 -----
  const LIB_STEP = 20;     // 유용한 순으로 20개씩(11-05 휴먼쌤). 순서는 tools/build_library.py가 정해 둔다
  const lib = { items: null, q: '', topic: '', shown: LIB_STEP };
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
    // 제목 + 오른쪽 표시 + 설명 한 덩이(홈 타임라인과 같은 짜임). 세부 사실(facts)은 카드에 쓰지 않고 검색에만 쓴다
    return '<a class="lcard" href="' + esc(x.url) + '" target="_blank" rel="noopener"><span class="top"><b>' + esc(x.title) + '</b><span class="pill' + (x.official ? '' : ' done') + '">' + esc(x.official ? '공식' : x.type) + '</span></span>'
      + '<small>' + esc(x.publisher || '') + (x.date ? ' · ' + esc(dot(x.date)) : '') + '</small><p>' + esc(x.summary || '') + '</p></a>';
  }
  function paintLibrary() {
    const box = $('#libList'); if (!box) return;
    const words = lib.q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = lib.items.filter(x => (!lib.topic || x.topic === lib.topic) && words.every(w => x._hay.indexOf(w) >= 0));
    $('#libCount').textContent = rows.length + '건';
    box.innerHTML = rows.length ? rows.slice(0, lib.shown).map(lcard).join('') + (rows.length > lib.shown ? '<button type="button" class="more" id="libMore">더 보기</button>' : '') : empty('찾는 자료가 없어요', '다른 말로 찾아보세요');
  }
  async function renderLibrary() {
    setTab('guide');
    bar(brandBar());
    view.innerHTML = '<section class="pad">' + guideHead('library') + '<div class="loading" id="libLoad">불러오는 중…</div></section>';
    window.scrollTo(0, 0);
    try { await loadLibrary(); } catch (e) { $('#libLoad').outerHTML = empty('자료를 못 불러왔어요', '잠시 뒤 다시 열어 주세요'); return; }
    const sec = $('#view section');
    $('#libLoad').remove();
    sec.insertAdjacentHTML('beforeend', '<div class="searchbar"><input id="libQ" type="search" placeholder="키워드 검색: 6+6, 복직, 판례, 후기" enterkeyhint="search" autocomplete="off" value="' + esc(lib.q) + '"></div>'
      + '<div class="chips" id="libTopics"><button type="button" class="chip' + (!lib.topic ? ' on' : '') + '" data-t="">전체</button>' + lib.topics.map(t => '<button type="button" class="chip' + (lib.topic === t ? ' on' : '') + '" data-t="' + esc(t) + '">' + esc(t) + '</button>').join('') + '</div>'
      + '<div class="sec" style="margin-top:4px"><h2 style="font-size:15px">' + (lib.updated ? esc(dot(lib.updated)) + ' 모음' : '자료') + '</h2><span id="libCount"></span></div><div class="list" id="libList"></div>'
      + notes(['누르면 원문으로 이동', '숫자는 그 자료가 나온 때 기준']));
    $('#libQ').addEventListener('input', ev => { lib.q = ev.target.value.trim(); lib.shown = LIB_STEP; paintLibrary(); });
    $('#libTopics').addEventListener('click', ev => { const b = ev.target.closest('[data-t]'); if (!b) return; lib.topic = b.dataset.t; lib.shown = LIB_STEP; $$('#libTopics .chip').forEach(x => x.classList.toggle('on', x === b)); paintLibrary(); });
    $('#libList').addEventListener('click', ev => { if (!ev.target.closest('#libMore')) return; lib.shown += LIB_STEP; paintLibrary(); });
    lib.shown = LIB_STEP;
    paintLibrary();
  }

  // ----- 커뮤니티 -----
  const listState = { cat: '', age: '', q: '', posts: [], next: null, scroll: 0, keep: false };   // age = 아이 나이로 거르기(UI 3안). 분류를 바꿔도 유지
  function chip(key, name, e, cur) { return '<a class="chip' + (key === cur ? ' on' : '') + '" href="#/community' + (key ? '/' + key : '') + '"><span class="e">' + e + '</span>' + esc(name) + '</a>'; }
  function pcard(p) {
    const c = CAT[p.cat] || { name: p.cat, e: '' };
    return '<a class="pcard" href="#/p/' + p.id + '" data-keep="1"><div class="meta"><span class="badges"><span class="badge c-' + (CAT[p.cat] ? esc(p.cat) : 'etc') + '">' + c.e + ' ' + esc(c.name) + '</span>' + (AGE[p.age] ? '<span class="agetag">' + esc(AGE[p.age].name) + '</span>' : '') + '</span><span class="time">' + ago(p.created) + '</span></div>'
      + '<h3>' + esc(p.title) + '</h3><p>' + esc(p.preview || '') + '</p>'
      + '<div class="foot">' + who(p.nick, p.badge, p.rank) + '<span class="cmt">' + ICON.chat + ' ' + (p.comments || 0) + '</span></div></a>';
  }
  // 커뮤니티 잠금: 인증 전에는 목록·글·검색을 열지 않고, 왜 닫혀 있는지와 인증하는 길을 보여 준다
  function renderLock() {
    fab.hidden = true;
    view.innerHTML = '<section class="pad">' + pageHead('💬', '커뮤니티')
      + (mode === 'local' ? mockBadge() : '')
      + '<div class="lockbox" id="lockBox"><div class="lk">🔒</div><h2>' + (kakaoOn() ? '가입한 아빠만 볼 수 있어요' : '인증한 아빠만 볼 수 있어요') + '</h2>'
      + '<p>아빠끼리 마음 놓고 이야기하는 곳이에요.</p>'
      + (me && me.blocked ? '<div class="vstate bad">이용이 제한된 계정이에요.</div>'
        : kakaoOn() ? '<div id="lockCta">' + kakaoBtn('lockKakao', '카카오로 시작하기') + '</div>'
        : identityOn() ? '<div id="lockCta"><button type="button" class="btn primary" id="lockGo">본인인증하고 시작하기</button><small class="hint">이름·전화번호는 저장하지 않아요.</small></div>'
        : '<div id="lockCta"><button type="button" class="btn primary" id="lockGo">초대 코드가 있어요</button><button type="button" class="btn line" id="lockNo">코드가 없어요 (신청서)</button><small class="hint">서류나 사진은 받지 않아요.</small></div>')
      + '</div>'
      + '<div class="sec"><h2>' + (kakaoOn() ? '가입 전에도' : '인증 전에도') + ' 볼 수 있어요</h2></div>'
      + '<div class="tiles center" style="margin-top:0">' + tile('📚', '아빠 가이드', '#/guide') + tile('🙋', 'Q&A', '#/guide/faq') + tile('💰', '계산기', '#/calc') + tile('🗂️', '자료실', '#/library') + '</div></section>';
    window.scrollTo(0, 0);
    const after = () => render();
    const lk = $('#lockKakao'); if (lk) lk.addEventListener('click', kakaoGo);
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
      if (cta && !kakaoOn() && r.application && r.application.status === 'pending') {
        cta.innerHTML = statusBox(r);
        const d = $('#doVerify'); if (d) d.addEventListener('click', () => openVerify(after));
      }
    }).catch(e => { if (e && e.code === 'unknown_user' && $('#lockBox')) { setMe(null); renderLock(); } });
  }
  async function renderCommunity(cat) {
    setTab('community');
    if (!canRead()) { bar(brandBar()); renderLock(); return; }
    fab.hidden = false;
    bar(brandBar());
    const reuse = listState.keep && listState.cat === cat && listState.posts.length > 0;
    listState.keep = false;
    if (!reuse) { listState.cat = cat; listState.q = ''; listState.posts = []; listState.next = null; }
    const q = listState.q;
    view.innerHTML = '<section class="pad">'
      + pageHead('💬', '커뮤니티')
      + '<div class="chips">' + chip('', '전체', '🏠', cat) + CATS.map(c => chip(c.key, c.name, c.e, cat)).join('') + '</div>'
      // 나이는 드롭다운, 검색창은 늘 이 자리에(11-05 휴먼쌤 "드롭다운으로" · "지금 위치에 고정")
      + '<label class="agesel"><select id="ageSel" aria-label="아이 나이로 거르기"><option value="">전체 나이</option>' + AGES.map(x => '<option value="' + x.key + '"' + (x.key === listState.age ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>'
      + '<div class="searchbar" id="searchbar"><input id="q" type="search" placeholder="키워드로 글 찾기 (예: 복직, 이유식)" enterkeyhint="search" autocomplete="off" value="' + esc(q) + '"><button type="button" class="sgo" id="qgo">찾기</button><button type="button" class="sx" id="qx" aria-label="검색 지우기">✕</button></div>'
      + (mode === 'local' ? mockBadge() : '')
      + '<div id="hotBox"></div>'
      + '<div class="list" id="list"></div><button type="button" class="more" id="more" hidden>더 보기</button>'
      + '</section>';
    const syncClear = () => { $('#qx').hidden = !$('#q').value; };     // 지울 글자가 있을 때만 ✕
    syncClear();
    const doSearch = () => { listState.q = $('#q').value.trim(); $('#q').blur(); loadList(false); };
    $('#q').addEventListener('input', syncClear);
    $('#q').addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); doSearch(); } });
    $('#qgo').addEventListener('click', doSearch);
    $('#qx').addEventListener('click', () => { $('#q').value = ''; syncClear(); if (listState.q) { listState.q = ''; loadList(false); } });
    $('#more').addEventListener('click', () => loadList(true));
    $('#ageSel').addEventListener('change', ev => { listState.age = ev.target.value; loadList(false); });
    if (reuse) { paintList(); loadHot(); window.scrollTo(0, listState.scroll); } else { window.scrollTo(0, 0); await loadList(false); }
  }
  // 지금 뜨는 글(11-05 휴먼쌤 "핫한 글이 있으면 상위로 띄워서"). 분류·나이·검색을 고르면 그 결과만 보이게 숨긴다
  async function loadHot() {
    const box = $('#hotBox'); if (!box) return;
    if (listState.cat || listState.age || listState.q) { box.innerHTML = ''; return; }
    const seq = renderSeq;
    try {
      const r = await api('hotPosts');
      if (seq !== renderSeq || !$('#hotBox')) return;
      $('#hotBox').innerHTML = r.posts.length ? '<section class="hot"><h2>🔥 지금 뜨는 글</h2>' + r.posts.map((p, i) => '<a class="hotrow" href="#/p/' + p.id + '" data-keep="1"><i>' + (i + 1) + '</i><b>' + esc(p.title) + '</b><span>댓글 ' + (p.comments || 0) + '</span></a>').join('') + '</section>' : '';
    } catch (e) { /* 인기 글은 없어도 목록은 보인다 */ }
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
      if (!more) loadHot();
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
    return '<div class="cmt-item" id="c' + c.id + '"><div class="top">' + who(c.nick, c.badge, c.rank) + '<span class="right"><span class="time">' + ago(c.created) + '</span>'
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
      + '<h1>' + esc(p.title) + '</h1><div class="byline">' + who(p.nick, p.badge, p.rank) + '<span>' + ymd(p.created) + '</span></div>'
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
        listState.posts = []; if (!noteRank(rr.comment.rank)) toast('댓글을 남겼어요');
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
      + (!canWrite() ? '<button type="button" class="notice vcta" id="vcta" style="margin-bottom:8px"><span class="e">✅</span><span>글은 ' + (kakaoOn() ? '가입한' : '인증한') + ' 아빠만 올릴 수 있어요. 써 둔 글은 이 기기에 남아요. <b>' + joinWord() + '</b></span></button>' : '')
      + '<form class="form" id="wform" novalidate>'
      + '<span class="lbl">분류</span><div class="catpick" id="catpick">' + CATS.map(c => '<button type="button" class="chip' + (d.cat === c.key ? ' on' : '') + '" data-pick="' + c.key + '"><span class="e">' + c.e + '</span>' + esc(c.name) + '</button>').join('') + '</div>'
      + '<span class="lbl">아이 나이 <small style="font-weight:600">(또래 아빠들이 찾기 쉬워요)</small></span><div class="catpick" id="agepick">' + AGES.map(x => '<button type="button" class="chip' + ((d.age || currentAge()) === x.key ? ' on' : '') + '" data-age="' + x.key + '">' + esc(x.name) + '</button>').join('') + '</div>'
      + '<label class="lbl" for="wtitle">제목</label><input class="inp" id="wtitle" maxlength="60" placeholder="한 줄로 요약해 주세요" value="' + esc(d.title || '') + '" autocomplete="off">'
      + '<label class="lbl" for="wbody">내용</label><textarea class="inp" id="wbody" maxlength="3000" placeholder="묻고 싶은 것, 알려 주고 싶은 것을 편하게 적어 주세요. 링크도 붙일 수 있어요.">' + esc(d.body || '') + '</textarea>'
      + '<div class="cnt"><span id="wcnt">' + len(d.body || '') + '</span>/3000</div>'
      + '<div class="notice"><span class="e">🔒</span><span>아이 이름·어린이집 이름은 적지 말아 주세요.</span></div>'
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
      try { const r = await api('createPost', p); store.del('draft'); listState.posts = []; if (!noteRank(r.post && r.post.rank)) toast('글을 올렸어요'); go('#/p/' + r.id, true); }
      catch (e) { fail(e, submit); }
      finally { btns.forEach(b => { b.disabled = false; }); }
    };
    form.addEventListener('submit', ev => { ev.preventDefault(); submit(); });
  }

  // ----- MY -----
  let meSeg = 'posts';
  // 11-05 휴먼쌤 "이런 어설픈건 빼주고 법적으로 필요할 때만 '이용약관'에 올려": 운영자·문의·저장 항목은 약관과 처리방침 안에 둔다. 처리방침은 공개 의무(개인정보 보호법 제30조)라 링크만 남긴다
  function aboutBox() { return '<p class="foot-note"><a href="#/terms">이용약관</a> · <a href="#/privacy">개인정보 처리방침</a></p>'; }
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
    if (kakaoOn()) return '<div class="vstate"><span><b>아직 인증 전이에요.</b><br>카카오를 연결하면 바로 커뮤니티를 쓸 수 있어요.</span><button type="button" class="edit" id="doVerify">카카오 연결</button></div>';
    const ap = r.application;
    if (ap && ap.status === 'pending') return '<div class="vstate wait"><span><b>인증 신청을 확인하고 있어요.</b><br>승인되면 여기에 바로 표시돼요. 초대 코드가 생기면 먼저 쓸 수도 있어요.</span><button type="button" class="edit" id="doVerify">코드 넣기</button></div>';
    return '<div class="vstate"><span><b>아직 인증 전이에요.</b><br>커뮤니티는 인증한 아빠만 읽고 쓸 수 있어요.' + (ap && ap.status === 'rejected' ? ' 지난 신청은 승인되지 않았어요. 다시 신청할 수 있어요.' : '') + '</span><button type="button" class="edit" id="doVerify">인증하기</button></div>';
  }
  // 내 계급과 전체 계급표(11-05 휴먼쌤 "현재 나는 전체 계급중에 어디에 해당하는지"). 점수 얻는 법은 접어 둔다. r.rank === null이면 운영 계정
  function rankBox(r) {
    const lv = r.rank, cur = RANKS[lv], next = cur && RANKS[lv + 1], pts = r.points || 0;
    const head = cur
      ? '<div class="rkhead">' + rankMark(lv) + '<div class="tx"><b>' + cur.name + '</b><small>' + cur.line + '</small></div><span class="rkpt">' + pts + '점</span></div>'
        + (next ? '<div class="rkbar"><i style="width:' + Math.round((pts - cur.at) / (next.at - cur.at) * 100) + '%"></i></div><p class="rknext">' + next.name + ' 진급까지 <b>' + (next.at - pts) + '점</b></p>' : '<p class="rknext">최고 계급입니다.</p>')
      : '<p class="rknext" style="margin-top:0">운영 계정은 계급 없이 표시돼요.</p>';
    return '<section class="rkbox" id="rankBox">' + head
      + '<ol class="rkladder">' + RANKS.map((x, i) => '<li class="' + (i === lv ? 'me' : cur && i < lv ? 'done' : 'todo') + '"' + (i === lv ? ' aria-current="true"' : '') + '>' + (i === lv ? '<em>나</em>' : '') + rankMark(i) + '<b>' + x.name + '</b><small>' + x.at + '점</small></li>').join('') + '</ol>'
      + '<details class="rkhow"><summary>점수 얻는 법</summary><ul><li>다른 아빠 글에 댓글 <b>2점</b> (글마다 1번)</li><li>글쓰기 <b>3점</b> (하루 2개까지)</li><li>내 글에 다른 아빠 댓글 <b>1점</b> (글마다 사람당 1번)</li><li>지운 글·댓글은 빠져요</li></ul></details></section>';
  }
  async function renderMe() {
    setTab('me');
    bar(brandBar());
    if (!me) {
      view.innerHTML = '<section class="pad">' + pageHead('😊', 'MY')
        + '<div class="profile" style="margin-top:12px"><span class="big">👋</span><div class="tx"><b>' + (kakaoOn() ? '아직 가입 전이에요' : '아직 닉네임이 없어요') + '</b>' + (kakaoOn() ? '' : '<small>이메일·서류는 받지 않아요.</small>') + '</div></div>'
        + (pendingInvite ? '<div class="notice vcta" style="margin-top:12px"><span class="e">🎟️</span><span>받은 초대 코드 <b>' + esc(pendingInvite) + '</b>가 있어요. 시작하기를 누르면 바로 인증돼요.</span></div>' : '')
        + (kakaoOn() ? '<div style="margin-top:12px">' + kakaoBtn('startBtn', '카카오로 시작하기') + '</div>' : '<button type="button" class="btn primary" id="startBtn" style="margin-top:12px">시작하기</button>')
        + '<button type="button" class="btn ghost" id="recoverBtn">' + (kakaoOn() ? '복구 코드가 있어요' : '다른 폰에서 쓰던 닉네임이 있어요 (복구 코드)') + '</button>' + themeBox() + installBox() + aboutBox() + '</section>';
      bindTheme();
      $('#startBtn').addEventListener('click', () => { if (kakaoOn()) kakaoGo(); else openSheet(() => render()); });
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
    view.innerHTML = '<section class="pad">' + pageHead('😊', 'MY')
      + '<div class="profile" style="margin-top:12px"><span class="big">' + esc(first(r.user.nick)) + '</span><div class="tx"><b>' + esc(r.user.nick) + '</b><small>' + ymd(r.user.created) + '부터 육아맨 · 글 ' + r.posts.length + ' · 댓글 ' + r.comments.length + '</small></div><button type="button" class="edit" id="editNick">닉네임 바꾸기</button></div>'
      + statusBox(r)
      + (canWrite() ? rankBox(r) : '')
      + (r.user.role === 'admin' ? '<a class="glink" href="#/admin"><span>🛠️ 관리자 화면: 인증 신청 · 초대 코드 · 회원</span><span>→</span></a>' : '')
      + (canWrite() && !(kakaoOn() && r.user.role !== 'admin') ? inviteBox(r) : '')
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
    noteRank(r.rank);
    if (pendingInvite && canWrite()) {        // 이미 인증했어도 관리자 코드는 쓸 수 있다(서버가 아빠 코드는 쓰지 않고 넘긴다)
      const c = pendingInvite; clearInvite();
      api('verifyCode', c).then(x => { if (x.user && x.user.role === 'admin' && me.role !== 'admin') { setMe(x.user); toast('관리자로 바뀌었어요'); render(); } }).catch(() => {});
    }
    else if (pendingInvite && !invitePrompted) { invitePrompted = true; openVerify(() => render()); }
    if (r.user.verified && r.user.how === 'apply' && !store.get('welcomed')) { store.set('welcomed', true); toast('아빠 인증이 승인됐어요'); }
  }
  // 내 계정: 복구 코드(폰 바꿀 때) · 이 기기 로그아웃 · 탈퇴(11-04 검수 3·5). 복구 코드는 서버에 해시만 있어 이 기기에 남긴 것을 보여 준다.
  function accountBox(r) {
    const rec = store.get('recovery', '');
    if (me && me.kakao) return '<div class="about" id="acctBox"><b>내 계정</b><p class="sm">카카오로 로그인했어요. 폰을 바꿔도 카카오로 다시 들어오면 돼요.</p>'
      + '<div class="two" style="margin-top:10px"><button type="button" class="btn line small" id="logoutBtn">이 기기 로그아웃</button>' + (me.role === 'admin' ? '' : '<button type="button" class="btn line small danger" id="quitBtn">탈퇴하기</button>') + '</div></div>';
    return '<div class="about" id="acctBox"><b>내 계정</b>' + (kakaoOn() ? '<div style="margin:8px 0 10px">' + kakaoBtn('kakaoLink', '카카오 연결하기') + '</div>' : '') + '<p class="sm">폰을 바꿔도 이 코드로 돌아올 수 있어요. 어디에 적어 두세요.</p>'
      + '<div class="irow"><code>' + (rec ? esc(rec) : (r.has_recovery ? '이 기기에 코드가 없어요' : '코드 없음')) + '</code><button type="button" class="edit" id="recNew">' + (rec ? '새 코드' : '코드 받기') + '</button></div>'
      + '<div class="two" style="margin-top:10px"><button type="button" class="btn line small" id="logoutBtn">이 기기 로그아웃</button>' + (me && me.role === 'admin' ? '' : '<button type="button" class="btn line small danger" id="quitBtn">탈퇴하기</button>') + '</div></div>';
  }
  function bindAccount() {
    const kl = $('#kakaoLink'); if (kl) kl.addEventListener('click', kakaoGo);
    const rn = $('#recNew');
    if (rn) rn.addEventListener('click', async () => {
      if (store.get('recovery', '') && !confirm('새 복구 코드를 만들면 지금 코드는 쓸 수 없어요. 만들까요?')) return;
      rn.disabled = true;
      try { const x = await api('recoveryNew'); store.set('recovery', x.recovery); showRecovery(x.recovery, () => render()); } catch (e) { rn.disabled = false; fail(e); }
    });
    const lo = $('#logoutBtn');
    if (lo) lo.addEventListener('click', async () => {
      const rec = store.get('recovery', '');
      if (!confirm(me && me.kakao ? '이 기기에서 로그아웃할까요? 카카오로 다시 들어올 수 있어요.' : '이 기기에서 로그아웃할까요? 다시 들어오려면 복구 코드가 필요해요.' + (rec ? '' : ' 지금 이 기기에는 복구 코드가 없어요. 먼저 "코드 받기"를 눌러 적어 두세요.'))) return;
      try { await api('logout'); } catch (e) { if (!(e && (e.code === 'unknown_user' || e.code === 'login'))) { fail(e); return; } }
      forgetDevice(); toast('로그아웃했어요'); render();
    });
    const q = $('#quitBtn');
    if (q) q.addEventListener('click', async () => {
      if (window.prompt('탈퇴하면 내 글과 댓글 내용이 모두 지워지고 되돌릴 수 없어요. 계속하려면 "탈퇴"라고 적어 주세요.') !== '탈퇴') return;
      if (me && me.kakao && kakaoOn()) { startKakao('leave').catch(e => fail(e)); return; }      // 카카오 연결을 끊으려면 카카오를 한 번 거친다
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
      const state = u.role === 'admin' ? '관리자' : u.blocked ? '막힘' : u.verified ? '인증(' + ({ invite: '초대', apply: '신청', admin: '관리자', identity: '본인인증', kakao: '카카오' }[u.verified_how] || '') + ')' : '인증 전';
      const acts = u.role !== 'user' ? '' : (u.blocked ? '<button type="button" class="edit" data-u="' + u.id + '" data-a="unblock">풀기</button>'
        : (u.verified ? '<button type="button" class="edit" data-u="' + u.id + '" data-a="unverify">해제</button>' : '<button type="button" class="edit" data-u="' + u.id + '" data-a="verify">인증</button>') + '<button type="button" class="edit" data-u="' + u.id + '" data-a="block">막기</button>')
        + '<button type="button" class="edit" data-u="' + u.id + '" data-a="logout">끊기</button>'
        + (u.posts ? '<button type="button" class="edit" data-u="' + u.id + '" data-a="hide_all">글 숨김</button>' : '');
      return '<div class="urow"><div class="tx"><b>' + esc(u.nick) + '</b><small>' + state + (u.inviter ? ' · 초대: ' + esc(u.inviter) : '') + ' · 글 ' + u.posts + ' · ' + ymd(u.created) + '</small></div><div class="acts">' + acts + '</div></div>';
    };
    // Q&A 질문 · 글 제보 · 올라간 Q&A · 최신화 점검(11-05 휴먼쌤)
    const qaAll = r.qna || [], qaQ = qaAll.filter(x => x.kind !== 'fix'), qaFix = qaAll.filter(x => x.kind === 'fix'), qaPub = r.qna_published || [];
    const guideTitle = id => { const g = GD.items.find(x => x.id === id); return g ? g.title : ''; };
    const qaCard = x => '<div class="appl" data-qa="' + x.id + '"><div class="meta"><b>질문</b><span class="time">' + ago(x.created) + '</span></div>'
      + '<textarea class="inp" data-f="q" rows="2" maxlength="300" style="min-height:64px;margin-top:6px" aria-label="질문">' + esc(x.question) + '</textarea>'
      + '<textarea class="inp" data-f="a" rows="4" maxlength="1000" style="min-height:96px;margin-top:8px" aria-label="답변" placeholder="답을 적어 올리면 Q&amp;A에 바로 보여요. 근거 법령도 함께 적어 주세요."></textarea>'
      + '<div class="two" style="margin-top:8px"><button type="button" class="btn primary small" data-qaa="answer">답변 올리기</button><button type="button" class="btn line small" data-qaa="delete">지우기</button></div></div>';
    const fixCard = x => '<div class="appl" data-qa="' + x.id + '"><div class="meta"><b>' + esc(guideTitle(x.ref) || '일반') + '</b><span class="time">' + ago(x.created) + '</span></div><p>' + esc(x.question) + '</p>'
      + '<div class="two" style="margin-top:8px">' + (x.ref ? '<a class="btn line small" href="#/g/' + esc(x.ref) + '" style="text-align:center">글 열기</a>' : '') + '<button type="button" class="btn primary small" data-qaa="delete">처리 완료</button></div></div>';
    const pubCard = x => '<div class="appl" data-qa="' + x.id + '"><div class="meta"><b>' + esc(x.question) + '</b><span class="time">' + ago(x.answered_at) + '</span></div><p>' + esc(x.answer) + '</p><button type="button" class="btn line small" data-qaa="delete">내리기</button></div>';
    const oldDocs = GD.items.filter(g => g.status !== '일반 조언' && g.updated && daysAgo(g.updated) > 90);
    const upcoming = LAW_DATA.items.filter(l => l.upcoming).map(l => esc(l.name) + ' ' + dotd(l.upcoming));
    view.innerHTML = '<section class="pad">'
      + '<div class="sec"><h2>Q&amp;A 질문</h2><span>' + qaQ.length + '건</span></div>' + (qaQ.length ? qaQ.map(qaCard).join('') : '<div class="about">대기 중인 질문이 없어요.</div>')
      + '<div class="sec"><h2>글 제보</h2><span>' + qaFix.length + '건</span></div>' + (qaFix.length ? qaFix.map(fixCard).join('') : '<div class="about">대기 중인 제보가 없어요.</div>')
      + (qaPub.length ? '<div class="sec"><h2>올라간 Q&amp;A</h2><span>' + qaPub.length + '건</span></div>' + qaPub.map(pubCard).join('') : '')
      + '<div class="sec"><h2>최신화 점검</h2></div><div class="about">' + notes(['법령 표 확인: ' + dotd(LAW_DATA.checked) + ' (' + daysAgo(LAW_DATA.checked) + '일 전)', '예고된 개정: ' + (upcoming.join(', ') || '없음'), '확인한 지 90일 넘은 글: ' + oldDocs.length + '편'])
      + oldDocs.slice(0, 20).map(g => '<a class="lk2" style="display:block" href="#/g/' + esc(g.id) + '">' + esc(g.title) + '</a>').join('') + '</div>'
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
    const qaa = ev.target.closest('[data-qaa]');
    try {
      if (qaa) {
        const card = qaa.closest('[data-qa]'), id = +card.dataset.qa;
        if (qaa.dataset.qaa === 'answer') {
          const answer = $('[data-f=a]', card).value.trim();
          if (len(answer) < LIM.qa[0]) { toast('답변을 적어 주세요', 'err'); return; }
          await api('adminQna', { id, action: 'answer', question: $('[data-f=q]', card).value.trim(), answer });
          toast('Q&A에 올렸어요');
        } else {
          await api('adminQna', { id, action: 'delete' });
          toast('처리했어요');
        }
        view.removeEventListener('click', adminClick); render(); return;
      }
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
  // 글을 쓰다가 로그인이 필요해졌을 때 등: 카카오로 안내하는 시트. 다녀오면 지금 화면으로 돌아온다
  function openKakaoSheet(after) {
    showSheet('<div class="sheet" role="dialog" aria-modal="true" aria-label="카카오로 시작하기"><div class="grip"></div><h2>' + (me ? '카카오를 연결해요' : '카카오로 시작해요') + '</h2>'
      + '<p>' + (me ? '카카오를 연결하면 바로 커뮤니티를 쓸 수 있어요.' : '커뮤니티는 가입한 아빠만 읽고 쓸 수 있어요.') + '</p><div style="margin-top:16px">' + kakaoBtn('kkGo', me ? '카카오 연결하기' : '카카오로 시작하기') + '</div>'
      + '<button type="button" class="btn ghost" id="kkNo">둘러보기만 할래요</button></div>', after);
    $('#kkGo').addEventListener('click', kakaoGo);
    $('#kkNo').addEventListener('click', () => { invitePrompted = true; closeSheet(); });
  }
  // 닉네임은 세 칸을 합쳐 만든다(11-05 휴먼쌤 "닉네임에 별명/거주지/자녀연생 끝2자리 입력"). 예: 든든이/청주/24
  const nickNow = () => ($('#nName').value.trim() || '별명') + '/' + ($('#nPlace').value.trim() || '거주지') + '/' + ($('#nYear').value.trim() || '00');
  function openSheet(after, kind) {
    if (kakaoOn() && kind !== 'rename' && kind !== 'kakao') { openKakaoSheet(after); return; }
    const rename = kind === 'rename', fromKakao = kind === 'kakao', P = nickParts(rename && me ? me.nick : '');
    showSheet('<div class="sheet" role="dialog" aria-modal="true" aria-label="' + (rename ? '닉네임 바꾸기' : '닉네임 정하기') + '"><div class="grip"></div>'
      + '<h2>' + (rename ? '닉네임 바꾸기' : fromKakao ? '닉네임을 정해 주세요 👋' : '육아맨에 온 걸 환영해요 👋') + '</h2>'
      + '<p>' + (rename ? '일주일에 한 번 바꿀 수 있어요. 지난 글의 이름도 함께 바뀌어요.' : fromKakao ? '글에 이 이름으로 보여요.' : '이메일이나 서류는 받지 않아요.') + '</p>'
      + '<span class="lbl">닉네임</span><div class="nick3">'
      + '<label>별명<input class="inp" id="nName" maxlength="8" placeholder="든든이" autocomplete="off" enterkeyhint="next" value="' + esc(P.name) + '"></label>'
      + '<label>거주지<input class="inp" id="nPlace" maxlength="6" placeholder="청주" autocomplete="off" enterkeyhint="next" value="' + esc(P.place) + '"></label>'
      + '<label>자녀 출생연도<input class="inp" id="nYear" maxlength="2" inputmode="numeric" placeholder="24" autocomplete="off" enterkeyhint="done" value="' + esc(P.year) + '"></label></div>'
      + '<div class="nickshow" id="nickShow"></div>'
      + '<small class="hint">거주지는 시·군까지만 · 출생연도는 끝 2자리(곧 태어나면 예정 연도, 아이가 둘 이상이면 막내) · 글에 그대로 보여요</small>'
      + (rename ? '' : (fromKakao && !pendingInvite ? '' : '<label class="lbl" for="invite">초대 코드 (있으면)</label><input class="inp code" id="invite" maxlength="12" placeholder="없으면 비워 두세요" autocomplete="off" autocapitalize="characters" value="' + esc(pendingInvite) + '">')
        + '<label class="chk"><input type="checkbox" id="agree"> 서로 존중하고, 아이의 이름·얼굴 같은 개인정보는 올리지 않을게요.</label>')
      + '<div class="err" id="nickErr" hidden></div>'
      + '<button type="button" class="btn primary" id="joinBtn">' + (rename ? '바꾸기' : '다음') + '</button>'
      + '<button type="button" class="btn ghost" id="laterBtn">' + (rename ? '취소' : '둘러보기만 할래요') + '</button></div>', after);
    const show = () => { $('#nickShow').textContent = '글에 이렇게 보여요: ' + (!me || me.role === 'user' ? RANKS[store.get('rank', 0)].name + ' ' : '') + nickNow(); };
    show();
    $('#laterBtn').addEventListener('click', () => { invitePrompted = true; closeSheet(); });
    $('#joinBtn').addEventListener('click', () => doJoin(rename));
    ['nName', 'nPlace', 'nYear'].forEach(id => {
      const el = $('#' + id);
      el.addEventListener('input', show);
      el.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); doJoin(rename); } });
    });
    setTimeout(() => { const n = $('#nName'); if (n) n.focus(); }, 60);
  }
  async function doJoin(rename) {
    const nameEl = $('#nName'), err = $('#nickErr'); if (!nameEl) return;
    const say = m => { err.hidden = false; err.textContent = m; };
    const name = nameEl.value.trim(), place = $('#nPlace').value.trim(), year = $('#nYear').value.trim();
    if (!/^[가-힣A-Za-z0-9]{2,8}$/.test(name)) return say('별명은 띄어쓰기 없이 2~8자로 적어 주세요');
    if (!/^[가-힣]{2,6}$/.test(place)) return say('거주지는 한글 2~6자로 적어 주세요(예: 청주)');
    if (!/^\d{2}$/.test(year)) return say('자녀 출생연도 끝 2자리를 숫자로 적어 주세요(예: 24)');
    const nick = name + '/' + place + '/' + year;
    const bad = checkNick(nick); if (bad) return say(MSG[bad]);
    if (!rename && !$('#agree').checked) return say('약속에 체크해 주세요');
    const btn = $('#joinBtn'); btn.disabled = true;
    try {
      const inv = $('#invite'), invite = rename || !inv ? '' : (inv.value || '').trim();
      const r = rename ? await api('rename', nick) : await api('join', nick, invite);
      setMe(r.user);
      const f = sheetAfter;
      if (rename) { toast('닉네임을 바꿨어요'); closeSheet(); if (f) f(); else render(); return; }
      if (r.recovery) store.set('recovery', r.recovery);
      if (r.invite_error === 'code_bad' || r.invite_error === 'code_used') clearInvite();
      const next = () => {
        if (r.user.verified) { clearInvite(); if (!r.existing) store.set('rank', 0); toast(r.existing ? '반가워요, ' + r.user.nick + '님!' : '입대를 환영합니다, ' + r.user.nick + '님!'); if (f) f(); else render(); return; }
        if (r.invite_error) toast(MSG[r.invite_error] || MSG.code_bad, 'err');
        openVerify(f);
      };
      closeSheet();
      if (r.recovery) showRecovery(r.recovery, next); else next();     // 가입 직후 복구 코드를 한 번 보여 준다(서버는 해시만 둔다)
    } catch (e) { say(errText(e)); }
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
  // 본인인증(포트원). config.js IDENTITY가 채워져야 켜진다. 폰은 인증 화면으로 넘어갔다가 이 주소로 돌아오니(?identityVerificationId=…) 시작할 때도 마무리한다
  function loadPortOne() { return new Promise((done, bad) => { if (window.PortOne) { done(); return; } const s = document.createElement('script'); s.src = 'https://cdn.portone.io/v2/browser-sdk.js'; s.onload = () => done(); s.onerror = () => bad(new ApiError('identity_bad')); document.head.appendChild(s); }); }
  async function finishIdentity(id) { const r = await api('verifyIdentity', id); setMe(r.user); toast('본인인증이 끝났어요. 반가워요!'); return r; }
  async function startIdentity() {
    await loadPortOne();
    const id = 'yk-' + randomToken().slice(0, 28);
    const res = await window.PortOne.requestIdentityVerification({ storeId: CFG.IDENTITY.storeId, identityVerificationId: id, channelKey: CFG.IDENTITY.channelKey, redirectUrl: location.origin + location.pathname });
    if (res && res.code) throw new ApiError('identity_bad');
    return finishIdentity(id);
  }
  function openIdentity(after) {
    showSheet('<div class="sheet" role="dialog" aria-modal="true" aria-label="본인인증"><div class="grip"></div><h2>본인인증</h2>'
      + '<p>휴대폰 본인인증(PASS)을 마치면 바로 커뮤니티를 쓸 수 있어요. 이름·전화번호는 저장하지 않아요.</p>'
      + '<div class="err" id="vErr" hidden></div><button type="button" class="btn primary" id="idGo">본인인증 하기</button>'
      + '<label class="lbl" for="vcode">초대 코드가 있다면</label><div class="two"><input class="inp code" id="vcode" maxlength="12" placeholder="ABCD-2345" autocomplete="off" autocapitalize="characters" value="' + esc(pendingInvite) + '"><button type="button" class="btn line small" id="vCodeGo" style="margin-top:0">코드 넣기</button></div>'
      + '<button type="button" class="btn ghost" id="vLater">나중에 할게요</button></div>', after);
    const show = e => { const err = $('#vErr'); err.hidden = false; err.textContent = errText(e); };
    const finish = () => { const f = sheetAfter; closeSheet(); if (f) f(); else render(); };
    $('#vLater').addEventListener('click', () => { invitePrompted = true; closeSheet(); if (['me', 'community', 'home'].includes(parse().name)) render(); });
    $('#idGo').addEventListener('click', async ev => { ev.target.disabled = true; try { await startIdentity(); finish(); } catch (e) { show(e); ev.target.disabled = false; } });
    $('#vCodeGo').addEventListener('click', async () => { try { const r = await api('verifyCode', $('#vcode').value.trim()); if (r.user) setMe(r.user); clearInvite(); toast('인증됐어요. 반가워요!'); finish(); } catch (e) { show(e); } });
  }
  // 아빠 인증: 초대 코드(바로) · 신청서(운영자 승인). 본인인증을 켜면 본인인증과 초대 코드만
  function openVerify(after) {
    if (!me) { openSheet(after); return; }
    if (kakaoOn()) { openKakaoSheet(after); return; }
    if (identityOn()) { openIdentity(after); return; }
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
  // 질문하기 · 글 제보(서버에 쌓이고 관리자가 본다. 쓴 사람은 저장하지 않는다)
  function openAsk(kind, ref) {
    const fix = kind === 'fix';
    showSheet('<div class="sheet" role="dialog" aria-modal="true" aria-label="' + (fix ? '내용 알려 주기' : '질문하기') + '"><div class="grip"></div><h2>' + (fix ? '내용이 달라졌나요?' : '질문하기') + '</h2>'
      + '<p>' + (fix ? '바뀐 내용이나 틀린 곳을 적어 주세요. 확인해서 고칠게요.' : '운영자가 확인해서 답을 Q&amp;A에 올려요.') + '</p>'
      + '<label class="lbl" for="askIn">' + (fix ? '무엇이 다른가요' : '궁금한 것') + '</label><textarea class="inp" id="askIn" rows="4" maxlength="300" style="min-height:112px" placeholder="' + (fix ? '예: 상한액이 바뀌었어요' : '예: 육아휴직 중에 이사해도 되나요?') + '"></textarea>'
      + '<small class="hint">아이 이름·회사 이름은 적지 말아 주세요.</small><div class="err" id="askErr" hidden></div>'
      + '<button type="button" class="btn primary" id="askGo">보내기</button><button type="button" class="btn ghost" id="askNo">취소</button></div>');
    $('#askNo').addEventListener('click', closeSheet);
    $('#askGo').addEventListener('click', async ev => {
      const text = $('#askIn').value.trim(), err = $('#askErr');
      if (len(text) < LIM.ask[0]) { err.hidden = false; err.textContent = MSG.ask_len; return; }
      ev.target.disabled = true;
      try { await api('ask', { kind, ref: ref || '', text }); closeSheet(); toast(fix ? '고마워요. 확인해 볼게요' : '받았어요. 답이 달리면 Q&A에 올라와요'); }
      catch (e) { err.hidden = false; err.textContent = errText(e); ev.target.disabled = false; }
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
    if (ev.target.closest('[data-ask]')) openAsk('question');
    const fx = ev.target.closest('[data-fix]'); if (fx) openAsk('fix', fx.dataset.fix);
    const kb = ev.target.closest('[data-kid]'); if (kb) pickKid(+kb.dataset.kid);
  });

  // 옆으로 밀리는 칩 줄의 양쪽 화살표(11-05 휴먼쌤 "다시 왼쪽으로 돌아가는 버튼이 없어"). 그쪽에 더 있을 때만 보이고, 누르면 밀린다
  const syncMore = el => {
    const w = el.parentNode;
    w.querySelector('.hsmore.prev').hidden = el.scrollLeft <= 8;
    w.querySelector('.hsmore.next').hidden = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
  };
  function markScrollers() {
    $$('#view .chips, #view .ages').forEach(el => {
      if (!el.parentNode.classList.contains('hs')) {
        const w = document.createElement('div'); w.className = 'hs';
        el.parentNode.insertBefore(w, el); w.appendChild(el);
        [['prev', '왼쪽으로 돌아가기', '‹', -1], ['next', '오른쪽으로 더 보기', '›', 1]].forEach(([side, label, mark, dir]) => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'hsmore ' + side; b.setAttribute('aria-label', label); b.innerHTML = '<span aria-hidden="true">' + mark + '</span>';
          b.addEventListener('click', () => el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.7), behavior: 'smooth' }));
          w.appendChild(b);
        });
        el.addEventListener('scroll', () => syncMore(el), { passive: true });
      }
      syncMore(el);
    });
  }
  // 상단 버튼을 눌러 화면이 다시 그려져도 옆으로 민 자리를 지킨다(11-05 휴먼쌤 "맨 왼쪽으로 돌아가지 않게"). 가이드 줄은 칸을 옮겨도 같은 줄로 친다. 눌린 버튼이 가려져 있으면 보이게 민다
  const chipPos = {};
  const chipKey = el => el.dataset.keep || parse().name + ':' + $$('#view .chips, #view .ages').indexOf(el);
  view.addEventListener('scroll', ev => { const t = ev.target; if (t.classList && (t.classList.contains('chips') || t.classList.contains('ages'))) chipPos[chipKey(t)] = t.scrollLeft; }, true);
  function restoreChips() {
    $$('#view .chips, #view .ages').forEach(el => {
      if (el.chipKept) return;
      el.chipKept = true;
      el.scrollLeft = chipPos[chipKey(el)] || 0;
      const on = el.querySelector('.on');
      if (on) {
        const a = on.getBoundingClientRect(), b = el.getBoundingClientRect(), clear = 66;     // 왼쪽 화살표에 가리지 않을 만큼
        if (a.right > b.right - 8 || (el.scrollLeft > 8 && a.left < b.left + clear)) el.scrollLeft += a.left - b.left - clear;
      }
      syncMore(el);
    });
  }
  // 그려지는 즉시(화면에 나오기 전에) 돌려놓는다. 묶음을 씌우면 위치가 지워지니 묶은 다음에
  new MutationObserver(() => { markScrollers(); restoreChips(); }).observe(view, { childList: true, subtree: true });
  window.addEventListener('resize', markScrollers);

  // ----- 시작 -----
  if (mode === 'local') { const u = local.user(); setMe(u ? pub(u) : null); }
  // 카카오에서 돌아왔을 때(?code=…&state=… 또는 ?error=…): 주소를 먼저 깨끗이 하고 원래 화면을 그린 뒤 마무리한다
  const kakaoBack = (function () {
    const p = new URLSearchParams(location.search), code = p.get('code'), err = p.get('error');
    if (p.has('identityVerificationId') || (!code && !err)) return null;     // 본인인증 복귀도 code를 쓴다
    invitePrompted = true;                                                    // 돌아온 순간 카카오 안내 시트가 다시 뜨지 않게
    const k = store.get('kakaoState', null); store.del('kakaoState');
    history.replaceState(null, '', location.pathname + ((k && k.back) || '#/'));
    if (!k || k.state !== p.get('state')) return { bad: !!code };     // 이 기기에서 시작한 로그인이 아니다
    return err ? {} : { purpose: k.purpose, code };
  })();
  render();
  if (kakaoBack) { if (kakaoBack.code) finishKakao(kakaoBack.purpose, kakaoBack.code); else if (kakaoBack.bad) toast(MSG.kakao_bad, 'err'); }
  // 본인인증 화면에서 돌아왔을 때(폰): ?identityVerificationId=…&code=…
  (function () {
    const p = new URLSearchParams(location.search), id = p.get('identityVerificationId');
    if (!id) return;
    history.replaceState(null, '', location.pathname + '#/me');
    if (p.get('code')) { toast(MSG.identity_bad, 'err'); render(); return; }
    finishIdentity(id).then(() => render()).catch(e => { toast(errText(e), 'err'); render(); });
  })();
  // 승인·해제가 다른 기기에서 일어나도 다음에 열 때 맞춘다(화면을 막지 않는다)
  // 읽기 자격이 바뀌었으면 커뮤니티가 보이는 화면을 다시 그린다(잠금 ↔ 글 목록)
  const syncMe = next => { const was = canRead(); setMe(next); if (!!was !== !!canRead() && ['home', 'community', 'post'].includes(parse().name)) render(); };
  if (me && mode === 'server' && !(kakaoBack && kakaoBack.code)) api('me').then(r => { syncMe(r.user); if (parse().name !== 'me') setDot(r.new_comments); }).catch(e => { if (e && e.code === 'unknown_user') syncMe(null); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
})();

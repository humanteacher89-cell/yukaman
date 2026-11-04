# 육아맨 (yukaman) — 저장소 안내문

육아하는 아빠들의 휴대폰 앱. **아빠 가이드**(육아휴직·놀이·심리·정책 글 + 육아휴직 급여 계산기)와 **커뮤니티**(사진·영상 없이 줄글 + 댓글, 검색). 홈 화면에 추가하면 앱처럼 열리는 웹 앱(PWA). 휴먼쌤 스튜디오 앱개발부, 2026-11-04 시작.

이 파일은 공개 파일이다 — 비밀 값·개인 정보·PC 경로를 적지 않는다. 경로는 모두 이 저장소 루트 기준.

## 짜임
- `public/` 화면 그대로 올라간다(만드는 단계 없음). `index.html` 틀 · `style.css` · `app.js`(화면 전부, 해시 주소) · `config.js`(API 주소) · `guide-data.js`(가이드 글·계산기 기준 — 정본) · `sample-data.js`(시험 모드 견본 글) · `manifest.json` · `sw.js` · `icons/`.
- `functions/api/[[path]].js` → `server/app.js`: Cloudflare Pages Functions 서버. 글·댓글·닉네임 API(맨 위 주석에 약속).
- `schema.sql` D1 표(users · posts · comments · acts). `test/seed-local.sql` 내 컴퓨터 미리 보기용 견본.
- `wrangler.toml` Pages 프로젝트 `humanssaem-yukaman` + D1 `yukaman`. `deploy.py` 미리 보기(`dev`) · 처음 설정(`setup`) · 표 갱신(`migrate`) · 올리기(`deploy`).

## 돌리기
- 미리 보기: `python -X utf8 deploy.py dev` → http://127.0.0.1:8799 (가짜 D1에 schema + 견본). wrangler가 없으면 `npx wrangler`.
- 정적 서버로 `public/`만 열면 `/api`가 없어 화면이 알아서 **시험 모드**(견본 글 + 그 기기 localStorage)로 돈다.
- 올리기는 휴먼쌤이 시킨 때만: 처음 한 번 `deploy.py setup`(D1 만들기 → wrangler.toml database_id 채움 → 표 → Pages 프로젝트), 그다음 `deploy.py deploy`.

## 약속
- 저장하는 개인정보는 닉네임 · 기기 토큰의 해시 · 쓴 글·댓글뿐. 이메일·전화·아이 정보 없음. 로그인 없음(기기 토큰은 폰에만).
- 사진·영상 없음(줄글 + 댓글만). 가이드 글은 `guide-data.js`에서만 고치고, 제도 숫자를 바꾸면 `calc`도 함께.
- 가이드 글은 모두 '확인 전' 초안 — 연구부 검증·휴먼쌤확인 뒤 `status: '검증'`.
- 화면 class·id는 `ad`로 시작하지 않게(삼성 인터넷 광고 차단이 숨김).

## 지금 상태와 남은 일
- 2026-11-04: 1판 시제품 — 홈 · 아빠 가이드(4분류 16글 + 급여 계산기) · 커뮤니티(6분류, 글·댓글·검색·내 글 삭제) · MY(닉네임·내 글·내 댓글) · 서버(D1) · 시험 모드. 내 컴퓨터 미리 보기로 확인. GitHub 저장소·Cloudflare(시험 주소)는 휴먼쌤 결정 뒤.
- 남은 일: 휴먼쌤 중간 확인 → 시험 주소(pages.dev) 올리기 → 가이드 글 검증(연구부) → 2차 후보(신고·관리자 숨김, 답글, 아이 나이대 태그, 모임 탭은 휴먼쌤 결정).

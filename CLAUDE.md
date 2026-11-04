# 육아맨 (yukaman) — 저장소 안내문

육아하는 아빠들의 휴대폰 앱. **아빠 가이드**(글 + 실제 계산기 + 자료실)와 **커뮤니티**(사진·영상 없이 줄글 + 댓글, 키워드 검색). 글·댓글은 인증한 아빠만, 읽기는 누구나. 홈 화면에 추가하면 앱처럼 열리는 웹 앱(PWA). 휴먼쌤 스튜디오 앱개발부, 2026-11-04 시작.

이 파일은 공개 파일이다 — 비밀 값·개인 정보·PC 경로를 적지 않는다. 경로는 모두 이 저장소 루트 기준.

## 짜임
- `public/` 화면 그대로 올라간다(만드는 단계 없음). `index.html` 틀 · `style.css` · `app.js`(화면 전부, 해시 주소) · `calc.js`(계산, 법령 기준) · `guide-data.js`(가이드 글) · `data/library.json`(자료실, 만들어지는 파일) · `config.js` · `sample-data.js`(서버 없을 때 시험 모드 견본) · `manifest.json` · `sw.js` · `icons/`.
- `functions/api/[[path]].js` → `server/app.js`: Cloudflare Pages Functions 서버. 맨 위 주석에 API 약속.
- `schema.sql` D1 표(users · invites · applications · posts · comments · acts).
- `seed/official-posts.json` → `tools/build_seed.py` → `seed/official.sql`: 자료실 계정의 글(공개 D1에도 넣음).
- `data-src/*.json` → `tools/build_library.py` → `public/data/library.json`: 자료실. `verdicts.json`은 재검증 결과.
- `wrangler.toml` Pages `humanssaem-yukaman` + D1 `yukaman`. `deploy.py` 미리 보기·올리기.

## 돌리기
- 미리 보기: `python -X utf8 deploy.py dev --fresh` → http://127.0.0.1:8799 (가짜 D1, 시험 코드는 `test/seed-local.sql`).
- 시험: `node test/calc-test.js` · `node test/api-test.mjs`(미리 보기를 --fresh로 띄운 뒤, 내 컴퓨터 주소에만).
- 정적 서버로 `public/`만 열면 `/api`가 없어 화면이 알아서 **시험 모드**(견본 글 + 그 기기 localStorage)로 돈다.
- 처음 한 번: `deploy.py setup` → `deploy.py deploy` → `deploy.py admin-code`(첫 관리자 코드, 저장소에 남기지 않음). 공개 반영은 휴먼쌤이 시킨 때만.

## 약속
- 저장하는 개인정보는 닉네임 · 기기 토큰의 해시 · 쓴 글·댓글 · 대기 중인 신청 답변뿐. 이메일·전화·서류·아이 정보를 받지 않는다. 계산기의 아이 날짜는 기기에만.
- 사진·영상 없음. 글과 댓글은 D1에 글자로 저장해 파일 저장소가 필요 없다.
- 지어낸 경험담을 서버에 넣지 않는다. `sample-data.js`는 시험 모드 표시와 함께 서버가 없을 때만 보인다.
- 자료실은 링크와 우리 말 요약만. 원문을 복사하지 않는다.
- 제도 숫자가 바뀌면 `public/calc.js` RULES와 `test/calc-test.js`, `guide-data.js`, `seed/official-posts.json`을 함께 고친다. 기준일 2026-11-04.
- 화면 class·id는 `ad`로 시작하지 않게(삼성 인터넷 광고 차단이 숨김). 그래서 관리자 화면 class도 appl·urow처럼 짓는다.

## 지금 상태와 남은 일
- 2026-11-04: 시험 주소 공개판 전 단계. 홈 · 가이드 21편 · 계산기 4종(육아휴직·단축근무·배우자 출산휴가·내 아이 날짜) · 자료실 · 커뮤니티(글·댓글·키워드 검색) · 아빠 인증(초대 코드·신청서·관리자 화면) · 자료실 글 24편.
- 2026-11-04: 아빠 인증은 초대 코드 + 신청서로 확정(휴먼쌤). 저장소 공개, Cloudflare Pages는 `deploy.py deploy`로 직접 올린다(저장소와 자동 연결은 없음).
- 남은 일: 공개 결정(이용약관·개인정보 처리방침 먼저) → 2차 후보(신고, 답글, 모임 탭, 휴대폰 본인인증, 검색 색인).

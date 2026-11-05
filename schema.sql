-- 육아맨 D1 짜임(2026-11-04). 몇 번 돌려도 그대로(IF NOT EXISTS).
-- 처음 한 번: deploy.py setup (표 + seed/official.sql). 이미 있는 표에 칸을 더하는 것은 deploy.py의 MIGRATIONS(ALTER TABLE, 있으면 건너뜀).

-- 사용자: 닉네임 + 기기 토큰 해시 + 아빠 인증 상태. 이메일·전화·서류·아이 정보는 받지 않는다. 토큰 자체는 폰(localStorage)에만 있다.
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY,
  nick         TEXT NOT NULL,
  nick_key     TEXT NOT NULL UNIQUE,     -- 띄어쓰기를 빼고 소문자(같은 닉네임 막기)
  token_hash   TEXT NOT NULL UNIQUE,     -- SHA-256('tok|' + 기기 토큰). 기기를 끊으면 'off|…'(어떤 토큰과도 안 맞음)
  recovery_hash TEXT,                    -- SHA-256('rec|' + 복구 코드 12자). 코드는 가입 때 한 번 보여 주고 폰을 바꿀 때 쓴다(한 번 쓰면 새 코드). 11-04 검수 3
  created      TEXT NOT NULL,            -- ISO 시각(UTC)
  last_seen    TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT 'user',   -- user · official(자료실 계정, 로그인 불가) · admin(휴먼쌤)
  verified     INTEGER NOT NULL DEFAULT 0,     -- 1 = 인증 아빠(글·댓글 가능)
  verified_how TEXT NOT NULL DEFAULT '',       -- invite(초대 코드) · apply(신청서 승인) · admin
  verified_at  TEXT,
  invited_by   INTEGER,                        -- 초대한 사람(초대 점수를 세고, 문제가 생기면 초대 줄기를 본다)
  blocked      INTEGER NOT NULL DEFAULT 0,     -- 1 = 인증 취소하고 다시 신청 못 함
  comments_seen TEXT,                          -- 내 글의 새 댓글을 마지막으로 본 시각(MY 배지, 검수 22). 기존 표에는 MIGRATIONS로 더함
  identity_hash TEXT,                          -- SHA-256('id|' + 본인인증 DI 또는 CI). 1인 1계정 확인용, 이름·전화번호는 저장하지 않는다(11-05). 기존 표에는 MIGRATIONS로 더함. 색인도 MIGRATIONS에
  kakao_hash   TEXT,                           -- SHA-256('kakao|' + 카카오 회원번호). 프로필·이메일·전화번호는 받지 않는다(11-05). 기존 표에는 MIGRATIONS로 더함. 색인도 MIGRATIONS에
  terms_at     TEXT                            -- 약관 동의 시각. 비어 있으면 글·댓글 전에 동의를 받는다(11-05 Play 등록). 기존 표에는 MIGRATIONS로 더함
);

-- 사용자 차단(11-05 Play 등록): user_id의 화면에서 blocked_id의 글·댓글을 숨긴다. 탈퇴하면 양쪽 줄을 지운다
CREATE TABLE IF NOT EXISTS user_blocks (
  user_id    INTEGER NOT NULL,
  blocked_id INTEGER NOT NULL,
  created    TEXT NOT NULL,
  PRIMARY KEY (user_id, blocked_id)
);

-- 카카오를 마치고 닉네임을 정하기 전의 기기(30분). 가입하면 줄을 지운다
CREATE TABLE IF NOT EXISTS kakao_pending (
  token_hash TEXT PRIMARY KEY,
  kakao_hash TEXT NOT NULL,
  created    TEXT NOT NULL
);

-- 초대 코드: 인증 아빠가 만들어 다른 아빠에게 준다. kind = dad(아빠 인증) · admin(첫 관리자, 한 번 쓰면 끝) · ref(아빠 초대 링크. 한 사람당 하나, 여러 번 쓰고 인증은 하지 않는다. 11-05)
CREATE TABLE IF NOT EXISTS invites (
  code     TEXT PRIMARY KEY,
  owner_id INTEGER,                 -- 만든 사람(운영 코드는 NULL)
  kind     TEXT NOT NULL DEFAULT 'dad',
  note     TEXT NOT NULL DEFAULT '',
  created  TEXT NOT NULL,
  used_by  INTEGER,
  used_at  TEXT,
  revoked  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS invites_owner ON invites (owner_id);
CREATE INDEX IF NOT EXISTS users_invited ON users (invited_by);   -- 계급 점수를 셀 때 후임을 찾는다

-- 인증 신청서: 코드가 없는 아빠가 쓴다. 승인·거절하면 답변(answer)은 지운다(개인정보를 남기지 않는다).
CREATE TABLE IF NOT EXISTS applications (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  stage      TEXT NOT NULL DEFAULT '',   -- raising(키우는 중) · expecting(곧 아빠)
  answer     TEXT NOT NULL DEFAULT '',
  created    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',   -- pending · approved · rejected
  decided_at TEXT,
  decided_by INTEGER
);
CREATE INDEX IF NOT EXISTS applications_status ON applications (status, id);
CREATE INDEX IF NOT EXISTS applications_user ON applications (user_id, id);

-- 글. 지운 글은 deleted에 지운 시각을 적고 title·body를 비운다(되살리기 없음). 탈퇴한 사람의 글도 같다.
CREATE TABLE IF NOT EXISTS posts (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  cat           TEXT NOT NULL,            -- question·tip·daily·leave·play·school·gear (public/app.js CATS와 같게)
  age           TEXT NOT NULL DEFAULT '', -- 아이 나이 칸: expect·baby·kid·low·high·teen, 비면 없음(public/app.js AGES와 같게, 11-04 UI 3안). 기존 표에는 MIGRATIONS로 더함
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  created       TEXT NOT NULL,
  comment_count INTEGER NOT NULL DEFAULT 0,
  deleted       TEXT
);
CREATE INDEX IF NOT EXISTS posts_list ON posts (deleted, id);
CREATE INDEX IF NOT EXISTS posts_cat  ON posts (cat, deleted, id);
-- posts_age 색인은 deploy.py MIGRATIONS에서 만든다. 여기 두면 이미 있는 표에 age 칸이 생기기 전에 돌아 오류가 난다(11-04)
CREATE INDEX IF NOT EXISTS posts_user ON posts (user_id);

-- 댓글(한 단계, 답글 없음 — 1판). 지운 댓글은 deleted에 시각, body는 빈 글자.
CREATE TABLE IF NOT EXISTS comments (
  id      INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  body    TEXT NOT NULL,
  created TEXT NOT NULL,
  deleted TEXT
);
CREATE INDEX IF NOT EXISTS comments_post ON comments (post_id, id);
CREATE INDEX IF NOT EXISTS comments_user ON comments (user_id);

-- 신고(11-04 검수 21). kind = post · comment. handled = 처리 시각(NULL이면 대기), result = hidden(숨김) · kept(그대로 둠)
CREATE TABLE IF NOT EXISTS reports (
  id         INTEGER PRIMARY KEY,
  kind       TEXT NOT NULL,
  target_id  INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  reason     TEXT NOT NULL DEFAULT '',
  created    TEXT NOT NULL,
  handled    TEXT,
  handled_by INTEGER,
  result     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS reports_open ON reports (handled, id);
CREATE INDEX IF NOT EXISTS reports_target ON reports (kind, target_id, user_id);

-- Q&A 질문과 가이드 글 제보(11-05). kind = question · fix, ref = 제보한 가이드 글 번호. status = pending · published. 쓴 사람은 저장하지 않는다. 처리하면 줄을 지운다(답을 올린 질문만 남음)
CREATE TABLE IF NOT EXISTS qna (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL DEFAULT 'question',
  ref         TEXT NOT NULL DEFAULT '',
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending',
  created     TEXT NOT NULL,
  answered_at TEXT,
  answered_by INTEGER
);
CREATE INDEX IF NOT EXISTS qna_status ON qna (status, id);

-- 검색 색인(검수 27): posts_fts(FTS5, trigram)과 트리거는 deploy.py MIGRATIONS에서 한 문장씩 만든다(트리거의 BEGIN…END를 파일로 넘기면 문장이 쪼개진다).

-- 횟수 제한(스팸·코드 맞히기 막기). who = 'u:<사용자 번호>' 또는 'ip:<기기 주소 해시 16자>', kind = join·post·comment·nick·code·apply·invite, at = 시각 ms.
-- 기한이 지난 줄은 다음 시도 때 지운다(기기 주소는 가입·코드 제한에만, 짧게).
CREATE TABLE IF NOT EXISTS acts (
  who  TEXT NOT NULL,
  kind TEXT NOT NULL,
  at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS acts_who ON acts (who, kind, at);

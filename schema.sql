-- 육아맨 D1 짜임(2026-11-04). 몇 번 돌려도 그대로(IF NOT EXISTS).
-- 처음 한 번: deploy.py setup (표 + seed/official.sql)

-- 사용자: 닉네임 + 기기 토큰 해시 + 아빠 인증 상태. 이메일·전화·서류·아이 정보는 받지 않는다. 토큰 자체는 폰(localStorage)에만 있다.
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY,
  nick         TEXT NOT NULL,
  nick_key     TEXT NOT NULL UNIQUE,     -- 띄어쓰기를 빼고 소문자(같은 닉네임 막기)
  token_hash   TEXT NOT NULL UNIQUE,     -- SHA-256('tok|' + 기기 토큰)
  created      TEXT NOT NULL,            -- ISO 시각(UTC)
  last_seen    TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT 'user',   -- user · official(자료실 계정, 로그인 불가) · admin(휴먼쌤)
  verified     INTEGER NOT NULL DEFAULT 0,     -- 1 = 인증 아빠(글·댓글 가능)
  verified_how TEXT NOT NULL DEFAULT '',       -- invite(초대 코드) · apply(신청서 승인) · admin
  verified_at  TEXT,
  invited_by   INTEGER,                        -- 초대한 사람(문제가 생기면 초대 줄기를 본다)
  blocked      INTEGER NOT NULL DEFAULT 0      -- 1 = 인증 취소하고 다시 신청 못 함
);

-- 초대 코드: 인증 아빠가 만들어 다른 아빠에게 준다. kind = dad(아빠 인증) · admin(첫 관리자, 한 번 쓰면 끝)
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

-- 글. 지운 글은 deleted에 지운 시각(목록·상세에서 빠짐, 되살리기 = 비움)
CREATE TABLE IF NOT EXISTS posts (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  cat           TEXT NOT NULL,            -- question·tip·daily·leave·play·gear (public/app.js CATS와 같게)
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  created       TEXT NOT NULL,
  comment_count INTEGER NOT NULL DEFAULT 0,
  deleted       TEXT
);
CREATE INDEX IF NOT EXISTS posts_list ON posts (deleted, id);
CREATE INDEX IF NOT EXISTS posts_cat  ON posts (cat, deleted, id);
CREATE INDEX IF NOT EXISTS posts_user ON posts (user_id);

-- 댓글(한 단계, 답글 없음 — 1판)
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

-- 횟수 제한(스팸·코드 맞히기 막기). who = 'u:<사용자 번호>' 또는 'ip:<기기 주소 해시 16자>', kind = join·post·comment·nick·code·apply·invite, at = 시각 ms.
-- 기한이 지난 줄은 다음 시도 때 지운다(기기 주소는 가입·코드 제한에만, 짧게).
CREATE TABLE IF NOT EXISTS acts (
  who  TEXT NOT NULL,
  kind TEXT NOT NULL,
  at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS acts_who ON acts (who, kind, at);

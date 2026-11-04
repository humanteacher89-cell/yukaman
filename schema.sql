-- 육아맨 D1 짜임(2026-11-04). 몇 번 돌려도 그대로(IF NOT EXISTS).
-- 처음 한 번: wrangler d1 execute yukaman --remote --file schema.sql   (deploy.py setup / migrate)

-- 사용자: 닉네임 + 기기 토큰 해시만. 이메일·전화·아이 정보는 받지 않는다. 토큰 자체는 폰(localStorage)에만 있다.
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY,
  nick       TEXT NOT NULL,
  nick_key   TEXT NOT NULL UNIQUE,     -- 띄어쓰기를 빼고 소문자(같은 닉네임 막기)
  token_hash TEXT NOT NULL UNIQUE,     -- SHA-256('tok|' + 기기 토큰)
  created    TEXT NOT NULL,            -- ISO 시각(UTC)
  last_seen  TEXT NOT NULL DEFAULT ''
);

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

-- 쓰기 횟수 제한(스팸 막기). who = 'u:<사용자 번호>' 또는 'ip:<기기 주소 해시 16자>', kind = join·post·comment·nick, at = 시각 ms.
-- 기한이 지난 줄은 다음 시도 때 지운다(기기 주소는 가입 제한에만, 10분).
CREATE TABLE IF NOT EXISTS acts (
  who  TEXT NOT NULL,
  kind TEXT NOT NULL,
  at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS acts_who ON acts (who, kind, at);

# 육아맨 미리 보기·올리기(2026-11-04). 화면은 public/ 그대로(만드는 단계 없음), 서버는 functions/·server/, 자료는 D1.
#   python -X utf8 deploy.py dev [--port 8799] [--fresh]   내 컴퓨터에서 미리 보기(가짜 D1에 schema.sql + seed/official.sql + test/seed-local.sql, --fresh면 가짜 D1을 비우고 다시)
#   python -X utf8 deploy.py setup                         처음 한 번(휴먼쌤 "올려" 뒤): D1 'yukaman' 만들기 → wrangler.toml database_id 채우기 → 표 → 자료실 글 → Pages 프로젝트 만들기
#   python -X utf8 deploy.py migrate                       공개 D1에 schema.sql + MIGRATIONS(이미 있는 표에 칸 더하기. 몇 번 돌려도 그대로)
#   python -X utf8 deploy.py seed                          공개 D1에 seed/official.sql(자료실 계정의 글 넣기) + seed/official-update.sql(이미 있는 글의 제목·본문 맞추기). 몇 번 돌려도 그대로
#   python -X utf8 deploy.py admin-code                    공개 D1에 첫 관리자 코드 하나를 만들어 화면에 보여 준다(한 번 쓰면 끝. 저장소에 남기지 않는다)
#   python -X utf8 deploy.py logout-user <회원 번호>        공개 D1에서 그 회원의 기기 토큰을 끊는다(폰을 잃은 관리자 등. 복구 코드로만 돌아온다)
#   python -X utf8 deploy.py backup                        공개 D1 표를 backups/yukaman-YYYYMMDD-HHMM.json으로 내려받는다(gitignore). 시점 되돌리기는 wrangler d1 time-travel
#   python -X utf8 deploy.py logs                          공개 서버 오류를 실시간으로 본다(wrangler pages deployment tail, Ctrl+C로 끝)
#   python -X utf8 deploy.py deploy                        Pages에 올리기(휴먼쌤이 시킨 때만)
# 지어낸 견본 글(test/seed-local.sql)은 내 컴퓨터 미리 보기에서만 쓴다. 공개 D1에는 넣지 않는다.
# wrangler: 환경 변수 WRANGLER_JS(wrangler.js 경로, NODE가 있으면 그 node로) → 위쪽 폴더 어딘가의 tools/cf-wrangler(포터블, 로그인 정보 config/ 포함) → npx wrangler.
import os, re, secrets, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = 'humanssaem-yukaman'
DB = 'yukaman'
PLACEHOLDER = '00000000-0000-0000-0000-000000000000'
ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
# schema.sql은 새 표만 만든다. 이미 있는 표에 칸을 더할 때는 여기에 한 줄(이미 있으면 'duplicate column' 오류가 나고 그냥 넘어간다)
MIGRATIONS = [
    'ALTER TABLE users ADD COLUMN recovery_hash TEXT',      # 2026-11-04 복구 코드(검수 3)
    'ALTER TABLE users ADD COLUMN comments_seen TEXT',      # 2026-11-04 새 댓글 배지(검수 22)
    "ALTER TABLE posts ADD COLUMN age TEXT NOT NULL DEFAULT ''",   # 2026-11-04 아이 나이 칸(UI 3안 '아이 나이 길')
    'CREATE INDEX IF NOT EXISTS posts_age ON posts (age, deleted, id)',
    'ALTER TABLE users ADD COLUMN identity_hash TEXT',      # 2026-11-05 본인인증(1인 1계정)
    'CREATE UNIQUE INDEX IF NOT EXISTS users_identity ON users (identity_hash) WHERE identity_hash IS NOT NULL',
    'ALTER TABLE users ADD COLUMN kakao_hash TEXT',         # 2026-11-05 카카오 로그인
    'CREATE UNIQUE INDEX IF NOT EXISTS users_kakao ON users (kakao_hash) WHERE kakao_hash IS NOT NULL',
    # 검색 색인(검수 27): trigram이라 한국어 조사가 붙어도 세 글자 조각으로 찾는다. 글을 넣고·고치고·지울 때 트리거가 따라간다. 이미 있으면 그대로.
    "CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(title, body, content='posts', content_rowid='id', tokenize='trigram')",
    'CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN INSERT INTO posts_fts(rowid, title, body) VALUES (new.id, new.title, new.body); END',
    "CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN INSERT INTO posts_fts(posts_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body); END",
    "CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE OF title, body ON posts BEGIN INSERT INTO posts_fts(posts_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body); INSERT INTO posts_fts(rowid, title, body) VALUES (new.id, new.title, new.body); END",
    "INSERT INTO posts_fts(posts_fts) VALUES ('rebuild')",  # 기존 글을 색인에 채운다(몇 번 돌려도 그대로)
]
SEEDS = [os.path.join('seed', 'official.sql'), os.path.join('seed', 'official-update.sql')]


def portable():
    d = HERE
    while os.path.dirname(d) != d:
        d = os.path.dirname(d)
        js = os.path.join(d, 'tools', 'cf-wrangler', 'node_modules', 'wrangler', 'bin', 'wrangler.js')
        if os.path.exists(js):
            node = os.path.join(d, 'tools', 'node', 'node.exe' if os.name == 'nt' else 'node')
            os.environ.setdefault('XDG_CONFIG_HOME', os.path.join(d, 'tools', 'cf-wrangler', 'config'))
            os.environ.setdefault('WRANGLER_SEND_METRICS', 'false')
            return [node if os.path.exists(node) else 'node', js]
    return None


def wrangler_cmd():
    js = os.environ.get('WRANGLER_JS')
    return [os.environ.get('NODE', 'node'), js] if js else (portable() or ['npx', 'wrangler'])


def wrangler(*args, capture=False):
    cmd = wrangler_cmd() + list(args)
    print('>', 'wrangler', *args, flush=True)
    if capture:
        r = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True, encoding='utf-8', errors='replace')
        print(r.stdout, r.stderr, flush=True)
        return r
    return subprocess.call(cmd, cwd=HERE)


def opt(name, default=None):
    a = sys.argv
    return a[a.index(name) + 1] if name in a and a.index(name) + 1 < len(a) else default


def toml():
    return open(os.path.join(HERE, 'wrangler.toml'), encoding='utf-8').read()


def db_id():
    m = re.search(r'(?m)^database_id\s*=\s*"([^"]+)"', toml())
    return m.group(1) if m else ''


def migrations(where):
    """ALTER TABLE 한 줄씩. 칸이 이미 있으면 오류가 나는데 그게 정상이라 넘어간다."""
    for sql in MIGRATIONS:
        r = wrangler('d1', 'execute', DB, where, '--command', sql, '-y', capture=True)
        if r.returncode and 'duplicate column' not in (r.stdout + r.stderr):
            sys.exit('칸 더하기 실패: ' + sql)


def dev():
    if '--fresh' in sys.argv:
        shutil.rmtree(os.path.join(HERE, '.wrangler', 'state'), ignore_errors=True)
    if wrangler('d1', 'execute', DB, '--local', '--file', 'schema.sql'):
        sys.exit(1)
    migrations('--local')
    for f in SEEDS + [os.path.join('test', 'seed-local.sql')]:
        if wrangler('d1', 'execute', DB, '--local', '--file', f):
            sys.exit(1)
    sys.exit(wrangler('pages', 'dev', 'public', '--port', opt('--port', '8799'), '--ip', '127.0.0.1'))


def setup():
    if db_id() == PLACEHOLDER:
        r = wrangler('d1', 'create', DB, capture=True)
        m = re.search(r'database_id"?\s*[=:]\s*"([0-9a-f-]{36})"', r.stdout + r.stderr)
        if not m:
            sys.exit('D1을 못 만들었어요(이미 있으면 `wrangler d1 list`에서 id를 보고 wrangler.toml에 직접 적어 주세요)')
        t = toml().replace(PLACEHOLDER, m.group(1))
        open(os.path.join(HERE, 'wrangler.toml'), 'w', encoding='utf-8', newline='\n').write(t)
        print('wrangler.toml database_id =', m.group(1))
    if wrangler('d1', 'execute', DB, '--remote', '--file', 'schema.sql', '-y'):
        sys.exit(1)
    migrations('--remote')
    for f in SEEDS:
        if wrangler('d1', 'execute', DB, '--remote', '--file', f, '-y'):
            sys.exit(1)
    # --force가 없으면 Worker로 만들어 버린다(앱개발부 노하우 10-20). 이미 있으면 오류가 나도 괜찮다.
    wrangler('pages', 'project', 'create', PROJECT, '--production-branch', 'main', '--force')


def admin_code():
    code = ''.join(secrets.choice(ALPHA) for _ in range(8))
    sql = "INSERT INTO invites (code, owner_id, kind, note, created) VALUES ('%s', NULL, 'admin', '첫 관리자', datetime('now'))" % code
    rc = wrangler('d1', 'execute', DB, '--remote', '--command', sql, '-y')
    if rc:
        sys.exit(rc)
    print('첫 관리자 코드(한 번 쓰면 끝):', code[:4] + '-' + code[4:], flush=True)


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else ''
    if what == 'dev':
        dev()
    elif what == 'setup':
        setup()
    elif what == 'migrate':
        if wrangler('d1', 'execute', DB, '--remote', '--file', 'schema.sql', '-y'):
            sys.exit(1)
        migrations('--remote')
    elif what == 'seed':
        for f in SEEDS:
            if wrangler('d1', 'execute', DB, '--remote', '--file', f, '-y'):
                sys.exit(1)
    elif what == 'admin-code':
        admin_code()
    elif what == 'backup':
        # wrangler d1 export는 검색 색인(가상 표)이 있으면 안 되어 표마다 JSON으로 받는다. 시점 되돌리기는 wrangler d1 time-travel restore yukaman --timestamp=<시각>
        import datetime, json
        os.makedirs(os.path.join(HERE, 'backups'), exist_ok=True)
        data = {}
        for t in ('users', 'invites', 'applications', 'posts', 'comments', 'reports', 'qna'):
            r = subprocess.run(wrangler_cmd() + ['d1', 'execute', DB, '--remote', '--json', '--command', 'SELECT * FROM ' + t], cwd=HERE, capture_output=True, text=True, encoding='utf-8', errors='replace')
            if r.returncode:
                if 'no such table' in r.stdout + r.stderr:      # 아직 migrate 전이라 표가 없는 경우
                    data[t] = []
                    continue
                sys.exit('백업 실패: ' + t + '\n' + r.stdout[:500] + r.stderr[:500])
            data[t] = json.loads(r.stdout)[0]['results']
        out = os.path.join('backups', 'yukaman-' + datetime.datetime.now().strftime('%Y%m%d-%H%M') + '.json')
        json.dump(data, open(os.path.join(HERE, out), 'w', encoding='utf-8'), ensure_ascii=False)
        print('백업:', out, {k: len(v) for k, v in data.items()}, flush=True)
    elif what == 'logs':
        sys.exit(wrangler('pages', 'deployment', 'tail', '--project-name', PROJECT))
    elif what == 'logout-user':
        uid = int(opt('logout-user', '0'))
        if uid <= 0:
            sys.exit('회원 번호를 적어 주세요: deploy.py logout-user 7')
        sql = "UPDATE users SET token_hash = 'off|' || id || '|' || datetime('now') WHERE id = %d AND role != 'official'" % uid
        sys.exit(wrangler('d1', 'execute', DB, '--remote', '--command', sql, '-y'))
    elif what == 'deploy':
        if db_id() == PLACEHOLDER:
            sys.exit('먼저 `deploy.py setup`으로 D1을 만들고 database_id를 채워 주세요')
        sys.exit(wrangler('pages', 'deploy', 'public', '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true'))
    else:
        sys.exit('사용법은 파일 맨 위 주석')


if __name__ == '__main__':
    main()

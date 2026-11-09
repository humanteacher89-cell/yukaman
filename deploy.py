# 육아맨 미리 보기·올리기(2026-11-04). 화면은 public/ 그대로(만드는 단계 없음), 서버는 functions/·server/, 자료는 D1.
#   python -X utf8 deploy.py dev [--port 8799] [--fresh]   내 컴퓨터에서 미리 보기(가짜 D1에 schema.sql + seed/official.sql + test/seed-local.sql, --fresh면 가짜 D1을 비우고 다시)
#   python -X utf8 deploy.py setup                         처음 한 번(휴먼쌤 "올려" 뒤): D1 'yukaman' 만들기 → wrangler.toml database_id 채우기 → 표 → 자료실 글 → Pages 프로젝트 만들기
#   python -X utf8 deploy.py migrate                       공개 D1에 schema.sql + MIGRATIONS(이미 있는 표에 칸 더하기. 몇 번 돌려도 그대로)
#   python -X utf8 deploy.py seed                          공개 D1에 seed/official.sql(자료실 계정의 글 넣기) + seed/official-update.sql(이미 있는 글의 제목·본문 맞추기). 몇 번 돌려도 그대로
#   python -X utf8 deploy.py admin-code                    공개 D1에 첫 관리자 코드 하나를 만들어 화면에 보여 준다(한 번 쓰면 끝. 저장소에 남기지 않는다)
#   python -X utf8 deploy.py logout-user <회원 번호>        공개 D1에서 그 회원의 기기 토큰을 끊는다(폰을 잃은 관리자 등. 복구 코드로만 돌아온다)
#   python -X utf8 deploy.py backup                        공개 D1 표를 암호화해 backups/yukaman-YYYYMMDD-HHMM.json.enc로 내려받는다(gitignore, 백업 열쇠 필요). 시점 되돌리기는 wrangler d1 time-travel
#   python -X utf8 deploy.py logs                          공개 서버 오류를 실시간으로 본다(wrangler pages deployment tail, Ctrl+C로 끝)
#   python -X utf8 deploy.py deploy                        Pages에 올리기(휴먼쌤이 시킨 때만)
#   python -X utf8 deploy.py keys                          처음 한 번: 회원번호 해시 열쇠와 백업 열쇠를 회사 PC 비밀 값 폴더(위쪽 폴더 어딘가의 tools/secrets)에 만든다. 이미 있으면 그대로
#   python -X utf8 deploy.py put-id-key                    회원번호 해시 열쇠를 Pages 비밀 값 ID_HASH_KEY로 넣는다(값은 화면에 안 나옴, 넣은 뒤 deploy해야 적용)
#   python -X utf8 deploy.py rehash [--local --url <주소>]  옛 SHA-256 회원번호 해시를 열쇠로 묶은 값('k1:')으로 바꾼다. 서버 /api/health의 열쇠 확인값이 같을 때만 돌고, 몇 번 돌려도 그대로
#   python -X utf8 deploy.py backup-seal                   예전 평문 백업(backups/yukaman-*.json)을 암호화하고, 풀어 본 내용이 같으면 평문을 지운다
#   python -X utf8 deploy.py backup-open <백업.json.enc> <저장할 곳>   백업을 풀어 평문 JSON으로 저장한다(다 쓰면 지운다)
# 지어낸 견본 글(test/seed-local.sql)은 내 컴퓨터 미리 보기에서만 쓴다. 공개 D1에는 넣지 않는다.
# wrangler: 환경 변수 WRANGLER_JS(wrangler.js 경로, NODE가 있으면 그 node로) → 위쪽 폴더 어딘가의 tools/cf-wrangler(포터블, 로그인 정보 config/ 포함) → npx wrangler.
import base64, glob, hashlib, hmac, json, os, re, secrets, shutil, subprocess, sys, time, urllib.request

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
    'ALTER TABLE users ADD COLUMN terms_at TEXT',           # 2026-11-05 약관 동의(Play 등록)
    'ALTER TABLE users ADD COLUMN naver_hash TEXT',         # 2026-11-05 네이버 로그인(남성만 새로 받기)
    'CREATE UNIQUE INDEX IF NOT EXISTS users_naver ON users (naver_hash) WHERE naver_hash IS NOT NULL',
    # 검색 색인(검수 27): trigram이라 한국어 조사가 붙어도 세 글자 조각으로 찾는다. 글을 넣고·고치고·지울 때 트리거가 따라간다. 이미 있으면 그대로.
    "CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(title, body, content='posts', content_rowid='id', tokenize='trigram')",
    'CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN INSERT INTO posts_fts(rowid, title, body) VALUES (new.id, new.title, new.body); END',
    "CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN INSERT INTO posts_fts(posts_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body); END",
    "CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE OF title, body ON posts BEGIN INSERT INTO posts_fts(posts_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body); INSERT INTO posts_fts(rowid, title, body) VALUES (new.id, new.title, new.body); END",
    "INSERT INTO posts_fts(posts_fts) VALUES ('rebuild')",  # 기존 글을 색인에 채운다(몇 번 돌려도 그대로)
]
SEEDS = [os.path.join('seed', 'official.sql'), os.path.join('seed', 'official-update.sql')]
ID_KEY_FILE = 'yukaman-id-hash-key.txt'      # 회원번호 해시 열쇠. Pages 비밀 값 ID_HASH_KEY와 같은 값
BACKUP_KEY_FILE = 'yukaman-backup-key.txt'   # 백업 열쇠(32바이트 base64). 둘 다 저장소·드라이브에 올리지 않고, 휴먼쌤 비밀번호 관리자에 사본을 둔다
LIVE = 'https://humanssaem-yukaman.pages.dev'
# 회원번호 해시가 든 칸(server/app.js idHash). rehash가 옛 값을 'k1:' + HMAC으로 바꾼다
HASH_COLS = [('users', 'id', 'kakao_hash'), ('users', 'id', 'naver_hash'), ('users', 'id', 'identity_hash'),
             ('kakao_pending', 'token_hash', 'kakao_hash'), ('naver_pending', 'token_hash', 'naver_hash')]


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


# ----- 열쇠 · 회원번호 해시 · 백업 암호화(2026-11-09 보안 보강) -----
def secrets_dir():
    """회사 PC의 비밀 값 폴더(위쪽 폴더 어딘가의 tools/secrets). 환경 변수 YUKAMAN_SECRETS가 있으면 그 폴더"""
    if os.environ.get('YUKAMAN_SECRETS'):
        return os.environ['YUKAMAN_SECRETS']
    d = HERE
    while os.path.dirname(d) != d:
        d = os.path.dirname(d)
        p = os.path.join(d, 'tools', 'secrets')
        if os.path.isdir(p):
            return p
    sys.exit('비밀 값 폴더(tools/secrets)를 못 찾았어요')


def key_file(name):
    p = os.path.join(secrets_dir(), name)
    if not os.path.exists(p):
        sys.exit('열쇠가 없어요: ' + name + ' — 먼저 `deploy.py keys`')
    return p


def read_key(name):
    return open(key_file(name), encoding='utf-8').read().strip()


def keys():
    """열쇠 두 개를 만든다. 이미 있으면 절대 덮어쓰지 않는다(바꾸면 옛 백업을 못 풀고 회원번호 해시가 안 맞는다)"""
    d = secrets_dir()
    make = {ID_KEY_FILE: lambda: secrets.token_urlsafe(32), BACKUP_KEY_FILE: lambda: base64.b64encode(secrets.token_bytes(32)).decode()}
    for name, new in make.items():
        p = os.path.join(d, name)
        if os.path.exists(p):
            print('이미 있어 그대로 둠:', name, flush=True)
            continue
        with open(p, 'x', encoding='utf-8') as f:
            f.write(new() + '\n')
        print('만듦:', name, flush=True)
    print('두 열쇠는 저장소와 드라이브 백업에 올라가지 않아요. 비밀번호 관리자에도 사본을 두세요(백업 열쇠를 잃으면 백업을 못 풀어요)', flush=True)


def put_id_key():
    key = read_key(ID_KEY_FILE)
    print('> wrangler pages secret put ID_HASH_KEY (값은 화면에 내지 않음)', flush=True)
    r = subprocess.run(wrangler_cmd() + ['pages', 'secret', 'put', 'ID_HASH_KEY', '--project-name', PROJECT], cwd=HERE, input=key,
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode:
        sys.exit('넣기 실패: ' + (r.stderr or r.stdout)[-500:])
    print('넣었어요. deploy한 뒤 rehash를 돌리세요', flush=True)


def key_check(key):
    """server/app.js idKeyCheck와 같은 계산(정해진 글자의 HMAC 앞 8자)"""
    return hmac.new(key.encode('utf-8'), b'yukaman-key-check', hashlib.sha256).hexdigest()[:8]


def d1_rows(sql, where):
    """읽기 결과를 화면에 내지 않고 받는다(해시가 로그에 남지 않게)"""
    r = subprocess.run(wrangler_cmd() + ['d1', 'execute', DB, where, '--json', '--command', sql], cwd=HERE, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode:
        sys.exit('D1 읽기 실패\n' + r.stderr[-500:])
    return json.loads(r.stdout)[0]['results']


def d1_write(stmts, where):
    for i in range(0, len(stmts), 20):
        args = ['d1', 'execute', DB, where, '--command', '; '.join(stmts[i:i + 20])] + (['-y'] if where == '--remote' else [])
        r = subprocess.run(wrangler_cmd() + args, cwd=HERE, capture_output=True, text=True, encoding='utf-8', errors='replace')
        if r.returncode:
            sys.exit('D1 쓰기 실패(앞 묶음까지는 바뀜, 다시 돌리면 남은 줄만 바뀐다)\n' + r.stderr[-500:])


def rehash():
    """옛 SHA-256 회원번호 해시를 'k1:' + HMAC(열쇠, 옛 값)으로 바꾼다. 서버 열쇠 확인값이 이 열쇠와 같을 때만 돈다.
    'k1:'로 시작하는 줄과 형식이 다른 줄은 건드리지 않아 몇 번 돌려도 같다. --local이면 내 컴퓨터 가짜 D1(--url로 그 서버 주소)"""
    local = '--local' in sys.argv
    where = '--local' if local else '--remote'
    url = opt('--url', None if local else LIVE)
    if not url:
        sys.exit('--local이면 --url로 내 컴퓨터 서버 주소를 주세요(열쇠 확인값을 맞춰 봐야 해요)')
    key = os.environ.get('ID_HASH_KEY', '').strip() or read_key(ID_KEY_FILE)
    req = urllib.request.Request(url.rstrip('/') + '/api/health', headers={'User-Agent': 'yukaman-deploy'})
    live = json.load(urllib.request.urlopen(req, timeout=30)).get('idk', '')
    if not live:
        sys.exit('서버에 ID_HASH_KEY가 아직 없어요(put-id-key → deploy 뒤에 돌리세요). 아무것도 바꾸지 않았어요')
    if live != key_check(key):
        sys.exit('서버 열쇠와 이 PC 열쇠가 달라요. 아무것도 바꾸지 않았어요')
    stmts, counts, odd = [], {}, 0
    for table, pk, col in HASH_COLS:
        sql = "SELECT %s AS k, %s AS h FROM %s WHERE %s IS NOT NULL AND substr(%s, 1, 3) != 'k1:'" % (pk, col, table, col, col)
        for r in d1_rows(sql, where):
            h, k = str(r['h']), r['k']
            if not re.fullmatch('[0-9a-f]{64}', h) or not (isinstance(k, int) or re.fullmatch('[0-9a-f]{64}', str(k))):
                odd += 1
                continue
            new = 'k1:' + hmac.new(key.encode('utf-8'), h.encode('utf-8'), hashlib.sha256).hexdigest()
            kk = str(k) if isinstance(k, int) else "'%s'" % k
            stmts.append("UPDATE %s SET %s = '%s' WHERE %s = %s AND %s = '%s'" % (table, col, new, pk, kk, col, h))
            counts[table + '.' + col] = counts.get(table + '.' + col, 0) + 1
    d1_write(stmts, where)
    left = sum(d1_rows("SELECT COUNT(*) AS n FROM %s WHERE %s IS NOT NULL AND substr(%s, 1, 3) != 'k1:'" % (t, c, c), where)[0]['n'] for t, _, c in HASH_COLS)
    print('바꾼 줄:', counts or '없음', '/ 형식이 달라 둔 줄:', odd, '/ 남은 옛 해시:', left, flush=True)


def node():
    c = wrangler_cmd()
    return c[0] if c[0] != 'npx' else 'node'


def crypt(args, data=None):
    """tools/backup-crypt.mjs(Node 기본 crypto, AES-256-GCM). 평문은 표준 입력·출력으로만 오가고 디스크에 쓰지 않는다"""
    r = subprocess.run([node(), os.path.join(HERE, 'tools', 'backup-crypt.mjs')] + args, cwd=HERE, input=data,
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode:
        sys.exit('암호화 도구 실패: ' + r.stderr[-300:])
    return r.stdout


def backup_seal():
    """예전 평문 백업을 암호화한다. 풀어 본 내용이 같을 때만 평문을 지우고, 30일 지우기가 원래 날짜를 따르게 수정 시각을 옮긴다"""
    bkey = key_file(BACKUP_KEY_FILE)
    done = 0
    for p in sorted(glob.glob(os.path.join(HERE, 'backups', 'yukaman-*.json'))):
        plain = open(p, encoding='utf-8').read()
        enc = p + '.enc'
        crypt(['seal', bkey, enc], plain)
        if json.loads(crypt(['open', bkey, enc])) != json.loads(plain):
            sys.exit('풀어 본 내용이 달라 멈췄어요(평문은 그대로): ' + os.path.basename(p))
        st = os.stat(p)
        os.utime(enc, (st.st_atime, st.st_mtime))
        os.remove(p)
        done += 1
    print('암호화하고 평문을 지운 백업:', done, flush=True)


def backup_open():
    a = sys.argv
    if len(a) < 4:
        sys.exit('사용법: deploy.py backup-open <backups/…json.enc> <저장할 곳.json>')
    src, dst = a[2], a[3]
    if os.path.exists(dst):
        sys.exit('저장할 곳에 이미 파일이 있어요: ' + dst)
    plain = crypt(['open', key_file(BACKUP_KEY_FILE), src])
    with open(dst, 'x', encoding='utf-8', newline='') as f:
        f.write(plain)
    print('풀었어요(평문이니 다 쓰면 지우세요):', dst, {k: len(v) for k, v in json.loads(plain).items()}, flush=True)


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
        # 11-09 보안 보강: 받은 내용은 표준 입력으로만 넘겨 암호화해 저장한다(평문 파일을 만들지 않는다). 열쇠가 없으면 받기 전에 멈춘다
        import datetime
        bkey = key_file(BACKUP_KEY_FILE)
        os.makedirs(os.path.join(HERE, 'backups'), exist_ok=True)
        data = {}
        for t in ('users', 'user_blocks', 'invites', 'applications', 'posts', 'comments', 'reports', 'qna'):
            r = subprocess.run(wrangler_cmd() + ['d1', 'execute', DB, '--remote', '--json', '--command', 'SELECT * FROM ' + t], cwd=HERE, capture_output=True, text=True, encoding='utf-8', errors='replace')
            if r.returncode:
                if 'no such table' in r.stdout + r.stderr:      # 아직 migrate 전이라 표가 없는 경우
                    data[t] = []
                    continue
                sys.exit('백업 실패: ' + t + '\n' + r.stdout[:500] + r.stderr[:500])
            data[t] = json.loads(r.stdout)[0]['results']
        out = os.path.join('backups', 'yukaman-' + datetime.datetime.now().strftime('%Y%m%d-%H%M') + '.json.enc')
        crypt(['seal', bkey, os.path.join(HERE, out)], json.dumps(data, ensure_ascii=False))
        print('백업(암호화):', out, {k: len(v) for k, v in data.items()}, flush=True)
        # 처리방침 약속: 30일 지난 백업은 지운다(탈퇴한 사람의 글이 사본으로 오래 남지 않게). 드라이브 거울에서도 따라 지워지고 휴지통에 30일 더 있다
        for old in glob.glob(os.path.join(HERE, 'backups', 'yukaman-*.json*')):
            if time.time() - os.path.getmtime(old) > 30 * 86400:
                os.remove(old)
                print('30일 지난 백업 지움:', os.path.basename(old), flush=True)
    elif what == 'logs':
        sys.exit(wrangler('pages', 'deployment', 'tail', '--project-name', PROJECT))
    elif what == 'logout-user':
        uid = int(opt('logout-user', '0'))
        if uid <= 0:
            sys.exit('회원 번호를 적어 주세요: deploy.py logout-user 7')
        sql = "UPDATE users SET token_hash = 'off|' || id || '|' || datetime('now') WHERE id = %d AND role != 'official'" % uid
        sys.exit(wrangler('d1', 'execute', DB, '--remote', '--command', sql, '-y'))
    elif what == 'keys':
        keys()
    elif what == 'put-id-key':
        put_id_key()
    elif what == 'rehash':
        rehash()
    elif what == 'backup-seal':
        backup_seal()
    elif what == 'backup-open':
        backup_open()
    elif what == 'deploy':
        if db_id() == PLACEHOLDER:
            sys.exit('먼저 `deploy.py setup`으로 D1을 만들고 database_id를 채워 주세요')
        sys.exit(wrangler('pages', 'deploy', 'public', '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true'))
    else:
        sys.exit('사용법은 파일 맨 위 주석')


if __name__ == '__main__':
    main()

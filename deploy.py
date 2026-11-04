# 육아맨 미리 보기·올리기(2026-11-04). 화면은 public/ 그대로(만드는 단계 없음), 서버는 functions/·server/, 자료는 D1.
#   python -X utf8 deploy.py dev [--port 8799] [--fresh]   내 컴퓨터에서 미리 보기(가짜 D1에 schema.sql + test/seed-local.sql, --fresh면 가짜 D1을 비우고 다시)
#   python -X utf8 deploy.py setup                         처음 한 번(휴먼쌤 "올려" 뒤): D1 'yukaman' 만들기 → wrangler.toml database_id 채우기 → 표 만들기 → Pages 프로젝트 만들기
#   python -X utf8 deploy.py migrate                       공개 D1에 schema.sql(몇 번 돌려도 그대로)
#   python -X utf8 deploy.py deploy                        Pages에 올리기(휴먼쌤이 시킨 때만)
# wrangler: 환경 변수 WRANGLER_JS(wrangler.js 경로, NODE가 있으면 그 node로) → 위쪽 폴더 어딘가의 tools/cf-wrangler(포터블, 로그인 정보 config/ 포함) → npx wrangler.
import os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = 'humanssaem-yukaman'
DB = 'yukaman'
PLACEHOLDER = '00000000-0000-0000-0000-000000000000'


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


def dev():
    if '--fresh' in sys.argv:
        shutil.rmtree(os.path.join(HERE, '.wrangler', 'state'), ignore_errors=True)
    if wrangler('d1', 'execute', DB, '--local', '--file', 'schema.sql') or wrangler('d1', 'execute', DB, '--local', '--file', os.path.join('test', 'seed-local.sql')):
        sys.exit(1)
    sys.exit(wrangler('pages', 'dev', 'public', '--port', opt('--port', '8799'), '--ip', '127.0.0.1'))


def setup():
    if db_id() == PLACEHOLDER:
        r = wrangler('d1', 'create', DB, capture=True)
        m = re.search(r'database_id\s*=\s*"([0-9a-f-]{36})"', r.stdout + r.stderr)
        if not m:
            sys.exit('D1을 못 만들었어요(이미 있으면 `wrangler d1 list`에서 id를 보고 wrangler.toml에 직접 적어 주세요)')
        t = toml().replace(PLACEHOLDER, m.group(1))
        open(os.path.join(HERE, 'wrangler.toml'), 'w', encoding='utf-8', newline='\n').write(t)
        print('wrangler.toml database_id =', m.group(1))
    if wrangler('d1', 'execute', DB, '--remote', '--file', 'schema.sql', '-y'):
        sys.exit(1)
    # --force가 없으면 Worker로 만들어 버린다(앱개발부 노하우 10-20). 이미 있으면 오류가 나도 괜찮다.
    wrangler('pages', 'project', 'create', PROJECT, '--production-branch', 'main', '--force')


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else ''
    if what == 'dev':
        dev()
    elif what == 'setup':
        setup()
    elif what == 'migrate':
        sys.exit(wrangler('d1', 'execute', DB, '--remote', '--file', 'schema.sql', '-y'))
    elif what == 'deploy':
        if db_id() == PLACEHOLDER:
            sys.exit('먼저 `deploy.py setup`으로 D1을 만들고 database_id를 채워 주세요')
        sys.exit(wrangler('pages', 'deploy', 'public', '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true'))
    else:
        sys.exit('사용법은 파일 맨 위 주석')


if __name__ == '__main__':
    main()

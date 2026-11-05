# 자료 링크 점검(2026-11-05 휴먼쌤 "1단계 시작"). 자료실과 가이드 글·Q&A 출처의 주소를 읽어 없어진 주소를 찾는다. 고치지는 않고 알리기만 한다.
#   python -X utf8 tools/check_links.py    확인할 주소가 있으면 link-watch.md를 쓰고 끝 코드 1(GitHub Actions가 이슈를 연다), 점검 자체가 안 되면 2
# 나누는 법: 없어짐 = 404·410·도메인 없음·유튜브 영상 없음(두 번 읽어 확인) / 의심 = 200인데 '없는 페이지' 문구가 있거나 첫 화면으로 넘어감 / 못 읽음 = 막힘·시간 초과.
# 못 읽음은 해외 서버에서 막는 사이트가 섞여 있어 이슈로 열지 않고 실행 기록에만 남긴다. 사람이 보고 괜찮은 주소는 data-src/link-ok.json에 넣는다.
import collections, concurrent.futures, json, os, re, socket, ssl, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(HERE, 'tools'))
from check_laws import doc_sources  # noqa: E402

REPORT = os.path.join(HERE, 'link-watch.md')
OK_FILE = os.path.join(HERE, 'data-src', 'link-ok.json')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 (yukaman link check)'
# 없는 글에도 200으로 오류 화면을 주는 사이트가 많다. 일부러 없는 주소를 넣어 본 문구들(moel · law.go.kr · aladin · korea.kr, 2026-11-05)
GONE_WORDS = ['페이지를 찾을 수 없', '존재하지 않는 페이지', '없는 페이지입니다', '삭제된 기사', '삭제된 게시', '삭제되었거나', '존재하지 않는 게시', '존재하지 않는 기사', '찾으시는 페이지', '요청하신 페이지를', '요청하신 페이지에 오류',
              '기술적인 문제로 서비스에 접속', '주소명을 찾을 수 없', 'page not found', '404 not found']
ERROR_TITLES = ['오류페이지', '- error', 'error page']
HOME_PATHS = {'', '/', '/index.do', '/main.do', '/index.html', '/index.jsp', '/main', '/home', '/main/main.do', '/mpm/'}


def targets():
    """{주소: [쓰인 곳]}. 파일을 그대로 읽어 자료가 늘면 저절로 따라온다."""
    out = collections.OrderedDict()
    lib = json.load(open(os.path.join(HERE, 'public', 'data', 'library.json'), encoding='utf-8'))
    for x in lib['items']:
        out.setdefault(x['url'], []).append('자료실: ' + x['title'])
    for title, items in doc_sources():
        for _, u in items:
            if u.startswith('http') and '글: ' + title not in out.setdefault(u, []):
                out[u].append('글: ' + title)
    return out


def safe(url):
    return urllib.parse.quote(url, safe=":/?&=%#+,;@!$'()*~-._")


def open_url(url, verify=True):
    req = urllib.request.Request(safe(url), headers={'User-Agent': UA, 'Accept-Language': 'ko,en;q=0.8'})
    ctx = ssl.create_default_context()
    if not verify:
        ctx = ssl._create_unverified_context()
        ctx.options |= getattr(ssl, 'OP_LEGACY_SERVER_CONNECT', 0x4)      # 옛 TLS만 되는 공공 사이트(nip.kdca.go.kr)
    # 쿠키를 받아야 넘어가는 사이트가 있다(브런치는 쿠키 없이는 302가 돌고 돈다)
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(), urllib.request.HTTPSHandler(context=ctx))
    with opener.open(req, timeout=25) as r:
        return r.status, r.geturl(), r.read(200000)


def judge_page(url, final, raw):
    """200으로 왔을 때 정말 그 글인지. (종류, 이유)"""
    a, b = urllib.parse.urlparse(safe(url)), urllib.parse.urlparse(final)
    if a.path.rstrip('/') and not (a.path in HOME_PATHS) and b.path in HOME_PATHS and not b.query:
        return 'suspect', '첫 화면으로 넘어감'
    for enc in ('utf-8', 'euc-kr'):
        text = re.sub(r'<(script|style)\b.*?</\1>', ' ', raw.decode(enc, 'ignore'), flags=re.S | re.I)
        title = re.search(r'<title[^>]*>(.*?)</title>', text, re.S | re.I)
        head = (title.group(1) if title else '').lower()
        low = head + ' ' + re.sub(r'<[^>]+>', ' ', text).lower()
        for w in ERROR_TITLES:
            if w in head:
                return 'suspect', "제목에 '%s'" % w
        for w in GONE_WORDS:
            if w in low:
                return 'suspect', "'%s' 문구가 있음" % w
    return 'ok', ''


def check(url):
    """(종류, 이유). 종류 = ok / dead / suspect / unknown"""
    try:
        host = urllib.parse.urlparse(url).netloc
        if host.endswith(('youtube.com', 'youtu.be')):
            try:      # 지워진 영상도 주소는 200이라 oEmbed로 묻는다. 404·400 = 없음, 401·403 = 비공개거나 퍼가기 금지라 사람이 본다
                open_url('https://www.youtube.com/oembed?format=json&url=' + urllib.parse.quote(url, safe=''))
                return 'ok', ''
            except urllib.error.HTTPError as e:
                return ('dead', '영상 없음') if e.code in (400, 404) else ('suspect', '영상을 볼 수 없을 수 있음(%d)' % e.code)
        try:
            _, final, raw = open_url(url)
        except urllib.error.URLError as e:
            if not isinstance(getattr(e, 'reason', None), ssl.SSLError):
                raise
            _, final, raw = open_url(url, verify=False)      # 공공기관 인증서 체인 문제가 흔하다. 글을 믿으려는 게 아니라 주소가 살아 있는지만 본다
        return judge_page(url, final, raw)
    except urllib.error.HTTPError as e:
        return ('dead', '%d' % e.code) if e.code in (404, 410) else ('unknown', '%d' % e.code)
    except urllib.error.URLError as e:
        if isinstance(e.reason, socket.gaierror):      # 정말 없는 이름만 없어짐으로. 서버 쪽 이름 찾기가 잠깐 실패한 것(-3, -5)은 못 읽음
            return ('dead', '도메인 없음') if e.reason.errno == socket.EAI_NONAME else ('unknown', '이름 찾기 실패')
        return 'unknown', str(e.reason)[:60]
    except Exception as e:
        return 'unknown', type(e).__name__


def run_all(urls):
    """사이트마다 한 번에 하나씩, 0.7초 간격으로 읽는다."""
    by_host = collections.defaultdict(list)
    for u in urls:
        by_host[urllib.parse.urlparse(u).netloc].append(u)

    def one_host(items):
        got = {}
        for u in items:
            got[u] = check(u)
            time.sleep(0.7)
        return got

    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        for got in ex.map(one_host, by_host.values()):
            results.update(got)
    return results


def report(results, where, allowed):
    """(이슈 본문 또는 '', 못 읽은 주소들)"""
    def lines(kind):
        out = []
        for u, (k, why) in sorted(results.items(), key=lambda x: where[x[0]][0]):
            if k == kind and u not in allowed:
                used = ' · '.join(where[u][:3]) + (' 외 %d곳' % (len(where[u]) - 3) if len(where[u]) > 3 else '')
                out.append('- %s (%s)\n  %s' % (u, why, used))
        return out
    dead, suspect = lines('dead'), lines('suspect')
    unknown = lines('unknown')
    if not dead and not suspect:
        return '', unknown
    body = ['자료 링크 점검에서 확인이 필요한 주소를 찾았어요. 새 주소로 고치거나 빼 주세요(자료실은 `data-src`, 글은 `public/guide-data.js` · `seed/official-posts.json`). 멀쩡한 주소면 `data-src/link-ok.json`에 넣으면 다음부터 알리지 않아요.', '']
    if dead:
        body += ['## 없어진 주소 %d개' % len(dead), ''] + dead + ['']
    if suspect:
        body += ['## 의심되는 주소 %d개' % len(suspect), '', '서버는 200으로 답했지만 글이 없을 수 있어요. 열어 봐야 알 수 있습니다.', ''] + suspect + ['']
    return '\n'.join(body).rstrip()[:60000] + '\n', unknown


def main():
    where = targets()
    results = run_all(list(where))
    again = [u for u, (k, _) in results.items() if k != 'ok']
    if again:      # 잠깐 끊긴 것을 없어졌다고 하지 않게 한 번 더
        time.sleep(20)
        results.update(run_all(again))
    count = collections.Counter(k for k, _ in results.values())
    allowed = json.load(open(OK_FILE, encoding='utf-8')) if os.path.exists(OK_FILE) else {}
    summary = '주소 %d개: 정상 %d · 없어짐 %d · 의심 %d · 못 읽음 %d' % (len(results), count['ok'], count['dead'], count['suspect'], count['unknown'])
    print(summary)
    body, unknown = report(results, where, allowed)
    log = [summary, ''] + (['못 읽은 주소(막힘 · 시간 초과. 이슈로 열지 않음):', ''] + unknown if unknown else [])
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8').write('\n'.join(log) + '\n')
    print('\n'.join(log[2:]))
    if count['ok'] < len(results) / 2:      # 절반도 못 읽었으면 주소가 아니라 점검이 잘못된 것
        print('점검이 제대로 되지 않았어요.')
        return 2
    if not body:
        return 0
    open(REPORT, 'w', encoding='utf-8').write(body)
    print(body)
    return 1


if __name__ == '__main__':
    sys.exit(main())

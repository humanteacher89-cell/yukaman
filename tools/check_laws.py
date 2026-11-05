# 법령 감시(2026-11-05 휴먼쌤 "이 앱이 계속 정보가 최신화되어야 의미가 있을 테니"). 국가법령정보센터에서 지금 시행 중인 판과 예고된 판을 읽어 public/law-data.js와 비교한다.
# 근거 조문 본문 비교(2026-11-05 휴먼쌤 "1단계 시작"): 글·Q&A 출처와 계산기가 기대는 조문의 글자를 data-src/law-articles.json과 비교한다. 다른 조문만 바뀐 개정은 그렇다고 알려 준다.
#   python -X utf8 tools/check_laws.py           비교만. 바뀐 것이 있으면 law-watch.md를 쓰고 끝 코드 1(GitHub Actions가 이슈를 연다), 사이트를 못 읽으면 2
#   python -X utf8 tools/check_laws.py --write   law-data.js와 law-articles.json을 지금 값으로 다시 쓴다(글을 다시 대조한 뒤에 돌린다. 확인일이 오늘로 바뀐다)
# 표에 있는 시행일이 글의 확인일보다 늦으면 화면이 그 글에 "확인한 뒤 법령이 바뀌었어요"를 띄운다(public/app.js lawWarn). 그래서 --write는 글을 고치기 전에 돌려도 안전하다.
# 읽는 곳: /법령/<이름>의 iframe 주소(lsiSeq·efYd = 지금 시행 중인 판) + lsSideInfoP 머리줄([시행 …] [법률 제…호, …]) + lsHstListR 연혁 목록(앞으로 시행될 판의 번호와 시행일).
# 예고는 연혁 목록으로 읽는다. 머리줄을 efYd 없이 읽는 옛 방법은 같은 번호 안의 시행일만 보여 번호가 다른 예고판(남녀고용평등법 2026-11-27)을 놓쳤다.
# 시험: python -X utf8 test/watch-test.py
import datetime, difflib, html as htmllib, json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'public', 'law-data.js')
ARTS = os.path.join(HERE, 'data-src', 'law-articles.json')
REPORT = os.path.join(HERE, 'law-watch.md')
# key = 법령 주소의 이름 / name = 정식 명칭 / match = 글의 출처 주소에서 이 법을 알아보는 조각
LAWS = [
    {'key': '고용보험법', 'name': '고용보험법', 'match': ['/법령/고용보험법/']},
    {'key': '고용보험법시행령', 'name': '고용보험법 시행령', 'match': ['/법령/고용보험법시행령/']},
    {'key': '남녀고용평등과일ㆍ가정양립지원에관한법률', 'name': '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률', 'match': ['/법령/남녀고용평등과일ㆍ가정양립지원에관한법률/']},
    {'key': '남녀고용평등과일ㆍ가정양립지원에관한법률시행령', 'name': '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률 시행령', 'match': ['/법령/남녀고용평등과일ㆍ가정양립지원에관한법률시행령/']},
    {'key': '공무원수당등에관한규정', 'name': '공무원수당 등에 관한 규정', 'match': ['lsId=002303']},
    {'key': '지방공무원수당등에관한규정', 'name': '지방공무원 수당 등에 관한 규정', 'match': ['/법령/지방공무원수당등에관한규정/']},
    {'key': '국가공무원법', 'name': '국가공무원법', 'match': ['/법령/국가공무원법/']},
    {'key': '지방공무원법', 'name': '지방공무원법', 'match': ['/법령/지방공무원법/']},
    {'key': '교육공무원법', 'name': '교육공무원법', 'match': ['/법령/교육공무원법/', 'lsId=001616']},
    {'key': '사립학교법', 'name': '사립학교법', 'match': ['/법령/사립학교법/']},
    {'key': '사립학교법시행령', 'name': '사립학교법 시행령', 'match': ['/법령/사립학교법시행령/']},
    {'key': '군인사법', 'name': '군인사법', 'match': ['/법령/군인사법/']},
    {'key': '가족관계의등록등에관한법률', 'name': '가족관계의 등록 등에 관한 법률', 'match': ['lsId=010444']},
]
# 계산기가 기대는 조문(public/calc.js 머리말과 맞춘다). 글 출처는 refs()가 파일에서 읽으므로 여기 적지 않는다
EQ = '남녀고용평등과일ㆍ가정양립지원에관한법률'
CALC_REFS = {
    '고용보험법': ['제70조', '제73조의2'],
    '고용보험법시행령': ['제95조', '제95조의3', '제98조', '제104조의2'],
    EQ: ['제18조의2', '제19조', '제19조의2'],
    EQ + '시행령': ['제11조'],
    '공무원수당등에관한규정': ['제11조의3'],
    '지방공무원수당등에관한규정': ['제11조의2'],
    '사립학교법시행령': ['제24조의9'],
    '가족관계의등록등에관한법률': ['제44조'],
}
BASE = 'https://www.law.go.kr'
ART_RE = r'제\d+조(?:의\d+)?'


def get(path):
    req = urllib.request.Request(BASE + path, headers={'User-Agent': 'Mozilla/5.0 (yukaman law watch)'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')


def dashed(ef):
    return '%s-%s-%s' % (ef[:4], ef[4:6], ef[6:8])


def read(law):
    page = get(urllib.parse.quote('/법령/' + law['key']))
    m = re.search(r'lsiSeq=(\d+)[^"]*?efYd=(\d+)', page)
    if not m:
        raise ValueError('주소를 못 읽음: ' + law['key'])
    seq, ef = m.group(1), m.group(2)
    side = get('/LSW//lsSideInfoP.do?lsiSeq=%s&joNo=0001&joBrNo=00&docCls=jo&urlMode=lsScJoRltInfoR&efYd=%s&ancYnChk=0' % (seq, ef))
    text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', side))
    h = re.search(r'\[시행 (\d{4})\. ?(\d{1,2})\. ?(\d{1,2})\.\] ?\[([^,\]]+),', text)
    lid = re.search(r'id="lsId"[^>]*value="(\d+)"', side)
    if not (h and lid):
        raise ValueError('머리줄을 못 읽음: ' + law['key'])
    versions = re.findall(r"lsViewLsHst2\('(\d+)',\s*'\d+',\s*'\d+',\s*'(\d+)'", get('/LSW/lsHstListR.do?lsId=%s&lsiSeq=%s&chrClsCd=010202' % (lid.group(1), seq)))
    if not versions:      # 목록을 못 읽은 채 조용히 지나가면 예고를 놓친다
        raise ValueError('연혁 목록을 못 읽음: ' + law['key'])
    later = sorted({(e, s) for s, e in versions if e > ef})
    return {'key': law['key'], 'name': law['name'], 'no': h.group(4).strip(), 'effective': '%s-%02d-%02d' % (h.group(1), int(h.group(2)), int(h.group(3))),
            'upcoming': dashed(later[0][0]) if later else '', 'seq': seq, 'ef': ef, 'later': later, 'match': law['match']}


def article_text(page, art):
    """조문 쪽 HTML에서 그 조문의 글자만 꺼낸다. 없으면 ''. 계산식은 그림이라 alt의 수식을 글자로 넣는다(제104조의2)."""
    m = re.fullmatch(r'제(\d+)조(?:의(\d+))?', art)
    start = page.find('name="J%d:%d"' % (int(m.group(1)), int(m.group(2) or 0)))
    if start < 0:
        return ''
    box = page.find('class="lawcon"', start)
    if box < 0:
        return ''
    box = page.find('>', box) + 1
    end = page.find('<!-- 별표', box)
    body = page[box:end if end > 0 else page.find('</div>', box)]
    body = re.sub(r'<img\b[^>]*?\balt="([^"]*)"[^>]*>', lambda x: ' ' + x.group(1).replace('@@LATEX@@', ' ').replace('@@/LATEX@@', ' ') + ' ', body)
    text = re.sub(r'\s+', ' ', htmllib.unescape(re.sub(r'<[^>]+>', ' ', body))).strip()
    text = re.sub(r'\s*위임행정규칙\s*', ' ', text).strip()      # 시행 중인 판에만 붙는 단추 글자
    return text if text.startswith(art) else ''


def read_article(seq, art, ef=''):
    m = re.fullmatch(r'제(\d+)조(?:의(\d+))?', art)
    q = 'lsiSeq=%s&joNo=%04d&joBrNo=%02d&docCls=jo&urlMode=lsScJoRltInfoR' % (seq, int(m.group(1)), int(m.group(2) or 0))
    if ef:
        q += '&efYd=%s&ancYnChk=0' % ef
    return article_text(get('/LSW//lsSideInfoP.do?' + q), art)


def law_of(url, title=''):
    """출처 하나가 어떤 법의 어느 조문인지. 조문을 가리키지 않으면 None."""
    u = urllib.parse.unquote(url)
    if 'law.go.kr' not in u:
        return None
    law = next((x for x in LAWS if any(p in u for p in x['match'])), None)
    if not law:
        return None
    m = re.search(ART_RE, u) or re.search(ART_RE, title)
    return (law['key'], m.group(0)) if m else None


def doc_sources():
    """가이드 글과 Q&A의 (제목, [(출처 이름, 주소)]). 파일을 그대로 읽어 글이 늘면 저절로 따라온다."""
    gd = open(os.path.join(HERE, 'public', 'guide-data.js'), encoding='utf-8').read()
    named = {k: (t, u) for k, t, u in re.findall(r"(\w+):\s*\{\s*t:\s*'((?:[^'\\]|\\.)*)',\s*u:\s*'((?:[^'\\]|\\.)*)'", gd)}
    docs = []
    marks = list(re.finditer(r"\{\s*id:\s*'([\w-]+)'", gd))
    for i, m in enumerate(marks):
        seg = gd[m.start():marks[i + 1].start() if i + 1 < len(marks) else len(gd)]
        title = re.search(r"title:\s*'((?:[^'\\]|\\.)*)'", seg)
        src = re.search(r'sources:\s*\[(.*?)\]', seg, re.S)
        if not (title and src):
            continue
        items = [named[k] for k in re.findall(r'L\.(\w+)', src.group(1)) if k in named]
        items += re.findall(r"t:\s*'((?:[^'\\]|\\.)*)',\s*u:\s*'((?:[^'\\]|\\.)*)'", src.group(1))
        docs.append((title.group(1), items))
    od = open(os.path.join(HERE, 'public', 'official-data.js'), encoding='utf-8').read()
    for x in json.JSONDecoder().raw_decode(od[od.find('[', od.find('G.items.push.apply')):])[0]:
        docs.append((x.get('title', ''), [(s.get('t', ''), s.get('u', '')) for s in x.get('sources', [])]))
    return docs


def refs():
    """근거 조문 목록: {(법 key, 제N조): [쓰인 곳]}"""
    out = {}
    for key, arts in CALC_REFS.items():
        for art in arts:
            out.setdefault((key, art), []).append('계산기')
    docs = doc_sources()
    # 출처 이름에 조문이 없어도 같은 주소를 다른 글이 조문과 함께 적었으면 그것으로 알아본다
    known = {u: law_of(u, t) for _, items in docs for t, u in items if law_of(u, t)}
    for title, items in docs:
        for t, u in items:
            ref = known.get(u)
            if ref and title not in out.setdefault(ref, []):
                out[ref].append(title)
    return out


def read_articles(now, ref_map):
    """지금 판과 예고된 판의 근거 조문 글자. {key: {제N조: {current, upcoming?}}}. 조문이 없으면 current가 ''."""
    by = {x['key']: x for x in now}
    arts = {}
    for key, art in sorted(ref_map):
        law = by[key]
        item = {'current': read_article(law['seq'], art, law['ef'])}
        time.sleep(0.3)
        for ef, seq in law.get('later', []):      # 앞으로 시행될 판 가운데 글자가 처음 달라지는 판
            later = read_article(seq, art, ef)
            time.sleep(0.3)
            if later and not same(later, item['current']):
                item['upcoming'], item['upcoming_date'] = later, dashed(ef)
                break
        arts.setdefault(key, {})[art] = item
    return arts


def same(a, b):
    """띄어쓰기를 빼고 비교한다. 사이트가 시행 중인 판에만 조문 링크를 달아 '대통령령 으로'와 '대통령령으로'처럼 간격이 달라진다."""
    return re.sub(r'\s+', '', a or '') == re.sub(r'\s+', '', b or '')


def diff_lines(old, new, limit=3000):
    """항 · 호 단위로 나눠 바뀐 줄만. 이슈에 그대로 넣는다."""
    cut = lambda s: [x.strip() for x in re.split(r'(?=[①-⑳])|(?= \d+\. (?!\d))', s) if x.strip()]      # 뒤가 숫자면 날짜(2026. 3. 17.)라 나누지 않는다
    a, b = cut(old), cut(new)
    bare = lambda lines: [re.sub(r'\s+', '', x) for x in lines]
    out = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, bare(a), bare(b), autojunk=False).get_opcodes():
        if tag != 'equal':
            out += ['- ' + x for x in a[i1:i2]] + ['+ ' + x for x in b[j1:j2]]
    text = '\n'.join(out)
    return text[:limit] + ('\n… (길어서 줄임, 원문 확인)' if len(text) > limit else '')


def compare_articles(now, arts, old_arts, ref_map):
    """(바뀐 조문 글, 예고에서 달라진 글, 조문이 그대로인 법 key들)"""
    names = {x['key']: x['name'] for x in now}
    changed, seen = [], set()
    for key, art in sorted(ref_map):
        new = arts.get(key, {}).get(art, {'current': ''})
        old = old_arts.get(key, {}).get(art)
        used = ' · '.join(ref_map[(key, art)][:6]) + (' 외 %d곳' % (len(ref_map[(key, art)]) - 6) if len(ref_map[(key, art)]) > 6 else '')
        label = '%s %s' % (names[key], art)
        if not new['current']:
            changed.append('### %s: 조문을 못 찾았어요\n쓰인 곳: %s\n\n조문이 옮겨졌거나 없어졌을 수 있어요. 원문을 확인해 주세요.' % (label, used))
            seen.add(key)
        elif not old:
            changed.append('### %s: 대조 기록이 없어요\n쓰인 곳: %s\n\n글에 새로 쓴 조문이면 원문과 대조한 뒤 `--write`를 돌려 주세요.' % (label, used))
            seen.add(key)
        else:
            if not same(old['current'], new['current']):      # 예고됐던 개정이라도 시행되면 알린다. 글의 '○월 ○일부터' 문구를 고칠 때다
                what = '예고됐던 판이 시행됐어요' if same(old.get('upcoming'), new['current']) else '지금 시행 중인 글자가 바뀌었어요'
                changed.append('### %s: %s\n쓰인 곳: %s\n\n```diff\n%s\n```' % (label, what, used, diff_lines(old['current'], new['current'])))
                seen.add(key)
            old_next, new_next = old.get('upcoming') or old['current'], new.get('upcoming') or new['current']
            if not same(old_next, new_next) and new.get('upcoming'):
                changed.append('### %s: %s 시행 예고된 판에서 글자가 달라져요\n쓰인 곳: %s\n\n```diff\n%s\n```' % (label, new.get('upcoming_date', ''), used, diff_lines(old_next, new_next)))
                seen.add(key)
    return changed, seen


def load_old():
    if not os.path.exists(OUT):
        return {}
    m = re.search(r'window\.YK_LAWS = (\{.*\});', open(OUT, encoding='utf-8').read(), re.S)
    return {x['key']: x for x in json.loads(m.group(1))['items']} if m else {}


def load_arts():
    return json.load(open(ARTS, encoding='utf-8')).get('laws', {}) if os.path.exists(ARTS) else {}


def report(now, old, arts, old_arts, ref_map):
    """이슈 본문. 바뀐 것이 없으면 ''."""
    heads = []
    moved = set()
    for x in now:
        o = old.get(x['key'])
        if not o:
            heads.append('- %s: 표에 없음' % x['name'])
            continue
        for f, label in (('effective', '시행일'), ('no', '법령 번호'), ('upcoming', '예고된 시행일')):
            if (o.get(f) or '') != (x.get(f) or ''):
                heads.append('- %s %s: %s → %s' % (x['name'], label, o.get(f) or '없음', x.get(f) or '없음'))
                moved.add(x['key'])
    changed, touched = compare_articles(now, arts, old_arts, ref_map)
    if not heads and not changed:
        return ''
    lines = ['국가법령정보센터에서 바뀐 것을 찾았어요. 관련 글과 `calc.js` 숫자를 원문과 다시 대조한 뒤 `tools/check_laws.py --write`를 돌려 주세요.', '']
    if changed:
        lines += ['## 근거 조문에서 바뀐 것', ''] + [c + '\n' for c in changed]
    if heads:
        lines += ['## 시행일 · 번호', ''] + heads + ['']
    calm = [x['name'] for x in now if x['key'] in moved and x['key'] not in touched]
    if calm:
        lines += ['## 근거 조문은 그대로인 법', '', '시행일이나 번호는 바뀌었지만 우리가 쓰는 조문의 글자는 같아요. 문구 대조 없이 표만 고쳐도 됩니다.', ''] + ['- ' + n for n in calm] + ['']
    return '\n'.join(lines).rstrip()[:60000] + '\n'


def main():
    try:
        now = []
        for law in LAWS:
            now.append(read(law))
            time.sleep(0.5)
        ref_map = refs()
        arts = read_articles(now, ref_map)
    except Exception as e:
        print('법령 사이트를 못 읽었어요:', e)
        return 2
    if '--write' in sys.argv:
        missing = [(k, a) for k, m in arts.items() for a, v in m.items() if not v['current']]
        if missing:
            print('조문을 못 찾아 쓰지 않았어요:', missing)
            return 2
        today = datetime.date.today().isoformat()
        items = [{k: v for k, v in x.items() if k not in ('ef', 'later')} for x in now]
        text = ('// 만들어지는 파일: python -X utf8 tools/check_laws.py --write. 글의 근거 법령 표시와 "법령이 바뀌었어요" 안내에 쓴다.\n'
                'window.YK_LAWS = ' + json.dumps({'checked': today, 'items': items}, ensure_ascii=False, indent=1) + ';\n')
        open(OUT, 'w', encoding='utf-8', newline='\n').write(text)
        with open(ARTS, 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'_': '만들어지는 파일: tools/check_laws.py --write. 글과 대조를 마친 근거 조문의 글자.', 'checked': today, 'laws': arts}, f, ensure_ascii=False, indent=1)
            f.write('\n')
        later = sorted('%s %s' % (k, a) for k, m in arts.items() for a, v in m.items() if v.get('upcoming'))
        print('썼어요: 법령 %d개, 근거 조문 %d개' % (len(now), len(ref_map)))
        print('예고된 판에서 글자가 달라지는 조문 %d개:' % len(later), later)
        return 0
    body = report(now, load_old(), arts, load_arts(), ref_map)
    if not body:
        print('바뀐 것 없음: 법령 %d개, 근거 조문 %d개' % (len(now), len(ref_map)))
        return 0
    open(REPORT, 'w', encoding='utf-8').write(body)
    print(body)
    return 1


if __name__ == '__main__':
    sys.exit(main())

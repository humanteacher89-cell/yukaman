# data-src/*.json → public/data/library.json + data-src/자료모음.md
# 항목 = 제목·주소·발행처·날짜·종류·주제·우리 말 요약·기준 시점이 붙은 사실. 원문을 복사하지 않는다(링크 + 요약만).
# checked가 true인 것(주소를 열어 내용을 확인한 것)만 앱에 넣는다. verdicts.json이 있으면 검증 결과(wrong 제외, 고친 사실 반영)를 적용한다.
#   python -X utf8 tools/build_library.py
import json, os, re

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(HERE, 'data-src')
ORDER = ['법령·제도', '통계', '불이익 대처', '지원금', '직군별', '지자체', '기업 사례', '연구', '해외', '경험담', '책', '채널', '커뮤니티']
FILES = ['law.json', 'stats.json', 'workplace.json', 'research.json', 'stories.json', 'more.json']
UPDATED = '2026-11-04'
NOISE = {'call_from', 'f', 'fbclid', 'pageindex', 'print', 'ref'}     # 같은 글을 가리키는데 주소만 달라지는 조각
# 앱에 보여 주는 순서(2026-11-05 휴먼쌤 "가장 유용한 정보 20개만"). 앞 20개는 사람이 고른 top20.json, 그 뒤는 이 순서로 한 건씩 돌려 실용 갈래를 자주 넣고 통계·연구·해외는 뒤로 민다
MIX = ['불이익 대처', '경험담', '지자체', '직군별', '법령·제도', '경험담', '지원금', '채널', '기업 사례', '불이익 대처', '경험담', '직군별', '통계', '책', '커뮤니티', '연구', '해외']


def norm_url(u):
    """중복을 가리는 열쇠. 글을 가리키는 물음표 뒤(유튜브 v=, 통계표 tblId=, 글 번호)는 남기고 꾸밈 조각만 지운다."""
    u = u.split('#')[0].replace('http://', 'https://').replace('https://www.', 'https://')
    base, _, query = u.partition('?')
    keep = sorted(p for p in query.split('&') if p and p.split('=')[0].lower() not in NOISE and not p.lower().startswith('utm_'))
    return base.rstrip('/') + ('?' + '&'.join(keep) if keep else '')


def useful_order(items):
    """앞 20개 + 갈래를 섞은 나머지. 갈래 안에서는 끝난 사업을 맨 뒤로, 그다음 최근 자료·공식 자료 먼저(items는 이미 최신순이라 안정 정렬로 유지된다)."""
    by_url = {norm_url(i['url']): i for i in items}
    top = [by_url[norm_url(t['url'])] for t in json.load(open(os.path.join(SRC, 'top20.json'), encoding='utf-8'))]
    chosen = {norm_url(i['url']) for i in top}

    def rank(i):
        year = int(i['date'][:4] or 0)
        return (bool(re.search('종료|한시', i['title'] + i['summary'])), 0 if year >= 2024 else 1 if year >= 2020 else 2, not i['official'])

    queues = {}
    for i in sorted((i for i in items if norm_url(i['url']) not in chosen), key=rank):
        queues.setdefault(i['topic'], []).append(i)
    cycle = MIX + [t for t in queues if t not in MIX]
    rest = []
    while any(queues.values()):
        for t in cycle:
            if queues.get(t):
                rest.append(queues[t].pop(0))
    return top + rest


def main():
    verdicts = {}
    vp = os.path.join(SRC, 'verdicts.json')
    if os.path.exists(vp):
        for v in json.load(open(vp, encoding='utf-8')):
            verdicts[norm_url(v['url'])] = v
    seen, items, dropped, fixed = {}, [], [], 0
    for fn in FILES:
        p = os.path.join(SRC, fn)
        if not os.path.exists(p):
            print('없음:', fn)
            continue
        for x in json.load(open(p, encoding='utf-8')):
            title, url = (x.get('title') or '').strip(), (x.get('url') or '').strip()
            if not title or not url.startswith('http'):
                dropped.append((fn, title, '형식'))
                continue
            if x.get('checked') is False:
                dropped.append((fn, title, '확인 안 됨'))
                continue
            k = norm_url(url)
            if k in seen:
                dropped.append((fn, title, '중복'))
                continue
            v = verdicts.get(k)
            if v:
                if v.get('verdict') in ('wrong', 'unverifiable'):
                    dropped.append((fn, title, '재검증 ' + v.get('verdict')))
                    continue
                if v.get('facts') is not None:
                    x['facts'] = v['facts']
                    fixed += 1
                if v.get('summary'):
                    x['summary'] = v['summary']
            seen[k] = 1
            topic = x.get('topic') or '기타'
            items.append({
                'title': title, 'url': url, 'publisher': (x.get('publisher') or '').strip(), 'date': str(x.get('date') or ''),
                'type': x.get('type') or '', 'topic': topic, 'summary': (x.get('summary') or '').strip(),
                'facts': [str(f).strip() for f in (x.get('facts') or []) if str(f).strip()], 'official': bool(x.get('official'))
            })
    topics = [t for t in ORDER if any(i['topic'] == t for i in items)] + sorted({i['topic'] for i in items} - set(ORDER))
    items.sort(key=lambda i: (topics.index(i['topic']), [-ord(c) for c in i['date'].ljust(10, '0')]))
    out = {'updated': UPDATED, 'topics': topics, 'count': len(items), 'items': useful_order(items)}
    os.makedirs(os.path.join(HERE, 'public', 'data'), exist_ok=True)
    json.dump(out, open(os.path.join(HERE, 'public', 'data', 'library.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(SRC, '자료모음.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# 남성 육아휴직 자료 모음 (%s, 육아맨)\n\n링크와 우리 말 요약만 모았습니다. 원문 복사 없음. 모두 %d건.\n' % (UPDATED, len(items)))
        for t in topics:
            rows = [i for i in items if i['topic'] == t]
            f.write('\n## %s (%d건)\n\n' % (t, len(rows)))
            for i in rows:
                f.write('- [%s](%s) · %s · %s · %s\n' % (i['title'].replace('[', '(').replace(']', ')'), i['url'], i['publisher'], i['date'], i['summary']))
    print('앱에 넣음', len(items), '건 · 주제', {t: sum(1 for i in items if i['topic'] == t) for t in topics})
    print('뺌', len(dropped), '건', dropped[:12], '· 검증 고침', fixed)


if __name__ == '__main__':
    main()

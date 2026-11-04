# 법령 감시(2026-11-05 휴먼쌤 "이 앱이 계속 정보가 최신화되어야 의미가 있을 테니"). 국가법령정보센터에서 지금 시행 중인 판과 예고된 판을 읽어 public/law-data.js와 비교한다.
#   python -X utf8 tools/check_laws.py           비교만. 바뀐 법령이 있으면 law-watch.md를 쓰고 끝 코드 1(GitHub Actions가 이슈를 연다), 사이트를 못 읽으면 2
#   python -X utf8 tools/check_laws.py --write   public/law-data.js를 지금 값으로 다시 쓴다(글을 다시 대조한 뒤에 돌린다. 확인일이 오늘로 바뀐다)
# 표에 있는 시행일이 글의 확인일보다 늦으면 화면이 그 글에 "확인한 뒤 법령이 바뀌었어요"를 띄운다(public/app.js lawWarn). 그래서 --write는 글을 고치기 전에 돌려도 안전하다.
# 읽는 곳: /법령/<이름>의 iframe 주소(lsiSeq·efYd = 지금 시행 중인 판) + lsSideInfoP 머리줄([시행 …] [법률 제…호, …]). efYd 없이 읽은 머리줄은 공포된 가장 늦은 판이라 예고로 쓴다.
import datetime, json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'public', 'law-data.js')
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
BASE = 'https://www.law.go.kr'


def get(path):
    req = urllib.request.Request(BASE + path, headers={'User-Agent': 'Mozilla/5.0 (yukaman law watch)'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')


def head(seq, ef=''):
    q = 'lsiSeq=%s&joNo=0001&joBrNo=00&docCls=jo&urlMode=lsScJoRltInfoR' % seq
    if ef:
        q += '&efYd=%s&ancYnChk=0' % ef
    text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', get('/LSW//lsSideInfoP.do?' + q)))
    m = re.search(r'\[시행 (\d{4})\. ?(\d{1,2})\. ?(\d{1,2})\.\] ?\[([^,\]]+),', text)
    if not m:
        raise ValueError('머리줄을 못 읽음: ' + seq)
    return '%s-%02d-%02d' % (m.group(1), int(m.group(2)), int(m.group(3))), m.group(4).strip()


def read(law):
    page = get(urllib.parse.quote('/법령/' + law['key']))
    m = re.search(r'lsiSeq=(\d+)[^"]*?efYd=(\d+)', page)
    if not m:
        raise ValueError('주소를 못 읽음: ' + law['key'])
    seq, ef = m.group(1), m.group(2)
    effective, no = head(seq, ef)
    latest, _ = head(seq)
    return {'key': law['key'], 'name': law['name'], 'no': no, 'effective': effective, 'upcoming': latest if latest > effective else '', 'seq': seq, 'match': law['match']}


def load_old():
    if not os.path.exists(OUT):
        return {}
    m = re.search(r'window\.YK_LAWS = (\{.*\});', open(OUT, encoding='utf-8').read(), re.S)
    return {x['key']: x for x in json.loads(m.group(1))['items']} if m else {}


def main():
    try:
        now = []
        for law in LAWS:
            now.append(read(law))
            time.sleep(0.5)
    except Exception as e:
        print('법령 사이트를 못 읽었어요:', e)
        return 2
    if '--write' in sys.argv:
        data = {'checked': datetime.date.today().isoformat(), 'items': now}
        text = ('// 만들어지는 파일: python -X utf8 tools/check_laws.py --write. 글의 근거 법령 표시와 "법령이 바뀌었어요" 안내에 쓴다.\n'
                'window.YK_LAWS = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n')
        open(OUT, 'w', encoding='utf-8', newline='\n').write(text)
        print('썼어요:', OUT, len(now), '개')
        return 0
    old = load_old()
    changes = []
    for x in now:
        o = old.get(x['key'])
        if not o:
            changes.append('- %s: 표에 없음' % x['name'])
            continue
        for f, label in (('effective', '시행일'), ('no', '법령 번호'), ('upcoming', '예고된 시행일')):
            if (o.get(f) or '') != (x.get(f) or ''):
                changes.append('- %s %s: %s → %s' % (x['name'], label, o.get(f) or '없음', x.get(f) or '없음'))
    if not changes:
        print('바뀐 법령 없음', len(now), '개')
        return 0
    body = '\n'.join(['국가법령정보센터에서 바뀐 것을 찾았어요. 관련 글과 calc.js 숫자를 원문과 다시 대조한 뒤 `tools/check_laws.py --write`를 돌려 주세요.', ''] + changes)
    open(os.path.join(HERE, 'law-watch.md'), 'w', encoding='utf-8').write(body + '\n')
    print(body)
    return 1


if __name__ == '__main__':
    sys.exit(main())

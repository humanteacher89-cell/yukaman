# 자동 점검 시험(인터넷 없이). python -X utf8 test/watch-test.py
import os, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(HERE, 'tools'))
import check_laws as L  # noqa: E402
import check_links as K  # noqa: E402

n = 0


def eq(got, want, what):
    global n
    n += 1
    if got != want:
        print('틀림:', what, '\n  받음:', repr(got), '\n  기대:', repr(want))
        sys.exit(1)


def has(text, part, what):
    eq(part in text, True, what + ' / ' + part)


# 조문 꺼내기: 링크 · 계산식 그림 · 단추 글자 · 다른 조문
PAGE = ('<a name="J104:2" id="J104:2"></a><div class="pgroup"><div class="lawcon"><p><input type="checkbox" /><span><label>제104조의2(단축 급여)</label></span> ① '
        '<a class="link">법</a> <a class="link">제73조의2</a> 급여액은 <img alt="@@LATEX@@250만원을상한@@/LATEX@@" src="x" /> 이다 &lt;개정 2025. 12. 23.&gt;</p> <p>위임행정규칙</p></div></div><!-- 별표 서식 시작 --><div>뒤쪽 글자</div>')
text = L.article_text(PAGE, '제104조의2')
has(text, '제104조의2(단축 급여)', '조문 제목')
has(text, '250만원을상한', '계산식 그림의 글자')
has(text, '<개정 2025. 12. 23.>', '개정 표시')
eq('위임행정규칙' in text, False, '단추 글자 뺌')
eq('뒤쪽' in text, False, '조문 뒤 글자 뺌')
eq(L.article_text(PAGE, '제95조'), '', '없는 조문')
eq(L.article_text(PAGE.replace('제104조의2(', '제999조('), '제104조의2'), '', '다른 조문이 나오면 없는 것으로')

# 출처 → 조문
eq(L.law_of('https://www.law.go.kr/법령/고용보험법/제70조'), ('고용보험법', '제70조'), '법 주소')
eq(L.law_of('https://www.law.go.kr/법령/고용보험법시행령/제95조의3'), ('고용보험법시행령', '제95조의3'), '시행령과 법을 섞지 않음')
eq(L.law_of('https://www.law.go.kr/LSW//lsLawLinkInfo.do?lsId=002303&print=print', '공무원수당 등에 관한 규정 제11조의3'), ('공무원수당등에관한규정', '제11조의3'), '번호 주소는 이름에서')
eq(L.law_of('https://www.law.go.kr/LSW/precInfoP.do?precSeq=1', '대법원 판례'), None, '판례는 조문 아님')
eq(L.law_of('https://www.moel.go.kr/x', '제70조'), None, '법령 사이트만')
refs = L.refs()
eq('계산기' in refs[('고용보험법시행령', '제95조')], True, '계산기 근거')
eq(any('6+6' in x for x in refs[('고용보험법시행령', '제95조의3')]), True, '글 제목이 쓰인 곳에')
eq(len(refs) >= 30, True, '근거 조문 수')

# 띄어쓰기만 다른 것은 같다(시행 중인 판에만 링크가 붙어 간격이 달라진다)
eq(L.same('대통령령 으로 정한다', '대통령령으로 정한다'), True, '띄어쓰기 무시')
eq(L.same('최초 2일은 유급', '최초 4일은 유급'), False, '숫자가 다르면 다름')

# 줄 나누기: 날짜에서 끊지 않고, 바뀐 항만
d = L.diff_lines('제1조 ① 최초 2일 <개정 2024. 12. 31.> ② 그대로', '제1조 ① 최초 4일 <개정 2024. 12. 31., 2026. 5. 26.> ② 그대로')
has(d, '- ① 최초 2일 <개정 2024. 12. 31.>', '옛 항')
has(d, '+ ① 최초 4일 <개정 2024. 12. 31., 2026. 5. 26.>', '새 항')
eq('그대로' in d, False, '안 바뀐 항은 뺌')
eq(L.diff_lines('제1조 대통령령 으로', '제1조 대통령령으로'), '', '띄어쓰기만 다르면 차이 없음')
eq(L.diff_lines('가' * 50, '나' * 50, 20).endswith('원문 확인)'), True, '길면 줄임')

# 비교: 조문과 표
KEY, NAME, ART = '고용보험법', '고용보험법', '제70조'
RM = {(KEY, ART): ['계산기', '글 하나']}
NOW = [{'key': KEY, 'name': NAME, 'no': '법률 제1호', 'effective': '2026-09-18', 'upcoming': ''}]
OLD = {KEY: dict(NOW[0])}


def run(old_art, new_art, now=None):
    return L.report(now or NOW, OLD, {KEY: {ART: new_art}}, {KEY: {ART: old_art}} if old_art else {}, RM)


C = {'current': '제70조 ① 80퍼센트'}
eq(run(C, dict(C)), '', '그대로면 이슈 없음')
eq(run(C, {'current': '제70조 ① 80 퍼센트'}), '', '띄어쓰기만 바뀌면 이슈 없음')
r = run(C, {'current': '제70조 ① 90퍼센트'})
has(r, '지금 시행 중인 글자가 바뀌었어요', '본문 변경')
has(r, '- ① 80퍼센트', '옛 글자')
has(r, '+ ① 90퍼센트', '새 글자')
has(r, '쓰인 곳: 계산기 · 글 하나', '쓰인 곳')
r = run(C, {'current': C['current'], 'upcoming': '제70조 ① 90퍼센트', 'upcoming_date': '2027-01-01'})
has(r, '2027-01-01 시행 예고된 판에서 글자가 달라져요', '새 예고')
P = {'current': C['current'], 'upcoming': '제70조 ① 90퍼센트', 'upcoming_date': '2027-01-01'}
eq(run(P, dict(P)), '', '이미 아는 예고는 다시 알리지 않음')
r = run(P, {'current': '제70조 ① 90퍼센트'})
has(r, '예고됐던 판이 시행됐어요', '예고가 시행되면 알림')
eq('시행 예고된 판에서' in r, False, '시행된 뒤에는 예고로 알리지 않음')
r = run(P, {'current': C['current'], 'upcoming': '제70조 ① 95퍼센트', 'upcoming_date': '2027-01-01'})
has(r, '시행 예고된 판에서 글자가 달라져요', '예고 글자가 또 바뀜')
has(run(C, {'current': ''}), '조문을 못 찾았어요', '조문이 없어짐')
has(run(None, dict(C)), '대조 기록이 없어요', '새 근거 조문')
moved = [dict(NOW[0], effective='2026-12-01')]
r = run(C, dict(C), moved)
has(r, '시행일: 2026-09-18 → 2026-12-01', '시행일 변경')
has(r, '근거 조문은 그대로인 법', '다른 조문만 바뀐 개정')
r = run(C, {'current': '제70조 ① 90퍼센트'}, moved)
eq('근거 조문은 그대로인 법' in r, False, '조문이 바뀌면 그대로라고 하지 않음')

# 링크: 200인데 글이 없는 경우
ok = lambda url, final, html: K.judge_page(url, final, html.encode('utf-8'))
eq(ok('https://a.kr/news/1', 'https://a.kr/news/1', '<title>글</title><p>육아휴직 안내</p>')[0], 'ok', '정상')
eq(ok('https://a.kr/news/1', 'https://a.kr/', '<title>첫 화면</title>')[0], 'suspect', '첫 화면으로 넘어감')
eq(ok('https://a.kr/', 'https://a.kr/', '<title>첫 화면</title>')[0], 'ok', '원래 첫 화면')
eq(ok('https://a.kr/1', 'https://a.kr/1', '<title>국가법령정보센터 | 오류페이지</title>')[0], 'suspect', '오류 제목')
eq(ok('https://a.kr/1', 'https://a.kr/1', '<title>정책브리핑 - Error</title>')[0], 'suspect', '영어 오류 제목')
eq(ok('https://a.kr/1', 'https://a.kr/1', '<p>죄송합니다. 기술적인 문제로 서비스에 접속이 되지 않았습니다.</p>')[0], 'suspect', '고용노동부 오류 화면')
eq(ok('https://a.kr/1', 'https://a.kr/1', '<script>var a="페이지를 찾을 수 없습니다"</script><p>글</p>')[0], 'ok', '스크립트 안의 글자는 안 봄')
eq(K.judge_page('https://a.kr/1', 'https://a.kr/1', '<p>삭제된 기사입니다</p>'.encode('euc-kr'))[0], 'suspect', 'EUC-KR 사이트')

# 끊김: 잠깐 끊기면 다시 읽고, 없는 이름만 없어짐으로 친다
import io, socket, urllib.error  # noqa: E402
calls = []


def flaky(req, timeout=0):
    calls.append(1)
    if len(calls) < 3:
        raise urllib.error.URLError(socket.gaierror(-5, 'No address associated with hostname'))
    return io.BytesIO('본문'.encode('utf-8'))


real_open, real_sleep = L.urllib.request.urlopen, L.time.sleep
L.urllib.request.urlopen, L.time.sleep = flaky, lambda s: None
eq(L.get('/x'), '본문', '끊겨도 다시 읽음')
eq(len(calls), 3, '세 번째에 읽음')


def gone(req, timeout=0):
    calls.append(1)
    raise urllib.error.HTTPError('u', 404, 'Not Found', {}, None)


calls.clear()
L.urllib.request.urlopen = gone
try:
    L.get('/x')
    eq('예외', '없음', '404는 바로 실패')
except urllib.error.HTTPError:
    eq(len(calls), 1, '404는 다시 읽지 않음')
L.urllib.request.urlopen, L.time.sleep = real_open, real_sleep


def fail_with(err):
    def f(url, verify=True):
        raise urllib.error.URLError(err)
    return f


real_url = K.open_url
K.open_url = fail_with(socket.gaierror(socket.EAI_NONAME, 'not known'))
eq(K.check('https://a.kr/1')[0], 'dead', '없는 이름')
K.open_url = fail_with(socket.gaierror(-5, 'No address'))
eq(K.check('https://a.kr/1')[0], 'unknown', '이름 찾기 일시 실패')
K.open_url = real_url

# 이슈 본문
WHERE ={'https://a.kr/1': ['자료실: 가'], 'https://b.kr/2': ['글: 나'], 'https://c.kr/3': ['자료실: 다'], 'https://d.kr/4': ['자료실: 라']}
RES = {'https://a.kr/1': ('dead', '404'), 'https://b.kr/2': ('suspect', '첫 화면으로 넘어감'), 'https://c.kr/3': ('unknown', '403'), 'https://d.kr/4': ('ok', '')}
body, unknown = K.report(RES, WHERE, {})
has(body, '없어진 주소 1개', '없어진 주소')
has(body, '의심되는 주소 1개', '의심 주소')
has(body, '자료실: 가', '쓰인 곳')
eq('c.kr' in body, False, '못 읽음은 이슈에 넣지 않음')
eq(len(unknown), 1, '못 읽음은 실행 기록에')
eq(K.report(RES, WHERE, {'https://a.kr/1': '확인함', 'https://b.kr/2': '확인함'})[0], '', '사람이 확인한 주소는 빼기')
eq(K.report({'https://c.kr/3': ('unknown', '403')}, WHERE, {})[0], '', '못 읽음만 있으면 이슈 없음')
tg = K.targets()
eq(len(tg) >= 300, True, '점검 주소 수')
eq(any(x.startswith('글: ') for v in tg.values() for x in v), True, '글 출처도 점검')
eq(K.safe('https://www.law.go.kr/법령/고용보험법').isascii(), True, '한글 주소')

print('통과', n, '건')

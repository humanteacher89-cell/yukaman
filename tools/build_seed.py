# seed/official-posts.json → seed/official.sql (자료실 계정의 글. 공개 D1에도 넣는다. INSERT OR IGNORE라 이미 있는 글은 안 바뀐다)
#                          → seed/official-update.sql (이미 있는 글의 제목·본문을 파일과 같게 맞추는 UPDATE. 글을 고친 뒤 deploy.py seed)
#                          → public/official-data.js (같은 글을 아빠 가이드 'Q&A·정보'에 넣어 인증 전에도 누구나 본다. 2026-11-04 휴먼쌤 "가이드는 전부다 열어둬")
# 사람이 쓴 것처럼 꾸미지 않는다: 글쓴이는 늘 '육아맨 자료실'(로그인 불가 계정), 내용은 공식 자료·출처가 있는 것만. 지어낸 경험담은 넣지 않는다.
# 몇 번 돌려도 그대로(INSERT OR IGNORE). 글 번호는 파일 순서대로 1번부터라 앞에 끼워 넣지 말고 뒤에 더한다.
#   python -X utf8 tools/build_seed.py
import json, os, re
from urllib.parse import unquote, urlparse

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = '2026-11-04T00:%02d:00.000Z'
UPDATED = '2026-11-04'
ORDER = ['question', 'leave', 'tip', 'play']          # 가이드에 보이는 순서(같은 분류 안은 파일 순서)
EMOJI = {'question': '🙋', 'leave': '📋', 'tip': '💡', 'play': '⚽'}
HOSTS = {'law.go.kr': '국가법령정보센터', 'moel.go.kr': '고용노동부', 'work24.go.kr': '고용24', 'korea.kr': '정책브리핑', 'mohw.go.kr': '보건복지부',
         'mpm.go.kr': '인사혁신처', 'mediahub.seoul.go.kr': '서울시 미디어허브', 'gangnam.go.kr': '강남구', 'sejong.go.kr': '세종특별자치시',
         'mt.co.kr': '머니투데이', 'khan.co.kr': '경향신문', 'segye.com': '세계일보', 'newsis.com': '뉴시스', 'bokjiro.go.kr': '복지로', 'gov.kr': '정부24',
         'nlrc.go.kr': '중앙노동위원회', 'nabo.go.kr': '국회예산정책처', 'mods.go.kr': '국가데이터처', 'asan.go.kr': '아산시', 'gworkingmom.net': '서남권직장맘지원센터',
         'lawtimes.co.kr': '법률신문', 'news.seoul.go.kr': '서울특별시'}


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def source(url):
    host = urlparse(url).netloc.lower().removeprefix('www.').removeprefix('m.').removeprefix('labor.')
    name = next((v for k, v in HOSTS.items() if host == k or host.endswith('.' + k)), host)
    m = re.search(r'/법령/([^/]+)/([^/?#]+)', unquote(url))
    return {'t': name + ' ' + m.group(1) + ' ' + m.group(2) if m else name, 'u': url}


def to_item(i, p):
    """자료실 글(줄글) → 가이드 글 꼴(body 묶음 + sources). 빈 줄로 나눈 묶음마다: '출처'는 출처 목록, '- '는 ul, '1. '은 ol, 목록 바로 앞의 짧은 줄은 소제목."""
    body, sources = [], []
    for chunk in re.split(r'\n\s*\n', p['body'].strip()):
        lines = [x.strip() for x in chunk.split('\n') if x.strip()]
        if lines[0] == '출처':
            sources += [source(u) for u in lines[1:]]
            continue
        n = 0
        while n < len(lines):
            line = lines[n]
            if line.startswith('- '):
                run = []
                while n < len(lines) and lines[n].startswith('- '):
                    run.append(lines[n][2:]); n += 1
                body.append({'ul': run})
            elif re.match(r'\d+\. ', line):
                run = []
                while n < len(lines) and re.match(r'\d+\. ', lines[n]):
                    run.append(re.sub(r'^\d+\. ', '', lines[n])); n += 1
                body.append({'ol': run})
            else:
                nxt = lines[n + 1] if n + 1 < len(lines) else ''
                is_head = len(line) <= 60 and (nxt.startswith('- ') or re.match(r'\d+\. ', nxt)) and not line.endswith(('.', '요', '다'))
                body.append({'h': line} if is_head else {'p': line})
                n += 1
    first = next((b['p'] for b in body if 'p' in b), p['title'])
    first = re.sub(r'^A\. ', '', first)
    sub = first if len(first) <= 44 else first[:43] + '…'
    return {'id': 'o%d' % i, 'cat': 'faq', 'e': EMOJI[p['cat']], 'community': p['cat'], 'status': '자료 정리', 'updated': UPDATED,
            'title': p['title'], 'sub': sub, 'body': body, 'sources': sources}


def write_guide(posts):
    items = [to_item(i, p) for i, p in enumerate(posts, 1)]
    cat_of = {'o%d' % i: p['cat'] for i, p in enumerate(posts, 1)}
    items.sort(key=lambda g: ORDER.index(cat_of[g['id']]))     # sort는 안정 정렬이라 같은 분류 안은 파일 순서
    path = os.path.join(HERE, 'public', 'official-data.js')
    text = ('// 만들어지는 파일: tools/build_seed.py. 고칠 곳은 seed/official-posts.json\n'
            '// 자료실 계정의 글을 아빠 가이드 Q&A·정보로 넣는다. 서버를 거치지 않아 인증 전에도, 끊겨도 보인다. guide-data.js 다음, app.js 앞에 읽는다.\n'
            '(function () {\n  var G = window.YK_GUIDES;\n  if (!G) return;\n'
            "  G.cats.push({ key: 'faq', name: 'Q&A·정보', e: '🙋' });\n"
            '  G.items.push.apply(G.items, ' + json.dumps(items, ensure_ascii=False, separators=(',', ':')) + ');\n})();\n')
    open(path, 'w', encoding='utf-8', newline='\n').write(text)
    print('가이드 글', len(items), '→', path)


def main():
    posts = json.load(open(os.path.join(HERE, 'seed', 'official-posts.json'), encoding='utf-8'))
    cats = {'question', 'tip', 'daily', 'leave', 'play', 'gear'}
    out = ['-- 만들어지는 파일: tools/build_seed.py. 고칠 곳은 seed/official-posts.json',
           "INSERT OR IGNORE INTO users (id, nick, nick_key, token_hash, created, last_seen, role, verified, verified_how) VALUES "
           "(1, '육아맨 자료실', '육아맨자료실', 'official-no-login', '2026-11-04T00:00:00.000Z', '', 'official', 1, 'admin');"]
    for i, p in enumerate(posts, 1):
        assert p['cat'] in cats, p['cat']
        assert 2 <= len(p['title']) <= 60, p['title']
        assert 1 <= len(p['body']) <= 3000, p['title']
        out.append('INSERT OR IGNORE INTO posts (id, user_id, cat, title, body, created) VALUES (%d, 1, %s, %s, %s, %s);' % (i, q(p['cat']), q(p['title']), q(p['body']), q(BASE % i)))
    path = os.path.join(HERE, 'seed', 'official.sql')
    open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
    print('글', len(posts), '→', path)
    upd = ['-- 만들어지는 파일: tools/build_seed.py. 이미 들어 있는 자료실 글의 제목·본문을 seed/official-posts.json과 같게 맞춘다(user_id = 1인 글만).']
    for i, p in enumerate(posts, 1):
        upd.append('UPDATE posts SET cat = %s, title = %s, body = %s WHERE id = %d AND user_id = 1 AND deleted IS NULL;' % (q(p['cat']), q(p['title']), q(p['body']), i))
    path = os.path.join(HERE, 'seed', 'official-update.sql')
    open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(upd) + '\n')
    print('고치기', len(posts), '→', path)
    write_guide(posts)


if __name__ == '__main__':
    main()

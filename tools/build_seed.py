# seed/official-posts.json → seed/official.sql (자료실 계정의 글. 공개 D1에도 넣는다)
# 사람이 쓴 것처럼 꾸미지 않는다: 글쓴이는 늘 '육아맨 자료실'(로그인 불가 계정), 내용은 공식 자료·출처가 있는 것만. 지어낸 경험담은 넣지 않는다.
# 몇 번 돌려도 그대로(INSERT OR IGNORE). 글 번호는 파일 순서대로 1번부터라 앞에 끼워 넣지 말고 뒤에 더한다.
#   python -X utf8 tools/build_seed.py
import json, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = '2026-11-04T00:%02d:00.000Z'


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


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


if __name__ == '__main__':
    main()

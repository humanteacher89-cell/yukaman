# 아이콘 + 공유 그림 만들기(2026-11-04 띠 로고 1판). tools/make_logo.py가 구운 선(tools/logo-paths.json)을 크롬 headless로 찍는다 — 화면의 logo.svg · app.js LOGO와 같은 모양.
#   python -X utf8 tools/build_icons.py            (크롬 경로는 환경 변수 CHROME, 없으면 Program Files의 Chrome → Edge)
# 만드는 것: icon-192 · icon-512(모서리 둥근 타일, 바깥 투명) · apple-touch-icon 180(꽉 찬 네모) · maskable-512(안전 영역 안에 글자) · og.png 1200×630
import json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'public', 'icons')
P = json.load(open(os.path.join(HERE, 'tools', 'logo-paths.json'), encoding='utf-8'))
BG, INK, SUB = '#FBF6F0', '#2B2118', '#6B5F55'      # 색감 3(토마토와 먹색)의 바탕·글자색


def chrome():
    c = os.environ.get('CHROME')
    cands = [c] if c else []
    for base in (os.environ.get('ProgramFiles', ''), os.environ.get('ProgramFiles(x86)', ''), os.environ.get('LOCALAPPDATA', '')):
        if base:
            cands += [os.path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'), os.path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe')]
    for x in cands:
        if x and os.path.exists(x):
            return x
    sys.exit('크롬(또는 엣지)을 못 찾았어요. 환경 변수 CHROME에 경로를 넣어 주세요.')


def shoot(exe, html, w, h, out, transparent, tmp):
    page = os.path.join(tmp, os.path.basename(out) + '.html')
    open(page, 'w', encoding='utf-8').write(html)
    args = [exe, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--user-data-dir=' + os.path.join(tmp, 'prof'),
            '--window-size=%d,%d' % (w, h), '--virtual-time-budget=6000', '--screenshot=' + out]
    if transparent:
        args.append('--default-background-color=00000000')
    args.append('file:///' + page.replace('\\', '/'))
    r = subprocess.run(args, capture_output=True, text=True)
    if not os.path.exists(out):
        sys.exit('못 찍음: ' + out + '\n' + r.stderr[-800:])


def svg_sized(svg, n):
    return svg.replace('viewBox', 'width="%d" height="%d" viewBox' % (n, n), 1)


def main():
    exe = chrome()
    tmp = tempfile.mkdtemp(prefix='yk-icons-')
    try:
        shell = '<!doctype html><meta charset="utf-8"><body style="margin:0;width:%dpx;height:%dpx;overflow:hidden;background:%s">%s</body>'
        for n in (192, 512):
            shoot(exe, shell % (n, n, 'transparent', svg_sized(P['tile'], n)), n, n, os.path.join(OUT, 'icon-%d.png' % n), True, tmp)
        shoot(exe, shell % (180, 180, '#14213D', svg_sized(P['square'], 180)), 180, 180, os.path.join(OUT, 'apple-touch-icon.png'), False, tmp)
        shoot(exe, shell % (512, 512, '#14213D', svg_sized(P['maskable'], 512)), 512, 512, os.path.join(OUT, 'maskable-512.png'), False, tmp)
        word = P['wordmark'].replace('<svg ', '<svg height="150" ', 1)
        og = ('<!doctype html><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700&display=swap" rel="stylesheet">'
              '<body style="margin:0;width:1200px;height:630px;overflow:hidden;background:%s;--bg:%s;color:%s;font-family:\'Noto Sans KR\',\'Malgun Gothic\',sans-serif;display:flex;align-items:center;gap:72px;padding:0 96px;box-sizing:border-box">'
              '<div style="flex:none;width:300px;height:300px">%s</div><div>%s'
              '<p style="margin:30px 0 0;font-size:42px;font-weight:700;letter-spacing:-.02em">육아하는 아빠들의 동네</p>'
              '<p style="margin:12px 0 0;font-size:25px;font-weight:500;color:%s;white-space:nowrap">육아휴직 급여 바로 계산 · 제도 안내 · 아빠끼리 솔직하게</p></div></body>') % (BG, BG, INK, svg_sized(P['tile'], 300), word, SUB)
        shoot(exe, og, 1200, 630, os.path.join(OUT, 'og.png'), False, tmp)
        print('아이콘 5장 →', OUT)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()

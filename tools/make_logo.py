# 육아맨 로고(2026-11-04 휴먼쌤 확정 '띠 로고 1')를 Gasoek One 글꼴(OFL)에서 선(path)으로 굽는다.
# 글꼴 파일은 저장소에 넣지 않는다. 글자 두께는 줄기 두께의 10%만큼 바탕색 선으로 깎아 가늘게 한다(휴먼쌤 "글자의 두께를 지금의 10%만큼 줄여줘").
#   python -I -X utf8 tools/make_logo.py <GasoekOne-Regular.ttf>
# 만드는 것: public/icons/logo.svg(타일 64) · public/icons/wordmark.svg(글자 + 노란 밑줄 띠) · tools/logo-paths.json(app.js에 넣을 문자열)
import json, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = sys.argv[1]
TEXT = '육아맨'
NAVY, YEL, WHITE = '#14213D', '#FFC914', '#FFFFFF'
THIN = 0.10          # 줄기 두께의 10%

f = TTFont(FONT)
upm = f['head'].unitsPerEm
cmap = f.getBestCmap(); gs = f.getGlyphSet(); hmtx = f['hmtx']

# 1) 글자 윤곽을 y 뒤집어(화면 좌표) 가로로 잇는다
x = 0; cmds = []; bb = [1e9, 1e9, -1e9, -1e9]
for ch in TEXT:
    g = cmap[ord(ch)]
    pen = SVGPathPen(gs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
    gs[g].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
    cmds.append(pen.getCommands())
    bp = BoundsPen(gs); gs[g].draw(TransformPen(bp, (1, 0, 0, -1, x, 0)))
    if bp.bounds:
        bb = [min(bb[0], bp.bounds[0]), min(bb[1], bp.bounds[1]), max(bb[2], bp.bounds[2]), max(bb[3], bp.bounds[3])]
    x += hmtx[g][0]
D = ' '.join(cmds)
tw, th = bb[2] - bb[0], bb[3] - bb[1]

# 2) 줄기 두께: '아'를 1000px로 찍어 가운데 줄에서 ㅏ 세로 줄기의 폭을 잰다
img = Image.new('L', (1400, 1400), 0)
fnt = ImageFont.truetype(FONT, 1000)
ImageDraw.Draw(img).text((100, 100), '아', font=fnt, fill=255)
box = img.getbbox(); px = img.load()
runs = []
for frac in (0.45, 0.5, 0.55):
    y = int(box[1] + (box[3] - box[1]) * frac)
    run = 0; row = []
    for xx in range(box[0], box[2] + 1):
        if px[xx, y] > 127: run += 1
        elif run: row.append(run); run = 0
    if run: row.append(run)
    if row: runs.append(row[-1])          # 맨 오른쪽 덩어리 = ㅏ 세로 줄기
stem_px = sorted(runs)[len(runs) // 2]
stem = stem_px / 1000 * upm               # 글꼴 단위
stroke = stem * THIN                      # 윤곽 가운데 선이라 양쪽 합쳐 이만큼 줄어든다

# 3) 타일(viewBox 64): 글자 폭 85%, 글자 가운데 y 28.8, 띠 y 41.6 h 7
s = 54.4 / tw
cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
tx, ty = 32 - cx * s, 28.8 - cy * s
fmt = lambda v: ('%.4f' % v).rstrip('0').rstrip('.')
text_tile = '<path transform="translate(%s %s) scale(%s)" d="%s" fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>' % (fmt(tx), fmt(ty), fmt(s), D, WHITE, NAVY, fmt(stroke))
tile = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="%s"/>%s<rect y="41.6" width="64" height="7.04" fill="%s"/></svg>' % (NAVY, text_tile, YEL)
# 전체 바탕(iOS·maskable용, 모서리 없음)
square = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="%s"/>%s<rect y="41.6" width="64" height="7.04" fill="%s"/></svg>' % (NAVY, text_tile, YEL)

# maskable(안드로이드가 둥글게 깎는 아이콘): 글자를 80%로 줄여 안전 영역 안에, 띠는 그대로 가로로 꽉
s3 = s * 0.8
text_small = '<path transform="translate(%s %s) scale(%s)" d="%s" fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>' % (fmt(32 - cx * s3), fmt(29.5 - cy * s3), fmt(s3), D, WHITE, NAVY, fmt(stroke))
maskable = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="%s"/>%s<rect y="40.5" width="64" height="6" fill="%s"/></svg>' % (NAVY, text_small, YEL)

# 4) 글자 로고(앱 바): 글자 높이 100 기준, 아래 노란 띠 24, 사이 10. 글자색은 currentColor, 깎는 선은 바탕색 변수(--bg)
s2 = 100 / th
pad = 4
W = tw * s2 + pad * 2
tx2, ty2 = pad - bb[0] * s2, -bb[1] * s2
H = 100 + 10 + 24
word = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s">' % (fmt(W), H)
        + '<path transform="translate(%s %s) scale(%s)" d="%s" fill="currentColor" style="stroke:var(--bg,#fff)" stroke-width="%s" stroke-linejoin="round"/>' % (fmt(tx2), fmt(ty2), fmt(s2), D, fmt(stroke))
        + '<rect y="110" width="%s" height="24" fill="%s"/></svg>' % (fmt(W), YEL))

os.makedirs(os.path.join(HERE, 'public', 'icons'), exist_ok=True)
open(os.path.join(HERE, 'public', 'icons', 'logo.svg'), 'w', encoding='utf-8', newline='\n').write(tile + '\n')
open(os.path.join(HERE, 'public', 'icons', 'wordmark.svg'), 'w', encoding='utf-8', newline='\n').write(word + '\n')
json.dump({'upm': upm, 'stem': stem, 'stroke': stroke, 'textWidth': tw, 'textHeight': th, 'tile': tile, 'square': square, 'maskable': maskable, 'wordmark': word, 'wordW': W, 'wordH': H},
          open(os.path.join(HERE, 'tools', 'logo-paths.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('upm', upm, 'stem', round(stem, 1), 'stroke', round(stroke, 2), 'text', round(tw), 'x', round(th), 'tile bytes', len(tile), 'word', round(W), 'x', H)

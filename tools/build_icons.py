# 아이콘 + 공유 그림 만들기(2026-11-04 검수 13·26). 아빠가 아이를 목마 태운 모습. public/icons/logo.svg, public/app.js LOGO와 같은 모양으로 맞춘다.
#   python -X utf8 tools/build_icons.py
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'public', 'icons')
BLUE, YEL, WHITE = (37, 99, 235), (255, 209, 102), (255, 255, 255)
SS = 4


def figure(d, s, ox=0, oy=0):
    """viewBox 64 기준 그림. s = 배율"""
    def c(x, y, r, col):
        d.ellipse([(ox + (x - r) * s), (oy + (y - r) * s), (ox + (x + r) * s), (oy + (y + r) * s)], fill=col)
    def line(x1, y1, x2, y2, w, col):
        d.line([(ox + x1 * s, oy + y1 * s), (ox + x2 * s, oy + y2 * s)], fill=col, width=int(w * s))
        c(x1, y1, w / 2, col); c(x2, y2, w / 2, col)
    # 아이(뒤): 머리, 몸, 만세 한 두 팔
    c(32, 9.5, 6, YEL)
    line(32, 17, 32, 24, 11, YEL)
    line(27, 18, 18.5, 9.5, 4.2, YEL)
    line(37, 18, 45.5, 9.5, 4.2, YEL)
    line(24, 25, 40, 25, 4.4, YEL)      # 엉덩이(머리 뒤로 지나간다)
    # 아빠: 머리, 몸
    c(32, 30.5, 7.5, WHITE)
    d.pieslice([ox + 12 * s, oy + 39.5 * s, ox + 52 * s, oy + 79.5 * s], 180, 360, fill=WHITE)
    # 아이 다리(앞): 아빠 어깨로 내려온다
    line(24, 25, 21.5, 42, 4.4, YEL)
    line(40, 25, 42.5, 42, 4.4, YEL)


def icon(size, radius, inset=1.0):
    n = size * SS
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if radius:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=radius * n / 64, fill=BLUE)
    else:
        d.rectangle([0, 0, n, n], fill=BLUE)
    s = n / 64 * inset
    figure(d, s, (n - 64 * s) / 2, (n - 64 * s) / 2)
    return img.resize((size, size), Image.LANCZOS)


def og():
    W, H = 1200, 630
    img = Image.new('RGB', (W, H), BLUE)
    px = img.load()
    for y in range(H):
        for x in range(0, W):
            t = (x / W + y / H) / 2
            px[x, y] = (int(37 + (79 - 37) * t), int(99 + (139 - 99) * t), int(235 + (255 - 235) * t))
    big = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    d.rounded_rectangle([140, 400, 140 + 480, 400 + 480], radius=130, fill=(255, 255, 255, 40))
    figure(d, 480 / 64, 140, 400)
    big = big.resize((W, H), Image.LANCZOS)
    img.paste(big, (0, 0), big)
    d = ImageDraw.Draw(img)
    f = lambda n, bold=True: ImageFont.truetype(r'C:\Windows\Fonts\malgunbd.ttf' if bold else r'C:\Windows\Fonts\malgun.ttf', n)
    d.text((340, 150), '육아맨', font=f(112), fill=WHITE)
    d.text((340, 292), '육아하는 아빠들의 동네', font=f(50), fill=WHITE)
    d.text((340, 386), '육아휴직 급여 바로 계산', font=f(36, False), fill=(232, 239, 255))
    d.text((340, 438), '제도 안내 · 아빠끼리 솔직하게', font=f(36, False), fill=(232, 239, 255))
    img.save(os.path.join(OUT, 'og.png'), optimize=True)


def main():
    icon(192, 18).save(os.path.join(OUT, 'icon-192.png'))
    icon(512, 18).save(os.path.join(OUT, 'icon-512.png'))
    icon(180, 0).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
    icon(512, 0, 0.78).save(os.path.join(OUT, 'maskable-512.png'))     # 안전 영역 안으로
    og()
    print('아이콘 5장 →', OUT)


if __name__ == '__main__':
    main()

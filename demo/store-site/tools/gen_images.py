"""Draw Brambleway's product images: original flat illustrations, one per shape x style x colour, as SVG.

Every product image is made here (no photos, no copied artwork): the product's shape (from its kind), one of three
styles (proportions and details), filled in the variant's colour on a soft backdrop. tools/upload_images.py puts them
in Octo files. Usage: python3 tools/gen_images.py  -> build/images/<shape>-<style>-<colour>.svg
"""
import json, pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from taxonomy import COLORS  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "build" / "images"
ACCENTS = ["#e9a23b", "#2b3a42", "#f4efe4"]  # saffron, ink, cream: the style's trim colour
BACKS = [("#f7f3ea", "#ece4d3"), ("#eef3f1", "#dce7e3"), ("#f5f0f3", "#e8dfe5")]


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def mix(hex_, other, t):
    a = [int(hex_[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(other[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(a, b))


def lum(hex_):
    r, g, b = (int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


# Each shape draws into an 800x800 box with c (main), d (shade), l (highlight), a (accent), s (style 0-2).
def pack(c, d, l, a, s):
    w = [300, 330, 280][s]
    x = 400 - w / 2
    return f"""<rect x="{x + 40}" y="150" width="{w - 80}" height="90" rx="45" fill="none" stroke="{d}" stroke-width="22"/>
<rect x="{x}" y="200" width="{w}" height="440" rx="70" fill="{c}"/>
<rect x="{x}" y="200" width="{w}" height="120" rx="60" fill="{l}" opacity=".35"/>
<rect x="{x + 50}" y="{[400, 380, 420][s]}" width="{w - 100}" height="{[190, 210, 170][s]}" rx="34" fill="{d}"/>
<rect x="{x + 70}" y="{[430, 410, 450][s]}" width="{w - 140}" height="12" rx="6" fill="{a}"/>
<rect x="{x - 26}" y="300" width="34" height="260" rx="17" fill="{d}"/><rect x="{x + w - 8}" y="300" width="34" height="260" rx="17" fill="{d}"/>
<circle cx="400" cy="{[350, 340, 360][s]}" r="14" fill="{a}"/>"""


def shoe(c, d, l, a, s):
    h = [170, 230, 120][s]
    return f"""<path d="M170 {560 - h} q30 -30 120 -20 l40 {h - 90} q80 10 190 60 q90 40 110 110 l0 30 h-460 z" fill="{c}"/>
<path d="M150 600 h500 q20 0 20 22 v18 q0 18 -20 18 h-480 q-20 0 -20 -18 v-20 z" fill="{a if s != 1 else d}"/>
<path d="M300 {560 - h + 40} l60 160 M330 {560 - h + 30} l70 150 M360 {560 - h + 30} l70 140" stroke="{l}" stroke-width="12" stroke-linecap="round"/>
<path d="M180 {560 - h + 10} q20 -20 90 -14" stroke="{d}" stroke-width="18" fill="none" stroke-linecap="round"/>"""


def shirt(c, d, l, a, s):
    sleeve = [130, 60, 230][s]
    return f"""<path d="M300 170 l-150 70 l40 {sleeve} l70 -20 v330 h280 v-330 l70 20 l40 -{sleeve} l-150 -70 q-50 50 -100 50 q-50 0 -100 -50 z" fill="{c}"/>
<path d="M300 170 q50 70 100 70 q50 0 100 -70" fill="none" stroke="{d}" stroke-width="16"/>
<rect x="260" y="560" width="280" height="16" fill="{d}" opacity=".5"/>
{'<rect x="440" y="300" width="60" height="70" rx="8" fill="' + d + '"/>' if s == 0 else ''}
{'<line x1="400" y1="240" x2="400" y2="620" stroke="' + d + '" stroke-width="8"/>' + ''.join(f'<circle cx="400" cy="{y}" r="9" fill="{a}"/>' for y in (300, 380, 460, 540)) if s == 1 else ''}"""


def pants(c, d, l, a, s):
    flare = [0, 30, -20][s]
    return f"""<path d="M270 160 h260 l{30 + flare} 490 h-120 l-40 -360 l-40 360 h-120 z" fill="{c}"/>
<rect x="270" y="160" width="260" height="50" fill="{d}"/><rect x="390" y="168" width="20" height="34" rx="4" fill="{a}"/>
<path d="M300 220 q20 60 70 60 M500 220 q-20 60 -70 60" fill="none" stroke="{d}" stroke-width="10"/>"""


def jacket(c, d, l, a, s):
    return shirt(c, d, l, a, 2).replace('stroke-width="16"', 'stroke-width="16"') + f"""
<line x1="400" y1="230" x2="400" y2="610" stroke="{a}" stroke-width="10"/>
{'<path d="M320 160 q80 -90 160 0 q-80 40 -160 0z" fill="' + d + '"/>' if s != 1 else ''}
<rect x="300" y="420" width="70" height="12" rx="6" fill="{d}"/><rect x="430" y="420" width="70" height="12" rx="6" fill="{d}"/>"""


def tent(c, d, l, a, s):
    top = [200, 240, 170][s]
    return f"""<path d="M130 620 L400 {top} L670 620 z" fill="{c}"/><path d="M400 {top} L520 620 H280 z" fill="{d}"/>
<path d="M400 {top + 140} L460 620 H340 z" fill="#2b2b2b" opacity=".55"/><line x1="400" y1="{top - 30}" x2="400" y2="{top + 10}" stroke="{a}" stroke-width="10"/>
<line x1="130" y1="620" x2="90" y2="650" stroke="{d}" stroke-width="6"/><line x1="670" y1="620" x2="710" y2="650" stroke="{d}" stroke-width="6"/>"""


def sleeping(c, d, l, a, s):
    return f"""<rect x="{[250, 230, 270][s]}" y="150" width="{[300, 340, 260][s]}" height="500" rx="150" fill="{c}"/>
<ellipse cx="400" cy="240" rx="90" ry="60" fill="{d}"/>{''.join(f'<line x1="270" y1="{y}" x2="530" y2="{y}" stroke="{d}" stroke-width="8" opacity=".6"/>' for y in (340, 420, 500, 580))}
<line x1="{[540, 560, 520][s]}" y1="230" x2="{[540, 560, 520][s]}" y2="600" stroke="{a}" stroke-width="8"/>"""


def bottle(c, d, l, a, s):
    w = [160, 190, 140][s]
    x = 400 - w / 2
    return f"""<rect x="{x}" y="250" width="{w}" height="400" rx="{w / 2.6}" fill="{c}"/><rect x="{x + 22}" y="280" width="26" height="320" rx="13" fill="{l}" opacity=".45"/>
<rect x="{x + 20}" y="190" width="{w - 40}" height="80" rx="20" fill="{a if s != 2 else d}"/><rect x="{400 - 30}" y="150" width="60" height="50" rx="14" fill="{d}"/>
{'<path d="M' + str(400 + 30) + ' 170 q80 -10 60 80" fill="none" stroke="' + d + '" stroke-width="16"/>' if s == 0 else ''}"""


def pan(c, d, l, a, s):
    r = [190, 210, 170][s]
    return f"""<ellipse cx="360" cy="430" rx="{r + 20}" ry="{r * 0.55 + 14}" fill="{d}"/><ellipse cx="360" cy="420" rx="{r}" ry="{r * 0.55}" fill="{c}"/>
<ellipse cx="360" cy="420" rx="{r - 40}" ry="{r * 0.55 - 26}" fill="#2a2a2a" opacity=".75"/>
<rect x="{360 + r + 10}" y="400" width="200" height="38" rx="19" fill="{a if s != 1 else d}" transform="rotate(-8 {360 + r} 420)"/>"""


def appliance(c, d, l, a, s):
    return f"""<rect x="260" y="{[200, 170, 230][s]}" width="280" height="{[420, 450, 390][s]}" rx="50" fill="{c}"/>
<rect x="300" y="{[260, 230, 290][s]}" width="200" height="180" rx="24" fill="#29323a" opacity=".85"/><rect x="300" y="{[260, 230, 290][s]}" width="200" height="60" rx="24" fill="{l}" opacity=".25"/>
<circle cx="350" cy="520" r="26" fill="{a}"/><rect x="400" y="508" width="100" height="24" rx="12" fill="{d}"/>
<rect x="280" y="620" width="240" height="24" rx="10" fill="{d}"/>"""


def phone(c, d, l, a, s):
    w = [210, 230, 190][s]
    return f"""<rect x="{400 - w / 2}" y="140" width="{w}" height="440" rx="38" fill="{c}"/><rect x="{400 - w / 2 + 14}" y="160" width="{w - 28}" height="400" rx="26" fill="#1b2430"/>
<rect x="{400 - w / 2 + 14}" y="160" width="{w - 28}" height="400" rx="26" fill="url(#scr)"/><rect x="370" y="172" width="60" height="12" rx="6" fill="#0b0f14"/>
<rect x="{400 + w / 2 + 40}" y="200" width="{w - 20}" height="380" rx="36" fill="{c}"/><circle cx="{400 + w / 2 + 90}" cy="250" r="26" fill="{d}"/><circle cx="{400 + w / 2 + 90}" cy="310" r="26" fill="{d}"/>
<circle cx="{400 + w / 2 + 90}" cy="250" r="12" fill="#11161c"/><circle cx="{400 + w / 2 + 90}" cy="310" r="12" fill="#11161c"/><circle cx="{400 + w / 2 + 140}" cy="250" r="8" fill="{a}"/>"""


def tablet(c, d, l, a, s):
    return f"""<rect x="170" y="190" width="460" height="{[340, 360, 320][s]}" rx="30" fill="{c}"/><rect x="188" y="208" width="424" height="{[304, 324, 284][s]}" rx="18" fill="url(#scr)"/>
{'<rect x="600" y="230" width="18" height="260" rx="9" fill="' + a + '" transform="rotate(10 600 230)"/>' if s != 2 else ''}"""


def laptop(c, d, l, a, s):
    return f"""<rect x="210" y="200" width="380" height="{[260, 270, 250][s]}" rx="18" fill="{c}"/><rect x="226" y="216" width="348" height="{[228, 238, 218][s]}" rx="8" fill="url(#scr)"/>
<path d="M150 {[480, 490, 470][s]} h500 l30 50 h-560 z" fill="{d}"/><rect x="360" y="{[488, 498, 478][s]}" width="80" height="10" rx="5" fill="{a}"/>"""


def headphones(c, d, l, a, s):
    if s == 2:  # earbuds and case
        return f"""<rect x="250" y="360" width="300" height="220" rx="100" fill="{c}"/><line x1="250" y1="440" x2="550" y2="440" stroke="{d}" stroke-width="8"/>
<circle cx="400" cy="400" r="9" fill="{a}"/><path d="M300 230 q-50 0 -50 50 q0 50 50 50 l20 70 h30 l-10 -80 q30 -20 30 -40 q0 -50 -70 -50z" fill="{c}"/>
<path d="M500 230 q50 0 50 50 q0 50 -50 50 l-20 70 h-30 l10 -80 q-30 -20 -30 -40 q0 -50 70 -50z" fill="{c}"/>"""
    return f"""<path d="M230 420 q0 -230 170 -230 q170 0 170 230" fill="none" stroke="{d}" stroke-width="34" stroke-linecap="round"/>
<rect x="{[180, 170, 180][s]}" y="380" width="{[110, 130, 110][s]}" height="200" rx="50" fill="{c}"/><rect x="{[510, 500, 510][s]}" y="380" width="{[110, 130, 110][s]}" height="200" rx="50" fill="{c}"/>
<rect x="250" y="410" width="40" height="140" rx="20" fill="{d}"/><rect x="510" y="410" width="40" height="140" rx="20" fill="{d}"/><circle cx="235" cy="480" r="12" fill="{a}"/>"""


def speaker(c, d, l, a, s):
    if s == 1:
        return f"""<rect x="260" y="170" width="280" height="460" rx="40" fill="{c}"/><circle cx="400" cy="300" r="70" fill="{d}"/><circle cx="400" cy="300" r="26" fill="{a}"/>
<circle cx="400" cy="490" r="100" fill="{d}"/><circle cx="400" cy="490" r="40" fill="{l}" opacity=".5"/>"""
    return f"""<rect x="170" y="{[330, 0, 300][s]}" width="460" height="{[230, 0, 260][s]}" rx="115" fill="{c}"/>
{''.join(f'<circle cx="{x}" cy="{[445, 0, 430][s]}" r="6" fill="{d}"/>' for x in range(260, 560, 30))}
<rect x="300" y="{[330, 0, 300][s] - 30}" width="200" height="40" rx="20" fill="{a}"/><circle cx="560" cy="{[445, 0, 430][s]}" r="22" fill="{d}"/>"""


def watch(c, d, l, a, s):
    round_ = s != 1
    face = f'<circle cx="400" cy="400" r="130" fill="{d}"/><circle cx="400" cy="400" r="108" fill="#f6f2e8"/>' if round_ else \
        f'<rect x="280" y="280" width="240" height="250" rx="60" fill="{d}"/><rect x="300" y="300" width="200" height="210" rx="44" fill="#141a20"/>'
    hands = f'<line x1="400" y1="400" x2="400" y2="320" stroke="#2b3a42" stroke-width="10" stroke-linecap="round"/><line x1="400" y1="400" x2="460" y2="430" stroke="{a}" stroke-width="8" stroke-linecap="round"/>' if round_ else \
        f'<text x="400" y="420" font-family="Arial" font-size="56" fill="{a}" text-anchor="middle">10:09</text>'
    return f"""<rect x="335" y="110" width="130" height="200" rx="20" fill="{c}"/><rect x="335" y="490" width="130" height="200" rx="20" fill="{c}"/>{face}{hands}
<rect x="{528 if round_ else 516}" y="380" width="22" height="40" rx="6" fill="{d}"/>"""


def monitor(c, d, l, a, s):
    return f"""<rect x="130" y="160" width="540" height="{[320, 340, 300][s]}" rx="16" fill="{mix(c, '#000000', .5)}"/><rect x="146" y="176" width="508" height="{[288, 308, 268][s]}" rx="6" fill="url(#scr)"/>
<rect x="380" y="{[480, 500, 460][s]}" width="40" height="110" fill="{d}"/><rect x="290" y="{[580, 600, 560][s]}" width="220" height="24" rx="12" fill="{c}"/>"""


def camera(c, d, l, a, s):
    return f"""<rect x="190" y="280" width="420" height="270" rx="40" fill="{c}"/><rect x="250" y="240" width="130" height="60" rx="14" fill="{d}"/>
<circle cx="420" cy="420" r="{[110, 120, 95][s]}" fill="{d}"/><circle cx="420" cy="420" r="{[78, 86, 66][s]}" fill="#1a2128"/><circle cx="395" cy="395" r="20" fill="#ffffff" opacity=".35"/>
<circle cx="560" cy="320" r="16" fill="{a}"/><rect x="190" y="340" width="420" height="22" fill="{d}" opacity=".5"/>"""


def chair(c, d, l, a, s):
    if s == 1:  # table / shelf
        return f"""<rect x="200" y="300" width="400" height="40" rx="12" fill="{c}"/><rect x="230" y="340" width="26" height="300" fill="{d}"/><rect x="544" y="340" width="26" height="300" fill="{d}"/>
<rect x="250" y="500" width="300" height="24" rx="8" fill="{c}"/><rect x="300" y="250" width="70" height="50" rx="10" fill="{a}"/>"""
    return f"""<rect x="280" y="{[170, 0, 220][s]}" width="240" height="{[290, 0, 240][s]}" rx="40" fill="{c}"/><rect x="250" y="440" width="300" height="80" rx="30" fill="{c}"/>
<rect x="250" y="440" width="300" height="30" rx="15" fill="{l}" opacity=".3"/><rect x="275" y="520" width="24" height="150" fill="{d}"/><rect x="501" y="520" width="24" height="150" fill="{d}"/>
<rect x="320" y="{[220, 0, 270][s]}" width="160" height="14" rx="7" fill="{a}"/>"""


def lamp(c, d, l, a, s):
    if s == 2:  # headlamp / lantern
        return f"""<rect x="300" y="250" width="200" height="300" rx="50" fill="{c}"/><rect x="330" y="300" width="140" height="190" rx="30" fill="#fff4cf"/>
<path d="M330 250 q70 -100 140 0" fill="none" stroke="{d}" stroke-width="18"/><rect x="300" y="540" width="200" height="40" rx="14" fill="{d}"/><circle cx="400" cy="395" r="30" fill="{a}" opacity=".8"/>"""
    return f"""<path d="M{[290, 270, 290][s]} 200 h{[220, 260, 220][s]} l60 {[200, 170, 200][s]} h-340 z" fill="{c}"/><path d="M290 200 h220 l10 30 h-240z" fill="{l}" opacity=".35"/>
<rect x="390" y="{[400, 370, 400][s]}" width="20" height="200" fill="{d}"/><ellipse cx="400" cy="620" rx="120" ry="28" fill="{d}"/><ellipse cx="400" cy="420" rx="120" ry="16" fill="#fff4cf" opacity=".7"/>
<circle cx="470" cy="610" r="10" fill="{a}"/>"""


def bedding(c, d, l, a, s):
    return f"""<rect x="160" y="{[360, 340, 380][s]}" width="480" height="{[120, 140, 100][s]}" rx="24" fill="{d}"/><rect x="170" y="{[300, 280, 330][s]}" width="460" height="100" rx="24" fill="{c}"/>
<rect x="180" y="{[240, 220, 280][s]}" width="440" height="90" rx="24" fill="{l}"/>{''.join(f'<line x1="200" y1="{y}" x2="600" y2="{y}" stroke="{a}" stroke-width="5" opacity=".7"/>' for y in ([330, 360] if s == 0 else [310] if s == 1 else [350, 365, 380]))}
<rect x="160" y="{[480, 480, 480][s]}" width="480" height="40" rx="14" fill="{mix(c, '#000000', .3)}"/>"""


def book(c, d, l, a, s):
    return f"""<rect x="250" y="140" width="320" height="480" rx="10" fill="{c}"/><rect x="250" y="140" width="40" height="480" rx="8" fill="{d}"/>
<rect x="320" y="{[220, 300, 450][s]}" width="210" height="16" rx="8" fill="{a}"/><rect x="320" y="{[250, 330, 480][s]}" width="160" height="12" rx="6" fill="{l}" opacity=".8"/>
{['<circle cx="430" cy="440" r="70" fill="' + l + '" opacity=".35"/>', '<path d="M320 220 l100 60 l100 -60" fill="none" stroke="' + l + '" stroke-width="10" opacity=".6"/>', '<rect x="330" y="200" width="190" height="190" rx="95" fill="' + d + '" opacity=".6"/>'][s]}
<rect x="566" y="150" width="14" height="460" fill="#f3efe4"/>"""


def toy(c, d, l, a, s):
    if s == 0:  # bricks
        return f"""<rect x="230" y="420" width="340" height="170" rx="14" fill="{c}"/>{''.join(f'<rect x="{x}" y="390" width="56" height="34" rx="10" fill="{c}"/>' for x in (262, 352, 442))}
<rect x="300" y="280" width="220" height="140" rx="14" fill="{a}"/>{''.join(f'<rect x="{x}" y="252" width="50" height="32" rx="10" fill="{a}"/>' for x in (330, 420))}"""
    if s == 1:  # bear
        return f"""<circle cx="400" cy="300" r="120" fill="{c}"/><circle cx="300" cy="200" r="50" fill="{c}"/><circle cx="500" cy="200" r="50" fill="{c}"/><ellipse cx="400" cy="520" rx="150" ry="130" fill="{c}"/>
<ellipse cx="400" cy="340" rx="56" ry="40" fill="{l}"/><circle cx="360" cy="280" r="12" fill="#222"/><circle cx="440" cy="280" r="12" fill="#222"/><circle cx="400" cy="325" r="12" fill="#222"/>
<ellipse cx="400" cy="540" rx="80" ry="70" fill="{l}" opacity=".6"/><path d="M350 420 h100 l-50 40z" fill="{a}"/>"""
    return f"""<rect x="300" y="230" width="200" height="170" rx="30" fill="{c}"/><rect x="280" y="400" width="240" height="190" rx="30" fill="{d}"/>
<circle cx="360" cy="310" r="24" fill="{a}"/><circle cx="440" cy="310" r="24" fill="{a}"/><line x1="400" y1="230" x2="400" y2="180" stroke="{d}" stroke-width="10"/><circle cx="400" cy="172" r="16" fill="{a}"/>
<rect x="330" y="450" width="140" height="18" rx="9" fill="{l}"/>"""


def boardgame(c, d, l, a, s):
    return f"""<path d="M180 330 l220 -110 l220 110 l-220 110 z" fill="{l}"/><path d="M180 330 v150 l220 110 v-150 z" fill="{c}"/><path d="M620 330 v150 l-220 110 v-150 z" fill="{d}"/>
<circle cx="{[400, 360, 430][s]}" cy="320" r="34" fill="{a}"/><rect x="290" y="440" width="70" height="70" rx="12" fill="#ffffff" opacity=".85" transform="rotate(26 325 475)"/>"""


def dumbbell(c, d, l, a, s):
    if s == 1:  # yoga mat
        return f"""<rect x="170" y="280" width="420" height="230" rx="20" fill="{c}"/><circle cx="590" cy="395" r="115" fill="{d}"/><circle cx="590" cy="395" r="70" fill="{c}"/>
<rect x="200" y="300" width="360" height="14" rx="7" fill="{l}" opacity=".5"/>"""
    if s == 2:  # kettlebell
        return f"""<path d="M310 330 q0 -150 90 -150 q90 0 90 150" fill="none" stroke="{d}" stroke-width="44"/><circle cx="400" cy="460" r="170" fill="{c}"/>
<ellipse cx="350" cy="420" rx="40" ry="60" fill="{l}" opacity=".3"/><rect x="340" y="520" width="120" height="40" rx="12" fill="{a}"/>"""
    return f"""<rect x="250" y="380" width="300" height="40" rx="18" fill="#8d959c"/>{''.join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{c}"/>' for x, y, w, h in ((160, 290, 60, 220), (220, 320, 40, 160), (580, 290, 60, 220), (540, 320, 40, 160)))}
<rect x="180" y="300" width="20" height="200" rx="10" fill="{a}" opacity=".7"/>"""


def ball(c, d, l, a, s):
    seams = [f'<path d="M230 400 q170 -80 340 0 M230 400 q170 80 340 0" fill="none" stroke="{d}" stroke-width="10"/><line x1="400" y1="230" x2="400" y2="570" stroke="{d}" stroke-width="10"/>',
             f'<polygon points="400,330 470,380 445,460 355,460 330,380" fill="{d}"/>' + ''.join(f'<line x1="{400 + 70 * x}" y1="{400 + 70 * y}" x2="{400 + 160 * x}" y2="{400 + 160 * y}" stroke="{d}" stroke-width="8"/>' for x, y in ((0, -1), (0.95, -0.3), (0.6, 0.8), (-0.6, 0.8), (-0.95, -0.3))),
             f'<path d="M240 330 q160 120 320 0 M240 470 q160 -120 320 0" fill="none" stroke="{a}" stroke-width="12"/>'][s]
    return f"""<circle cx="400" cy="400" r="170" fill="{c}"/>{seams}<circle cx="340" cy="330" r="40" fill="#ffffff" opacity=".25"/>"""


def jar(c, d, l, a, s):
    if s == 1:  # tube
        return f"""<path d="M320 170 h160 l-20 380 h-120 z" fill="{c}"/><rect x="330" y="150" width="140" height="30" rx="6" fill="{d}"/><rect x="350" y="550" width="100" height="80" rx="16" fill="{a}"/>
<rect x="350" y="280" width="100" height="14" rx="7" fill="{l}"/><rect x="360" y="310" width="80" height="10" rx="5" fill="{l}" opacity=".7"/>"""
    if s == 2:  # pump bottle
        return f"""<rect x="300" y="300" width="200" height="330" rx="40" fill="{c}"/><rect x="370" y="210" width="60" height="100" fill="{d}"/><rect x="330" y="190" width="140" height="30" rx="10" fill="{d}"/>
<rect x="420" y="160" width="90" height="26" rx="10" fill="{d}"/><rect x="330" y="420" width="140" height="100" rx="12" fill="{l}" opacity=".8"/><rect x="350" y="450" width="100" height="12" rx="6" fill="{a}"/>"""
    return f"""<rect x="250" y="340" width="300" height="240" rx="40" fill="{c}"/><rect x="240" y="270" width="320" height="90" rx="24" fill="{a}"/>
<rect x="290" y="420" width="220" height="90" rx="12" fill="{l}" opacity=".85"/><rect x="320" y="450" width="160" height="12" rx="6" fill="{d}"/>"""


def drill(c, d, l, a, s):
    if s == 1:  # hammer / hand tool
        return f"""<rect x="390" y="300" width="40" height="340" rx="16" fill="{c}" transform="rotate(-20 410 470)"/><rect x="250" y="210" width="260" height="90" rx="14" fill="#7d868d" transform="rotate(-20 380 255)"/>
<rect x="395" y="520" width="40" height="120" rx="16" fill="{a}" transform="rotate(-20 410 580)"/>"""
    if s == 2:  # pruning shears / multitool
        return f"""<path d="M300 220 l180 220 l-30 30 l-190 -220z" fill="#8d959c"/><path d="M500 220 l-180 220 l30 30 l190 -220z" fill="#a7afb5"/>
<rect x="250" y="450" width="70" height="220" rx="34" fill="{c}" transform="rotate(25 285 560)"/><rect x="480" y="450" width="70" height="220" rx="34" fill="{c}" transform="rotate(-25 515 560)"/><circle cx="400" cy="345" r="16" fill="{a}"/>"""
    return f"""<rect x="230" y="250" width="320" height="140" rx="50" fill="{c}"/><rect x="550" y="300" width="110" height="36" rx="8" fill="#8d959c"/><rect x="650" y="310" width="70" height="16" fill="#5d666d"/>
<rect x="330" y="370" width="100" height="220" rx="30" fill="{d}"/><rect x="300" y="580" width="170" height="70" rx="20" fill="{a}"/><rect x="250" y="270" width="80" height="20" rx="10" fill="{l}" opacity=".4"/>"""


def planter(c, d, l, a, s):
    leaves = ''.join(f'<ellipse cx="{400 + dx}" cy="{230 + dy}" rx="40" ry="100" fill="#4f8a5b" transform="rotate({rot} {400 + dx} {230 + dy})"/>' for dx, dy, rot in ((-70, 40, -30), (0, 0, 0), (70, 40, 30), (-30, 80, -12), (40, 70, 15)))
    return f"""{leaves}<path d="M{[250, 230, 270][s]} 360 h{[300, 340, 260][s]} l-{[40, 20, 50][s]} 280 h-{[220, 300, 160][s]} z" fill="{c}"/><rect x="{[240, 220, 260][s]}" y="340" width="{[320, 360, 280][s]}" height="50" rx="12" fill="{d}"/>
<rect x="300" y="460" width="200" height="14" rx="7" fill="{a}" opacity=".7"/>"""


def petbowl(c, d, l, a, s):
    if s == 1:  # pet bed
        return f"""<ellipse cx="400" cy="460" rx="270" ry="150" fill="{c}"/><ellipse cx="400" cy="440" rx="190" ry="90" fill="{l}"/><ellipse cx="400" cy="450" rx="170" ry="70" fill="{d}" opacity=".35"/>
<circle cx="610" cy="360" r="14" fill="{a}"/>"""
    if s == 2:  # leash
        return f"""<path d="M250 600 q-40 -300 150 -380 q190 -80 220 160" fill="none" stroke="{c}" stroke-width="36" stroke-linecap="round"/>
<circle cx="620" cy="400" r="40" fill="none" stroke="#8d959c" stroke-width="16"/><rect x="220" y="560" width="70" height="110" rx="30" fill="{d}"/><circle cx="400" cy="220" r="14" fill="{a}"/>"""
    return f"""<path d="M180 420 h440 l-50 170 h-340 z" fill="{c}"/><ellipse cx="400" cy="420" rx="220" ry="46" fill="{d}"/><ellipse cx="400" cy="420" rx="180" ry="30" fill="#c99a5b"/>
<path d="M360 500 a14 14 0 1 1 28 0 a14 14 0 1 1 -28 0 M405 500 a14 14 0 1 1 28 0" fill="{a}"/>"""


def notebook(c, d, l, a, s):
    if s == 1:  # pens
        return ''.join(f'<rect x="{x}" y="200" width="44" height="400" rx="20" fill="{col}" transform="rotate({rot} {x + 22} 400)"/><path d="M{x} 600 h44 l-22 50z" fill="#3b3b3b" transform="rotate({rot} {x + 22} 400)"/>'
                       for x, col, rot in ((300, c, -12), (378, a, 0), (456, d, 12)))
    return f"""<rect x="240" y="150" width="320" height="460" rx="18" fill="{c}"/><rect x="240" y="150" width="320" height="460" rx="18" fill="none" stroke="{d}" stroke-width="10"/>
{''.join(f'<circle cx="262" cy="{y}" r="9" fill="#e8e3d6"/>' for y in range(190, 600, 44)) if s == 0 else f'<rect x="520" y="150" width="20" height="460" fill="{a}"/>'}
<rect x="320" y="230" width="170" height="60" rx="8" fill="{l}" opacity=".85"/>"""


def stroller(c, d, l, a, s):
    return f"""<path d="M230 260 q0 -110 170 -110 v240 h-170 z" fill="{c}"/><path d="M230 390 h330 q20 140 -150 160 h-60 q-120 -20 -120 -160z" fill="{d}"/>
<line x1="560" y1="390" x2="640" y2="230" stroke="#5d666d" stroke-width="14"/><circle cx="300" cy="610" r="44" fill="#2b2f33"/><circle cx="510" cy="610" r="44" fill="#2b2f33"/>
<circle cx="300" cy="610" r="16" fill="{a}"/><circle cx="510" cy="610" r="16" fill="{a}"/>"""


def auto(c, d, l, a, s):
    if s == 1:  # power bank / charger
        return f"""<rect x="270" y="190" width="260" height="420" rx="40" fill="{c}"/><rect x="300" y="230" width="200" height="120" rx="16" fill="{d}"/>
{''.join(f'<rect x="{x}" y="270" width="22" height="40" rx="5" fill="{a}"/>' for x in (330, 365, 400, 435))}<rect x="370" y="560" width="60" height="18" rx="6" fill="#1b1f23"/>"""
    if s == 2:  # mount
        return f"""<rect x="280" y="180" width="240" height="360" rx="30" fill="#1f262d"/><rect x="250" y="250" width="40" height="200" rx="12" fill="{c}"/><rect x="510" y="250" width="40" height="200" rx="12" fill="{c}"/>
<rect x="370" y="540" width="60" height="100" fill="{d}"/><ellipse cx="400" cy="650" rx="90" ry="24" fill="{c}"/><circle cx="400" cy="560" r="12" fill="{a}"/>"""
    return f"""<rect x="210" y="300" width="380" height="250" rx="30" fill="{c}"/><rect x="210" y="300" width="380" height="70" rx="30" fill="{d}"/><rect x="340" y="260" width="120" height="50" rx="16" fill="{d}"/>
<rect x="260" y="420" width="120" height="80" rx="10" fill="{l}" opacity=".6"/><rect x="420" y="420" width="120" height="80" rx="10" fill="{l}" opacity=".6"/><rect x="380" y="320" width="40" height="16" rx="8" fill="{a}"/>"""


def suitcase(c, d, l, a, s):
    w = [300, 340, 260][s]
    x = 400 - w / 2
    return f"""<rect x="350" y="120" width="100" height="90" rx="20" fill="none" stroke="#5d666d" stroke-width="18"/><rect x="{x}" y="200" width="{w}" height="420" rx="40" fill="{c}"/>
{''.join(f'<rect x="{x + 40 + i * (w - 80) / 3}" y="230" width="14" height="360" rx="7" fill="{d}"/>' for i in range(4)) if s != 2 else f'<rect x="{x + 20}" y="300" width="{w - 40}" height="160" rx="20" fill="{d}"/>'}
<circle cx="{x + 50}" cy="640" r="22" fill="#2b2f33"/><circle cx="{x + w - 50}" cy="640" r="22" fill="#2b2f33"/><rect x="{x + w - 70}" y="240" width="40" height="40" rx="8" fill="{a}"/>"""


def guitar(c, d, l, a, s):
    if s == 1:  # keyboard
        return f"""<rect x="130" y="320" width="540" height="190" rx="20" fill="{c}"/>{''.join(f'<rect x="{x}" y="400" width="34" height="96" rx="4" fill="#fbfaf6"/>' for x in range(150, 650, 38))}
{''.join(f'<rect x="{x + 24}" y="400" width="22" height="56" rx="3" fill="#1d2126"/>' for i, x in enumerate(range(150, 610, 38)) if i % 7 not in (2, 6))}<rect x="160" y="340" width="120" height="40" rx="8" fill="{d}"/><circle cx="620" cy="360" r="16" fill="{a}"/>"""
    return f"""<rect x="390" y="110" width="30" height="330" fill="#6b4a32"/><rect x="375" y="80" width="60" height="70" rx="12" fill="#3b2a1e"/>
<path d="M405 380 c-120 0 -150 80 -110 140 c-70 40 -60 170 110 170 c170 0 180 -130 110 -170 c40 -60 10 -140 -110 -140z" fill="{c}"/>
<circle cx="405" cy="{[500, 0, 520][s]}" r="44" fill="#2a1d14"/><rect x="355" y="600" width="100" height="18" rx="6" fill="{d}"/><rect x="398" y="150" width="14" height="460" fill="{a}" opacity=".6"/>"""


def pillbox(c, d, l, a, s):
    if s == 1:  # first aid kit
        return f"""<rect x="200" y="260" width="400" height="320" rx="34" fill="{c}"/><rect x="340" y="220" width="120" height="50" rx="16" fill="none" stroke="{d}" stroke-width="18"/>
<rect x="370" y="340" width="60" height="160" rx="8" fill="#ffffff"/><rect x="320" y="390" width="160" height="60" rx="8" fill="#ffffff"/>"""
    if s == 2:  # massage gun
        return f"""<rect x="220" y="260" width="300" height="130" rx="60" fill="{c}"/><circle cx="560" cy="325" r="54" fill="{d}"/><rect x="330" y="380" width="90" height="270" rx="30" fill="{d}"/>
<rect x="340" y="410" width="70" height="20" rx="10" fill="{a}"/>"""
    return f"""<rect x="180" y="320" width="440" height="200" rx="30" fill="{c}"/>{''.join(f'<rect x="{x}" y="300" width="96" height="60" rx="14" fill="{a if i % 2 else d}"/>' for i, x in enumerate((200, 302, 404, 506)))}
<rect x="210" y="400" width="380" height="16" rx="8" fill="{l}" opacity=".5"/>"""


def ring(c, d, l, a, s):
    if s == 1:  # necklace
        return f"""<path d="M250 180 q0 330 150 330 q150 0 150 -330" fill="none" stroke="{'#c9a64a' if lum(c) > .5 else '#b8bcc0'}" stroke-width="10"/>
<path d="M400 510 l50 70 l-50 70 l-50 -70z" fill="{c}"/><circle cx="400" cy="580" r="18" fill="#ffffff" opacity=".5"/>"""
    if s == 2:  # bracelet / earrings
        return f"""<circle cx="320" cy="420" r="110" fill="none" stroke="{c}" stroke-width="30"/><circle cx="500" cy="420" r="110" fill="none" stroke="{d}" stroke-width="18"/>
<circle cx="320" cy="310" r="16" fill="{a}"/>"""
    return f"""<ellipse cx="400" cy="460" rx="170" ry="150" fill="none" stroke="{'#c9a64a' if s == 0 else '#b8bcc0'}" stroke-width="34"/>
<path d="M400 230 l60 70 l-60 50 l-60 -50z" fill="{c}"/><path d="M400 230 l60 70 h-120z" fill="#ffffff" opacity=".4"/>"""


def mug(c, d, l, a, s):
    w = [240, 220, 200][s]
    x = 400 - w / 2 - 30
    return f"""<path d="M{x + w} 330 q120 0 120 100 q0 100 -120 100" fill="none" stroke="{d}" stroke-width="34"/><rect x="{x}" y="260" width="{w}" height="{[330, 360, 300][s]}" rx="40" fill="{c}"/>
<ellipse cx="{x + w / 2}" cy="270" rx="{w / 2 - 6}" ry="24" fill="{d}"/><rect x="{x + 30}" y="380" width="{w - 60}" height="16" rx="8" fill="{a}"/>
{'<path d="M' + str(x + 60) + ' 230 q20 -40 0 -80 M' + str(x + 120) + ' 230 q20 -40 0 -80" stroke="#c8c2b5" stroke-width="10" fill="none" stroke-linecap="round"/>' if s == 0 else ''}"""


def box(c, d, l, a, s):
    if s == 1:  # basket
        return f"""<path d="M200 330 h400 l-40 300 h-320 z" fill="{c}"/>{''.join(f'<line x1="{x}" y1="340" x2="{x - 10 if x < 400 else x + 10}" y2="620" stroke="{d}" stroke-width="10"/>' for x in range(250, 590, 50))}
{''.join(f'<line x1="215" y1="{y}" x2="585" y2="{y}" stroke="{l}" stroke-width="8" opacity=".6"/>' for y in (400, 480, 560))}<path d="M300 330 q100 -120 200 0" fill="none" stroke="{a}" stroke-width="18"/>"""
    return f"""<rect x="200" y="300" width="400" height="300" rx="20" fill="{c}"/><rect x="186" y="260" width="428" height="70" rx="18" fill="{d}"/>
<rect x="360" y="380" width="80" height="34" rx="10" fill="{a}"/>{'<rect x="200" y="460" width="400" height="10" fill="' + d + '" opacity=".6"/>' if s == 2 else ''}"""


SHAPES = {f.__name__: f for f in (pack, shoe, shirt, pants, jacket, tent, sleeping, bottle, pan, appliance, phone, tablet, laptop, headphones, speaker, watch,
                                  monitor, camera, chair, lamp, bedding, book, toy, boardgame, dumbbell, ball, jar, drill, planter, petbowl, notebook,
                                  stroller, auto, suitcase, guitar, pillbox, ring, mug, box)}


def draw(shape, style, color):
    c = COLORS[color]
    d = mix(c, "#000000", 0.28)
    l = mix(c, "#ffffff", 0.45)
    a = ACCENTS[style]
    if lum(a) > 0.8 and lum(c) > 0.75:
        a = "#2b3a42"
    b0, b1 = BACKS[style]
    body = SHAPES[shape](c, d, l, a, style)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
<defs><radialGradient id="bg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="{b0}"/><stop offset="1" stop-color="{b1}"/></radialGradient>
<linearGradient id="scr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2e5a6b"/><stop offset=".55" stop-color="#1d3a4a"/><stop offset="1" stop-color="#e9a23b" stop-opacity=".55"/></linearGradient></defs>
<rect width="800" height="800" fill="url(#bg)"/><ellipse cx="400" cy="690" rx="270" ry="34" fill="#000" opacity=".08"/>
{body}
</svg>"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    keys = set()
    prods = {}
    for line in open(ROOT / "build/catalog/products.jsonl"):
        p = json.loads(line)
        prods[p["id"]] = p
        for col in p["colors"] or ["Slate Grey"]:
            keys.add((p["shape"], p["style"], col))
        if not p["colors"]:
            keys.add((p["shape"], p["style"], "Slate Grey"))
    for shape, style, col in sorted(keys):
        (OUT / f"{shape}-{style}-{slug(col)}.svg").write_text(draw(shape, style, col))
    print(f"{len(keys)} images in {OUT}")


if __name__ == "__main__":
    main()

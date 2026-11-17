"""Сборка ролика «QrStars — что умеет» для главной qrstars.ru.

Генерирует index.html и compositions/vNN-*.html из:
  assets/vo/vNN.mp3        — озвучка (Voicebox, профиль Deva1, scripts/vo.py)
  capture/words/vNN.json   — тайминги слов (hyperframes transcribe)
Запуск: python3 scripts/build.py (из корня проекта)
"""
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
os.makedirs("compositions", exist_ok=True)

GAP = 0.55
LEAD = 0.35
FIRST_VO = 0.6
END_HOLD = 3.6
EXTRA = {"v01": 0.3, "v03": 0.9, "v04": 0.3, "v05": 0.6, "v07": 0.2, "v08": 0.6}

ACCENT = "#4F46E5"
INK = "#0F172A"
GROUND = "#EEF1F6"
SFX = []  # (abs_time, file, volume)


def dur(path):
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).decode())


def norm(s):
    return re.sub(r"[^\wё]", "", s.lower().replace("ё", "е"))


VO_IDS = [f"v{i:02d}" for i in range(1, 10)]
VO_DUR = {s: dur(f"assets/vo/{s}.mp3") for s in VO_IDS}
VO_START = {}
t = FIRST_VO
for s in VO_IDS:
    VO_START[s] = t
    t += VO_DUR[s] + GAP + EXTRA.get(s, 0)
SCENE_START = {s: (0.0 if s == "v01" else round(VO_START[s] - LEAD, 3)) for s in VO_IDS}
TOTAL = round(VO_START["v09"] + VO_DUR["v09"] + END_HOLD, 3)
SCENE_DUR = {}
for i, s in enumerate(VO_IDS):
    nxt = SCENE_START[VO_IDS[i + 1]] if i + 1 < len(VO_IDS) else TOTAL
    SCENE_DUR[s] = round(nxt - SCENE_START[s], 3)


class Words:
    """Время слова относительно начала сцены."""

    def __init__(self, sid):
        self.sid = sid
        self.w = json.load(open(f"capture/words/{sid}.json"))
        self.off = VO_START[sid] - SCENE_START[sid]

    def __call__(self, text, n=0, end=False):
        key = norm(text)
        hits = [w for w in self.w if key in norm(w["text"])]
        if not hits and len(key) >= 5:
            stem = key[: max(4, len(key) - 3)]
            hits = [w for w in self.w if stem in norm(w["text"])]
        if len(hits) <= n:
            raise KeyError(f"{self.sid}: word {text!r} #{n} not found")
        return round(self.off + (hits[n]["end"] if end else hits[n]["start"]), 3)


def sfx(sid, local_t, f, vol):
    SFX.append((round(SCENE_START[sid] + local_t, 3), f, vol))


BASE_CSS = f"""
  #root {{ position:absolute; inset:0; overflow:hidden; background:{GROUND};
          font-family:Inter, sans-serif; color:{INK}; }}
  #root * {{ box-sizing:border-box; }}
  .kick {{ position:absolute; left:120px; top:250px; font-weight:700; font-size:28px; letter-spacing:0.08em;
           text-transform:uppercase; color:{ACCENT}; opacity:0; }}
  .title {{ position:absolute; left:120px; top:298px; width:640px; font-weight:800; font-size:76px; line-height:1.02;
            letter-spacing:-0.035em; opacity:0; }}
  .title em {{ font-style:normal; color:{ACCENT}; }}
  .cap {{ position:absolute; left:120px; width:600px; font-weight:500; font-size:34px; line-height:1.3; color:#475569; opacity:0; }}
  .card {{ position:absolute; background:#fff; border-radius:28px; overflow:hidden; isolation:isolate;
           box-shadow:0 30px 70px rgba(15,23,42,.16), 0 4px 14px rgba(15,23,42,.06); }}
  .card img {{ position:absolute; display:block; object-fit:contain; }}
  .chip {{ position:absolute; height:58px; padding:0 26px; border-radius:29px; background:#fff; font-weight:700; font-size:28px;
           line-height:58px; color:{INK}; white-space:nowrap; box-shadow:0 12px 30px rgba(15,23,42,.12); opacity:0; }}
  .chip.acc {{ background:{ACCENT}; color:#fff; }}
  .phone {{ position:absolute; width:404px; height:846px; border-radius:56px; background:#0B1220; padding:12px;
           box-shadow:0 50px 100px rgba(15,23,42,.30), 0 8px 24px rgba(15,23,42,.16); }}
  .screen {{ position:absolute; left:12px; top:12px; width:380px; height:822px; border-radius:44px; overflow:hidden; background:#EEF0FF; }}
  .mshot {{ position:absolute; left:0; top:0; width:380px; height:822px; }}
  .notch {{ position:absolute; left:142px; top:22px; width:120px; height:30px; border-radius:15px; background:#0B1220; z-index:5; }}
  .mhl {{ position:absolute; border:4px solid #F59E0B; border-radius:16px; opacity:0; box-shadow:0 0 0 4px rgba(245,158,11,.25); }}
  .tg {{ position:absolute; width:500px; border-radius:24px; background:#fff; padding:26px 28px 28px 98px; opacity:0;
         box-shadow:0 30px 70px rgba(15,23,42,.20), 0 4px 14px rgba(15,23,42,.06); }}
  .tg .ava {{ position:absolute; left:26px; top:26px; width:54px; height:54px; border-radius:27px; background:#2AABEE; }}
  .tg .ava svg {{ position:absolute; left:13px; top:15px; width:28px; height:26px; }}
  .tg .from {{ font-weight:700; font-size:22px; color:#2AABEE; }}
  .tg .head {{ margin-top:6px; font-weight:800; font-size:27px; line-height:1.2; }}
  .tg .body {{ margin-top:10px; font-weight:500; font-size:23px; line-height:1.35; color:#334155; }}
  .tg .meta {{ margin-top:12px; font-weight:500; font-size:19px; color:#94A3B8; }}
  .tap {{ position:absolute; width:56px; height:56px; border-radius:28px; background:rgba(79,70,229,.28);
          border:3px solid rgba(79,70,229,.7); opacity:0; }}
"""

PLANE = ('<svg viewBox="0 0 28 26"><path d="M1 12 L26 1 L21 25 L13 18 L22 7 L10 16 L1 12 Z" fill="#fff"/></svg>')


def tg_card(cid, head, body, meta, left, top, z=6):
    return (f'<div id="{cid}" class="tg" data-layout-ignore style="left:{left}px; top:{top}px; z-index:{z}">'
            f'<div class="ava">{PLANE}</div><div class="from">@QrStarsBot</div>'
            f'<div class="head">{head}</div><div class="body">{body}</div><div class="meta">{meta}</div></div>')


def scene_file(sid, slug, body, css, js):
    d = SCENE_DUR[sid]
    html = f"""<template id="{sid}-template">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
{BASE_CSS}
{css}
</style>
<div id="root" data-composition-id="{sid}" data-start="0" data-duration="{d}" data-width="1920" data-height="1080">
{body}
</div>
<script>
  window.__timelines = window.__timelines || {{}};
  const tl = gsap.timeline({{ paused: true }});
{js}
  window.__timelines["{sid}"] = tl;
</script>
</template>
"""
    path = f"compositions/{sid}-{slug}.html"
    open(path, "w").write(html)
    return path


def head_js(sid, t0=0.05, cap_t=None):
    """Появление кикера, заголовка и подписи; уход в конце сцены."""
    d = SCENE_DUR[sid]
    js = [
        f'  tl.fromTo("#{sid}-k", {{opacity:0, y:16}}, {{opacity:1, y:0, duration:0.5, ease:"expo.out"}}, {t0});',
        f'  tl.fromTo("#{sid}-t", {{opacity:0, y:28, filter:"blur(8px)"}}, {{opacity:1, y:0, filter:"blur(0px)", duration:0.7, ease:"expo.out"}}, {t0 + 0.08});',
    ]
    if cap_t is not None:
        js.append(f'  tl.fromTo("#{sid}-c", {{opacity:0, y:16}}, {{opacity:1, y:0, duration:0.5, ease:"expo.out"}}, {cap_t});')
    js.append(f'  tl.to("#{sid}-out", {{opacity:0, y:-24, duration:0.32, ease:"power3.in"}}, {round(d - 0.36, 3)});')
    return "\n".join(js)


def head_html(sid, kick, title, cap=None, cap_top=560):
    c = f'<div id="{sid}-c" class="cap" style="top:{cap_top}px">{cap}</div>' if cap else ""
    return (f'<div id="{sid}-out" style="position:absolute; inset:0">'
            f'<div id="{sid}-k" class="kick">{kick}</div><div id="{sid}-t" class="title">{title}</div>{c}')


SCENES = []

# ------------------------------------------------------------------ v01 hook
sid = "v01"
W = Words(sid)
tiles = [("art-heart", 150, 120, -8), ("food-coffee", 1560, 110, 7), ("beauty-salon", 210, 700, 6),
         ("art-cat", 1520, 690, -6), ("med-vet", 760, 60, 4), ("auto-taxi", 1000, 820, -4)]
body = '<div id="v01-out" style="position:absolute; inset:0">'
css = """
  .tile { width:230px; height:230px; opacity:0; }
  .tile img { left:18px; top:18px; width:194px; height:194px; }
  .logo { position:absolute; left:560px; top:330px; width:800px; height:auto; }
  .sub { position:absolute; left:0; width:1920px; top:590px; text-align:center; font-weight:700; font-size:58px;
         letter-spacing:-0.03em; color:#334155; opacity:0; }
"""
js = []
for i, (img, x, y, rot) in enumerate(tiles):
    body += f'<div id="v01-q{i}" class="card tile" style="left:{x}px; top:{y}px"><img src="assets/qr/{img}.webp" alt=""></div>'
    tt = round(0.15 + i * 0.12, 3)
    js.append(f'  tl.fromTo("#v01-q{i}", {{opacity:0, scale:0.6, rotation:{rot * 2}, y:40}}, '
              f'{{opacity:1, scale:1, rotation:{rot}, y:0, duration:0.8, ease:"back.out(1.6)"}}, {tt});')
    js.append(f'  tl.to("#v01-q{i}", {{y:{-14 if i % 2 else 14}, duration:{round(SCENE_DUR[sid] - tt - 1.2, 2)}, ease:"sine.inOut"}}, {tt + 0.8});')
    if i % 2 == 0:
        sfx(sid, tt + 0.05, "pop.mp3", 0.22)
body += '<img id="v01-logo" class="logo" src="assets/logo.svg" alt="QrStars">'
body += '<div id="v01-sub" class="sub">Умные QR-коды для бизнеса</div></div>'
js.append(f'  tl.fromTo("#v01-logo", {{opacity:1, scale:0.94}}, {{opacity:1, scale:1, duration:1.4, ease:"expo.out"}}, 0);')
js.append(f'  tl.fromTo("#v01-sub", {{opacity:0, y:20}}, {{opacity:1, y:0, duration:0.6, ease:"expo.out"}}, {W("умные")});')
js.append(f'  tl.to("#v01-out", {{opacity:0, scale:1.04, duration:0.35, ease:"power3.in"}}, {round(SCENE_DUR[sid] - 0.38, 3)});')
sfx(sid, W("Stars") - 0.3, "sparkle.mp3", 0.25)
SCENES.append((sid, scene_file(sid, "hook", body, css, "\n".join(js))))

# ------------------------------------------------------------------ v02 beautiful
sid = "v02"
W = Words(sid)
grid = ["art-heart", "art-cat", "art-liquid", "food-coffee",
        "art-diamond", "beauty-salon", "master-handyman", "med-clinic",
        "art-cloud", "auto-taxi", "med-vet", "art-print"]
css = f"""
  .g {{ width:232px; height:232px; opacity:0; }}
  .g img {{ left:16px; top:16px; width:200px; height:200px; }}
  .ok {{ position:absolute; left:50%; bottom:10px; transform:translateX(-50%); }}
  .okp {{ height:34px; padding:0 14px 0 12px; border-radius:17px; background:#DCFCE7; color:#15803D; font-weight:700;
          font-size:17px; line-height:34px; white-space:nowrap; opacity:0; }}
  .ring {{ position:absolute; border:5px solid {ACCENT}; border-radius:32px; opacity:0; }}
"""
body = head_html(sid, "Красивые QR", "Больше <em>30</em> арт-стилей",
                 "Фигуры, цвета, логотип или фото в центре. Каждый код проверяем на сканирование.", 520)
js = [head_js(sid, cap_t=W("арт") - 0.1)]
GX, GY, GS, GG = 818, 150, 232, 26
body += '<div id="v02-grid" style="position:absolute; inset:0; transform-origin:1320px 520px">'
for i, img in enumerate(grid):
    x = GX + (i % 4) * (GS + GG)
    y = GY + (i // 4) * (GS + GG)
    body += (f'<div id="v02-g{i}" class="card g" style="left:{x}px; top:{y}px"><img src="assets/qr/{img}.webp" alt="">'
             f'<div class="ok"><div id="v02-ok{i}" class="okp" data-layout-ignore>✓ сканируется</div></div></div>')
    tt = round(0.25 + (i % 4) * 0.07 + (i // 4) * 0.12, 3)
    js.append(f'  tl.fromTo("#v02-g{i}", {{opacity:0, y:50, scale:0.85}}, {{opacity:1, y:0, scale:1, duration:0.7, ease:"back.out(1.5)"}}, {tt});')
for k, (word, idx) in enumerate([("сердце", 0), ("кот", 1), ("капля", 2), ("логотип", 3)]):
    tw = W(word)
    x = GX + (idx % 4) * (GS + GG) - 10
    y = GY + (idx // 4) * (GS + GG) - 10
    body += f'<div id="v02-r{k}" class="ring" style="left:{x}px; top:{y}px; width:{GS + 20}px; height:{GS + 20}px"></div>'
    js.append(f'  tl.fromTo("#v02-r{k}", {{opacity:0, scale:1.08}}, {{opacity:1, scale:1, duration:0.3, ease:"expo.out"}}, {tw});')
    js.append(f'  tl.to("#v02-r{k}", {{opacity:0, duration:0.25}}, {round(tw + 0.55, 3)});')
    js.append(f'  tl.to("#v02-g{idx}", {{scale:1.06, duration:0.3, ease:"expo.out", yoyo:true, repeat:1}}, {tw});')
    sfx(sid, tw, "click-soft.mp3", 0.35)
body += ""
js.append(f'  tl.fromTo("#v02-grid", {{scale:1}}, {{scale:1.035, duration:{round(SCENE_DUR[sid] - 0.8, 2)}, ease:"sine.inOut"}}, 0.4);')
tc = W("проверяем")
for i in range(12):
    tt = round(tc + 0.1 + i * 0.07, 3)
    js.append(f'  tl.fromTo("#v02-ok{i}", {{opacity:0, y:10}}, {{opacity:1, y:0, duration:0.35, ease:"back.out(2)"}}, {tt});')
sfx(sid, tc + 0.1, "sparkle.mp3", 0.3)
body += "</div></div>"
SCENES.append((sid, scene_file(sid, "beauty", body, css, "\n".join(js))))

# ------------------------------------------------------------------ v03 animation / 3D / STL
sid = "v03"
W = Words(sid)
css = f"""
  .stage {{ position:absolute; left:930px; top:150px; width:760px; height:760px; perspective:1600px; }}
  .big {{ left:80px; top:80px; width:600px; height:600px; }}
  .big img {{ left:40px; top:40px; width:520px; height:520px; }}
  .shine {{ position:absolute; left:-260px; top:-200px; width:180px; height:1000px; mix-blend-mode:screen;
            background:linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.95), rgba(255,255,255,0)); }}
  .shrot {{ position:absolute; inset:0; transform:rotate(20deg); }}
  .print {{ position:absolute; left:130px; top:120px; width:500px; height:500px; transform-style:preserve-3d; opacity:0; }}
  .lay {{ position:absolute; left:0; top:0; width:500px; height:500px; }}
  .lay img {{ position:absolute; left:40px; top:40px; width:420px; height:420px; }}
  .plate {{ position:absolute; left:0; top:0; width:500px; height:500px; border-radius:26px; }}
  .lbl {{ position:absolute; left:930px; width:760px; top:900px; text-align:center; font-weight:700; font-size:30px; color:#334155; opacity:0; }}
"""
body = head_html(sid, "Анимация и 3D", "Код, который <em>двигается</em>")
chips = [("блик", "Блик"), ("перелив", "Перелив"), ("сердцебиение", "Сердцебиение"), ("поворот", "3D-поворот"),
         ("гиф", "GIF для соцсетей"), ("принтера", "STL для 3D-печати")]
js = [head_js(sid)]
for i, (word, label) in enumerate(chips):
    y = 520 + (i // 2) * 84
    x = 120 + (i % 2) * 300
    acc = " acc" if i >= 4 else ""
    if i >= 4:
        x, y = 120, 520 + 2 * 84 + (i - 3) * 84
    body += f'<div id="v03-c{i}" class="chip{acc}" style="left:{x}px; top:{y}px">{label}</div>'
    tw = W(word)
    js.append(f'  tl.fromTo("#v03-c{i}", {{opacity:0, x:-20, scale:0.9}}, {{opacity:1, x:0, scale:1, duration:0.45, ease:"back.out(2)"}}, {tw});')
    sfx(sid, tw, "pop.mp3", 0.2)
body += '</div>'  # out wrapper ends; stage separately
body += ('<div id="v03-stage" class="stage"><div id="v03-big" class="card big"><img id="v03-img" src="assets/qr/art-heart.webp" alt="">'
         '<div class="shrot"><div id="v03-sh" class="shine"></div></div></div>'
         '<div id="v03-print" class="print">')
# STL: подложка из слоёв + рельеф кода
for i in range(10):
    shade = 226 - i * 3 if i < 9 else 255
    body += f'<div class="plate" style="background:rgb({shade},{shade + 3},{shade + 8}); transform:translateZ({i * 2.4}px)"></div>'
for i in range(7):
    br = 0.55 + i * 0.06 if i < 6 else 1
    body += (f'<div class="lay" style="transform:translateZ({24 + i * 2.6}px)">'
             f'<img src="assets/qr/art-heart.webp" alt="" style="filter:brightness({br:.2f}); mix-blend-mode:multiply"></div>')
body += '</div></div>'
body += '<div id="v03-lbl" class="lbl">Модель для 3D-печати · STL</div>'
t_bl, t_pe, t_he, t_3d, t_gif, t_stl = W("блик"), W("перелив"), W("сердцебиение"), W("поворот"), W("гиф"), W("принтера")
js += [
    '  tl.fromTo("#v03-big", {opacity:0, scale:0.8, y:40}, {opacity:1, scale:1, y:0, duration:0.8, ease:"expo.out"}, 0.15);',
    f'  tl.fromTo("#v03-sh", {{x:0}}, {{x:1100, duration:0.75, ease:"power2.inOut"}}, {t_bl - 0.1});',
    f'  tl.fromTo("#v03-sh", {{x:0}}, {{x:1100, duration:0.75, ease:"power2.inOut", immediateRender:false}}, {t_he + 2.4});',
    f'  tl.fromTo("#v03-img", {{filter:"hue-rotate(0deg) saturate(1)"}}, {{filter:"hue-rotate(200deg) saturate(1.3)", duration:0.55, ease:"sine.inOut"}}, {t_pe});',
    f'  tl.to("#v03-img", {{filter:"hue-rotate(0deg) saturate(1)", duration:0.4, ease:"sine.inOut"}}, {t_pe + 0.55});',
]
# сердцебиение: тук-тук — пауза
for k, base in enumerate([t_he, t_he + 0.75]):
    js.append(f'  tl.to("#v03-big", {{scale:1.07, duration:0.11, ease:"power2.out"}}, {round(base, 3)});')
    js.append(f'  tl.to("#v03-big", {{scale:1, duration:0.16, ease:"power2.in"}}, {round(base + 0.11, 3)});')
    js.append(f'  tl.to("#v03-big", {{scale:1.09, duration:0.11, ease:"power2.out"}}, {round(base + 0.3, 3)});')
    js.append(f'  tl.to("#v03-big", {{scale:1, duration:0.2, ease:"power2.in"}}, {round(base + 0.41, 3)});')
js += [
    f'  tl.to("#v03-big", {{rotationY:32, duration:0.7, ease:"sine.inOut"}}, {t_3d - 0.1});',
    f'  tl.to("#v03-big", {{rotationY:-32, duration:1.3, ease:"sine.inOut"}}, {t_3d + 0.6});',
    f'  tl.to("#v03-big", {{rotationY:0, duration:0.8, ease:"sine.inOut"}}, {t_3d + 1.9});',
    # переход в STL
    f'  tl.to("#v03-big", {{opacity:0, scale:0.85, duration:0.35, ease:"power3.in"}}, {t_stl - 0.45});',
    f'  tl.set("#v03-print", {{rotationX:56, rotationZ:-28, opacity:0, scale:0.8}}, 0);',
    f'  tl.to("#v03-print", {{opacity:1, scale:1, duration:0.7, ease:"expo.out"}}, {t_stl - 0.15});',
    f'  tl.to("#v03-print", {{rotationZ:-8, duration:{round(SCENE_DUR[sid] - t_stl - 0.3, 2)}, ease:"sine.inOut"}}, {t_stl - 0.15});',
    f'  tl.fromTo("#v03-lbl", {{opacity:0, y:12}}, {{opacity:1, y:0, duration:0.45, ease:"expo.out"}}, {t_stl + 0.3});',
    f'  tl.to(["#v03-stage", "#v03-lbl"], {{opacity:0, duration:0.32, ease:"power3.in"}}, {round(SCENE_DUR[sid] - 0.36, 3)});',
]
sfx(sid, t_bl - 0.1, "whoosh-short.mp3", 0.18)
sfx(sid, t_stl - 0.15, "whoosh.mp3", 0.2)
SCENES.append((sid, scene_file(sid, "motion", body, css, "\n".join(js))))

# ------------------------------------------------------------------ v04 dynamic
sid = "v04"
W = Words(sid)
css = f"""
  .sign {{ left:820px; top:190px; width:430px; height:600px; opacity:0; }}
  .sign img {{ left:65px; top:120px; width:300px; height:300px; }}
  .sign .h {{ position:absolute; left:0; top:48px; width:430px; text-align:center; font-weight:800; font-size:38px; letter-spacing:-0.02em; }}
  .sign .s {{ position:absolute; left:0; top:450px; width:430px; text-align:center; font-weight:600; font-size:24px; color:#64748B; line-height:1.3; }}
  .tag {{ position:absolute; left:870px; top:820px; }}
  .panel {{ left:1310px; top:230px; width:520px; height:520px; padding:40px; opacity:0; }}
  .lb {{ font-weight:700; font-size:22px; color:#64748B; text-transform:uppercase; letter-spacing:0.06em; }}
  .inp {{ position:relative; margin-top:14px; height:72px; border-radius:16px; border:2px solid #E2E8F0; background:#F8FAFC; overflow:hidden; }}
  .inp.on {{ border-color:{ACCENT}; }}
  .url {{ position:absolute; left:22px; top:0; line-height:68px; font-weight:600; font-size:25px; color:{INK}; white-space:nowrap; opacity:0; }}
  .btn {{ margin-top:22px; height:66px; border-radius:16px; background:{ACCENT}; color:#fff; text-align:center; line-height:66px;
          font-weight:700; font-size:26px; }}
  .stat {{ margin-top:40px; padding-top:30px; border-top:2px solid #EEF1F6; }}
  .num {{ margin-top:8px; font-weight:800; font-size:76px; letter-spacing:-0.03em; color:{INK}; }}
  .arrow {{ position:absolute; left:1250px; top:445px; width:70px; height:40px; opacity:0; }}
"""
body = head_html(sid, "Динамические коды", "QR тот же — <em>ссылка новая</em>",
                 "Меняете адрес в кабинете когда угодно. Печатать заново не нужно.", 560)
body += "</div>"
body += ('<div id="v04-sign" class="card sign"><div class="h">Кофейня «Бобр»</div>'
         '<img src="assets/qr/food-coffee.webp" alt=""><div class="s" data-layout-ignore>Наведите камеру —<br>меню, отзывы, Wi‑Fi</div></div>')
body += '<div class="tag"><div id="v04-tag" class="chip acc">Перепечатывать не нужно</div></div>'
body += ('<svg id="v04-arr" class="arrow" viewBox="0 0 70 40"><path d="M4 20 H60 M46 6 L62 20 L46 34" fill="none" stroke="#94A3B8" '
         'stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>')
body += ('<div id="v04-panel" class="card panel" data-layout-ignore><div class="lb">Куда ведёт QR</div>'
         '<div id="v04-inp" class="inp"><div id="v04-u0" class="url">yandex.ru/maps/org/bobr</div>'
         '<div id="v04-u1" class="url">bobr.qrstars.ru/menu</div><div id="v04-u2" class="url">t.me/kofe_bobr</div></div>'
         '<div id="v04-btn" class="btn">Сохранить</div>'
         '<div class="stat"><div class="lb">Сканирований</div><div id="v04-num" class="num">0</div></div></div>')
t_q, t_ch, t_re, t_vi = W("напечатан"), W("меняете"), W("перепечатывать"), W("сколько")
js = [head_js(sid, cap_t=t_ch - 0.2),
      f'  tl.fromTo("#v04-sign", {{opacity:0, y:60, rotation:-4}}, {{opacity:1, y:0, rotation:-2, duration:0.8, ease:"expo.out"}}, {max(0.2, t_q - 0.6)});',
      f'  tl.fromTo("#v04-panel", {{opacity:0, x:40}}, {{opacity:1, x:0, duration:0.7, ease:"expo.out"}}, {t_ch - 0.6});',
      f'  tl.fromTo("#v04-arr", {{opacity:0, x:-12}}, {{opacity:1, x:0, duration:0.4, ease:"expo.out"}}, {t_ch - 0.3});',
      f'  tl.set("#v04-u0", {{opacity:1}}, {t_ch - 0.6});']
for k, tt in enumerate([t_ch + 1.2, t_ch + 3.0]):
    js += [f'  tl.to("#v04-u{k}", {{opacity:0, y:-24, duration:0.22, ease:"power2.in"}}, {round(tt, 3)});',
           f'  tl.fromTo("#v04-u{k + 1}", {{opacity:0, y:24}}, {{opacity:1, y:0, duration:0.3, ease:"expo.out"}}, {round(tt + 0.2, 3)});',
           f'  tl.to("#v04-btn", {{scale:0.94, duration:0.08, yoyo:true, repeat:1}}, {round(tt + 0.7, 3)});',
           f'  tl.to("#v04-sign", {{rotation:-0.5, duration:0.12, yoyo:true, repeat:1}}, {round(tt + 0.75, 3)});']
    sfx(sid, tt + 0.7, "click-soft.mp3", 0.4)
js += [f'  tl.fromTo("#v04-tag", {{opacity:0, y:14, scale:0.9}}, {{opacity:1, y:0, scale:1, duration:0.5, ease:"back.out(2)"}}, {t_re});',
       '  const cnt = { v: 0 };',
       f'  tl.to(cnt, {{ v: 1248, duration: 2.0, ease: "power2.out", onUpdate: () => {{ document.getElementById("v04-num").textContent = Math.round(cnt.v).toLocaleString("ru-RU"); }} }}, {t_vi});']
sfx(sid, t_re, "pop.mp3", 0.25)
SCENES.append((sid, scene_file(sid, "dynamic", body, css, "\n".join(js))))

# ------------------------------------------------------------------ v05 business card
sid = "v05"
W = Words(sid)
S = 380 / 1170
css = f"""
  .ph {{ left:930px; top:117px; opacity:0; }}
"""
body = head_html(sid, "QR-визитка", "Визитка, которая <em>приносит заявки</em>",
                 "Фото, услуги и цены, звонок и мессенджеры. Заявки — сразу в Telegram.", 560)
body += "</div>"
hls = [("фото", 136, 86, 108, 108), ("кнопки", 30, 300, 320, 114), ("услуги", 30, 526, 320, 172)]
body += ('<div id="v05-ph" class="phone ph" data-layout-ignore data-layout-allow-overlap><div class="screen"><img class="mshot" src="assets/shots/20-m-card-top.png" alt="">')
for i, (_, x, y, w, h) in enumerate(hls):
    body += f'<div id="v05-h{i}" class="mhl" style="left:{x}px; top:{y}px; width:{w}px; height:{h}px; border-radius:{w // 2 if i == 0 else 16}px"></div>'
body += '</div><div class="notch"></div></div>'
body += tg_card("v05-tg", "Новая заявка с визитки", "Анна: нужно заменить 3 розетки, завтра после 18:00",
                "Сергей Петров · Электрик · сейчас", 1370, 600)
js = [head_js(sid, cap_t=W("услуги") - 0.2),
      '  tl.fromTo("#v05-ph", {opacity:0, y:80}, {opacity:1, y:0, duration:0.9, ease:"expo.out"}, 0.15);',
      f'  tl.to("#v05-ph", {{y:-18, duration:{round(SCENE_DUR["v05"] - 1.5, 2)}, ease:"sine.inOut"}}, 1.05);']
order = [("фото", 0), ("услуги", 2), ("кнопки", 1)]
for word, i in order:
    tw = W(word)
    js.append(f'  tl.fromTo("#v05-h{i}", {{opacity:0, scale:1.06}}, {{opacity:1, scale:1, duration:0.3, ease:"expo.out"}}, {tw});')
    js.append(f'  tl.to("#v05-h{i}", {{opacity:0, duration:0.25}}, {round(tw + 1.0, 3)});')
t_z = W("заявку")
js.append(f'  tl.fromTo("#v05-tg", {{opacity:0, y:40, scale:0.95}}, {{opacity:1, y:0, scale:1, duration:0.6, ease:"back.out(1.6)"}}, {t_z});')
js.append(f'  tl.to("#v05-ph", {{x:-40, duration:0.6, ease:"power2.inOut"}}, {t_z - 0.1});')
sfx(sid, t_z, "notification.mp3", 0.45)
SCENES.append((sid, scene_file(sid, "card", body, css, "\n".join(js))))

# ------------------------------------------------------------------ v06 microsite
sid = "v06"
W = Words(sid)
css = f"""
  .ph {{ left:1100px; top:150px; opacity:0; }}
  .addr {{ position:absolute; left:1060px; top:62px; width:484px; height:62px; border-radius:31px; background:#fff; text-align:center;
           line-height:62px; font-weight:700; font-size:28px; color:{INK}; box-shadow:0 12px 30px rgba(15,23,42,.12); opacity:0; }}
  .addr b {{ color:{ACCENT}; }}
  .sw {{ position:absolute; width:44px; height:44px; border-radius:22px; border:4px solid #fff; box-shadow:0 6px 16px rgba(15,23,42,.18); opacity:0; }}
"""
body = head_html(sid, "QR-сайт", "Целый сайт <em>в одном коде</em>",
                 "Меню, Wi‑Fi, отзывы, бронь и контакты. Свой адрес и цвета бренда.", 560)
body += "</div>"
body += ('<div id="v06-ph" class="phone ph" data-layout-ignore data-layout-allow-overlap style="height:846px"><div class="screen">'
         '<img class="mshot" src="assets/shots/26-m-microsite.png" alt=""></div><div class="notch"></div></div>')
body += '<div id="v06-addr" class="addr"><b>bobr</b>.qrstars.ru</div>'
items = [("меню", "☕ Меню", 840, 300), ("wifi", "📶 Wi‑Fi", 1560, 270), ("отзывы", "⭐ Отзывы", 820, 480),
         ("бронь", "📋 Бронь", 1580, 470), ("контакты", "📍 Контакты", 800, 660)]
js = [head_js(sid, cap_t=W("меню") - 0.3),
      '  tl.fromTo("#v06-ph", {opacity:0, y:80}, {opacity:1, y:0, duration:0.9, ease:"expo.out"}, 0.15);',
      f'  tl.to("#v06-ph", {{y:-16, duration:{round(SCENE_DUR["v06"] - 1.5, 2)}, ease:"sine.inOut"}}, 1.05);']
for i, (word, label, x, y) in enumerate(items):
    body += f'<div id="v06-c{i}" class="chip" style="left:{x}px; top:{y}px">{label}</div>'
    # «отзывы» в озвучке не звучат (ударение) — плашка между Wi‑Fi и бронью
    tw = round((W("wifi") + W("бронь")) / 2, 3) if word == "отзывы" else W(word)
    js.append(f'  tl.fromTo("#v06-c{i}", {{opacity:0, scale:0.7, y:10}}, {{opacity:1, scale:1, y:0, duration:0.5, ease:"back.out(2)"}}, {tw});')
    sfx(sid, tw, "pop.mp3", 0.18)
t_a, t_c = W("адресом"), W("цветах")
js.append(f'  tl.fromTo("#v06-addr", {{opacity:0, y:-16}}, {{opacity:1, y:0, duration:0.5, ease:"expo.out"}}, {t_a - 0.1});')
for i, col in enumerate(["#4F46E5", "#E11D48", "#059669", "#EA580C", "#0F172A"]):
    body += f'<div id="v06-s{i}" class="sw" style="left:{1592 + i * 56}px; top:690px; background:{col}"></div>'
    js.append(f'  tl.fromTo("#v06-s{i}", {{opacity:0, scale:0.4}}, {{opacity:1, scale:1, duration:0.4, ease:"back.out(2.5)"}}, {round(t_c + i * 0.06, 3)});')
SCENES.append((sid, scene_file(sid, "site", body, css, "\n".join(js))))

# ------------------------------------------------------------------ v07 / v08 reviews
STAR = ('<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" '
        'fill="currentColor"/></svg>')
REV_CSS = f"""
  .ph {{ left:1000px; top:117px; }}
  .rs {{ position:absolute; inset:0; background:linear-gradient(180deg,#EEF0FF,#fff 60%); }}
  .rs .nm {{ position:absolute; left:0; width:380px; top:150px; text-align:center; font-weight:800; font-size:30px; letter-spacing:-0.02em; }}
  .rs .q {{ position:absolute; left:0; width:380px; top:200px; text-align:center; font-weight:600; font-size:22px; color:#64748B; }}
  .stars {{ position:absolute; left:30px; top:300px; width:320px; height:64px; }}
  .st {{ position:absolute; top:0; width:58px; height:58px; color:#E2E8F0; }}
  .st svg {{ width:58px; height:58px; display:block; }}
  .fill {{ position:absolute; inset:0; opacity:0; }}
  .gold {{ color:#FBBF24; }}
  .red {{ color:#F97316; }}
  .hint {{ position:absolute; left:0; width:380px; top:400px; text-align:center; font-weight:500; font-size:19px; color:#64748B; }}
"""


def stars_html(sid, cls):
    h = '<div class="stars">'
    for i in range(5):
        h += (f'<div class="st" style="left:{i * 66}px">{STAR}'
              f'<div id="{sid}-f{i}" class="fill {cls}">{STAR}</div></div>')
    return h + "</div>"


sid = "v07"
W = Words(sid)
css = REV_CSS + f"""
  .ym {{ position:absolute; left:1460px; top:250px; width:380px; border-radius:24px; background:#fff; overflow:hidden; opacity:0;
         box-shadow:0 30px 70px rgba(15,23,42,.18); }}
  .ym .bar {{ height:64px; background:#FFCC00; padding-left:24px; line-height:64px; font-weight:800; font-size:24px; color:#000; }}
  .ym .in {{ padding:22px 24px 26px; }}
  .ym .t {{ font-weight:800; font-size:24px; }}
  .ym .s {{ margin-top:10px; color:#FBBF24; font-size:30px; letter-spacing:4px; }}
  .ym .ta {{ margin-top:12px; height:96px; border-radius:12px; border:2px solid #E2E8F0; padding:12px 14px; font-size:19px; color:#64748B; }}
  .ym .b {{ margin-top:14px; height:52px; border-radius:12px; background:#0F172A; color:#fff; text-align:center; line-height:52px; font-weight:700; font-size:21px; }}
  .gis {{ position:absolute; left:1530px; top:720px; }}
  .arr {{ position:absolute; left:1408px; top:430px; width:56px; height:40px; opacity:0; }}
"""
body = head_html(sid, "Сбор отзывов", "Хорошие оценки — <em>на карты</em>",
                 "Довольный гость сразу попадает на форму отзыва в Яндекс Картах или 2ГИС.", 560)
body += "</div>"
body += ('<div id="v07-ph" class="phone ph" data-layout-ignore data-layout-allow-overlap><div class="screen"><div class="rs"><div class="nm">Кофейня «Бобр»</div>'
         '<div class="q">Как вам у нас?</div>' + stars_html("v07", "gold") +
         '<div class="hint">Нажмите на звезду</div></div><div id="v07-tap" class="tap"></div></div><div class="notch"></div></div>')
body += ('<svg id="v07-arr" class="arr" viewBox="0 0 56 40"><path d="M4 20 H46 M34 7 L48 20 L34 33" fill="none" stroke="#94A3B8" '
         'stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>')
body += ('<div id="v07-ym" class="ym"><div class="bar">Яндекс Карты</div><div class="in"><div class="t">Кофейня «Бобр»</div>'
         '<div class="s">★★★★★</div><div class="ta">Расскажите о впечатлениях…</div><div class="b">Отправить отзыв</div></div></div>')
body += '<div class="gis"><div id="v07-gis" class="chip" style="position:relative">или 2ГИС</div></div>'
t_o, t_d = W("оценку"), W("довольный")
tap_x, tap_y = 12 + 30 + 4 * 66 + 1, 12 + 300 + 1
js = [head_js(sid, cap_t=t_d - 0.2),
      '  tl.fromTo("#v07-ph", {opacity:0, y:80}, {opacity:1, y:0, duration:0.9, ease:"expo.out"}, 0.15);',
      f'  tl.to("#v07-ph", {{y:-16, duration:{round(SCENE_DUR["v07"] - 1.5, 2)}, ease:"sine.inOut"}}, 1.05);',
      f'  tl.set("#v07-tap", {{left:{tap_x - 12}, top:{tap_y - 12}}}, 0);',
      f'  tl.fromTo("#v07-tap", {{opacity:0, scale:1.6}}, {{opacity:1, scale:1, duration:0.25, ease:"power3.out"}}, {t_o});',
      f'  tl.to("#v07-tap", {{opacity:0, scale:1.3, duration:0.3}}, {t_o + 0.35});']
for i in range(5):
    js.append(f'  tl.fromTo("#v07-f{i}", {{opacity:0, scale:0.5}}, {{opacity:1, scale:1, duration:0.3, ease:"back.out(3)"}}, {round(t_o + 0.15 + i * 0.07, 3)});')
sfx(sid, t_o, "click-soft.mp3", 0.45)
sfx(sid, t_o + 0.2, "sparkle.mp3", 0.25)
js += [f'  tl.fromTo("#v07-arr", {{opacity:0, x:-12}}, {{opacity:1, x:0, duration:0.4, ease:"expo.out"}}, {t_d});',
       f'  tl.fromTo("#v07-ym", {{opacity:0, x:40}}, {{opacity:1, x:0, duration:0.7, ease:"expo.out"}}, {t_d + 0.15});',
       f'  tl.to("#v07-ym", {{y:-16, duration:3.2, ease:"sine.inOut"}}, {t_d + 0.9});',
       f'  tl.fromTo("#v07-gis", {{opacity:0, y:12}}, {{opacity:1, y:0, duration:0.45, ease:"back.out(2)"}}, {W("два")});',
       f'  tl.to(["#v07-arr", "#v07-ym", "#v07-gis"], {{opacity:0, duration:0.3, ease:"power3.in"}}, {round(SCENE_DUR[sid] - 0.34, 3)});']
sfx(sid, t_d + 0.15, "whoosh-short.mp3", 0.2)
SCENES.append((sid, scene_file(sid, "reviews", body, css, "\n".join(js))))

sid = "v08"
W = Words(sid)
css = REV_CSS + """
  .cf { position:absolute; inset:0; background:#fff; opacity:0; padding:120px 28px 0; }
  .cf .t { font-weight:800; font-size:28px; letter-spacing:-0.02em; }
  .cf .s { margin-top:8px; color:#F97316; font-size:28px; letter-spacing:4px; }
  .cf .ta { margin-top:18px; height:150px; border-radius:14px; border:2px solid #E2E8F0; padding:14px 16px; font-size:21px; line-height:1.35; color:#0F172A; }
  .cf .f { margin-top:14px; height:56px; border-radius:14px; border:2px solid #E2E8F0; padding:0 16px; line-height:52px; font-size:21px; color:#0F172A; }
  .cf .b { margin-top:18px; height:60px; border-radius:14px; background:#4F46E5; color:#fff; text-align:center; line-height:60px; font-weight:700; font-size:23px; }
"""
body = head_html(sid, "Сбор отзывов", "Жалобы — <em>вам</em>, а не на карты",
                 "Недовольный гость пишет вам в Telegram. Вы успеваете всё исправить.", 560)
body += "</div>"
body += ('<div id="v08-ph" class="phone ph" data-layout-ignore data-layout-allow-overlap><div class="screen"><div class="rs"><div class="nm">Кофейня «Бобр»</div>'
         '<div class="q">Как вам у нас?</div>' + stars_html("v08", "red") +
         '<div class="hint">Нажмите на звезду</div></div>'
         '<div id="v08-cf" class="cf"><div class="t">Что пошло не так?</div><div class="s">★★☆☆☆</div>'
         '<div class="ta">Долго ждали заказ, почти 40 минут</div><div class="f">@anna_k</div><div class="b">Отправить владельцу</div></div>'
         '<div id="v08-tap" class="tap"></div></div><div class="notch"></div></div>')
body += tg_card("v08-tg", "⚠️ Жалоба · 2★", "«Долго ждали заказ, почти 40 минут»<br>Контакт гостя: @anna_k",
                "Кофейня «Бобр» · QR «Стол 4» · сейчас", 1385, 560)
t_s = 0.55
t_j = W("жалоба")
js = [head_js(sid, cap_t=W("телеграм") - 0.3),
      '  tl.set("#v08-ph", {opacity:1}, 0);',
      f'  tl.set("#v08-tap", {{left:{12 + 30 + 66 + 1 - 12}, top:{12 + 300 + 1 - 12}}}, 0);',
      f'  tl.fromTo("#v08-tap", {{opacity:0, scale:1.6}}, {{opacity:1, scale:1, duration:0.25, ease:"power3.out"}}, {t_s});',
      f'  tl.to("#v08-tap", {{opacity:0, scale:1.3, duration:0.3}}, {t_s + 0.35});']
for i in range(2):
    js.append(f'  tl.fromTo("#v08-f{i}", {{opacity:0, scale:0.5}}, {{opacity:1, scale:1, duration:0.3, ease:"back.out(3)"}}, {round(t_s + 0.15 + i * 0.08, 3)});')
sfx(sid, t_s, "click-soft.mp3", 0.45)
js += [f'  tl.fromTo("#v08-cf", {{opacity:0, y:40}}, {{opacity:1, y:0, duration:0.5, ease:"expo.out"}}, {t_s + 0.8});',
       f'  tl.set("#v08-tap", {{left:{12 + 28 + 150}, top:{12 + 120 + 360}}}, {t_j - 0.6});',
       f'  tl.fromTo("#v08-tap", {{opacity:0, scale:1.6}}, {{opacity:1, scale:1, duration:0.25, ease:"power3.out", immediateRender:false}}, {t_j - 0.5});',
       f'  tl.to("#v08-tap", {{opacity:0, scale:1.3, duration:0.3}}, {t_j - 0.15});',
       f'  tl.fromTo("#v08-tg", {{opacity:0, y:40, scale:0.95}}, {{opacity:1, y:0, scale:1, duration:0.6, ease:"back.out(1.6)"}}, {t_j});',
       f'  tl.to("#v08-ph", {{x:-60, duration:0.6, ease:"power2.inOut"}}, {t_j - 0.1});',
       f'  tl.to(["#v08-ph", "#v08-tg"], {{opacity:0, y:-24, duration:0.32, ease:"power3.in"}}, {round(SCENE_DUR[sid] - 0.36, 3)});']
sfx(sid, t_j - 0.5, "click-soft.mp3", 0.4)
sfx(sid, t_j, "notification.mp3", 0.45)
SCENES.append((sid, scene_file(sid, "complaint", body, css, "\n".join(js))))

# ------------------------------------------------------------------ v09 end
sid = "v09"
W = Words(sid)
css = f"""
  .q {{ left:300px; top:240px; width:540px; height:540px; opacity:0; }}
  .q img {{ left:40px; top:40px; width:460px; height:460px; }}
  .logo {{ position:absolute; left:1000px; top:290px; width:620px; height:auto; opacity:0; }}
  .u {{ position:absolute; left:1004px; top:480px; font-weight:800; font-size:96px; letter-spacing:-0.035em; color:{ACCENT}; opacity:0; }}
  .d {{ position:absolute; left:1008px; top:610px; font-weight:600; font-size:42px; color:#334155; opacity:0; }}
  .sc {{ position:absolute; left:300px; top:820px; width:540px; text-align:center; font-weight:600; font-size:28px; color:#64748B; opacity:0; }}
"""
body = ('<div id="v09-q" class="card q"><img src="assets/qr/art-liquid.webp" alt=""></div>'
        '<img id="v09-logo" class="logo" src="assets/logo.svg" alt="QrStars">'
        '<div id="v09-u" class="u">qrstars.ru</div><div id="v09-d" class="d">Начните бесплатно — без карты</div>'
        '<div id="v09-sc" class="sc">Наведите камеру — откроется qrstars.ru</div>')
js = ['  tl.fromTo("#v09-q", {opacity:0, y:80, rotation:4}, {opacity:1, y:0, rotation:-2, duration:0.9, ease:"expo.out"}, 0.1);',
      '  tl.fromTo("#v09-logo", {opacity:0, x:-40, filter:"blur(10px)"}, {opacity:1, x:0, filter:"blur(0px)", duration:0.7, ease:"expo.out"}, 0.3);',
      f'  tl.fromTo("#v09-d", {{opacity:0, y:14}}, {{opacity:1, y:0, duration:0.5, ease:"expo.out"}}, {W("начать")});',
      f'  tl.fromTo("#v09-u", {{opacity:0, y:20, filter:"blur(8px)"}}, {{opacity:1, y:0, filter:"blur(0px)", duration:0.6, ease:"expo.out"}}, {W("qrstars")});',
      f'  tl.fromTo("#v09-sc", {{opacity:0}}, {{opacity:1, duration:0.4}}, {W("qrstars") + 1.0});']
sfx(sid, 0.1, "whoosh.mp3", 0.25)
sfx(sid, W("qrstars"), "sparkle.mp3", 0.3)
SCENES.append((sid, scene_file(sid, "end", body, css, "\n".join(js))))

# переходы
for s in VO_IDS[1:-1]:
    SFX.append((round(SCENE_START[s] + 0.05, 3), "whoosh-short.mp3", 0.16))

# ------------------------------------------------------------------ index.html
hosts, auds = [], []
for i, (sid, path) in enumerate(SCENES):
    hosts.append(f'    <div id="{sid}" data-composition-id="{sid}" data-composition-src="{path}" data-start="{SCENE_START[sid]}" '
                 f'data-duration="{SCENE_DUR[sid]}" data-track-index="{1 + i % 2}" data-track-kind="graphics" data-width="1920" data-height="1080"></div>')
for sid in VO_IDS:
    auds.append(f'    <audio id="vo-{sid}" src="assets/vo/{sid}.mp3" data-start="{round(VO_START[sid], 3)}" '
                f'data-duration="{round(VO_DUR[sid], 3)}" data-track-index="10" data-volume="1"></audio>')
auds.append(f'    <audio id="bgm" src="assets/bgm-light.mp3" data-start="0" data-duration="{TOTAL}" data-track-index="11" '
            f'data-volume="0.9" data-fade-in="0.4" data-fade-out="2.5"></audio>')
SFX.sort()
for k, (tt, f, v) in enumerate(SFX):
    d = round(min(dur(f"assets/{f}"), TOTAL - tt), 3)
    auds.append(f'    <audio id="sfx-{k:03d}" src="assets/{f}" data-start="{tt}" data-duration="{d}" '
                f'data-track-index="{20 + k % 6}" data-volume="{v}"></audio>')

index = f"""<!doctype html>
<html lang="ru" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html, body {{ margin:0; width:1920px; height:1080px; overflow:hidden; background:{GROUND}; }}
      #root {{ position:relative; width:1920px; height:1080px; overflow:hidden; background:{GROUND}; font-family:Inter, sans-serif; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="1920" data-height="1080">
{chr(10).join(hosts)}
{chr(10).join(auds)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""
open("index.html", "w").write(index)
print("TOTAL", TOTAL)
for s in VO_IDS:
    print(s, "scene", SCENE_START[s], SCENE_DUR[s], "vo", round(VO_START[s], 2), round(VO_DUR[s], 2))

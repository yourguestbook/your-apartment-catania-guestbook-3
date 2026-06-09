#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Guestbook Factory — generatore statico.

    python3 build.py [content.json] [--out dist]

Legge un file dati (default: content.json), lo fonde con il template in
template/ e scrive un guestbook completo e pubblicabile in dist/.

Nessuna dipendenza esterna: solo libreria standard di Python 3.8+.
Se il binario `cwebp` è nel PATH, genera anche le versioni .webp delle foto.
"""

import sys
import os
import re
import json
import html
import shutil
import struct
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEMPLATE_DIR = ROOT / "template"
PARTIALS_DIR = TEMPLATE_DIR / "partials"
PHOTOS_DIR = ROOT / "input" / "photos"

ASSET_IMG = "assets/img/"

# Colori chrome (barra browser) di default — sovrascrivibili da brand.themeColor*
DEFAULT_THEME_LIGHT = "#fdfbf7"
DEFAULT_THEME_DARK = "#15110b"


# ════════════════════════════════════════════════════════════════════════
#  1. MOTORE DI TEMPLATE  (mini-mustache, stdlib)
#     Supporta:  {{ var }}            sostituzione con escaping HTML
#                {{{ var }}}          sostituzione RAW (HTML grezzo)
#                {{#if path}}…{{else}}…{{/if}}
#                {{#each path}}…{{else}}…{{/each}}   (+ {{@index}} {{@number}} {{@first}} {{@last}} {{this}})
#                {{> partial}}        include template/partials/<partial>.html
# ════════════════════════════════════════════════════════════════════════

_TOKEN = re.compile(
    r"\{\{\{\s*(?P<raw>[^}]+?)\s*\}\}\}"      # {{{ raw }}}
    r"|\{\{\s*(?P<sigil>[#/>^&]?)\s*(?P<expr>[^}]*?)\s*\}\}",  # {{ ... }}
    re.S,
)

_MISSING = object()


def _tokenize(src, partials):
    """Trasforma il sorgente in una lista piatta di token, espandendo i partial."""
    out = []
    pos = 0
    for m in _TOKEN.finditer(src):
        if m.start() > pos:
            out.append(("text", src[pos:m.start()]))
        pos = m.end()
        if m.group("raw") is not None:
            out.append(("raw", m.group("raw").strip()))
            continue
        sigil = m.group("sigil")
        expr = m.group("expr").strip()
        if sigil == ">":
            name = expr.strip()
            ptext = _load_partial(name, partials)
            out.extend(_tokenize(ptext, partials))
        elif sigil == "#":
            kw, _, arg = expr.partition(" ")
            out.append(("open", kw.strip(), arg.strip()))
        elif sigil == "/":
            out.append(("close", expr.strip()))
        elif sigil == "&":
            out.append(("raw", expr))
        elif expr == "else":
            out.append(("else",))
        else:
            out.append(("var", expr))
    if pos < len(src):
        out.append(("text", src[pos:]))
    return out


_partial_cache = {}


def _load_partial(name, partials):
    if name in _partial_cache:
        return _partial_cache[name]
    p = PARTIALS_DIR / f"{name}.html"
    if not p.exists():
        raise SystemExit(f"✗ Partial mancante: {p}")
    txt = p.read_text(encoding="utf-8")
    _partial_cache[name] = txt
    return txt


def _parse(tokens):
    """Costruisce l'albero (lista di nodi) gestendo l'annidamento di if/each."""
    pos = 0

    def parse_until(closer):
        nonlocal pos
        nodes = []
        else_nodes = None
        target = nodes
        while pos < len(tokens):
            tok = tokens[pos]
            kind = tok[0]
            if kind == "close":
                if tok[1] != closer:
                    raise SystemExit(f"✗ Tag di chiusura {{{{/{tok[1]}}}}} inatteso (atteso {closer or 'nessuno'})")
                pos += 1
                return nodes, else_nodes
            if kind == "else":
                pos += 1
                else_nodes = []
                target = else_nodes
                continue
            if kind == "open":
                pos += 1
                inner, inner_else = parse_until(tok[1])
                target.append((tok[1], tok[2], inner, inner_else))
                continue
            target.append(tok)
            pos += 1
        if closer is not None:
            raise SystemExit(f"✗ Blocco {{{{#{closer}}}}} non chiuso")
        return nodes, else_nodes

    nodes, _ = parse_until(None)
    return nodes


def _resolve(path, stack):
    if path in (".", "this"):
        return stack[-1]["ctx"]
    parts = path.split(".")
    first = parts[0]
    val = _MISSING
    if first.startswith("@"):
        for frame in reversed(stack):
            if first in frame["specials"]:
                val = frame["specials"][first]
                break
    else:
        for frame in reversed(stack):
            ctx = frame["ctx"]
            if isinstance(ctx, dict) and first in ctx:
                val = ctx[first]
                break
    if val is _MISSING:
        return None
    for p in parts[1:]:
        if isinstance(val, dict) and p in val:
            val = val[p]
        else:
            return None
    return val


def _truthy(v):
    if v is None or v is False or v == "" or v == 0:
        return False
    if isinstance(v, (list, dict, tuple)) and len(v) == 0:
        return False
    return True


def _render(nodes, stack):
    out = []
    for node in nodes:
        kind = node[0]
        if kind == "text":
            out.append(node[1])
        elif kind == "var":
            v = _resolve(node[1], stack)
            out.append("" if v in (None, False) else html.escape(str(v)))
        elif kind == "raw":
            v = _resolve(node[1], stack)
            out.append("" if v in (None, False) else str(v))
        elif kind == "if":
            _, arg, inner, els = node
            branch = inner if _truthy(_resolve(arg, stack)) else (els or [])
            out.append(_render(branch, stack))
        elif kind == "each":
            _, arg, inner, els = node
            seq = _resolve(arg, stack)
            if isinstance(seq, list) and seq:
                n = len(seq)
                for i, item in enumerate(seq):
                    stack.append({"ctx": item, "specials": {
                        "@index": i, "@number": i + 1,
                        "@first": i == 0, "@last": i == n - 1}})
                    out.append(_render(inner, stack))
                    stack.pop()
            else:
                out.append(_render(els or [], stack))
    return "".join(out)


# il parser usa ("open"/"close") → li mappiamo a nodi tipizzati if/each
def _typed(nodes):
    typed = []
    for node in nodes:
        if isinstance(node, tuple) and len(node) == 4 and node[0] in ("if", "each", "unless"):
            kw, arg, inner, els = node
            inner = _typed(inner)
            els = _typed(els) if els is not None else None
            if kw == "unless":
                typed.append(("if", arg, els or [], inner))  # unless = if invertito
            else:
                typed.append((kw, arg, inner, els))
        else:
            typed.append(node)
    return typed


def render_template(src, context, partials=None):
    tokens = _tokenize(src, partials or {})
    tree = _typed(_parse(tokens))
    return _render(tree, [{"ctx": context, "specials": {}}])


# ════════════════════════════════════════════════════════════════════════
#  2. IMMAGINI  (dimensioni senza Pillow + copia + webp + manifest)
# ════════════════════════════════════════════════════════════════════════

def image_size(path):
    """Ritorna (w, h) per PNG/JPEG leggendo l'header. None se ignoto."""
    try:
        with open(path, "rb") as f:
            head = f.read(26)
            if head[:8] == b"\x89PNG\r\n\x1a\n":
                w, h = struct.unpack(">II", head[16:24])
                return int(w), int(h)
            if head[:2] == b"\xff\xd8":  # JPEG
                f.seek(2)
                while True:
                    b = f.read(1)
                    if not b:
                        return None
                    if b != b"\xff":
                        continue
                    marker = f.read(1)
                    while marker == b"\xff":
                        marker = f.read(1)
                    if marker in (b"\xc0", b"\xc1", b"\xc2", b"\xc3",
                                  b"\xc5", b"\xc6", b"\xc7", b"\xc9", b"\xca", b"\xcb"):
                        f.read(3)
                        h, w = struct.unpack(">HH", f.read(4))
                        return int(w), int(h)
                    seg = f.read(2)
                    if len(seg) < 2:
                        return None
                    f.seek(struct.unpack(">H", seg)[0] - 2, 1)
    except Exception:
        return None
    return None


def make_webp(src_jpg, out_webp, quality=82):
    if not shutil.which("cwebp"):
        return False
    import subprocess
    try:
        subprocess.run(["cwebp", "-q", str(quality), "-m", "6", "-quiet",
                        str(src_jpg), "-o", str(out_webp)],
                       check=True, capture_output=True)
        return True
    except Exception:
        return False


# ════════════════════════════════════════════════════════════════════════
#  3. NORMALIZZAZIONE CONTENUTO  (filename → {src, webp})
# ════════════════════════════════════════════════════════════════════════

def _imgref(name, sub=""):
    if not name:
        return None
    stem = os.path.splitext(name)[0]
    return {"file": name, "sub": sub,
            "src": f"{ASSET_IMG}{sub}{name}",
            "webp": f"{ASSET_IMG}{sub}{stem}.webp"}


def _wrap_list(items, sub="", default_alt="Foto"):
    out = []
    n = len(items)
    for i, it in enumerate(items):
        if isinstance(it, str):
            it = {"file": it}
        ref = _imgref(it["file"], sub)
        ref["alt"] = it.get("alt", f"{default_alt} {i + 1}")
        ref["n"] = i + 1
        ref["total"] = n
        ref["tall"] = (i == 0)
        out.append(ref)
    return out


def normalize(content):
    """Aggiunge campi derivati (immagini, url mappa) e raccoglie i file da copiare."""
    needed = set()  # (filename, subdir)

    def track(ref):
        if ref:
            needed.add((ref["file"], ref["sub"]))
        return ref

    host = content.get("host")
    if host and host.get("photo"):
        host["photo"] = track(_imgref(host["photo"]))

    if content.get("gallery"):
        content["gallery"] = _wrap_list(content["gallery"], "gallery/", "Foto")
        for r in content["gallery"]:
            track(r)
    content["galleryCount"] = len(content.get("gallery") or [])
    if content.get("collage"):
        content["collage"] = _wrap_list(content["collage"], "gallery/", "Foto")
        for r in content["collage"]:
            track(r)

    # things-to-do: gruppi (Experiences / In the city / By the sea …)
    for grp in (content.get("thingsToDo") or {}).get("groups", []) or []:
        for item in grp.get("items", []) or []:
            if item.get("image"):
                item["image"] = track(_imgref(item["image"]))
    for item in content.get("nearest", []) or []:
        if item.get("image"):
            item["image"] = track(_imgref(item["image"]))
    for item in content.get("eat", []) or []:
        if item.get("image"):
            item["image"] = track(_imgref(item["image"]))

    kitchen = content.get("kitchen")
    if kitchen and kitchen.get("image"):
        kitchen["image"] = track(_imgref(kitchen["image"]))

    rules = content.get("rules")
    if rules and rules.get("images"):
        rules["images"] = [track(_imgref(x)) for x in rules["images"]]

    info = content.get("houseInfo")
    if info:
        for item in info.get("items", []) or []:
            if item.get("image"):
                item["image"] = track(_imgref(item["image"]))

    emg = content.get("emergency")
    if emg and emg.get("poster"):
        emg["poster"] = track(_imgref(emg["poster"]))

    return needed


# ════════════════════════════════════════════════════════════════════════
#  4. TESTA: meta theme-color, logo hero, mappa, config JS
# ════════════════════════════════════════════════════════════════════════

def head_extras(content):
    site = content.get("site", {})
    brand = content.get("brand", {})
    theme = site.get("theme", "auto")
    light = brand.get("themeColorLight", DEFAULT_THEME_LIGHT)
    dark = brand.get("themeColorDark", DEFAULT_THEME_DARK)

    logo_light = site.get("logoLight", "logo-light.png")
    logo_dark = site.get("logoDark", "logo-dark.png")
    lw = site.get("logoWidth", 432)
    lh = site.get("logoHeight", 313)
    alt = html.escape(site.get("businessName", "Logo"))

    if theme == "dark":
        meta = f'<meta name="color-scheme" content="dark" />\n        <meta name="theme-color" content="{dark}" />'
        hero = f'<img src="{ASSET_IMG}{logo_dark}" alt="{alt}" width="{lw}" height="{lh}" />'
    elif theme == "light":
        meta = f'<meta name="color-scheme" content="light" />\n        <meta name="theme-color" content="{light}" />'
        hero = f'<img src="{ASSET_IMG}{logo_light}" alt="{alt}" width="{lw}" height="{lh}" />'
    else:  # auto
        meta = (f'<meta name="theme-color" content="{light}" media="(prefers-color-scheme: light)" />\n'
                f'        <meta name="theme-color" content="{dark}" media="(prefers-color-scheme: dark)" />')
        hero = ('<picture>'
                f'<source media="(prefers-color-scheme: dark)" srcset="{ASSET_IMG}{logo_dark}" />'
                f'<img src="{ASSET_IMG}{logo_light}" alt="{alt}" width="{lw}" height="{lh}" /></picture>')

    content["_heroLogo"] = hero
    content["_themeMeta"] = meta

    # mappa
    addr = content.get("address", {})
    lat, lng = addr.get("lat"), addr.get("lng")
    q = urllib.parse.quote_plus(addr.get("query") or addr.get("text", ""))
    content.setdefault("address", {})
    if lat is not None and lng is not None:
        d_lat, d_lng = 0.0033, 0.0045
        bbox = f"{lng - d_lng:.4f},{lat - d_lat:.4f},{lng + d_lng:.4f},{lat + d_lat:.4f}"
        addr["_mapEmbed"] = (f"https://www.openstreetmap.org/export/embed.html?bbox={bbox}"
                             f"&layer=mapnik&marker={lat},{lng}")
    addr["_google"] = f"https://www.google.com/maps/search/?api=1&query={q}"
    addr["_apple"] = f"https://maps.apple.com/?q={urllib.parse.quote_plus(addr.get('text',''))}"

    # config runtime per app.js
    host = content.get("host", {}) or {}
    cfg = {
        "title": {
            "business": site.get("businessName", ""),
            "unit": site.get("unitLabel", ""),
        },
        "host": {"name": host.get("name", ""), "whatsapp": host.get("whatsapp", "")},
        "wifi": content.get("wifi") or None,
        "footerLogo": site.get("logoDark", "logo-dark.png"),
        "theme": theme,
    }
    raw = json.dumps(cfg, ensure_ascii=False).replace("<", "\\u003c")
    content["_configScript"] = f"<script>window.GUESTBOOK = {raw};</script>"


# ════════════════════════════════════════════════════════════════════════
#  5. CSS: tema (trasforma le media query) + brand override
# ════════════════════════════════════════════════════════════════════════

def themed_style_css(css, theme):
    combined = "@media (prefers-color-scheme: dark) and (min-width: 540px)"
    simple = "@media (prefers-color-scheme: dark)"
    if theme == "dark":
        css = css.replace(combined, "@media (min-width: 540px)")
        css = css.replace(simple, "@media all")
    elif theme == "light":
        css = css.replace(combined, "@media not all")
        css = css.replace(simple, "@media not all")
    return css


def brand_css(brand, theme):
    if not brand:
        return "/* nessun override brand */\n"
    lines = [":root {"]
    fam = {
        "fontDisplay": "--font-display", "fontBody": "--font-body",
        "fontAccent": "--font-accent", "radius": "--radius-lg",
    }
    for key, var in fam.items():
        if key in brand:
            val = brand[key]
            if key.startswith("font") and "," not in val:
                val = f'"{val}"'
            lines.append(f"    {var}: {val};")
    # token di palette comuni (validi in entrambe le modalità)
    for k, v in (brand.get("tokens", {}) or {}).get("common", {}).items():
        lines.append(f"    --{k}: {v};")
    lines.append("}")

    def block(tokens):
        return ":root {\n" + "".join(f"    --{k}: {v};\n" for k, v in tokens.items()) + "}"

    light = (brand.get("tokens", {}) or {}).get("light", {})
    dark = (brand.get("tokens", {}) or {}).get("dark", {})
    if theme == "dark":
        if dark:
            lines.append(block(dark))
    elif theme == "light":
        if light:
            lines.append(block(light))
    else:
        if light:
            lines.append(block(light))
        if dark:
            lines.append("@media (prefers-color-scheme: dark) {\n" + block(dark) + "\n}")
    return "\n".join(lines) + "\n"


# ════════════════════════════════════════════════════════════════════════
#  6. VALIDAZIONE
# ════════════════════════════════════════════════════════════════════════

REQUIRED = [
    ("site.businessName", lambda c: c.get("site", {}).get("businessName")),
    ("address.text", lambda c: c.get("address", {}).get("text")),
    ("host.name", lambda c: c.get("host", {}).get("name")),
]


def validate(content):
    errors = []
    for label, getter in REQUIRED:
        if not getter(content):
            errors.append(f"campo obbligatorio mancante: {label}")
    theme = content.get("site", {}).get("theme", "auto")
    if theme not in ("auto", "light", "dark"):
        errors.append(f"site.theme deve essere auto|light|dark (trovato: {theme!r})")
    addr = content.get("address", {})
    if (addr.get("lat") is None) != (addr.get("lng") is None):
        errors.append("address.lat e address.lng vanno forniti insieme (o nessuno dei due)")
    return errors


# ════════════════════════════════════════════════════════════════════════
#  7. MAIN
# ════════════════════════════════════════════════════════════════════════

def main(argv):
    content_path = ROOT / "content.json"
    out_dir = ROOT / "dist"
    args = list(argv)
    if "--out" in args:
        i = args.index("--out")
        out_dir = Path(args[i + 1]).resolve()
        del args[i:i + 2]
    if args:
        content_path = Path(args[0]).resolve()

    if not content_path.exists():
        raise SystemExit(f"✗ File contenuti non trovato: {content_path}\n"
                         f"  Copia content.example.json in content.json e compilalo.")

    try:
        content = json.loads(content_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise SystemExit(f"✗ JSON non valido in {content_path.name}: {e}")

    errors = validate(content)
    if errors:
        print("✗ Validazione fallita:", file=sys.stderr)
        for e in errors:
            print(f"   • {e}", file=sys.stderr)
        return 1

    needed = normalize(content)
    head_extras(content)

    template_src = (TEMPLATE_DIR / "index.template.html").read_text(encoding="utf-8")
    rendered = render_template(template_src, content)

    # ---- scrittura dist ----
    if out_dir.exists():
        shutil.rmtree(out_dir)
    (out_dir / "assets" / "css").mkdir(parents=True, exist_ok=True)
    (out_dir / "assets" / "js").mkdir(parents=True, exist_ok=True)
    (out_dir / "assets" / "img" / "gallery").mkdir(parents=True, exist_ok=True)

    (out_dir / "index.html").write_text(rendered, encoding="utf-8")

    # CSS: stile (tema) + brand override
    style = (TEMPLATE_DIR / "assets/css/style.css").read_text(encoding="utf-8")
    theme = content.get("site", {}).get("theme", "auto")
    (out_dir / "assets/css/style.css").write_text(themed_style_css(style, theme), encoding="utf-8")
    (out_dir / "assets/css/brand.css").write_text(brand_css(content.get("brand", {}), theme), encoding="utf-8")

    # JS generico (legge window.GUESTBOOK)
    shutil.copy2(TEMPLATE_DIR / "assets/js/app.js", out_dir / "assets/js/app.js")

    # asset fissi del brand (logo, favicon, og)
    for fn in os.listdir(TEMPLATE_DIR / "assets/img"):
        p = TEMPLATE_DIR / "assets/img" / fn
        if p.is_file():
            shutil.copy2(p, out_dir / "assets/img" / fn)

    # foto del cliente (da input/photos) + webp
    missing, webp_count = [], 0
    for fn, sub in sorted(needed):
        src = PHOTOS_DIR / fn
        if not src.exists():
            missing.append(fn)
            continue
        dst = out_dir / "assets/img" / sub / fn
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        if fn.lower().endswith((".jpg", ".jpeg", ".png")):
            stem = os.path.splitext(fn)[0]
            if make_webp(src, dst.parent / f"{stem}.webp"):
                webp_count += 1

    # manifest galleria (dimensioni dai jpg)
    manifest = []
    for ref in content.get("gallery", []) or []:
        src = PHOTOS_DIR / ref["file"]
        size = image_size(src) if src.exists() else None
        stem = os.path.splitext(ref["file"])[0]
        manifest.append({"name": stem, "w": size[0] if size else 1600,
                         "h": size[1] if size else 1067})
    if manifest:
        (out_dir / "assets/img/gallery/_manifest.json").write_text(
            json.dumps(manifest), encoding="utf-8")

    # ---- report ----
    print(f"✓ Guestbook generato in {out_dir}")
    print(f"  tema: {theme}  ·  webp generati: {webp_count}"
          + ("  ·  cwebp assente (solo jpg)" if not shutil.which('cwebp') else ""))
    if missing:
        print(f"  ⚠ {len(missing)} foto mancanti in input/photos/: " + ", ".join(missing[:8])
              + (" …" if len(missing) > 8 else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

#!/usr/bin/env python3
"""
Generate 70 Instagram stories for Enrola Shop · Mes 2.
Writes HTML files + renders each to 1080x1920 PNG via Chrome headless.

Usage:
    python3 generate.py          # generate all 70
    python3 generate.py --dry    # preview calendar without rendering
"""

import os
import subprocess
import sys
import tempfile
from pathlib import Path
from string import Template

HERE = Path(__file__).parent
SOCIAL_ROOT = HERE.parent
SHARED_CSS = SOCIAL_ROOT / "templates" / "_shared.css"
PRODUCTS_DIR = SOCIAL_ROOT / "assets" / "products"
OUT_BASE = HERE / "daily"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# ===== PRODUCT PHOTO LIBRARY (real photos, transparent background) =====

def _img_url(slug):
    p = PRODUCTS_DIR / f"{slug}.webp"
    return f"file://{p.resolve()}"

PRODUCT_IMGS = {
    "papers-marron":       _img_url("papers-marron"),
    "papers-alien":        _img_url("papers-alien"),
    "papers-celulosa":     _img_url("papers-celulosa"),
    "conos":               _img_url("conos"),
    "conos-celulosa":      _img_url("conos-celulosa"),
    "conos-rp":            _img_url("conos-rp"),
    "grinder-basic":       _img_url("grinder-basic"),
    "grinder-rellenador":  _img_url("grinder-rellenador"),
    "filtros-carbon":      _img_url("filtros-carbon"),
    "filtros-carton":      _img_url("filtros-carton"),
}

def _img_tag(slug, style=""):
    return f'<img src="{PRODUCT_IMGS[slug]}" style="max-width:100%; max-height:100%; object-fit: contain; {style}">'

# ===== PRODUCT SVG LIBRARY =====

SVG_PAPERS_MARRON = '''<svg viewBox="0 0 200 200" fill="none" stroke="#1A1A1A" stroke-width="8">
  <rect x="50" y="40" width="100" height="130" fill="#8a6942" stroke="#1A1A1A" stroke-width="8"/>
  <rect x="50" y="40" width="100" height="34" fill="#1A1A1A" stroke="#1A1A1A" stroke-width="8"/>
  <line x1="50" y1="110" x2="150" y2="110" stroke="#1A1A1A" stroke-width="3" stroke-dasharray="5 3"/>
  <line x1="50" y1="135" x2="150" y2="135" stroke="#1A1A1A" stroke-width="3" stroke-dasharray="5 3"/>
</svg>'''

SVG_PAPERS_ALIEN = '''<svg viewBox="0 0 200 200" fill="none" stroke="#1A1A1A" stroke-width="8">
  <rect x="50" y="40" width="100" height="130" fill="#F5F2E8" stroke="#1A1A1A" stroke-width="8"/>
  <rect x="50" y="40" width="100" height="34" fill="#FF3B27" stroke="#1A1A1A" stroke-width="8"/>
  <text x="100" y="62" text-anchor="middle" font-family="Kanit" font-weight="900" font-size="14" fill="#F5F2E8" letter-spacing="2">ALIEN</text>
  <line x1="50" y1="100" x2="150" y2="100" stroke="#1A1A1A" stroke-width="3" stroke-dasharray="5 3"/>
  <line x1="50" y1="130" x2="150" y2="130" stroke="#1A1A1A" stroke-width="3" stroke-dasharray="5 3"/>
</svg>'''

SVG_PAPERS_CELULOSA = '''<svg viewBox="0 0 200 200" fill="none" stroke="#1A1A1A" stroke-width="8">
  <rect x="50" y="40" width="100" height="130" fill="#F5F2E8" stroke="#1A1A1A" stroke-width="8" opacity="0.5"/>
  <rect x="50" y="40" width="100" height="34" fill="#BB3B2E" stroke="#1A1A1A" stroke-width="8"/>
  <text x="100" y="63" text-anchor="middle" font-family="Kanit" font-weight="900" font-size="14" fill="#F5F2E8" letter-spacing="2">CELULOSA</text>
  <g stroke="#1A1A1A" stroke-width="2" fill="none" opacity="0.6">
    <path d="M 60 85 L 140 85 M 60 100 L 140 100 M 60 115 L 140 115 M 60 130 L 140 130 M 60 145 L 140 145"/>
  </g>
</svg>'''

SVG_CONOS = '''<svg viewBox="0 0 200 200" fill="none" stroke="#1A1A1A" stroke-width="8">
  <path d="M 50 160 L 65 60 L 80 160 Z" fill="#F5F2E8" stroke="#1A1A1A" stroke-width="8"/>
  <path d="M 85 160 L 100 50 L 115 160 Z" fill="#FF3B27" stroke="#1A1A1A" stroke-width="8"/>
  <path d="M 120 160 L 135 60 L 150 160 Z" fill="#F5F2E8" stroke="#1A1A1A" stroke-width="8"/>
  <rect x="58" y="150" width="14" height="16" fill="#1A1A1A"/>
  <rect x="93" y="150" width="14" height="16" fill="#1A1A1A"/>
  <rect x="128" y="150" width="14" height="16" fill="#1A1A1A"/>
</svg>'''

SVG_CONOS_CELULOSA = '''<svg viewBox="0 0 200 200" fill="none" stroke="#1A1A1A" stroke-width="8">
  <path d="M 50 160 L 65 60 L 80 160 Z" fill="#F5F2E8" stroke="#1A1A1A" stroke-width="8" opacity="0.55"/>
  <path d="M 85 160 L 100 50 L 115 160 Z" fill="#F5F2E8" stroke="#1A1A1A" stroke-width="8" opacity="0.55"/>
  <path d="M 120 160 L 135 60 L 150 160 Z" fill="#F5F2E8" stroke="#1A1A1A" stroke-width="8" opacity="0.55"/>
  <rect x="58" y="150" width="14" height="16" fill="#1A1A1A"/>
  <rect x="93" y="150" width="14" height="16" fill="#1A1A1A"/>
  <rect x="128" y="150" width="14" height="16" fill="#1A1A1A"/>
</svg>'''

SVG_CONOS_RP = '''<svg viewBox="0 0 200 200" fill="none" stroke="#1A1A1A" stroke-width="8">
  <path d="M 30 170 L 50 55 L 70 170 Z" fill="#F5F2E8" stroke="#1A1A1A" stroke-width="6"/>
  <path d="M 65 170 L 85 45 L 105 170 Z" fill="#F5F2E8" stroke="#1A1A1A" stroke-width="6"/>
  <path d="M 100 170 L 120 40 L 140 170 Z" fill="#F5F2E8" stroke="#1A1A1A" stroke-width="6"/>
  <path d="M 135 170 L 155 55 L 175 170 Z" fill="#F5F2E8" stroke="#1A1A1A" stroke-width="6"/>
  <rect x="38" y="158" width="14" height="14" fill="#1A1A1A"/>
  <rect x="73" y="158" width="14" height="14" fill="#1A1A1A"/>
  <rect x="108" y="158" width="14" height="14" fill="#1A1A1A"/>
  <rect x="143" y="158" width="14" height="14" fill="#1A1A1A"/>
</svg>'''

SVG_GRINDER_BASIC = '''<svg viewBox="0 0 200 200" fill="none" stroke="#1A1A1A" stroke-width="8">
  <circle cx="100" cy="100" r="72" fill="#FF3B27" stroke="#1A1A1A" stroke-width="8"/>
  <circle cx="100" cy="100" r="50" fill="#F5F2E8" stroke="#1A1A1A" stroke-width="6"/>
  <circle cx="100" cy="100" r="24" fill="#1A1A1A"/>
  <g stroke="#1A1A1A" stroke-width="5">
    <line x1="100" y1="42" x2="100" y2="55"/>
    <line x1="100" y1="145" x2="100" y2="158"/>
    <line x1="42" y1="100" x2="55" y2="100"/>
    <line x1="145" y1="100" x2="158" y2="100"/>
  </g>
</svg>'''

SVG_GRINDER_RELLENADOR = '''<svg viewBox="0 0 200 200" fill="none" stroke="#1A1A1A" stroke-width="8">
  <rect x="40" y="60" width="120" height="70" fill="#BB3B2E" stroke="#1A1A1A" stroke-width="8"/>
  <line x1="54" y1="60" x2="54" y2="45" stroke="#1A1A1A" stroke-width="6"/>
  <line x1="94" y1="60" x2="94" y2="42" stroke="#1A1A1A" stroke-width="6"/>
  <line x1="134" y1="60" x2="134" y2="45" stroke="#1A1A1A" stroke-width="6"/>
  <rect x="138" y="95" width="46" height="70" fill="#F5F2E8" stroke="#1A1A1A" stroke-width="6"/>
  <line x1="148" y1="108" x2="174" y2="108" stroke="#1A1A1A" stroke-width="4"/>
  <line x1="148" y1="125" x2="174" y2="125" stroke="#1A1A1A" stroke-width="4"/>
  <line x1="148" y1="142" x2="174" y2="142" stroke="#1A1A1A" stroke-width="4"/>
</svg>'''

SVG_FILTROS_CARBON = '''<svg viewBox="0 0 200 200" fill="none" stroke="#1A1A1A" stroke-width="8">
  <rect x="40" y="60" width="120" height="110" fill="#221610" stroke="#1A1A1A" stroke-width="8"/>
  <rect x="40" y="60" width="120" height="24" fill="#FF3B27" stroke="#1A1A1A" stroke-width="8"/>
  <rect x="56" y="96" width="20" height="50" fill="#F5F2E8"/>
  <rect x="56" y="96" width="20" height="14" fill="#1A1A1A"/>
  <rect x="84" y="96" width="20" height="50" fill="#F5F2E8"/>
  <rect x="84" y="96" width="20" height="14" fill="#1A1A1A"/>
  <rect x="112" y="96" width="20" height="50" fill="#F5F2E8"/>
  <rect x="112" y="96" width="20" height="14" fill="#1A1A1A"/>
</svg>'''

SVG_FILTROS_CARTON = '''<svg viewBox="0 0 200 200" fill="none" stroke="#1A1A1A" stroke-width="8">
  <rect x="40" y="70" width="120" height="100" fill="#8a6942" stroke="#1A1A1A" stroke-width="8"/>
  <rect x="40" y="70" width="120" height="20" fill="#1A1A1A"/>
  <g fill="#F5F2E8">
    <circle cx="60" cy="110" r="4"/><circle cx="80" cy="110" r="4"/>
    <circle cx="100" cy="110" r="4"/><circle cx="120" cy="110" r="4"/>
    <circle cx="140" cy="110" r="4"/>
    <circle cx="60" cy="130" r="4"/><circle cx="80" cy="130" r="4"/>
    <circle cx="100" cy="130" r="4"/><circle cx="120" cy="130" r="4"/>
    <circle cx="140" cy="130" r="4"/>
    <circle cx="60" cy="150" r="4"/><circle cx="80" cy="150" r="4"/>
    <circle cx="100" cy="150" r="4"/><circle cx="120" cy="150" r="4"/>
    <circle cx="140" cy="150" r="4"/>
  </g>
</svg>'''

PRODUCT_SVGS = {
    "papers-marron": SVG_PAPERS_MARRON,
    "papers-alien": SVG_PAPERS_ALIEN,
    "papers-celulosa": SVG_PAPERS_CELULOSA,
    "conos": SVG_CONOS,
    "conos-celulosa": SVG_CONOS_CELULOSA,
    "conos-rp": SVG_CONOS_RP,
    "grinder-basic": SVG_GRINDER_BASIC,
    "grinder-rellenador": SVG_GRINDER_RELLENADOR,
    "filtros-carbon": SVG_FILTROS_CARBON,
    "filtros-carton": SVG_FILTROS_CARTON,
}

# ===== BASE STYLES (for stories) =====

BASE_STYLES = """
:root {
  --primary: #BB3B2E; --orange: #FF3B27; --secondary: #4D5431;
  --cream: #F5F2E8; --dark: #1A1A1A; --background-dark: #221610;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; overflow: hidden; font-family: 'Kanit', system-ui, sans-serif; }
.frame { position: relative; width: 1080px; height: 1920px; overflow: hidden; }
.frame.cream { background: var(--cream); color: var(--dark); }
.frame.dark  { background: var(--background-dark); color: var(--cream); }
.frame.orange { background: var(--orange); color: var(--cream); }

/* paper grain */
.frame::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.10  0 0 0 0 0.08  0 0 0 0 0.06  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  opacity: 0.55; mix-blend-mode: multiply; z-index: 0;
}
.frame.dark::before, .frame.orange::before { mix-blend-mode: screen; opacity: 0.18; }

/* header + footer shared */
/* IG Stories safe zones (1080x1920): ~250px top for avatar/username/timer,
   ~310px bottom for reply bar + reactions. We leave comfortable margin so
   nothing important clashes with IG chrome. */
.s-top {
  position: absolute; top: 280px; left: 64px; right: 64px;
  display: flex; justify-content: space-between; align-items: center; z-index: 3;
}
.s-brand {
  display: flex; align-items: center; gap: 12px;
  font-weight: 900; font-size: 22px; letter-spacing: 0.28em; text-transform: uppercase;
}
.s-brand .dot { width: 12px; height: 12px; background: var(--primary); border: 3px solid currentColor; }
.frame.dark .s-brand .dot, .frame.orange .s-brand .dot { background: var(--cream); }
.s-tag {
  font-weight: 700; font-size: 18px; letter-spacing: 0.22em;
  text-transform: uppercase; padding: 8px 14px;
  border: 3px solid currentColor; box-shadow: 4px 4px 0 0 currentColor;
}

.s-footer {
  position: absolute; bottom: 270px; left: 64px; right: 64px;
  display: flex; justify-content: space-between; align-items: center;
  border-top: 3px solid currentColor; padding-top: 20px; z-index: 3;
}
.s-handle { font-weight: 900; font-size: 36px; line-height: 1; }
.s-handle .at { color: var(--primary); }
.frame.dark .s-handle .at, .frame.orange .s-handle .at { color: var(--cream); }
.s-meta {
  text-align: right; font-weight: 700; font-size: 18px;
  letter-spacing: 0.18em; text-transform: uppercase;
}
.s-meta .accent { color: var(--primary); font-weight: 900; }
.frame.dark .s-meta .accent, .frame.orange .s-meta .accent { color: var(--cream); }

/* Hide legacy s-footer, disclaimer is the only footer */
.s-footer { display: none !important; }
/* Legal disclaimer on every story frame — clear of IG's reply bar.
   Bottom safe-zone at 250px keeps the full disclaimer visible. */
.frame::after {
  content: "+18 · ACCESORIOS PARA TABACO LEGAL · ENROLA NO PROMUEVE SUSTANCIAS ILEGALES · CONSUME CON MODERACIÓN";
  position: absolute;
  left: 0; right: 0; bottom: 250px;
  padding: 14px 24px;
  text-align: center;
  font-family: 'Kanit', sans-serif;
  font-weight: 900;
  font-size: 17px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: #F5F2E8;
  color: #1A1A1A;
  border-top: 4px solid #1A1A1A;
  border-bottom: 4px solid #1A1A1A;
  z-index: 6;
  line-height: 1.3;
}
"""

# ===== TEMPLATE: Product Spotlight =====

TPL_PRODUCT = Template(r"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
$BASE_STYLES
.center {
  position: absolute; left: 64px; right: 64px; top: 50%; transform: translateY(-50%);
  z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 36px; text-align: center;
}
.eyebrow { font-weight: 700; font-size: 28px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--primary); }
.product-tile {
  width: 620px; height: 620px; background: var(--cream);
  border: 8px solid var(--dark); box-shadow: 22px 22px 0 0 var(--orange);
  display: flex; align-items: center; justify-content: center; padding: 40px;
}
.product-tile svg { width: 100%; height: 100%; }
.h1 {
  font-weight: 900; font-size: 108px; line-height: 0.9;
  letter-spacing: -0.04em; text-transform: uppercase;
}
.h1 .em { color: var(--primary); }
.price-pill {
  display: inline-block; background: var(--orange); color: var(--cream);
  font-weight: 900; font-size: 68px; line-height: 1; padding: 18px 32px;
  border: 6px solid var(--dark); box-shadow: 14px 14px 0 0 var(--dark);
  transform: rotate(-1.5deg); letter-spacing: -0.02em;
}
</style></head><body>
<div class="frame cream">
  <div class="s-top">
    <div class="s-brand"><span class="dot"></span>Enrola · Shop</div>
    <div class="s-tag">$tag</div>
  </div>
  <div class="center">
    <div class="eyebrow">$eyebrow</div>
    <div class="product-tile">$svg</div>
    <div class="h1">$name_a<br/><span class="em">$name_b</span></div>
    <div class="price-pill">$price</div>
  </div>
  <div class="s-footer">
    <div class="s-handle"><span class="at">@</span>enrola.shop</div>
    <div class="s-meta">Tienda · <span class="accent">enrola.shop</span></div>
  </div>
</div>
</body></html>""")

# ===== TEMPLATE: Poll =====

TPL_POLL = Template(r"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
$BASE_STYLES
.poll-stack {
  position: absolute; left: 64px; right: 64px; top: 50%; transform: translateY(-50%);
  z-index: 2; display: flex; flex-direction: column; gap: 40px;
}
.eyebrow {
  font-weight: 700; font-size: 28px; letter-spacing: 0.28em;
  text-transform: uppercase; color: var(--primary); text-align: center;
}
.h1 {
  font-weight: 900; font-size: 140px; line-height: 0.92;
  letter-spacing: -0.04em; text-transform: uppercase; text-align: center;
}
.h1 .em { color: var(--primary); }
.options {
  display: grid; grid-template-columns: 1fr 1fr; gap: 22px;
}
.opt {
  padding: 44px 28px; min-height: 360px;
  border: 6px solid var(--dark);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 18px; text-align: center;
}
.opt.a { background: var(--cream); box-shadow: 14px 14px 0 0 var(--dark); }
.opt.b { background: var(--background-dark); color: var(--cream); box-shadow: 14px 14px 0 0 var(--orange); }
.opt .letter {
  font-weight: 900; font-size: 100px; line-height: 1; letter-spacing: -0.05em;
}
.opt.a .letter { color: var(--primary); }
.opt.b .letter { color: var(--orange); }
.opt .label {
  font-weight: 900; font-size: 34px; line-height: 1.1;
  letter-spacing: 0.02em; text-transform: uppercase;
}
.cta-line {
  text-align: center; font-weight: 700; font-size: 28px; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--secondary);
}
</style></head><body>
<div class="frame cream">
  <div class="s-top">
    <div class="s-brand"><span class="dot"></span>Enrola · Shop</div>
    <div class="s-tag">Poll</div>
  </div>
  <div class="poll-stack">
    <div>
      <div class="eyebrow">$eyebrow</div>
      <div class="h1" style="margin-top: 8px;">$question_a<br/><span class="em">$question_b</span></div>
    </div>
    <div class="options">
      <div class="opt a"><div class="letter">A</div><div class="label">$option_a</div></div>
      <div class="opt b"><div class="letter">B</div><div class="label">$option_b</div></div>
    </div>
    <div class="cta-line">Comenta tu letra 👇</div>
  </div>
  <div class="s-footer">
    <div class="s-handle"><span class="at">@</span>enrola.shop</div>
    <div class="s-meta">Tu <span class="accent">voto</span></div>
  </div>
</div>
</body></html>""")

# ===== TEMPLATE: Quote / Testimonio =====

TPL_QUOTE = Template(r"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
$BASE_STYLES
.center {
  position: absolute; left: 64px; right: 64px; top: 50%; transform: translateY(-50%);
  z-index: 2; display: flex; flex-direction: column; gap: 40px; align-items: center;
}
.eyebrow {
  font-weight: 700; font-size: 28px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--orange);
}
.big-q {
  font-weight: 900; font-size: 360px; line-height: 0.7;
  color: var(--orange); letter-spacing: -0.05em;
}
.bubble {
  background: var(--cream); color: var(--dark);
  border: 6px solid var(--dark);
  box-shadow: 18px 18px 0 0 var(--orange);
  padding: 44px 48px; max-width: 860px;
  display: flex; flex-direction: column; gap: 22px;
}
.bubble .quote {
  font-weight: 700; font-size: 54px; line-height: 1.2;
  letter-spacing: 0.01em;
}
.bubble .quote .em { color: var(--primary); font-weight: 900; }
.handle-row { display: flex; align-items: center; gap: 14px; }
.avatar { width: 50px; height: 50px; border-radius: 50%;
  background: linear-gradient(135deg, var(--orange), var(--primary));
  border: 3px solid var(--dark); flex-shrink: 0;
}
.pixname {
  display: inline-block; background: var(--dark); color: var(--dark);
  padding: 3px 14px; letter-spacing: 4px; filter: blur(2.5px); font-weight: 700;
  font-size: 22px; user-select: none;
}
.source {
  font-weight: 700; font-size: 18px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--secondary); margin-left: auto;
}
</style></head><body>
<div class="frame dark">
  <div class="s-top">
    <div class="s-brand" style="color: var(--cream);"><span class="dot"></span>Enrola · Shop</div>
    <div class="s-tag" style="color: var(--cream); box-shadow: 4px 4px 0 0 var(--cream);">Lo que dicen</div>
  </div>
  <div class="center">
    <div class="eyebrow">Testimonio · Semana</div>
    <div class="big-q">"</div>
    <div class="bubble">
      <div class="quote">$quote</div>
      <div class="handle-row">
        <div class="avatar"></div>
        <span class="pixname">████████</span>
        <span class="source">$source</span>
      </div>
    </div>
  </div>
  <div class="s-footer">
    <div class="s-handle" style="color: var(--cream);"><span class="at" style="color: var(--orange);">@</span>enrola.shop</div>
    <div class="s-meta" style="color: var(--cream);">Gracias · <span class="accent" style="color: var(--orange);">equipo</span></div>
  </div>
</div>
</body></html>""")

# ===== TEMPLATE: Did You Know =====

TPL_DYK = Template(r"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
$BASE_STYLES
.stack {
  position: absolute; left: 64px; right: 64px; top: 50%; transform: translateY(-50%);
  z-index: 2; display: flex; flex-direction: column; gap: 36px;
}
.eyebrow {
  display: inline-flex; align-self: flex-start;
  padding: 12px 22px; background: var(--dark); color: var(--cream);
  font-weight: 900; font-size: 24px; letter-spacing: 0.22em; text-transform: uppercase;
  border: 4px solid var(--dark);
  box-shadow: 8px 8px 0 0 var(--orange);
}
.h1 {
  font-weight: 900; font-size: 124px; line-height: 0.92;
  letter-spacing: -0.04em; text-transform: uppercase;
}
.h1 .em { color: var(--primary); }
.sub {
  font-weight: 700; font-size: 36px; line-height: 1.28;
  letter-spacing: 0.01em; color: var(--dark);
  max-width: 900px;
}
.sub .em { color: var(--primary); font-weight: 900; }
.big-info {
  display: flex; align-items: center; gap: 22px;
  padding: 28px 30px; margin-top: 4px;
  background: var(--orange); color: var(--cream);
  border: 5px solid var(--dark); box-shadow: 12px 12px 0 0 var(--dark);
}
.big-info .icon {
  width: 72px; height: 72px; background: var(--cream); color: var(--dark);
  display: inline-flex; align-items: center; justify-content: center;
  border: 4px solid var(--dark); font-weight: 900; font-size: 42px; flex-shrink: 0;
}
.big-info .text {
  font-weight: 900; font-size: 32px; line-height: 1.15;
  letter-spacing: 0.02em; text-transform: uppercase;
}
</style></head><body>
<div class="frame cream">
  <div class="s-top">
    <div class="s-brand"><span class="dot"></span>Enrola · Shop</div>
    <div class="s-tag">Sabías que</div>
  </div>
  <div class="stack">
    <div class="eyebrow">Did you know</div>
    <div class="h1">$headline_a<br/><span class="em">$headline_b</span></div>
    <div class="sub">$body</div>
    <div class="big-info">
      <div class="icon">ⓘ</div>
      <div class="text">$pill</div>
    </div>
  </div>
  <div class="s-footer">
    <div class="s-handle"><span class="at">@</span>enrola.shop</div>
    <div class="s-meta">El arte · <span class="accent">de armar</span></div>
  </div>
</div>
</body></html>""")

# ===== TEMPLATE: BTS =====

TPL_BTS = Template(r"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
$BASE_STYLES
.frame.cream { background: radial-gradient(ellipse at 30% 30%, #F8EDD2 0%, #E8D8B0 55%, #D4BC88 100%); }
.stack {
  position: absolute; left: 64px; right: 64px; top: 50%; transform: translateY(-50%);
  z-index: 2; display: flex; flex-direction: column; gap: 40px;
}
.eyebrow {
  font-weight: 700; font-size: 28px; letter-spacing: 0.32em;
  text-transform: uppercase; color: var(--primary);
}
.h1 {
  font-weight: 900; font-size: 148px; line-height: 0.9;
  letter-spacing: -0.045em; text-transform: uppercase; color: var(--dark);
}
.h1 .em { color: var(--primary); }
.scene-row {
  display: flex; align-items: flex-end; gap: 28px; margin-top: 20px;
  filter: drop-shadow(0 14px 0 rgba(0,0,0,0.12));
}
.pack {
  width: 220px; height: 280px;
  background: var(--cream); border: 6px solid var(--dark);
  box-shadow: 12px 12px 0 0 var(--dark); transform: rotate(-3deg);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.pack svg { width: 80%; height: 80%; }
.small-item {
  width: 120px; height: 180px;
  background: var(--dark); color: var(--cream);
  display: flex; align-items: center; justify-content: center;
  border: 5px solid var(--dark); box-shadow: 10px 10px 0 0 var(--orange);
  transform: rotate(4deg); padding: 14px;
}
.small-item svg { width: 90%; height: 90%; }
.caption {
  font-weight: 700; font-size: 28px; line-height: 1.3;
  letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--dark); max-width: 820px;
  margin-top: 20px;
}
.caption .em { color: var(--primary); font-weight: 900; }
</style></head><body>
<div class="frame cream">
  <div class="s-top">
    <div class="s-brand"><span class="dot"></span>Enrola · Shop</div>
    <div class="s-tag">BTS</div>
  </div>
  <div class="stack">
    <div class="eyebrow">$eyebrow</div>
    <div class="h1">$h1_a<br/><span class="em">$h1_b</span></div>
    <div class="scene-row">
      <div class="pack">$svg_a</div>
      <div class="small-item">$svg_b</div>
    </div>
    <div class="caption">$caption</div>
  </div>
  <div class="s-footer">
    <div class="s-handle"><span class="at">@</span>enrola.shop</div>
    <div class="s-meta">Hecho · <span class="accent">a mano</span></div>
  </div>
</div>
</body></html>""")

# ===== TEMPLATE: Combo Tip =====

TPL_COMBO = Template(r"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
$BASE_STYLES
.stack {
  position: absolute; left: 64px; right: 64px; top: 50%; transform: translateY(-50%);
  z-index: 2; display: flex; flex-direction: column; gap: 22px;
}
.eyebrow {
  font-weight: 700; font-size: 26px; letter-spacing: 0.28em;
  text-transform: uppercase; color: var(--cream); text-align: center;
}
.h1 {
  font-weight: 900; font-size: 116px; line-height: 0.9;
  letter-spacing: -0.045em; text-transform: uppercase;
  color: var(--cream); text-align: center;
}
.h1 .em { color: var(--dark); }
.tiers {
  display: flex; flex-direction: column; gap: 14px;
}
.tier-box {
  background: var(--cream); color: var(--dark);
  border: 5px solid var(--dark);
  box-shadow: 10px 10px 0 0 var(--dark);
  padding: 24px 28px;
  display: flex; justify-content: space-between; align-items: center;
}
.tier-box .qty {
  font-weight: 900; font-size: 76px; line-height: 1;
  letter-spacing: -0.04em;
}
.tier-box .qty .plus { color: var(--orange); }
.tier-box .qty-label {
  font-weight: 700; font-size: 18px; letter-spacing: 0.22em;
  text-transform: uppercase; margin-top: 4px; color: var(--secondary);
}
.tier-box .discount {
  font-weight: 900; font-size: 88px; line-height: 1;
  letter-spacing: -0.04em; color: var(--orange);
}
.tagline {
  text-align: center;
  font-weight: 700; font-size: 26px; line-height: 1.25;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--cream);
}
.tagline .em { color: var(--dark); font-weight: 900; }
</style></head><body>
<div class="frame orange">
  <div class="s-top">
    <div class="s-brand" style="color: var(--cream);"><span class="dot"></span>Enrola · Shop</div>
    <div class="s-tag" style="color: var(--cream); box-shadow: 4px 4px 0 0 var(--cream);">Combo</div>
  </div>
  <div class="stack">
    <div class="eyebrow">$eyebrow</div>
    <div class="h1">Mezcla<br/><span class="em">lo que quieras.</span></div>
    <div class="tiers">
      <div class="tier-box">
        <div>
          <div class="qty">3<span class="plus">+</span></div>
          <div class="qty-label">productos</div>
        </div>
        <div class="discount">-10%</div>
      </div>
      <div class="tier-box">
        <div>
          <div class="qty">5<span class="plus">+</span></div>
          <div class="qty-label">productos</div>
        </div>
        <div class="discount">-15%</div>
      </div>
      <div class="tier-box">
        <div>
          <div class="qty">10<span class="plus">+</span></div>
          <div class="qty-label">productos</div>
        </div>
        <div class="discount">-20%</div>
      </div>
    </div>
    <div class="tagline">$tagline</div>
  </div>
  <div class="s-footer">
    <div class="s-handle" style="color: var(--cream);"><span class="at" style="color: var(--cream);">@</span>enrola.shop</div>
    <div class="s-meta" style="color: var(--cream);">Sin cupón · <span class="accent" style="color: var(--cream);">automático</span></div>
  </div>
</div>
</body></html>""")

# ===== TEMPLATE: Repost Feed =====

TPL_REPOST = Template(r"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
$BASE_STYLES
.stack {
  position: absolute; left: 64px; right: 64px; top: 50%; transform: translateY(-50%);
  z-index: 2; display: flex; flex-direction: column; gap: 40px; align-items: center;
  text-align: center;
}
.new-badge {
  display: inline-block; background: var(--orange); color: var(--cream);
  font-weight: 900; font-size: 32px; letter-spacing: 0.28em; text-transform: uppercase;
  padding: 16px 28px; border: 5px solid var(--dark);
  box-shadow: 10px 10px 0 0 var(--dark); transform: rotate(-1.5deg);
}
.post-type {
  font-weight: 700; font-size: 26px; letter-spacing: 0.22em;
  text-transform: uppercase; color: var(--primary);
}
.h1 {
  font-weight: 900; font-size: 128px; line-height: 0.9;
  letter-spacing: -0.045em; text-transform: uppercase;
}
.h1 .em { color: var(--primary); }
.arrow-wrap {
  display: flex; flex-direction: column; align-items: center; gap: 14px;
}
.arrow {
  font-weight: 900; font-size: 120px; line-height: 1;
  color: var(--primary);
  animation: none;
}
.cta {
  font-weight: 900; font-size: 36px; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--dark);
  padding: 14px 26px; background: var(--cream);
  border: 4px solid var(--dark); box-shadow: 8px 8px 0 0 var(--dark);
}
</style></head><body>
<div class="frame cream">
  <div class="s-top">
    <div class="s-brand"><span class="dot"></span>Enrola · Shop</div>
    <div class="s-tag">Nuevo post</div>
  </div>
  <div class="stack">
    <div class="new-badge">🔴 en el feed</div>
    <div class="post-type">$post_type</div>
    <div class="h1">$h1_a<br/><span class="em">$h1_b</span></div>
    <div class="arrow-wrap">
      <div class="arrow">↓</div>
      <div class="cta">Míralo ya</div>
    </div>
  </div>
  <div class="s-footer">
    <div class="s-handle"><span class="at">@</span>enrola.shop</div>
    <div class="s-meta">Swipe · <span class="accent">feed</span></div>
  </div>
</div>
</body></html>""")

# ===== TEMPLATE: Mood =====

TPL_MOOD = Template(r"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
$BASE_STYLES
.frame.cream {
  background: radial-gradient(ellipse at 40% 30%, #F8EDD2 0%, #E8D8B0 60%, #B89552 100%);
}
.stack {
  position: absolute; left: 64px; right: 64px; top: 55%; transform: translateY(-50%);
  z-index: 2; display: flex; flex-direction: column; gap: 34px;
}
.eyebrow {
  font-weight: 700; font-size: 26px; letter-spacing: 0.32em;
  text-transform: uppercase; color: var(--primary);
}
.h1 {
  font-weight: 900; font-size: 160px; line-height: 0.88;
  letter-spacing: -0.05em; text-transform: uppercase;
  color: var(--dark);
}
.h1 .em { color: var(--primary); }
.question {
  font-weight: 700; font-size: 36px; line-height: 1.3;
  letter-spacing: 0.02em; color: var(--dark);
  margin-top: 8px;
}
.question .em { color: var(--primary); font-weight: 900; }
.prop-row {
  position: absolute; left: 0; right: 0; bottom: 410px;
  z-index: 1; display: flex; justify-content: center; gap: 28px;
  filter: drop-shadow(0 10px 0 rgba(0,0,0,0.18));
}
.prop {
  width: 180px; height: 220px;
  background: var(--cream); border: 5px solid var(--dark);
  box-shadow: 10px 10px 0 0 var(--dark);
  display: flex; align-items: center; justify-content: center; padding: 18px;
}
.prop svg { width: 100%; height: 100%; }
.prop:nth-child(2) { transform: rotate(-3deg) translateY(-10px); }
.prop:nth-child(3) { transform: rotate(2deg) translateY(14px); }
</style></head><body>
<div class="frame cream">
  <div class="s-top">
    <div class="s-brand"><span class="dot"></span>Enrola · Shop</div>
    <div class="s-tag">$tag</div>
  </div>
  <div class="stack">
    <div class="eyebrow">$eyebrow</div>
    <div class="h1">$h1_a<br/><span class="em">$h1_b</span></div>
    <div class="question">$question</div>
  </div>
  <div class="prop-row">
    <div class="prop">$svg_a</div>
    <div class="prop">$svg_b</div>
    <div class="prop">$svg_c</div>
  </div>
  <div class="s-footer">
    <div class="s-handle"><span class="at">@</span>enrola.shop</div>
    <div class="s-meta">Link · <span class="accent">en la bio</span></div>
  </div>
</div>
</body></html>""")

# ===== CALENDAR (70 entries) =====

CALENDAR = [
    # Week 1
    {"date":"2026-04-27","slot":1,"type":"repost","vars":{"post_type":"Reel · Educational","h1_a":"Carbón","h1_b":"activo."}},
    {"date":"2026-04-27","slot":2,"type":"dyk","vars":{"headline_a":"Carbón activo","headline_b":"atrapa todo.","body":"El carbón activo absorbe partículas y calor. Humo <span class='em'>más limpio</span>, sabor más definido.","pill":"Pack 10 uds · €7"}},
    {"date":"2026-04-27","slot":3,"type":"product","vars":{"eyebrow":"Rolling Paper · Hecho a mano","name_a":"Papel","name_b":"Marrón.","price":"€2.50","tag":"Papers","svg_key":"papers-marron"}},
    {"date":"2026-04-28","slot":1,"type":"poll","vars":{"eyebrow":"Poll semanal","question_a":"¿Papers","question_b":"con sabor o sin?","option_a":"Sin sabor","option_b":"Con sabor"}},
    {"date":"2026-04-28","slot":2,"type":"bts","vars":{"eyebrow":"Lunes de organizar","h1_a":"Catálogo","h1_b":"al día.","caption":"Cada producto revisado antes de salir. <span class='em'>Sin excepciones.</span>","svg_a":"papers-alien","svg_b":"filtros-carbon"}},
    {"date":"2026-04-29","slot":1,"type":"product","vars":{"eyebrow":"Rolling Paper · 15 sabores","name_a":"Alien","name_b":"Puff.","price":"€2.50","tag":"Alien","svg_key":"papers-alien"}},
    {"date":"2026-04-29","slot":2,"type":"combo","vars":{"eyebrow":"Combo permanente","qty":"10","discount":"10","tagline":"Sin cupón. <span class='em'>Automático</span> en checkout."}},
    {"date":"2026-04-30","slot":1,"type":"repost","vars":{"post_type":"Reel · Educational · HOY","h1_a":"¿Por qué","h1_b":"carbón activo?"}},
    {"date":"2026-04-30","slot":2,"type":"dyk","vars":{"headline_a":"Pack 10","headline_b":"por €7.","body":"Diez filtros de carbón activo por el precio de <span class='em'>un combo</span>. Humo más suave, menos irritación.","pill":"Tienda · filtros"}},
    {"date":"2026-04-30","slot":3,"type":"poll","vars":{"eyebrow":"Tu filtro","question_a":"¿Carbón","question_b":"o cartón?","option_a":"Carbón activo","option_b":"Cartón perforado"}},
    {"date":"2026-05-01","slot":1,"type":"product","vars":{"eyebrow":"Filtros · Alien Puff","name_a":"Carbón","name_b":"Activo.","price":"€7.00","tag":"10 uds","svg_key":"filtros-carbon"}},
    {"date":"2026-05-01","slot":2,"type":"quote","vars":{"quote":"\"El Alien de <span class='em'>Fresa</span> es candela 🔥 volveré.\"","source":"DM · IG"}},
    {"date":"2026-05-02","slot":1,"type":"mood","vars":{"tag":"Sábado","eyebrow":"Weekend mood","h1_a":"Arma","h1_b":"tu combo.","question":"¿Papers, conos o filtros? <span class='em'>Mezcla lo que quieras.</span>","svg_a":"papers-marron","svg_b":"conos","svg_c":"filtros-carbon"}},
    {"date":"2026-05-02","slot":2,"type":"combo","vars":{"eyebrow":"Sábado · aprovecha","qty":"10","discount":"10","tagline":"Mezcla lo que quieras. <span class='em'>Auto</span> en checkout."}},
    {"date":"2026-05-03","slot":1,"type":"bts","vars":{"eyebrow":"Domingo · prep","h1_a":"Semana","h1_b":"nueva.","caption":"Organizando todo para empezar el lunes con el <span class='em'>catálogo listo</span>.","svg_a":"conos","svg_b":"grinder-basic"}},
    {"date":"2026-05-03","slot":2,"type":"product","vars":{"eyebrow":"Grinder · Clásico","name_a":"Plástico","name_b":"60mm.","price":"€6.00","tag":"Grinders","svg_key":"grinder-basic"}},
    # Week 2
    {"date":"2026-05-04","slot":1,"type":"repost","vars":{"post_type":"Carrusel · 15 sabores","h1_a":"Los 15","h1_b":"sabores."}},
    {"date":"2026-05-04","slot":2,"type":"dyk","vars":{"headline_a":"15 sabores","headline_b":"3 familias.","body":"Frutos del bosque · frutales · aromáticos. <span class='em'>Encuentra el tuyo</span> en tienda.","pill":"Papel saborizado · €2.50"}},
    {"date":"2026-05-04","slot":3,"type":"product","vars":{"eyebrow":"Conos · Saborizados","name_a":"Alien","name_b":"Puff.","price":"€10","tag":"12 uds","svg_key":"conos"}},
    {"date":"2026-05-05","slot":1,"type":"poll","vars":{"eyebrow":"Tu familia de sabor","question_a":"¿Bosque","question_b":"o frutales?","option_a":"Frutos del bosque","option_b":"Frutales"}},
    {"date":"2026-05-05","slot":2,"type":"bts","vars":{"eyebrow":"Stock check","h1_a":"Revisando","h1_b":"sabores.","caption":"Cada lote probado antes de entrar al catálogo. <span class='em'>Calidad real.</span>","svg_a":"papers-alien","svg_b":"conos"}},
    {"date":"2026-05-06","slot":1,"type":"product","vars":{"eyebrow":"Rolling Paper · Premium","name_a":"Celulosa","name_b":"Transp.","price":"€3.00","tag":"Papers","svg_key":"papers-celulosa"}},
    {"date":"2026-05-06","slot":2,"type":"combo","vars":{"eyebrow":"Próximo nivel","qty":"15","discount":"15","tagline":"Más items, <span class='em'>más descuento</span>. Así de simple."}},
    {"date":"2026-05-07","slot":1,"type":"repost","vars":{"post_type":"Reel · BTS · HOY","h1_a":"Así","h1_b":"armamos."}},
    {"date":"2026-05-07","slot":2,"type":"dyk","vars":{"headline_a":"Celulosa","headline_b":"transparente.","body":"Ver cómo va tu armado. Quema lenta y pareja — <span class='em'>perfecto para la playa</span>.","pill":"€3.00 · papers"}},
    {"date":"2026-05-07","slot":3,"type":"poll","vars":{"eyebrow":"Tu workflow","question_a":"¿Conos pre","question_b":"o los armas tú?","option_a":"Pre-armados","option_b":"Los armo yo"}},
    {"date":"2026-05-08","slot":1,"type":"product","vars":{"eyebrow":"Conos · Celulosa","name_a":"Cono","name_b":"Transp.","price":"€11","tag":"12 uds","svg_key":"conos-celulosa"}},
    {"date":"2026-05-08","slot":2,"type":"quote","vars":{"quote":"\"Los conos <span class='em'>ahorran tiempo</span>, quedan parejos, sin misterio.\"","source":"Comment · IG"}},
    {"date":"2026-05-09","slot":1,"type":"mood","vars":{"tag":"Sábado","eyebrow":"Alien day","h1_a":"Sábado","h1_b":"+ Alien.","question":"Combo clásico. <span class='em'>15 sabores</span> esperando.","svg_a":"papers-alien","svg_b":"conos","svg_c":"filtros-carbon"}},
    {"date":"2026-05-09","slot":2,"type":"combo","vars":{"eyebrow":"Máximo descuento","qty":"20","discount":"20","tagline":"10 items · <span class='em'>20% OFF</span>. El máximo."}},
    {"date":"2026-05-10","slot":1,"type":"bts","vars":{"eyebrow":"Domingo creativo","h1_a":"Mesa","h1_b":"de trabajo.","caption":"Conos + grinder. <span class='em'>El arte de armar</span> empieza aquí.","svg_a":"conos","svg_b":"grinder-rellenador"}},
    {"date":"2026-05-10","slot":2,"type":"product","vars":{"eyebrow":"Grinder · Especializado","name_a":"Con porta","name_b":"conos.","price":"€10","tag":"Rellenador","svg_key":"grinder-rellenador"}},
    # Week 3
    {"date":"2026-05-11","slot":1,"type":"repost","vars":{"post_type":"Post · This or That","h1_a":"¿Grinder","h1_b":"A o B?"}},
    {"date":"2026-05-11","slot":2,"type":"dyk","vars":{"headline_a":"Dientes","headline_b":"afilados.","body":"Corte fino = quema pareja = <span class='em'>mejor sabor</span>. No es magia, es física.","pill":"Grinders · desde €6"}},
    {"date":"2026-05-11","slot":3,"type":"product","vars":{"eyebrow":"Conos · Rolling Paper","name_a":"Pack","name_b":"12 uds.","price":"€20","tag":"RP Conos","svg_key":"conos-rp"}},
    {"date":"2026-05-12","slot":1,"type":"poll","vars":{"eyebrow":"Recap post de ayer","question_a":"¿Ganó","question_b":"A o B?","option_a":"A · Rellenador","option_b":"B · Plástico 60mm"}},
    {"date":"2026-05-12","slot":2,"type":"bts","vars":{"eyebrow":"Limpieza martes","h1_a":"Grinders","h1_b":"al día.","caption":"Cada semana revisamos. Si algo no pasa QA, <span class='em'>no se vende</span>.","svg_a":"grinder-basic","svg_b":"grinder-rellenador"}},
    {"date":"2026-05-13","slot":1,"type":"product","vars":{"eyebrow":"Filtros · Económico","name_a":"Cartón","name_b":"Puff Man.","price":"€1.00","tag":"Filtros","svg_key":"filtros-carton"}},
    {"date":"2026-05-13","slot":2,"type":"combo","vars":{"eyebrow":"Cómo llegar a 3","qty":"10","discount":"10","tagline":"Papers + conos + filtros = <span class='em'>combo base</span>."}},
    {"date":"2026-05-14","slot":1,"type":"repost","vars":{"post_type":"Reel · Promocional · HOY","h1_a":"Mezcla lo","h1_b":"que quieras."}},
    {"date":"2026-05-14","slot":2,"type":"dyk","vars":{"headline_a":"Sin cupón","headline_b":"necesario.","body":"Los descuentos son automáticos. Solo <span class='em'>suma al carrito</span> y listo.","pill":"10/15/20% · automático"}},
    {"date":"2026-05-14","slot":3,"type":"combo","vars":{"eyebrow":"Calcula tu combo","qty":"","discount":"","tagline":"Cuanto más mezclas, <span class='em'>más ahorras</span>."}},
    {"date":"2026-05-15","slot":1,"type":"product","vars":{"eyebrow":"Rolling Paper · Unbleached","name_a":"Papel","name_b":"Marrón.","price":"€2.50","tag":"Cáñamo","svg_key":"papers-marron"}},
    {"date":"2026-05-15","slot":2,"type":"quote","vars":{"quote":"\"El <span class='em'>carbón activo</span> cambia el juego. No vuelvo atrás.\"","source":"DM · IG"}},
    {"date":"2026-05-16","slot":1,"type":"mood","vars":{"tag":"Sábado","eyebrow":"Weekend","h1_a":"Sábado","h1_b":"slow.","question":"Catálogo abierto. <span class='em'>Explora</span> sin prisa.","svg_a":"papers-marron","svg_b":"grinder-basic","svg_c":"conos"}},
    {"date":"2026-05-16","slot":2,"type":"combo","vars":{"eyebrow":"Valencia perk","qty":"10","discount":"10","tagline":"Y con +€10 · <span class='em'>envío gratis</span> en VLN."}},
    {"date":"2026-05-17","slot":1,"type":"bts","vars":{"eyebrow":"Domingo armando","h1_a":"Combos","h1_b":"listos.","caption":"Los combos saliendo esta semana se arman el domingo. <span class='em'>Sin apuros.</span>","svg_a":"papers-alien","svg_b":"filtros-carbon"}},
    {"date":"2026-05-17","slot":2,"type":"product","vars":{"eyebrow":"Clásico sin blanquear","name_a":"Papel","name_b":"Marrón.","price":"€2.50","tag":"Unbleached","svg_key":"papers-marron"}},
    # Week 4
    {"date":"2026-05-18","slot":1,"type":"repost","vars":{"post_type":"Carrusel · 1 mes · HOY","h1_a":"Un mes","h1_b":"armando."}},
    {"date":"2026-05-18","slot":2,"type":"dyk","vars":{"headline_a":"30 días","headline_b":"de tienda.","body":"Gracias por cada pedido. El catálogo crece con <span class='em'>lo que ustedes piden</span>.","pill":"Drop 001 · gracias"}},
    {"date":"2026-05-18","slot":3,"type":"product","vars":{"eyebrow":"El más pedido del mes","name_a":"Papel","name_b":"Marrón.","price":"€2.50","tag":"Top","svg_key":"papers-marron"}},
    {"date":"2026-05-19","slot":1,"type":"poll","vars":{"eyebrow":"Tu voto","question_a":"¿Qué categoría","question_b":"viene primero?","option_a":"Más sabores","option_b":"Accesorios nuevos"}},
    {"date":"2026-05-19","slot":2,"type":"bts","vars":{"eyebrow":"Inventario","h1_a":"Contando","h1_b":"y revisando.","caption":"Preparando el cierre de mes para planear el siguiente. <span class='em'>Con cuidado.</span>","svg_a":"filtros-carbon","svg_b":"grinder-basic"}},
    {"date":"2026-05-20","slot":1,"type":"product","vars":{"eyebrow":"Recordatorio top","name_a":"Filtros","name_b":"Carbón.","price":"€7.00","tag":"10 uds","svg_key":"filtros-carbon"}},
    {"date":"2026-05-20","slot":2,"type":"combo","vars":{"eyebrow":"Calc rápida","qty":"10","discount":"10","tagline":"Solo 3 items = <span class='em'>10% OFF</span>. Cuenta solo."}},
    {"date":"2026-05-21","slot":1,"type":"repost","vars":{"post_type":"Reel · Tips · HOY","h1_a":"3 errores","h1_b":"al armar."}},
    {"date":"2026-05-21","slot":2,"type":"dyk","vars":{"headline_a":"Buen armado","headline_b":"= buen material.","body":"La mitad del trabajo la hace el producto. La otra mitad, <span class='em'>tu práctica</span>.","pill":"Tienda · catálogo"}},
    {"date":"2026-05-21","slot":3,"type":"poll","vars":{"eyebrow":"Confesión","question_a":"¿Tu mayor","question_b":"error al armar?","option_a":"Desbalanceado","option_b":"Sin filtro"}},
    {"date":"2026-05-22","slot":1,"type":"product","vars":{"eyebrow":"Grinder · Básico","name_a":"Plástico","name_b":"60mm.","price":"€6.00","tag":"Clásico","svg_key":"grinder-basic"}},
    {"date":"2026-05-22","slot":2,"type":"quote","vars":{"quote":"\"<span class='em'>Mejor corte</span> de grinder que he probado. Se nota.\"","source":"DM · IG"}},
    {"date":"2026-05-23","slot":1,"type":"mood","vars":{"tag":"Sábado","eyebrow":"Slow weekend","h1_a":"Sin","h1_b":"prisa.","question":"El sábado es para <span class='em'>armar con calma</span>.","svg_a":"papers-celulosa","svg_b":"conos","svg_c":"grinder-rellenador"}},
    {"date":"2026-05-23","slot":2,"type":"combo","vars":{"eyebrow":"Tip · empezar bien","qty":"10","discount":"10","tagline":"Papers + filtros + grinder = <span class='em'>combo inicio</span>."}},
    {"date":"2026-05-24","slot":1,"type":"bts","vars":{"eyebrow":"Dominguero","h1_a":"Domingo","h1_b":"relax.","caption":"Papers en la mesa, café al lado. <span class='em'>Sin drama.</span>","svg_a":"papers-marron","svg_b":"filtros-carton"}},
    {"date":"2026-05-24","slot":2,"type":"product","vars":{"eyebrow":"Conos · Premium","name_a":"Celulosa","name_b":"Alien.","price":"€11","tag":"12 uds","svg_key":"conos-celulosa"}},
    # Week 5 (partial)
    {"date":"2026-05-25","slot":1,"type":"repost","vars":{"post_type":"Post · Dominguero (ayer)","h1_a":"¿Qué","h1_b":"armaste?"}},
    {"date":"2026-05-25","slot":2,"type":"dyk","vars":{"headline_a":"El arte","headline_b":"se aprende.","body":"Cada intento mejora el siguiente. Para eso <span class='em'>está el catálogo</span>.","pill":"Tienda · enrola.shop"}},
    {"date":"2026-05-25","slot":3,"type":"product","vars":{"eyebrow":"Rolling Paper · Premium","name_a":"Celulosa","name_b":"Transp.","price":"€3.00","tag":"Premium","svg_key":"papers-celulosa"}},
    {"date":"2026-05-26","slot":1,"type":"poll","vars":{"eyebrow":"Tu pedido","question_a":"¿Qué categoría","question_b":"agregamos?","option_a":"Pipas","option_b":"Bongs"}},
    {"date":"2026-05-26","slot":2,"type":"bts","vars":{"eyebrow":"Cierre mes","h1_a":"Gracias","h1_b":"por todo.","caption":"Último martes del mes. <span class='em'>Mes 2</span> arranca con más.","svg_a":"papers-alien","svg_b":"conos"}},
    {"date":"2026-05-26","slot":3,"type":"product","vars":{"eyebrow":"Filtros · Económico","name_a":"Cartón","name_b":"Puff Man.","price":"€1.00","tag":"Solo €1","svg_key":"filtros-carton"}},
]

# ===== HTML RENDERING =====

def render_html(entry):
    """Return rendered HTML string for a story entry."""
    t = entry["type"]
    vars_ = dict(entry["vars"])

    # Insert real product photos (transparent bg) for templates that need them
    if t == "product":
        vars_["svg"] = _img_tag(vars_.pop("svg_key"))
    elif t == "bts":
        vars_["svg_a"] = _img_tag(vars_["svg_a"])
        vars_["svg_b"] = _img_tag(vars_["svg_b"])
    elif t == "mood":
        vars_["svg_a"] = _img_tag(vars_["svg_a"])
        vars_["svg_b"] = _img_tag(vars_["svg_b"])
        vars_["svg_c"] = _img_tag(vars_["svg_c"])

    templates = {
        "product": TPL_PRODUCT, "poll": TPL_POLL, "quote": TPL_QUOTE,
        "dyk": TPL_DYK, "bts": TPL_BTS, "combo": TPL_COMBO,
        "repost": TPL_REPOST, "mood": TPL_MOOD,
    }
    tpl = templates[t]
    vars_["BASE_STYLES"] = BASE_STYLES
    return tpl.safe_substitute(vars_)

def render_chrome(html_path: Path, out_path: Path):
    """Render HTML file to PNG via Chrome headless.

    Chrome's --window-size=1080,1920 reserves ~120px for UI chrome even in
    headless mode, which would cut off our .frame::after disclaimer. We
    render at 2100 tall, then crop from top-left to exact 3840x2160 with PIL.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--allow-file-access-from-files", "--force-device-scale-factor=2",
        "--window-size=1080,2100",
        f"--screenshot={out_path}",
        f"file://{html_path}"
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    # Crop from top-left to exact 2160x3840 (no centering)
    from PIL import Image
    img = Image.open(out_path)
    img = img.crop((0, 0, 2160, 3840))
    img.save(out_path)

def main():
    dry = "--dry" in sys.argv
    tmp = Path(tempfile.mkdtemp(prefix="enrola-stories-"))
    total = len(CALENDAR)
    print(f"Generating {total} stories to {OUT_BASE}/")

    for i, entry in enumerate(CALENDAR, 1):
        date = entry["date"]
        slot = entry["slot"]
        t = entry["type"]
        out_dir = OUT_BASE / date
        out_name = f"{slot:02d}-{t}.png"
        html_path = tmp / f"{date}-{slot:02d}-{t}.html"
        png_path = out_dir / out_name

        html = render_html(entry)
        html_path.write_text(html)

        if dry:
            print(f"[{i:02d}/{total}] {date} slot {slot} · {t} (dry)")
            continue

        try:
            render_chrome(html_path, png_path)
            print(f"[{i:02d}/{total}] ✓ {date}/{out_name}")
        except subprocess.CalledProcessError as e:
            print(f"[{i:02d}/{total}] ✗ {date}/{out_name} — {e}")
            sys.exit(1)

    print(f"\n✓ Done. Output: {OUT_BASE}/")

if __name__ == "__main__":
    main()

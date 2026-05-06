#!/usr/bin/env python3
"""
Generate a single self-contained HTML file with all Reels + posts embedded as base64.
For sharing a preview with collaborators via Drive / email / direct.

Output: social/enrola-preview.html (~20-30 MB, no external deps).

Usage:
    cd storefront/scripts/social
    python3 scripts/build-preview-html.py
"""

import base64
import mimetypes
import re
import pathlib

HERE = pathlib.Path(__file__).parent.parent  # social/

# --- Content manifest (match dashboard.html data) ---
POSTS = [
    {
        "id": "post-05-carbon-activo",
        "number": "05",
        "title": "¿Qué hace el carbón activo?",
        "date": "Jueves 30 Abr · 20:00 VE",
        "pillar": "Educational",
        "format": "Reel",
        "previews": ["mes-2/post-05-carbon-activo/reel.mp4"],
        "cover": "mes-2/post-05-carbon-activo/cover.png",
        "copy": """El arte de armar empieza por cómo termina.

El carbón activo atrapa partículas y calor — el humo pasa más limpio, el sabor se nota más.

Pack de 10 uds · €7
Link en la bio → Filtros.

#EnrolaShop #ElArteDeArmar #CarbonActivo""",
    },
    {
        "id": "post-06-sabores-alien",
        "number": "06",
        "title": "Los 15 sabores de Alien Puff",
        "date": "Lunes 4 May · 19:00 VE",
        "pillar": "Educational",
        "format": "Carrusel",
        "previews": [
            "mes-2/post-06-sabores-alien/slides/01-portada.png",
            "mes-2/post-06-sabores-alien/slides/02-frutos-bosque.png",
            "mes-2/post-06-sabores-alien/slides/03-aromaticos.png",
            "mes-2/post-06-sabores-alien/slides/04-frutales.png",
        ],
        "copy": """15 sabores. 3 familias. Un solo catálogo.

Frutos del bosque · Aromáticos · Frutales.
Rolling paper saborizado Alien Puff — €2.50.

#EnrolaShop #ElArteDeArmar #AlienPuff""",
    },
    {
        "id": "post-07-pedido-bts",
        "number": "07",
        "title": "Un pedido de principio a fin",
        "date": "Jueves 7 May · 20:00 VE",
        "pillar": "BTS",
        "format": "Reel",
        "previews": ["mes-2/post-07-pedido-bts/reel.mp4"],
        "cover": "mes-2/post-07-pedido-bts/cover.png",
        "copy": """El arte de armar empieza antes de que abras tu paquete.

Cada pedido se prepara a mano, se revisa, se sella. Sin prisa.

Catálogo completo → link en la bio.

#EnrolaShop #ElArteDeArmar""",
    },
    {
        "id": "post-08-grinder-vs",
        "number": "08",
        "title": "¿Cuál grinder es tuyo?",
        "date": "Lunes 11 May · 19:00 VE",
        "pillar": "Engagement",
        "format": "Single",
        "previews": ["mes-2/post-08-grinder-vs/post.png"],
        "copy": """¿Equipo A o Equipo B?

A — Grinder Rellenador con portaconos · €10
    El que simplifica el armado.

B — Grinder Plástico 60mm · €6
    El clásico directo.

Comenta tu letra 👇 — mañana armamos post con el ganador.

Link en la bio → Grinders.

#EnrolaShop #ElArteDeArmar #Grinders""",
    },
    {
        "id": "post-09-mezcla-combo",
        "number": "09",
        "title": "Mezcla lo que quieras",
        "date": "Jueves 14 May · 20:00 VE",
        "pillar": "Promotional",
        "format": "Reel",
        "previews": ["mes-2/post-09-mezcla-combo/reel.mp4"],
        "cover": "mes-2/post-09-mezcla-combo/cover.png",
        "copy": """No necesitas cupón.

🟧 3 items → 10% OFF
🟧 5 items → 15% OFF
🟧 10 items → 20% OFF

Mezcla papers, conos, filtros, grinders — lo que quieras cuenta.
+ Envío gratis con €10 en Valencia.

Link en la bio → Tienda.

#EnrolaShop #ElArteDeArmar""",
    },
    {
        "id": "post-10-un-mes",
        "number": "10",
        "title": "Un mes de Enrola",
        "date": "Lunes 18 May · 19:00 VE",
        "pillar": "Social Proof",
        "format": "Carrusel",
        "previews": [
            "mes-2/post-10-un-mes/slides/01-portada.png",
            "mes-2/post-10-un-mes/slides/02-mas-vendidos.png",
            "mes-2/post-10-un-mes/slides/03-sabor-ganador.png",
            "mes-2/post-10-un-mes/slides/04-combo-favorito.png",
            "mes-2/post-10-un-mes/slides/05-teaser.png",
        ],
        "copy": """1 mes armando contigo.

Gracias por confiar en la tienda. Esto es lo que más salió, lo que más gustó, y lo que viene.

Únete al Club Enrola en enrola.shop.

#EnrolaShop #ElArteDeArmar #UnMes""",
    },
    {
        "id": "post-11-tips-enrolar",
        "number": "11",
        "title": "3 errores al armar",
        "date": "Jueves 21 May · 20:00 VE",
        "pillar": "Educational",
        "format": "Reel",
        "previews": ["mes-2/post-11-tips-enrolar/reel.mp4"],
        "cover": "mes-2/post-11-tips-enrolar/cover.png",
        "copy": """El arte de armar se aprende.

3 errores comunes que arruinan el resultado:
1 — Muy poco material: pierdes el cuerpo.
2 — Sin filtro: humo áspero y sabor plano.
3 — Grinder sucio: el corte cambia todo.

Todo lo necesitas en enrola.shop — link en la bio.

#EnrolaShop #ElArteDeArmar #Tips""",
    },
    {
        "id": "post-12-dominguero",
        "number": "12",
        "title": "Dominguero",
        "date": "Domingo 24 May · 14:00 VE",
        "pillar": "Engagement",
        "format": "Single",
        "previews": ["mes-2/post-12-dominguero/post.png"],
        "copy": """Dominguero.

¿Qué están armando hoy? 👇

Catálogo completo → link en la bio.

#EnrolaShop #ElArteDeArmar #Dominguero""",
    },
]


def file_to_data_uri(path: pathlib.Path) -> str:
    """Encode a file as a base64 data URI."""
    mime, _ = mimetypes.guess_type(str(path))
    if not mime:
        mime = "application/octet-stream"
    data = path.read_bytes()
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def embed_post(post):
    """Return HTML for one post card with all media inlined."""
    previews_html = []
    for pth in post["previews"]:
        p = HERE / pth
        if not p.exists():
            print(f"  ⚠ missing: {pth}")
            continue
        data_uri = file_to_data_uri(p)
        if pth.endswith(".mp4"):
            poster_attr = ""
            if post.get("cover"):
                cp = HERE / post["cover"]
                if cp.exists():
                    poster_attr = f' poster="{file_to_data_uri(cp)}"'
            previews_html.append(
                f'<video src="{data_uri}"{poster_attr} controls preload="metadata" playsinline style="max-width:100%;max-height:600px;display:block;background:#1A1A1A;"></video>'
            )
        else:
            previews_html.append(
                f'<img src="{data_uri}" loading="lazy" style="width:100%;display:block;background:#F5F2E8;">'
            )

    # Multi-image carousel
    if len(previews_html) > 1:
        slides = "".join(previews_html)
        media = f"""
        <div class="carousel-wrap">
          <div class="carousel" data-scroller>{slides}</div>
          <div class="carousel-nav">
            <button data-prev>←</button>
            <span class="counter"><span class="cur">1</span> / {len(previews_html)}</span>
            <button data-next>→</button>
          </div>
        </div>
        """
    else:
        media = f'<div class="media">{previews_html[0] if previews_html else ""}</div>'

    # Escape copy for HTML display (preserve newlines)
    copy_html = (post["copy"]
                 .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

    return f"""
    <article class="post">
      <header class="post-header">
        <div>
          <div class="post-title">#{post['number']} · {post['title']}</div>
          <div class="post-meta">{post['date']} · {post['pillar']}</div>
        </div>
        <span class="pill pill-{post['format'].lower()}">{post['format']}</span>
      </header>
      {media}
      <div class="copy-block">
        <div class="copy-label">Caption IG</div>
        <pre>{copy_html}</pre>
      </div>
    </article>
    """


def build():
    cards_html = "".join(embed_post(p) for p in POSTS)

    html = f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Enrola · Preview Mes 2</title>
  <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;900&display=swap" rel="stylesheet">
  <style>
    :root {{
      --primary: #BB3B2E; --orange: #FF3B27; --secondary: #4D5431;
      --cream: #F5F2E8; --dark: #1A1A1A; --muted: #85827d;
    }}
    * {{ margin:0; padding:0; box-sizing:border-box; }}
    body {{ font-family: 'Kanit', system-ui, sans-serif; background: var(--cream); color: var(--dark); padding-bottom: 80px; }}
    header.hero {{
      background: var(--dark); color: var(--cream); padding: 32px 28px;
      border-bottom: 4px solid var(--orange);
    }}
    header.hero h1 {{
      font-weight: 900; font-size: 36px; letter-spacing: -0.02em; text-transform: uppercase;
    }}
    header.hero h1 .em {{ color: var(--orange); }}
    header.hero .sub {{
      font-weight: 600; font-size: 16px; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--muted); margin-top: 8px;
    }}
    main {{ max-width: 720px; margin: 32px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 40px; }}
    .post {{
      background: white; border: 3px solid var(--dark);
      box-shadow: 8px 8px 0 0 var(--dark);
    }}
    .post-header {{
      padding: 16px 20px; border-bottom: 3px solid var(--dark);
      display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
    }}
    .post-title {{
      font-weight: 900; font-size: 20px; line-height: 1.2;
      letter-spacing: -0.01em;
    }}
    .post-meta {{
      font-weight: 600; font-size: 12px; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--muted); margin-top: 4px;
    }}
    .pill {{
      display: inline-block; padding: 4px 10px;
      font-size: 10px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;
      border: 2px solid var(--dark); background: var(--orange); color: var(--cream);
    }}
    .pill-reel {{ background: var(--primary); }}
    .pill-carrusel {{ background: var(--secondary); }}
    .pill-single {{ background: var(--dark); color: var(--cream); }}
    .media {{ background: var(--dark); display:flex; align-items:center; justify-content:center; }}

    /* carousel */
    .carousel-wrap {{ background: var(--dark); }}
    .carousel {{
      display: block; white-space: nowrap; overflow-x: auto;
      scroll-snap-type: x mandatory; scroll-behavior: smooth;
      scrollbar-width: none;
    }}
    .carousel::-webkit-scrollbar {{ display: none; }}
    .carousel img {{
      display: inline-block; vertical-align: top;
      height: 520px; object-fit: contain;
      scroll-snap-align: start; background: var(--cream);
      /* width set via JS */
    }}
    .carousel-nav {{
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 14px; background: var(--dark); color: var(--cream);
      border-top: 2px solid var(--cream);
    }}
    .carousel-nav button {{
      background: transparent; color: var(--cream);
      border: 2px solid var(--cream); width: 36px; height: 36px;
      font-family: inherit; font-weight: 900; font-size: 18px; cursor: pointer;
    }}
    .carousel-nav button:hover:not(:disabled) {{ background: var(--orange); border-color: var(--orange); }}
    .carousel-nav button:disabled {{ opacity: 0.3; cursor: not-allowed; }}
    .counter {{ font-weight: 900; font-size: 13px; letter-spacing: 0.14em; }}
    .counter .cur {{ color: var(--orange); }}

    .copy-block {{ padding: 16px 20px; background: #faf8f1; border-top: 2px dashed var(--muted); }}
    .copy-label {{
      font-size: 10px; font-weight: 900; letter-spacing: 0.22em;
      text-transform: uppercase; color: var(--primary); margin-bottom: 6px;
    }}
    .copy-block pre {{
      font-family: 'SF Mono', ui-monospace, monospace;
      font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-wrap: break-word;
    }}
    footer {{
      text-align: center; padding: 40px 20px; color: var(--muted);
      font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase;
    }}
  </style>
</head>
<body>
  <header class="hero">
    <h1>Enrola · <span class="em">Preview Mes 2</span></h1>
    <div class="sub">8 posts · 27 abr → 26 may 2026 · El arte de armar</div>
  </header>
  <main>
    {cards_html}
  </main>
  <footer>
    Preview generado automáticamente · Media incrustada · Sin dependencias externas
  </footer>
  <script>
    document.querySelectorAll('.carousel-wrap').forEach(wrap => {{
      const scroller = wrap.querySelector('[data-scroller]');
      const imgs = scroller.querySelectorAll('img');
      const prev = wrap.querySelector('[data-prev]');
      const next = wrap.querySelector('[data-next]');
      const cur = wrap.querySelector('.cur');
      let idx = 0;
      function sizeSlides() {{
        const w = scroller.clientWidth;
        imgs.forEach(img => img.style.width = w + 'px');
        scroller.scrollLeft = idx * w;
      }}
      function update() {{
        const w = scroller.clientWidth;
        const i = Math.round(scroller.scrollLeft / w);
        if (i === idx) return;
        idx = i; cur.textContent = i + 1;
        prev.disabled = i <= 0;
        next.disabled = i >= imgs.length - 1;
      }}
      function scrollTo(i) {{
        idx = i; cur.textContent = i + 1;
        scroller.scrollTo({{ left: i * scroller.clientWidth, behavior: 'smooth' }});
        prev.disabled = i <= 0; next.disabled = i >= imgs.length - 1;
      }}
      prev.addEventListener('click', () => scrollTo(Math.max(0, idx - 1)));
      next.addEventListener('click', () => scrollTo(Math.min(imgs.length - 1, idx + 1)));
      scroller.addEventListener('scroll', () => requestAnimationFrame(update));
      prev.disabled = true;
      if (imgs.length <= 1) next.disabled = true;
      sizeSlides();
      new ResizeObserver(sizeSlides).observe(scroller);
    }});
  </script>
</body>
</html>
"""
    out = HERE / "enrola-preview.html"
    out.write_text(html)
    size_mb = out.stat().st_size / 1024 / 1024
    print(f"✓ Written {out}")
    print(f"  Size: {size_mb:.1f} MB")
    print(f"  Abrir con doble-click · enviar por Drive / WeTransfer")


if __name__ == "__main__":
    build()

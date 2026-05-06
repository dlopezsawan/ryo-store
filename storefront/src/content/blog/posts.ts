// Blog posts data source — editar aquí para agregar/actualizar artículos.
// Cada post se usa para generar el listing, la página de detalle, sitemap y schema.

export type BlogPost = {
  slug: string;
  title: string;
  description: string; // meta description (150-160 chars)
  publishedAt: string; // ISO date
  updatedAt?: string;
  author: string;
  category: string;
  tags: string[];
  heroImage?: string; // absolute or /public path
  // Body in simple HTML — permite links, headings, listas, imagenes.
  bodyHtml: string;
};

export const posts: BlogPost[] = [
  {
    slug: "rolling-papers-venezuela-guia-hemp-celulosa-sabores",
    title: "Rolling papers en Venezuela: guía completa de hemp, celulosa y sabores",
    description:
      "¿Qué rolling paper elegir? Comparamos hemp, celulosa transparente y papeles saborizados. Precios, combustión, sabor y dónde comprar en Venezuela.",
    publishedAt: "2026-04-20",
    author: "Equipo Enrola",
    category: "Guías",
    tags: ["rolling paper", "hemp", "celulosa", "sabores", "guia"],
    heroImage: "/images/blog/rolling-papers-guia.jpg",
    bodyHtml: `
<p>Si entraste a una tienda de parafernalia y viste la pared de rolling papers preguntándote <em>cuál elegir</em>, no estás solo. Entre marcas, tamaños, materiales y sabores, es fácil perderse. Esta guía resume las <strong>3 grandes familias</strong> que cualquier fumador artesanal en Venezuela debería conocer — y cuándo conviene cada una.</p>

<h2>1. Hemp (cáñamo unbleached)</h2>
<p>El clásico. Fabricado en fibra de cáñamo natural, sin blanquear y sin cloro. Color marrón característico, combustión lenta y pareja, sabor neutro que deja que el tabaco lidere.</p>
<ul>
  <li><strong>Para quién:</strong> fumador diario que busca calidad-precio estable.</li>
  <li><strong>Ventaja:</strong> no altera el sabor del tabaco, biodegradable, durable.</li>
  <li><strong>Desventaja:</strong> aspecto rústico (no transparente).</li>
  <li><strong>Ejemplo del catálogo:</strong> <a href="/productos/rolling-paper">Rolling Paper Puff Man Unbleached Brown King Size</a> — 33 hojas, $2,50.</li>
</ul>

<h2>2. Celulosa transparente</h2>
<p>El "glass paper". 100% celulosa vegetal, transparente, ultra fina. La marca referencia en este estilo es <strong>Alien Puff Glass</strong>. Combustión todavía más lenta que el hemp y <em>no se apaga con la brisa</em> — el favorito para playa o exteriores.</p>
<ul>
  <li><strong>Para quién:</strong> el que quiere un look distinto + quien fuma al aire libre.</li>
  <li><strong>Ventaja:</strong> transparencia, sabor totalmente neutro, presentación premium.</li>
  <li><strong>Desventaja:</strong> precio ligeramente mayor, requiere manejo cuidadoso (son muy delgadas).</li>
  <li><strong>Ejemplo:</strong> <a href="/productos/papel-celulosa-transparente">Rolling Paper Celulosa Transparente Alien Puff</a> — 50 hojas, $3,00.</li>
</ul>

<h2>3. Saborizados</h2>
<p>Rolling papers con sabores sutiles: vainilla, chocolate, frutas, mentol, etc. El sabor no debe dominar al tabaco — cuando está bien ejecutado, lo complementa. Alien Puff tiene una línea completa de 15 sabores agrupados en <strong>Aromáticos</strong>, <strong>Frutos del Bosque</strong> y <strong>Frutales</strong>.</p>
<ul>
  <li><strong>Para quién:</strong> el que busca variar la experiencia, regalo, momentos sociales.</li>
  <li><strong>Ventaja:</strong> versatilidad, ideal para rotar.</li>
  <li><strong>Desventaja:</strong> si el sabor es demasiado fuerte, cubre al tabaco.</li>
  <li><strong>Ejemplo:</strong> <a href="/productos/papel-sabores-alien-puff">Rolling Paper Sabores Alien Puff</a> — 15 sabores, 33 hojas, $2,50.</li>
</ul>

<h2>Tamaños: king size vs 1¼</h2>
<p>En el catálogo de Enrola trabajamos <strong>king size</strong> (≈110mm × 36mm), el estándar profesional. Para principiantes el tamaño 1¼ es más corto y fácil de enrollar, pero hoy el king size se volvió el default porque da más control sobre la cantidad de tabaco.</p>

<h2>¿Y los filtros?</h2>
<p>Cualquier rolling paper se complementa con un <strong>tip</strong>. Para el básico, <a href="/productos/filtros-carton-perforado">Filtros de Cartón Perforado Puff Man</a>; si querés sentir el humo más limpio, <a href="/productos/filtro-carbon-activo">Filtros de Carbón Activo Alien Puff</a>.</p>

<h2>Conclusión rápida</h2>
<p>¿Tu primera compra? <strong>Hemp king size + filtros de cartón.</strong> Combo clásico, asequible, infalible. Cuando quieras escalar: prueba una cajita de sabores + filtros de carbón activo. Para momentos especiales o exteriores, celulosa transparente.</p>

<p>Enrola envía a toda Venezuela por MRW y hace delivery same-day en Valencia. Recuerda que todos nuestros productos son para <strong>uso exclusivo con tabaco legal</strong> según los <a href="/terminos">Términos y Condiciones</a>.</p>
    `,
  },
  {
    slug: "como-elegir-tu-primer-grinder",
    title: "Cómo elegir tu primer grinder: plástico, metal o rellenador",
    description:
      "Guía práctica para elegir grinder según presupuesto y uso. Plástico, metálico y rellenador de conos comparados en 4 criterios clave.",
    publishedAt: "2026-04-20",
    author: "Equipo Enrola",
    category: "Guías",
    tags: ["grinder", "herramientas", "guia"],
    heroImage: "/images/blog/grinder-guia.jpg",
    bodyHtml: `
<p>El grinder es la herramienta que más veces vas a usar — literalmente cada vez que armes. Sin embargo, la mayoría elige el primero a la ligera y termina reemplazándolo 2 o 3 veces antes de encontrar el suyo. Esta guía corta te ahorra ese camino.</p>

<h2>Los 4 criterios que importan</h2>

<h3>1. Granulometría (qué tan fino muele)</h3>
<p>Un buen picado es uniforme. Si quedan trozos grandes, el armado se quema desparejo; si queda <em>polvo</em>, se quema demasiado rápido. Los grinders de plástico dan picado aceptable; los metálicos con dientes afilados dan el mejor corte.</p>

<h3>2. Durabilidad</h3>
<p>Los dientes de plástico se gastan con el uso. Un grinder de plástico decente dura 6-12 meses de uso diario. Uno metálico puede durar años. Hay un break-even: si fumás 1-2 veces al mes, plástico está bien; si es diario, la inversión en metálico se paga rápido.</p>

<h3>3. Tamaño</h3>
<p>60mm es el <strong>sweet spot</strong> — suficiente capacidad para 1-2 armados, cabe en bolsillo. Los de 40mm son muy chicos; los de 70mm+ son de mesa (difíciles de llevar).</p>

<h3>4. Característica especial (rellenador)</h3>
<p>Si ya estás comprando conos pre-armados, tiene mucho sentido un <strong>grinder rellenador con portaconos</strong>. Muele y carga el cono en un solo movimiento, ahorrando 10× el tiempo. La contra: es específico para conos, no sirve para armar con papeles sueltos.</p>

<h2>Nuestras 2 opciones</h2>

<h3><a href="/productos/grinder-plastico">Grinder Plástico 60mm</a> — $6</h3>
<p>Compacto, liviano, disponible en 4 colores (verde, azul, rojo, transparente). El workhorse. Granulometría buena, precio imbatible. Ideal para quien recién arranca o como grinder de respaldo/viaje.</p>

<h3><a href="/productos/grinder-rellenador-conos">Grinder Rellenador de Conos con Portaconos</a> — $10</h3>
<p>Herramienta especializada para quien ya usa conos pre-armados (<a href="/productos/conos-alien-puff-celulosa">Celulosa</a>, <a href="/productos/conos-alien-puff-saborizados">Sabores</a>). Muele y carga el cono directamente — pensado para volumen o para amigos que valoran la eficiencia.</p>

<h2>¿Cuál comprar?</h2>
<ul>
  <li><strong>Primer grinder, uso ocasional:</strong> Plástico 60mm.</li>
  <li><strong>Fumás conos pre-armados:</strong> Rellenador con portaconos.</li>
  <li><strong>Querés lo mejor sin compromiso:</strong> pronto sumaremos metálico CNC al catálogo.</li>
</ul>

<p>Envíos MRW a toda Venezuela + delivery same-day en Valencia. Compra desde la <a href="/tienda">tienda</a>.</p>
    `,
  },
];

export function getPostBySlug(slug: string): BlogPost | null {
  return posts.find((p) => p.slug === slug) ?? null;
}

export function getAllPosts(): BlogPost[] {
  return [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

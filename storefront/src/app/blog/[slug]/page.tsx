import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/content/blog/posts";
import { getPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://enrola.shop";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export const revalidate = 600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return getPageMetadata("Artículo", "Artículo del blog de Enrola Shop", `/blog/${slug}`);
  return getPageMetadata(post.title, post.description, `/blog/${post.slug}`);
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: { "@type": "Organization", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "Enrola Shop",
      logo: { "@type": "ImageObject", url: `${STORE_URL}/logo-web-nuevo.svg` },
    },
    mainEntityOfPage: `${STORE_URL}/blog/${post.slug}`,
    ...(post.heroImage ? { image: post.heroImage.startsWith("http") ? post.heroImage : `${STORE_URL}${post.heroImage}` } : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: STORE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${STORE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: `${STORE_URL}/blog/${post.slug}` },
    ],
  };

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <main className="max-w-[900px] mx-auto px-4 py-8 md:py-12">
        <nav className="flex items-center gap-2 text-sm mb-8 font-medium">
          <Link href="/" className="text-muted hover:text-primary transition-colors">Inicio</Link>
          <span className="text-muted">/</span>
          <Link href="/blog" className="text-muted hover:text-primary transition-colors">Blog</Link>
          <span className="text-muted">/</span>
          <span className="text-dark truncate max-w-[50%]">{post.title}</span>
        </nav>

        <article className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider">
            <span>{post.category}</span>
            <span>·</span>
            <time dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString("es-VE", {
                day: "2-digit", month: "long", year: "numeric",
              })}
            </time>
            <span>·</span>
            <span>{post.author}</span>
          </div>

          <h1 className="font-black text-dark text-3xl md:text-5xl uppercase tracking-tight leading-tight">
            {post.title}
          </h1>

          <p className="text-dark/80 text-lg md:text-xl leading-relaxed border-l-4 border-primary pl-5 py-2">
            {post.description}
          </p>

          <div
            className="prose prose-lg max-w-none mt-6
              [&_h2]:font-black [&_h2]:text-dark [&_h2]:text-2xl md:[&_h2]:text-3xl [&_h2]:uppercase [&_h2]:tracking-tight [&_h2]:mt-10 [&_h2]:mb-4
              [&_h3]:font-black [&_h3]:text-dark [&_h3]:text-xl [&_h3]:uppercase [&_h3]:tracking-tight [&_h3]:mt-6 [&_h3]:mb-2
              [&_p]:text-dark/85 [&_p]:leading-relaxed [&_p]:mb-4
              [&_a]:text-primary [&_a]:font-bold [&_a]:underline [&_a:hover]:opacity-80
              [&_strong]:text-dark [&_strong]:font-black
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
              [&_li]:mb-1"
            dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
          />

          <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-dark/20">
            {post.tags.map((t) => (
              <span
                key={t}
                className="text-xs font-bold uppercase tracking-wide text-dark/70 bg-cream border border-dark/30 px-3 py-1"
              >
                #{t}
              </span>
            ))}
          </div>

          <div className="mt-10 p-6 md:p-8 bg-dark text-cream" style={{ boxShadow: "6px 6px 0px 0px var(--primary)" }}>
            <h3 className="font-black text-xl md:text-2xl uppercase tracking-tight mb-2">
              ¿Listo para armar?
            </h3>
            <p className="text-cream/80 mb-4">
              Explora el catálogo completo de rolling papers, conos, grinders y filtros con envíos a toda Venezuela.
            </p>
            <Link
              href="/tienda"
              className="inline-block bg-primary text-cream border-2 border-cream px-6 py-3 font-black uppercase tracking-widest text-sm hover:opacity-90 transition-opacity"
              style={{ boxShadow: "4px 4px 0px 0px var(--cream)" }}
            >
              Ir a la tienda →
            </Link>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}

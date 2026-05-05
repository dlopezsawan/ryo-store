import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { getAllPosts } from "@/content/blog/posts";
import { getPageMetadata } from "@/lib/seo";

export const metadata = getPageMetadata(
  "Blog",
  "Guías, tips y comparativas sobre rolling papers, grinders, filtros y accesorios de tabaco artesanal en Venezuela. Aprende a elegir y armar como un pro.",
  "/blog"
);

export const revalidate = 300;

export default function BlogListingPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <main className="max-w-[1380px] mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center gap-4 mb-3">
          <div className="h-1 w-12 bg-primary" />
          <h1 className="font-black text-dark text-3xl md:text-5xl uppercase tracking-tight">
            Blog
          </h1>
        </div>
        <p className="text-muted text-sm md:text-base mb-10 max-w-2xl ml-16">
          Guías prácticas, comparativas y cultura rolling. Para leer tranquilo.
        </p>

        {posts.length === 0 ? (
          <p className="text-muted">Aún no hay publicaciones.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="border-[3px] border-dark bg-white p-6 md:p-7 flex flex-col gap-3"
                style={{ boxShadow: "6px 6px 0px 0px var(--primary)" }}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider">
                  <span>{post.category}</span>
                  <span>·</span>
                  <time dateTime={post.publishedAt}>
                    {new Date(post.publishedAt).toLocaleDateString("es-VE", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                </div>
                <h2 className="font-black text-dark text-xl md:text-2xl leading-tight">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="hover:text-primary transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="text-dark/80 text-sm md:text-base leading-relaxed">
                  {post.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {post.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="text-[11px] font-bold uppercase tracking-wide text-dark/60 bg-cream border border-dark/30 px-2 py-0.5"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
                <Link
                  href={`/blog/${post.slug}`}
                  className="inline-flex items-center font-black text-primary uppercase tracking-wider text-sm mt-auto pt-2"
                >
                  Leer artículo →
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

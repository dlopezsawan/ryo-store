import type { MetadataRoute } from "next";

const STORE_URL =
  process.env.NEXT_PUBLIC_STORE_URL || "https://enrola.shop";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/carrito",
          "/account/",
          "/checkout/",
          "/api/",
          "/admin/",
        ],
      },
    ],
    sitemap: `${STORE_URL}/sitemap.xml`,
  };
}

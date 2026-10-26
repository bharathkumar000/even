import type { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/lib/seo-config";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_CONFIG.canonicalUrl;

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/about",
          "/schedule",
          "/faq",
          "/_next/static/",
          "/_next/image/",
          "/favicon.png",
          "/favicon.ico",
          "/manifest.json",
          "/*.png",
          "/*.svg",
          "/*.jpg",
          "/*.webp",
        ],
        disallow: [
          "/admin",
          "/admin/*",
          "/judge",
          "/judge/*",
          "/team",
          "/team/*",
          "/ops",
          "/ops/*",
          "/participants",
          "/participants/*",
          "/judges",
          "/judges/*",
          "/event-details",
          "/event-details/*",
          "/login",
          "/signup",
          "/api/*",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: [
          "/",
          "/about",
          "/schedule",
          "/faq",
          "/_next/static/",
          "/_next/image/",
        ],
        disallow: [
          "/admin",
          "/judge",
          "/team",
          "/ops",
          "/participants",
          "/judges",
          "/event-details",
          "/login",
          "/signup",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}

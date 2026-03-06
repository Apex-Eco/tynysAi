import type { MetadataRoute } from "next";
import { i18n } from "@/lib/i18n/config";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tynysai.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ["", "/request-demo", "/privacy", "/terms", "/sign-in", "/sign-up"];

  return i18n.locales.flatMap((locale) =>
    routes.map((route) => ({
      url: `${siteUrl}/${locale}${route}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.7,
    }))
  );
}

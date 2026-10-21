import type { Env } from "./env";
import { CATEGORIES, categoryName } from "./config";
import { escapeXml, toIso } from "./lib/text";
import { imageUrl } from "./views/pages";

interface FeedRow {
  slug: string;
  title: string;
  summary: string;
  category: string;
  image_key: string | null;
  published_at: string;
  updated_at: string;
}

const xml = (body: string, maxAge = 600) =>
  new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": `public, max-age=${maxAge}` } });

export async function rss(env: Env, category?: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT slug, title, summary, category, image_key, published_at, updated_at FROM articles
      WHERE status = 'published' ${category ? "AND category = ?" : ""} ORDER BY published_at DESC LIMIT 50`,
  )
    .bind(...(category ? [category] : []))
    .all<FeedRow>();
  const site = env.SITE_URL;
  const items = results
    .map((a) => {
      const img = imageUrl(a.image_key);
      return `<item><title>${escapeXml(a.title)}</title><link>${site}/haber/${a.slug}</link><guid isPermaLink="true">${site}/haber/${a.slug}</guid>
<description>${escapeXml(a.summary)}</description><category>${escapeXml(categoryName(a.category))}</category><pubDate>${new Date(toIso(a.published_at)).toUTCString()}</pubDate>${
        img ? `<enclosure url="${escapeXml(img.startsWith("http") ? img : site + img)}" type="image/jpeg" length="0"/>` : ""
      }</item>`;
    })
    .join("\n");
  return xml(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${escapeXml(env.SITE_NAME)}${category ? ` - ${escapeXml(categoryName(category))}` : ""}</title>
<link>${site}</link><description>Bitcoin ve kripto para haberleri</description><language>tr</language>
<atom:link href="${site}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
</channel></rss>`);
}

export async function sitemap(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT slug, updated_at FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 45000",
  ).all<{ slug: string; updated_at: string }>();
  const site = env.SITE_URL;
  const urls = [
    `<url><loc>${site}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
    ...CATEGORIES.map((c) => `<url><loc>${site}/kategori/${c.slug}</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>`),
    ...["hakkimizda", "yayin-ilkeleri", "iletisim"].map((p) => `<url><loc>${site}/${p}</loc><priority>0.3</priority></url>`),
    ...results.map((a) => `<url><loc>${site}/haber/${a.slug}</loc><lastmod>${toIso(a.updated_at)}</lastmod></url>`),
  ];
  return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`, 3600);
}

/** Google News site haritası: son 48 saat */
export async function newsSitemap(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT slug, title, published_at FROM articles WHERE status = 'published' AND published_at >= datetime('now', '-2 days')
      ORDER BY published_at DESC LIMIT 1000`,
  ).all<{ slug: string; title: string; published_at: string }>();
  const site = env.SITE_URL;
  const urls = results.map(
    (a) => `<url><loc>${site}/haber/${a.slug}</loc><news:news><news:publication><news:name>${escapeXml(env.SITE_NAME)}</news:name><news:language>tr</news:language></news:publication>
<news:publication_date>${toIso(a.published_at)}</news:publication_date><news:title>${escapeXml(a.title)}</news:title></news:news></url>`,
  );
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${urls.join("\n")}\n</urlset>`,
    300,
  );
}

export function robots(env: Env): Response {
  return new Response(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${env.SITE_URL}/sitemap.xml\nSitemap: ${env.SITE_URL}/news-sitemap.xml\n`,
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}

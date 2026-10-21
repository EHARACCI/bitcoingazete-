import { Hono, type Context } from "hono";
import { basicAuth } from "hono/basic-auth";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { html } from "hono/html";
import type { Env } from "./env";
import { CATEGORIES } from "./config";
import { byCategory, byTag, getById, getBySlug, latest, popular, related, search, type ArticleRow } from "./lib/db";
import { getFearGreed, getTicker } from "./lib/market";
import { renderMarkdown } from "./lib/markdown";
import { slugify, sqlNow, wordCount } from "./lib/text";
import { getSetting, runPipeline, setSetting } from "./pipeline/run";
import { newsSitemap, robots, rss, sitemap } from "./feeds";
import { liveStub, onlineCount } from "./live";
import { CSS } from "./views/styles";
import { layout, type Html } from "./views/layout";
import { articleJsonLd, articlePage, homePage, listPage, notFoundPage, STATIC_PAGES, staticPage, imageUrl } from "./views/pages";
import { adminShell, articleDetail, articlesTable, dashboard, runsTable, sourcesPage } from "./views/admin";

type App = { Bindings: Env };
const app = new Hono<App>();
const PER_PAGE = 15;

// ---------------------------------------------------------------------------
// Kamuya açık sayfalar için kenar önbelleği (2 dk). Yönetim, API ve önizleme hariç.
app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  if (c.req.method !== "GET" || url.pathname.startsWith("/admin") || url.pathname.startsWith("/api") || url.searchParams.has("onizleme")) {
    return next();
  }
  const cache = caches.default;
  const hit = await cache.match(c.req.raw);
  if (hit) return hit;
  await next();
  if (c.res.status === 200 && !c.res.headers.has("cache-control")) {
    c.res.headers.set("cache-control", "public, max-age=60, s-maxage=120");
    c.executionCtx.waitUntil(cache.put(c.req.raw, c.res.clone()));
  }
});

async function page(c: Context<App>, o: { title: string; description: string; body: Html; activeCategory?: string; ogImage?: string; ogType?: "website" | "article"; jsonLd?: object[]; noindex?: boolean; status?: 200 | 404 }) {
  const ticker = await getTicker(c.env);
  return c.html(
    layout({ siteName: c.env.SITE_NAME, siteUrl: c.env.SITE_URL, path: new URL(c.req.url).pathname, ticker, ...o }),
    o.status ?? 200,
  );
}

const pageNum = (c: Context<App>) => Math.max(1, Number(c.req.query("sayfa")) || 1);

app.get("/site.css", (c) => c.body(CSS, 200, { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=86400" }));

app.get("/", async (c) => {
  const [items, fng, quotes] = await Promise.all([latest(c.env, 14), getFearGreed(), getTicker(c.env)]);
  const shown = new Set(items.slice(0, 8).map((i) => i.id)); // vitrin + son dakika
  const byCat: Record<string, Awaited<ReturnType<typeof latest>>> = {};
  await Promise.all(
    CATEGORIES.map(async (cat) => {
      byCat[cat.slug] = (await byCategory(c.env, cat.slug, 8)).filter((a) => !shown.has(a.id)).slice(0, 4);
    }),
  );
  return page(c, {
    title: `${c.env.SITE_NAME} | Bitcoin ve Kripto Para Haberleri`,
    description: "Bitcoin, Ethereum ve kripto para piyasasından son dakika haberler, regülasyon gelişmeleri ve piyasa analizleri Türkçe olarak Bitcoin Gazete'de.",
    body: homePage(items, byCat, quotes, fng),
    jsonLd: [
      { "@context": "https://schema.org", "@type": "NewsMediaOrganization", name: c.env.SITE_NAME, url: c.env.SITE_URL, logo: `${c.env.SITE_URL}/logo.png`, publishingPrinciples: `${c.env.SITE_URL}/yayin-ilkeleri` },
      { "@context": "https://schema.org", "@type": "WebSite", name: c.env.SITE_NAME, url: c.env.SITE_URL, potentialAction: { "@type": "SearchAction", target: `${c.env.SITE_URL}/ara?q={q}`, "query-input": "required name=q" } },
    ],
  });
});

app.get("/haber/:slug", async (c) => {
  const a = await getBySlug(c.env, c.req.param("slug"));
  if (!a) return notFound(c);
  if (a.status !== "published") {
    // Yayınlanmamış haber yalnızca yönetici önizlemesiyle görüntülenebilir
    if (!c.req.query("onizleme") || !isAdmin(c)) return notFound(c);
  }
  const [rel, pop, quotes] = await Promise.all([related(c.env, a, 3), popular(c.env, 5), getTicker(c.env)]);
  const img = imageUrl(a.image_key);
  return page(c, {
    title: a.title,
    description: a.meta_description || a.summary,
    body: articlePage(a, rel, pop, quotes, c.env.SITE_URL),
    activeCategory: a.category,
    ogType: "article",
    ogImage: img ? (img.startsWith("http") ? img : c.env.SITE_URL + img) : undefined,
    jsonLd: articleJsonLd(a, c.env.SITE_URL, c.env.SITE_NAME),
    noindex: a.status !== "published",
  });
});

app.get("/kategori/:slug", async (c) => {
  const cat = CATEGORIES.find((x) => x.slug === c.req.param("slug"));
  if (!cat) return notFound(c);
  const p = pageNum(c);
  const items = await byCategory(c.env, cat.slug, PER_PAGE, (p - 1) * PER_PAGE);
  return page(c, {
    title: `${cat.name} Haberleri${p > 1 ? ` - Sayfa ${p}` : ""}`,
    description: `${cat.description}. En güncel ${cat.name} haberleri Bitcoin Gazete'de.`,
    activeCategory: cat.slug,
    body: listPage({ kicker: "Kategori", title: `${cat.name} Haberleri`, description: cat.description, items, page: p, basePath: `/kategori/${cat.slug}`, perPage: PER_PAGE }),
  });
});

app.get("/kategori/:slug/rss.xml", (c) => rss(c.env, c.req.param("slug")));

app.get("/etiket/:tag", async (c) => {
  const tag = decodeURIComponent(c.req.param("tag"));
  const p = pageNum(c);
  const items = await byTag(c.env, tag, PER_PAGE, (p - 1) * PER_PAGE);
  return page(c, {
    title: `${tag} Haberleri`,
    description: `${tag} ile ilgili son dakika haberler ve gelişmeler.`,
    body: listPage({ kicker: "Etiket", title: tag, items, page: p, basePath: `/etiket/${encodeURIComponent(tag)}`, perPage: PER_PAGE }),
    noindex: items.length < 3,
  });
});

app.get("/ara", async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 80);
  const p = pageNum(c);
  const items = q.length >= 2 ? await search(c.env, q, PER_PAGE, (p - 1) * PER_PAGE) : [];
  return page(c, {
    title: q ? `"${q}" arama sonuçları` : "Arama",
    description: "Bitcoin Gazete haber arşivinde arayın.",
    body: listPage({ kicker: "Arama", title: q ? `"${q}" için sonuçlar` : "Haberlerde arayın", items, page: p, basePath: `/ara?q=${encodeURIComponent(q)}`, perPage: PER_PAGE }),
    noindex: true,
  });
});

for (const [slug, p] of Object.entries(STATIC_PAGES)) {
  app.get(`/${slug}`, (c) => page(c, { title: p.title, description: p.description, body: staticPage(p) }));
}

app.get("/rss.xml", (c) => rss(c.env));
app.get("/feed", (c) => c.redirect("/rss.xml", 301)); // eski WordPress beslemesi
app.get("/sitemap.xml", (c) => sitemap(c.env));
app.get("/news-sitemap.xml", (c) => newsSitemap(c.env));
app.get("/robots.txt", (c) => robots(c.env));

app.get("/media/*", async (c) => {
  if (!c.env.MEDIA) return c.notFound();
  const key = c.req.path.replace(/^\/media\//, "");
  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.notFound();
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
});

// Anlık ziyaretçi sayacı (WebSocket)
app.get("/api/canli", async (c) => {
  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") return c.text("WebSocket bekleniyor", 426);
  return liveStub(c.env).fetch(c.req.raw);
});

app.post("/api/goruntulenme/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (id) c.executionCtx.waitUntil(c.env.DB.prepare("UPDATE articles SET views = views + 1 WHERE id = ? AND status = 'published'").bind(id).run());
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Yönetim paneli (Basic Auth + CSRF koruması). Ek güvenlik için Cloudflare Access önerilir.

function isAdmin(c: Context<App>): boolean {
  const h = c.req.header("authorization");
  if (!h?.startsWith("Basic ") || !c.env.ADMIN_PASSWORD) return false;
  const [user, pass] = atob(h.slice(6)).split(":");
  return user === "admin" && pass === c.env.ADMIN_PASSWORD;
}

app.use("/admin/*", csrf());
app.use("/admin/*", async (c, next) => {
  if (!c.env.ADMIN_PASSWORD) return c.text("ADMIN_PASSWORD tanımlı değil: wrangler secret put ADMIN_PASSWORD", 503);
  return basicAuth({ username: "admin", password: c.env.ADMIN_PASSWORD, realm: "Bitcoin Gazete Yonetim" })(c, next);
});
app.get("/admin", (c) => c.redirect("/admin/"));

app.get("/admin/", async (c) => {
  const [{ results: counts }, today, { results: runs }, { results: sources }, paused, online] = await Promise.all([
    c.env.DB.prepare("SELECT status, COUNT(*) AS n FROM articles GROUP BY status").all<{ status: string; n: number }>(),
    c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM articles WHERE ai_generated = 1 AND status IN ('published','needs_review') AND created_at >= datetime('now','start of day')",
    ).first<{ n: number }>(),
    c.env.DB.prepare("SELECT id, trigger, status, stats, started_at FROM runs ORDER BY id DESC LIMIT 15").all<{ id: number; trigger: string; status: string; stats: string | null; started_at: string }>(),
    c.env.DB.prepare("SELECT name, last_error, last_fetched_at, enabled FROM sources").all<{ name: string; last_error: string | null; last_fetched_at: string | null; enabled: number }>(),
    getSetting(c.env, "paused"),
    onlineCount(c.env),
  ]);
  return c.html(
    adminShell(
      "Özet",
      dashboard({
        counts: Object.fromEntries(counts.map((r) => [r.status, r.n])),
        today: today?.n ?? 0,
        online,
        dailyLimit: Number(c.env.DAILY_LIMIT) || 24,
        paused: paused === "1",
        mode: c.env.PUBLISH_MODE,
        mock: c.env.AI_MOCK === "on",
        runs,
        sources,
      }),
    ),
  );
});

app.post("/admin/calistir", async (c) => {
  await runPipeline(c.env, "manual", 1);
  return c.redirect("/admin/calismalar");
});

app.post("/admin/duraklat", async (c) => {
  const paused = (await getSetting(c.env, "paused")) === "1";
  await setSetting(c.env, "paused", paused ? "0" : "1");
  return c.redirect("/admin/");
});

app.get("/admin/haberler", async (c) => {
  const status = c.req.query("durum") ?? "needs_review";
  const { results } = await c.env.DB.prepare(
    "SELECT id, slug, title, status, quality_score, category, created_at FROM articles WHERE status = ? ORDER BY id DESC LIMIT 200",
  )
    .bind(status)
    .all<Pick<ArticleRow, "id" | "slug" | "title" | "status" | "quality_score" | "category" | "created_at">>();
  const titles: Record<string, string> = { needs_review: "Onay kuyruğu", published: "Yayındaki haberler", rejected: "Reddedilen haberler", unpublished: "Yayından kaldırılanlar" };
  return c.html(adminShell(titles[status] ?? status, articlesTable(results)));
});

app.get("/admin/haberler/:id", async (c) => {
  const a = await getById(c.env, Number(c.req.param("id")));
  if (!a) return c.notFound();
  return c.html(adminShell(a.title, articleDetail(a)));
});

app.post("/admin/haberler/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const f = await c.req.parseBody();
  const body = String(f.body_md ?? "");
  const tags = String(f.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  await c.env.DB.prepare(
    `UPDATE articles SET title = ?, summary = ?, meta_description = ?, category = ?, tags = ?, body_md = ?, body_html = ?, word_count = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(String(f.title), String(f.summary), String(f.meta_description), String(f.category), JSON.stringify(tags), body, renderMarkdown(body), wordCount(body), sqlNow(), id)
    .run();
  return c.redirect(`/admin/haberler/${id}`);
});

app.post("/admin/haberler/:id/durum", async (c) => {
  const id = Number(c.req.param("id"));
  const status = String((await c.req.parseBody()).status);
  if (!["published", "rejected", "unpublished", "needs_review"].includes(status)) return c.text("Geçersiz durum", 400);
  await c.env.DB.prepare(
    `UPDATE articles SET status = ?, updated_at = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END WHERE id = ?`,
  )
    .bind(status, sqlNow(), status, sqlNow(), id)
    .run();
  return c.redirect(`/admin/haberler/${id}`);
});

app.post("/admin/haberler/:id/sil", async (c) => {
  await c.env.DB.prepare("DELETE FROM articles WHERE id = ?").bind(Number(c.req.param("id"))).run();
  return c.redirect("/admin/");
});

app.get("/admin/kaynaklar", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM sources ORDER BY enabled DESC, weight DESC").all<Parameters<typeof sourcesPage>[0][number]>();
  return c.html(adminShell("Kaynaklar", sourcesPage(results)));
});

app.post("/admin/kaynaklar", async (c) => {
  const f = await c.req.parseBody();
  await c.env.DB.prepare("INSERT OR IGNORE INTO sources (name, feed_url, lang, weight) VALUES (?, ?, ?, ?)")
    .bind(String(f.name), String(f.feed_url), String(f.lang) === "tr" ? "tr" : "en", Number(f.weight) || 1)
    .run();
  return c.redirect("/admin/kaynaklar");
});

app.post("/admin/kaynaklar/:id/degistir", async (c) => {
  await c.env.DB.prepare("UPDATE sources SET enabled = 1 - enabled WHERE id = ?").bind(Number(c.req.param("id"))).run();
  return c.redirect("/admin/kaynaklar");
});

app.get("/admin/calismalar", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, trigger, status, stats, started_at FROM runs ORDER BY id DESC LIMIT 100").all<{ id: number; trigger: string; status: string; stats: string | null; started_at: string }>();
  return c.html(adminShell("Çalışma kayıtları", runsTable(results)));
});

app.get("/admin/calismalar/:id", async (c) => {
  const r = await c.env.DB.prepare("SELECT * FROM runs WHERE id = ?").bind(Number(c.req.param("id"))).first<{ id: number; log: string | null }>();
  if (!r) return c.notFound();
  return c.html(adminShell(`Çalışma #${r.id}`, html`<pre>${r.log ?? "(kayıt yok)"}</pre>`));
});

// ---------------------------------------------------------------------------
// 404 ve eski WordPress adreslerinden yönlendirme

async function notFound(c: Context<App>) {
  return page(c, { title: "Sayfa bulunamadı", description: "Aradığınız sayfa bulunamadı.", body: notFoundPage(), noindex: true, status: 404 });
}

app.notFound(async (c) => {
  const path = new URL(c.req.url).pathname;
  const clean = path.replace(/\/+$/, "") || "/";
  // 1) Açık yönlendirme tablosu
  const r = await c.env.DB.prepare("SELECT to_path FROM redirects WHERE from_path = ? OR from_path = ?").bind(path, clean).first<{ to_path: string }>();
  if (r) return c.redirect(r.to_path, 301);
  // 2) Eski WordPress kalıcı bağlantıları: /2024/05/baslik/ veya /kategori/baslik/ → son parça slug kabul edilir
  const last = clean.split("/").filter(Boolean).pop();
  if (last && /^[a-z0-9-]{3,}$/i.test(last)) {
    const a = await c.env.DB.prepare("SELECT slug FROM articles WHERE status = 'published' AND (slug = ? OR legacy_path = ? OR legacy_path = ?)")
      .bind(slugify(last), path, clean)
      .first<{ slug: string }>();
    if (a) return c.redirect(`/haber/${a.slug}`, 301);
  }
  return notFound(c);
});

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse(); // 401 (giriş), 403 (CSRF) vb.
  console.error(err);
  return c.text("Beklenmeyen bir hata oluştu.", 500);
});

export { LiveCounter } from "./live";

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext) {
    await runPipeline(env, "cron");
  },
} satisfies ExportedHandler<Env>;

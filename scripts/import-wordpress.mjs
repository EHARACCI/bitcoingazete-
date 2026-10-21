#!/usr/bin/env node
/**
 * Eski WordPress sitesindeki yazıları Bitcoin Gazete veritabanına aktarır.
 * Bluehost'taki site HÂLÂ AÇIKKEN çalıştırın (görseller oradan indirilir).
 *
 * Kullanım:
 *   node scripts/import-wordpress.mjs https://bitcoingazete.com
 *
 * Çıktılar:
 *   import-wp.sql        → npx wrangler d1 execute bitcoingazete --remote --file import-wp.sql
 *   wp-media/            → indirilen görseller
 *   upload-media.sh      → görselleri R2'ye yükler: sh upload-media.sh
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const site = (process.argv[2] || "https://bitcoingazete.com").replace(/\/$/, "");
const host = new URL(site).host.replace(/^www\./, "");
const UPLOADS = new RegExp(`https?://(?:www\\.)?${host.replace(/\./g, "\\.")}/wp-content/uploads/([^"'\\s)?#]+)`, "g");

const CATEGORY_RULES = [
  ["regulasyon", /regülasyon|regulasyon|düzenleme|yasa|spk|sec\b|hukuk/i],
  ["turkiye", /türkiye|turkiye|yerel/i],
  ["altcoin", /altcoin|ethereum|ripple|xrp|solana|dogecoin|cardano|token/i],
  ["piyasa", /piyasa|analiz|fiyat|borsa|teknik/i],
  ["teknoloji", /teknoloji|blockchain|blokzincir|defi|nft|web3|metaverse/i],
  ["dunya", /dünya|dunya|ekonomi|global|şirket/i],
  ["bitcoin", /bitcoin|btc/i],
];

const TR = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };
const slugify = (s) =>
  s.replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR[c]).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90).replace(/-+$/, "");
const q = (s) => `'${String(s ?? "").replace(/'/g, "''")}'`;
// WordPress uzun slug'ları kırparken yüzde kodlamasını yarıda bırakabilir.
const decodeSlug = (s) =>
  s.replace(/(%[0-9a-f]{2})+/gi, (run) => {
    // Bozuk sondaki baytları atarak çözülebilen kısmı koru
    for (let r = run; r; r = r.slice(0, -3)) {
      try { return decodeURIComponent(r); } catch {}
    }
    return "";
  }).replace(/%/g, "");
const strip = (h) => h.replace(/<[^>]+>/g, " ").replace(/&#8217;|&rsquo;/g, "’").replace(/&#8220;|&#8221;/g, '"').replace(/&nbsp;|&#160;/g, " ")
  .replace(/&amp;/g, "&").replace(/&#8230;/g, "…").replace(/&[a-z0-9#]+;/gi, " ").replace(/\s+/g, " ").trim();

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "BitcoinGazete-Migration/1.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return { data: await res.json(), totalPages: Number(res.headers.get("x-wp-totalpages") || 1) };
}

const media = new Set();
const toLocal = (html) =>
  html.replace(UPLOADS, (_m, path) => {
    media.add(path);
    return `/media/wp/${path}`;
  });

console.log(`Kategoriler okunuyor: ${site}`);
const cats = new Map();
for (let page = 1; ; page++) {
  const { data, totalPages } = await getJson(`${site}/wp-json/wp/v2/categories?per_page=100&page=${page}`);
  for (const c of data) cats.set(c.id, c.name);
  if (page >= totalPages) break;
}

const lines = ["-- WordPress içe aktarımı", ""];
let count = 0;
for (let page = 1; ; page++) {
  const { data: posts, totalPages } = await getJson(`${site}/wp-json/wp/v2/posts?per_page=50&page=${page}&_embed=wp:featuredmedia`);
  for (const p of posts) {
    const title = strip(p.title.rendered);
    const catNames = (p.categories || []).map((id) => cats.get(id) || "").join(" ");
    const category = (CATEGORY_RULES.find(([, re]) => re.test(catNames)) || CATEGORY_RULES.find(([, re]) => re.test(title)) || ["bitcoin"])[0];
    const bodyHtml = toLocal(p.content.rendered.replace(/<script[\s\S]*?<\/script>/gi, ""));
    const summary = strip(p.excerpt.rendered.replace(/\s*\[(&hellip;|…|&#8230;)\]/g, "")).slice(0, 300);
    const featured = p._embedded?.["wp:featuredmedia"]?.[0];
    let imageKey = null;
    if (featured?.source_url) {
      const m = featured.source_url.match(/wp-content\/uploads\/(.+)$/);
      if (m) {
        media.add(m[1]);
        imageKey = `wp/${m[1]}`;
      }
    }
    const legacyPath = new URL(p.link).pathname;
    const slug = slugify(decodeSlug(p.slug)) || `yazi-${p.id}`;
    const date = p.date_gmt.replace("T", " ");
    const modified = (p.modified_gmt || p.date_gmt).replace("T", " ");
    const words = strip(bodyHtml).split(" ").length;
    lines.push(
      `INSERT OR IGNORE INTO articles (slug, title, summary, meta_description, body_md, body_html, category, tags, sources, image_key, image_alt, status, word_count, ai_generated, legacy_path, created_at, updated_at, published_at) VALUES (` +
        [q(slug), q(title), q(summary), q(summary.slice(0, 160)), "NULL", q(bodyHtml), q(category), q("[]"), q("[]"), imageKey ? q(imageKey) : "NULL",
          q(featured?.alt_text || title), q("published"), words, 0, q(legacyPath), q(date), q(modified), q(date)].join(", ") +
        ");",
    );
    count++;
  }
  console.log(`  Sayfa ${page}/${totalPages}: toplam ${count} yazı`);
  if (page >= totalPages) break;
}

writeFileSync("import-wp.sql", lines.join("\n") + "\n");
console.log(`\nimport-wp.sql yazıldı (${count} yazı). ${media.size} görsel indiriliyor…`);

const upload = ["#!/bin/sh", "set -e"];
let done = 0;
for (const path of media) {
  const local = join("wp-media", path);
  if (!existsSync(local)) {
    try {
      const res = await fetch(`${site}/wp-content/uploads/${path}`);
      if (!res.ok) throw new Error(String(res.status));
      mkdirSync(dirname(local), { recursive: true });
      writeFileSync(local, Buffer.from(await res.arrayBuffer()));
    } catch (e) {
      console.warn(`  indirilemedi: ${path} (${e.message})`);
      continue;
    }
  }
  upload.push(`npx wrangler r2 object put "bitcoingazete-media/wp/${path}" --file "${local}" --remote`);
  if (++done % 50 === 0) console.log(`  ${done}/${media.size}`);
}
writeFileSync("upload-media.sh", upload.join("\n") + "\n");
console.log(`\nBitti. Sıradaki adımlar:
  1) npx wrangler d1 execute bitcoingazete --remote --file import-wp.sql
  2) sh upload-media.sh`);

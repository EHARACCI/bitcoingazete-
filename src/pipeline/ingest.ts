import { XMLParser } from "fast-xml-parser";
import type { Env } from "../env";
import { decodeEntities, sqlNow, stripHtml, truncate } from "../lib/text";

export interface Source {
  id: number;
  name: string;
  feed_url: string;
  site_url: string | null;
  lang: string;
  weight: number;
  enabled: number;
}

export interface ParsedItem {
  url: string;
  title: string;
  summary: string;
  publishedAt: string;
}

export const USER_AGENT = "Mozilla/5.0 (compatible; BitcoinGazeteBot/1.0; +https://bitcoingazete.com/yayin-ilkeleri)";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  processEntities: false,
});

function text(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    return text(o["#cdata"] ?? o["#text"] ?? "");
  }
  return "";
}

function atomLink(node: unknown): string {
  const links = Array.isArray(node) ? node : [node];
  for (const l of links) {
    if (typeof l === "string") return l;
    const o = l as Record<string, string> | undefined;
    if (o && (!o["@rel"] || o["@rel"] === "alternate") && o["@href"]) return o["@href"];
  }
  return "";
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u.trim());
    for (const p of [...url.searchParams.keys()]) if (/^(utm_|ref$|source$)/i.test(p)) url.searchParams.delete(p);
    url.hash = "";
    return url.toString();
  } catch {
    return u.trim();
  }
}

function toSqlDate(raw: string): string {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? sqlNow() : d.toISOString().slice(0, 19).replace("T", " ");
}

export function parseFeed(xml: string): ParsedItem[] {
  const doc = parser.parse(xml);
  const rssItems = doc?.rss?.channel?.item ?? doc?.["rdf:RDF"]?.item;
  const atomEntries = doc?.feed?.entry;
  const raw: unknown[] = rssItems ? [rssItems].flat() : atomEntries ? [atomEntries].flat() : [];
  const items: ParsedItem[] = [];
  for (const it of raw as Record<string, unknown>[]) {
    const title = decodeEntities(stripHtml(text(it.title))).trim();
    const url = normalizeUrl(text(it.link) || atomLink(it.link) || text(it.guid));
    if (!title || !/^https?:\/\//.test(url)) continue;
    const summary = truncate(
      stripHtml(decodeEntities(text(it.description) || text(it.summary) || text(it["content:encoded"]) || text(it.content))),
      800,
    );
    const date = text(it.pubDate) || text(it.published) || text(it.updated) || text(it["dc:date"]);
    items.push({ url, title, summary, publishedAt: toSqlDate(date) });
  }
  return items;
}

export async function fetchFeed(source: Source): Promise<ParsedItem[]> {
  const res = await fetch(source.feed_url, {
    headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseFeed(await res.text());
}

export interface IngestResult {
  sources: number;
  newItems: number;
  errors: string[];
}

/** Tüm aktif kaynakları paralel tarar, yeni haber sinyallerini kaydeder. */
export async function ingest(env: Env, log: (m: string) => void): Promise<IngestResult> {
  const { results: sources } = await env.DB.prepare("SELECT * FROM sources WHERE enabled = 1").all<Source>();
  const errors: string[] = [];
  let newItems = 0;
  const cutoff = Date.now() - 48 * 3600_000;

  await Promise.all(
    sources.map(async (src) => {
      try {
        const items = (await fetchFeed(src)).filter((i) => new Date(i.publishedAt.replace(" ", "T") + "Z").getTime() >= cutoff);
        if (items.length) {
          const stmts = items.slice(0, 40).map((i) =>
            env.DB.prepare(
              "INSERT OR IGNORE INTO feed_items (source_id, url, title, summary, published_at) VALUES (?, ?, ?, ?, ?)",
            ).bind(src.id, i.url, i.title, i.summary, i.publishedAt),
          );
          const res = await env.DB.batch(stmts);
          const added = res.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
          newItems += added;
          log(`  ${src.name}: ${items.length} öğe, ${added} yeni`);
        }
        await env.DB.prepare("UPDATE sources SET last_fetched_at = ?, last_error = NULL WHERE id = ?").bind(sqlNow(), src.id).run();
      } catch (e) {
        const msg = `${src.name}: ${(e as Error).message}`;
        errors.push(msg);
        log(`  HATA ${msg}`);
        await env.DB.prepare("UPDATE sources SET last_fetched_at = ?, last_error = ? WHERE id = ?")
          .bind(sqlNow(), (e as Error).message.slice(0, 300), src.id)
          .run();
      }
    }),
  );

  // Eski sinyalleri temizle (7 gün)
  await env.DB.prepare("DELETE FROM feed_items WHERE published_at < datetime('now', '-7 days')").run();
  return { sources: sources.length, newItems, errors };
}

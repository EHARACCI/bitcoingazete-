const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", I: "i", İ: "i", ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
  â: "a", î: "i", û: "u",
};

export function slugify(input: string, maxLen = 80): string {
  const s = input
    .replace(/[çÇğĞıIİöÖşŞüÜâîû]/g, (ch) => TR_MAP[ch] ?? ch)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  return cut.slice(0, cut.lastIndexOf("-") > 40 ? cut.lastIndexOf("-") : maxLen).replace(/-+$/, "");
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|iframe|form|nav|footer|header|aside)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/** Bir haber sayfasından okunabilir gövde metnini çıkarır (paragraf odaklı, kaba ama sağlam). */
export function extractArticleText(html: string, maxChars = 7000): string {
  const scope = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html;
  const paragraphs = [...scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtml(m[1]))
    .filter((p) => p.length > 60 && !/cookie|subscribe|newsletter|all rights reserved|sign up/i.test(p));
  const text = (paragraphs.length >= 3 ? paragraphs.join("\n\n") : stripHtml(scope)).trim();
  return text.length > maxChars ? text.slice(0, maxChars) + " […]" : text;
}

const STOPWORDS = new Set(
  (
    "the a an and or of to in on for with at by from as is are was were be been it its this that these those " +
    "after before over under into about amid says said will would could may might new news report reports " +
    "has have had not but than more most up down out how what why who which while just now today week year " +
    "ve ile bir bu şu da de için olarak daha en çok gibi göre sonra önce yeni son ama ancak hem ise mi mu " +
    "olan oldu olduğu etti eden ediyor yaptı yapılan üzere kadar her tüm"
  ).split(" "),
);

/** Başlık/metin benzerliği için normalize edilmiş anahtar kelime kümesi */
export function topicTokens(text: string): string[] {
  const words = text
    .toLocaleLowerCase("tr")
    .replace(/[’'`]s?\b/g, " ")
    .split(/[^a-z0-9çğıöşü$]+/i)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return [...new Set(words.map((w) => (w.length > 6 ? w.slice(0, 6) : w)))];
}

export function jaccard(a: Iterable<string>, b: Iterable<string>): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Kümenin küçüğüne göre örtüşme oranı (kısa başlıkların uzun başlıklarla eşleşmesi için) */
export function overlapCoefficient(a: Iterable<string>, b: Iterable<string>): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / Math.min(A.size, B.size);
}

export function words(text: string): string[] {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
}

export function wordCount(text: string): number {
  return words(text).length;
}

export function readingMinutes(wordsCount: number): number {
  return Math.max(1, Math.round(wordsCount / 200));
}

/** n-kelimelik parçalar: kopya/özgünlük kontrolü için */
export function shingles(text: string, n = 6): Set<string> {
  const w = text
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

/** Metindeki anlamlı sayıları rakam dizisi olarak çıkarır ("68.500 dolar" → "68500", "%4,2" → "42"). */
export function extractNumbers(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\d[\d.,]*\d|\d/g)) {
    const raw = m[0];
    const digits = raw.replace(/[.,]/g, "");
    const n = Number(digits);
    // tek haneli tam sayılar ve yıllar (2009-2035) bağlam için önemsiz kabul edilir
    if (digits.length === 1) continue;
    if (/^\d{4}$/.test(raw) && n >= 2009 && n <= 2035) continue;
    out.push(digits.replace(/0+$/, "") || "0");
  }
  return out;
}

const TR_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) veya ISO tarihini Türkiye saatiyle yazar */
export function formatDateTR(value: string | null | undefined, withTime = true): string {
  if (!value) return "";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return value;
  const tr = new Date(d.getTime() + 3 * 3600_000); // Türkiye UTC+3 (yaz saati yok)
  const date = `${tr.getUTCDate()} ${TR_MONTHS[tr.getUTCMonth()]} ${tr.getUTCFullYear()}`;
  if (!withTime) return date;
  return `${date}, ${String(tr.getUTCHours()).padStart(2, "0")}:${String(tr.getUTCMinutes()).padStart(2, "0")}`;
}

export function toIso(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function sqlNow(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : max - 1) + "…";
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

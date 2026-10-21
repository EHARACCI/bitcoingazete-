import type { Draft, Review } from "./ai";
import { extractNumbers, jaccard, shingles, topicTokens, wordCount, words } from "../lib/text";

export interface CheckResult {
  errors: string[];
  warnings: string[];
  metrics: Record<string, number>;
}

export interface QualityContext {
  /** Kaynak metinler + piyasa verisi */
  referenceText: string;
  /** Kaynak gövde metinleri (kopya kontrolü) */
  sourceTexts: string[];
  sourceNames: string[];
  /** Son yayınlanan haber başlıkları (tekrar kontrolü) */
  recentTitles: string[];
  minWords?: number;
  maxWords?: number;
}

const BANNED: [RegExp, string][] = [
  [/yatırım tavsiyesi(dir| niteliğindedir)/i, "yatırım tavsiyesi ifadesi"],
  [/\b(kesin|garantili?) (kazanç|getiri|yükseliş)/i, "garanti/kesin kazanç vaadi"],
  [/\b(hemen|şimdi) (al|satın al|sat)\b/i, "al-sat yönlendirmesi"],
  [/\bkaçırma(yın)?\b/i, "aciliyet/kaçırma yönlendirmesi"],
  [/aya gidiyor|to the moon|uçuşa geçti|roket gibi/i, "abartılı ifade"],
  [/\b(şok|bomba|inanılmaz|akılalmaz)\b/i, "tıklama tuzağı kelimesi"],
  [/yapay zeka (olarak|modeli olarak)|dil modeli olarak|as an ai/i, "modelin kendinden söz etmesi"],
  [/lorem ipsum|\bTODO\b|\[(kaynak|isim|tarih|rakam|xx+)\]|\bXX+\b/i, "yer tutucu metin"],
];

const STYLE_TELLS: [RegExp, string][] = [
  [/\bbu (makalede|yazıda)\b/i, "\"bu makalede\" kalıbı"],
  [/\bsonuç olarak\b/i, "\"sonuç olarak\" kalıbı"],
  [/\bunutmayın ki\b/i, "\"unutmayın ki\" kalıbı"],
  [/heyecan verici|devrim niteliğinde|oyunun kurallarını değiştir/i, "abartılı nitelendirme"],
  [/!/, "ünlem işareti"],
];

const TR_STOP = new Set(["ve", "bir", "bu", "için", "ile", "da", "de", "olarak", "daha", "en", "çok", "göre", "ise", "ancak", "olan", "gibi", "sonra", "kadar"]);

/** Taslağa uygulanan deterministik (modelden bağımsız) kalite kontrolleri. */
export function runChecks(d: Draft, ctx: QualityContext): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const body = d.body_markdown.trim();
  const plain = body.replace(/^#+\s*/gm, "").replace(/[*_`>]/g, "");
  const wc = wordCount(plain);
  const minW = ctx.minWords ?? 300;
  const maxW = ctx.maxWords ?? 1400;

  // Uzunluk ve yapı
  if (wc < minW) errors.push(`Metin çok kısa: ${wc} kelime (en az ${minW}).`);
  if (wc > maxW) errors.push(`Metin çok uzun: ${wc} kelime (en fazla ${maxW}).`);
  if (d.title.length < 30 || d.title.length > 95) errors.push(`Başlık uzunluğu ${d.title.length} karakter (30-95 olmalı).`);
  if (/[!?]$/.test(d.title.trim())) errors.push("Başlık soru veya ünlem işaretiyle bitmemeli.");
  if (d.title === d.title.toLocaleUpperCase("tr") && /[a-zçğıöşü]/i.test(d.title)) errors.push("Başlık tamamen büyük harf olmamalı.");
  if (d.summary.length < 80 || d.summary.length > 320) errors.push(`Spot uzunluğu ${d.summary.length} karakter (80-320 olmalı).`);
  if (d.meta_description.length < 100 || d.meta_description.length > 170)
    warnings.push(`Meta açıklama ${d.meta_description.length} karakter (120-160 önerilir).`);
  if (d.tags.length < 2 || d.tags.length > 8) warnings.push(`Etiket sayısı ${d.tags.length} (3-6 önerilir).`);

  const h2 = (body.match(/^## .+/gm) ?? []).length;
  if (/^# /m.test(body)) errors.push("Gövdede H1 (#) başlık kullanılmamalı.");
  if (wc >= 350 && h2 < 2) errors.push(`Ara başlık sayısı yetersiz: ${h2} (en az 2).`);
  if (/<[a-z][^>]*>/i.test(body)) errors.push("Gövdede HTML etiketi var.");
  if (/\]\(https?:\/\//.test(body) || /https?:\/\/\S+/.test(body)) warnings.push("Gövdede bağlantı var (kaynaklar ayrıca listelenir).");
  if (/^\|.+\|$/m.test(body)) warnings.push("Gövdede tablo var.");

  const paragraphs = body.split(/\n\s*\n/).filter((p) => !p.startsWith("#") && !/^[-*] /.test(p));
  const longParas = paragraphs.filter((p) => wordCount(p) > 110).length;
  if (longParas) warnings.push(`${longParas} paragraf 110 kelimeden uzun.`);

  // Dil: Türkçe mi?
  const w = words(plain.toLocaleLowerCase("tr"));
  const trRatio = w.filter((x) => TR_STOP.has(x)).length / Math.max(1, w.length);
  const trChars = (plain.match(/[çğıöşüÇĞİÖŞÜ]/g) ?? []).length / Math.max(1, plain.length);
  if (trRatio < 0.04 || trChars < 0.01) errors.push("Metin Türkçe görünmüyor.");

  // Yasaklı ifadeler
  const all = `${d.title}\n${d.summary}\n${body}`;
  for (const [re, label] of BANNED) if (re.test(all)) errors.push(`Yasaklı ifade: ${label} (${all.match(re)?.[0]}).`);
  for (const [re, label] of STYLE_TELLS) if (re.test(all)) warnings.push(`Üslup: ${label}.`);

  // Kaynak atfı: en az bir kaynağın adı metinde geçmeli
  const lowerAll = all.toLocaleLowerCase("tr");
  const attributed = ctx.sourceNames.filter((n) => lowerAll.includes(n.toLocaleLowerCase("tr").split(" ")[0]));
  if (ctx.sourceNames.length && attributed.length === 0) errors.push("Metinde hiçbir kaynağa atıf yapılmamış.");

  // Sayı doğrulama: metindeki rakamlar kaynaklarda veya piyasa verisinde geçiyor mu?
  const refNums = new Set(extractNumbers(ctx.referenceText));
  const unverified = [...new Set(extractNumbers(all))].filter((n) => !refNums.has(n) && !looselyMatches(n, refNums));
  if (unverified.length >= 4) errors.push(`Kaynaklarda bulunmayan ${unverified.length} sayı var: ${unverified.slice(0, 8).join(", ")}.`);
  else if (unverified.length) warnings.push(`Kaynaklarda doğrulanamayan sayılar: ${unverified.join(", ")}.`);

  // Özgünlük: kaynak metinlerle 6 kelimelik birebir örtüşme
  const mine = shingles(plain);
  let maxOverlap = 0;
  for (const src of ctx.sourceTexts) {
    const theirs = shingles(src);
    if (mine.size === 0 || theirs.size === 0) continue;
    let inter = 0;
    for (const s of mine) if (theirs.has(s)) inter++;
    maxOverlap = Math.max(maxOverlap, inter / mine.size);
  }
  if (maxOverlap > 0.12) errors.push(`Kaynak metinle birebir örtüşme yüksek: %${Math.round(maxOverlap * 100)}.`);
  else if (maxOverlap > 0.05) warnings.push(`Kaynak metinle birebir örtüşme: %${Math.round(maxOverlap * 100)}.`);

  // Tekrar: son haberlerle başlık benzerliği
  const titleTokens = topicTokens(d.title);
  const dupe = ctx.recentTitles.find((t) => jaccard(titleTokens, topicTokens(t)) >= 0.55);
  if (dupe) errors.push(`Son yayınlanan bir haberle çok benzer: "${dupe}".`);

  return {
    errors,
    warnings,
    metrics: { words: wc, h2, unverifiedNumbers: unverified.length, sourceOverlapPct: Math.round(maxOverlap * 100), trRatio: Math.round(trRatio * 100) },
  };
}

/** "68500" ile "685" (68,5 bin) gibi yuvarlama/biçim farklarını tolere eder. */
function looselyMatches(n: string, ref: Set<string>): boolean {
  if (n.length >= 3) {
    for (const r of ref) if (r.length >= 3 && (r.startsWith(n) || n.startsWith(r))) return true;
  }
  return false;
}

export interface GateDecision {
  pass: boolean;
  score: number;
  reasons: string[];
}

/** Editör puanları + otomatik kontroller → yayın kararı */
export function gate(check: CheckResult, review: Review, minScore: number): GateDecision {
  const s = review.scores;
  const values = Object.values(s);
  // Doğruluk ve tarafsızlık iki kat ağırlıklı
  const weighted = (s.accuracy * 2 + s.neutrality * 2 + s.originality + s.clarity + s.language + s.headline + s.seo) / 9;
  const score = Math.round(weighted * 10) / 10;
  const reasons: string[] = [];
  if (check.errors.length) reasons.push(...check.errors);
  if (review.critical_issues.length) reasons.push(...review.critical_issues);
  if (review.verdict !== "publish") reasons.push(`Editör kararı: ${review.verdict}`);
  if (score < minScore) reasons.push(`Kalite puanı ${score} < ${minScore}`);
  if (s.accuracy < 8) reasons.push(`Doğruluk puanı ${s.accuracy} < 8`);
  if (Math.min(...values) < 6) reasons.push(`En düşük boyut puanı ${Math.min(...values)} < 6`);
  return { pass: reasons.length === 0, score, reasons };
}

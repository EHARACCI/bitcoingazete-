import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFeed } from "../src/pipeline/ingest";
import { clusterSignals, scoreStory, type Signal } from "../src/pipeline/select";
import { gate, runChecks } from "../src/pipeline/quality";
import type { Draft, Review } from "../src/pipeline/ai";
import { extractNumbers, slugify } from "../src/lib/text";
import { renderMarkdown } from "../src/lib/markdown";

const fixture = (f: string) => readFileSync(new URL(`./fixtures/site/${f}`, import.meta.url), "utf8");

describe("metin yardımcıları", () => {
  it("Türkçe slug üretir", () => {
    expect(slugify("Bitcoin'in Yükselişi: ŞOK Gelişme! İşte Ayrıntılar")).toBe("bitcoin-in-yukselisi-sok-gelisme-iste-ayrintilar");
  });
  it("sayıları biçimden bağımsız çıkarır", () => {
    expect(extractNumbers("Fiyat 98.000 dolar, değişim %4,25 ve 2025 yılı")).toEqual(["98", "425"]);
    expect(extractNumbers("$98,000 and 1.2 billion")).toEqual(["98", "12"]);
  });
  it("markdown içindeki ham HTML'i etkisizleştirir", () => {
    expect(renderMarkdown("Merhaba <script>alert(1)</script>")).not.toContain("<script>");
  });
});

describe("RSS/Atom ayrıştırma", () => {
  it("RSS 2.0 öğelerini okur ve izleme parametrelerini temizler", () => {
    const items = parseFeed(fixture("feed-a.xml"));
    expect(items).toHaveLength(3);
    expect(items[0].title).toContain("BlackRock");
    expect(items[0].url).toBe("http://localhost:4010/a/blackrock-etf.html");
    expect(items[0].summary).not.toContain("<p>");
  });
  it("Atom girdilerini okur", () => {
    const items = parseFeed(fixture("feed-b.xml"));
    expect(items).toHaveLength(2);
    expect(items[0].url).toBe("http://localhost:4010/b/ibit-inflows.html");
  });
});

describe("haber seçimi", () => {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const sig = (id: number, source_id: number, title: string): Signal => ({
    id, source_id, source_name: `S${source_id}`, source_lang: "en", source_weight: 1, url: `https://x/${id}`, title, summary: "", published_at: now,
  });
  const stories = clusterSignals([
    sig(1, 1, "BlackRock's Bitcoin ETF Records $1.2 Billion Inflow as BTC Tops $98,000"),
    sig(2, 2, "Bitcoin ETF Inflows: BlackRock IBIT Pulls in $1.2B in a Single Day"),
    sig(3, 1, "SEC Delays Decision on Solana ETF Applications Until January"),
    sig(4, 2, "Ethereum Developers Set Date for Next Network Upgrade"),
    sig(5, 1, "Top 5 Coins That Could Explode 100x Gains This Month"),
  ]);
  it("aynı olayı anlatan haberleri birleştirir", () => {
    const etf = stories.find((s) => s.items.some((i) => i.id === 1))!;
    expect(etf.items.map((i) => i.id).sort()).toEqual([1, 2]);
    expect(stories).toHaveLength(4);
  });
  it("çok kaynaklı haberi öne, tanıtım içeriğini geriye atar", () => {
    const score = (id: number) => scoreStory(stories.find((s) => s.items.some((i) => i.id === id))!);
    expect(score(1)).toBeGreaterThan(score(3));
    expect(score(5)).toBeLessThan(3);
  });
});

const sourceText =
  "BlackRock's iShares Bitcoin Trust (IBIT) recorded net inflows of $1.2 billion on Monday, according to Farside Investors. Bitcoin climbed above $98,000.";

function goodDraft(): Draft {
  const p =
    "Farside Investors verilerine göre BlackRock'un spot Bitcoin borsa yatırım fonu IBIT, pazartesi günü 1,2 milyar dolarlık net giriş kaydetti. " +
    "CoinDesk'in aktardığına göre bu rakam, fonun son üç ayda gördüğü en yüksek günlük giriş oldu ve kurumsal talebin güçlü seyrettiğine işaret ediyor.";
  const body = [p, "## Girişlerin arka planı", p, p, "## Piyasaya etkisi", p, p, "## Bundan sonra ne olacak", p, p, p, p].join("\n\n");
  return {
    newsworthy: true, skip_reason: "",
    title: "BlackRock'un Bitcoin ETF'sine tek günde 1,2 milyar dolarlık giriş",
    summary: "BlackRock'un spot Bitcoin ETF'si IBIT, pazartesi günü 1,2 milyar dolarlık net girişle son üç ayın en güçlü gününü yaşadı.",
    meta_description: "BlackRock'un spot Bitcoin ETF'si IBIT'e pazartesi günü 1,2 milyar dolarlık net giriş oldu. Kurumsal talep ve piyasaya etkileri haberimizde.",
    category: "bitcoin", tags: ["Bitcoin ETF", "BlackRock", "IBIT"], body_markdown: body,
    claims: [{ claim: "1,2 milyar dolar giriş", source: 1 }], image_prompt: "x", image_alt: "x",
  };
}

const ctx = { referenceText: sourceText, sourceTexts: [sourceText], sourceNames: ["CoinDesk"], recentTitles: [] as string[] };

describe("otomatik kalite kontrolleri", () => {
  it("kurallara uyan taslakta hata bulmaz", () => {
    const r = runChecks(goodDraft(), ctx);
    expect(r.errors).toEqual([]);
  });
  it("kısa, kaynaksız, abartılı ve uydurma sayılı taslağı yakalar", () => {
    const d = goodDraft();
    d.title = "ŞOK! BITCOIN UÇUŞA GEÇTİ!";
    d.body_markdown = "Bitcoin 150.000 dolara, Ethereum 12.500 dolara çıkacak, Solana 870 dolar, XRP 45 dolar olacak. Hemen al!";
    const r = runChecks(d, ctx);
    const all = r.errors.join(" | ");
    expect(all).toMatch(/çok kısa/);
    expect(all).toMatch(/Başlık soru veya ünlem/);
    expect(all).toMatch(/tamamen büyük harf/);
    expect(all).toMatch(/Yasaklı ifade/);
    expect(all).toMatch(/atıf/);
    expect(all).toMatch(/Kaynaklarda bulunmayan/);
  });
  it("kaynağın birebir kopyasını yakalar", () => {
    const d = goodDraft();
    d.body_markdown = Array(12).fill(sourceText).join("\n\n") + "\n\n## A\n\n## B\n\nCoinDesk ve bir de için olarak göre çok daha ğüşıöç.";
    expect(runChecks(d, ctx).errors.join(" ")).toMatch(/Türkçe görünmüyor|birebir örtüşme/);
  });
  it("son haberlerle tekrar eden başlığı yakalar", () => {
    const r = runChecks(goodDraft(), { ...ctx, recentTitles: ["BlackRock'un Bitcoin ETF'sine tek günde 1,2 milyar dolarlık giriş oldu"] });
    expect(r.errors.join(" ")).toMatch(/çok benzer/);
  });
});

describe("yayın kapısı", () => {
  const review = (over: Partial<Review["scores"]> = {}, extra: Partial<Review> = {}): Review => ({
    scores: { accuracy: 9, originality: 8, clarity: 8, language: 8, neutrality: 9, headline: 8, seo: 8, ...over },
    critical_issues: [], improvements: [], verdict: "publish", ...extra,
  });
  const clean = { errors: [], warnings: [], metrics: {} };
  it("yüksek puanlı ve temiz taslağı geçirir", () => {
    expect(gate(clean, review(), 7.5).pass).toBe(true);
  });
  it("doğruluk puanı 8'in altındaysa engeller", () => {
    expect(gate(clean, review({ accuracy: 7 }), 7.5).pass).toBe(false);
  });
  it("kritik sorun veya otomatik hata varsa engeller", () => {
    expect(gate(clean, review({}, { critical_issues: ["Uydurma alıntı"] }), 7.5).pass).toBe(false);
    expect(gate({ ...clean, errors: ["Metin çok kısa"] }, review(), 7.5).pass).toBe(false);
  });
});

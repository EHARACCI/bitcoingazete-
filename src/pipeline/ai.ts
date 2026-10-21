import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Env } from "../env";
import { CATEGORY_SLUGS } from "../config";
import { EDITOR_SYSTEM, WRITER_SYSTEM } from "./prompts";
import type { ResearchPack } from "./research";

export const DraftSchema = z.object({
  newsworthy: z.boolean(),
  skip_reason: z.string(),
  title: z.string(),
  summary: z.string(),
  meta_description: z.string(),
  category: z.enum(CATEGORY_SLUGS),
  tags: z.array(z.string()),
  body_markdown: z.string(),
  claims: z.array(z.object({ claim: z.string(), source: z.number().int() })),
  image_prompt: z.string(),
  image_alt: z.string(),
});
export type Draft = z.infer<typeof DraftSchema>;

const Score = z.number().int();
export const ReviewSchema = z.object({
  scores: z.object({
    accuracy: Score,
    originality: Score,
    clarity: Score,
    language: Score,
    neutrality: Score,
    headline: Score,
    seo: Score,
  }),
  critical_issues: z.array(z.string()),
  improvements: z.array(z.string()),
  verdict: z.enum(["publish", "revise", "reject"]),
});
export type Review = z.infer<typeof ReviewSchema>;

export class AiRefusalError extends Error {}

function client(env: Env): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY tanımlı değil (wrangler secret put ANTHROPIC_API_KEY)");
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 3, timeout: 5 * 60_000 });
}

function researchBlock(pack: ResearchPack): string {
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long", timeZone: "Europe/Istanbul" });
  const sources = pack.sources
    .map(
      (s) =>
        `<kaynak no="${s.index}" ad="${s.name}" dil="${s.lang}" url="${s.url}">\nBaşlık: ${s.title}\n\n${s.text}\n</kaynak>`,
    )
    .join("\n\n");
  return `Bugünün tarihi: ${today}\n\n<kaynaklar>\n${sources}\n</kaynaklar>\n\n<piyasa_verisi kaynak_no="0">\n${pack.marketContext}\n</piyasa_verisi>`;
}

async function structured<T>(
  env: Env,
  model: string,
  system: string,
  user: string,
  schema: z.ZodType<T>,
  effort: "medium" | "high",
): Promise<T> {
  const response = await client(env).beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") {
    throw new AiRefusalError(`Model isteği reddetti (${response.stop_details?.category ?? "bilinmiyor"})`);
  }
  if (response.stop_reason === "max_tokens") throw new Error("Model çıktısı max_tokens sınırında kesildi");
  if (!response.parsed_output) throw new Error("Model yapılandırılmış çıktı üretmedi");
  return response.parsed_output;
}

export async function writeDraft(env: Env, pack: ResearchPack): Promise<Draft> {
  if (env.AI_MOCK === "on") return mockDraft(pack);
  const user = `${researchBlock(pack)}\n\nYukarıdaki kaynaklara dayanarak yayın ilkelerine tam uyan haberi yaz.`;
  return structured(env, env.WRITER_MODEL, WRITER_SYSTEM, user, DraftSchema, "high");
}

export async function reviseDraft(env: Env, pack: ResearchPack, draft: Draft, feedback: string[]): Promise<Draft> {
  if (env.AI_MOCK === "on") return { ...mockDraft(pack), title: draft.title };
  const user =
    `${researchBlock(pack)}\n\n<onceki_taslak>\n${JSON.stringify(draft, null, 2)}\n</onceki_taslak>\n\n` +
    `<editor_geri_bildirimi>\n${feedback.map((f) => `- ${f}`).join("\n")}\n</editor_geri_bildirimi>\n\n` +
    `Editörün ve otomatik kontrollerin tüm geri bildirimlerini gidererek haberin tamamını yeniden yaz. ` +
    `Doğru olan kısımları koru; düzeltme yaparken kaynaklarda olmayan bilgi ekleme.`;
  return structured(env, env.WRITER_MODEL, WRITER_SYSTEM, user, DraftSchema, "high");
}

export async function reviewDraft(env: Env, pack: ResearchPack, draft: Draft, automatedFindings: string[]): Promise<Review> {
  if (env.AI_MOCK === "on") return mockReview();
  const user =
    `${researchBlock(pack)}\n\n<taslak>\n# ${draft.title}\n\nSpot: ${draft.summary}\n\nMeta açıklama: ${draft.meta_description}\n` +
    `Kategori: ${draft.category} | Etiketler: ${draft.tags.join(", ")}\n\n${draft.body_markdown}\n</taslak>\n\n` +
    `<muhabirin_iddia_listesi>\n${draft.claims.map((c) => `- [${c.source}] ${c.claim}`).join("\n")}\n</muhabirin_iddia_listesi>\n\n` +
    (automatedFindings.length
      ? `<otomatik_kontrol_bulgulari>\n${automatedFindings.map((f) => `- ${f}`).join("\n")}\n</otomatik_kontrol_bulgulari>\n\n`
      : "") +
    `Taslağı kaynaklarla satır satır karşılaştırarak denetle ve değerlendirmeni ver.`;
  return structured(env, env.EDITOR_MODEL, EDITOR_SYSTEM, user, ReviewSchema, "high");
}

// ---------------------------------------------------------------------------
// Yerel geliştirme için sahte yazar/editör (AI_MOCK=on). API çağrısı yapmaz.

function mockDraft(pack: ResearchPack): Draft {
  const lead = pack.sources[0];
  const names = pack.sources.map((s) => s.name).join(", ");
  const para = (n: number) =>
    `${lead.name}'in aktardığına göre bu gelişme, kripto para piyasasında yakından takip ediliyor. ` +
    `Konuyla ilgili haberler ${names} tarafından da paylaşıldı ve yatırımcıların gündeminde ilk sıralara yerleşti. ` +
    `Uzmanlar gelişmenin orta vadeli etkilerinin önümüzdeki haftalarda daha net görüleceğini belirtiyor (${n}).`;
  const body = [
    para(1),
    "## Gelişmenin ayrıntıları",
    para(2),
    para(3),
    "## Piyasaya etkisi",
    `Haberin yazıldığı sırada piyasa verileri şöyleydi:\n\n${pack.marketContext}`,
    para(4),
    "## Bundan sonra ne olacak",
    para(5),
    para(6),
    para(7),
    para(8),
    para(9),
    para(10),
  ].join("\n\n");
  return {
    newsworthy: true,
    skip_reason: "",
    title: `Test haberi: ${lead.title}`.slice(0, 88),
    summary: `${lead.name} kaynaklı bu test haberi, otomatik içerik hattının uçtan uca çalıştığını doğrulamak için sahte yazar tarafından üretildi.`,
    meta_description:
      "Bitcoin Gazete otomatik içerik hattı test haberi: kaynak tarama, haber seçimi, yazım ve kalite kontrol adımlarının çıktısı.",
    category: "bitcoin",
    tags: ["Bitcoin", "Kripto Para", "Test"],
    body_markdown: body,
    claims: [{ claim: lead.title, source: 1 }],
    image_prompt: "abstract editorial illustration of a bitcoin coin, deep navy and orange palette",
    image_alt: "Bitcoin temalı soyut illüstrasyon",
  };
}

function mockReview(): Review {
  return {
    scores: { accuracy: 9, originality: 8, clarity: 8, language: 8, neutrality: 9, headline: 8, seo: 8 },
    critical_issues: [],
    improvements: ["(sahte editör) Örnek iyileştirme önerisi."],
    verdict: "publish",
  };
}

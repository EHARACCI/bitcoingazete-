import type { Env } from "../env";
import { extractArticleText } from "../lib/text";
import { detectCoins, getFearGreed, getQuotes, quotesToContext } from "../lib/market";
import { USER_AGENT } from "./ingest";
import type { Story } from "./select";

export interface SourceDoc {
  index: number;
  name: string;
  url: string;
  lang: string;
  title: string;
  text: string;
}

export interface ResearchPack {
  story: Story;
  sources: SourceDoc[];
  marketContext: string;
  /** Kalite kontrolünde sayı doğrulaması için ham referans metin */
  referenceText: string;
}

async function fetchArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return "";
    return extractArticleText(await res.text());
  } catch {
    return "";
  }
}

/** Haberin kaynak metinlerini ve güncel piyasa verisini toplar. */
export async function research(env: Env, story: Story): Promise<ResearchPack> {
  // Her kaynaktan en fazla bir öğe, en güvenilir 4 kaynak
  const seen = new Set<number>();
  const picked = [...story.items]
    .sort((a, b) => b.source_weight - a.source_weight)
    .filter((i) => (seen.has(i.source_id) ? false : (seen.add(i.source_id), true)))
    .slice(0, 4);

  const texts = await Promise.all(picked.map((i) => fetchArticleText(i.url)));
  const sources: SourceDoc[] = picked.map((i, idx) => ({
    index: idx + 1,
    name: i.source_name,
    url: i.url,
    lang: i.source_lang,
    title: i.title,
    // Sayfa okunamazsa RSS özetine düş
    text: texts[idx] && texts[idx].length > 300 ? texts[idx] : (i.summary ?? ""),
  }));

  const allText = sources.map((s) => `${s.title}\n${s.text}`).join("\n\n");
  const [quotes, fng] = await Promise.all([getQuotes(env, detectCoins(allText)), getFearGreed()]);
  const marketContext = quotesToContext(quotes, fng);

  return { story, sources, marketContext, referenceText: `${allText}\n\n${marketContext}` };
}

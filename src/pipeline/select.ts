import type { Env } from "../env";
import { BOOST_KEYWORDS, LOW_VALUE_PATTERNS } from "../config";
import { jaccard, overlapCoefficient, topicTokens } from "../lib/text";

export interface Signal {
  id: number;
  source_id: number;
  source_name: string;
  source_lang: string;
  source_weight: number;
  url: string;
  title: string;
  summary: string | null;
  published_at: string;
}

export interface Story {
  key: string;
  tokens: string[];
  items: Signal[];
  score: number;
}

const ageHours = (sqlDate: string) => (Date.now() - new Date(sqlDate.replace(" ", "T") + "Z").getTime()) / 3600_000;

/** Aynı olayı anlatan sinyalleri birleştirir (başlık benzerliğine göre açgözlü kümeleme). */
export function clusterSignals(signals: Signal[]): Story[] {
  const stories: Story[] = [];
  const sorted = [...signals].sort((a, b) => b.published_at.localeCompare(a.published_at));
  for (const s of sorted) {
    const tokens = topicTokens(`${s.title}`);
    let best: Story | null = null;
    let bestSim = 0;
    for (const st of stories) {
      const sim = Math.max(jaccard(tokens, st.tokens), overlapCoefficient(tokens, st.tokens) * 0.8);
      if (sim > bestSim) {
        bestSim = sim;
        best = st;
      }
    }
    if (best && bestSim >= 0.34) {
      best.items.push(s);
      best.tokens = [...new Set([...best.tokens, ...tokens])].slice(0, 40);
    } else {
      stories.push({ key: tokens.slice(0, 6).join("-"), tokens, items: [s], score: 0 });
    }
  }
  return stories;
}

export function scoreStory(story: Story): number {
  const distinctSources = new Set(story.items.map((i) => i.source_id)).size;
  const weight = Math.max(...story.items.map((i) => i.source_weight));
  const newest = Math.min(...story.items.map((i) => ageHours(i.published_at)));
  const text = story.items.map((i) => `${i.title} ${i.summary ?? ""}`).join(" ").toLowerCase();

  let score = distinctSources * 2.5 + weight;
  score += Math.max(0, 3 - newest / 4); // ilk 12 saatte tazelik bonusu
  score += Math.min(3, BOOST_KEYWORDS.filter((k) => text.includes(k)).length * 0.6);
  if (story.items.some((i) => LOW_VALUE_PATTERNS.some((p) => p.test(i.title)))) score -= 6;
  if (story.items.every((i) => i.source_lang === "tr")) score -= 1; // yabancı kaynaklı özgün haber öncelikli
  return Math.round(score * 100) / 100;
}

/**
 * Yazılacak en önemli haberleri seçer:
 * - son 36 saatteki işlenmemiş sinyaller kümelenir
 * - son 3 günde yazılmış konular elenir (tekrar haber yok)
 * - puana göre sıralanır
 */
export async function selectStories(env: Env, limit: number): Promise<Story[]> {
  const { results: signals } = await env.DB.prepare(
    `SELECT f.id, f.source_id, s.name AS source_name, s.lang AS source_lang, s.weight AS source_weight,
            f.url, f.title, f.summary, f.published_at
       FROM feed_items f JOIN sources s ON s.id = f.source_id
      WHERE f.status = 'new' AND f.published_at >= datetime('now', '-36 hours')
      ORDER BY f.published_at DESC LIMIT 400`,
  ).all<Signal>();
  if (signals.length === 0) return [];

  const { results: recent } = await env.DB.prepare(
    `SELECT topic_tokens FROM articles
      WHERE created_at >= datetime('now', '-72 hours') AND topic_tokens IS NOT NULL`,
  ).all<{ topic_tokens: string }>();
  const recentTopics = recent.map((r) => JSON.parse(r.topic_tokens) as string[]);

  const stories = clusterSignals(signals);
  const fresh: Story[] = [];
  const covered: Story[] = [];
  for (const st of stories) {
    st.score = scoreStory(st);
    const dup = recentTopics.some((t) => jaccard(st.tokens, t) >= 0.3 || overlapCoefficient(st.tokens.slice(0, 12), t) >= 0.6);
    (dup ? covered : fresh).push(st);
  }

  // Zaten yazılmış konulara ait sinyalleri tekrar değerlendirmemek için işaretle
  if (covered.length) {
    const ids = covered.flatMap((s) => s.items.map((i) => i.id));
    for (let i = 0; i < ids.length; i += 90) {
      const chunk = ids.slice(i, i + 90);
      await env.DB.prepare(`UPDATE feed_items SET status = 'skipped' WHERE id IN (${chunk.map(() => "?").join(",")})`)
        .bind(...chunk)
        .run();
    }
  }

  return fresh
    .filter((s) => s.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function markSignals(env: Env, story: Story, status: "used" | "skipped", articleId: number | null) {
  const ids = story.items.map((i) => i.id);
  await env.DB.prepare(`UPDATE feed_items SET status = ?, article_id = ? WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(status, articleId, ...ids)
    .run();
}

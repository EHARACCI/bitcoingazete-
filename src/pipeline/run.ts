import type { Env } from "../env";
import { renderMarkdown } from "../lib/markdown";
import { slugify, sqlNow, topicTokens, wordCount } from "../lib/text";
import { AiRefusalError, reviewDraft, reviseDraft, writeDraft, type Draft, type Review } from "./ai";
import { generateCover } from "./image";
import { ingest } from "./ingest";
import { gate, runChecks, type CheckResult, type GateDecision } from "./quality";
import { research } from "./research";
import { markSignals, selectStories, type Story } from "./select";

interface Attempt {
  attempt: number;
  title: string;
  check: CheckResult;
  review: Review;
  decision: GateDecision;
}

export interface RunStats {
  ingested: number;
  candidates: number;
  published: number;
  queued: number;
  rejected: number;
  failed: number;
}

export async function getSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSetting(env: Env, key: string, value: string) {
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(key, value)
    .run();
}

async function uniqueSlug(env: Env, base: string): Promise<string> {
  let slug = base || `haber-${Date.now()}`;
  for (let i = 2; ; i++) {
    const exists = await env.DB.prepare("SELECT 1 FROM articles WHERE slug = ?").bind(slug).first();
    if (!exists) return slug;
    slug = `${base}-${i}`;
  }
}

/** Tek bir haberi uçtan uca işler: araştır → yaz → kontrol et → (gerekirse) revize et → kaydet. */
async function processStory(env: Env, story: Story, log: (m: string) => void): Promise<"published" | "needs_review" | "rejected"> {
  const pack = await research(env, story);
  log(`  Kaynaklar: ${pack.sources.map((s) => `${s.name}${s.text.length > 300 ? "" : " (yalnızca özet)"}`).join(", ")}`);

  const { results: recent } = await env.DB.prepare(
    "SELECT title FROM articles WHERE created_at >= datetime('now', '-4 days') ORDER BY id DESC LIMIT 200",
  ).all<{ title: string }>();
  const ctx = {
    referenceText: pack.referenceText,
    sourceTexts: pack.sources.map((s) => s.text),
    sourceNames: pack.sources.map((s) => s.name),
    recentTitles: recent.map((r) => r.title),
  };

  const minScore = Number(env.MIN_QUALITY_SCORE) || 7.5;
  const maxRevisions = Number(env.MAX_REVISIONS) || 0;
  const attempts: Attempt[] = [];

  let draft: Draft = await writeDraft(env, pack);
  let decision: GateDecision | null = null;
  let review: Review | null = null;

  if (!draft.newsworthy) {
    log(`  Haber değeri yok: ${draft.skip_reason}`);
  } else {
    for (let attempt = 1; ; attempt++) {
      const check = runChecks(draft, ctx);
      review = await reviewDraft(env, pack, draft, [...check.errors, ...check.warnings]);
      decision = gate(check, review, minScore);
      attempts.push({ attempt, title: draft.title, check, review, decision });
      log(
        `  Deneme ${attempt}: puan ${decision.score}, editör "${review.verdict}", ${check.errors.length} hata, ${check.warnings.length} uyarı` +
          (decision.pass ? " → GEÇTİ" : ""),
      );
      if (decision.pass || review.verdict === "reject" || attempt > maxRevisions) break;
      const feedback = [...check.errors, ...review.critical_issues, ...review.improvements, ...check.warnings];
      draft = await reviseDraft(env, pack, draft, feedback);
    }
  }

  const status: "published" | "needs_review" | "rejected" =
    !draft.newsworthy || review?.verdict === "reject"
      ? "rejected"
      : decision?.pass
        ? env.PUBLISH_MODE === "auto"
          ? "published"
          : "needs_review"
        : "needs_review";

  const slug = await uniqueSlug(env, slugify(draft.title));
  let imageKey: string | null = null;
  if (status !== "rejected") {
    try {
      imageKey = await generateCover(env, slug, draft.image_prompt);
    } catch (e) {
      log(`  Görsel üretilemedi: ${(e as Error).message}`);
    }
  }

  const now = sqlNow();
  const report = {
    finalStatus: status,
    skipReason: draft.newsworthy ? null : draft.skip_reason,
    storyScore: story.score,
    attempts,
    claims: draft.claims,
  };
  const inserted = await env.DB.prepare(
    `INSERT INTO articles (slug, title, summary, meta_description, body_md, body_html, category, tags, sources,
       image_key, image_alt, status, quality_score, quality_report, topic_tokens, word_count, ai_generated, model,
       created_at, updated_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      slug,
      draft.title,
      draft.summary,
      draft.meta_description,
      draft.body_markdown,
      renderMarkdown(draft.body_markdown),
      draft.category,
      JSON.stringify(draft.tags.slice(0, 8)),
      JSON.stringify(pack.sources.map((s) => ({ name: s.name, url: s.url }))),
      imageKey,
      draft.image_alt,
      status,
      decision?.score ?? null,
      JSON.stringify(report),
      JSON.stringify(story.tokens.slice(0, 24).concat(topicTokens(draft.title)).slice(0, 40)),
      wordCount(draft.body_markdown),
      env.AI_MOCK === "on" ? "mock" : env.WRITER_MODEL,
      now,
      now,
      status === "published" ? now : null,
    )
    .first<{ id: number }>();

  await markSignals(env, story, status === "rejected" ? "skipped" : "used", inserted?.id ?? null);
  log(`  Sonuç: ${status} → /haber/${slug}`);
  return status;
}

export async function runPipeline(env: Env, trigger: "cron" | "manual", maxArticles?: number): Promise<RunStats> {
  const lines: string[] = [];
  const log = (m: string) => {
    lines.push(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
    console.log(m);
  };
  const stats: RunStats = { ingested: 0, candidates: 0, published: 0, queued: 0, rejected: 0, failed: 0 };
  const run = await env.DB.prepare("INSERT INTO runs (trigger) VALUES (?) RETURNING id").bind(trigger).first<{ id: number }>();
  let status: "ok" | "error" = "ok";

  try {
    if ((await getSetting(env, "paused")) === "1") {
      log("Otomatik yayın duraklatılmış; çalışma atlandı.");
      return stats;
    }

    log("Kaynaklar taranıyor…");
    const ing = await ingest(env, log);
    stats.ingested = ing.newItems;

    const { n: today } = (await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM articles
        WHERE ai_generated = 1 AND status IN ('published','needs_review') AND created_at >= datetime('now', 'start of day')`,
    ).first<{ n: number }>())!;
    const daily = Number(env.DAILY_LIMIT) || 24;
    const want = Math.min(maxArticles ?? (Number(env.ARTICLES_PER_RUN) || 2), Math.max(0, daily - today));
    if (want === 0) {
      log(`Günlük limit doldu (${today}/${daily}).`);
      return stats;
    }

    const stories = await selectStories(env, want + 3);
    stats.candidates = stories.length;
    log(`${stories.length} aday haber bulundu, hedef ${want}.`);

    let produced = 0;
    for (const story of stories) {
      if (produced >= want) break;
      log(`Haber: "${story.items[0].title}" (puan ${story.score}, ${story.items.length} sinyal)`);
      try {
        const result = await processStory(env, story, log);
        if (result === "published") stats.published++;
        else if (result === "needs_review") stats.queued++;
        else stats.rejected++;
        if (result !== "rejected") produced++;
      } catch (e) {
        stats.failed++;
        log(`  HATA: ${(e as Error).message}`);
        if (e instanceof AiRefusalError) {
          await markSignals(env, story, "skipped", null);
          continue;
        }
        // API anahtarı, kota veya ağ sorunu gibi sistemik hatalarda bu turu bitir; sinyaller sonraki tura kalır
        status = "error";
        break;
      }
    }
    return stats;
  } catch (e) {
    status = "error";
    log(`KRİTİK HATA: ${(e as Error).stack ?? e}`);
    throw e;
  } finally {
    log(`Bitti: ${JSON.stringify(stats)}`);
    await env.DB.prepare("UPDATE runs SET status = ?, stats = ?, log = ?, finished_at = ? WHERE id = ?")
      .bind(status, JSON.stringify(stats), lines.join("\n"), sqlNow(), run!.id)
      .run();
  }
}

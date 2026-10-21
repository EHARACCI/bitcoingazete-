import type { Env } from "../env";

export interface ArticleRow {
  id: number;
  slug: string;
  title: string;
  summary: string;
  meta_description: string;
  body_md: string | null;
  body_html: string;
  category: string;
  tags: string;
  sources: string;
  image_key: string | null;
  image_alt: string | null;
  status: string;
  quality_score: number | null;
  quality_report: string | null;
  word_count: number;
  ai_generated: number;
  model: string | null;
  views: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export type ArticleCard = Pick<ArticleRow, "id" | "slug" | "title" | "summary" | "category" | "image_key" | "image_alt" | "published_at" | "word_count">;

const CARD_COLS = "id, slug, title, summary, category, image_key, image_alt, published_at, word_count";

export async function latest(env: Env, limit: number, offset = 0): Promise<ArticleCard[]> {
  const { results } = await env.DB.prepare(
    `SELECT ${CARD_COLS} FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all<ArticleCard>();
  return results;
}

export async function byCategory(env: Env, category: string, limit: number, offset = 0): Promise<ArticleCard[]> {
  const { results } = await env.DB.prepare(
    `SELECT ${CARD_COLS} FROM articles WHERE status = 'published' AND category = ? ORDER BY published_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(category, limit, offset)
    .all<ArticleCard>();
  return results;
}

export async function byTag(env: Env, tag: string, limit: number, offset = 0): Promise<ArticleCard[]> {
  const { results } = await env.DB.prepare(
    `SELECT ${CARD_COLS} FROM articles a WHERE status = 'published'
       AND EXISTS (SELECT 1 FROM json_each(a.tags) WHERE lower(json_each.value) = lower(?))
     ORDER BY published_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(tag, limit, offset)
    .all<ArticleCard>();
  return results;
}

export async function search(env: Env, q: string, limit: number, offset = 0): Promise<ArticleCard[]> {
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const { results } = await env.DB.prepare(
    `SELECT ${CARD_COLS} FROM articles WHERE status = 'published' AND (title LIKE ? OR summary LIKE ? OR body_md LIKE ?)
     ORDER BY published_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(like, like, like, limit, offset)
    .all<ArticleCard>();
  return results;
}

export async function popular(env: Env, limit: number): Promise<ArticleCard[]> {
  const { results } = await env.DB.prepare(
    `SELECT ${CARD_COLS} FROM articles WHERE status = 'published' AND published_at >= datetime('now', '-7 days')
     ORDER BY views DESC, published_at DESC LIMIT ?`,
  )
    .bind(limit)
    .all<ArticleCard>();
  return results;
}

export async function related(env: Env, a: ArticleRow, limit: number): Promise<ArticleCard[]> {
  const { results } = await env.DB.prepare(
    `SELECT ${CARD_COLS} FROM articles WHERE status = 'published' AND id != ? AND category = ?
     ORDER BY published_at DESC LIMIT ?`,
  )
    .bind(a.id, a.category, limit)
    .all<ArticleCard>();
  return results;
}

export async function getBySlug(env: Env, slug: string): Promise<ArticleRow | null> {
  return env.DB.prepare("SELECT * FROM articles WHERE slug = ?").bind(slug).first<ArticleRow>();
}

export async function getById(env: Env, id: number): Promise<ArticleRow | null> {
  return env.DB.prepare("SELECT * FROM articles WHERE id = ?").bind(id).first<ArticleRow>();
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MEDIA?: R2Bucket;
  AI?: Ai;
  LIVE: DurableObjectNamespace;

  SITE_URL: string;
  SITE_NAME: string;
  /** auto: kalite kapısını geçen haber direkt yayınlanır. review: hepsi onay kuyruğuna düşer. */
  PUBLISH_MODE: "auto" | "review";
  ARTICLES_PER_RUN: string;
  DAILY_LIMIT: string;
  MIN_QUALITY_SCORE: string;
  MAX_REVISIONS: string;
  WRITER_MODEL: string;
  EDITOR_MODEL: string;
  IMAGE_GENERATION: "on" | "off";
  /** on: Claude yerine sahte yazar kullanılır (yerel geliştirme / test için). */
  AI_MOCK: "on" | "off";

  ANTHROPIC_API_KEY?: string;
  ADMIN_PASSWORD?: string;
  COINGECKO_API_KEY?: string;
}

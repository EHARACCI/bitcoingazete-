import type { Env } from "../env";

/**
 * Workers AI ile kapak görseli üretip R2'ye kaydeder. Bağlamalar yoksa veya kapalıysa sessizce atlar;
 * site bu durumda kategoriye özel tasarım kapağı gösterir.
 */
export async function generateCover(env: Env, slug: string, prompt: string): Promise<string | null> {
  if (env.IMAGE_GENERATION !== "on" || !env.AI || !env.MEDIA || env.AI_MOCK === "on" || !prompt) return null;
  const fullPrompt =
    `${prompt}. Editorial news illustration, 16:9 composition, clean modern style, high detail, ` +
    `no text, no letters, no logos, no watermarks, no human faces.`;
  const out = (await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt: fullPrompt, steps: 8 })) as { image?: string };
  if (!out.image) return null;
  const bytes = Uint8Array.from(atob(out.image), (c) => c.charCodeAt(0));
  const key = `covers/${new Date().toISOString().slice(0, 7)}/${slug}.jpg`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" } });
  return key;
}

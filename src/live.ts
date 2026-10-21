import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";

interface Visitor {
  vid: string;
  at: number;
}

/** Ping gelmeyen bağlantı bu süreden sonra sayılmaz (sekme kapandı, ağ koptu vb.) */
const STALE_MS = 75_000;
/** Ziyaretçi varken sayının yeniden yayınlanma aralığı */
const REFRESH_MS = 30_000;

/**
 * Sitedeki anlık ziyaretçi sayısı. Her açık sayfa bir WebSocket bağlantısı tutar;
 * aynı tarayıcıdaki birden fazla sekme tek kişi sayılır. Hibernation API sayesinde
 * bağlantılar boştayken nesne uyur ve ücretlendirilmez; "ping" yanıtları nesneyi uyandırmaz.
 */
export class LiveCounter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return Response.json({ online: this.count() });
    }
    const vid = (new URL(req.url).searchParams.get("v") ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 40) || crypto.randomUUID();
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ vid, at: Date.now() } satisfies Visitor);
    server.send(JSON.stringify({ online: this.count() }));
    await this.schedule(1500);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Benzersiz ziyaretçi sayısı; uzun süredir ping göndermeyen bağlantıları kapatır. */
  count(): number {
    const now = Date.now();
    const ids = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const v = ws.deserializeAttachment() as Visitor | null;
      const last = Math.max(this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0, v?.at ?? 0);
      if (now - last > STALE_MS) {
        try {
          ws.close(1001, "timeout");
        } catch {}
        continue;
      }
      ids.add(v?.vid ?? "");
    }
    return ids.size;
  }

  private async schedule(delay: number) {
    const current = await this.ctx.storage.getAlarm();
    if (current == null || current > Date.now() + delay) await this.ctx.storage.setAlarm(Date.now() + delay);
  }

  async alarm() {
    const sockets = this.ctx.getWebSockets();
    if (sockets.length === 0) return;
    const msg = JSON.stringify({ online: this.count() });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {}
    }
    await this.ctx.storage.setAlarm(Date.now() + REFRESH_MS);
  }

  async webSocketMessage() {}

  async webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code, "bye");
    } catch {}
    await this.schedule(2000);
  }

  async webSocketError() {
    await this.schedule(2000);
  }
}

/** Tüm site için tek sayaç */
export function liveStub(env: Env) {
  return env.LIVE.get(env.LIVE.idFromName("site"));
}

export async function onlineCount(env: Env): Promise<number | null> {
  try {
    const res = await liveStub(env).fetch("https://live/count");
    return ((await res.json()) as { online: number }).online;
  } catch {
    return null;
  }
}

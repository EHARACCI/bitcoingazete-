import type { Env } from "../env";
import { COIN_KEYWORDS, TICKER_COINS } from "../config";

export interface CoinQuote {
  id: string;
  symbol: string;
  usd: number;
  try: number;
  change24h: number;
  marketCapUsd?: number;
}

export interface FearGreed {
  value: number;
  label: string;
}

const FNG_LABELS: Record<string, string> = {
  "Extreme Fear": "Aşırı Korku",
  Fear: "Korku",
  Neutral: "Nötr",
  Greed: "Açgözlülük",
  "Extreme Greed": "Aşırı Açgözlülük",
};

export async function getQuotes(env: Env, ids: string[]): Promise<CoinQuote[]> {
  if (ids.length === 0) return [];
  const url =
    "https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd,try&include_24hr_change=true&include_market_cap=true&ids=" +
    encodeURIComponent(ids.join(","));
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        ...(env.COINGECKO_API_KEY ? { "x-cg-demo-api-key": env.COINGECKO_API_KEY } : {}),
      },
      cf: { cacheTtl: 120, cacheEverything: true },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, Record<string, number>>;
    return ids
      .filter((id) => data[id]?.usd != null)
      .map((id) => ({
        id,
        symbol: TICKER_COINS[id] ?? COIN_KEYWORDS[id]?.[COIN_KEYWORDS[id].length - 1]?.toUpperCase() ?? id.toUpperCase(),
        usd: data[id].usd,
        try: data[id].try,
        change24h: data[id].usd_24h_change ?? 0,
        marketCapUsd: data[id].usd_market_cap,
      }));
  } catch {
    return [];
  }
}

export async function getTicker(env: Env): Promise<CoinQuote[]> {
  return getQuotes(env, Object.keys(TICKER_COINS));
}

export async function getFearGreed(): Promise<FearGreed | null> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", { cf: { cacheTtl: 1800, cacheEverything: true } });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { value: string; value_classification: string }[] };
    const d = data.data?.[0];
    if (!d) return null;
    return { value: Number(d.value), label: FNG_LABELS[d.value_classification] ?? d.value_classification };
  } catch {
    return null;
  }
}

/** Haber metninde adı geçen coinleri bulur (her zaman BTC dahil) */
export function detectCoins(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found = new Set<string>(["bitcoin"]);
  for (const [id, keys] of Object.entries(COIN_KEYWORDS)) {
    if (keys.some((k) => new RegExp(`[^a-z0-9]${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z0-9]`).test(lower))) found.add(id);
  }
  return [...found].slice(0, 8);
}

const nf = (digits: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function fmtPrice(n: number): string {
  if (n >= 1000) return nf(0).format(n);
  if (n >= 1) return nf(2).format(n);
  return nf(6).format(n);
}

export function fmtPct(n: number): string {
  return `%${nf(2).format(Math.abs(n))}`;
}

export function fmtBigUsd(n: number): string {
  if (n >= 1e12) return `${nf(2).format(n / 1e12)} trilyon dolar`;
  if (n >= 1e9) return `${nf(1).format(n / 1e9)} milyar dolar`;
  if (n >= 1e6) return `${nf(1).format(n / 1e6)} milyon dolar`;
  return `${nf(0).format(n)} dolar`;
}

/** Yazar modele verilecek güncel piyasa verisi (modelin sayı uydurmasını engellemek için tek doğru kaynak) */
export function quotesToContext(quotes: CoinQuote[], fng: FearGreed | null): string {
  if (quotes.length === 0) return "Güncel piyasa verisi alınamadı. Metinde güncel fiyat belirtme.";
  const lines = quotes.map(
    (q) =>
      `- ${q.symbol}: ${fmtPrice(q.usd)} dolar (${fmtPrice(q.try)} TL), 24 saatlik değişim ${q.change24h >= 0 ? "+" : "-"}${fmtPct(q.change24h)}` +
      (q.marketCapUsd ? `, piyasa değeri ${fmtBigUsd(q.marketCapUsd)}` : ""),
  );
  if (fng) lines.push(`- Kripto Korku ve Açgözlülük Endeksi: ${fng.value} (${fng.label})`);
  return lines.join("\n");
}

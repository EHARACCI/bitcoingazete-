export interface Category {
  slug: string;
  name: string;
  description: string;
}

export const CATEGORIES: Category[] = [
  { slug: "bitcoin", name: "Bitcoin", description: "Bitcoin ağı, madencilik, ETF'ler ve kurumsal benimseme" },
  { slug: "altcoin", name: "Altcoin", description: "Ethereum, Solana, XRP ve diğer kripto paralar" },
  { slug: "piyasa", name: "Piyasa", description: "Fiyat hareketleri, zincir üstü veriler ve piyasa analizleri" },
  { slug: "regulasyon", name: "Regülasyon", description: "Düzenlemeler, SPK, SEC ve dünya genelinde yasal gelişmeler" },
  { slug: "teknoloji", name: "Teknoloji", description: "Blokzincir teknolojisi, güncellemeler, DeFi ve Web3" },
  { slug: "turkiye", name: "Türkiye", description: "Türkiye'deki kripto para gelişmeleri" },
  { slug: "dunya", name: "Dünya", description: "Makroekonomi, şirketler ve küresel gelişmeler" },
];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

export function categoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

/** Ana sayfa şeridinde gösterilen coinler (CoinGecko id → sembol) */
export const TICKER_COINS: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  ripple: "XRP",
  binancecoin: "BNB",
  dogecoin: "DOGE",
  cardano: "ADA",
  "avalanche-2": "AVAX",
};

/** Haber metninde geçerse piyasa verisi çekilecek coinler */
export const COIN_KEYWORDS: Record<string, string[]> = {
  bitcoin: ["bitcoin", "btc"],
  ethereum: ["ethereum", "ether", "eth"],
  solana: ["solana", "sol"],
  ripple: ["xrp", "ripple"],
  binancecoin: ["bnb", "binance coin"],
  dogecoin: ["dogecoin", "doge"],
  cardano: ["cardano", "ada"],
  "avalanche-2": ["avalanche", "avax"],
  tron: ["tron", "trx"],
  chainlink: ["chainlink", "link"],
  "the-open-network": ["toncoin", "ton"],
  litecoin: ["litecoin", "ltc"],
  polkadot: ["polkadot", "dot"],
  "shiba-inu": ["shiba", "shib"],
  sui: ["sui"],
  tether: ["tether", "usdt"],
  "usd-coin": ["usdc", "circle"],
};

/** Haber seçiminde önem puanını artıran anahtar kelimeler */
export const BOOST_KEYWORDS = [
  "bitcoin", "btc", "etf", "sec", "fed", "faiz", "rate", "halving", "blackrock", "fidelity",
  "regulation", "regülasyon", "spk", "türkiye", "turkey", "turkish", "binance", "coinbase",
  "ethereum", "stablecoin", "hack", "exploit", "all-time high", "ath", "rekor", "record",
  "trump", "senate", "congress", "mica", "cbdc", "tether", "microstrategy", "strategy", "saylor",
];

/** Bu kalıplar varsa haber önceliği düşer (reklam, tahmin, tanıtım içerikleri) */
export const LOW_VALUE_PATTERNS = [
  /price prediction/i, /sponsored/i, /press release/i, /\bpromo/i, /how to buy/i, /\bbest\b.+\b(to buy|wallets?|exchanges?)\b/i,
  /presale/i, /airdrop guide/i, /\bgiveaway\b/i, /\bpodcast\b/i, /\bwebinar\b/i, /\bnewsletter\b/i,
  /could (soar|explode|skyrocket)/i, /\d+x\b.*\bgains?\b/i, /fiyat tahmini/i, /reklam/i,
];

import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { CATEGORIES } from "../config";
import { fmtPct, fmtPrice, type CoinQuote } from "../lib/market";
import { formatDateTR } from "../lib/text";

export type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

export interface LayoutOpts {
  siteName: string;
  siteUrl: string;
  title: string;
  description: string;
  path: string;
  ticker?: CoinQuote[];
  activeCategory?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  jsonLd?: object[];
  noindex?: boolean;
  head?: Html;
  body: Html;
}

export const CSS_VERSION = "2";

/** Anlık ziyaretçi sayısını WebSocket ile alır; bağlantı koparsa artan aralıklarla yeniden dener. */
const LIVE_SCRIPT = `(function(){var el=document.getElementById("live");if(!el||!("WebSocket" in window))return;
var v;try{v=localStorage.getItem("vid");if(!v){v=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem("vid",v)}}catch(e){v=Math.random().toString(36).slice(2)}
var delay=1000,ping;function connect(){var ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host+"/api/canli?v="+v);
ws.onopen=function(){delay=1000;ping=setInterval(function(){try{ws.send("ping")}catch(e){}},30000)};
ws.onmessage=function(e){try{var n=JSON.parse(e.data).online;if(n>0){el.querySelector("b").textContent=n.toLocaleString("tr-TR");el.hidden=false}}catch(_){}};
ws.onclose=function(){clearInterval(ping);setTimeout(connect,delay);delay=Math.min(delay*2,60000)}}connect()})();`;

const icons = {
  search: raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`),
  theme: raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`),
  rss: raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>`),
};

export function tickerHtml(quotes: CoinQuote[]) {
  if (!quotes.length) return html``;
  const items = quotes.map(
    (q) =>
      html`<span class="tk"><b>${q.symbol}</b> $${fmtPrice(q.usd)} <span class="${q.change24h >= 0 ? "up" : "down"}">${q.change24h >= 0 ? "▲" : "▼"} ${fmtPct(q.change24h)}</span></span>`,
  );
  // Sonsuz kayma için liste iki kez basılır
  return html`<div class="ticker" aria-label="Kripto para fiyatları"><div class="ticker-track">${items}${items}</div></div>`;
}

export function layout(o: LayoutOpts) {
  const url = o.siteUrl + o.path;
  const title = o.path === "/" ? o.title : `${o.title} | ${o.siteName}`;
  const og = o.ogImage ?? `${o.siteUrl}/og-default.png`;
  const today = formatDateTR(new Date().toISOString(), false);

  return html`<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${o.description}">
<link rel="canonical" href="${url}">
${o.noindex ? html`<meta name="robots" content="noindex,nofollow">` : html`<meta name="robots" content="index,follow,max-image-preview:large">`}
<meta property="og:site_name" content="${o.siteName}">
<meta property="og:locale" content="tr_TR">
<meta property="og:type" content="${o.ogType ?? "website"}">
<meta property="og:title" content="${o.title}">
<meta property="og:description" content="${o.description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0d1321">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${o.siteName}" href="${o.siteUrl}/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/site.css?v=${CSS_VERSION}">
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
${(o.jsonLd ?? []).map((j) => html`<script type="application/ld+json">${raw(JSON.stringify(j).replace(/</g, "\\u003c"))}</script>`)}
${o.head ?? ""}
</head>
<body>
<a class="sr-only" href="#icerik">İçeriğe geç</a>
<div class="topbar"><div class="wrap"><time>${today}</time>${tickerHtml(o.ticker ?? [])}<span id="live" class="live-count" hidden><span class="live" aria-hidden="true"></span><b>0</b> kişi şu an sitede</span></div></div>
<header class="masthead">
  <div class="wrap brand-row">
    <a class="logo" href="/" aria-label="${o.siteName} ana sayfa">
      <span class="logo-mark" aria-hidden="true">₿</span>
      <span><span class="logo-text">Bitcoin <span>Gazete</span></span><span class="logo-sub">Kripto paranın gündemi</span></span>
    </a>
    <div class="tools">
      <button class="icon-btn" type="button" aria-label="Ara" onclick="document.getElementById('sf').classList.toggle('open');document.getElementById('q').focus()">${icons.search}</button>
      <button class="icon-btn" type="button" aria-label="Tema değiştir" onclick="(function(){var d=document.documentElement,c=d.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'),n=c==='dark'?'light':'dark';d.dataset.theme=n;try{localStorage.setItem('theme',n)}catch(e){}})()">${icons.theme}</button>
      <a class="icon-btn" href="/rss.xml" aria-label="RSS">${icons.rss}</a>
    </div>
  </div>
  <div class="wrap search-wrap"><form id="sf" class="search-form" action="/ara" role="search"><label class="sr-only" for="q">Haberlerde ara</label><input id="q" name="q" type="search" placeholder="Haberlerde ara…"></form></div>
  <nav class="nav" aria-label="Kategoriler"><div class="wrap"><ul>
    <li><a href="/" ${o.path === "/" ? raw('aria-current="page"') : ""}>Son Haberler</a></li>
    ${CATEGORIES.map((c) => html`<li><a href="/kategori/${c.slug}" ${o.activeCategory === c.slug ? raw('aria-current="page"') : ""}>${c.name}</a></li>`)}
  </ul></div></nav>
</header>
<main id="icerik"><div class="wrap">${o.body}</div></main>
<footer class="footer">
  <div class="wrap">
    <div class="cols">
      <div>
        <div class="logo-text">Bitcoin <span style="color:var(--accent)">Gazete</span></div>
        <p style="max-width:420px">Bitcoin ve kripto para dünyasındaki gelişmeleri Türkçe, tarafsız ve doğrulanmış biçimde aktaran dijital haber platformu. Haberlerimiz yapay zeka desteğiyle hazırlanır ve çok aşamalı editoryal kalite kontrolünden geçer.</p>
      </div>
      <div><h4>Kategoriler</h4><ul>${CATEGORIES.map((c) => html`<li><a href="/kategori/${c.slug}">${c.name}</a></li>`)}</ul></div>
      <div><h4>Kurumsal</h4><ul>
        <li><a href="/hakkimizda">Hakkımızda</a></li>
        <li><a href="/yayin-ilkeleri">Yayın İlkeleri</a></li>
        <li><a href="/gizlilik">Gizlilik Politikası</a></li>
        <li><a href="/iletisim">İletişim</a></li>
        <li><a href="/rss.xml">RSS</a></li>
      </ul></div>
    </div>
    <div class="legal"><span>© ${new Date().getFullYear()} ${o.siteName}. Tüm hakları saklıdır.</span><span>Sitedeki içerikler yatırım tavsiyesi değildir.</span></div>
  </div>
</footer>
<script>${raw(LIVE_SCRIPT)}</script>
</body>
</html>`;
}

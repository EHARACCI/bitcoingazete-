import { html, raw } from "hono/html";
import { CATEGORIES, categoryName } from "../config";
import type { ArticleCard, ArticleRow } from "../lib/db";
import { fmtPct, fmtPrice, type CoinQuote, type FearGreed } from "../lib/market";
import { formatDateTR, readingMinutes, toIso } from "../lib/text";

const CAT_GLYPH: Record<string, string> = {
  bitcoin: "₿", altcoin: "◆", piyasa: "↗", regulasyon: "§", teknoloji: "⬡", turkiye: "TR", dunya: "◍",
};

export function imageUrl(key: string | null): string | null {
  return key ? (key.startsWith("http") ? key : `/media/${key}`) : null;
}

export function cover(a: Pick<ArticleCard, "image_key" | "image_alt" | "category" | "title">, eager = false) {
  const src = imageUrl(a.image_key);
  return html`<div class="cover cat-${a.category}">${
    src
      ? html`<img src="${src}" alt="${a.image_alt || a.title}" ${eager ? raw('fetchpriority="high"') : raw('loading="lazy"')} width="1280" height="720">`
      : html`<div class="cover-fallback" aria-hidden="true">${CAT_GLYPH[a.category] ?? "₿"}</div>`
  }</div>`;
}

function timeHM(sql: string | null) {
  return formatDateTR(sql).split(", ")[1] ?? "";
}

export function card(a: ArticleCard) {
  return html`<a class="card" href="/haber/${a.slug}">
    ${cover(a)}
    <span class="kicker">${categoryName(a.category)}</span>
    <h3>${a.title}</h3>
    <p>${a.summary}</p>
    <span class="meta"><time datetime="${toIso(a.published_at)}">${formatDateTR(a.published_at)}</time></span>
  </a>`;
}

export function marketPanel(quotes: CoinQuote[], fng: FearGreed | null) {
  if (!quotes.length) return html``;
  return html`<section class="market" aria-label="Piyasa özeti">
    ${quotes.slice(0, 4).map(
      (q) => html`<div class="coin">
        <div class="sym">${q.symbol}</div>
        <div class="px">$${fmtPrice(q.usd)}</div>
        <div class="try">₺${fmtPrice(q.try)}</div>
        <div class="chg ${q.change24h >= 0 ? "up" : "down"}">${q.change24h >= 0 ? "▲" : "▼"} ${fmtPct(q.change24h)} <small>24s</small></div>
      </div>`,
    )}
    ${
      fng
        ? html`<div class="fng"><div class="gauge" style="--v:${fng.value}" aria-hidden="true"></div><div><small>Korku & Açgözlülük Endeksi</small><div class="fng-val">${fng.value}</div><small>${fng.label}</small></div></div>`
        : html`<div class="fng"><div><small>Piyasa verileri</small><div class="fng-val">CoinGecko</div></div></div>`
    }
  </section>`;
}

export function homePage(items: ArticleCard[], byCat: Record<string, ArticleCard[]>, quotes: CoinQuote[], fng: FearGreed | null) {
  if (items.length === 0) {
    return html`<div class="empty"><h1>Yakında burada</h1><p>İlk haberler hazırlanıyor. Kısa süre sonra tekrar ziyaret edin.</p></div>${marketPanel(quotes, fng)}`;
  }
  const [lead, ...rest] = items;
  const breaking = rest.slice(0, 7);
  const featured = rest.slice(7, 13);
  const featuredIds = new Set(featured.map((a) => a.id));
  const rows = CATEGORIES.map((c) => ({ c, items: (byCat[c.slug] ?? []).filter((a) => !featuredIds.has(a.id)) })).filter((r) => r.items.length > 0);
  return html`
  <section class="hero">
    <article class="lead">
      <a href="/haber/${lead.slug}">${cover(lead, true)}</a>
      <div style="margin-top:16px"><span class="kicker">${categoryName(lead.category)}</span></div>
      <h1><a href="/haber/${lead.slug}">${lead.title}</a></h1>
      <p>${lead.summary}</p>
      <span class="meta"><time datetime="${toIso(lead.published_at)}">${formatDateTR(lead.published_at)}</time><span class="dot">${readingMinutes(lead.word_count)} dk okuma</span></span>
    </article>
    <aside class="side-list" aria-label="Son dakika">
      <h2><span class="live" aria-hidden="true"></span>Son Dakika</h2>
      <ol>${breaking.map((a) => html`<li><time datetime="${toIso(a.published_at)}">${timeHM(a.published_at)}</time><a href="/haber/${a.slug}">${a.title}</a></li>`)}</ol>
    </aside>
  </section>
  ${marketPanel(quotes, fng)}
  ${featured.length >= 3 ? html`<div class="section-head"><h2>Öne Çıkanlar</h2></div><div class="grid grid-3">${featured.slice(0, featured.length >= 6 ? 6 : 3).map(card)}</div>` : ""}
  ${rows.map(
    ({ c, items }) => html`<div class="section-head"><h2>${c.name}</h2><a href="/kategori/${c.slug}">Tümü →</a></div>
    <div class="grid grid-4">${items.map(card)}</div>`,
  )}`;
}

export function listPage(opts: { kicker: string; title: string; description?: string; items: ArticleCard[]; page: number; basePath: string; perPage: number; query?: string }) {
  const sep = opts.basePath.includes("?") ? "&" : "?";
  return html`
  <header class="page-head"><span class="kicker">${opts.kicker}</span><h1>${opts.title}</h1>${opts.description ? html`<p>${opts.description}</p>` : ""}</header>
  ${
    opts.items.length === 0
      ? html`<div class="empty">Bu sayfada henüz haber yok.</div>`
      : opts.items.map(
          (a) => html`<article class="list-item">
          <a href="/haber/${a.slug}">${cover(a)}</a>
          <div><span class="kicker">${categoryName(a.category)}</span>
            <h2><a href="/haber/${a.slug}">${a.title}</a></h2>
            <p>${a.summary}</p>
            <span class="meta"><time datetime="${toIso(a.published_at)}">${formatDateTR(a.published_at)}</time><span class="dot">${readingMinutes(a.word_count)} dk okuma</span></span>
          </div></article>`,
        )
  }
  <nav class="pager" aria-label="Sayfalama">
    <span>${opts.page > 1 ? html`<a class="btn" href="${opts.basePath}${opts.page > 2 ? `${sep}sayfa=${opts.page - 1}` : ""}">← Yeni haberler</a>` : ""}</span>
    <span>${opts.items.length === opts.perPage ? html`<a class="btn" href="${opts.basePath}${sep}sayfa=${opts.page + 1}">Eski haberler →</a>` : ""}</span>
  </nav>`;
}

export function articlePage(a: ArticleRow, rel: ArticleCard[], pop: ArticleCard[], quotes: CoinQuote[], siteUrl: string) {
  const tags = JSON.parse(a.tags || "[]") as string[];
  const sources = JSON.parse(a.sources || "[]") as { name: string; url: string }[];
  const url = `${siteUrl}/haber/${a.slug}`;
  const enc = encodeURIComponent;
  const updated = a.updated_at && a.published_at && a.updated_at > a.published_at ? a.updated_at : null;
  const src = imageUrl(a.image_key);

  return html`
  <div class="article-layout">
    <article class="article">
      <nav class="crumbs" aria-label="Konum"><a href="/">Ana Sayfa</a> › <a href="/kategori/${a.category}">${categoryName(a.category)}</a></nav>
      <a class="kicker" href="/kategori/${a.category}">${categoryName(a.category)}</a>
      <h1>${a.title}</h1>
      <p class="lede">${a.summary}</p>
      <div class="byline">
        <span class="avatar" aria-hidden="true">BG</span>
        <div><strong>Bitcoin Gazete Haber Merkezi</strong>
          <span class="meta"><time datetime="${toIso(a.published_at)}">${formatDateTR(a.published_at)}</time>${updated ? html`<span class="dot">Güncellendi: ${formatDateTR(updated)}</span>` : ""}<span class="dot">${readingMinutes(a.word_count)} dk okuma</span></span>
        </div>
      </div>
      ${src ? html`<figure>${cover(a, true)}${a.image_alt ? html`<figcaption>${a.image_alt}${a.ai_generated ? " (Görsel yapay zeka ile üretilmiştir.)" : ""}</figcaption>` : ""}</figure>` : ""}
      <div class="prose">${raw(a.body_html)}</div>

      ${
        a.ai_generated
          ? html`<aside class="note note-ai"><h4>Bu haber nasıl hazırlandı?</h4>Bu içerik, aşağıda listelenen kaynaklardan derlenerek yapay zeka desteğiyle yazılmış; ardından doğruluk, özgünlük, dil ve tarafsızlık açısından otomatik ve editoryal kalite kontrolünden geçirilmiştir. Hata bildirmek için <a href="/iletisim" style="text-decoration:underline">bize ulaşın</a>. <a href="/yayin-ilkeleri" style="text-decoration:underline">Yayın ilkelerimiz</a></aside>`
          : ""
      }
      ${
        sources.length
          ? html`<aside class="note note-sources"><h4>Kaynaklar</h4><ul>${sources.map((s) => html`<li><a href="${s.url}" rel="nofollow noopener" target="_blank">${s.name}</a></li>`)}</ul></aside>`
          : ""
      }
      ${tags.length ? html`<div class="tags">${tags.map((t) => html`<a class="tag" href="/etiket/${enc(t)}">${t}</a>`)}</div>` : ""}
      <div class="share"><span>Paylaş:</span>
        <a href="https://x.com/intent/post?url=${enc(url)}&text=${enc(a.title)}" target="_blank" rel="noopener">X</a>
        <a href="https://t.me/share/url?url=${enc(url)}&text=${enc(a.title)}" target="_blank" rel="noopener">Telegram</a>
        <a href="https://wa.me/?text=${enc(a.title + " " + url)}" target="_blank" rel="noopener">WhatsApp</a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}" target="_blank" rel="noopener">LinkedIn</a>
        <button type="button" onclick="navigator.clipboard.writeText('${url}').then(()=>{this.textContent='Kopyalandı'})">Bağlantıyı kopyala</button>
      </div>
      <p class="disclaimer"><strong>Yasal uyarı:</strong> Bitcoin Gazete'de yer alan haber, yorum ve veriler yalnızca bilgilendirme amaçlıdır ve yatırım tavsiyesi niteliği taşımaz. Kripto paralar yüksek risk içerir; yatırım kararlarınızı kendi araştırmanıza ve yetkili kurumların danışmanlığına dayanarak veriniz.</p>
      ${rel.length ? html`<div class="section-head"><h2>İlgili Haberler</h2></div><div class="grid grid-3">${rel.map(card)}</div>` : ""}
    </article>
    <aside>
      <div class="sticky">
        ${
          quotes.length
            ? html`<div class="aside-box"><h3>Piyasa</h3>${quotes.slice(0, 6).map(
                (q) => html`<div class="mini-coin"><b>${q.symbol}</b><span>$${fmtPrice(q.usd)} <span class="chg ${q.change24h >= 0 ? "up" : "down"}">${q.change24h >= 0 ? "+" : "−"}${fmtPct(q.change24h)}</span></span></div>`,
              )}</div>`
            : ""
        }
        ${pop.length ? html`<div class="aside-box"><h3>Çok Okunanlar</h3><ol>${pop.map((p) => html`<li><a href="/haber/${p.slug}">${p.title}</a></li>`)}</ol></div>` : ""}
      </div>
    </aside>
  </div>
  <script>try{navigator.sendBeacon("/api/goruntulenme/${a.id}")}catch(e){}</script>`;
}

export function articleJsonLd(a: ArticleRow, siteUrl: string, siteName: string) {
  const url = `${siteUrl}/haber/${a.slug}`;
  const img = imageUrl(a.image_key);
  return [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: a.title,
      description: a.meta_description || a.summary,
      mainEntityOfPage: url,
      url,
      datePublished: toIso(a.published_at),
      dateModified: toIso(a.updated_at),
      articleSection: categoryName(a.category),
      keywords: (JSON.parse(a.tags || "[]") as string[]).join(", "),
      inLanguage: "tr-TR",
      image: [img ? (img.startsWith("http") ? img : siteUrl + img) : `${siteUrl}/og-default.png`],
      author: { "@type": "Organization", name: `${siteName} Haber Merkezi`, url: `${siteUrl}/hakkimizda` },
      publisher: { "@type": "NewsMediaOrganization", name: siteName, url: siteUrl, logo: { "@type": "ImageObject", url: `${siteUrl}/logo.png` } },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: siteUrl },
        { "@type": "ListItem", position: 2, name: categoryName(a.category), item: `${siteUrl}/kategori/${a.category}` },
        { "@type": "ListItem", position: 3, name: a.title, item: url },
      ],
    },
  ];
}

export const STATIC_PAGES: Record<string, { title: string; description: string; body: string }> = {
  hakkimizda: {
    title: "Hakkımızda",
    description: "Bitcoin Gazete, kripto para dünyasındaki gelişmeleri Türkçe, tarafsız ve doğrulanmış biçimde aktaran dijital haber platformudur.",
    body: `
<p>Bitcoin Gazete, Bitcoin ve kripto para ekosistemindeki gelişmeleri Türk okurlara hızlı, doğru ve anlaşılır biçimde ulaştırmak amacıyla yayın yapan bağımsız bir dijital haber platformudur.</p>
<h2>Nasıl çalışıyoruz?</h2>
<p>Haber merkezimiz, dünyanın önde gelen kripto para yayın kuruluşlarını, resmi kurum açıklamalarını ve piyasa veri sağlayıcılarını sürekli izler. Gündemdeki gelişmeler, yapay zeka destekli yazım sistemimizle Türkçe olarak yeniden yazılır ve yayından önce çok aşamalı kalite kontrolünden geçer:</p>
<ul>
<li><strong>Kaynak doğrulama:</strong> Her haber en az bir güvenilir kaynağa dayanır ve kaynaklar haberin altında açıkça listelenir.</li>
<li><strong>Otomatik kontroller:</strong> Rakamların kaynaklarla uyumu, özgünlük, dil ve yapı kuralları otomatik olarak denetlenir.</li>
<li><strong>Editoryal değerlendirme:</strong> Her taslak; doğruluk, tarafsızlık, özgünlük ve dil açısından ayrı bir editör sistemi tarafından puanlanır. Eşiği geçemeyen haberler yayınlanmaz.</li>
</ul>
<p>Ayrıntılar için <a href="/yayin-ilkeleri">Yayın İlkelerimizi</a> inceleyebilirsiniz.</p>`,
  },
  "yayin-ilkeleri": {
    title: "Yayın İlkeleri",
    description: "Bitcoin Gazete'nin doğruluk, tarafsızlık, kaynak gösterme ve yapay zeka kullanımına ilişkin yayın ilkeleri.",
    body: `
<p>Bitcoin Gazete olarak okurlarımızın güvenini en değerli varlığımız olarak görüyoruz. Tüm içeriklerimiz aşağıdaki ilkelere göre hazırlanır.</p>
<h2>Doğruluk</h2>
<p>Haberlerimizde yalnızca güvenilir kaynaklarda yer alan bilgiler kullanılır. Rakamlar, isimler, tarihler ve alıntılar kaynaklarla karşılaştırılarak doğrulanır. Fiyat verileri, haberin yazıldığı andaki piyasa verilerinden alınır.</p>
<h2>Kaynak gösterme</h2>
<p>Her haberin altında yararlanılan kaynaklar bağlantılarıyla birlikte listelenir. Metin içinde de bilgilerin hangi kaynağa ait olduğu belirtilir.</p>
<h2>Yapay zeka kullanımı</h2>
<p>Haberlerimiz yapay zeka desteğiyle yazılır. Bu süreçte yapay zeka, kaynaklardaki bilgileri Türkçe olarak sentezler; bilgi uydurması, kaynakların birebir kopyalanması ve yönlendirici ifadeler kullanması sistemsel olarak engellenir. Her içerik yayından önce otomatik kontrollerden ve bağımsız bir editoryal değerlendirmeden geçer. Yapay zeka desteğiyle hazırlanan içerikler okura açıkça belirtilir.</p>
<h2>Tarafsızlık</h2>
<p>Bitcoin Gazete herhangi bir kripto para, borsa veya projeyi tanıtmaz, yatırım tavsiyesi vermez ve fiyat tahmini yapmaz. Üçüncü kişilerin tahminleri aktarılırken kime ait oldukları belirtilir.</p>
<h2>Düzeltme politikası</h2>
<p>Bir haberde hata tespit edildiğinde içerik en kısa sürede düzeltilir ve güncellenme tarihi haberde gösterilir. Hata bildirimleriniz için <a href="/iletisim">iletişim sayfamızı</a> kullanabilirsiniz.</p>`,
  },
  gizlilik: {
    title: "Gizlilik Politikası",
    description: "Bitcoin Gazete gizlilik politikası ve kişisel verilerin korunması hakkında bilgilendirme.",
    body: `
<p>Bitcoin Gazete, ziyaretçilerinin kişisel verilerinin korunmasına önem verir. Sitemizde üyelik sistemi bulunmamakta ve ziyaretçilerden kişisel veri toplanmamaktadır.</p>
<h2>Çerezler</h2>
<p>Sitemiz yalnızca tema tercihiniz (açık/koyu) gibi işlevsel bilgileri tarayıcınızın yerel depolamasında saklar. Reklam veya takip amaçlı çerez kullanılmaz.</p>
<h2>Sunucu kayıtları</h2>
<p>Altyapı sağlayıcımız Cloudflare, güvenlik ve performans amacıyla anonim teknik kayıtlar tutabilir.</p>
<h2>İletişim</h2>
<p>6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamındaki talepleriniz için <a href="/iletisim">iletişim sayfamızdan</a> bize ulaşabilirsiniz.</p>`,
  },
  iletisim: {
    title: "İletişim",
    description: "Bitcoin Gazete ile iletişime geçin: haber ihbarı, düzeltme talebi ve iş birlikleri.",
    body: `
<p>Haber ihbarları, düzeltme talepleri ve iş birliği önerileriniz için bize e-posta ile ulaşabilirsiniz:</p>
<p><strong>E-posta:</strong> <a href="mailto:iletisim@bitcoingazete.com">iletisim@bitcoingazete.com</a></p>
<p>Düzeltme taleplerinizde ilgili haberin bağlantısını ve hatalı olduğunu düşündüğünüz bilgiyi belirtmeniz süreci hızlandıracaktır.</p>`,
  },
};

export function staticPage(p: { title: string; body: string }) {
  return html`<article class="article" style="max-width:760px">
    <span class="kicker">Kurumsal</span><h1>${p.title}</h1><div class="prose">${raw(p.body)}</div></article>`;
}

export function notFoundPage() {
  return html`<div class="empty"><span class="kicker">404</span><h1 style="font-family:var(--serif)">Sayfa bulunamadı</h1>
    <p>Aradığınız haber kaldırılmış veya adresi değişmiş olabilir.</p><p><a class="btn btn-primary" href="/">Ana sayfaya dön</a></p></div>`;
}

export const CSS = /* css */ `
:root{
  --bg:#f8f6f1;--surface:#fff;--surface-2:#f1ede4;--ink:#15171c;--ink-2:#2b2f37;--muted:#5f6672;--line:#e4dfd4;
  --accent:#f7931a;--accent-ink:#a95700;--accent-soft:#fff1de;--navy:#0d1321;--navy-2:#18213a;
  --up:#0b8a4a;--down:#cc2b2b;--radius:14px;--shadow:0 1px 2px rgba(20,22,28,.05),0 8px 24px -12px rgba(20,22,28,.18);
  --serif:"Fraunces",Georgia,"Times New Roman",serif;--sans:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  color-scheme:light;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0b0e13;--surface:#131820;--surface-2:#1a2029;--ink:#eaedf2;--ink-2:#cdd3dc;--muted:#97a1af;--line:#242b36;
  --accent-ink:#ffb14e;--accent-soft:#2a1d0c;--navy:#070a10;--navy-2:#111827;--up:#33c37a;--down:#ff6b6b;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px -12px rgba(0,0,0,.6);color-scheme:dark;
}}
:root[data-theme="dark"]{
  --bg:#0b0e13;--surface:#131820;--surface-2:#1a2029;--ink:#eaedf2;--ink-2:#cdd3dc;--muted:#97a1af;--line:#242b36;
  --accent-ink:#ffb14e;--accent-soft:#2a1d0c;--navy:#070a10;--navy-2:#111827;--up:#33c37a;--down:#ff6b6b;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px -12px rgba(0,0,0,.6);color-scheme:dark;
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 var(--sans);-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit;text-decoration:none}
a:hover{color:var(--accent-ink)}
img{max-width:100%;display:block}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.wrap{max-width:1200px;margin:0 auto;padding:0 16px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

/* Üst şerit + fiyat bandı */
.topbar{background:var(--navy);color:#cfd6e3;font-size:13px}
.topbar .wrap{display:flex;align-items:center;gap:16px;height:38px}
.topbar time{white-space:nowrap;color:#9aa6bb}
.ticker{flex:1;overflow:hidden;mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)}
.ticker-track{display:inline-flex;gap:28px;white-space:nowrap;animation:tick 45s linear infinite;padding-left:8px}
.ticker:hover .ticker-track{animation-play-state:paused}
.tk{display:inline-flex;gap:6px;align-items:baseline;font-variant-numeric:tabular-nums}
.tk b{color:#fff;font-weight:600}
.tk .up{color:#4fd18b}.tk .down{color:#ff7a7a}
.live-count{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;font-variant-numeric:tabular-nums;color:#cfd6e3}
.live-count[hidden]{display:none}
.live-count b{color:#fff;font-weight:700}
@media (max-width:600px){.topbar time{display:none}}
@keyframes tick{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.ticker-track{animation:none}}

/* Başlık */
.masthead{background:var(--surface);border-bottom:1px solid var(--line)}
.masthead .brand-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:18px;padding-bottom:14px}
.logo{display:flex;align-items:center;gap:12px}
.logo-mark{width:42px;height:42px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font:700 24px/1 var(--sans);transform:rotate(-12deg);box-shadow:inset 0 -3px 0 rgba(0,0,0,.15)}
.logo-text{font:700 30px/1 var(--serif);letter-spacing:-.02em}
.logo-text span{color:var(--accent-ink)}
@media (max-width:480px){.logo-text{font-size:23px;white-space:nowrap}.logo-mark{width:34px;height:34px;font-size:19px}.logo-sub{font-size:9.5px;letter-spacing:.1em;white-space:nowrap}.icon-btn{width:36px;height:36px}.tools{gap:6px}}
.logo-sub{display:block;font:500 11px/1.4 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:4px}
.tools{display:flex;gap:8px;align-items:center}
.icon-btn{width:40px;height:40px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink);display:grid;place-items:center;cursor:pointer}
.icon-btn:hover{border-color:var(--accent);color:var(--accent-ink)}
.icon-btn svg{width:18px;height:18px}
.nav{border-top:1px solid var(--line)}
.nav ul{list-style:none;margin:0;padding:0;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}
.nav ul::-webkit-scrollbar{display:none}
.nav a{display:block;padding:12px 14px;font-weight:600;font-size:14.5px;white-space:nowrap;border-bottom:3px solid transparent}
.nav a[aria-current="page"],.nav a:hover{border-bottom-color:var(--accent);color:var(--ink)}
.search-form{display:none;padding:0 0 14px}
.search-form.open{display:block}
.search-form input{width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:inherit}

/* Genel bileşenler */
main{padding:28px 0 56px}
.kicker{display:inline-block;font:700 11.5px/1 var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--accent-ink)}
.meta{color:var(--muted);font-size:13px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.meta .dot::before{content:"·";margin-right:10px}
.section-head{display:flex;align-items:baseline;justify-content:space-between;border-top:3px solid var(--ink);padding-top:10px;margin:44px 0 18px}
.section-head h2{font:700 22px/1.2 var(--serif);margin:0;letter-spacing:-.01em}
.section-head a{font-size:13.5px;font-weight:600;color:var(--accent-ink)}

.cover{position:relative;aspect-ratio:16/9;border-radius:var(--radius);overflow:hidden;background:var(--navy-2)}
.cover img{width:100%;height:100%;object-fit:cover}
.cover-fallback{position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,.92);font:700 clamp(40px,8vw,84px)/1 var(--serif)}
.cover-fallback::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 20%,rgba(255,255,255,.18),transparent 45%),repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 2px,transparent 2px 14px)}
.cat-bitcoin .cover-fallback{background:linear-gradient(135deg,#f7931a,#b65b00)}
.cat-altcoin .cover-fallback{background:linear-gradient(135deg,#6c5ce7,#2d1f8f)}
.cat-piyasa .cover-fallback{background:linear-gradient(135deg,#0f9d74,#09543f)}
.cat-regulasyon .cover-fallback{background:linear-gradient(135deg,#2f4a7a,#121d36)}
.cat-teknoloji .cover-fallback{background:linear-gradient(135deg,#0ea5c6,#0b4f72)}
.cat-turkiye .cover-fallback{background:linear-gradient(135deg,#e03131,#8a1111)}
.cat-dunya .cover-fallback{background:linear-gradient(135deg,#475569,#1e293b)}

.card{display:flex;flex-direction:column;gap:10px}
.card h3{font:650 19px/1.3 var(--serif);margin:0;letter-spacing:-.01em}
.card p{margin:0;color:var(--muted);font-size:14.5px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card:hover h3{color:var(--accent-ink)}
.grid{display:grid;gap:28px 24px}
.grid-4{grid-template-columns:repeat(4,1fr)}
.grid-3{grid-template-columns:repeat(3,1fr)}
@media (max-width:980px){.grid-4{grid-template-columns:repeat(2,1fr)}.grid-3{grid-template-columns:repeat(2,1fr)}}
@media (max-width:560px){.grid-4,.grid-3{grid-template-columns:1fr}}

/* Ana sayfa vitrin */
.hero{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,1fr);gap:32px}
.lead h1{font:700 clamp(28px,4vw,44px)/1.12 var(--serif);letter-spacing:-.02em;margin:14px 0 10px}
.lead p{font-size:17.5px;color:var(--ink-2);margin:0 0 12px}
.side-list{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px}
.side-list h2{display:flex;align-items:center;gap:8px;font:700 15px/1 var(--sans);letter-spacing:.06em;text-transform:uppercase;margin:0 0 6px}
.live{width:8px;height:8px;border-radius:50%;background:var(--down);box-shadow:0 0 0 0 rgba(204,43,43,.6);animation:pulse 2s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 8px rgba(204,43,43,0)}100%{box-shadow:0 0 0 0 rgba(204,43,43,0)}}
.side-list ol{list-style:none;margin:0;padding:0}
.side-list li{display:grid;grid-template-columns:48px 1fr;gap:10px;padding:12px 0;border-bottom:1px solid var(--line)}
.side-list li:last-child{border-bottom:0}
.side-list time{font:600 13px/1.5 var(--sans);color:var(--accent-ink);font-variant-numeric:tabular-nums}
.side-list a{font-weight:600;font-size:15px;line-height:1.4}
@media (max-width:900px){.hero{grid-template-columns:1fr}}

/* Piyasa paneli */
.market{display:grid;grid-template-columns:repeat(4,1fr) 1.2fr;gap:12px;margin-top:36px}
.coin,.fng{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;font-variant-numeric:tabular-nums}
.coin .sym{font-weight:700;font-size:13px;color:var(--muted);letter-spacing:.04em}
.coin .px{font:700 20px/1.3 var(--sans);margin:4px 0 2px}
.coin .try{font-size:12.5px;color:var(--muted)}
.chg{font-size:13px;font-weight:600}
.chg.up{color:var(--up)}.chg.down{color:var(--down)}
.fng{display:flex;align-items:center;gap:14px}
.gauge{--v:50;width:64px;height:64px;border-radius:50%;flex:none;background:conic-gradient(var(--accent) calc(var(--v) * 1%),var(--line) 0);display:grid;place-items:center;-webkit-mask:radial-gradient(circle 23px,transparent 98%,#000);mask:radial-gradient(circle 23px,transparent 98%,#000)}
.fng-val{font:800 26px/1 var(--sans)}
.fng small{display:block;color:var(--muted);font-size:12px}
@media (max-width:980px){.market{grid-template-columns:repeat(2,1fr)}.fng{grid-column:span 2}}

/* Haber sayfası */
.article-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:48px}
@media (max-width:980px){.article-layout{grid-template-columns:1fr}}
.crumbs{font-size:13px;color:var(--muted);margin-bottom:14px}
.crumbs a{color:var(--muted)}.crumbs a:hover{color:var(--accent-ink)}
.article h1{font:700 clamp(28px,4.2vw,46px)/1.12 var(--serif);letter-spacing:-.02em;margin:12px 0 14px}
.article .lede{font-size:clamp(18px,2vw,21px);line-height:1.55;color:var(--ink-2);margin:0 0 18px}
.byline{display:flex;align-items:center;gap:12px;padding:14px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:22px}
.byline .avatar{width:38px;height:38px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-weight:700}
.byline strong{display:block;font-size:14px}
figure{margin:0 0 26px}
figcaption{font-size:12.5px;color:var(--muted);margin-top:8px}
.prose{font-size:18px;line-height:1.78;color:var(--ink-2);max-width:720px}
.prose p{margin:0 0 1.15em}
.prose h2{font:700 25px/1.3 var(--serif);color:var(--ink);margin:1.7em 0 .6em;letter-spacing:-.01em}
.prose h3{font:700 20px/1.35 var(--serif);color:var(--ink);margin:1.4em 0 .5em}
.prose ul,.prose ol{padding-left:1.3em;margin:0 0 1.15em}
.prose li{margin:.35em 0}
.prose blockquote{margin:1.4em 0;padding:4px 0 4px 18px;border-left:3px solid var(--accent);font-style:italic;color:var(--ink)}
.prose a{color:var(--accent-ink);text-decoration:underline;text-underline-offset:3px}
.prose strong{color:var(--ink)}
.prose img{border-radius:10px;height:auto}
.note{max-width:720px;border-radius:12px;padding:16px 18px;font-size:14px;line-height:1.6;margin:26px 0 0}
.note-ai{background:var(--accent-soft);border:1px solid color-mix(in srgb,var(--accent) 35%,transparent)}
.note-sources{background:var(--surface);border:1px solid var(--line)}
.note h4{margin:0 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase}
.note ul{margin:0;padding-left:18px}
.disclaimer{max-width:720px;font-size:12.5px;color:var(--muted);margin-top:16px;line-height:1.55}
.tags{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0 0;max-width:720px}
.tag{padding:6px 12px;border-radius:999px;background:var(--surface-2);font-size:13px;font-weight:600}
.tag:hover{background:var(--accent);color:#fff}
.share{display:flex;gap:8px;margin-top:22px;align-items:center;flex-wrap:wrap}
.share span{font-size:13px;color:var(--muted);margin-right:4px}
.share a,.share button{font:600 13px var(--sans);padding:8px 12px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}
.share a:hover,.share button:hover{border-color:var(--accent)}
.aside-box{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;margin-bottom:22px}
.aside-box h3{margin:0 0 10px;font:700 14px/1 var(--sans);letter-spacing:.06em;text-transform:uppercase}
.aside-box ol{margin:0;padding:0;list-style:none;counter-reset:n}
.aside-box ol li{counter-increment:n;display:grid;grid-template-columns:28px 1fr;padding:10px 0;border-bottom:1px solid var(--line);font-weight:600;font-size:14.5px;line-height:1.4}
.aside-box ol li:last-child{border-bottom:0}
.aside-box ol li::before{content:counter(n);font:700 20px/1 var(--serif);color:var(--accent)}
.mini-coin{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line);font-size:14px;font-variant-numeric:tabular-nums}
.mini-coin:last-child{border-bottom:0}
@media (min-width:981px){.sticky{position:sticky;top:20px}}

/* Liste sayfaları */
.page-head{padding:8px 0 22px;border-bottom:1px solid var(--line);margin-bottom:28px}
.page-head h1{font:700 clamp(28px,4vw,40px)/1.15 var(--serif);margin:6px 0 6px;letter-spacing:-.02em}
.page-head p{margin:0;color:var(--muted)}
.list-item{display:grid;grid-template-columns:260px 1fr;gap:22px;padding:22px 0;border-bottom:1px solid var(--line)}
.list-item h2{font:700 22px/1.28 var(--serif);margin:8px 0 8px;letter-spacing:-.01em}
.list-item p{margin:0 0 8px;color:var(--muted)}
@media (max-width:640px){.list-item{grid-template-columns:1fr}}
.pager{display:flex;justify-content:space-between;margin-top:28px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:10px;border:1px solid var(--line);background:var(--surface);font-weight:600;font-size:14px;color:var(--ink);cursor:pointer;font-family:inherit}
.btn:hover{border-color:var(--accent);color:var(--accent-ink)}
.btn-primary{background:var(--accent);border-color:var(--accent);color:#1b1206}
.btn-primary:hover{filter:brightness(1.05);color:#1b1206}
.btn-danger{color:var(--down)}
.empty{padding:60px 0;text-align:center;color:var(--muted)}

/* Alt bilgi */
.footer{background:var(--navy);color:#b7c0cf;padding:44px 0 28px;font-size:14px}
.footer .cols{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:32px}
.footer h4{color:#fff;margin:0 0 12px;font-size:13px;letter-spacing:.08em;text-transform:uppercase}
.footer ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.footer a:hover{color:#fff}
.footer .logo-text{color:#fff;font-size:24px}
.footer .legal{border-top:1px solid rgba(255,255,255,.1);margin-top:32px;padding-top:18px;font-size:12.5px;color:#8792a5;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
@media (max-width:760px){.footer .cols{grid-template-columns:1fr}}

/* Yönetim paneli */
.admin table{width:100%;border-collapse:collapse;font-size:14px;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.admin th,.admin td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
.admin th{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);background:var(--surface-2)}
.admin .table-wrap{overflow-x:auto}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:0 0 24px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px}
.stat b{display:block;font-size:28px;font-weight:800}
.stat span{color:var(--muted);font-size:13px}
.pill{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700;background:var(--surface-2)}
.pill.published,.pill.ok{background:#dff5e8;color:#0b6b3a}
.pill.needs_review,.pill.running{background:#fff1d6;color:#8a5300}
.pill.rejected,.pill.error,.pill.unpublished{background:#fde3e3;color:#9b1c1c}
.admin-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}
.admin form.inline{display:inline}
.admin pre{background:var(--surface-2);padding:14px;border-radius:10px;overflow:auto;font-size:12.5px;line-height:1.5;white-space:pre-wrap}
.admin label{display:block;font-weight:600;font-size:13px;margin:14px 0 6px}
.admin input[type=text],.admin input[type=url],.admin input[type=number],.admin textarea,.admin select{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:inherit}
.admin textarea{min-height:360px;font:13.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}
.scores{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:10px 0}
.scores div{background:var(--surface-2);border-radius:8px;padding:8px 10px;font-size:13px}
.scores b{display:block;font-size:20px}
`;

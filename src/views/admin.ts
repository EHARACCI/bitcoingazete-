import { html, raw } from "hono/html";
import { CATEGORIES, categoryName } from "../config";
import type { ArticleRow } from "../lib/db";
import { formatDateTR } from "../lib/text";
import type { Html } from "./layout";

export function adminShell(title: string, body: Html) {
  return html`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${title} | Yönetim</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Inter:wght@400;600;700;800&display=swap">
<link rel="stylesheet" href="/site.css"></head>
<body class="admin"><header class="masthead"><div class="wrap brand-row"><a class="logo" href="/admin"><span class="logo-mark">₿</span><span class="logo-text">Yönetim</span></a><a class="btn" href="/" target="_blank">Siteyi aç ↗</a></div></header>
<main><div class="wrap">
<nav class="admin-nav">
  <a class="btn" href="/admin">Özet</a>
  <a class="btn" href="/admin/haberler?durum=needs_review">Onay kuyruğu</a>
  <a class="btn" href="/admin/haberler?durum=published">Yayında</a>
  <a class="btn" href="/admin/haberler?durum=rejected">Reddedilenler</a>
  <a class="btn" href="/admin/kaynaklar">Kaynaklar</a>
  <a class="btn" href="/admin/calismalar">Çalışma kayıtları</a>
</nav>
<h1 style="font-family:var(--serif);margin:0 0 18px">${title}</h1>
${body}
</div></main></body></html>`;
}

export interface DashboardData {
  counts: Record<string, number>;
  today: number;
  dailyLimit: number;
  online: number | null;
  paused: boolean;
  mode: string;
  mock: boolean;
  runs: { id: number; trigger: string; status: string; stats: string | null; started_at: string }[];
  sources: { name: string; last_error: string | null; last_fetched_at: string | null; enabled: number }[];
}

export function dashboard(d: DashboardData) {
  const failing = d.sources.filter((s) => s.enabled && s.last_error);
  return html`
  ${d.mock ? html`<p class="note note-ai" style="max-width:none">AI_MOCK=on: Sahte yazar kullanılıyor, gerçek haber üretilmez.</p>` : ""}
  <div class="stats">
    <div class="stat"><b>${d.online ?? "—"}</b><span>Şu an sitede</span></div>
    <div class="stat"><b>${d.today}/${d.dailyLimit}</b><span>Bugün üretilen</span></div>
    <div class="stat"><b>${d.counts.published ?? 0}</b><span>Yayında</span></div>
    <div class="stat"><b>${d.counts.needs_review ?? 0}</b><span>Onay bekleyen</span></div>
    <div class="stat"><b>${d.counts.rejected ?? 0}</b><span>Reddedilen</span></div>
    <div class="stat"><b>${d.mode === "auto" ? "Otomatik" : "Onaylı"}</b><span>Yayın modu</span></div>
    <div class="stat"><b>${d.paused ? "Durdu" : "Aktif"}</b><span>Otomatik akış</span></div>
  </div>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:28px">
    <form method="post" action="/admin/calistir"><button class="btn btn-primary">Şimdi çalıştır (1 haber)</button></form>
    <form method="post" action="/admin/duraklat"><button class="btn">${d.paused ? "Otomatik akışı başlat" : "Otomatik akışı duraklat"}</button></form>
  </div>
  ${failing.length ? html`<p class="note note-sources" style="max-width:none"><b>Hata veren kaynaklar:</b> ${failing.map((s) => `${s.name} (${s.last_error})`).join(", ")}</p>` : ""}
  <h2>Son çalışmalar</h2>
  ${runsTable(d.runs)}`;
}

export function runsTable(runs: DashboardData["runs"]) {
  return html`<div class="table-wrap"><table><thead><tr><th>#</th><th>Zaman</th><th>Tetik</th><th>Durum</th><th>Sonuç</th></tr></thead><tbody>
  ${runs.map((r) => {
    const s = r.stats ? JSON.parse(r.stats) : {};
    return html`<tr><td><a href="/admin/calismalar/${r.id}">${r.id}</a></td><td>${formatDateTR(r.started_at)}</td><td>${r.trigger}</td>
      <td><span class="pill ${r.status}">${r.status}</span></td>
      <td>${r.stats ? `${s.ingested} yeni sinyal · ${s.published} yayın · ${s.queued} kuyruk · ${s.rejected} red · ${s.failed} hata` : "—"}</td></tr>`;
  })}</tbody></table></div>`;
}

export function articlesTable(rows: Pick<ArticleRow, "id" | "slug" | "title" | "status" | "quality_score" | "category" | "created_at">[]) {
  if (!rows.length) return html`<p class="empty">Kayıt yok.</p>`;
  return html`<div class="table-wrap"><table><thead><tr><th>Başlık</th><th>Kategori</th><th>Puan</th><th>Durum</th><th>Oluşturma</th></tr></thead><tbody>
  ${rows.map(
    (r) => html`<tr><td><a href="/admin/haberler/${r.id}"><b>${r.title}</b></a></td><td>${categoryName(r.category)}</td>
    <td>${r.quality_score ?? "—"}</td><td><span class="pill ${r.status}">${r.status}</span></td><td>${formatDateTR(r.created_at)}</td></tr>`,
  )}</tbody></table></div>`;
}

const SCORE_LABELS: Record<string, string> = {
  accuracy: "Doğruluk", originality: "Özgünlük", clarity: "Anlaşılırlık", language: "Dil", neutrality: "Tarafsızlık", headline: "Başlık", seo: "SEO",
};

interface Attempt {
  attempt: number;
  title: string;
  check: { errors: string[]; warnings: string[]; metrics: Record<string, number> };
  review: { scores: Record<string, number>; critical_issues: string[]; improvements: string[]; verdict: string };
  decision: { pass: boolean; score: number; reasons: string[] };
}

export function articleDetail(a: ArticleRow) {
  const report = a.quality_report ? JSON.parse(a.quality_report) : null;
  const attempts: Attempt[] = report?.attempts ?? [];
  const sources = JSON.parse(a.sources || "[]") as { name: string; url: string }[];
  const action = (to: string, label: string, cls = "btn") =>
    html`<form class="inline" method="post" action="/admin/haberler/${a.id}/durum"><input type="hidden" name="status" value="${to}"><button class="${cls}">${label}</button></form>`;

  return html`
  <p><span class="pill ${a.status}">${a.status}</span> · Puan: <b>${a.quality_score ?? "—"}</b> · ${a.word_count} kelime · Model: ${a.model ?? "—"}
   · <a href="/haber/${a.slug}${a.status === "published" ? "" : "?onizleme=1"}" target="_blank">Görüntüle ↗</a></p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 24px">
    ${a.status !== "published" ? action("published", "Yayınla", "btn btn-primary") : action("unpublished", "Yayından kaldır")}
    ${a.status !== "rejected" ? action("rejected", "Reddet", "btn btn-danger") : ""}
    <form class="inline" method="post" action="/admin/haberler/${a.id}/sil" onsubmit="return confirm('Kalıcı olarak silinsin mi?')"><button class="btn btn-danger">Sil</button></form>
  </div>

  ${report?.skipReason ? html`<p class="note note-sources" style="max-width:none"><b>Haber değeri yok:</b> ${report.skipReason}</p>` : ""}

  ${attempts.map(
    (t) => html`<section class="aside-box">
      <h3>Deneme ${t.attempt} — ${t.decision.pass ? "GEÇTİ" : "KALDI"} (puan ${t.decision.score}, editör: ${t.review.verdict})</h3>
      <div class="scores">${Object.entries(t.review.scores).map(([k, v]) => html`<div><b>${v}</b>${SCORE_LABELS[k] ?? k}</div>`)}</div>
      ${t.decision.reasons.length ? html`<p><b>Engel nedenleri:</b></p><ul>${t.decision.reasons.map((r) => html`<li>${r}</li>`)}</ul>` : ""}
      ${t.check.warnings.length ? html`<p><b>Uyarılar:</b></p><ul>${t.check.warnings.map((r) => html`<li>${r}</li>`)}</ul>` : ""}
      ${t.review.improvements.length ? html`<p><b>Editör önerileri:</b></p><ul>${t.review.improvements.map((r) => html`<li>${r}</li>`)}</ul>` : ""}
      <p class="meta">Ölçümler: ${Object.entries(t.check.metrics).map(([k, v]) => `${k}=${v}`).join(" · ")}</p>
    </section>`,
  )}

  <h2>Kaynaklar</h2>
  <ul>${sources.map((s) => html`<li><a href="${s.url}" target="_blank" rel="noopener">${s.name}</a> — ${s.url}</li>`)}</ul>

  <h2>Düzenle</h2>
  <form method="post" action="/admin/haberler/${a.id}">
    <label for="t">Başlık</label><input id="t" type="text" name="title" value="${a.title}">
    <label for="s">Spot</label><input id="s" type="text" name="summary" value="${a.summary}">
    <label for="m">Meta açıklama</label><input id="m" type="text" name="meta_description" value="${a.meta_description}">
    <label for="c">Kategori</label><select id="c" name="category">${CATEGORIES.map((c) => html`<option value="${c.slug}" ${c.slug === a.category ? raw("selected") : ""}>${c.name}</option>`)}</select>
    <label for="g">Etiketler (virgülle)</label><input id="g" type="text" name="tags" value="${(JSON.parse(a.tags || "[]") as string[]).join(", ")}">
    <label for="b">Metin (Markdown)</label><textarea id="b" name="body_md">${a.body_md ?? ""}</textarea>
    <p><button class="btn btn-primary">Kaydet</button></p>
  </form>`;
}

export function sourcesPage(rows: { id: number; name: string; feed_url: string; lang: string; weight: number; enabled: number; last_fetched_at: string | null; last_error: string | null }[]) {
  return html`<div class="table-wrap"><table><thead><tr><th>Kaynak</th><th>Dil</th><th>Ağırlık</th><th>Son tarama</th><th>Durum</th><th></th></tr></thead><tbody>
  ${rows.map(
    (s) => html`<tr><td><b>${s.name}</b><br><small>${s.feed_url}</small></td><td>${s.lang}</td><td>${s.weight}</td>
      <td>${formatDateTR(s.last_fetched_at)}</td>
      <td>${s.last_error ? html`<span class="pill error">${s.last_error}</span>` : s.enabled ? html`<span class="pill ok">aktif</span>` : html`<span class="pill">kapalı</span>`}</td>
      <td><form method="post" action="/admin/kaynaklar/${s.id}/degistir"><button class="btn">${s.enabled ? "Kapat" : "Aç"}</button></form></td></tr>`,
  )}</tbody></table></div>
  <h2>Yeni kaynak ekle</h2>
  <form method="post" action="/admin/kaynaklar" style="max-width:640px">
    <label for="n">Ad</label><input id="n" type="text" name="name" required>
    <label for="f">RSS/Atom adresi</label><input id="f" type="url" name="feed_url" required>
    <label for="l">Dil</label><select id="l" name="lang"><option value="en">İngilizce</option><option value="tr">Türkçe</option></select>
    <label for="w">Güvenilirlik ağırlığı (0.5 - 1.5)</label><input id="w" type="number" step="0.1" min="0.1" max="2" name="weight" value="1">
    <p><button class="btn btn-primary">Ekle</button></p>
  </form>`;
}

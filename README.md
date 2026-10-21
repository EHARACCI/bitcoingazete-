# Bitcoin Gazete

Cloudflare üzerinde çalışan, haberleri **otomatik bulan, yapay zeka ile yazan, kalite kontrolünden geçirip yayınlayan** kripto para haber sitesi.

- **Barındırma:** Cloudflare Workers (sunucu yönetimi yok, dünya çapında hızlı)
- **Veritabanı:** Cloudflare D1
- **Görseller:** Cloudflare R2 + Workers AI (kapak görseli üretimi)
- **Yazar ve editör:** Claude (Anthropic API)
- **Zamanlayıcı:** Cron, her 30 dakikada bir

---

## Sistem nasıl çalışır?

Her 30 dakikada bir şu adımlar çalışır (`src/pipeline/`):

| Adım | Ne yapar | Dosya |
|---|---|---|
| 1. Tarama | CoinDesk, Cointelegraph, The Block, Decrypt, SEC vb. RSS kaynaklarından yeni başlıkları toplar | `ingest.ts` |
| 2. Seçim | Aynı olayı anlatan haberleri birleştirir. Kaynak sayısına, tazeliğe ve önemli anahtar kelimelere göre puanlar. Reklam, "fiyat tahmini" ve tanıtım içeriklerini eler. Son 3 günde yazılmış konuları tekrar yazmaz | `select.ts` |
| 3. Araştırma | Kaynak haberlerin metnini ve CoinGecko'dan güncel fiyatları çeker (model fiyat uyduramasın diye) | `research.ts` |
| 4. Yazım | Claude, yayın ilkelerine göre özgün Türkçe haber yazar. Başlık, spot, meta açıklama, kategori, etiket ve iddia listesi üretir | `ai.ts`, `prompts.ts` |
| 5. Otomatik kontrol | Uzunluk, yapı, Türkçe dil kontrolü, yasaklı ifadeler (yatırım tavsiyesi, tıklama tuzağı), kaynak atfı, **kaynakta geçmeyen sayılar**, kaynakla birebir örtüşme (kopya), tekrar haber | `quality.ts` |
| 6. Editör denetimi | Ayrı bir Claude çağrısı haberi kaynaklarla satır satır karşılaştırır. Doğruluk, özgünlük, anlaşılırlık, dil, tarafsızlık, başlık ve SEO için 1-10 puan verir | `ai.ts` |
| 7. Revizyon | Eşik geçilemezse geri bildirimle yeniden yazılır (en fazla 2 kez) | `run.ts` |
| 8. Yayın | Geçen haber yayınlanır, kapak görseli üretilir. Geçemeyen haber onay kuyruğuna düşer, değersiz olan reddedilir | `run.ts`, `image.ts` |

**Yayın kapısı** (`quality.ts → gate`). Bir haberin otomatik yayınlanması için bunların hepsi gerekir:
- Otomatik kontrollerde **hiç hata olmaması**
- Editörün kritik sorun bulmaması ve kararının "publish" olması
- Ağırlıklı kalite puanının ≥ 7,5 olması (doğruluk ve tarafsızlık iki kat ağırlıklı)
- Doğruluk puanının ≥ 8, diğer her boyutun ≥ 6 olması

Bir haberin tüm denemeleri, puanları ve engellenme nedenleri yönetim panelinde görünür.

---

## Kurulum (adım adım)

### 0. Gerekenler
- Cloudflare hesabı ve **Workers Paid** planı (aylık 5 $; cron ve uzun süren yapay zeka çağrıları için gerekli)
- Anthropic API anahtarı: https://console.anthropic.com
- Bilgisayarınızda Node.js 20+

### 1. Projeyi hazırlayın
```bash
npm install
npx wrangler login
```

### 2. Veritabanını ve görsel deposunu oluşturun
```bash
npx wrangler d1 create bitcoingazete
# Çıktıdaki database_id değerini wrangler.jsonc içindeki "BURAYA_D1_DATABASE_ID" yerine yazın

npx wrangler r2 bucket create bitcoingazete-media
npm run db:migrate          # tabloları ve varsayılan haber kaynaklarını oluşturur
```

### 3. Gizli anahtarları girin
```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ADMIN_PASSWORD        # yönetim paneli şifresi (kullanıcı adı: admin)
npx wrangler secret put COINGECKO_API_KEY     # isteğe bağlı, ücretsiz demo anahtarı yeterli
```

### 4. Yayına alın
```bash
npm run deploy
```
Site önce `https://bitcoingazete.<hesabınız>.workers.dev` adresinde açılır. Buradan test edin:
- `/admin` → yönetim paneli → **"Şimdi çalıştır"** ile ilk haberi üretin
- İlk günlerde `PUBLISH_MODE` değerini `"review"` yapıp haberleri elle onaylamanızı öneririm. Kaliteden emin olunca `"auto"` yapın.

---

## Bluehost'tan Cloudflare'e taşıma

> ⚠️ **E-posta uyarısı:** Bluehost'ta `@bitcoingazete.com` e-posta hesabı kullanıyorsanız, DNS taşınırken MX kayıtlarının korunması gerekir. Yoksa e-postanız durur. 2. adımda Cloudflare'in içe aktardığı MX, SPF (TXT) ve DKIM kayıtlarının yerinde olduğunu kontrol edin. Bluehost'u tamamen kapatacaksanız e-postayı önce başka bir sağlayıcıya (Google Workspace, Zoho, Cloudflare Email Routing) taşıyın.

1. **Eski içeriği aktarın (site Bluehost'ta hâlâ açıkken):**
   ```bash
   npm run import:wp -- https://bitcoingazete.com
   npx wrangler d1 execute bitcoingazete --remote --file import-wp.sql
   sh upload-media.sh        # eski görselleri R2'ye yükler
   ```
   Eski yazıların adresleri (`/2024/05/baslik/` gibi) otomatik olarak yeni adreslere (`/haber/baslik`) **301 ile yönlendirilir**. Google sıralamanız korunur.

2. **Alan adını Cloudflare'e ekleyin:** Cloudflare panel → *Add a site* → `bitcoingazete.com` → Free plan. Cloudflare mevcut DNS kayıtlarını tarar. MX/TXT kayıtlarını kontrol edin.

3. **Nameserver'ları değiştirin:** Alan adı Bluehost'ta kayıtlıysa Bluehost panel → *Domains* → *Name Servers* → *Custom* seçin ve Cloudflare'in verdiği iki nameserver'ı girin. Yayılması birkaç saat sürebilir. İsterseniz sonradan alan adını Cloudflare Registrar'a transfer edebilirsiniz (maliyet fiyatına, daha ucuz).

4. **Alan adını Worker'a bağlayın:** `wrangler.jsonc` içindeki `routes` bölümünün yorumunu kaldırın, sonra `npm run deploy` çalıştırın. Cloudflare SSL sertifikasını otomatik verir. Bunu yaparken DNS'te `bitcoingazete.com` ve `www` için Bluehost'u gösteren eski A/CNAME kayıtlarını silin.

5. **Kontrol edin**, sonra Bluehost hosting paketini kapatın.

6. **Google Search Console:** `https://bitcoingazete.com/sitemap.xml` ve `https://bitcoingazete.com/news-sitemap.xml` site haritalarını gönderin.

---

## Ayarlar (`wrangler.jsonc → vars`)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PUBLISH_MODE` | `auto` | `auto`: kapıyı geçen haber direkt yayınlanır. `review`: her haber onay kuyruğuna düşer |
| `ARTICLES_PER_RUN` | `2` | Her 30 dakikalık turda en fazla kaç haber |
| `DAILY_LIMIT` | `24` | Günlük en fazla haber sayısı |
| `MIN_QUALITY_SCORE` | `7.5` | Yayın için gereken ağırlıklı puan |
| `MAX_REVISIONS` | `2` | Kalite yetersizse en fazla kaç kez yeniden yazılır |
| `WRITER_MODEL` / `EDITOR_MODEL` | `claude-opus-5-5` | Yazar ve editör modeli |
| `IMAGE_GENERATION` | `on` | Workers AI ile kapak görseli üretimi |

Haber kaynakları yönetim panelinden (**Kaynaklar**) eklenip kapatılabilir.

### Tahmini maliyet
- Cloudflare: Workers Paid 5 $/ay. D1, R2 ve Workers AI bu ölçekte büyük ölçüde ücretsiz kotada kalır.
- Claude (Opus 5.5): Haber başına yazım, editör denetimi ve ortalama bir revizyon dahil **yaklaşık 0,25–0,40 $**. Günde 24 haberde aylık yaklaşık **180–290 $**.
  - Maliyeti düşürmek için `DAILY_LIMIT` değerini azaltabilir veya `WRITER_MODEL` / `EDITOR_MODEL` değerini `claude-sonnet-5-5` yapabilirsiniz (yaklaşık yarı fiyat). Gerçek tüketimi Anthropic Console'dan izleyin.

---

## Yerel geliştirme
```bash
cp .dev.vars.example .dev.vars     # AI_MOCK=on: API çağrısı yapmayan sahte yazar
npm run db:migrate:local
npm run dev:local
# Başka bir terminalde cron'u tetikleyin:
curl "http://localhost:8787/__scheduled?cron=*/30+*+*+*+*"
```
Testler ve tip kontrolü: `npm test`, `npm run typecheck`.

## Güvenlik
- Yönetim paneli Basic Auth ve CSRF korumalıdır. Ek koruma için Cloudflare **Zero Trust → Access** ile `/admin*` yolunu yalnızca kendi e-postanıza açmanız önerilir (ücretsiz).
- Yapay zeka çıktısındaki ham HTML etkisizleştirilir.

## Sayfalar
`/` ana sayfa · `/haber/:slug` · `/kategori/:slug` · `/etiket/:etiket` · `/ara?q=` · `/hakkimizda` · `/yayin-ilkeleri` · `/gizlilik` · `/iletisim` · `/rss.xml` · `/sitemap.xml` · `/news-sitemap.xml` · `/admin`

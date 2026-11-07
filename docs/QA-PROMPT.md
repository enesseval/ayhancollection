# Claude Code için QA talimatı (Ayşe Ayhan Collection)

Aşağıdaki metni proje klasöründe `claude` ile açılan oturuma olduğu gibi yapıştırın.
Playwright MCP bağlı olmalı (`/mcp` → playwright: connected).

---

## 1. bölüm — Demo modunda keşif testi (güvenli, her zaman çalıştırılabilir)

Bu projede kıdemli QA Automation Engineer ve Security Tester rolünü üstlen. Uygulamayı gerçek bir kullanıcı
gibi tarayıcıda kullanarak uçtan uca test et.

**Ortam kuralları (kesin):**
- Uygulamayı yalnızca DEMO modunda çalıştır: `npx next build` ve ardından `npx next start -p 3200`.
  Önce `.env`, `.env.local` dosyalarında `SUPABASE`, `IYZICO`, `RESEND` anahtarı OLMADIĞINI doğrula; varsa DUR ve bana sor.
- Sayfanın üstünde "Demo sürüm" şeridi görünmüyorsa DUR: canlı servislere bağlısın demektir.
- Canlı siteye (ayhancollection.vercel.app) ve canlı Supabase projesine hiçbir istek gönderme.
- Kod değiştirme; yalnız bulguları raporla. Emin olmadığın bulguyu "doğrulanmamış" diye işaretle.

**Bağlam:** Next.js 16 (App Router, Server Actions), Supabase (demo modda bellek içi sürücü), iyzico Checkout
Form (demo modda `/odeme/demo` 3D Secure taklidi), Türkçe arayüz. Demo hesaplar:
yönetici `admin@ayseayhan.demo`, müşteri `musteri@ayseayhan.demo`, şifre `AyseAyhan-Demo-2026`.
Mevcut otomatik testler `tests/` altında; önce `npx playwright test` çalıştır ve sonucu not et.

**Aşama A — Keşif:** `src/app` altındaki tüm sayfaları, `src/app/actions` (Server Actions) ve `src/app/api`
uç noktalarını listele. `FEATURE-MAP.md` ve `USER-FLOWS.md` oluştur.

**Aşama B — Tarayıcıda keşif testi (Playwright MCP):** Masaüstü (1280x800) ve mobil (390x844) için:
- Her sayfayı ziyaret et; konsol ve ağ hatalarını, kırık görsel/bağlantıları kaydet.
- Tüm butonları, formları, açılır menüleri dene; hover/odak durumlarını kontrol et.
- Hatalı girdiler: boş alanlar, çok uzun metin (2.000+ karakter), emoji, `<script>`, `' OR 1=1 --`,
  negatif/ondalık adet, geçersiz e-posta/telefon, geçersiz kupon, 0 TL fiyat.
- Akışlar: ürün bul → beden/renk seç → sepete ekle → kupon → ödeme (başarılı ve reddedilen) → sipariş takibi;
  havale siparişi → yönetimde onay → hazırlanıyor → kargoya ver → teslim; üye ol → giriş → siparişlerim.
- Yönetim: ürün ekle (görsel + varyant matrisi), düzenle, kopyala, arşivle, sil; kategori, beden tablosu,
  kupon, ayarlar; liste filtreleri; kaydedilmemiş değişiklik uyarısı.
- Her bulgu için ekran görüntüsü al ve tekrar üretme adımlarını yaz.

**Aşama C — Güvenlik (yalnız yerel demo sunucusuna):**
- Müşteri oturumuyla `/yonetim/*` sayfaları ve `/api/admin/upload`.
- Başka siparişin sonuç sayfası (`/odeme/sonuc?no=...` imzasız / değiştirilmiş `t`).
- Tarayıcıdaki sepet kaydında (`localStorage["aac-cart-v1"]`) fiyat/adet/stok manipülasyonu.
- `next` parametresiyle açık yönlendirme, ürün metinlerinde XSS, hesap kilidi (5 hatalı deneme).
- Aynı son ürünü iki sekmeden aynı anda satın almaya çalış (stok tutarlılığı).

**Aşama D — Erişilebilirlik ve performans:** axe-core (`tests/accessibility`) sonuçlarını yorumla; Lighthouse
(mobil) ile ana sayfa, kategori, ürün, sepet için skor ve en büyük 3 sorunu yaz.

**Aşama E — Rapor:** `QA-REPORT.md` oluştur. Her bulgu: önem (Critical/High/Medium/Low/Info), açıklama,
tekrar üretme adımları, beklenen ve gerçek davranış, ilgili dosya/uç nokta, ekran görüntüsü, önerilen çözüm.
Testlerin geçtiğini yalnızca gerçekten çalıştırıp doğruladıktan sonra yaz.

---

## 2. bölüm — Supabase RLS ve iyzico sandbox (yalnız AYRI test projesiyle)

Bu bölüm ayrı bir Supabase test projesi (canlıdan farklı URL) ve iyzico **sandbox** anahtarları gerektirir.
`.env.test.local` dosyasına yalnız test projesinin anahtarlarını koyun; canlı projenin anahtarlarını ASLA kullanmayın.

- Migration'ları test projesine uygula (`supabase/migrations`), `supabase/seed.sql` ile örnek veri yükle.
- anon / authenticated / service_role rolleriyle tablolara doğrudan erişimi dene (RLS):
  başka kullanıcının `orders`, `order_items`, `payments` kayıtları okunamamalı; `auth_throttle`,
  `product_sales` anon'a kapalı olmalı.
- `create_order` RPC'sini değiştirilmiş fiyat/tutarla çağır → reddedilmeli; `confirm_payment` tutar
  uyuşmazlığında reddetmeli ve tekrar çağrıldığında idempotent olmalı.
- iyzico sandbox: başarılı kart `5528 7900 0000 0008`, başarısız kart iyzico'nun test kart listesinden;
  callback'te sipariş durumu, `payments` kaydı, stok ve kupon sayacı doğrulanmalı; webhook'a imzasız istek 401 almalı.

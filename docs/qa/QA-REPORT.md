# QA Raporu — Ayşe Ayhan Collection

| | |
|---|---|
| Tarih | 2026-11-07 / 08 |
| Sürüm | `main` @ `acfc7cf` · Next.js 16.4.5 · React 19.3 |
| Ortam | Yerel **demo modu**: `npx next build` → `npx next start -p 3200`. Supabase/iyzico/Resend/Upstash/Turnstile/R2 anahtarları boş verildi; `SESSION_SECRET` (üretimde ≥32 karakter zorunlu) ve `CRON_SECRET` için geçici yerel değerler kullanıldı. |
| Ön kontrol | `.env`, `.env.local` ve shell ortamında `SUPABASE`/`IYZICO`/`RESEND` anahtarı **yok**. Her sayfada "Demo sürüm" şeridi görüldü (`qa-artifacts/screenshots/00-home-desktop-demo-banner.png`). Canlı siteye ve canlı Supabase'e istek gönderilmedi. |
| Araçlar | Playwright 1.65 (Chromium), Playwright MCP, @axe-core/playwright, Lighthouse 12 (mobil, simüle yavaşlatma), curl |
| Kod | Uygulama kodu **değiştirilmedi**. QA senaryoları ayrı klasörde: `qa-artifacts/` (spec'ler, axe/Lighthouse JSON, ekran görüntüleri). |

## Düzeltme durumu (8 Kasım 2026)

| Bulgu | Durum | Yapılan |
|---|---|---|
| H-1 | ✅ Düzeltildi | `src/lib/safe-next.ts`: kontrol karakterleri, `\`, `//`, kodlanmış `%2F/%5C/%09/%0A/%0D` reddedilir; URL ayrıştırılıp yalnızca yol döner. Test: 7 saldırı varyantı |
| L-1 | ✅ Düzeltildi | Aynı `safeNext` ile `\n`/`\r` artık 500 değil, varsayılan sayfaya döner |
| M-1 | ✅ Düzeltildi | Ödenmiş/hazırlanan sipariş iptalinde stok + kupon sayacı geri alınır (Supabase: `admin_cancel_order` RPC, demo sürücü de aynı) |
| M-2 | ✅ Düzeltildi | `src/lib/order-status.ts` geçiş tablosu; sunucu eylemi ve veri katmanı koşullu güncelleme ile denetler |
| M-3 | ✅ Düzeltildi | Vercel'de `x-vercel-forwarded-for`/`x-real-ip`; başka ortamda yalnız `TRUST_PROXY=1` ise `X-Forwarded-For`'un son değeri |
| L-11 | ✅ İyileştirildi | Kilit artık e-posta+IP çiftine bağlı (5 deneme); e-posta başına 25, IP başına 20 deneme üst sınırı. Saldırgan kendi IP'sini kilitler, gerçek kullanıcı girebilir. Test eklendi |
| L-2 | ✅ Düzeltildi | Mobil menü: açılınca odak menüye, Esc kapatır, Tab menüde döner, odak düğmeye geri döner |
| L-3 | ✅ Düzeltildi | Geri tuşu için `popstate` koruması |
| L-4 | ✅ Düzeltildi | `src/lib/zod-tr.ts`: zod için Türkçe varsayılan mesajlar |
| L-5 | ✅ Düzeltildi | Sepet kaydı yüklenirken temizlenir; sunucu yalnız geçersiz satırı düşürür; özet hazır değilken ödeme butonu pasif |
| L-6 | ✅ Düzeltildi | Sepet boşalınca da stok hatası mesajı görünür |
| L-7 | ✅ Düzeltildi | Ondalıklı yüzde reddedilir: "Yüzde değeri tam sayı olmalı" |
| L-8 | ✅ Düzeltildi | Başarı rengi koyulaştırıldı (#1e6b24); yönetim sayfaları erişilebilirlik testine eklendi |
| L-9 | ✅ Düzeltildi | Galeri odaklanabilir, şeritler `region`, yönetimde `<main>`, kategori/aramada kart başlıkları `h2`, boş tablo başlığına gizli metin. Test artık bu kuralları da denetliyor (masaüstü + mobil galeri) |
| L-10 | ✅ Kısmen | İlk görsellere `fetchpriority="high"`, kategori filtre çubuğuna yer ayrıldı (CLS 0,165 → 0,001). Engelleyici CSS önerisi uygulanmadı |
| I-1 | ✅ Düzeltildi | 404 sayfalarında sekme başlığı "Sayfa bulunamadı" (test eklendi) |
| I-5 | ✅ Düzeltildi | Testlerde `networkidle` yerine `load` + öğe bekleme |
| I-2, I-3, I-6 | ⏸ Açık | Bilinçli bırakıldı / gerçek servis gerektiriyor |
| I-4 | ✅ Düzeltildi | Tutar kuponunda min. sepet, kupon tutarının en az 1,5 katı (10 TL kupon → 15 TL sepet); panelde ve sepette denetlenir |

---

## 0. Özet

**Mevcut otomatik testler:** `npx playwright test` → **77/77 geçti** (1,4 dk; masaüstü + mobil projeleri; erişilebilirlik, e2e, güvenlik).

**QA senaryoları** (`npx playwright test -c qa-artifacts/playwright.qa.config.ts`): `qa-security` 10, `qa-inputs` 8, `qa-a11y` 2 senaryo. Her senaryo en son çalıştırmasında geçti, ancak bu sonuçlar **ayrı çalıştırmalardan** geliyor (C8–C10 ve B5–B8, test kodundaki seçici/zaman aşımı hataları düzeltildikten sonra yeniden çalıştırıldı); 20 senaryo tek seferde birlikte çalıştırılmadı. Bu spec'ler bulguları **günlüğe yazar**: "geçti" bilgisi tek başına bulgu olmadığı anlamına gelmez. Örneğin C5 spec'i H-1'i yakalayamadı (tek kontrol bekleme süresiyle yapılıyor); H-1, Playwright MCP ile elle **iki kez** tekrar üretildi.

| Önem | Adet | Başlıklar |
|---|---|---|
| Critical | 0 | — |
| High | 1 | Kontrol karakterli `next` ile açık yönlendirme |
| Medium | 3 | Ödenmiş sipariş iptalinde stok iade edilmiyor · Sipariş durum geçişleri sunucuda denetlenmiyor · IP tabanlı limitler `X-Forwarded-For`'a güveniyor |
| Low | 11 | `next`'te `\n`/`\r` → 500 · Mobil menü Esc/odak · Geri tuşunda kaydedilmemiş değişiklik kaybı · İngilizce doğrulama mesajları · Bozuk sepet kaydında ₺0,00 özet · Stok yarışını kaybedene açıklama yok · Kupon yüzdesi sessizce yuvarlanıyor · Yönetimde renk kontrastı · Diğer axe uyarıları · Mobil performans (LCP/CLS) · Hesap kilidiyle hizmet engelleme |
| Info | 6 | 404 başlığı · CSP `unsafe-inline` · Kupon kullanımı ödenmemiş siparişte sayılıyor · %100 kuponda yalnız kargo ücreti · `networkidle` güvenilmez · Demo modda test edilemeyen kısımlar |

---

## 1. Bulgular

### H-1 · High · Kontrol karakteri içeren `next` parametresiyle açık yönlendirme (open redirect)
- **Açıklama:** `safeNext()` yalnızca `//` ve `/\` ön eklerini engelliyor. Tarayıcının URL ayrıştırıcısı sekme (`\t`), satır sonu gibi karakterleri siler; bu yüzden `/\t/evil.example` değeri kontrolü geçiyor ama tarayıcıda `//evil.example`'a, yani başka bir siteye dönüşüyor. Saldırgan, gerçek giriş sayfasına giden bir bağlantıyla kullanıcıyı **başarılı girişten hemen sonra** kendi sitesine (ör. sahte "oturum süresi doldu" sayfasına) gönderebilir.
- **Tekrar üretme:**
  1. `http://localhost:3200/hesabim?next=%2F%09%2Fevil.example` adresini açın.
  2. `musteri@ayseayhan.demo` / `AyseAyhan-Demo-2026` ile giriş yapın.
  3. Tarayıcı `evil.example` adresine gider (DNS çözülmediği için Chrome hata sayfası görünür).
- **Beklenen:** Site içi bir sayfaya (`/hesabim`) yönlenmesi. **Gerçek:** Server Action yanıtında `x-action-redirect: /\t/evil.example;push` döndü ve tarayıcı dış alana geçti.
- **İlgili:** `src/app/actions/account.ts` → `safeNext()` (`loginAction` ve `registerAction` ikisi de kullanıyor; üyelik akışı aynı koddan geçiyor ama tarayıcıda ayrıca denenmedi).
- **Ekran görüntüsü:** `qa-artifacts/screenshots/C5-open-redirect-1-login-form.png`, `C5-open-redirect-2-evil-example.png`
- **Önerilen çözüm:** Doğrulamayı ön ek karşılaştırmasıyla değil, URL'yi ayrıştırarak yapın:
  ```ts
  function safeNext(next: FormDataEntryValue | null, fallback: string) {
    const n = String(next ?? "");
    if (!n.startsWith("/") || /[\u0000-\u001F\u007F\\]/.test(n)) return fallback;
    const u = new URL(n, "http://x.invalid");
    return u.origin === "http://x.invalid" ? u.pathname + u.search + u.hash : fallback;
  }
  ```
  `/hesabim` sayfasındaki `next.startsWith("/")` kontrolü de aynı fonksiyonu kullanmalı. `tests/security/authorization.spec.ts` dosyasındaki açık yönlendirme testine `"/\t/evil.example"` ve `"/%09/evil.example"` örnekleri eklenmeli.

### M-1 · Medium · Ödenmiş/hazırlanan sipariş iptal edilince stok geri dönmüyor
- **Açıklama:** `updateOrderStatus` stoğu yalnızca `pending_payment` / `awaiting_transfer` durumundaki siparişler iptal edildiğinde iade ediyor. Yönetim arayüzü `paid → cancelled` ve `preparing → cancelled` geçişlerini sunuyor; bu durumda satılan adet stoktan kalıcı olarak düşmüş kalıyor. Sonuç: aslında elde olan ürün "Stokta yok" görünüyor ve satış kaybı oluşuyor.
- **Tekrar üretme:**
  1. Yönetici olarak stoğu **1** olan tek varyantlı bir ürün oluşturup yayına alın.
  2. Müşteri olarak kartla satın alın, demo ekranında "Ödemeyi onayla" deyin (beden artık devre dışı).
  3. Yönetim → sipariş detayı → **İptal edildi** → onaylayın.
  4. Ürün sayfasını açın: beden hâlâ devre dışı; ürün listesinde "Stokta yok".
- **Beklenen:** İptal edilen 1 adet stoğa geri eklensin (ya da yöneticiye "stoğa geri al" seçeneği sunulsun). **Gerçek:** Stok 0'da kalıyor.
- **İlgili:** `src/lib/data/demo.ts` → `updateOrderStatus` / `restock`; Supabase sürücüsünde ve SQL fonksiyonlarında aynı kural ayrıca kontrol edilmeli (demo modda **doğrulanmadı**). `src/components/admin/order-actions.tsx` (izin verilen geçişler).
- **Ekran görüntüsü:** `C9-paid-cancelled.png`, `C9-stock-after-cancel.png`, `B10-delete-product-with-orders.png` (iptal edilmiş siparişlerin ürünleri "Stokta yok")
- **Önerilen çözüm:** `cancelled` ve `refunded` geçişlerinde, kargoya verilmemiş siparişlerin kalemlerini stoğa geri ekleyin (kupon kullanımını da geri alın). İşlemi tek seferlik yapın (aynı siparişin iki kez iade edilmesini engelleyin) ve denetim kaydına yazın.

### M-2 · Medium · Sipariş durum geçişleri yalnız arayüzde kısıtlı, sunucu her geçişi kabul ediyor
- **Açıklama:** `setOrderStatus` gelen durumu yalnızca enum ile doğruluyor. Geçiş tablosu (`paid → preparing|cancelled` vb.) sadece `order-actions.tsx` içinde. Yönetici oturumuyla Server Action doğrudan çağrılınca **iptal edilmiş bir sipariş "Ödendi" durumuna** alınabiliyor. Bu işlemde stok yeniden düşülmüyor. Bekleyen bir sipariş iptal edilip (stok iade edilir) sonra yeniden `paid` yapılırsa aynı stok iki kez satılabilir (aşırı satış). Yönetici yetkisi gerektirdiği için önem Medium; ele geçirilmiş bir oturum, hatalı bir istemci kodu veya ileride eklenecek bir otomasyon veri bütünlüğünü bozabilir.
- **Tekrar üretme:** (`qa-artifacts/specs/qa-security.spec.ts` → C9)
  1. Yönetici olarak bir siparişi **İptal edildi** yapın; DevTools'ta `next-action` başlıklı POST isteğini kopyalayın.
  2. Aynı isteği gövdesi `["<orderId>","paid"]` olacak şekilde tekrar gönderin.
  3. Sipariş sayfasını yenileyin → durum **Ödendi**, işlemler "Hazırlanıyor / İptal edildi".
- **Beklenen:** `cancelled → paid` reddedilsin. **Gerçek:** Kabul edildi.
- **İlgili:** `src/app/actions/admin.ts` → `setOrderStatus`; `src/lib/data/demo.ts` / `supabase.ts` → `updateOrderStatus`
- **Ekran görüntüsü:** `C9-cancelled-to-paid.png`
- **Önerilen çözüm:** Geçiş tablosunu sunucuya taşıyın (ör. `ALLOWED_TRANSITIONS` sabiti `lib/` içinde, arayüz de aynısını içe aktarsın). Supabase'de durum değişikliğini koşullu güncellemeyle yapın (`update ... where status = any(:allowedFrom)`). `paid`/`awaiting_transfer` durumuna yalnızca `markOrderPaid`/`confirmTransfer` ile geçilebilsin.

### M-3 · Medium (Vercel'de muhtemelen Low — doğrulanmamış) · IP tabanlı hız sınırları ve IP kilidi `X-Forwarded-For` başlığına güveniyor
- **Açıklama:** `clientIp()` IP'yi doğrudan `x-forwarded-for` başlığının ilk değerinden alıyor. Bu başlık istemci tarafından gönderilebildiği için IP başına uygulanan bütün sınırlar (giriş 10/dk, IP başına 20 hata kilidi, kayıt, kupon, ödeme, sipariş sorgulama) her istekte farklı sahte IP gönderilerek aşılabiliyor. E-posta başına kilit çalışmaya devam ediyor ama çok sayıda hesaba yayılan (password spraying) denemeler ve kupon kodu tahmini sınırsız hale geliyor. Mevcut test altyapısı da (`tests/fixtures/test.ts`) bu davranışa dayanıyor.
- **Tekrar üretme:** (C7) Her denemede farklı `X-Forwarded-For` (10.8.i.1) ile farklı e-postalara 25 hatalı giriş → **0** engelleme. Aynı IP ile 12 deneme → 2 engelleme (sınır normalde çalışıyor).
- **Beklenen:** Sahte başlığın etkisi olmaması. **Gerçek:** Sınır tamamen aşılıyor.
- **İlgili:** `src/lib/rate-limit.ts` → `clientIp()`; `src/lib/login-throttle.ts`
- **Not:** Vercel, `x-forwarded-for` başlığını kendisi yazdığı için canlı ortamda risk düşük olabilir. Bu **doğrulanmadı** (canlı ortama istek gönderilmedi). Uygulama Vercel dışında (`next start`, Docker, başka bir proxy arkasında) çalıştırılırsa açık doğrudan istismar edilebilir.
- **Önerilen çözüm:** Vercel'de `x-vercel-forwarded-for` / `request.ip` kullanın; aksi halde yalnızca güvenilen proxy'den gelen başlığı ve zincirdeki **son** güvenilir girdiyi kabul edin (`TRUSTED_PROXY` ayarı). Testlerde sahte IP yerine sınırları sıfırlayan bir test yardımcısı tercih edin.

### L-1 · Low · `next` parametresinde `\n` / `\r` → 500 hatası
- **Tekrar üretme:** `/hesabim?next=%2F%0A%2Fevil.example` → geçerli bilgilerle giriş → "Bir şeyler ters gitti" sayfası. Konsolda `500 Internal Server Error`. Oturum çerezi yine de oluşuyor.
- **Beklenen:** Varsayılan sayfaya yönlenmesi. **Gerçek:** 500 hatası (yönlendirme başlığında geçersiz karakter).
- **İlgili:** `src/app/actions/account.ts` → `safeNext()` · **Ekran görüntüsü:** `C5-newline-next-error.png`
- **Çözüm:** H-1'deki düzeltme bunu da giderir.

### L-2 · Low · Mobil menü Esc ile kapanmıyor, odak menüye taşınmıyor
- **Açıklama:** `mobile-nav.tsx` öğesi `role="dialog" aria-modal="true"` olarak tanımlı ama Escape tuşunu dinlemiyor, açılınca odağı menünün içine taşımıyor ve odağı menü içinde tutmuyor. Odak arkadaki "Menüyü aç" butonunda kalıyor (WCAG 2.1.2 / 2.4.3). Sepet çekmecesinde Esc çalışıyor. İlk ziyarette çerez bandı (`z-[55]`) menünün (`z-50`) üstünde kalıp menünün alt bölümünü kapatıyor.
- **Tekrar üretme:** 390×844 → "Menüyü aç" → `Esc` → menü açık kalıyor.
- **İlgili:** `src/components/layout/mobile-nav.tsx`, `src/components/shop/cookie-banner.tsx` · **Ekran görüntüsü:** `B9-mobile-menu-open.png`, `B9-mobile-menu-after-esc.png`
- **Çözüm:** `cart-drawer.tsx` içindeki Escape işleyicisini burada da kullanın. Açılışta odağı ilk bağlantıya taşıyın, odağı menü içinde tutun, kapanışta odağı açan butona geri verin. Menü açıkken çerez bandını gizleyin ya da menünün z-index'ini yükseltin.

### L-3 · Low · Kaydedilmemiş değişiklik uyarısı tarayıcının geri tuşunda çalışmıyor
- **Açıklama:** `useUnsavedGuard` uygulama içi bağlantı tıklamalarını ve `beforeunload` olayını yakalıyor ama istemci tarafı geri gezinmeyi (`popstate`) yakalamıyor. Ürün düzenleyicide değişiklik yapıp tarayıcının geri tuşuna basınca uyarı çıkmadan liste sayfasına dönülüyor ve değişiklikler kayboluyor.
- **Tekrar üretme:** (B7) Ürün düzenle → ad değiştir → kenar çubuğunda "Siparişler"e tıkla (uyarı çıkar, sayfada kalınır ✔) → tarayıcıda Geri → uyarı çıkmadan `/yonetim/urunler` açılır.
- **İlgili:** `src/components/admin/product-editor.tsx` → `useUnsavedGuard` · Ekran görüntüsü alınmadı (otomatik test günlüğü: `diyaloglar: [1 confirm] | geri tuşunda kaldı: false`)
- **Çözüm:** Değişiklik varken `history.pushState` ile koruyucu bir kayıt ekleyip `popstate` olayında onay isteyin, ya da Next.js'in gezinme olaylarına bağlanın.

### L-4 · Low · Doğrulama mesajlarının bir kısmı İngilizce
- **Örnekler:** Üyelikte 2.000+ karakterli ad → "Too big: expected string to have <=80 characters". Yönetimde: "Too small: expected number to be >0" (negatif kupon), "Invalid input: expected number, received NaN" (fiyat/eşik alanına harf), "Too big: … <=140" (ürün adı), "… <=160" (duyuru). Ödeme formunda adres/not alanlarında `max()` için Türkçe mesaj tanımlı değil.
- **İlgili:** `src/lib/validation.ts`, `src/app/actions/admin.ts` (`settingsSchema`) · **Ekran görüntüsü:** `B2-register-long-name.png`
- **Çözüm:** `z.config({ localeError })` ile Türkçe varsayılan mesaj tanımlayın ya da her `max/min/int` kuralına mesaj ekleyin.

### L-5 · Low · Bozuk/uyumsuz sepet kaydında tutarsız özet (₺0,00) ve aktif ödeme butonu
- **Açıklama:** `localStorage["aac-cart-v1"]` içindeki tek bir satır şemaya uymazsa (adet 999, -3, 2.5 ya da `"5"` metni) `priceCartAction` **bütün sepeti** reddediyor (`lines: []`). Arayüzde satır 999 × ₺998.001,00 olarak duruyor, rozet 999 gösteriyor, özet ise "Ara toplam ₺0,00 · Kargo Ücretsiz · Toplam ₺0,00" ve "Güvenli ödemeye geç" butonu aktif. Sunucu ödeme sırasında siparişi reddettiği için **parasal risk yok**. Fiyat manipülasyonu (`unitPrice=1`) sunucuda doğru yok sayılıyor (sipariş ₺1.078,90 ile oluştu ✔).
- **Tekrar üretme:** Sepete ürün ekleyin → DevTools'ta `aac-cart-v1` kaydında `qty` değerini `999` yapın → `/sepet` açın.
- **İlgili:** `src/app/actions/cart.ts`, `src/components/cart/store.ts` (`persist` için `migrate`/doğrulama yok) · **Ekran görüntüsü:** `C4-cart-qty_999_maxQty_999.png`, `C4-cart-qty_3.png`, `C4-cart-unitPrice_1.png`
- **Çözüm:** Kaydı okurken satırları zod ile doğrulayıp geçersiz satırları atın ya da sınırlayın (`merge`/`migrate`). Sunucuda yalnızca geçersiz satırı düşürüp kalanını fiyatlayın ve özet boşken ödeme butonunu devre dışı bırakın.

### L-6 · Low · Son ürün yarışını kaybeden kullanıcı nedenini görmüyor
- **Açıklama:** Stok tutarlılığı **doğru**: aynı anda gönderilen iki siparişten yalnız biri ödeme ekranına geçti. Kaybeden sekmede sunucu "Ürünlerden biri az önce tükendi…" hatası döndürüyor ve sepeti yeniliyor, ancak sepet boşaldığı için ödeme sayfası yalnızca "Sepetiniz boş." gösteriyor; hata mesajı görünmüyor.
- **Tekrar üretme:** (C8) Stoğu 1 olan ürünü iki ayrı oturumda sepete ekleyip ödeme formlarını doldurun, iki "Ödemeye geç" butonuna aynı anda basın.
- **İlgili:** `src/components/checkout/checkout-form.tsx` (`refreshCart` işleme) · **Ekran görüntüsü:** `C8-race-A-kazanan.png`, `C8-race-B-kaybeden.png`
- **Çözüm:** Kaldırılan ürünleri ve hata mesajını kalıcı bir uyarı olarak (ör. sepet sayfasına `?hata=stok` ile) gösterin.

### L-7 · Low · Kupon yüzdesi sessizce yuvarlanıyor
- **Tekrar üretme:** Yönetim → Kuponlar → Yüzde, değer `12,5` → Kaydet → listede **%13**.
- **İlgili:** `src/components/admin/coupon-form.tsx` (`Math.round(value)`) · **Ekran görüntüsü:** `B8-coupon-list.png`
- **Çözüm:** Ondalıklı yüzde değerini reddedip "Tam sayı girin" uyarısı verin ya da yuvarlanacağını gösterin.

### L-8 · Low · Yönetimde renk kontrastı yetersiz (axe "serious")
- **Açıklama:** "Yayında / Aktif" durum rozetleri (`bg-success/10 text-success`) WCAG AA 4.5:1 oranının altında. `/yonetim/urunler` sayfasında 26, `/yonetim/kuponlar` sayfasında 6 öğe etkileniyor. Mevcut erişilebilirlik testi yönetim sayfalarını kapsamadığı için bu sorun yakalanmıyor.
- **İlgili:** `src/components/admin/*` rozet sınıfları · Kaynak: `qa-artifacts/axe-mobile.json` (masaüstü + mobil birleşik)
- **Çözüm:** Rozet metin rengini koyulaştırın (ör. `text-green-800`). `tests/accessibility` kapsamına yönetim sayfalarını da ekleyin.

### L-9 · Low · Diğer axe-core ihlalleri (moderate/minor)
| Kural | Etki | Nerede | Not |
|---|---|---|---|
| `scrollable-region-focusable` | serious | Mobil ürün galerisi `.no-scrollbar` | Kaydırılabilir galeri klavyeyle odaklanamıyor (`tabIndex=0` + etiket ekleyin) |
| `region` | moderate | Tüm sayfalar: demo şeridi / duyuru çubuğu `.bg-blush-soft`; yönetimde çok sayıda öğe | Şeritleri `<header>` ya da `role="region"` içine alın |
| `landmark-one-main` | moderate | Tüm `/yonetim/*` sayfaları | Yönetim düzeninde `<main>` yok |
| `heading-order` | moderate | `/kategori/*`, `/arama` | Ürün kartlarında `h1`'den sonra doğrudan `h3` geliyor |
| `empty-table-header` | minor | `/yonetim/urunler/yeni` varyant tablosu 7. sütun | Görünmeyen bir başlık metni ekleyin |

Mağaza sayfalarında **critical** ihlal yok. Mevcut test yalnızca critical/serious ihlalleri ve yalnızca masaüstünü denetlediği için tablodaki maddeleri raporlamıyor.

### L-10 · Low · Mobil performans: LCP 3,7–3,9 sn, kategori sayfasında CLS 0,165
| Sayfa | Perf | A11y | Best Pr. | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| `/` | 84 | 100 | 100 | 100 | 2,4 sn | 3,9 sn | 50 ms | 0,075 |
| `/kategori/tesettur-giyim` | 79 | 98 | 100 | 100 | 2,4 sn | 3,7 sn | 40 ms | **0,165** |
| `/urun/vizon-uzun-tunik` | 86 | 100 | 100 | 100 | 2,4 sn | 3,7 sn | 30 ms | 0,037 |
| `/sepet` | 85 | 100 | 100 | 63* | 2,3 sn | 3,9 sn | 60 ms | 0,026 |

\* Sepetteki SEO puanı `noindex` kullanımından kaynaklanıyor ve **beklenen** bir durum.

**En büyük 3 sorun:**
1. **LCP görselinde öncelik ipucu yok:** Ana sayfadaki LCP görseli (`Raglan Kol Lacivert Tunik`, 1600×2000) `fetchpriority="high"` almıyor (`lcp-discovery-insight`). Ürün ve kategori sayfalarında da LCP bir görsel. → İlk görünen görsele `priority` (next/image) verin ve `sizes` değerini mobil için daraltın.
2. **Engelleyici CSS:** `/_next/static/chunks/*.css` (11,6 KB) ilk boyamayı geciktiriyor; tahmini kazanç FCP ≈ 1,4–1,5 sn. → Kritik CSS'i satır içine alın (Next `experimental.inlineCss`) ya da font/CSS yüklemesini sadeleştirin.
3. **Kategori sayfasında düzen kayması:** `main > div.container-x > div.mt-8` (ürün ızgarası, 0,115) ve `h1` (0,050) hidrasyondan sonra kayıyor; büyük ihtimalle filtre çubuğu sonradan yükleniyor. → Filtre çubuğu için yer ayırın (sabit yükseklik/iskelet).

Ek: Bütün sayfalarda ~27 KB kullanılmayan JS ve ~13 KB eski tarayıcılar için (legacy) JS var. `Cache-Control: no-store` yüzünden geri/ileri önbelleği (bf-cache) devre dışı.
*Ölçümler localhost'ta, Lighthouse'un simüle mobil yavaşlatmasıyla alındı; canlı CDN ile değerler farklı olacaktır.* Raporlar: `qa-artifacts/lh-*.json`.

### L-11 · Low · Hesap kilidiyle hizmet engelleme (bilinen tasarım kararı)
- **Açıklama:** E-posta başına 5 hatalı deneme hesabı 15 dakika kilitliyor ve bu sürede **doğru şifre de reddediliyor** (farklı IP'den denense bile). Hesap kilidi testi beklendiği gibi çalıştı. Ancak e-postayı bilen herkes (yönetici e-postası demo ipucunda görünüyor) yöneticiyi her 15 dakikada 5 istekle sürekli kilitleyebilir. Kod yorumunda kalıcı kilit bu yüzden zaten bilinçli olarak seçilmemiş.
- **Ekran görüntüsü:** `C7-lockout.png`
- **Çözüm önerisi:** Kilit sırasında doğru şifre + ek doğrulama (Turnstile/CAPTCHA veya e-posta bağlantısı) ile giriş izni verin. Yönetici için TOTP'yi (`ADMIN_REQUIRE_MFA`) üretimde açın.

### Info
- **I-1 · 404 sayfa başlığı:** Var olmayan sayfa/ürün/kategori 404 kodu ve "Aradığınız sayfa bulunamadı" başlığını doğru döndürüyor, ama `<title>` genel site başlığı kalıyor. Sekme başlığına "Sayfa bulunamadı" yazılmalı.
- **I-2 · CSP:** `script-src 'self' 'unsafe-inline'`. Yansıtılan veya kalıcı (stored) XSS bulunmadığı için doğrudan bir risk değil; yine de nonce tabanlı CSP ile `unsafe-inline` kaldırılabilir. Diğer güvenlik başlıkları (HSTS, X-Frame-Options DENY, `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy, COOP) mevcut.
- **I-3 · Kupon kullanımı ödenmemiş siparişte sayılıyor:** Kullanım sayacı sipariş oluşturulurken artıyor. Ödenmemiş kart siparişi 15 dakika, havale siparişi 24 saat boyunca kullanım hakkını tutuyor. Sınırlı kuponlarda başkası kuponu kullanamayabilir (ret/süre dolumunda sayaç geri alınıyor ✔).
- **I-4 · Sepet tutarından büyük sabit kupon:** 100.000 TL'lik sabit kupon indirimi ara toplamla sınırlıyor (doğru), ancak indirim sonrası tutar 0 olduğu için kargo ücreti ekleniyor ve sipariş yalnızca **₺79,90** ödeme ile tamamlanabiliyor. İş kuralı olarak bunun istenip istenmediği teyit edilmeli (`B8-fixed-coupon-zero-total.png`, `B8-zero-total-order.png`).
- **I-5 · Test kararlılığı:** Next.js'in önceden yükleme (RSC prefetch) yanıtları tarayıcıda milisaniyeler içinde tamamlanıyor, ama Playwright bunları bitmiş saymadığı için `waitUntil: "networkidle"` ile yapılan gezinmeler (özellikle mobilde) 30 sn zaman aşımına düşüyor. `tests/accessibility` testi `networkidle` kullanıyor; ileride kararsızlık çıkarsa `load` + belirli bir öğeyi bekleme yöntemine geçilmeli.
- **I-6 · Demo modda test edilemeyenler:** Supabase sürücüsü (SQL fonksiyonları, RLS, `COUPON_INVALID`/`PRICE_CHANGED` istisnaları), gerçek iyzico callback/webhook (`/api/payments/iyzico/*` demo modda 404 dönüyor), Resend e-postaları, Upstash ve Turnstile bu çalışmada **test edilmedi**. Gerçek veritabanı olmadığı için SQL enjeksiyonu yalnızca girdi doğrulaması düzeyinde denendi. M-1 ve M-2 Supabase sürücüsünde ayrıca doğrulanmalı.

---

## 2. Geçen kontroller (bulgu yok)

| Alan | Senaryo | Sonuç |
|---|---|---|
| Yetki | Müşteri oturumuyla 10 `/yonetim/*` yolu | Hepsi `/hesabim`'e yönlendi ✔ (`C1-customer-yonetim.png`) |
| Yetki | Müşteri, aynı origin → `POST /api/admin/upload` | 403 `Yetkisiz` ✔ |
| Yetki | Anonim / Origin'siz / sahte `aac_session` çerezi | 403 / 403 / `/hesabim`'e yönlendirme ✔ |
| Yetki | Yöneticinin `saveSettings` Server Action'ı müşteri/anonim oturumla yeniden gönderildi | `{"ok":false,"error":"Yetkisiz"}`, değişiklik uygulanmadı ✔ |
| Yetki | `GET /api/cron/release-reservations` gizli anahtar olmadan | 401 ✔ |
| IDOR | `/odeme/sonuc` imzasız, son karakteri değiştirilmiş, kısaltılmış, başka siparişin `t`'si, başka oturum | 404 ✔ (`C3-idor-404.png`) |
| IDOR | `/odeme/demo` başka sipariş id'si + geçerli `t` | 404 ✔ |
| Fiyat | `localStorage` birim fiyatı 1 kuruşa indirildi → sipariş | Gerçek fiyat (₺999 + kargo) uygulandı ✔ |
| Stok | Son ürün iki oturumdan eşzamanlı | Yalnız 1 sipariş oluştu ✔ (UX için L-6) |
| Kupon | Kullanım limiti 1 olan kupon iki eşzamanlı siparişte | 1 kabul, 1 "Kupon kullanım limiti doldu" ✔ |
| Açık yönlendirme | `https://evil`, `//evil`, `/\evil`, `\\evil`, `javascript:`, `/%2F/evil`, `/ /evil` | Site içinde kaldı ✔ (istisna: H-1) |
| XSS | Ödeme alanlarına (ad, ilçe, adres, not) `<img onerror>`, `<script>`, `<svg onload>` → yönetim sipariş detayı ve e-posta önizlemesi; duyuru çubuğu; üyelik adı; arama; kupon | Hiçbir diyalog tetiklenmedi, metin olarak gösterildi ✔ (`C6-*.png`) |
| XSS | Ürün açıklamasında Markdown `javascript:` bağlantısı (mevcut test) | Etkisiz ✔ |
| Kaba kuvvet | 5 hatalı deneme → kilit, doğru şifre de reddedildi | ✔ (L-11'e bakın) |
| Girdi | Arama: 2.100 karakter, 10.000 karakter, emoji, `<script>`, `' OR 1=1 --`, `%`, `_`, `\` | 200, güvenli şekilde gösterildi ✔ |
| Girdi | Ödeme: hatalı telefon (12345, sabit hat, 14 hane), `a@b`, SQLi e-posta, `ABCDE` posta kodu, 2.100 karakter adres/not | Reddedildi ✔ · `+90 532…` geçerli kabul edildi ✔ (`B3-checkout-bad-phone.png`) |
| Girdi | Sipariş takibi: SQLi, script, yanlış biçim, olmayan sipariş | Biçim hatası / aynı genel "bulunamadı" mesajı ✔ |
| Girdi | Üyelik: boş alanlar, boşluklardan oluşan ad, geçersiz e-posta, 201 karakter şifre | Reddedildi ✔ (emoji ve `<script>` ad kabul edildi, metin olarak gösterildi) |
| Yönetim | Ürün fiyatı 0, negatif, harf; üstü çizili fiyat < satış fiyatı; 2.100 karakter ad | Reddedildi ✔ (mesaj dili için L-4) · `199,99` doğru ayrıştırıldı, `199.999` → 200'e yuvarlandı |
| Yönetim | Kupon yüzde 150, negatif değer; ayarlarda negatif kargo, harf eşik, `0532` WhatsApp, 2.100 karakter duyuru | Reddedildi ✔ |
| Yönetim | Siparişte geçen ürünü silme | "silinemez; arşivleyin" ✔ · siparişsiz ürün silindi ✔ |
| Yönetim | Kaydedilmemiş değişiklikle panel içi bağlantıya tıklama | Onay diyaloğu, sayfada kalındı ✔ (L-3'e bakın) |
| Sepet | Arayüzden adet artırma | Stok ve 10 ile sınırlı, buton devre dışı kalıyor ✔ |
| Tarama | 52 yol × 2 görünüm (1280×800, 390×844) | Kırık görsel 0, konsol hatası 0 (404 sayfaları hariç), yatay taşma 0, her sayfada 1 `h1` ✔ |
| Odak | Mobilde ilk 8 Tab durağı | "İçeriğe geç" bağlantısı ilk sırada, hepsinde 2 px görünür odak halkası ✔ |

## 3. Kapsam dışı kalanlar / sınırlamalar
- Hover durumları sistematik olarak denetlenmedi (yalnızca son commit'te eklenen el imleci tarama sırasında gözlendi). Odak durumları kontrol edildi.
- Görsel yükleme yalnızca geçerli PNG ile denendi; MIME/uzantı sahteciliği ve 4 MB üstü dosyalar kod incelemesine dayanıyor (`sharp` içeriği çözümlüyor, boyut ve MIME sınırı var) — **doğrulanmadı**.
- Üyelik akışında açık yönlendirme (H-1) aynı fonksiyondan geçtiği için etkilenmesi beklenir, tarayıcıda ayrıca denenmedi.
- Lighthouse yalnız mobil profille ve localhost üzerinde çalıştırıldı.

## 4. Tekrar çalıştırma
```bash
# Mevcut paket (kendi demo sunucusunu 3100'de kurar)
npx playwright test

# QA senaryoları — önce demo sunucusu:
NEXT_PUBLIC_SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= IYZICO_API_KEY= IYZICO_SECRET_KEY= RESEND_API_KEY= \
NEXT_PUBLIC_SITE_URL=http://localhost:3200 npx next build
SESSION_SECRET=<en-az-32-karakter> CRON_SECRET=<yerel> NEXT_PUBLIC_SITE_URL=http://localhost:3200 npx next start -p 3200
npx playwright test -c qa-artifacts/playwright.qa.config.ts
```
Demo verileri sunucu belleğinde tutulur; senaryolar test ürünleri, kuponlar ve siparişler oluşturur. Temiz bir başlangıç için sunucuyu yeniden başlatın.

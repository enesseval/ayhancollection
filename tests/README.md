# Uçtan uca (E2E) testler

Testler sitenin **demo modunda** çalışır: Supabase / iyzico / Resend anahtarı kullanılmaz, veriler sunucu
belleğinde tutulur, ödeme demo 3D Secure ekranıdır. **Canlı veritabanına dokunulmaz.** `.env.local` gibi
dosyalarda canlı anahtar varsa testler başlamaz (`tests/fixtures/global-setup.ts`).

## Çalıştırma

```powershell
npm install
npx playwright install chromium   # bir kez
npm run test:e2e                  # derler, 3100 portunda başlatır, tüm testleri çalıştırır
npm run test:e2e:rapor            # HTML raporu aç (hatalarda ekran görüntüsü + video + iz)
npm run test:e2e:ui               # görsel arayüzle adım adım izle
```

Tek dosya / tek test: `npx playwright test tests/e2e/cart.spec.ts` · `npx playwright test -g "kupon"`

## Kapsam

| Dosya | Ne test ediliyor |
| --- | --- |
| `e2e/smoke.spec.ts` | Demo modu kilidi, tüm ana sayfalar (konsol hatası yok), 404'ler, kırık bağlantı/görsel, arama/filtre, SEO (başlık, açıklama, canonical, Product JSON-LD, sitemap, robots), güvenlik başlıkları |
| `e2e/cart.spec.ts` | Beden zorunluluğu, tükenen beden, ekle/adet/sil, ara toplam–kargo–ücretsiz kargo eşiği, kupon (geçersiz, alt limit, %10), kalıcılık |
| `e2e/checkout.spec.ts` | Form doğrulama, kartla başarılı ödeme (tutar eşleşmesi, sepet boşalması, sipariş takibi), kart reddi, havale, **istemci fiyat manipülasyonu** |
| `e2e/account.spec.ts` | Üyelik doğrulamaları, üye ol/çıkış/hatalı şifre/giriş, mükerrer üyelik, giriş yapmışken sipariş → Siparişlerim, müşterinin yönetime erişememesi |
| `e2e/admin.spec.ts` | Pano, kategori (ekle, ayrılmış adres, gizle), beden tablosu, ürün (yayın kuralı, görsel yükleme, varyant, mağazada görünüm), liste filtreleri ve kısayollar, sipariş durum akışı, kupon, ayarlar, e-posta önizleme |
| `security/authorization.spec.ts` | Yetkisiz yönetim/yükleme, cross-origin, cron anahtarı, sipariş IDOR, open redirect, hesap kilidi, XSS |
| `accessibility/accessibility.spec.ts` | axe-core ile WCAG 2.1 AA (kritik + ciddi ihlal olmamalı) |

Mobil (Pixel 7) projesi `smoke` ve `cart` testlerini ayrıca çalıştırır.

## Demo hesaplar

- Yönetici: `admin@ayseayhan.demo` / `AyseAyhan-Demo-2026`
- Müşteri: `musteri@ayseayhan.demo` / `AyseAyhan-Demo-2026`

## Kapsam dışı (ayrı test ortamı gerektirir)

Supabase RLS politikaları, gerçek iyzico sandbox callback/webhook, e-posta gönderimi. Bunlar için ayrı bir
Supabase test projesi + iyzico sandbox anahtarlarıyla `docs/QA-PROMPT.md` içindeki 2. bölümü kullanın.

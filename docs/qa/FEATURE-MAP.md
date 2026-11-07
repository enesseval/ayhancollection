# Özellik Haritası — Ayşe Ayhan Collection

> QA keşif çıktısı (Aşama A) · 2026-11-07 · Next.js 16.4.5 (App Router, Server Actions), React 19.3
> Veri sürücüsü: `src/lib/data/index.ts` → Supabase anahtarları yoksa bellek içi `demoRepo` (`src/lib/data/demo.ts`).

## 1. Sayfalar (`src/app`)

### Mağaza — `(shop)`
| Yol | Dosya | Amaç | Erişim |
|---|---|---|---|
| `/` | `(shop)/page.tsx` | Ana sayfa: vitrin, yeni gelenler, çok satanlar | Herkese açık |
| `/kategori/[slug]` | `(shop)/kategori/[slug]/page.tsx` | Kategori listesi + filtre çubuğu (`components/shop/filter-bar.tsx`); özel slug'lar: `yeni`, `cok-satanlar`, `indirim` | Herkese açık |
| `/urun/[slug]` | `(shop)/urun/[slug]/page.tsx` | Ürün detayı: galeri, renk/beden seçimi, beden tablosu (Markdown), JSON-LD | Herkese açık (yalnız `active` ürün) |
| `/arama` | `(shop)/arama/page.tsx` | Ürün arama (`?q=`) | Herkese açık |
| `/sepet` | `(shop)/sepet/page.tsx` | Sepet sayfası, kupon, sunucu tarafı yeniden fiyatlama | Herkese açık |
| `/hesabim` | `(shop)/hesabim/page.tsx` | Giriş / üye ol formları (oturum yoksa); siparişlerim (oturum varsa); `?next=` | Herkese açık |
| `/siparis-takip` | `(shop)/siparis-takip/page.tsx` | Sipariş no + e-posta ile sipariş bulma | Herkese açık |
| `/[page]` | `(shop)/[page]/page.tsx` | Statik bilgi/hukuk sayfaları (`dynamicParams=false`): `hakkimizda`, `iletisim`, `sss`, `kargo-teslimat`, `iade-degisim`, `kvkk`, `cerez-politikasi`, `mesafeli-satis-sozlesmesi`, `on-bilgilendirme-formu`, `uyelik-sozlesmesi` | Herkese açık |

### Ödeme — `(checkout)`
| Yol | Dosya | Amaç | Erişim |
|---|---|---|---|
| `/odeme` | `(checkout)/odeme/page.tsx` | Ödeme formu (adres, iletişim, kart/havale, sözleşme onayları); `?hata=odeme|limit|siparis` | Herkese açık (misafir sipariş) |
| `/odeme/demo` | `(checkout)/odeme/demo/page.tsx` | Demo 3D Secure (yalnız iyzico anahtarı yokken); `?o=<orderId>&t=<token>` | İmzalı token |
| `/odeme/sonuc` | `(checkout)/odeme/sonuc/page.tsx` | Sipariş sonucu; `?no=<orderNo>&t=<token>` | İmzalı token **veya** sipariş sahibi **veya** yönetici |

### Yönetim — `(admin)` (`/yonetim/*`)
Proxy (`src/proxy.ts`) yalnız çerez *varlığına* bakıp `/hesabim?next=` yönlendirmesi yapar; asıl yetki kontrolü `yonetim/layout.tsx` + her Server Action'da `requireAdmin()`.

| Yol | Amaç |
|---|---|
| `/yonetim` | Gösterge paneli (bugünkü siparişler, havale bekleyen, hazırlanacak, düşük stok) |
| `/yonetim/siparisler` | Sipariş listesi (durum filtresi, arama) |
| `/yonetim/siparisler/[id]` | Sipariş detayı: durum değiştir, havale onayla, kargo bilgisi |
| `/yonetim/urunler` | Ürün listesi: durum/stok/kategori filtresi, sıralama, satır kısayolları (yayınla/taslak/arşiv/kopyala/sil) |
| `/yonetim/urunler/[id]` | Ürün düzenleyici (`new` = yeni ürün): görseller, varyant matrisi, Markdown alanları, kaydedilmemiş değişiklik uyarısı |
| `/yonetim/kategoriler` | Kategori ağacı (2 seviye), sıralama |
| `/yonetim/beden-tablolari` | Beden tabloları (Markdown) |
| `/yonetim/kuponlar` | Kupon oluştur/düzenle |
| `/yonetim/ayarlar` | Kargo ücreti, ücretsiz kargo eşiği, WhatsApp, Instagram, duyuru, banka hesapları |
| `/yonetim/e-postalar` | E-posta şablon önizlemeleri |

### Diğer
`src/app/robots.ts`, `src/app/sitemap.ts`, kök `layout.tsx`.

## 2. Server Actions (`src/app/actions`)

| Dosya | Eylem | Yetki | Doğrulama / Notlar |
|---|---|---|---|
| `account.ts` | `loginAction` | Herkes | `loginSchema`; IP rate-limit (10/dk); e-posta başına 5 hata → 15 dk kilit; IP başına 20 hata → 15 dk; `safeNext()` açık yönlendirme koruması |
| | `registerAction` | Herkes | `registerSchema` (≥10 karakter, harf+rakam, KVKK onayı); 3/dk |
| | `logoutAction` | Herkes | Çerezi siler |
| | `lookupOrderAction` | Herkes | `AA-YYMM-XXXXX(X)` + e-posta; 10/10 dk; aynı hata mesajı (numaralandırma koruması) |
| `cart.ts` | `priceCartAction` | Herkes | `cartLineSchema` (uuid, int 1–10, en çok 30 satır); kupon 10/dk; fiyatlar sunucudan |
| `checkout.ts` | `placeOrder` | Herkes | `checkoutSchema`; 5/10 dk; Turnstile (anahtar varsa); sunucuda yeniden fiyatlama + stok rezervi (kart 15 dk, havale 24 sa) |
| | `demoPay` | İmzalı token | Yalnız iyzico yokken; `outcome=success|fail`; ret 5/10 dk |
| `admin.ts` | `saveProduct`, `archiveProduct`, `setProductStatus`, `deleteProduct`, `duplicateProduct`, `removeMedia`, `reorderMedia` | `requireAdmin()` | `productFormSchema`; yayına alma kuralı: ≥1 görsel + stoklu ≥1 varyant |
| | `setOrderStatus`, `setOrderTracking`, `confirmTransfer` | `requireAdmin()` | Durum değeri enum ile sınırlı; geçişler `src/lib/order-status.ts` kurallarıyla sunucuda denetlenir (M-2 düzeltildi) |
| | `saveCoupon` | `requireAdmin()` | `couponFormSchema`, yüzde ≤ 100 |
| | `saveSettings` | `requireAdmin()` | IBAN/WhatsApp biçim kontrolü |
| | `saveSizeChart`, `deleteSizeChart` | `requireAdmin()` | ≤ 8000 karakter Markdown |
| | `saveCategory`, `deleteCategory`, `moveCategory` | `requireAdmin()` | 2 seviye sınırı, ayrılmış slug'lar |

## 3. API uç noktaları (`src/app/api`)

| Yöntem + yol | Amaç | Koruma |
|---|---|---|
| `POST /api/admin/upload` | Ürün görseli yükleme (multipart: `file`, `productId`, `color`, `alt`, `focalX/Y`) | `assertSameOrigin()` (Origin = Host) + `requireAdmin()` + 60/10 dk; ≤ 4 MB; MIME listesi; `sharp` ile içerik çözümleme; ürün başına ≤ 12 görsel |
| `GET /api/media/[...key]` | Demo modda bellekteki görselleri sunar | Sıkı regex yol doğrulaması, `nosniff` |
| `GET /api/cron/release-reservations` | Süresi dolan stok rezervlerini serbest bırakır | `CRON_SECRET` |
| `POST /api/payments/iyzico/callback` | iyzico Checkout Form dönüşü | iyzico token doğrulaması |
| `POST /api/payments/iyzico/webhook` | iyzico webhook | İmza doğrulaması |

## 4. Ortak altyapı (`src/lib`)
- `auth.ts` — demo modda HS256 imzalı HttpOnly `aac_session` çerezi (yönetici 8 sa, müşteri 14 gün); scrypt parola özeti; Supabase modunda Supabase Auth.
- `order-access.ts` — sipariş erişimi: `t` = HMAC-SHA256(`order:<id>`) ilk 22 karakter; demo modda son sipariş imzalı `aac_last_order` çerezinde.
- `pricing.ts` — tek fiyat kaynağı; satır başına ≤ 10 adet, stokla sınırlama, kupon kuralları.
- `rate-limit.ts` — Upstash yoksa süreç belleğinde kayan pencere; IP = `x-forwarded-for` ilk değeri.
- `login-throttle.ts` — e-posta/IP hata sayaçları.
- `validation.ts` — tüm zod şemaları.
- `components/markdown.tsx` — `react-markdown` (+gfm, breaks), ham HTML kapalı, `img` yasak.
- İstemci sepeti: `components/cart/store.ts` (zustand, `localStorage["aac-cart-v1"]`, yalnız görüntüleme amaçlı fiyatlar).

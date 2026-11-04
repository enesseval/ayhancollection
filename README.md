# Ayşe Ayhan Collection — E-ticaret sitesi

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase · iyzico · Cloudflare R2

Site, hiçbir anahtar girilmeden **demo modda** tam çalışır: örnek ürünler, sepet, kupon, demo 3D Secure ödeme, havale, sipariş takibi, müşteri hesabı ve yönetim paneli. Her entegrasyonun anahtarı Vercel'e girildiği anda gerçek servise geçer; kod değişikliği gerekmez.

| Entegrasyon | Anahtar yokken | Anahtar girilince |
| --- | --- | --- |
| Supabase | Bellek içi demo veri (sunucu yeniden başlayınca sıfırlanır) | Kalıcı Postgres + Supabase Auth + RLS |
| iyzico | Demo 3D Secure ekranı | iyzico Checkout Form (3DS, taksit) + webhook |
| Görsel deposu | Supabase yoksa sunucu belleğinde (geçici) | Supabase Storage `media` bucket'ı (varsayılan) veya R2 anahtarları girilirse Cloudflare R2 |
| Resend | E-postalar sunucu loguna yazılır | Sipariş e-postaları gönderilir |
| Upstash | Bellek içi rate limit | Dağıtık rate limit |
| Turnstile | Kapalı | Ödeme formunda bot koruması |

## Demo hesaplar

- Yönetici: `admin@ayseayhan.demo` · şifre: `AyseAyhan-Demo-2026` (veya `DEMO_ADMIN_PASSWORD`)
- Müşteri: `musteri@ayseayhan.demo` · aynı şifre
- Kupon kodları: `HOSGELDIN10` (500 TL üzeri %10), `KIS150` (1.500 TL üzeri 150 TL)

## Vercel'e deploy

```bash
npm i -g vercel        # bir kez
vercel login           # bir kez
vercel link            # projeyi oluştur / bağla
vercel env add SESSION_SECRET production      # openssl rand -hex 32 çıktısını yapıştırın
vercel env add NEXT_PUBLIC_SITE_URL production # ör. https://ayse-ayhan-collection.vercel.app
vercel --prod
```

Ya da GitHub'a yükleyip vercel.com → Add New → Project → repo'yu seçin, `SESSION_SECRET` ve `NEXT_PUBLIC_SITE_URL` değişkenlerini girip Deploy'a basın.

> Not: Vercel Hobby planı ticari kullanıma kapalıdır. Test için yeterli; gerçek satışa geçerken Pro plan gerekir.

## Supabase'i bağlama (yeni hesap açıldıktan sonra)

1. Supabase'te yeni proje oluşturun (bölge: Frankfurt `eu-central-1`).
2. SQL Editor'de sırasıyla çalıştırın: `supabase/migrations/` içindeki dosyalar (tarih sırasıyla), ardından `supabase/seed.sql`.
3. Authentication → Hooks yerine en basit yol: yönetici kullanıcıyı Authentication → Users'tan oluşturun, sonra SQL Editor'de
   `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = 'sizin@eposta.com';`
4. Project Settings → API'den URL, anon key ve service_role key'i Vercel ortam değişkenlerine ekleyip yeniden deploy edin.
5. İlk yönetici girişinde iki adımlı doğrulama (TOTP) kurulumu istenir.
6. İsteğe bağlı: Database → Extensions'tan `pg_cron` açıp migration dosyasının sonundaki zamanlanmış görevleri çalıştırın.

## iyzico

Sandbox: sandbox-merchant.iyzipay.com → Ayarlar → API anahtarları. Webhook URL'si: `https://<site>/api/payments/iyzico/webhook` (Ayarlar → Firma Ayarları → İşyeri Bildirimleri). İmza doğrulaması (`X-IYZ-SIGNATURE-V3`) için entegrasyon@iyzico.com'dan hesabınızda webhook imzasını aktive ettirin.

## Görsel boru hattı (ücretsiz kotayı korur)

- Admin, tarayıcıda 2000 px / JPEG %85'e ön sıkıştırılmış görseli yükler (Vercel 4,5 MB gövde limiti).
- Sunucu `sharp` ile EXIF'i siler, 4:5 kırpar, 240/480/960/1600 px WebP (q72) ve ~30 byte ThumbHash üretir.
- Dosyalar Supabase Storage'a (R2 tanımlıysa R2'ye) içerik hash'li adla, `immutable` önbellekle yazılır. Veritabanına yalnız anahtar + boyut + thumbhash gider.
- `next/image` özel loader ile hazır boyutları sunar: **Vercel görsel dönüşümü sıfır**.
- Demo ürün görselleri `node scripts/generate-seed-media.ts` ile aynı hattan üretilir (20 ürün ≈ 2 MB).

## Güvenlik özeti

- Fiyat, indirim, kargo ve stok yalnız sunucuda hesaplanır; Supabase'te `create_order` fonksiyonu fiyatları yeniden doğrular, stoku `FOR UPDATE` ile kilitler.
- Ödeme sonucu iyzico'dan sunucudan sunucuya sorgulanır; tutar/sipariş/para birimi eşleşmesi kontrol edilir; webhook HMAC imzalı ve idempotent.
- Tüm tablolarda RLS; anon kullanıcı sipariş, ödeme ve kupon tablolarını okuyamaz; kritik fonksiyonlar yalnız `service_role`.
- Sipariş sayfaları imzalı erişim anahtarı veya sahiplik ile açılır (IDOR yok); sipariş numaraları tahmin edilemez.
- CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy başlıkları; HttpOnly + SameSite oturum çerezleri.
- Giriş, kayıt, kupon, ödeme, sipariş sorgulama ve görsel yükleme rate-limit'li; açık yönlendirme koruması.
- Yönetici işlemleri her Server Action'da ayrıca yetkilendirilir ve işlem kaydına yazılır.
- KVKK çerez paneli: zorunlu olmayan çerezler onaydan önce yüklenmez.

## Geliştirme

```bash
npm install
cp .env.example .env.local   # SESSION_SECRET doldurun
npm run dev
```

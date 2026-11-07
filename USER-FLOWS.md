# Kullanıcı Akışları — Ayşe Ayhan Collection

> QA keşif çıktısı (Aşama A) · 2026-11-07 · Demo hesaplar: `admin@ayseayhan.demo`, `musteri@ayseayhan.demo` / `AyseAyhan-Demo-2026`

## F1 — Kartla satın alma (misafir veya üye)
1. `/` veya `/kategori/[slug]` veya `/arama?q=` → ürün kartı
2. `/urun/[slug]` → renk seç → beden seç → **Sepete ekle** (sepet çekmecesi açılır)
3. `/sepet` → adet değiştir / kupon gir (`priceCartAction` sunucuda yeniden fiyatlar)
4. `/odeme` → e-posta, ad soyad, telefon, il/ilçe/adres, ödeme yöntemi **Kart**, sözleşme + KVKK onayı → `placeOrder`
5. Demo: `/odeme/demo?o=…&t=…` → **Ödemeyi onayla** → `/odeme/sonuc?no=…&t=…` (durum `paid`, sepet temizlenir)
6. Ret: **Kart reddedildi** → sipariş `cancelled`, stok + kupon kullanımı geri alınır → `/odeme?hata=odeme`

## F2 — Havale/EFT siparişi ve yönetim yaşam döngüsü
1. F1 adım 1–4, ödeme yöntemi **Havale/EFT** → `/odeme/sonuc` (durum `awaiting_transfer`, banka hesapları gösterilir; rezerv 24 sa)
2. Yönetici `/yonetim/siparisler/[id]` → **Havaleyi onayla** (`confirmTransfer` → `paid`)
3. Durum → **Hazırlanıyor** (`preparing`)
4. Kargo firması + takip no → **Kargoya ver** (`setOrderTracking` → `shipped`)
5. Durum → **Teslim edildi** (`delivered`)
6. Müşteri `/siparis-takip` (no + e-posta) veya `/hesabim` üzerinden durumu görür

## F3 — Üyelik
1. `/hesabim` → **Üye ol**: ad soyad, e-posta, şifre (≥10, harf+rakam), KVKK onayı → oturum açılır
2. Çıkış → `/hesabim` → **Giriş yap** → `/hesabim` (müşteri) veya `/yonetim` (yönetici); `?next=` ile dönüş
3. Üyeyken verilen siparişler `/hesabim` altında listelenir (`userId` bağlanır)
4. 5 hatalı şifre → hesap 15 dk kilit

## F4 — Sipariş takibi (misafir)
`/siparis-takip` → `AA-YYMM-XXXXXX` + e-posta → `/odeme/sonuc?no=…&t=…`

## F5 — Yönetim: ürün
1. `/yonetim/urunler` → **Yeni ürün** → ad, adres (slug), kategori, fiyat, açıklama/kumaş/ölçü/bakım (Markdown) → varyant matrisi (renk × beden, SKU, stok, özel fiyat) → **Taslak kaydet**
2. Görsel ekle (`POST /api/admin/upload`) → renk eşle, sırala
3. Durum **Yayında** → kaydet (≥1 görsel + stoklu varyant şartı)
4. Listeden: kopyala (taslak, görselsiz), arşivle, sil (siparişte geçen ürün silinemez), filtrele/sırala
5. Kaydedilmemiş değişiklikle sayfadan ayrılma → uyarı

## F6 — Yönetim: katalog ayarları
- Kategoriler: ekle/düzenle/sil, üst kategori (≤2 seviye), yukarı/aşağı taşı
- Beden tabloları: Markdown tablo, ürüne bağla
- Kuponlar: kod, yüzde/sabit, alt limit, bitiş tarihi, kullanım limiti, aktif
- Ayarlar: kargo ücreti, ücretsiz kargo eşiği, duyuru şeridi, WhatsApp, Instagram, IBAN'lar

## Güvenlik sınırları (test edilen varsayımlar)
| Sınır | Beklenen |
|---|---|
| Müşteri → `/yonetim/*` | Erişim reddi / yönlendirme |
| Müşteri → `POST /api/admin/upload` | 403 |
| Başkasının sonuç sayfası (`t` yok / değiştirilmiş) | 404 |
| `localStorage` sepet fiyatı/adedi | Sunucu yok sayar, yeniden fiyatlar |
| `?next=//evil` / `/\evil` | Site içine düşer |
| Ürün metninde HTML/JS | Metin olarak görüntülenir |
| Son stok iki sekmeden | Yalnız biri başarılı |

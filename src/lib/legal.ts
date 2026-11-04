// Yasal ve bilgi sayfaları. METİNLER TASLAKTIR: yayından önce avukat ve mali müşavir tarafından
// gözden geçirilmeli; köşeli parantezli alanlar satıcı bilgileriyle doldurulmalıdır.

export type LegalPage = { title: string; description: string; sections: { h?: string; p?: string[]; ul?: string[] }[] };

const seller = "[Satıcı unvanı], [adres], [vergi dairesi / no], [MERSİS no], e-posta: [e-posta], tel: [telefon]";

export const LEGAL_PAGES: Record<string, LegalPage> = {
  hakkimizda: {
    title: "Hakkımızda",
    description: "Ayşe Ayhan Collection hakkında",
    sections: [
      {
        p: [
          "Ayşe Ayhan Collection; tesettür giyim, desenli eşarp ve şallar, kadın ve erkek pijama takımları ile günlük giyim ürünlerini “yüksek kalite, uygun fiyat” anlayışıyla sunan bir giyim markasıdır.",
          "Instagram'da başlayan yolculuğumuzu, siparişlerinizi daha hızlı ve güvenli alabilmek için bu siteye taşıdık. Türkiye'nin her yerine kargo gönderiyoruz.",
        ],
      },
    ],
  },
  iletisim: {
    title: "İletişim",
    description: "Bize ulaşın",
    sections: [
      { p: ["Sipariş, ürün ve beden sorularınız için WhatsApp hattımızdan veya Instagram DM üzerinden bize yazabilirsiniz. Mesajlarınıza mesai saatleri içinde dönüş yapıyoruz."] },
      { h: "Satıcı bilgileri", p: [seller] },
    ],
  },
  sss: {
    title: "Sıkça Sorulan Sorular",
    description: "Sipariş, kargo, iade ve ödeme hakkında sorular",
    sections: [
      { h: "Siparişim ne zaman kargoya verilir?", p: ["Siparişler ödeme onayından sonra 1-3 iş günü içinde kargoya verilir. Kargo takip numarası SMS ve e-posta ile iletilir."] },
      { h: "Kargo ücreti ne kadar?", p: ["1.500 TL ve üzeri siparişlerde kargo ücretsizdir. Altındaki siparişlerde kargo ücreti ödeme adımında gösterilir."] },
      { h: "Hangi ödeme yöntemlerini kullanabilirim?", p: ["Kredi/banka kartı (3D Secure, iyzico güvencesiyle, 3 ve 6 taksit seçenekleriyle) ve havale/EFT ile ödeme yapabilirsiniz."] },
      { h: "Üye olmadan sipariş verebilir miyim?", p: ["Evet. Misafir olarak sipariş verebilir, sipariş numaranız ve e-postanızla siparişinizi takip edebilirsiniz."] },
      { h: "İade nasıl yapılır?", p: ["Teslimattan itibaren 14 gün içinde, ürün kullanılmamış ve etiketi üzerinde olmak kaydıyla iade edebilirsiniz. Ayrıntılar İade ve Değişim sayfasındadır."] },
      { h: "Bedenimi nasıl seçerim?", p: ["Her ürün sayfasında beden tablosu bulunur. İki beden arasında kalırsanız bir büyük bedeni öneririz; dilerseniz WhatsApp'tan bize danışabilirsiniz."] },
    ],
  },
  "kargo-teslimat": {
    title: "Kargo ve Teslimat",
    description: "Kargo süreleri ve ücretleri",
    sections: [
      {
        ul: [
          "Siparişler ödeme onayından sonra 1-3 iş günü içinde kargoya teslim edilir.",
          "Türkiye'nin tüm illerine gönderim yapılır; teslimat süresi bölgeye göre genellikle 1-4 iş günüdür.",
          "1.500 TL ve üzeri siparişlerde kargo ücretsizdir.",
          "Kargo teslimatında paketi kontrol etmenizi, hasarlı ise tutanak tutturmanızı rica ederiz.",
        ],
      },
    ],
  },
  "iade-degisim": {
    title: "İade ve Değişim Koşulları",
    description: "14 gün içinde iade",
    sections: [
      {
        p: ["6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca, ürünü teslim aldığınız tarihten itibaren 14 gün içinde herhangi bir gerekçe göstermeden cayma hakkınızı kullanabilirsiniz."],
      },
      {
        h: "Koşullar",
        ul: [
          "Ürün kullanılmamış, yıkanmamış ve etiketi üzerinde olmalıdır.",
          "Hijyen nedeniyle ambalajı açılmış iç giyim ürünlerinde cayma hakkı kullanılamaz (yönetmelikteki istisnalar).",
          "İade talebinizi Hesabım > Siparişlerim üzerinden veya WhatsApp hattımızdan iletebilirsiniz.",
          "Kartla yapılan ödemelerin iadesi aynı karta, havale ödemelerinin iadesi bildireceğiniz IBAN'a 14 gün içinde yapılır.",
        ],
      },
    ],
  },
  kvkk: {
    title: "KVKK Aydınlatma Metni",
    description: "Kişisel verilerin işlenmesine ilişkin aydınlatma metni",
    sections: [
      { p: ["Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu sıfatıyla " + seller + " tarafından hazırlanmıştır. (TASLAK)"] },
      { h: "İşlenen kişisel veriler", ul: ["Kimlik ve iletişim: ad soyad, e-posta, telefon", "Teslimat: adres bilgileri", "İşlem: sipariş içeriği, ödeme durumu (kart bilgileri tarafımızca işlenmez; ödeme kuruluşu iyzico tarafından işlenir)", "İşlem güvenliği: IP adresi, onay kayıtları"] },
      { h: "Amaçlar ve hukuki sebepler", p: ["Verileriniz; sözleşmenin kurulması ve ifası (KVKK m.5/2-c), hukuki yükümlülüklerin yerine getirilmesi (m.5/2-ç) ve meşru menfaat (m.5/2-f) hukuki sebeplerine dayanarak sipariş, teslimat, fatura, müşteri hizmetleri ve dolandırıcılık önleme amaçlarıyla işlenir. Ticari elektronik ileti gönderimi yalnızca açık rızanızla yapılır."] },
      { h: "Aktarım", p: ["Verileriniz; kargo şirketleri, ödeme kuruluşu, e-fatura entegratörü ile barındırma ve altyapı hizmet sağlayıcılarına (sunucuları yurt dışında bulunabilen bulut hizmetleri dahil, KVKK m.9 kapsamında) hizmetin gerektirdiği ölçüde aktarılabilir."] },
      { h: "Haklarınız", p: ["KVKK m.11 kapsamındaki haklarınız için [e-posta] adresine başvurabilirsiniz."] },
    ],
  },
  "cerez-politikasi": {
    title: "Gizlilik ve Çerez Politikası",
    description: "Çerez kullanımı",
    sections: [
      { p: ["Sitemizde zorunlu çerezler (oturum, sepet, güvenlik) her zaman kullanılır. Analitik ve pazarlama çerezleri yalnızca çerez panelinden onay vermeniz halinde etkinleşir. Tercihlerinizi tarayıcınızın yerel depolamasını temizleyerek değiştirebilirsiniz."] },
      { h: "Çerez türleri", ul: ["Zorunlu: oturum (aac_session), sepet (yerel depolama), güvenlik", "Analitik (onaylı): ziyaret istatistikleri", "Pazarlama (onaylı): reklam ölçümü"] },
    ],
  },
  "mesafeli-satis-sozlesmesi": {
    title: "Mesafeli Satış Sözleşmesi",
    description: "Mesafeli satış sözleşmesi (taslak)",
    sections: [
      { h: "1. Taraflar", p: ["SATICI: " + seller, "ALICI: Sipariş formunda bilgileri yer alan kişi."] },
      { h: "2. Konu", p: ["İşbu sözleşmenin konusu, ALICI'nın SATICI'ya ait internet sitesinden elektronik ortamda siparişini verdiği ürünlerin satışı ve teslimine ilişkin olarak 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin belirlenmesidir."] },
      { h: "3. Ürün, fiyat ve ödeme", p: ["Ürünlerin cinsi, miktarı, KDV dahil satış fiyatı, kargo ücreti ve ödeme şekli sipariş özetinde ve ön bilgilendirme formunda belirtildiği gibidir."] },
      { h: "4. Teslimat", p: ["Ürünler en geç 30 gün içinde ALICI'nın bildirdiği adrese teslim edilir."] },
      { h: "5. Cayma hakkı", p: ["ALICI, teslimden itibaren 14 gün içinde cayma hakkına sahiptir. Cayma bildirimi yazılı olarak veya sitedeki iade talep formu ile yapılabilir."] },
      { h: "6. Uyuşmazlık", p: ["Uyuşmazlıklarda Ticaret Bakanlığınca ilan edilen değere kadar Tüketici Hakem Heyetleri, üzerindeki uyuşmazlıklarda Tüketici Mahkemeleri yetkilidir."] },
    ],
  },
  "on-bilgilendirme-formu": {
    title: "Ön Bilgilendirme Formu",
    description: "Ön bilgilendirme formu (taslak)",
    sections: [
      { p: ["SATICI: " + seller] },
      { p: ["Ürünün temel nitelikleri, KDV dahil toplam fiyatı, ödeme ve teslimat bilgileri sipariş özetinde yer alır. ALICI, teslimden itibaren 14 gün içinde cayma hakkına sahiptir. Siparişin onaylanmasıyla ALICI ödeme yükümlülüğü altına girdiğini kabul eder."] },
    ],
  },
  "uyelik-sozlesmesi": {
    title: "Üyelik Sözleşmesi",
    description: "Üyelik koşulları (taslak)",
    sections: [{ p: ["Üye, kayıt sırasında verdiği bilgilerin doğruluğundan ve hesap güvenliğinden sorumludur. Üyelik dilediği zaman Hesabım sayfasından veya talep ile sonlandırılabilir."] }],
  },
};

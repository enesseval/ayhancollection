import { z } from "zod";

// Zod'un varsayılan (İngilizce / teknik) hata mesajları yerine kullanıcı dostu Türkçe mesajlar.
// Şemada özel mesaj verilen kurallar bundan etkilenmez.
const tr = z.locales.tr();

z.config({
  localeError: (iss) => {
    switch (iss.code) {
      case "too_big":
        if (iss.origin === "string") return `En fazla ${iss.maximum} karakter girebilirsiniz.`;
        if (iss.origin === "number") return `En fazla ${iss.maximum} olabilir.`;
        if (iss.origin === "array") return `En fazla ${iss.maximum} öğe eklenebilir.`;
        break;
      case "too_small":
        if (iss.origin === "string") return Number(iss.minimum) <= 1 ? "Bu alan zorunlu." : `En az ${iss.minimum} karakter olmalı.`;
        if (iss.origin === "number") return iss.inclusive ? `En az ${iss.minimum} olmalı.` : `${iss.minimum}'dan büyük olmalı.`;
        if (iss.origin === "array") return `En az ${iss.minimum} öğe eklenmeli.`;
        break;
      case "invalid_type":
        if (iss.expected === "int") return "Tam sayı girin.";
        if (iss.expected === "number") return "Geçerli bir sayı girin.";
        return "Bu alan zorunlu.";
      case "invalid_format":
        if (iss.format === "email") return "Geçerli bir e-posta girin.";
        if (iss.format === "uuid") return "Geçersiz kayıt.";
        return "Geçersiz biçim.";
      case "invalid_value":
        return "Geçersiz seçim.";
      case "not_multiple_of":
        return "Geçersiz değer.";
    }
    return tr.localeError(iss);
  },
});

export {};

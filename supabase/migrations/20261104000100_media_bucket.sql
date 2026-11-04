-- Ürün görselleri: herkese açık okuma (public URL), yazma yalnız sunucudaki service role ile.
-- Yalnız WebP ve dosya başına en fazla 2 MB (boru hattı 1600 px WebP üretir, tipik 150-400 KB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 2097152, array['image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- storage.objects için anon/authenticated yazma politikası BİLEREK eklenmedi.

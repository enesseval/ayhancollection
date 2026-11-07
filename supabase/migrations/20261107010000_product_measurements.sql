-- Ürün ölçüleri kumaş bilgisinden ayrı bir alanda tutulur
alter table public.products add column if not exists measurements text not null default '' check (char_length(measurements) <= 4000);

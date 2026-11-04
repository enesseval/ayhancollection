-- Ayşe Ayhan Collection — ilk şema
-- Tüm para tutarları kuruş cinsinden integer. Tüm tablolarda RLS açık.
-- Sipariş/ödeme yazma işlemleri yalnızca sunucudaki service role ile, aşağıdaki
-- SECURITY DEFINER fonksiyonları üzerinden yapılır.

-- gen_random_uuid() Postgres 13+ çekirdeğinde; ek eklenti gerekmez.

-- ───────────────────────── Yardımcılar ─────────────────────────
create or replace function public.is_admin()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

-- ───────────────────────── Profil ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  marketing_consent boolean not null default false,
  kvkk_consent_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Katalog ─────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null,
  description text,
  sort int not null default 0,
  is_active boolean not null default true
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (char_length(name) between 2 and 140),
  description text not null default '',
  fabric text not null default '',
  care text not null default '',
  category_id uuid not null references public.categories(id),
  base_price int not null check (base_price >= 0),
  compare_at_price int check (compare_at_price is null or compare_at_price >= 0),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  is_new boolean not null default false,
  is_bestseller boolean not null default false,
  vat_rate int not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products(category_id) where status = 'active';
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_key text not null,           -- dosya R2'de; DB'de yalnız anahtar
  width int not null,
  height int not null,
  thumbhash text check (thumbhash is null or char_length(thumbhash) <= 64),
  alt text not null default '',
  color text,
  sort int not null default 0
);
create index product_media_product_idx on public.product_media(product_id, sort);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  size text not null,
  color text not null,
  color_hex text not null default '#000000' check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  stock int not null default 0 check (stock >= 0),
  price_override int check (price_override is null or price_override >= 0)
);
create index product_variants_product_idx on public.product_variants(product_id);

-- ───────────────────────── Kampanya & ayarlar ─────────────────────────
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9]{3,24}$'),
  type text not null check (type in ('percent','fixed')),
  value int not null check (value > 0),
  min_subtotal int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int,
  used_count int not null default 0,
  active boolean not null default true,
  check (type <> 'percent' or value <= 100)
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null
);

-- ───────────────────────── Sipariş ─────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  phone text not null,
  status text not null check (status in ('pending_payment','awaiting_transfer','paid','preparing','shipped','delivered','cancelled','refunded')),
  payment_method text not null check (payment_method in ('card','transfer')),
  subtotal int not null check (subtotal >= 0),
  discount int not null default 0 check (discount >= 0),
  shipping int not null default 0 check (shipping >= 0),
  total int not null check (total >= 0),
  coupon_code text,
  shipping_address jsonb not null,
  note text,
  carrier text,
  tracking_no text,
  consents jsonb not null,
  utm jsonb,
  payment_token text,
  reservation_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders(user_id);
create index orders_email_idx on public.orders(lower(email));
create index orders_status_idx on public.orders(status, created_at desc);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_id uuid,
  product_name text not null,
  product_slug text not null,
  sku text not null,
  size text not null,
  color text not null,
  unit_price int not null check (unit_price >= 0),
  qty int not null check (qty between 1 and 20),
  image_key text
);
create index order_items_order_idx on public.order_items(order_id);

create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  qty int not null check (qty > 0),
  expires_at timestamptz not null
);
create index stock_reservations_exp_idx on public.stock_reservations(expires_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null check (provider in ('iyzico','demo','transfer')),
  payment_id text,
  status text not null check (status in ('init','success','failure')),
  amount int not null,
  installment int,
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index payments_provider_payment_uidx on public.payments(provider, payment_id) where payment_id is not null;

create table public.payment_events (
  id bigint generated always as identity primary key,
  provider_event_id text not null unique,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create table public.returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'requested' check (status in ('requested','approved','rejected','refunded')),
  reason text not null check (char_length(reason) <= 1000),
  items jsonb not null,
  refund_amount int,
  created_at timestamptz not null default now()
);

create table public.wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id text not null,
  action text not null,
  entity text not null,
  entity_id text not null,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_media enable row level security;
alter table public.product_variants enable row level security;
alter table public.coupons enable row level security;
alter table public.settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.returns enable row level security;
alter table public.wishlists enable row level security;
alter table public.audit_logs enable row level security;

-- Katalog: herkes aktif içeriği okur, admin her şeyi yönetir
create policy categories_read on public.categories for select using (is_active or public.is_admin());
create policy categories_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products for select using (status = 'active' or public.is_admin());
create policy products_admin on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy media_read on public.product_media for select using (
  public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy media_admin on public.product_media for all using (public.is_admin()) with check (public.is_admin());

create policy variants_read on public.product_variants for select using (
  public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy variants_admin on public.product_variants for all using (public.is_admin()) with check (public.is_admin());

-- Ayarlar herkese okunur (kargo ücreti vb.); IBAN bilgisi zaten müşteriye gösterilir
create policy settings_read on public.settings for select using (true);
create policy settings_admin on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- Kupon listesi ifşa edilmez; doğrulama sunucuda yapılır
create policy coupons_admin on public.coupons for all using (public.is_admin()) with check (public.is_admin());

-- Profil: yalnız kendi kaydı
create policy profiles_own_read on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_own_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Sipariş: müşteri yalnız kendi siparişini okur; yazma yok (service role + fonksiyonlar)
create policy orders_own_read on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy orders_admin_update on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy order_items_own_read on public.order_items for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

create policy returns_own_read on public.returns for select using (user_id = auth.uid() or public.is_admin());
create policy returns_own_insert on public.returns for insert with check (
  user_id = auth.uid() and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy returns_admin on public.returns for update using (public.is_admin()) with check (public.is_admin());

create policy wishlists_own on public.wishlists for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Yalnız admin okur, kimse istemciden yazamaz
create policy payments_admin_read on public.payments for select using (public.is_admin());
create policy payment_events_admin_read on public.payment_events for select using (public.is_admin());
create policy reservations_admin_read on public.stock_reservations for select using (public.is_admin());
create policy audit_admin_read on public.audit_logs for select using (public.is_admin());

-- Kullanıcı kendi rolünü değiştiremez: rol JWT app_metadata'da, profiles'ta rol kolonu yok.

-- ───────────────────────── Sipariş fonksiyonları ─────────────────────────
-- create_order: fiyatları DB'den yeniden doğrular, stok kilitler (FOR UPDATE), rezerv yazar.
create or replace function public.create_order(p jsonb)
returns table (order_id uuid, order_no text)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_item jsonb;
  v_variant record;
  v_subtotal int := 0;
  v_minutes int := coalesce((p ->> 'reservation_minutes')::int, 15);
  v_coupon record;
  v_status text;
begin
  if jsonb_array_length(p -> 'items') = 0 or jsonb_array_length(p -> 'items') > 30 then
    raise exception 'INVALID_ITEMS';
  end if;

  -- Değişkenleri id sırasıyla kilitle (deadlock önleme)
  for v_item in
    select value from jsonb_array_elements(p -> 'items') order by value ->> 'variant_id'
  loop
    select v.id, v.stock, coalesce(v.price_override, pr.base_price) as price, pr.status
      into v_variant
      from public.product_variants v
      join public.products pr on pr.id = v.product_id
     where v.id = (v_item ->> 'variant_id')::uuid
     for update of v;
    if not found or v_variant.status <> 'active' then
      raise exception 'OUT_OF_STOCK:%', v_item ->> 'variant_id';
    end if;
    if v_variant.stock < (v_item ->> 'qty')::int then
      raise exception 'OUT_OF_STOCK:%', v_item ->> 'variant_id';
    end if;
    if v_variant.price <> (v_item ->> 'unit_price')::int then
      raise exception 'PRICE_CHANGED:%', v_item ->> 'variant_id';
    end if;
    v_subtotal := v_subtotal + v_variant.price * (v_item ->> 'qty')::int;
  end loop;

  if v_subtotal <> (p ->> 'subtotal')::int then
    raise exception 'TOTAL_MISMATCH';
  end if;
  if (p ->> 'total')::int <> v_subtotal - (p ->> 'discount')::int + (p ->> 'shipping')::int then
    raise exception 'TOTAL_MISMATCH';
  end if;

  -- Kupon: atomik kullanım artışı
  if nullif(p ->> 'coupon_code', '') is not null then
    update public.coupons
       set used_count = used_count + 1
     where code = p ->> 'coupon_code'
       and active
       and (starts_at is null or starts_at <= now())
       and (ends_at is null or ends_at >= now())
       and (usage_limit is null or used_count < usage_limit)
       and min_subtotal <= v_subtotal
    returning * into v_coupon;
    if not found then raise exception 'COUPON_INVALID'; end if;
  end if;

  v_status := case when p ->> 'payment_method' = 'transfer' then 'awaiting_transfer' else 'pending_payment' end;

  insert into public.orders (id, order_no, user_id, email, phone, status, payment_method, subtotal, discount,
    shipping, total, coupon_code, shipping_address, note, consents, utm, reservation_expires_at)
  values (v_order_id, p ->> 'order_no', nullif(p ->> 'user_id', '')::uuid, lower(p ->> 'email'), p ->> 'phone',
    v_status, p ->> 'payment_method', v_subtotal, (p ->> 'discount')::int, (p ->> 'shipping')::int,
    (p ->> 'total')::int, nullif(p ->> 'coupon_code', ''), p -> 'shipping_address', nullif(p ->> 'note', ''),
    p -> 'consents', p -> 'utm', now() + make_interval(mins => v_minutes));

  insert into public.order_items (order_id, variant_id, product_id, product_name, product_slug, sku, size, color,
    unit_price, qty, image_key)
  select v_order_id, (i ->> 'variant_id')::uuid, (i ->> 'product_id')::uuid, i ->> 'product_name',
         i ->> 'product_slug', i ->> 'sku', i ->> 'size', i ->> 'color', (i ->> 'unit_price')::int,
         (i ->> 'qty')::int, i ->> 'image_key'
    from jsonb_array_elements(p -> 'items') i;

  update public.product_variants v
     set stock = v.stock - (i ->> 'qty')::int
    from jsonb_array_elements(p -> 'items') i
   where v.id = (i ->> 'variant_id')::uuid;

  insert into public.stock_reservations (order_id, variant_id, qty, expires_at)
  select v_order_id, (i ->> 'variant_id')::uuid, (i ->> 'qty')::int, now() + make_interval(mins => v_minutes)
    from jsonb_array_elements(p -> 'items') i;

  return query select v_order_id, p ->> 'order_no';
end; $$;

-- confirm_payment: tutar eşleşmesini kontrol eder, rezervi kesinleştirir. İdempotent.
create or replace function public.confirm_payment(p_order_id uuid, p_payment jsonb)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v_order record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return false; end if;
  if v_order.status in ('paid','preparing','shipped','delivered') then return true; end if;
  if v_order.status not in ('pending_payment','awaiting_transfer') then return false; end if;
  if (p_payment ->> 'amount')::int <> v_order.total then
    raise exception 'AMOUNT_MISMATCH';
  end if;

  insert into public.payments (order_id, provider, payment_id, status, amount, installment, card_last4, paid_at)
  values (p_order_id, p_payment ->> 'provider', nullif(p_payment ->> 'payment_id', ''), 'success',
          v_order.total, nullif(p_payment ->> 'installment', '')::int, nullif(p_payment ->> 'card_last4', ''), now())
  on conflict do nothing;

  delete from public.stock_reservations where order_id = p_order_id;
  update public.orders set status = 'paid', reservation_expires_at = null where id = p_order_id;
  return true;
end; $$;

-- fail_order: ödeme başarısız/süresi dolmuşsa stoku geri verir.
create or replace function public.fail_order(p_order_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_status text; v_coupon text;
begin
  select status, coupon_code into v_status, v_coupon from public.orders where id = p_order_id for update;
  if v_status is null or v_status not in ('pending_payment','awaiting_transfer') then return; end if;
  if v_coupon is not null then
    update public.coupons set used_count = greatest(used_count - 1, 0) where code = v_coupon;
  end if;
  update public.product_variants v
     set stock = v.stock + r.qty
    from public.stock_reservations r
   where r.order_id = p_order_id and v.id = r.variant_id;
  delete from public.stock_reservations where order_id = p_order_id;
  update public.orders
     set status = 'cancelled', note = concat_ws(' | ', note, 'Sistem: ' || left(p_reason, 200))
   where id = p_order_id;
end; $$;

create or replace function public.release_expired_reservations()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare r record; n int := 0;
begin
  for r in select distinct order_id from public.stock_reservations where expires_at < now() loop
    perform public.fail_order(r.order_id, 'Ödeme süresi doldu');
    n := n + 1;
  end loop;
  return n;
end; $$;

-- Bu fonksiyonları yalnız service role çağırabilir
revoke execute on function public.create_order(jsonb) from public, anon, authenticated;
revoke execute on function public.confirm_payment(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_order(uuid, text) from public, anon, authenticated;
revoke execute on function public.release_expired_reservations() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;
grant execute on function public.confirm_payment(uuid, jsonb) to service_role;
grant execute on function public.fail_order(uuid, text) to service_role;
grant execute on function public.release_expired_reservations() to service_role;

-- Not: Ücretsiz kotayı korumak için temizlik işleri (pg_cron etkinleştirildikten sonra):
-- select cron.schedule('release-reservations', '* * * * *', $$select public.release_expired_reservations()$$);
-- select cron.schedule('cleanup-events', '0 3 * * *', $$delete from public.payment_events where processed_at < now() - interval '90 days'$$);

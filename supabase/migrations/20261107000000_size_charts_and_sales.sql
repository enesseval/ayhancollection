-- Beden tabloları (yönetimden tanımlanır, ürüne isteğe bağlı bağlanır) + ürün satış adetleri
create table if not exists public.size_charts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  content text not null default '' check (char_length(content) <= 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.size_charts enable row level security;
create policy size_charts_read on public.size_charts for select using (true);
create policy size_charts_admin_write on public.size_charts for all using (public.is_admin()) with check (public.is_admin());

alter table public.products add column if not exists size_chart_id uuid references public.size_charts(id) on delete set null;
create index if not exists products_size_chart_idx on public.products(size_chart_id);

create or replace view public.product_sales with (security_invoker = true) as
select oi.product_id, sum(oi.qty)::int as sold
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.status in ('paid','preparing','shipped','delivered')
group by oi.product_id;
revoke all on public.product_sales from anon, authenticated;
grant select on public.product_sales to service_role;

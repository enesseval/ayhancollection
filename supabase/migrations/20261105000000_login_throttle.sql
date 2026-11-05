-- Giriş denemesi sınırlama / geçici hesap kilidi.
-- Sunucusuz ortamda bellek içi sayaç örnekler arasında paylaşılmadığı için sayaçlar veritabanında tutulur.
-- Yalnız service_role erişebilir (RLS açık, politika yok, anon/authenticated için EXECUTE yok).

create table if not exists public.auth_throttle (
  key          text primary key,           -- 'email:<adres>' veya 'ip:<adres>'
  fails        int not null default 0,
  first_at     timestamptz not null default now(),
  locked_until timestamptz
);
alter table public.auth_throttle enable row level security;
revoke all on public.auth_throttle from anon, authenticated;

-- Kilitliyse kalan saniyeyi, değilse 0 döndürür.
create or replace function public.auth_throttle_check(p_key text)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(
    (select greatest(0, ceil(extract(epoch from (locked_until - now()))))::int
       from public.auth_throttle where key = p_key and locked_until > now()),
    0);
$$;

-- Başarısız denemeyi kaydeder; eşik aşılırsa kilitler ve kilit süresini (sn) döndürür.
create or replace function public.auth_throttle_fail(p_key text, p_max int, p_window_sec int, p_lock_sec int)
returns int language plpgsql security definer set search_path = public as $$
declare r public.auth_throttle;
begin
  insert into public.auth_throttle as t (key, fails, first_at)
  values (p_key, 1, now())
  on conflict (key) do update set
    fails    = case when t.first_at < now() - make_interval(secs => p_window_sec) then 1 else t.fails + 1 end,
    first_at = case when t.first_at < now() - make_interval(secs => p_window_sec) then now() else t.first_at end
  returning * into r;

  if r.fails >= p_max then
    update public.auth_throttle set locked_until = now() + make_interval(secs => p_lock_sec), fails = 0, first_at = now()
    where key = p_key;
    insert into public.audit_logs (actor_id, action, entity, entity_id, diff)
    values ('system', 'login_locked', 'auth', p_key, jsonb_build_object('lock_sec', p_lock_sec));
    return p_lock_sec;
  end if;
  return 0;
end $$;

create or replace function public.auth_throttle_clear(p_key text)
returns void language sql security definer set search_path = public as $$
  delete from public.auth_throttle where key = p_key;
$$;

-- Eski kayıtları temizle (günlük cron çağırır)
create or replace function public.auth_throttle_prune()
returns void language sql security definer set search_path = public as $$
  delete from public.auth_throttle
  where coalesce(locked_until, first_at) < now() - interval '1 day';
$$;

revoke all on function public.auth_throttle_check(text) from public, anon, authenticated;
revoke all on function public.auth_throttle_fail(text, int, int, int) from public, anon, authenticated;
revoke all on function public.auth_throttle_clear(text) from public, anon, authenticated;
revoke all on function public.auth_throttle_prune() from public, anon, authenticated;
grant execute on function public.auth_throttle_check(text) to service_role;
grant execute on function public.auth_throttle_fail(text, int, int, int) to service_role;
grant execute on function public.auth_throttle_clear(text) to service_role;
grant execute on function public.auth_throttle_prune() to service_role;

-- Yönetici iptali: tek işlemde ve yalnız bir kez stok/kupon iadesi
--  * pending_payment / awaiting_transfer → mevcut fail_order (rezervasyonlar iade)
--  * paid / preparing → sipariş kalemlerindeki adetler stoğa, kupon kullanım hakkı geri
--  * diğer durumlar (kargolanmış, teslim edilmiş, iptal) → INVALID_TRANSITION
create or replace function public.admin_cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_status text; v_coupon text;
begin
  select status, coupon_code into v_status, v_coupon from public.orders where id = p_order_id for update;
  if v_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_status in ('pending_payment', 'awaiting_transfer') then
    perform public.fail_order(p_order_id, p_reason);
    return;
  end if;
  if v_status not in ('paid', 'preparing') then raise exception 'INVALID_TRANSITION'; end if;

  update public.product_variants v
     set stock = v.stock + i.qty
    from public.order_items i
   where i.order_id = p_order_id and i.variant_id is not null and v.id = i.variant_id;
  if v_coupon is not null then
    update public.coupons set used_count = greatest(used_count - 1, 0) where code = v_coupon;
  end if;
  update public.orders
     set status = 'cancelled', note = concat_ws(' | ', note, 'Yönetici: ' || left(p_reason, 200))
   where id = p_order_id;
end; $$;

revoke all on function public.admin_cancel_order(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_cancel_order(uuid, text) to service_role;

begin;
create table public.customer_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 first_name text not null default '' check(length(first_name)<=50),
 last_name text not null default '' check(length(last_name)<=50),
 phone text not null default '' check(phone='' or phone ~ '^\+?[0-9]{9,15}$'),
 region text not null default '' check(length(region)<=100),
 address text not null default '' check(length(address)<=500)
);
alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from public,anon,authenticated;
grant select,insert,update on public.customer_profiles to authenticated;
grant all on public.customer_profiles to service_role;
create policy customer_profile_read on public.customer_profiles for select to authenticated using(id=(select auth.uid()));
create policy customer_profile_insert on public.customer_profiles for insert to authenticated with check(id=(select auth.uid()));
create policy customer_profile_update on public.customer_profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create function private.create_customer_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.customer_profiles(id,first_name,last_name,phone)
 values(new.id,left(coalesce(new.raw_user_meta_data->>'first_name',''),50),left(coalesce(new.raw_user_meta_data->>'last_name',''),50),case when new.raw_user_meta_data->>'phone' ~ '^\+?[0-9]{9,15}$' then new.raw_user_meta_data->>'phone' else '' end);
 return new;
end;
$$;
revoke all on function private.create_customer_profile() from public,anon,authenticated;
create trigger customer_profile_created after insert on auth.users for each row execute function private.create_customer_profile();
insert into public.customer_profiles(id,first_name,last_name,phone)
select id,left(coalesce(raw_user_meta_data->>'first_name',''),50),left(coalesce(raw_user_meta_data->>'last_name',''),50),case when raw_user_meta_data->>'phone' ~ '^\+?[0-9]{9,15}$' then raw_user_meta_data->>'phone' else '' end from auth.users on conflict(id) do nothing;
alter table public.orders add column customer_id uuid references auth.users(id) on delete set null;
alter table public.orders add column customer_email text check(length(customer_email)<=254);
create index orders_customer on public.orders(customer_id,created_at desc);
create policy orders_customer_read on public.orders for select to authenticated using(customer_id=(select auth.uid()));
create policy order_items_customer_read on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.customer_id=(select auth.uid())));
-- Only the service-role checkout function can write the verified identity.
create or replace function public.create_order(p_customer jsonb,p_items jsonb,p_payment text,p_months integer,p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing public.orders%rowtype; product public.products%rowtype; item jsonb; qty integer; unit bigint; cash_total bigint:=0; total bigint; monthly bigint:=0; order_id uuid;
begin
  if p_token is null then raise exception 'Buyurtma kaliti kerak.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_token::text,0));
  select * into existing from public.orders where checkout_token=p_token;
  if found then
    if existing.customer_id is distinct from nullif(p_customer->>'_account_id','')::uuid then raise exception 'Buyurtma boshqa hisobga tegishli.'; end if;
    return jsonb_build_object('id',existing.id,'total',existing.total_amount,'monthly',existing.monthly_payment,'months',existing.installment_months); end if;
  if p_payment not in ('cash','installment') or p_payment is null then raise exception 'To‘lov turi noto‘g‘ri.'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Savat noto‘g‘ri.'; end if;
  if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Savat hajmi noto‘g‘ri.'; end if;
  if (select count(distinct (value->>'id')::bigint) from jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) then raise exception 'Savatda takror mahsulot bor.'; end if;
  -- Stable lock order prevents deadlocks between two overlapping carts.
  for item in select value from jsonb_array_elements(p_items) order by (value->>'id')::bigint loop
    qty := (item->>'quantity')::integer;
    if qty is null or qty not between 1 and 99 then raise exception 'Mahsulot soni noto‘g‘ri.'; end if;
    select * into product from public.products where id=(item->>'id')::bigint for update;
    if not found or not product.is_active or product.stock_quantity<qty or not exists(select 1 from public.categories where id=product.category_id and is_active) then raise exception 'Mahsulot mavjudligi o‘zgardi. Savatni yangilang.'; end if;
    if p_payment='installment' and not product.installment_enabled then raise exception 'Mahsulot uchun faqat naqd to‘lov mavjud.'; end if;
    cash_total := cash_total + coalesce(product.discount_price,product.cash_price)*qty;
  end loop;
  total := cash_total;
  if p_payment='installment' then total:=private.installment_total(cash_total,p_months); monthly:=round(total::numeric/p_months)::bigint; end if;
  insert into public.orders(customer_id,customer_email,checkout_token,customer_name,phone,region,address,comment,payment_type,installment_months,monthly_payment,total_amount)
  values(nullif(p_customer->>'_account_id','')::uuid,nullif(trim(p_customer->>'email'),''),p_token,trim(p_customer->>'name'),regexp_replace(p_customer->>'phone','[^0-9+]','','g'),trim(p_customer->>'region'),trim(p_customer->>'address'),coalesce(p_customer->>'comment',''),p_payment,case when p_payment='installment' then p_months else null end,monthly,total) returning id into order_id;
  for item in select value from jsonb_array_elements(p_items) order by (value->>'id')::bigint loop
    select * into product from public.products where id=(item->>'id')::bigint;
    qty:=(item->>'quantity')::integer; unit:=coalesce(product.discount_price,product.cash_price);
    insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,total_price) values(order_id,product.id,product.name,qty,unit,unit*qty);
  end loop;
  return jsonb_build_object('id',order_id,'total',total,'monthly',monthly,'months',case when p_payment='installment' then p_months else 0 end);
end;
$$;
revoke all on function public.create_order(jsonb,jsonb,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.create_order(jsonb,jsonb,text,integer,uuid) to service_role;
commit;

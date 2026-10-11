-- Run ONLY customer-account-migration.sql in the existing project SQL Editor.
-- Do not paste database.sql before/after this file: private.admins already exists.
-- Existing admin tables, functions, policies and grants are deliberately retained.
-- Preserves data and legacy id/address fields. Safe to rerun.
begin;
do $$ begin
 if to_regclass('public.orders') is null or to_regclass('public.products') is null
    or to_regprocedure('public.is_admin()') is null then
  raise exception 'ZAVO bazaviy jadvallari va is_admin() funksiyasi kerak. Migratsiya bajarilmadi.';
 end if;
end $$;
create schema if not exists private;
create table if not exists public.customer_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 id uuid unique references auth.users(id) on delete cascade,
 first_name text not null default '' check(length(first_name)<=50),
 last_name text not null default '' check(length(last_name)<=50),
 phone text not null default '' check(phone='' or phone ~ '^\+?[0-9]{9,15}$'),
 email text not null default '' check(length(email)<=254),
 delivery_address text not null default '' check(length(delivery_address)<=500),
 address text not null default '',
 region text not null default '' check(length(region)<=100),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.customer_profiles add column if not exists user_id uuid;
alter table public.customer_profiles add column if not exists id uuid;
alter table public.customer_profiles add column if not exists first_name text not null default '';
alter table public.customer_profiles add column if not exists last_name text not null default '';
alter table public.customer_profiles add column if not exists phone text not null default '';
alter table public.customer_profiles add column if not exists email text not null default '';
alter table public.customer_profiles add column if not exists delivery_address text not null default '';
alter table public.customer_profiles add column if not exists address text not null default '';
alter table public.customer_profiles add column if not exists region text not null default '';
alter table public.customer_profiles add column if not exists created_at timestamptz;
alter table public.customer_profiles add column if not exists updated_at timestamptz;
-- Backfill from existing profile records; never infer ownership from email/phone.
update public.customer_profiles set user_id=coalesce(user_id,id),id=coalesce(id,user_id),
 delivery_address=coalesce(nullif(delivery_address,''),address,''),
 address=coalesce(nullif(delivery_address,''),address,'')
 where user_id is null or id is null
 or delivery_address is distinct from coalesce(nullif(delivery_address,''),address,'')
 or address is distinct from coalesce(nullif(delivery_address,''),address,'');
update public.customer_profiles p set email=coalesce(u.email,''),
 created_at=coalesce(p.created_at,u.created_at,now()),updated_at=coalesce(p.updated_at,p.created_at,u.created_at,now())
 from auth.users u where u.id=p.user_id
 and (p.email is distinct from coalesce(u.email,'') or p.created_at is null or p.updated_at is null);
alter table public.customer_profiles alter column user_id set not null;
alter table public.customer_profiles alter column id set not null;
alter table public.customer_profiles alter column created_at set default now();
alter table public.customer_profiles alter column created_at set not null;
alter table public.customer_profiles alter column updated_at set default now();
alter table public.customer_profiles alter column updated_at set not null;
create unique index if not exists zavo_profile_user_id on public.customer_profiles(user_id);
create unique index if not exists zavo_profile_legacy_id on public.customer_profiles(id);
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.customer_profiles'::regclass and conname='zavo_profile_user_fk') then
  alter table public.customer_profiles add constraint zavo_profile_user_fk foreign key(user_id) references auth.users(id) on delete cascade;
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.customer_profiles'::regclass and conname='zavo_profile_ids_match') then
  alter table public.customer_profiles add constraint zavo_profile_ids_match check(id=user_id);
 end if;
end $$;
create or replace function private.zavo_profile_sync() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.user_id:=coalesce(new.user_id,new.id);new.id:=coalesce(new.id,new.user_id);
  new.delivery_address:=coalesce(nullif(new.delivery_address,''),new.address,'');
  new.address:=new.delivery_address;new.created_at:=now();
 else
  if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
   raise exception 'Profil egasini o‘zgartirish mumkin emas.' using errcode='42501';
  end if;
  if new.delivery_address is distinct from old.delivery_address then new.address:=new.delivery_address;
  elsif new.address is distinct from old.address then new.delivery_address:=new.address;end if;
  new.created_at:=old.created_at;
 end if;
 new.first_name:=coalesce(new.first_name,'');new.last_name:=coalesce(new.last_name,'');
 new.phone:=coalesce(new.phone,'');new.region:=coalesce(new.region,'');
 if length(new.first_name)>50 or length(new.last_name)>50 or length(new.region)>100
    or length(new.delivery_address)>500 or (new.phone<>'' and new.phone !~ '^\+?[0-9]{9,15}$') then
  raise exception 'Profil ma’lumotlari noto‘g‘ri.';
 end if;
 -- Email is a server-maintained copy of the confirmed Auth email.
 select coalesce(u.email,'') into new.email from auth.users u where u.id=new.user_id;
 new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function private.zavo_profile_sync() from public,anon,authenticated;
drop trigger if exists zavo_profile_sync on public.customer_profiles;
create trigger zavo_profile_sync before insert or update on public.customer_profiles
 for each row execute function private.zavo_profile_sync();
create or replace function private.create_customer_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.customer_profiles(user_id,id,first_name,last_name,phone)
 values(new.id,new.id,left(coalesce(new.raw_user_meta_data->>'first_name',''),50),
 left(coalesce(new.raw_user_meta_data->>'last_name',''),50),
 case when new.raw_user_meta_data->>'phone' ~ '^\+?[0-9]{9,15}$' then new.raw_user_meta_data->>'phone' else '' end)
 on conflict(user_id) do nothing;
 return new;
end $$;
revoke all on function private.create_customer_profile() from public,anon,authenticated;
drop trigger if exists customer_profile_created on auth.users;
create trigger customer_profile_created after insert on auth.users for each row execute function private.create_customer_profile();
create or replace function private.zavo_auth_email_sync() returns trigger
language plpgsql security definer set search_path='' as $$
begin update public.customer_profiles set email=coalesce(new.email,'') where user_id=new.id;return new;end $$;
revoke all on function private.zavo_auth_email_sync() from public,anon,authenticated;
drop trigger if exists zavo_auth_email_sync on auth.users;
create trigger zavo_auth_email_sync after update of email on auth.users for each row
 when(old.email is distinct from new.email) execute function private.zavo_auth_email_sync();
insert into public.customer_profiles(user_id,id,first_name,last_name,phone)
select id,id,left(coalesce(raw_user_meta_data->>'first_name',''),50),left(coalesce(raw_user_meta_data->>'last_name',''),50),
case when raw_user_meta_data->>'phone' ~ '^\+?[0-9]{9,15}$' then raw_user_meta_data->>'phone' else '' end
from auth.users on conflict(user_id) do nothing;
alter table public.customer_profiles enable row level security;
-- Replace only policies owned by this customer-account feature.
drop policy if exists customer_profile_read on public.customer_profiles;
drop policy if exists customer_profile_insert on public.customer_profiles;
drop policy if exists customer_profile_update on public.customer_profiles;
drop policy if exists zavo_profile_read on public.customer_profiles;
drop policy if exists zavo_profile_insert on public.customer_profiles;
drop policy if exists zavo_profile_update on public.customer_profiles;
revoke all on public.customer_profiles from public,anon,authenticated;
revoke insert(email,created_at,updated_at),update(email,created_at,updated_at) on public.customer_profiles from public,anon,authenticated;
grant select on public.customer_profiles to authenticated;
grant insert(user_id,id,first_name,last_name,phone,delivery_address,address,region),
 update(user_id,id,first_name,last_name,phone,delivery_address,address,region) on public.customer_profiles to authenticated;
grant all on public.customer_profiles to service_role;
create policy zavo_profile_read on public.customer_profiles for select to authenticated using(user_id=(select auth.uid()));
create policy zavo_profile_insert on public.customer_profiles for insert to authenticated with check(user_id=(select auth.uid()));
create policy zavo_profile_update on public.customer_profiles for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
alter table public.orders add column if not exists customer_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists customer_email text check(length(customer_email)<=254);
do $$ begin
 if not exists(select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
  where c.conrelid='public.orders'::regclass and c.contype='f' and c.confrelid='auth.users'::regclass and a.attname='customer_id') then
  alter table public.orders add constraint zavo_orders_customer_fk foreign key(customer_id) references auth.users(id) on delete set null;
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='user_id') then
  execute 'update public.orders set customer_id=user_id::uuid where customer_id is null and user_id is not null';
 end if;
end $$;
create index if not exists zavo_orders_customer on public.orders(customer_id,created_at desc);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
-- Preserve orders_admin / order_items_admin and their existing grants.
-- Replacing our previous combined policies leaves equivalent admin read access.
drop policy if exists orders_customer_read on public.orders;
drop policy if exists order_items_customer_read on public.order_items;
drop policy if exists zavo_orders_read on public.orders;
drop policy if exists zavo_items_read on public.order_items;
grant select on public.orders,public.order_items to authenticated;
create policy zavo_orders_read on public.orders for select to authenticated
 using(customer_id=(select auth.uid()) or (select public.is_admin()));
create policy zavo_items_read on public.order_items for select to authenticated
 using((select public.is_admin()) or exists(select 1 from public.orders o where o.id=order_id and o.customer_id=(select auth.uid())));
-- Admin updates still use the existing admin-checked change_order_status() RPC.

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

-- Run after customer-account-migration.sql in a development SQL Editor.
-- Includes real RLS/column-permission assertions; all fixtures roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000031','zavo-complete-one@example.invalid','{"first_name":"Ali","last_name":"Valiyev","phone":"+998901234567"}'),
('00000000-0000-4000-8000-000000000032','zavo-complete-two@example.invalid','{"first_name":"Vali"}'),
('00000000-0000-4000-8000-000000000033','zavo-complete-admin@example.invalid','{}');
insert into private.admins(user_id) values('00000000-0000-4000-8000-000000000033');
insert into public.orders(id,checkout_token,customer_id,customer_name,phone,region,address,payment_type,total_amount) values
('00000000-0000-4000-8000-000000000041',gen_random_uuid(),'00000000-0000-4000-8000-000000000031','Ali','+998901234567','Toshkent','Manzil','cash',100),
('00000000-0000-4000-8000-000000000042',gen_random_uuid(),'00000000-0000-4000-8000-000000000032','Vali','+998901234568','Toshkent','Manzil','cash',100);
insert into public.order_items(order_id,product_name,quantity,unit_price,total_price) values
('00000000-0000-4000-8000-000000000041','Birinchi xarid',1,100,100),
('00000000-0000-4000-8000-000000000042','Ikkinchi xarid',1,100,100);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000031',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000031","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if public.is_admin() then raise exception 'FAIL: customer became admin';end if;
 if (select count(*) from public.customer_profiles where user_id in ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000032'))<>1 then raise exception 'FAIL: profile isolation';end if;
 if (select email from public.customer_profiles where user_id=auth.uid())<>'zavo-complete-one@example.invalid' then raise exception 'FAIL: verified email copy';end if;
 if (select count(*) from public.orders where id in ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000042'))<>1 then raise exception 'FAIL: order isolation';end if;
 if (select count(*) from public.order_items where order_id in ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000042'))<>1 then raise exception 'FAIL: item isolation';end if;
 -- Exercise the same canonical upsert performed by profile.js.
 insert into public.customer_profiles(user_id,first_name,last_name,phone,delivery_address,region)
 values(auth.uid(),'Aziz','Valiyev','+998901234567','Yangi manzil','Toshkent')
 on conflict(user_id) do update set first_name=excluded.first_name,last_name=excluded.last_name,
 phone=excluded.phone,delivery_address=excluded.delivery_address,region=excluded.region;
 if (select address from public.customer_profiles where user_id=auth.uid())<>'Yangi manzil' then raise exception 'FAIL: legacy address sync';end if;
 update public.customer_profiles set delivery_address='Taqiqlangan' where user_id='00000000-0000-4000-8000-000000000032';
 if found then raise exception 'FAIL: other profile update';end if;
 begin
  update public.orders set status='Yetkazildi' where id='00000000-0000-4000-8000-000000000041';
  raise exception 'FAIL: customer status update';
 exception when insufficient_privilege then null;end;
 begin
  perform public.change_order_status('00000000-0000-4000-8000-000000000041','Tasdiqlandi');
  raise exception 'FAIL: customer admin RPC';
 exception when insufficient_privilege then null;end;
 if has_column_privilege('authenticated','public.customer_profiles','email','UPDATE') then raise exception 'FAIL: direct email changes';end if;
 if has_column_privilege('authenticated','public.customer_profiles','updated_at','UPDATE') then raise exception 'FAIL: timestamp changes';end if;
end $$;
reset role;
-- Updating Auth's confirmed email must synchronize the profile server-side.
update auth.users set email='zavo-confirmed-new@example.invalid' where id='00000000-0000-4000-8000-000000000031';
do $$ begin
 if (select email from public.customer_profiles where user_id='00000000-0000-4000-8000-000000000031')<>'zavo-confirmed-new@example.invalid' then raise exception 'FAIL: Auth email sync';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000033',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000033","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if not public.is_admin() then raise exception 'FAIL: admin authorization';end if;
 if (select count(*) from public.orders where id in ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000042'))<>2 then raise exception 'FAIL: admin order visibility';end if;
end $$;
reset role;
rollback;

-- Development project only; all test data is rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000011','zavo-customer-one@example.invalid','{"first_name":"Ali","phone":"+998901234567"}'),
('00000000-0000-4000-8000-000000000012','zavo-customer-two@example.invalid','{"first_name":"Vali"}');
insert into public.orders(id,checkout_token,customer_id,customer_name,phone,region,address,payment_type,total_amount) values
('00000000-0000-4000-8000-000000000021',gen_random_uuid(),'00000000-0000-4000-8000-000000000011','Ali','+998901234567','Toshkent','Manzil','cash',100),
('00000000-0000-4000-8000-000000000022',gen_random_uuid(),'00000000-0000-4000-8000-000000000012','Vali','+998901234568','Toshkent','Manzil','cash',100),
('00000000-0000-4000-8000-000000000023',gen_random_uuid(),null,'Mehmon','+998901234569','Toshkent','Manzil','cash',100);
insert into public.order_items(order_id,product_name,quantity,unit_price,total_price) values
('00000000-0000-4000-8000-000000000021','Birinchi xarid',1,100,100),
('00000000-0000-4000-8000-000000000022','Ikkinchi xarid',1,100,100),
('00000000-0000-4000-8000-000000000023','Mehmon xaridi',1,100,100);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if public.is_admin() then raise exception 'FAIL: customer became admin'; end if;
 if (select count(*) from public.customer_profiles where id in ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012'))<>1 then raise exception 'FAIL: profile isolation'; end if;
 if (select count(*) from public.orders where id in ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000023'))<>1 then raise exception 'FAIL: order isolation'; end if;
 if (select count(*) from public.order_items where order_id in ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000023'))<>1 then raise exception 'FAIL: item isolation'; end if;
 update public.customer_profiles set address='Sinov manzili' where id='00000000-0000-4000-8000-000000000011';
 if not found then raise exception 'FAIL: own profile update'; end if;
 update public.customer_profiles set address='Taqiqlangan' where id='00000000-0000-4000-8000-000000000012';
 if found then raise exception 'FAIL: other profile update'; end if;
 if has_function_privilege('authenticated','public.create_order(jsonb,jsonb,text,integer,uuid)','EXECUTE') then raise exception 'FAIL: direct customer order creation'; end if;
end $$;
reset role;
rollback;

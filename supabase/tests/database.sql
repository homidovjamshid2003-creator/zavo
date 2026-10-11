-- Run after database.sql, in a development Supabase project's SQL Editor.
-- Everything is rolled back, including test users/products/orders.
begin;
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000001','zavo-rls-test@example.invalid') on conflict(id) do nothing;
insert into private.admins(user_id) values('00000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.categories(id,name,is_active) values('zavo_test','Sinov',true),('zavo_test_hidden','Yashirin sinov',false);
insert into public.products(name,category_id,cash_price,stock_quantity,is_active) values('ZAVO SQL ACTIVE','zavo_test',3500000,1,true),('ZAVO SQL HIDDEN','zavo_test',3500000,1,false),('ZAVO SQL HIDDEN CATEGORY','zavo_test_hidden',3500000,1,true);
set local role anon;
do $$ begin
  if (select count(*) from public.products where name like 'ZAVO SQL%')<>1 then raise exception 'FAIL: public product visibility'; end if;
  if (select count(*) from public.categories where id like 'zavo_test%')<>1 then raise exception 'FAIL: public category visibility'; end if;
  if has_table_privilege('anon','public.orders','SELECT') then raise exception 'FAIL: anonymous order reads'; end if;
  if has_function_privilege('anon','public.create_order(jsonb,jsonb,text,integer,uuid)','EXECUTE') then raise exception 'FAIL: direct public checkout bypass'; end if;
  if has_table_privilege('anon','public.products','UPDATE') then raise exception 'FAIL: anonymous price updates'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  if public.is_admin() then raise exception 'FAIL: nonadmin privilege'; end if;
  begin
    insert into public.products(name,category_id,cash_price,stock_quantity) values('FORBIDDEN','zavo_test',1,1);
    raise exception 'FAIL: nonadmin product insert allowed';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.orders)>0 then raise exception 'FAIL: nonadmin order visibility'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
declare p bigint; first jsonb; second jsonb; retry jsonb; token uuid:=gen_random_uuid(); customer jsonb:='{"name":"Sinov","phone":"+998901234567","region":"Toshkent","address":"Sinov manzili"}';
begin
  if not public.is_admin() then raise exception 'FAIL: admin recognition'; end if;
  select id into p from public.products where name='ZAVO SQL ACTIVE';
  first:=public.create_order(customer,jsonb_build_array(jsonb_build_object('id',p,'quantity',1,'price',1)),'installment',3,token);
  if (first->>'total')::bigint<>4040750 or (first->>'monthly')::bigint<>1346917 then raise exception 'FAIL: trusted price and rounding'; end if;
  if (select stock_quantity from public.products where id=p)<>1 then raise exception 'FAIL: new order changed stock'; end if;
  retry:=public.create_order(customer,jsonb_build_array(jsonb_build_object('id',p,'quantity',1)),'cash',null,token);
  if first->>'id'<>retry->>'id' then raise exception 'FAIL: duplicate retry'; end if;
  second:=public.create_order(customer,jsonb_build_array(jsonb_build_object('id',p,'quantity',1)),'cash',null,gen_random_uuid());
  perform public.change_order_status((first->>'id')::uuid,'Tasdiqlandi');
  if (select stock_quantity from public.products where id=p)<>0 then raise exception 'FAIL: confirmation stock deduction'; end if;
  perform public.change_order_status((first->>'id')::uuid,'Tasdiqlandi');
  if (select stock_quantity from public.products where id=p)<>0 then raise exception 'FAIL: repeated confirmation'; end if;
  begin
    perform public.change_order_status((second->>'id')::uuid,'Tasdiqlandi');
    raise exception 'FAIL: overselling allowed';
  exception when others then if sqlerrm='FAIL: overselling allowed' then raise; end if; end;
  if (select status from public.orders where id=(second->>'id')::uuid)<>'Yangi' then raise exception 'FAIL: unsuccessful confirmation changed status'; end if;
  perform public.change_order_status((second->>'id')::uuid,'Bekor qilindi');
  if (select stock_quantity from public.products where id=p)<>0 then raise exception 'FAIL: cancelled new order increased stock'; end if;
  perform public.change_order_status((first->>'id')::uuid,'Bekor qilindi');
  perform public.change_order_status((first->>'id')::uuid,'Bekor qilindi');
  if (select stock_quantity from public.products where id=p)<>1 then raise exception 'FAIL: cancellation restoration'; end if;
  if private.installment_total(3500000,6)<>4550000 or private.installment_total(3500000,9)<>4900000 or private.installment_total(3500000,12)<>5075000 then raise exception 'FAIL: payment periods'; end if;
  raise notice 'PASS: RLS, authoritative totals, idempotency, confirmation stock, overselling rejection, cancellation.';
end $$;
rollback;

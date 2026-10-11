const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{read,root}=require('./helpers.cjs');
test('database.sql remains unchanged and the incremental migration preserves legacy data',()=>{
 const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'database.sql'))).digest('hex');assert.equal(hash,read('tests/database-baseline.sha256').trim());
 const sql=read('customer-account-migration.sql');assert(!/drop\s+table|truncate\s|delete\s+from/i.test(sql));assert(sql.includes('create table if not exists public.customer_profiles'));assert(sql.includes('add column if not exists customer_id'));assert(sql.includes('create or replace function public.create_order'));assert(sql.trim().endsWith('commit;'));
 for(const name of ['user_id','first_name','last_name','phone','email','delivery_address','region','created_at','updated_at'])assert(sql.includes(name));assert(!sql.includes('password'));
});
test('profile ownership, confirmed email and timestamps are enforced server-side',()=>{
 const sql=read('customer-account-migration.sql');assert(sql.includes('using(user_id=(select auth.uid()))'));assert(sql.includes('with check(user_id=(select auth.uid()))'));assert(sql.includes('new.user_id is distinct from old.user_id'));assert(sql.includes('new.created_at:=old.created_at'));assert(sql.includes('new.updated_at:=clock_timestamp()'));assert(sql.includes('select coalesce(u.email'));assert(sql.includes('after update of email on auth.users'));
});
test('orders remain read-only for customers while admin RPC and inventory calculation survive',()=>{
 const sql=read('customer-account-migration.sql');assert(sql.includes('grant select on public.orders,public.order_items to authenticated'));assert(sql.includes('or (select public.is_admin())'));assert(!/grant\s+(?:all|update|insert|delete)[^;]*public\.orders[^;]*to authenticated/i.test(sql));assert(sql.includes("existing.customer_id is distinct from nullif(p_customer->>'_account_id','')::uuid"));assert(sql.includes('for update'));assert(sql.includes('private.installment_total'));assert(sql.includes('to service_role;'));
});
test('incremental SQL never recreates admins or removes existing admin policies and grants',()=>{
 const sql=read('customer-account-migration.sql');assert(!/create\s+table\s+(?:if\s+not\s+exists\s+)?private\.admins/i.test(sql));
 assert(!/create\s+(?:or\s+replace\s+)?function\s+public\.(is_admin|change_order_status|save_product)/i.test(sql));
 assert(!/drop\s+policy[^;]*\b(?:orders_admin|order_items_admin|products_admin)\b/i.test(sql));
 assert(!/revoke[^;]*on public\.orders/i.test(sql));assert(!sql.includes('from pg_policies'));
 for(const name of ['zavo_profile_read','zavo_profile_insert','zavo_profile_update','zavo_orders_read','zavo_items_read'])assert(sql.includes('drop policy if exists '+name));
 const ddl=[...sql.matchAll(/create\s+table\s+([^\n]+)/gi)];assert(ddl.length>0);for(const m of ddl)assert(m[1].startsWith('if not exists '));
 for(const m of sql.matchAll(/add column\s+([^\n]+)/gi))assert(m[1].startsWith('if not exists '));
});

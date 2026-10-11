const test=require('node:test'),assert=require('node:assert/strict'),{setup,read}=require('./helpers.cjs');
function customer(page='customer-login.html',logged=false){
 const e=setup({page}),calls=[],callbacks=[],tasks=[];e.location.href='https://shop.example/'+page;e.location.origin='https://shop.example';e.location.pathname='/'+page;e.location.search='';e.location.hash='';e.location.assign=e.location.replace;
 e.context.URLSearchParams=URLSearchParams;e.context.history={replaceState(){}};e.context.setTimeout=fn=>tasks.push(fn);
 let current=logged?{id:'customer-one',email:'ali@example.com',user_metadata:{first_name:'Ali'}}:null;
 const profile={user_id:'customer-one',id:'customer-one',email:'ali@example.com',first_name:'Ali',last_name:'Valiyev',phone:'+998901234567',delivery_address:'Chilonzor 1',address:'Chilonzor 1',region:'Toshkent'};
 const orders=[{id:'12345678-1234-4123-8123-123456789012',customer_id:'customer-one',status:'Yangi',created_at:'2026-10-10',total_amount:3500000,payment_type:'cash',order_items:[{product_name:'Sinov TV',quantity:1,total_price:3500000}]}];
 const auth={getUser:async()=>({data:{user:current},error:null}),getSession:async()=>({data:{session:current?{access_token:'customer-jwt'}:null},error:null}),onAuthStateChange(fn){callbacks.push(fn);return {data:{subscription:{unsubscribe(){}}}}},signInWithPassword:async args=>{calls.push(['signIn',args]);current={id:'customer-one',email:args.email};return {data:{user:current},error:null}},signUp:async args=>{calls.push(['signUp',args]);current={id:'customer-one',email:args.email};return {data:{user:current,session:{access_token:'customer-jwt'}},error:null}},signOut:async()=>{current=null;calls.push(['signOut']);return {error:null}},setSession:async args=>{calls.push(['setSession',args]);current={id:'customer-one',email:'ali@example.com'};return {error:null}}};
 auth.updateUser=async args=>{calls.push(['updateUser',args]);current={...current,email:args.email};return {data:{user:current},error:null};};
 const client={auth,from(table){const query={select(){return query},eq(k,v){calls.push(['eq',table,k,v]);return query},order(){return query},upsert(values){calls.push(['upsert',table,values]);if(table==='customer_profiles')Object.assign(profile,values);return query},then(resolve,reject){return Promise.resolve({data:table==='customer_profiles'?[profile]:orders,error:null}).then(resolve,reject)}};return query}};
 e.window.ZavoBackend.getClient();
 e.window.supabase.createClient=(url,key,options)=>{calls.push(['createClient',options]);return client;};Object.defineProperty(e.context,'ZavoCustomer',{get:()=>e.window.ZavoCustomer});
 e.run('customer-account.js');
 e.auth=auth;e.accountCalls=calls;e.callbacks=callbacks;e.tasks=tasks;e.customerClient=client;e.savedProfile=profile;e.orders=orders;
 e.form=(id,values)=>{const form=e.nodes.get(id);form.elements={};for(const [key,value] of Object.entries(values)){form.elements[key]=e.make();form.elements[key].value=value;}form.elements.namedItem=key=>form.elements[key];return form;};
 e.submit=form=>e.emit(form.handlers,'submit',form);
 return e;
}
test('customer login uses its own persisted auth storage and safe return destination',async()=>{
 const e=customer();e.location.href+='?next=profile.html';const f=e.form('#customer-login-form',{email:'ali@example.com',password:'SecurePassword123!'});e.run('customer-login.js');await e.submit(f);
 assert.equal(e.location.replaced,'https://shop.example/profile.html');assert.equal(e.accountCalls.find(c=>c[0]==='createClient')[1].auth.storageKey,'zavo-customer-auth');assert.equal(f.elements.password.value,'');assert.equal(e.calls.some(c=>c[0]==='signIn'),false);
 e.location.href='https://shop.example/customer-login.html?next=https://evil.example';assert.equal(e.window.ZavoCustomer.next(),'index.html');
});
test('registration validates secure matching passwords then signs up with customer metadata',async()=>{
 const e=customer('customer-register.html'),f=e.form('#customer-register-form',{email:'ali@example.com',first_name:'Ali',last_name:'Valiyev',phone:'+998 90 123 45 67',password:'weak',repeat:'weak'});e.run('customer-register.js');await e.submit(f);assert.equal(e.accountCalls.some(c=>c[0]==='signUp'),false);
 f.elements.password.value=f.elements.repeat.value='SecurePassword123!';await e.submit(f);const args=e.accountCalls.find(c=>c[0]==='signUp')[1];assert.equal(args.options.data.phone,'+998901234567');assert.equal(args.options.data.first_name,'Ali');assert.equal(args.options.emailRedirectTo,'https://shop.example/index.html');assert.equal(e.location.replaced,'index.html');
});
test('confirmation-required signup shows email notice without pretending user is logged in',async()=>{
 const e=customer('customer-register.html'),f=e.form('#customer-register-form',{email:'ali@example.com',first_name:'Ali',last_name:'Valiyev',phone:'+998901234567',password:'SecurePassword123!',repeat:'SecurePassword123!'});e.auth.signUp=async()=>({data:{user:{id:'customer-one'},session:null},error:null});e.run('customer-register.js');await e.submit(f);assert.equal(e.location.replaced,'');assert.equal(e.nodes.get('#customer-notice').hidden,false);
});
test('profile loads verified account and saves only own editable data',async()=>{
 const e=customer('profile.html',true),f=e.form('#profile-form',{first_name:'',last_name:'',phone:'',email:'',region:'',address:''});await e.run('profile.js');assert.equal(f.elements.email.value,'ali@example.com');assert.equal(f.elements.address.value,'Chilonzor 1');
 await e.emit(e.nodes.get('#profile-edit').handlers,'click',e.nodes.get('#profile-edit'));f.elements.address.value='Yangi manzil';await e.submit(f);const values=e.accountCalls.find(c=>c[0]==='upsert')[2];assert.equal(values.user_id,'customer-one');assert.equal(values.delivery_address,'Yangi manzil');assert.equal(values.email,undefined);
});
test('orders require customer session and filter by verified customer ID',async()=>{
 const guest=customer('customer-orders.html');await guest.run('customer-orders.js');assert.equal(guest.location.replaced,'customer-login.html?next=customer-orders.html');assert.equal(guest.accountCalls.some(c=>c[0]==='eq'),false);
 const e=customer('customer-orders.html',true);await e.run('customer-orders.js');assert(e.accountCalls.some(c=>c[0]==='eq'&&c[1]==='orders'&&c[2]==='customer_id'&&c[3]==='customer-one'));assert.equal(e.nodes.get('#customer-orders').children.length,1);
});
test('checkout passes customer JWT instead of admin credentials and preserves guest checkout',async()=>{
 for(const logged of [true,false]){const e=customer('customer-login.html',logged);await e.window.ZavoStore.init();await e.window.ZavoStore.createOrder({name:'Ali',phone:'+998901234567',region:'Toshkent',address:'Uy'},[{id:1,quantity:1}],'cash',12,'captcha','token');
 // The mocked invocation captures body; capture options for the identity assertion separately.
 const admin=e.window.ZavoBackend.getClient();let options;admin.functions.invoke=async(name,args)=>{options=args;return {data:{order:{id:'order'}},error:null}};await e.window.ZavoStore.createOrder({name:'Ali'},[{id:1,quantity:1}],'cash',12,'captcha','token');assert.equal(options.headers.Authorization,logged?'Bearer customer-jwt':'Bearer sb_publishable_test');}
});
test('customer migration limits profiles and orders by auth.uid and preserves admin grants',()=>{
 const sql=read('supabase/migrations/202610100002_customer_accounts.sql');assert(sql.includes('id=(select auth.uid())'));assert(sql.includes('customer_id=(select auth.uid())'));assert(sql.includes('o.customer_id=(select auth.uid())'));assert(sql.includes("nullif(p_customer->>'_account_id','')::uuid"));assert(sql.includes('revoke all on function public.create_order(jsonb,jsonb,text,integer,uuid) from public,anon,authenticated'));assert(!sql.includes('private.admins'));
});
test('signup callback establishes customer session and removes tokens from URL',async()=>{
 const e=customer();e.location.href='https://shop.example/index.html#type=signup&access_token=a&refresh_token=b';await e.window.ZavoCustomer.callback();assert.equal(e.accountCalls.find(c=>c[0]==='setSession')[1].access_token,'a');
});
test('header logout clears customer session but retains cart, favorites and admin session',async()=>{
 const e=customer('index.html',true);e.form('#checkout-form',{name:'',phone:'',email:'',region:'',address:''});e.memory.set('zavo-cart','saved-cart');e.memory.set('zavo-favorites','saved-favorites');
 for(let i=0;i<40;i++)await Promise.resolve();
 await e.window.ZavoCustomer.prefill();
 assert.equal(e.nodes.get('#account-label').textContent,'Ali');assert.equal(e.nodes.get('#checkout-form').elements.phone.value,'+998901234567');
 await e.emit(e.nodes.get('#customer-logout').handlers,'click',e.nodes.get('#customer-logout'));assert.equal(e.nodes.get('#account-label').textContent,'Kirish');assert.equal(e.memory.get('zavo-cart'),'saved-cart');assert.equal(e.memory.get('zavo-favorites'),'saved-favorites');assert.equal(e.state.authenticated,true);
});
test('updated profile refreshes checkout while preserving manually entered delivery details',async()=>{
 const e=customer('index.html',true),f=e.form('#checkout-form',{name:'',phone:'',email:'',region:'',address:''});for(let i=0;i<40;i++)await Promise.resolve();await e.window.ZavoCustomer.prefill();
 assert.equal(f.elements.name.value,'Ali Valiyev');assert.equal(f.elements.email.value,'ali@example.com');
 f.elements.address.value='Faqat shu buyurtma manzili';Object.assign(e.savedProfile,{first_name:'Aziz',last_name:'Karimov',phone:'+998991234567',delivery_address:'Yangilangan manzil'});
 await e.window.ZavoCustomer.prefill();assert.equal(f.elements.name.value,'Aziz Karimov');assert.equal(f.elements.phone.value,'+998991234567');assert.equal(f.elements.address.value,'Faqat shu buyurtma manzili');
});
test('profile email edit goes through Auth and never writes credentials into profile table',async()=>{
 const e=customer('profile.html',true),f=e.form('#profile-form',{first_name:'',last_name:'',phone:'',email:'',region:'',address:''});await e.run('profile.js');await e.emit(e.nodes.get('#profile-edit').handlers,'click',e.nodes.get('#profile-edit'));
 assert.equal(f.elements.email.disabled,false);f.elements.email.value='new@example.com';f.elements.first_name.value='Aziz';await e.submit(f);
 const authCall=e.accountCalls.find(c=>c[0]==='updateUser');assert.equal(authCall[1].email,'new@example.com');const values=e.accountCalls.find(c=>c[0]==='upsert')[2];assert.equal(values.email,undefined);assert.equal(values.password,undefined);assert.equal(values.first_name,'Aziz');assert.equal(f.elements.email.value,'new@example.com');assert.equal(e.nodes.get('#profile-status').textContent,"Ma'lumotlar saqlandi");
});
test('pending email confirmation retains verified email and shows confirmation instructions',async()=>{
 const e=customer('profile.html',true),f=e.form('#profile-form',{first_name:'',last_name:'',phone:'',email:'',region:'',address:''});e.auth.updateUser=async args=>{e.accountCalls.push(['updateUser',args]);return {data:{user:{email:'ali@example.com',new_email:args.email}},error:null}};
 await e.run('profile.js');await e.emit(e.nodes.get('#profile-edit').handlers,'click',e.nodes.get('#profile-edit'));f.elements.email.value='pending@example.com';await e.submit(f);
 assert.equal(f.elements.email.value,'ali@example.com');assert.equal(e.nodes.get('#profile-email-notice').hidden,false);assert.match(e.nodes.get('#profile-email-notice').textContent,/pending@example.com/);assert.match(e.nodes.get('#profile-email-notice').textContent,/tasdiqlang/);
});
test('failed email change reports saved profile separately and keeps edit available',async()=>{
 const e=customer('profile.html',true),f=e.form('#profile-form',{first_name:'',last_name:'',phone:'',email:'',region:'',address:''});e.auth.updateUser=async()=>({error:{message:'network'}});await e.run('profile.js');await e.emit(e.nodes.get('#profile-edit').handlers,'click',e.nodes.get('#profile-edit'));f.elements.email.value='new@example.com';f.elements.address.value='Yangi manzil';await e.submit(f);
 assert.equal(e.savedProfile.delivery_address,'Yangi manzil');assert.match(e.nodes.get('#profile-status').textContent,/Profil saqlandi, lekin email/);assert.equal(e.nodes.get('#profile-save').hidden,false);
});
test('orders show Uzbek date, product, status, payment and installment details',async()=>{
 const e=customer('customer-orders.html',true);Object.assign(e.orders[0],{payment_type:'installment',installment_months:6,monthly_payment:758333,status:'Tasdiqlandi'});await e.run('customer-orders.js');const text=e.nodes.get('#customer-orders').children[0].children.map(n=>n.textContent).join('\n');
 for(const content of ['Sana:','Sinov TV','Jami summa:','Buyurtma holati: Tasdiqlandi','To‘lov turi: Muddatli to‘lov','6 oy','758 333'])assert(text.includes(content));
});
test('email change callbacks use customer session and bypass password-recovery routing',async()=>{
 const e=customer('profile.html',true);e.location.href='https://shop.example/profile.html?auth=email_change&code=email-code';e.run('supabase.js');assert.equal(e.window.ZavoBackend.recoveryRedirectPending,false);
 e.auth.exchangeCodeForSession=async code=>{e.accountCalls.push(['exchange',code]);return {error:null}};await e.window.ZavoCustomer.callback();assert.equal(e.accountCalls.find(c=>c[0]==='exchange')[1],'email-code');
 e.location.href='https://shop.example/profile.html#type=email_change&access_token=a&refresh_token=b';await e.window.ZavoCustomer.callback();assert.equal(e.accountCalls.find(c=>c[0]==='setSession')[1].access_token,'a');
});
test('temporary profile-load failures preserve existing checkout values',async()=>{
 const e=customer('index.html',true),f=e.form('#checkout-form',{name:'',phone:'',email:'',region:'',address:''});for(let i=0;i<40;i++)await Promise.resolve();await e.window.ZavoCustomer.prefill();
 e.customerClient.from=()=>({select(){return this},eq(){return Promise.resolve({data:null,error:{message:'offline'}})}});await e.window.ZavoCustomer.prefill();assert.equal(f.elements.name.value,'Ali Valiyev');assert.equal(f.elements.address.value,'Chilonzor 1');
});
test('canonical checkout prefills separate names and submits a compatible order customer',async()=>{
 const e=customer('index.html',true),f=e.form('#checkout-form',{first_name:'',last_name:'',phone:'',email:'',region:'',address:''});for(let i=0;i<40;i++)await Promise.resolve();await e.window.ZavoCustomer.prefill();
 assert.equal(f.elements.first_name.value,'Ali');assert.equal(f.elements.last_name.value,'Valiyev');assert.equal(f.elements.region.value,'Toshkent');assert.equal(f.elements.address.value,'Chilonzor 1');
 const backend=e.window.ZavoBackend.getClient();let request;backend.functions.invoke=async(name,args)=>{request=args;return {data:{order:{id:'new-order'}},error:null}};
 await e.window.ZavoStore.init();
 await e.window.ZavoStore.createOrder({first_name:'Aziz',last_name:'Karimov',phone:'+998901234567',region:'Toshkent',address:'Uy',email:'ali@example.com'},[{id:1,quantity:1}],'cash',12,'captcha','token');
 assert.equal(request.body.customer.name,'Aziz Karimov');assert.equal(request.headers.Authorization,'Bearer customer-jwt');
});
test('my-orders route protects guests and preserves all requested order fields',async()=>{
 const guest=customer('my-orders.html');await guest.run('customer-orders.js');assert.equal(guest.location.replaced,'customer-login.html?next=my-orders.html');
 const e=customer('my-orders.html',true);Object.assign(e.orders[0],{payment_type:'installment',installment_months:12,monthly_payment:422917});await e.run('customer-orders.js');
 const text=e.nodes.get('#customer-orders').children[0].children.map(n=>n.textContent).join('\n');for(const label of ['Buyurtma raqami:','Sana:','Mahsulotlar:','Jami summa:','To‘lov turi:','Muddat:','Oyiga to‘lov:','Buyurtma holati:'])assert(text.includes(label));
 assert.equal(e.accountCalls.some(c=>c[0]==='upsert'&&c[1]==='orders'),false);
});
test('customer account can boot again with the existing persisted auth session',async()=>{
 const e=customer('customer-login.html',true);assert.equal((await e.window.ZavoCustomer.user()).id,'customer-one');e.run('customer-account.js');assert.equal((await e.window.ZavoCustomer.user()).id,'customer-one');
 const options=e.accountCalls.filter(c=>c[0]==='createClient').map(c=>c[1].auth);for(const auth of options){assert.equal(auth.storageKey,'zavo-customer-auth');assert.equal(auth.persistSession,true);assert.equal(auth.autoRefreshToken,true);}
});

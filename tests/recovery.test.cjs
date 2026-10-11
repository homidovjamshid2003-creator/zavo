const test=require('node:test'),assert=require('node:assert/strict'),{setup,read}=require('./helpers.cjs'),vm=require('node:vm');
function recovery(suffix='#type=recovery&access_token=access&refresh_token=refresh'){
 const e=setup({page:'reset-password.html'}),timers=[];
 e.location.href='https://shop.example/reset-password.html'+suffix;
 e.context.URLSearchParams=URLSearchParams;
 e.context.history={replaceState(a,b,path){e.location.href=new URL(path,e.location.href).href}};
 e.context.setTimeout=(fn,delay)=>timers.push({fn,delay});
 const auth=e.window.ZavoBackend.getClient().auth;
 auth.setSession=async args=>{e.calls.push(['setSession',args]);return {error:null}};
 auth.exchangeCodeForSession=async code=>{e.calls.push(['exchange',code]);return {error:null}};
 auth.verifyOtp=async args=>{e.calls.push(['verifyOtp',args]);return {error:null}};
 auth.updateUser=async args=>{e.calls.push(['updateUser',args]);return {error:null}};
 e.auth=auth;e.timers=timers;
 e.submit=()=>e.emit(e.nodes.get('#reset-password-form').handlers,'submit',e.nodes.get('#reset-password-form'));
 return e;
}
test('recovery session updates password, scrubs URL and returns to login',async()=>{
 const e=recovery();await e.run('reset-password.js');
 assert.equal(e.location.href,'https://shop.example/reset-password.html');assert.equal(e.nodes.get('#reset-submit').disabled,false);
 for(const id of ['#new-password','#repeat-password'])e.nodes.get(id).value='SecurePassword123!';
 await e.submit();assert.equal(e.calls.filter(c=>c[0]==='updateUser').length,1);
 assert.equal(e.nodes.get('#reset-status').textContent,'Parol muvaffaqiyatli yangilandi');
 assert.equal(e.state.authenticated,false);assert.equal(e.memory.has('zavo-recovery-state'),false);
 e.timers.find(t=>t.delay===1800).fn();assert.equal(e.location.replaced,'login.html?password_updated=1');
});
test('mismatched and weak passwords never reach updateUser',async()=>{
 const e=recovery();await e.run('reset-password.js');
 e.nodes.get('#new-password').value='SecurePassword123!';e.nodes.get('#repeat-password').value='different';await e.submit();
 assert.equal(e.nodes.get('#reset-error').hidden,false);
 e.nodes.get('#new-password').value=e.nodes.get('#repeat-password').value='weak';await e.submit();
 assert.equal(e.calls.some(c=>c[0]==='updateUser'),false);
});
test('ordinary logged in session cannot open password recovery form',async()=>{
 const e=recovery('');await e.run('reset-password.js');assert.equal(e.nodes.get('#reset-password-form').hidden,true);assert.equal(e.nodes.get('#reset-submit').disabled,true);
});
test('expired recovery link is rejected',async()=>{
 const e=recovery();e.auth.setSession=async()=>({error:{message:'expired'}});await e.run('reset-password.js');assert.equal(e.nodes.get('#reset-password-form').hidden,true);
});
test('PKCE and recovery token hash links are exchanged',async()=>{
 for(const [suffix,call] of [['?code=code','exchange'],['?token_hash=hash&type=recovery','verifyOtp']]){
  const e=recovery(suffix);await e.run('reset-password.js');assert.equal(e.nodes.get('#reset-submit').disabled,false);assert.equal(e.calls.some(c=>c[0]===call),true);
 }
});
test('scrubbed recovery page reload requires matching unexpired marker',async()=>{
 for(const valid of [true,false]){const e=recovery('');e.memory.set('zavo-recovery-state',JSON.stringify({userId:valid?'admin-user':'other-user',expiresAt:Date.now()+60000}));await e.run('reset-password.js');assert.equal(e.nodes.get('#reset-submit').disabled,!valid);}
});
test('recovery links landing on storefront redirect before app initialization',()=>{
 const e=setup();e.location.href='https://shop.example/index.html#type=recovery&access_token=a&refresh_token=b';e.context.URLSearchParams=URLSearchParams;
 vm.runInContext(read('supabase.js'),e.context);assert.equal(e.window.ZavoBackend.recoveryRedirectPending,true);assert.equal(e.location.replaced,'https://shop.example/reset-password.html#type=recovery&access_token=a&refresh_token=b');
});
test('login requests email recovery with exact reset page redirect',async()=>{
 const e=setup({page:'login.html',authenticated:false});e.location.href='https://shop.example/login.html';
 const email=e.nodes.get('#login-email');email.value='admin@example.com';email.checkValidity=()=>true;
 e.window.ZavoBackend.getClient().auth.resetPasswordForEmail=async(address,options)=>{e.calls.push(['resetEmail',address,options]);return {error:null}};
 e.run('login.js');await e.emit(e.nodes.get('#forgot-password').handlers,'click',e.nodes.get('#forgot-password'));
 assert.equal(e.calls.find(c=>c[0]==='resetEmail')[2].redirectTo,'https://shop.example/reset-password.html');assert.equal(e.nodes.get('#login-notice').hidden,false);
});
test('update failure keeps form available and does not show success',async()=>{
 const e=recovery();await e.run('reset-password.js');e.auth.updateUser=async()=>({error:{code:'same_password'}});
 e.nodes.get('#new-password').value=e.nodes.get('#repeat-password').value='SecurePassword123!';await e.submit();assert.equal(e.nodes.get('#reset-error').hidden,false);assert.equal(e.nodes.get('#reset-submit').disabled,false);assert.equal(e.location.replaced,'');
});

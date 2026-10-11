'use strict';
window.ZavoCustomer=(()=>{
 let client;
 const profileListeners=new Set(),channel=typeof BroadcastChannel==='function'?new BroadcastChannel('zavo-profile-changes'):null;
 function notifyProfileChange(){for(const listener of profileListeners)listener();channel?.postMessage('updated');}
 if(channel)channel.onmessage=()=>{for(const listener of profileListeners)listener();};
 function api(){ZavoBackend.getClient();return client ||= window.supabase.createClient(ZavoBackend.config.url,ZavoBackend.config.publishableKey,{auth:{storageKey:'zavo-customer-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});}
 async function user(){const {data,error}=await api().auth.getUser();return error?null:data.user;}
 async function profile(u){const {data,error}=await api().from('customer_profiles').select('*').eq('user_id',u.id);if(error)throw new Error('Profilni yuklab bo‘lmadi.');const row=data[0];return row?{...row,id:row.user_id,address:row.delivery_address}: {user_id:u.id,email:u.email||'',first_name:u.user_metadata?.first_name||'',last_name:u.user_metadata?.last_name||'',phone:u.user_metadata?.phone||'',address:'',region:''};}
 function next(){const raw=new URL(location.href).searchParams.get('next');try{const target=new URL(raw||'index.html',location.href);if(target.origin===location.origin&&/^https?:$/.test(target.protocol)&&!/(?:admin|login|register|reset-password)\.html$/.test(target.pathname))return target.href;}catch{}return 'index.html';}
 function strong(p){return p.length>=12&&p.length<=128&&/[A-Z]/.test(p)&&/[a-z]/.test(p)&&/\d/.test(p)&&/[^A-Za-z0-9\s]/.test(p);}
 async function callback(){
  const url=new URL(location.href),hash=new URLSearchParams(url.hash.slice(1));
  const emailChange=url.searchParams.get('auth')==='email_change'&&url.pathname.endsWith('/profile.html');
  if(!['signup','email_change'].includes(hash.get('type'))&&!emailChange)return;
  const tokens={access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')},code=url.searchParams.get('code'),failed=hash.get('error')||url.searchParams.get('error');
  url.hash='';for(const key of ['auth','code','error','error_code','error_description'])url.searchParams.delete(key);history.replaceState(null,'',url.pathname+url.search);
  if(failed)throw new Error('Email tasdiqlash havolasi eskirgan. Qayta urinib ko‘ring.');
  let result;
  if(tokens.access_token&&tokens.refresh_token)result=await api().auth.setSession(tokens);
  else if(emailChange&&code)result=await api().auth.exchangeCodeForSession(code);
  if(result?.error)throw new Error('Email tasdiqlash havolasi eskirgan. Qayta urinib ko‘ring.');
 }
 return {api,user,profile,next,strong,callback,notifyProfileChange,subscribeProfile:fn=>{profileListeners.add(fn);return ()=>profileListeners.delete(fn);}};
})();
(async()=>{
 if(ZavoBackend.recoveryRedirectPending||!ZavoBackend.configured())return;
 const trigger=document.querySelector('#account-button');if(!trigger)return;
 const menu=document.querySelector('#account-menu'),label=document.querySelector('#account-label');let current=null,version=0;
 async function render(){const v=++version,u=await ZavoCustomer.user();let name=u?.user_metadata?.first_name;try{if(u)name=(await ZavoCustomer.profile(u)).first_name||name;}catch{}if(v!==version)return;current=u;label.textContent=u?(name||'Hisobim'):'Kirish';trigger.setAttribute('aria-label',u?'Hisob menyusi':'Hisobga kirish');trigger.setAttribute('aria-expanded','false');menu.hidden=true;}
 trigger.addEventListener('click',()=>{if(!current){location.assign('customer-login.html?next='+encodeURIComponent(location.pathname+location.search));return;}menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));});
 document.addEventListener('click',e=>{if(!e.target.closest('.account-area')){menu.hidden=true;trigger.setAttribute('aria-expanded','false');}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus();}});
 document.querySelector('#customer-logout').addEventListener('click',async()=>{const {error}=await ZavoCustomer.api().auth.signOut({scope:'local'});if(error){document.querySelector('#account-status').textContent='Chiqib bo‘lmadi. Qayta urinib ko‘ring.';return;}await render();await prefill();});
 const saved=document.querySelector('#account-favorites');saved.addEventListener('click',e=>{e.preventDefault();menu.hidden=true;trigger.setAttribute('aria-expanded','false');const button=document.querySelector('#favorites-button');if(button.getAttribute('aria-pressed')!=='true')button.click();});
 ZavoCustomer.api().auth.onAuthStateChange(()=>setTimeout(()=>{render();prefill();},0));
 const filled=new Map();let prefillVersion=0;
 async function prefill(){
  const version=++prefillVersion,form=document.querySelector('#checkout-form');if(!form)return;
  try{
   const u=await ZavoCustomer.user();if(version!==prefillVersion)return;
   if(!u){for(const [input,value] of filled){if(input.value===value)input.value='';}filled.clear();return;}
   const p=await ZavoCustomer.profile(u),latest=await ZavoCustomer.user();if(version!==prefillVersion||latest?.id!==u.id)return;
   for(const [key,value] of Object.entries({first_name:p.first_name,last_name:p.last_name,name:[p.first_name,p.last_name].filter(Boolean).join(' ').slice(0,100),phone:p.phone,email:latest.email,address:p.address,region:p.region})){
    const input=form.elements.namedItem(key);if(input&&(!input.value||input.value===filled.get(input))){input.value=value||'';filled.set(input,input.value);}
   }
  }catch{ /* Preserve checkout entries during temporary network failures. */ }
 }
 window.ZavoCustomer.prefill=prefill;
 ZavoCustomer.subscribeProfile(()=>{render();prefill();});
 window.addEventListener('focus',()=>{render();prefill();});
 try{await ZavoCustomer.callback();await render();await prefill();}catch{document.querySelector('#account-status').textContent='Hisobni yuklab bo‘lmadi. Qayta kiring.';}
})();

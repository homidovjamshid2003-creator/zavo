'use strict';
(async () => {
  const form=document.querySelector('#reset-password-form'),button=document.querySelector('#reset-submit'),status=document.querySelector('#reset-status'),errorNode=document.querySelector('#reset-error'),linkError=document.querySelector('#reset-link-error');
  const newPassword=document.querySelector('#new-password'),repeat=document.querySelector('#repeat-password');
  const markerKey='zavo-recovery-state';
  let client,ready=false,updating=false,completed=false,activeUserId;
  // Capture credentials once, then remove them from browser history and visible URL.
  const url=new URL(location.href),hash=new URLSearchParams(url.hash.slice(1)),query=url.searchParams;
  const incoming={error:hash.get('error')||query.get('error'),type:hash.get('type')||query.get('type'),access:hash.get('access_token'),refresh:hash.get('refresh_token'),code:query.get('code'),tokenHash:query.get('token_hash')};
  for(const key of ['access_token','refresh_token','code','token_hash','type','error','error_code','error_description'])url.searchParams.delete(key);
  url.hash='';history.replaceState(null,'',url.pathname+url.search);
  function fail(message){ready=false;form.hidden=true;button.disabled=true;status.textContent='Parolni tiklash havolasi ishlamadi.';linkError.textContent=message;linkError.hidden=false;try{sessionStorage.removeItem(markerKey);}catch{}}
  async function verifyRecovery(){
    if(completed)return;
    const {data,error}=await client.auth.getUser();if(error||!data?.user)throw new Error('Tiklash sessiyasi tugagan. Yangi havola so‘rang.');
    activeUserId=data.user.id;ready=true;form.hidden=false;button.disabled=false;linkError.hidden=true;status.textContent='Hisobingiz uchun xavfsiz yangi parol kiriting.';
    try{sessionStorage.setItem(markerKey,JSON.stringify({userId:activeUserId,expiresAt:Date.now()+15*60*1000}));}catch{}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!ready||updating||completed)return;errorNode.hidden=true;
    const password=newPassword.value;
    if(password!==repeat.value){errorNode.textContent='Parollar bir xil bo‘lishi kerak.';errorNode.hidden=false;repeat.focus();return;}
    if(password.length<12||password.length>128||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/\d/.test(password)||!/[^A-Za-z0-9\s]/.test(password)){errorNode.textContent='12–128 ta belgi, katta va kichik lotin harfi, raqam va maxsus belgi ishlating.';errorNode.hidden=false;newPassword.focus();return;}
    updating=true;button.disabled=true;button.textContent='Yangilanmoqda…';
    try{
      const user=await client.auth.getUser();if(user.error||user.data?.user?.id!==activeUserId){fail('Tiklash sessiyasi tugagan. Yangi havola so‘rang.');return;}
      const {error}=await client.auth.updateUser({password});
      if(error){const message=error.code==='same_password'?'Yangi parol avvalgi paroldan farq qilishi kerak.':error.code==='weak_password'?'Parol yetarlicha xavfsiz emas. Kuchliroq parol kiriting.':error.status===401?'Tiklash sessiyasi tugagan. Yangi havola so‘rang.':'Parolni yangilab bo‘lmadi. Qayta urinib ko‘ring.';throw new Error(message);}
      completed=true;ready=false;newPassword.value='';repeat.value='';form.hidden=true;status.textContent='Parol muvaffaqiyatli yangilandi';
      try{sessionStorage.removeItem(markerKey);}catch{}
      // End the recovery session so login requires the newly chosen password.
      try{await client.auth.signOut({scope:'local'});}catch{}
      setTimeout(()=>location.replace('login.html?password_updated=1'),1800);
    }catch(error){errorNode.textContent=error.message||'Parolni yangilab bo‘lmadi. Qayta urinib ko‘ring.';errorNode.hidden=false;}
    finally{updating=false;button.textContent='Parolni yangilash';button.disabled=!ready||completed;}
  });
  try{
    client=ZavoBackend.getClient();
    client.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'&&session&&!completed)setTimeout(()=>verifyRecovery().catch(error=>fail(error.message)),0);
      if(event==='SIGNED_OUT'&&!completed)fail('Tiklash sessiyasi tugagan. Yangi havola so‘rang.');
    });
    if(incoming.error)throw new Error('Havola eskirgan yoki avval ishlatilgan. Kirish sahifasida yangi havola so‘rang.');
    let result;
    if(incoming.access||incoming.refresh){if(incoming.type!=='recovery'||!incoming.access||!incoming.refresh)throw new Error('Tiklash havolasi noto‘g‘ri. Yangi havola so‘rang.');result=await client.auth.setSession({access_token:incoming.access,refresh_token:incoming.refresh});}
    else if(incoming.code)result=await client.auth.exchangeCodeForSession(incoming.code);
    else if(incoming.tokenHash){if(incoming.type!=='recovery')throw new Error('Tiklash havolasi noto‘g‘ri.');result=await client.auth.verifyOtp({token_hash:incoming.tokenHash,type:'recovery'});}
    else{
      let marker;try{marker=JSON.parse(sessionStorage.getItem(markerKey));}catch{}
      const user=await client.auth.getUser();
      if(!marker||marker.expiresAt<=Date.now()||user.error||marker.userId!==user.data?.user?.id)throw new Error('Parolni tiklash uchun emailingizga yuborilgan havolani oching.');
    }
    if(result?.error)throw new Error('Havola eskirgan yoki sessiyani ochib bo‘lmadi. Yangi havola so‘rang.');
    await verifyRecovery();
  }catch(error){fail(error.message||'Tiklash havolasini tekshirib bo‘lmadi. Yangi havola so‘rang.');}
})();

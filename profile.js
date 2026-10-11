'use strict';
(async()=>{
 if(ZavoBackend.recoveryRedirectPending)return;
 const form=document.querySelector('#profile-form'),status=document.querySelector('#profile-status'),save=document.querySelector('#profile-save'),edit=document.querySelector('#profile-edit'),emailNotice=document.querySelector('#profile-email-notice');
 const fields=['first_name','last_name','phone','address','region','email'];let editing=false,busy=false;
 function mode(on){editing=on;for(const k of fields)form.elements[k].disabled=!on;save.hidden=!on;edit.hidden=on;}
 function showEmailState(user){emailNotice.hidden=!user.new_email;emailNotice.textContent=user.new_email?'Yangi emailni tasdiqlang: '+user.new_email+'. Tasdiqlash yakunlanguncha avvalgi email ishlatiladi.':'';}
 try{
  await ZavoCustomer.callback();const initial=await ZavoCustomer.user();if(!initial){location.replace('customer-login.html?next=profile.html');return;}
  const p=await ZavoCustomer.profile(initial);for(const k of fields.filter(k=>k!=='email'))form.elements[k].value=p[k]||'';form.elements.email.value=initial.email||'';showEmailState(initial);form.hidden=false;mode(false);status.textContent='Shaxsiy ma’lumotlaringiz va yetkazib berish manzili.';
  ZavoCustomer.api().auth.onAuthStateChange((event,session)=>{
   if(event==='SIGNED_OUT'){form.hidden=true;location.replace('customer-login.html?next=profile.html');return;}
   if(session?.user?.id&&session.user.id!==initial.id){form.hidden=true;location.replace('profile.html');return;}
   if(event==='USER_UPDATED')setTimeout(async()=>{const current=await ZavoCustomer.user();if(current?.id!==initial.id)return;if(!editing&&!busy)form.elements.email.value=current.email||'';showEmailState(current);},0);
  });
  edit.addEventListener('click',()=>{if(busy)return;mode(true);form.elements.first_name.focus();});
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(busy||!editing)return;busy=true;save.disabled=true;status.textContent='Saqlanmoqda…';let profileSaved=false;
   try{
    const current=await ZavoCustomer.user();if(current?.id!==initial.id)throw new Error('Hisob sessiyasi tugagan. Qayta kiring.');
    const values={user_id:initial.id};for(const k of fields.filter(k=>k!=='email'))values[k]=form.elements[k].value.trim();values.phone=values.phone.replace(/[^0-9+]/g,'');
    const email=form.elements.email.value.trim();
    if(!values.first_name||!values.last_name||values.first_name.length>50||values.last_name.length>50)throw new Error('Ism va familiyangizni to‘g‘ri kiriting.');
    if(!/^\+?[0-9]{9,15}$/.test(values.phone))throw new Error('Telefon raqamini to‘g‘ri kiriting.');
    if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Email manzilini to‘g‘ri kiriting.');
    if(values.address.length>500||values.region.length>100)throw new Error('Manzil juda uzun. Qisqaroq manzil kiriting.');
    const {address,...payload}=values;
    const {error}=await ZavoCustomer.api().from('customer_profiles').upsert({...payload,delivery_address:address},{onConflict:'user_id'});if(error)throw new Error('Profilni saqlab bo‘lmadi. Qayta urinib ko‘ring.');profileSaved=true;
    ZavoCustomer.notifyProfileChange();
    let pendingEmail=false,actualEmail=current.email;
    if(email.toLowerCase()!==(current.email||'').toLowerCase()){
     const target=new URL('profile.html',location.href);target.searchParams.set('auth','email_change');
     const result=await ZavoCustomer.api().auth.updateUser({email},{emailRedirectTo:target.href});
     if(result.error)throw new Error('Profil saqlandi, lekin emailni o‘zgartirib bo‘lmadi. Qayta urinib ko‘ring.');
     const verified=await ZavoCustomer.user();if(verified?.id!==initial.id)throw new Error('Profil saqlandi. Hisobingizga qayta kiring.');
     actualEmail=verified.email||current.email;pendingEmail=actualEmail.toLowerCase()!==email.toLowerCase();
     showEmailState(pendingEmail?{new_email:email}:verified);
    }
    form.elements.email.value=actualEmail||'';for(const k of fields.filter(k=>k!=='email'))form.elements[k].value=values[k];
    mode(false);status.textContent="Ma'lumotlar saqlandi";
    ZavoCustomer.notifyProfileChange();
   }catch(error){status.textContent=error.message||'Profilni saqlab bo‘lmadi. Qayta urinib ko‘ring.';if(profileSaved)ZavoCustomer.notifyProfileChange();}
   finally{busy=false;save.disabled=false;}
  });
 }catch(error){status.textContent=error.message||'Profilni yuklab bo‘lmadi. Sahifani qayta oching.';}
})();

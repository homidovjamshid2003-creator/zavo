'use strict';
(() => {
 if(ZavoBackend.recoveryRedirectPending)return;
 const form=document.querySelector('#customer-register-form'),error=document.querySelector('#customer-error'),button=document.querySelector('#customer-submit'),notice=document.querySelector('#customer-notice');
 form.addEventListener('submit',async e=>{e.preventDefault();if(button.disabled)return;error.hidden=true;
 const f=form.elements,p=f.password.value;
 if(!f.first_name.value.trim()||!f.last_name.value.trim()){error.textContent='Ism va familiyangizni kiriting.';error.hidden=false;return;}
 if(p!==f.repeat.value){error.textContent='Parollar bir xil bo‘lishi kerak.';error.hidden=false;return;}
 if(!ZavoCustomer.strong(p)){error.textContent='Kamida 12 belgi, katta va kichik harf, raqam va maxsus belgi kiriting.';error.hidden=false;return;}
 const phone=f.phone.value.replace(/[^0-9+]/g,'');if(!/^\+?[0-9]{9,15}$/.test(phone)){error.textContent='Telefon raqamini to‘g‘ri kiriting.';error.hidden=false;return;}
 button.disabled=true;
 try{const {data,error:failure}=await ZavoCustomer.api().auth.signUp({email:f.email.value.trim(),password:p,options:{data:{first_name:f.first_name.value.trim(),last_name:f.last_name.value.trim(),phone},emailRedirectTo:new URL('index.html',location.href).href}});if(failure)throw new Error('Ro‘yxatdan o‘tib bo‘lmadi. Ma’lumotlarni tekshiring yoki hisobingizga kiring.');
 if(data.session){location.replace('index.html');}else{notice.hidden=false;notice.textContent='Emailingizga tasdiqlash havolasi yuborildi. Hisobni ochish uchun havolani bosing.';}
 }catch(failure){error.textContent=failure.message;error.hidden=false;}finally{f.password.value='';f.repeat.value='';button.disabled=false;}});
})();

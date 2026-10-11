'use strict';
(() => {
  if(ZavoBackend.recoveryRedirectPending)return;
  const form=document.querySelector('#login-form'),errorNode=document.querySelector('#login-error'),button=document.querySelector('#login-submit'),forgot=document.querySelector('#forgot-password'),notice=document.querySelector('#login-notice'),email=document.querySelector('#login-email'),password=document.querySelector('#login-password');
  let busy=false;
  function pending(value){busy=value;button.disabled=value;forgot.disabled=value;}
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;pending(true);errorNode.hidden=true;
    try{await ZavoBackend.signIn(email.value.trim(),password.value);password.value='';location.replace('admin.html');}
    catch(error){errorNode.textContent=error.message;errorNode.hidden=false;password.value='';}
    finally{pending(false);}
  });
  forgot.addEventListener('click',async()=>{
    if(busy)return;
    if(!email.checkValidity()){email.reportValidity();email.focus();return;}
    pending(true);errorNode.hidden=true;notice.hidden=true;
    try{
      const target=new URL('reset-password.html',location.href);
      if(!/^https?:$/.test(target.protocol))throw new Error('Saytni HTTP yoki HTTPS manzili orqali oching.');
      const {error}=await ZavoBackend.getClient().auth.resetPasswordForEmail(email.value.trim(),{redirectTo:target.href});
      if(error)throw new Error('Tiklash havolasini yuborib bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.');
      notice.textContent='Agar ushbu emailga tegishli hisob mavjud bo‘lsa, parolni tiklash havolasi yuboriladi. Email va spam jildini tekshiring.';notice.hidden=false;
    }catch(error){errorNode.textContent=error.message;errorNode.hidden=false;}
    finally{pending(false);}
  });
  if(!ZavoBackend.configured()){errorNode.textContent='Supabase ulanishi hali sozlanmagan. SETUP.md qo‘llanmasiga qarang.';errorNode.hidden=false;pending(true);return;}
  const url=typeof location.href==='string'?new URL(location.href):null;
  if(url?.searchParams.get('password_updated')==='1'){
    notice.textContent='Parol muvaffaqiyatli yangilandi. Yangi parolingiz bilan kiring.';notice.hidden=false;
    url.searchParams.delete('password_updated');history.replaceState(null,'',url.pathname+url.search);return;
  }
  ZavoBackend.requireAdmin().then(()=>location.replace('admin.html')).catch(()=>{});
})();

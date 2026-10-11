'use strict';
(() => {
 if(ZavoBackend.recoveryRedirectPending)return;
 const form=document.querySelector('#customer-login-form'),error=document.querySelector('#customer-error'),button=document.querySelector('#customer-submit');
 form.addEventListener('submit',async e=>{e.preventDefault();if(button.disabled)return;button.disabled=true;error.hidden=true;
 try{const {error:failure}=await ZavoCustomer.api().auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});if(failure)throw new Error('Email yoki parol noto‘g‘ri. Emailingiz tasdiqlanganini tekshiring.');location.replace(ZavoCustomer.next());}
 catch(failure){error.textContent=failure.message;error.hidden=false;}finally{form.elements.password.value='';button.disabled=false;}});
})();

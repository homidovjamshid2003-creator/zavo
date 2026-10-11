'use strict';
// These values are public. A service_role / secret key must NEVER be used here.
window.ZAVO_SUPABASE = Object.freeze({
  url: 'https://vtsaliynovskigpqmpkl.supabase.co',
  publishableKey: 'sb_publishable_Zq-28CFdBTQLm13wktWPQg_1gNHjVRO', // Supabase publishable key or legacy anon key
  turnstileSiteKey: '0x4AAAAAAFTPBSq3wkKWkwD2'
});
window.ZavoBackend = (() => {
  let client;
  let recoveryRedirectPending=false;
  if (typeof location !== 'undefined' && location.href) {
    const current=new URL(location.href), fragment=new URLSearchParams(current.hash.slice(1));
    const recovery=fragment.get('type')==='recovery'||current.searchParams.get('type')==='recovery'||(current.searchParams.has('code')&&!(current.pathname.endsWith('/profile.html')&&current.searchParams.get('auth')==='email_change'));
    if(recovery && !current.pathname.endsWith('/reset-password.html')) {
      const target=new URL('reset-password.html',current);target.search=current.search;target.hash=current.hash;
      recoveryRedirectPending=true;location.replace(target.href);
    }
  }
  const config = window.ZAVO_SUPABASE;
  function configured() { return /^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(config.url) && !!config.publishableKey; }
  function getClient() {
    if (!configured()) throw new Error('Supabase ulanishi hali sozlanmagan.');
    if (!window.supabase?.createClient) throw new Error('Ulanish kutubxonasi yuklanmadi. Internet aloqasini tekshiring.');
    if (/^sb_secret_/.test(config.publishableKey)) throw new Error('Faqat ochiq publishable yoki anon kalitdan foydalaning.');
    try { const payload=JSON.parse(atob(config.publishableKey.split('.')[1]||'')); if(payload.role==='service_role') throw new Error('Maxfiy kalitni brauzerda ishlatish mumkin emas.'); }
    catch(error) { if(error.message==='Maxfiy kalitni brauzerda ishlatish mumkin emas.') throw error; }
    client ||= window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return client;
  }
  async function requireAdmin() {
    const c=getClient(); const {data,error}=await c.auth.getUser();
    if(error || !data.user) throw new Error('Avval hisobingizga kiring.');
    const role=await c.rpc('is_admin'); if(role.error || role.data!==true) throw new Error('Bu hisobda boshqaruv huquqi yo‘q.');
    return data.user;
  }
  async function signIn(email,password) { const c=getClient();const {error}=await c.auth.signInWithPassword({email,password});if(error)throw new Error('Email yoki parol noto‘g‘ri. Qayta urinib ko‘ring.');try{return await requireAdmin();}catch(error){await c.auth.signOut();throw error;} }
  async function signOut() { const {error}=await getClient().auth.signOut();if(error)throw new Error('Hisobdan chiqib bo‘lmadi. Qayta urinib ko‘ring.'); }
  return {config,configured,getClient,requireAdmin,signIn,signOut,recoveryRedirectPending};
})();

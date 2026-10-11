import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(v=>v.trim()).filter(Boolean);
const url = Deno.env.get('SUPABASE_URL') || '';
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const captchaSecret = Deno.env.get('TURNSTILE_SECRET_KEY') || '';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') || '';
  const headers = {'Content-Type':'application/json','Access-Control-Allow-Origin':allowedOrigins.includes(origin)?origin:'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
  const respond = (status: number, data: unknown) => new Response(JSON.stringify(data),{status,headers});
  if (!allowedOrigins.includes(origin)) return respond(403,{error:'Bu manzildan buyurtma yuborishga ruxsat yo‘q.'});
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (request.method !== 'POST') return respond(405,{error:'So‘rov turi noto‘g‘ri.'});
  if (!url || !key || !captchaSecret) return respond(503,{error:'Buyurtma xizmati hali sozlanmagan.'});
  try {
    if (Number(request.headers.get('content-length') || 0)>32768) return respond(413,{error:'So‘rov juda katta.'});
    const text = await request.text();
    if (text.length>32768) return respond(413,{error:'So‘rov juda katta.'});
    const body = JSON.parse(text), c = body.customer;
    if (!c || typeof c.name!=='string' || !c.name.trim() || c.name.length>100 || typeof c.phone!=='string' || !/^\+?[0-9\s()-]{9,24}$/.test(c.phone) || !/^\+?[0-9]{9,15}$/.test(c.phone.replace(/[^0-9+]/g,'')) || typeof c.region!=='string' || !c.region.trim() || c.region.length>100 || typeof c.address!=='string' || !c.address.trim() || c.address.length>500 || (c.comment!==undefined && (typeof c.comment!=='string'||c.comment.length>1000))) return respond(400,{error:'Xaridor ma’lumotlarini tekshiring.'});
    if (!Array.isArray(body.items) || body.items.length<1 || body.items.length>50 || body.items.some((i: {id:number;quantity:number})=>!i || !Number.isSafeInteger(i.id)||i.id<1||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>99) || new Set(body.items.map((i:{id:number})=>i.id)).size!==body.items.length) return respond(400,{error:'Savat ma’lumotlari noto‘g‘ri.'});
    if (!['cash','installment'].includes(body.payment) || (body.payment==='installment'&&! [3,6,9,12].includes(body.months)) || !uuid.test(body.token)) return respond(400,{error:'To‘lov ma’lumotlarini tekshiring.'});
    if (typeof body.captcha!=='string' || !body.captcha || body.captcha.length>2048) return respond(400,{error:'Xavfsizlik tekshiruvini yakunlang.'});
    const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    let customerId: string | null = null;
    const bearer=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'') || '';
    if(bearer && bearer!==Deno.env.get('SUPABASE_ANON_KEY') && !bearer.startsWith('sb_publishable_')) {
      const identity=await client.auth.getUser(bearer);
      if(identity.error || !identity.data.user) return respond(401,{error:'Hisob sessiyasi tugagan. Qayta kiring.'});
      customerId=identity.data.user.id;
    }
    // Never trust customer IDs submitted in JSON. Identity comes from verified JWT only.
    const customer={name:c.name,phone:c.phone,region:c.region,address:c.address,comment:c.comment,email:c.email,_account_id:customerId};
    if(c.email!==undefined && (typeof c.email!=='string'||c.email.length>254||(c.email!==''&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)))) return respond(400,{error:'Email manzilini tekshiring.'});
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const hashBuffer = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${captchaSecret}:${ip}`));
    const ipHash = Array.from(new Uint8Array(hashBuffer)).map(n=>n.toString(16).padStart(2,'0')).join('');
    const limit = await client.rpc('checkout_rate_limit',{p_ip_hash:ipHash});
    if (limit.error) return respond(503,{error:'Buyurtma xizmati vaqtincha ishlamayapti.'});
    if (!limit.data) return respond(429,{error:'Juda ko‘p so‘rov yuborildi. Keyinroq urinib ko‘ring.'});
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:captchaSecret,response:body.captcha,remoteip:ip==='unknown'?'':ip}),signal:AbortSignal.timeout(10000)});
    const verification = await check.json();
    if (!verification.success || verification.action!=='checkout' || !allowedOrigins.some(o=>new URL(o).hostname===verification.hostname)) return respond(403,{error:'Xavfsizlik tekshiruvi o‘tmadi. Qayta urinib ko‘ring.'});
    const result = await client.rpc('create_order',{p_customer:customer,p_items:body.items.map((i:{id:number;quantity:number})=>({id:i.id,quantity:i.quantity})),p_payment:body.payment,p_months:body.payment==='installment'?body.months:null,p_token:body.token});
    if (result.error) {
      const message = result.error.message.includes('mavjudligi') ? 'Mahsulot mavjudligi o‘zgardi. Savatni yangilang.' : result.error.message.includes('faqat naqd') ? 'Tanlangan mahsulot uchun faqat naqd to‘lov mavjud.' : 'Buyurtmani saqlab bo‘lmadi. Ma’lumotlarni tekshiring.';
      return respond(400,{error:message});
    }
    return respond(200,{order:result.data});
  } catch { return respond(503,{error:'Xizmat bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.'}); }
});

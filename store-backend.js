'use strict';
// Adapter preserves the existing storefront product shape; the database is authoritative.
window.createZavoStore = function({categories,seedProducts,productPlaceholder,money,calculateInstallment,installmentPeriods}) {
  const B=window.ZavoBackend, statuses=['Yangi','Tasdiqlandi','Yetkazilmoqda','Yetkazildi','Bekor qilindi'];
  const originalCategories=categories.map(c=>({...c}));
  let products=B.configured()?[]:seedProducts, orders=[], banners=[], connected=false, adminMode=false;
  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl=value=>typeof value==='string' && /^https:\/\//i.test(value)?value:'';
  async function rows(table,select='*',active=false) {
    const result=[];
    for(let offset=0;;offset+=500){let query=B.getClient().from(table).select(select).order('id').range(offset,offset+499);if(active)query=query.eq('is_active',true);const {data,error}=await query;if(error)throw new Error('Ma’lumotlarni yuklab bo‘lmadi. Ulanish va baza ruxsatlarini tekshiring.');result.push(...data);if(data.length<500)break;}
    return result;
  }
  function adaptProduct(p) {
    const price=Number(p.discount_price||p.cash_price),imgs=(p.product_images||[]).slice().sort((a,b)=>a.sort_order-b.sort_order);
    const result={id:Number(p.id),name:p.name,category:p.category_id,description:p.description,cashPrice:Number(p.cash_price),discountPrice:Number(p.discount_price||0),price,oldPrice:p.discount_price?Number(p.cash_price):0,stock:p.stock_quantity,available:p.stock_quantity>0&&p.is_active,installment:p.installment_enabled,isActive:p.is_active,images:imgs.map(i=>({id:Number(i.id),url:safeUrl(i.image_url),sortOrder:i.sort_order})),alt:p.name,badge:p.discount_price?`−${Math.round((1-price/Number(p.cash_price))*100)}%`:'ZAVO tanlovi',specs:[]};
    result.image=result.images[0]?.url||productPlaceholder(result);result.updatedAt=p.updated_at;return result;
  }
  function adaptOrder(o) {return {id:o.id,customer:{name:o.customer_name,phone:o.phone,region:o.region,address:o.address,comment:o.comment},items:(o.order_items||[]).map(i=>({id:i.product_id,name:i.product_name,quantity:i.quantity,price:Number(i.unit_price),total:Number(i.total_price)})),payment:o.payment_type,months:o.installment_months||0,monthly:Number(o.monthly_payment),total:Number(o.total_amount),date:o.created_at,status:o.status};}
  async function refresh(asAdmin=adminMode) {
    if(!B.configured()){connected=false;return;}
    if(asAdmin)await B.requireAdmin();
    try {
      const [categoryRows,productRows,bannerRows,orderRows]=await Promise.all([rows('categories','*',!asAdmin),rows('products','*,product_images(id,image_url,sort_order)',!asAdmin),rows('banners','*',!asAdmin),asAdmin?rows('orders','*,order_items(*)'):Promise.resolve([])]);
      categories.splice(0,categories.length,...categoryRows.map(c=>{const original=originalCategories.find(x=>x.id===c.id);return {id:c.id,name:c.name,image:safeUrl(c.image_url)||original?.image||'',icon:original?.icon||'headphones',description:original?.description||'Siz uchun yaxshi tanlov',isActive:c.is_active};}));
      const categoryIds=new Set(categories.map(c=>c.id));products=productRows.filter(p=>categoryIds.has(p.category_id)).map(adaptProduct);
      orders=orderRows.map(adaptOrder).sort((a,b)=>new Date(b.date)-new Date(a.date));banners=bannerRows.sort((a,b)=>a.sort_order-b.sort_order||a.id-b.id);connected=true;adminMode=asAdmin;
    }catch(error){connected=false;throw error;}
  }
  async function init(){await refresh(false);}
  async function loadAdmin(){await refresh(true);}
  async function saveProduct(p,images) {
    await B.requireAdmin();
    if(!p.name.trim()||!Number.isSafeInteger(p.cashPrice)||p.cashPrice<1||p.cashPrice>1e12||!Number.isSafeInteger(p.discountPrice)||p.discountPrice<0||(p.discountPrice&&p.discountPrice>=p.cashPrice)||!Number.isInteger(p.stock)||p.stock<0||p.stock>1000000||images.length>12||images.some(i=>!safeUrl(i)))throw new Error('Nom, narx, qoldiq va rasmlarni tekshiring.');
    const {data,error}=await B.getClient().rpc('save_product',{p_id:p.id||null,p_product:{name:p.name.trim(),category_id:p.category,description:p.description||'',cash_price:p.cashPrice,discount_price:p.discountPrice||null,stock_quantity:p.stock,installment_enabled:p.installment,is_active:p.isActive,expected_updated_at:p.expectedUpdatedAt||null},p_images:images});
    if(error)throw new Error(error.message.includes('yangilangan')?'Mahsulot boshqa joyda yangilangan. Ma’lumotlarni qayta ochib tahrirlang.':'Mahsulotni saqlab bo‘lmadi. Narx, kategoriya va ruxsatlarni tekshiring.');return Number(data);
  }
  function storagePath(url) { const prefix=`${B.config.url.replace(/\/$/,'')}/storage/v1/object/public/zavo-images/`;return url.startsWith(prefix)?decodeURIComponent(url.slice(prefix.length).split('?')[0]):null; }
  async function removeFiles(urls){
    const owned=urls.filter(url=>storagePath(url));if(!owned.length)return;await B.requireAdmin();
    // A timeout may occur after a database commit. Never delete still-referenced files.
    const results=await Promise.all(['product_images','categories','banners'].map(table=>B.getClient().from(table).select('image_url').in('image_url',owned)));
    if(results.some(r=>r.error))throw new Error('Rasm havolalarini tekshirib bo‘lmadi. Fayllar saqlandi.');
    const referenced=new Set(results.flatMap(r=>r.data.map(i=>i.image_url))),paths=owned.filter(url=>!referenced.has(url)).map(storagePath);if(!paths.length)return;
    const {error}=await B.getClient().storage.from('zavo-images').remove(paths);if(error)throw new Error('Rasm fayllarini tozalab bo‘lmadi. Storage bo‘limini tekshiring.');
  }
  async function deleteProduct(id){await B.requireAdmin();const product=products.find(p=>p.id===id);const {error}=await B.getClient().from('products').delete().eq('id',id);if(error)throw new Error('Mahsulotni o‘chirib bo‘lmadi.');try{await removeFiles(product?.images.map(i=>i.url)||[]);}catch{return 'Mahsulot o‘chirildi. Eski rasm fayllarini Storage bo‘limida tozalang.';}return '';}
  async function setProductActive(id,active){await B.requireAdmin();const {error}=await B.getClient().from('products').update({is_active:active}).eq('id',id);if(error)throw new Error('Mahsulot holatini saqlab bo‘lmadi.');}
  async function setStatus(id,status){await B.requireAdmin();const {error}=await B.getClient().rpc('change_order_status',{p_id:id,p_status:status});if(error)throw new Error(error.message.includes('omborda')?'Tasdiqlash uchun omborda yetarli mahsulot yo‘q.':'Bu holatga o‘tish mumkin emas yoki saqlash muvaffaqiyatsiz.');}
  async function uploadImage(file,folder='products'){
    await B.requireAdmin();if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||file.size>5*1024*1024)throw new Error('PNG, JPG, WEBP yoki GIF rasm tanlang. Hajmi 5 MB dan oshmasin.');
    const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[file.type],path=`${folder}/${crypto.randomUUID()}.${ext}`;
    const {error}=await B.getClient().storage.from('zavo-images').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});if(error)throw new Error('Rasmni yuklab bo‘lmadi. Storage ruxsatlarini tekshiring.');return B.getClient().storage.from('zavo-images').getPublicUrl(path).data.publicUrl;
  }
  async function saveCategory(c){await B.requireAdmin();const {error}=await B.getClient().from('categories').upsert({id:c.id,name:c.name,image_url:c.image||'',is_active:c.isActive});if(error)throw new Error('Kategoriyani saqlab bo‘lmadi. Identifikator va nomni tekshiring.');}
  async function deleteCategory(id){await B.requireAdmin();const {error}=await B.getClient().from('categories').delete().eq('id',id);if(error)throw new Error('Avval bu kategoriyadagi mahsulotlarni boshqa kategoriyaga o‘tkazing.');}
  async function saveBanner(b){await B.requireAdmin();const payload={title:b.title,subtitle:b.subtitle,image_url:b.image||'',button_text:b.buttonText,link:b.link,is_active:b.isActive,sort_order:b.sortOrder};const q=b.id?B.getClient().from('banners').update(payload).eq('id',b.id):B.getClient().from('banners').insert(payload);const {error}=await q;if(error)throw new Error('Bannerni saqlab bo‘lmadi. Sarlavha va havolani tekshiring.');}
  async function deleteBanner(id){await B.requireAdmin();const {error}=await B.getClient().from('banners').delete().eq('id',id);if(error)throw new Error('Bannerni o‘chirib bo‘lmadi.');}
  async function createOrder(customer,cart,payment,months,captcha,token){
    if(customer.first_name!==undefined)customer={...customer,name:[customer.first_name,customer.last_name].map(v=>String(v||'').trim()).filter(Boolean).join(' ').slice(0,100)};
    if(!connected||!B.config.turnstileSiteKey)throw new Error('Buyurtma xizmati hali sozlanmagan.');
    const customerClient=window.ZavoCustomer?.api();
    const auth=customerClient?await customerClient.auth.getSession():null;
    if(auth?.error)throw new Error('Hisob sessiyasi tugagan. Qayta kiring.');
    const headers={Authorization:'Bearer '+(auth?.data?.session?.access_token||B.config.publishableKey)};
    const {data,error}=await B.getClient().functions.invoke('checkout',{headers,body:{customer,items:cart.map(i=>({id:i.id,quantity:i.quantity})),payment,months,captcha,token}});
    if(error){let message='Buyurtma xizmatiga ulanib bo‘lmadi. Qayta urinib ko‘ring.';try{const body=await error.context.json();message=body.error||message;}catch{}throw new Error(message);}if(data.error)throw new Error(data.error);return data.order;
  }
  function subscribe(callback,includeOrders=false){if(!B.configured())return ()=>{};let timer;const tables=['products','product_images','categories','banners',...(includeOrders?['orders']:[])];let channel=B.getClient().channel(`zavo-${crypto.randomUUID()}`);for(const table of tables)channel=channel.on('postgres_changes',{event:'*',schema:'public',table},()=>{clearTimeout(timer);timer=setTimeout(callback,250);});channel.subscribe();return ()=>{clearTimeout(timer);B.getClient().removeChannel(channel);};}
  return {categories,money,calculateInstallment,installmentPeriods,statuses,escapeHTML,init,refresh,loadAdmin,getProducts:()=>products,getOrders:()=>orders,getBanners:()=>banners,isConnected:()=>connected,saveProduct,deleteProduct,setProductActive,setStatus,uploadImage,removeFiles,saveCategory,deleteCategory,saveBanner,deleteBanner,createOrder,subscribe};
};

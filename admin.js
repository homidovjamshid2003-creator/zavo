'use strict';
(async () => {
if(ZavoBackend.recoveryRedirectPending)return;
try { await ZavoBackend.requireAdmin(); } catch { location.replace('login.html'); return; }

const S = ZavoStore, $ = selector => document.querySelector(selector), esc = S.escapeHTML, sum = value => `${S.money(value)} so‘m`;
let products = [], orders = [], deleteId = null, deleteKind = 'product', toastTimer, editorImages = [], originalImages = [], editorVersion = null, busy = false, manageKind = '', manageId = null, reloadPromise;
const form = $('#product-form');
function toast(message) { clearTimeout(toastTimer); const node=$('#admin-toast'), host=[...document.querySelectorAll('dialog')].find(d=>d.open)||document.body; host.append(node); node.textContent=message; node.classList.add('visible'); toastTimer=setTimeout(()=>node.classList.remove('visible'),3500); }
function switchView(view) { if (!['dashboard','products','orders','categories','banners'].includes(view)) return; ['dashboard','products','orders'].forEach(v=>$(`#${v}-view`).hidden=v!==view); document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view)); $('#page-title').textContent={dashboard:'Umumiy ko‘rinish',products:'Mahsulotlar',orders:'Buyurtmalar',categories:'Kategoriyalar',banners:'Bannerlar'}[view]; $('#sidebar').classList.remove('open'); $('#menu-toggle').setAttribute('aria-expanded','false'); }
async function reload() { if(reloadPromise)return reloadPromise;reloadPromise=(async()=>{await S.loadAdmin();products=S.getProducts();orders=S.getOrders();render();renderManagement();syncCategories();$('#admin-notice').textContent='Ma’lumotlar Supabase bilan sinxronlangan.';})();try{await reloadPromise;}catch(error){$('#admin-notice').textContent=error.message;if(/hisobingizga|boshqaruv huquqi/.test(error.message)){$('#admin-shell').hidden=true;location.replace('login.html');}throw error;}finally{reloadPromise=null;} }
function render() {
  const completed=orders.filter(o=>o.status==='Yetkazildi'), pending=orders.filter(o=>['Yangi','Tasdiqlandi','Yetkazilmoqda'].includes(o.status));
  const metrics=[['Mahsulotlar',products.length,'Katalogdagi jami mahsulotlar'],['Buyurtmalar',orders.length,'Barcha buyurtmalar'],['Kutilayotgan',pending.length,'Faol buyurtmalar'],['Yetkazilgan',completed.length,'Yakunlangan buyurtmalar'],['Jami savdo',sum(completed.reduce((n,o)=>n+o.total,0)),'Faqat yetkazilgan buyurtmalar']];
  $('#metrics').innerHTML=metrics.map(([title,value,note],i)=>`<article class="metric ${i===4?'sales':''}"><span>${title}</span><strong>${esc(value)}</strong><small>${note}</small></article>`).join('');
  $('#recent-orders').innerHTML=orders.length ? [...orders].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5).map(o=>`<div class="recent-item"><div><strong>${esc(o.customer?.name)}</strong><small>${esc(o.id)} · ${date(o.date)}</small></div><div><strong>${sum(o.total)}</strong><small>${esc(o.status)}</small></div></div>`).join('') : '<p class="empty">Hozircha buyurtma yo‘q. Birinchi buyurtma shu yerda ko‘rinadi.</p>';
  renderProducts(); renderOrders();
}
function date(value) { const d=new Date(value); return Number.isNaN(d.valueOf()) ? 'Sana kiritilmagan' : d.toLocaleString('uz-UZ',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function renderProducts() {
  const query=$('#product-search').value.toLocaleLowerCase(), category=$('#category-filter').value;
  const list=products.filter(p=>(category==='all'||p.category===category)&&p.name.toLocaleLowerCase().includes(query));
  $('#product-count').textContent=`${list.length} ta mahsulot`; $('#products-empty').hidden=!!list.length;
  $('#product-rows').innerHTML=list.map(p=>`<tr><td><div class="product-cell"><img src="${esc(p.image)}" alt="" loading="lazy"><div><strong>${esc(p.name)}</strong><small>#${p.id} · ${p.isActive?'Faol':'Yashirilgan'}</small></div></div></td><td>${esc(S.categories.find(c=>c.id===p.category).name)}</td><td><strong>${sum(p.price)}</strong>${p.discountPrice?`<small><s>${sum(p.cashPrice)}</s></small>`:''}</td><td><span class="pill ${p.stock?'':'zero'}">${p.stock} ta</span></td><td>${p.installment?'Mavjud':'Mavjud emas'}</td><td><div class="row-actions"><button data-active="${p.id}">${p.isActive?'Yashirish':'Faollashtirish'}</button><button data-edit="${p.id}">Tahrirlash</button><button data-delete="${p.id}">O‘chirish</button></div></td></tr>`).join('');
}
function renderOrders() {
  const query=$('#order-search').value.toLocaleLowerCase(), status=$('#status-filter').value;
  const list=orders.filter(o=>(status==='all'||o.status===status)&&`${o.id} ${o.customer?.name} ${o.customer?.phone} ${o.customer?.address} ${o.items.map(i=>i.name).join(' ')}`.toLocaleLowerCase().includes(query));
  $('#order-count').textContent=`${list.length} ta buyurtma`; $('#orders-empty').hidden=!!list.length;
  $('#order-rows').innerHTML=list.map(o=>`<tr><td><button class="text-button" data-order-detail="${esc(o.id)}">${esc(o.id.slice(0,8).toUpperCase())} ↗</button><small>${date(o.date)}</small></td><td><strong>${esc(o.customer?.name)}</strong><small>${esc(o.customer?.phone)}</small><small class="address">${esc(o.customer?.region)} · ${esc(o.customer?.address)}</small></td><td class="order-products">${o.items.map(i=>`${esc(i.name)} <strong>× ${esc(i.quantity)}</strong>`).join('<br>')}</td><td>${o.payment==='installment'?`Muddatli · ${esc(o.months)} oy<small>${sum(o.monthly)} / oy</small>`:'Naqd'}</td><td><strong>${sum(o.total)}</strong></td><td><select class="status-select" data-order="${esc(o.id)}" aria-label="${esc(o.id)} holati">${S.statuses.map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select></td></tr>`).join('');
}
function syncCategories() {
 const selected=$('#category-filter').value;
 $('#category-filter').innerHTML='<option value="all">Barcha kategoriyalar</option>'+S.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
 $('#category-filter').value=S.categories.some(c=>c.id===selected)?selected:'all';
 if(!$('#product-dialog').open) form.elements.category.innerHTML=S.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}${c.isActive?'':' (yashirilgan)'}</option>`).join('');
}
function clearPreviews(){editorImages.forEach(i=>{if(i.file)URL.revokeObjectURL(i.preview);});}
function imageList(){ $('#product-image-list').innerHTML=editorImages.length?editorImages.map((i,n)=>`<div class="admin-image-item"><img src="${esc(i.url||i.preview)}" alt="Mahsulot rasmi ${n+1}"><small>${n===0?'Muqova':`${n+1}-rasm`}</small><div><button type="button" data-image-up="${n}" ${n===0?'disabled':''} aria-label="Rasmni oldinga surish">←</button><button type="button" data-image-remove="${n}" aria-label="Rasmni olib tashlash">×</button></div></div>`).join(''):'<p>Rasm tanlanmagan. Namunaviy tasvir ishlatiladi.</p>'; }
function openEditor(id){
 clearPreviews();form.reset();busy=false;$('#save-product').disabled=false;$('#form-error').hidden=true;
 form.elements.category.innerHTML=S.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
 const p=products.find(p=>p.id===Number(id));form.elements.id.value=p?.id||'';$('#editor-title').textContent=p?'Mahsulotni tahrirlash':'Mahsulot qo‘shish';
 editorVersion=p?.updatedAt||null;editorImages=(p?.images||[]).map(i=>({url:i.url}));originalImages=editorImages.map(i=>i.url);
 if(p){for(const key of ['name','category','stock','cashPrice','discountPrice','description'])form.elements[key].value=p[key]||'';form.elements.stock.value=p.stock;form.elements.installment.checked=p.installment;form.elements.isActive.checked=p.isActive;}
 imageList();$('#product-dialog').showModal();
}
function showError(message){$('#form-error').textContent=message;$('#form-error').hidden=false;}
function addImageUrl(){if(busy)return;const url=form.elements.image.value.trim();if(!url)return;if(!/^https:\/\//i.test(url)){showError('Rasm havolasi https bilan boshlanishi kerak.');return;}if(editorImages.length>=12){showError('Eng ko‘pi 12 ta rasm qo‘shish mumkin.');return;}editorImages.push({url});form.elements.image.value='';imageList();}
$('#image-add-url').addEventListener('click',addImageUrl);
$('#image-file').addEventListener('change',e=>{if(busy)return;const files=[...e.target.files];if(files.length+editorImages.length>12){showError('Eng ko‘pi 12 ta rasm qo‘shish mumkin.');e.target.value='';return;}for(const file of files){if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>5*1024*1024){showError('Har bir rasm PNG, JPG, WEBP yoki GIF bo‘lishi va 5 MB dan oshmasligi kerak.');continue;}editorImages.push({file,preview:URL.createObjectURL(file)});}e.target.value='';imageList();});
$('#product-image-list').addEventListener('click',e=>{if(busy)return;const remove=e.target.closest('[data-image-remove]'),up=e.target.closest('[data-image-up]');if(remove){const [i]=editorImages.splice(Number(remove.dataset.imageRemove),1);if(i?.file)URL.revokeObjectURL(i.preview);}if(up){const n=Number(up.dataset.imageUp);if(n>0)[editorImages[n-1],editorImages[n]]=[editorImages[n],editorImages[n-1]];}imageList();});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;if(form.elements.image.value.trim())addImageUrl();if(form.elements.image.value.trim())return;
 const data=Object.fromEntries(new FormData(form));const product={id:Number(data.id)||null,expectedUpdatedAt:editorVersion,name:data.name,category:data.category,cashPrice:Number(data.cashPrice),discountPrice:Number(data.discountPrice||0),stock:Number(data.stock),description:data.description,installment:form.elements.installment.checked,isActive:form.elements.isActive.checked};
 busy=true;$('#save-product').disabled=true;$('#form-error').hidden=true;const uploaded=[];let committed=false;
 try{const urls=[];for(const image of editorImages){if(image.file){const url=await S.uploadImage(image.file);uploaded.push(url);urls.push(url);}else urls.push(image.url);}await S.saveProduct(product,urls);committed=true;let warning='';try{await S.removeFiles(originalImages.filter(url=>!urls.includes(url)));}catch{warning=' Eski fayllarni Storage bo‘limida tozalang.';}$('#product-dialog').close();clearPreviews();await reload();toast('Mahsulot saqlandi.'+warning);}
 catch(error){if(!committed&&uploaded.length)try{await S.removeFiles(uploaded);}catch{}showError(error.message);if(committed)toast('Mahsulot saqlandi, lekin ro‘yxat yangilanmadi. Sahifani yangilang.');}
 finally{busy=false;$('#save-product').disabled=false;}
});
for(const id of ['editor-close','editor-cancel'])$('#'+id).addEventListener('click',()=>{if(!busy)$('#product-dialog').close();});$('#product-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
function confirmDelete(kind,id,name){deleteKind=kind;deleteId=id;$('#delete-name').textContent=name;$('#delete-dialog').querySelector('h2').textContent={product:'Mahsulot o‘chirilsinmi?',category:'Kategoriya o‘chirilsinmi?',banner:'Banner o‘chirilsinmi?'}[kind];$('#delete-dialog').showModal();}
async function action(button,fn){if(button.disabled)return;button.disabled=true;try{await fn();}catch(error){toast(error.message);}finally{button.disabled=false;}}
$('#delete-confirm').addEventListener('click',()=>action($('#delete-confirm'),async()=>{let warning='';if(deleteKind==='product')warning=await S.deleteProduct(Number(deleteId));if(deleteKind==='category')await S.deleteCategory(deleteId);if(deleteKind==='banner')await S.deleteBanner(Number(deleteId));$('#delete-dialog').close();await reload();toast(warning||'O‘chirildi.');}));
$('#delete-cancel').addEventListener('click',()=>$('#delete-dialog').close());
function renderManagement(){
 $('#category-rows').innerHTML=S.categories.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.id)}</td><td><span class="pill ${c.isActive?'':'zero'}">${c.isActive?'Faol':'Yashirilgan'}</span></td><td><div class="row-actions"><button data-category-edit="${esc(c.id)}">Tahrirlash</button><button data-category-delete="${esc(c.id)}">O‘chirish</button></div></td></tr>`).join('')||'<tr><td colspan="4">Kategoriya hali qo‘shilmagan.</td></tr>';
 $('#banner-rows').innerHTML=S.getBanners().map(b=>`<tr><td><div class="product-cell">${b.image_url?`<img src="${esc(b.image_url)}" alt="">`:''}<strong>${esc(b.title)}</strong></div></td><td>${b.sort_order}</td><td><span class="pill ${b.is_active?'':'zero'}">${b.is_active?'Faol':'Yashirilgan'}</span></td><td><div class="row-actions"><button data-banner-edit="${b.id}">Tahrirlash</button><button data-banner-delete="${b.id}">O‘chirish</button></div></td></tr>`).join('')||'<tr><td colspan="4">Banner hali qo‘shilmagan.</td></tr>';
}
function field(name,label,value='',extra=''){return `<label class="full">${label}<input name="${name}" value="${esc(value)}" ${extra}></label>`;}
function openManagement(kind,id){manageKind=kind;manageId=id??null;$('#manage-error').hidden=true;$('#manage-title').textContent=kind==='category'?'Kategoriya ma’lumotlari':'Banner ma’lumotlari';
 let fields='';if(kind==='category'){const c=S.categories.find(c=>c.id===id);fields=field('id','Identifikator',c?.id||'','required pattern="[a-z][a-z0-9_-]{0,59}" maxlength="60" '+(c?'readonly':''))+field('name','Kategoriya nomi',c?.name||'','required maxlength="100"')+field('image','Rasm havolasi',c?.image||'','type="url"');fields+=`<label class="checkbox full"><input type="checkbox" name="isActive" ${c?.isActive!==false?'checked':''}> Kategoriya faol</label>`;}else{const b=S.getBanners().find(b=>b.id===Number(id));fields=field('title','Sarlavha',b?.title||'','required maxlength="200"')+field('subtitle','Qo‘shimcha matn',b?.subtitle||'','maxlength="500"')+field('image','Rasm havolasi',b?.image_url||'','type="url"')+field('buttonText','Tugma matni',b?.button_text||'','maxlength="80"')+field('link','Tugma havolasi',b?.link||'#catalog','required')+field('sortOrder','Ko‘rsatish tartibi',b?.sort_order??0,'type="number" min="0" step="1" required');fields+=`<label class="checkbox full"><input type="checkbox" name="isActive" ${b?.is_active!==false?'checked':''}> Banner faol</label>`;}
 fields+='<label class="full">Rasm yuklash<input type="file" name="imageFile" accept="image/png,image/jpeg,image/webp,image/gif"><small>Eng ko‘pi 5 MB.</small></label>';$('#manage-fields').innerHTML=fields;$('#manage-dialog').showModal();}
$('#manage-form').addEventListener('submit',async event=>{event.preventDefault();const mf=event.currentTarget,button=$('#manage-save');if(button.disabled)return;button.disabled=true;$('#manage-error').hidden=true;let upload='',committed=false;
 try{const data=Object.fromEntries(new FormData(mf));if(data.image&&!/^https:\/\//i.test(data.image))throw new Error('Rasm havolasi https bilan boshlanishi kerak.');const file=mf.elements.imageFile.files[0];let image=data.image;if(file){upload=await S.uploadImage(file,manageKind==='category'?'categories':'banners');image=upload;}const oldImage=manageKind==='category'?S.categories.find(c=>c.id===manageId)?.image:S.getBanners().find(b=>b.id===Number(manageId))?.image_url;
 if(manageKind==='category')await S.saveCategory({id:data.id,name:data.name,image,isActive:mf.elements.isActive.checked});else{if(!/^(https:\/\/|\/(?!\/)|#)/.test(data.link)||!Number.isInteger(Number(data.sortOrder))||Number(data.sortOrder)<0)throw new Error('Havola yoki ko‘rsatish tartibi noto‘g‘ri.');await S.saveBanner({id:manageId,title:data.title,subtitle:data.subtitle,image,buttonText:data.buttonText,link:data.link,sortOrder:Number(data.sortOrder),isActive:mf.elements.isActive.checked});}committed=true;let warning='';if(oldImage&&oldImage!==image)try{await S.removeFiles([oldImage]);}catch{warning=' Eski rasmni Storage bo‘limida tozalang.';}$('#manage-dialog').close();await reload();toast('Saqlandi.'+warning);}
 catch(error){if(upload&&!committed)try{await S.removeFiles([upload]);}catch{}$('#manage-error').textContent=error.message;$('#manage-error').hidden=false;if(committed)toast('Saqlandi. Ro‘yxatni yangilash uchun sahifani yangilang.');}finally{button.disabled=false;}
});
$('#manage-close').addEventListener('click',()=>{if(!$('#manage-save').disabled)$('#manage-dialog').close();});$('#manage-dialog').addEventListener('cancel',e=>{if($('#manage-save').disabled)e.preventDefault();});
$('#add-category').addEventListener('click',()=>openManagement('category'));$('#add-banner').addEventListener('click',()=>openManagement('banner'));
function openOrder(id){const o=orders.find(o=>o.id===id);if(!o)return;$('#order-detail-content').innerHTML=`<dl class="order-detail"><dt>Buyurtma raqami</dt><dd>${esc(o.id)}</dd><dt>Xaridor</dt><dd>${esc(o.customer.name)}</dd><dt>Telefon</dt><dd>${esc(o.customer.phone)}</dd><dt>Viloyat</dt><dd>${esc(o.customer.region)}</dd><dt>Manzil</dt><dd>${esc(o.customer.address)}</dd><dt>Izoh</dt><dd>${esc(o.customer.comment||'—')}</dd><dt>Sana</dt><dd>${date(o.date)}</dd><dt>Holat</dt><dd>${esc(o.status)}</dd><dt>To‘lov turi</dt><dd>${o.payment==='installment'?`${o.months} oyga muddatli to‘lov`:'Naqd'}</dd>${o.payment==='installment'?`<dt>Oyiga to‘lov</dt><dd>${sum(o.monthly)} / oy</dd>`:''}<dt>Jami to‘lov</dt><dd>${sum(o.total)}</dd></dl><div class="table-wrap"><table><thead><tr><th>Mahsulot</th><th>Soni</th><th>Naqd narx</th><th>Jami</th></tr></thead><tbody>${o.items.map(i=>`<tr><td class="order-products">${esc(i.name)}</td><td>${i.quantity}</td><td>${sum(i.price)}</td><td>${sum(i.total)}</td></tr>`).join('')}</tbody></table></div>`;$('#order-dialog').showModal();}
$('#order-close').addEventListener('click',()=>$('#order-dialog').close());
$('#order-rows').addEventListener('change',event=>{const target=event.target;if(!target.matches('[data-order]'))return;action(target,async()=>{try{await S.setStatus(target.dataset.order,target.value);await reload();toast('Buyurtma holati yangilandi.');}catch(error){renderOrders();throw error;}});});
document.addEventListener('click',event=>{
 const target=event.target,view=target.closest('[data-view]');if(view)switchView(view.dataset.view);if(target.closest('[data-add]'))openEditor();const edit=target.closest('[data-edit]');if(edit)openEditor(edit.dataset.edit);const del=target.closest('[data-delete]');if(del)confirmDelete('product',Number(del.dataset.delete),products.find(p=>p.id===Number(del.dataset.delete))?.name);
 const active=target.closest('[data-active]');if(active)action(active,async()=>{const p=products.find(p=>p.id===Number(active.dataset.active));await S.setProductActive(p.id,!p.isActive);await reload();toast('Mahsulot holati yangilandi.');});
 const ce=target.closest('[data-category-edit]');if(ce)openManagement('category',ce.dataset.categoryEdit);const cd=target.closest('[data-category-delete]');if(cd)confirmDelete('category',cd.dataset.categoryDelete,S.categories.find(c=>c.id===cd.dataset.categoryDelete)?.name);
 const be=target.closest('[data-banner-edit]');if(be)openManagement('banner',Number(be.dataset.bannerEdit));const bd=target.closest('[data-banner-delete]');if(bd)confirmDelete('banner',Number(bd.dataset.bannerDelete),S.getBanners().find(b=>b.id===Number(bd.dataset.bannerDelete))?.title);
 const od=target.closest('[data-order-detail]');if(od)openOrder(od.dataset.orderDetail);
});
for(const id of ['product-search','category-filter'])$('#'+id).addEventListener('input',renderProducts);for(const id of ['order-search','status-filter'])$('#'+id).addEventListener('input',renderOrders);
for(const status of S.statuses){const option=document.createElement('option');option.textContent=status;$('#status-filter').append(option);}
$('#menu-toggle').addEventListener('click',()=>{const open=$('#sidebar').classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',String(open));});document.addEventListener('click',e=>{if(!e.target.closest('.sidebar')&&!e.target.closest('#menu-toggle')){$('#sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');}});document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');}});
$('#admin-logout').addEventListener('click',()=>action($('#admin-logout'),async()=>{await ZavoBackend.signOut();location.replace('login.html');}));
ZavoBackend.getClient().auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){$('#admin-shell').hidden=true;location.replace('login.html');}else if(event==='TOKEN_REFRESHED')setTimeout(()=>ZavoBackend.requireAdmin().catch(()=>{$('#admin-shell').hidden=true;location.replace('login.html');}),0);});
$('#today').textContent=new Date().toLocaleDateString('uz-UZ');$('#admin-shell').hidden=false;$('#admin-loading').hidden=true;
await reload().catch(()=>{});S.subscribe(()=>reload().catch(()=>{}),true);window.addEventListener('focus',()=>reload().catch(()=>{}));setInterval(()=>{if(!document.hidden)reload().catch(()=>{});},60000);
if (window.ZavoMigration) {
 const M=window.ZavoMigration, button=$('#migration-import'), output=$('#migration-result');
 async function inspectMigration() {
  button.disabled=true;
  try { const plan=await M.preview(); $('#migration-counts').textContent=`Eski mahsulotlar topildi: ${plan.products.length} ta\nImport qilishga tayyor: ${new Set(plan.entries.map(e=>e.identity)).size} ta`;output.textContent=[...plan.warnings,...plan.invalid].join('\n');button.disabled=!plan.entries.length; }
  catch(error){output.textContent=error.message;}
 }
 $('#migration-backup').addEventListener('click',()=>M.download().catch(error=>{output.textContent=error.message;}));
 button.addEventListener('click',async()=>{
  if(button.disabled)return;button.disabled=true;
  try {
   const plan=await M.preview();
   // Export the untouched source before making the first database write.
   await M.download();output.textContent='Import bajarilmoqda…';
   const result=await M.migrate(plan);
   output.textContent=`Imported: ${result.Imported}\nSkipped: ${result.Skipped}\nFailed: ${result.Failed}\n${result.errors.join('\n')}`;
   await reload();
   if(result.ids.length){
    localStorage.setItem('zavo-catalog-migration-refresh',String(Date.now()));
    const publicClient=window.supabase.createClient(ZavoBackend.config.url,ZavoBackend.config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    let visible=0;
    for(let i=0;i<result.ids.length;i+=100){const check=await publicClient.from('products').select('id').in('id',result.ids.slice(i,i+100));if(check.error)throw new Error('Ommaviy katalog tekshiruvi: '+check.error.message);visible+=check.data.length;}
    output.textContent+=`\nOmmaviy index.html katalogida ko‘rinadi: ${visible} ta. Yashirilgan mahsulot/kategoriya ommaviy katalogda ko‘rinmaydi.`;
   }
  } catch(error){output.textContent+='\n'+error.message;} finally{button.disabled=false;}
 });
 await inspectMigration();
}
})();

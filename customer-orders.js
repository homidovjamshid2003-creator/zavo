'use strict';
(async()=>{
 const list=document.querySelector('#customer-orders'),status=document.querySelector('#orders-status');
 if(ZavoBackend.recoveryRedirectPending)return;
 const page=location.pathname?.endsWith('/my-orders.html')?'my-orders.html':'customer-orders.html';
 try{const u=await ZavoCustomer.user();if(!u){location.replace('customer-login.html?next='+page);return;}
 ZavoCustomer.api().auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){list.replaceChildren();location.replace('customer-login.html?next='+page);}else if(session?.user?.id&&session.user.id!==u.id){list.replaceChildren();location.replace(page);}});
 const {data,error}=await ZavoCustomer.api().from('orders').select('id,customer_id,created_at,status,payment_type,installment_months,monthly_payment,total_amount,order_items(product_name,quantity,total_price)').eq('customer_id',u.id).order('created_at',{ascending:false});if(error)throw error;
 const latest=await ZavoCustomer.user();if(latest?.id!==u.id){list.replaceChildren();location.replace('customer-login.html?next='+page);return;}
 status.textContent=data.length?'Buyurtmalaringiz holatini shu yerda kuzating.':'Hozircha buyurtmalaringiz yo‘q.';
 const money=n=>Math.round(Number(n)).toLocaleString('uz-UZ').replace(/[\u00a0\u202f]/g,' ')+' so‘m';
 for(const o of data){const card=document.createElement('article');card.className='customer-order';const title=document.createElement('h2');title.textContent='Buyurtma raqami: '+o.id.toUpperCase();card.append(title);for(const text of ['Sana: '+new Date(o.created_at).toLocaleDateString('uz-UZ'),'Buyurtma holati: '+o.status,'Mahsulotlar:',...(o.order_items||[]).map(i=>i.product_name+' × '+i.quantity+' — '+money(i.total_price)),'Jami summa: '+money(o.total_amount),o.payment_type==='installment'?'To‘lov turi: Muddatli to‘lov · Muddat: '+o.installment_months+' oy · Oyiga to‘lov: '+money(o.monthly_payment)+' / oy':'To‘lov turi: Naqd']){const p=document.createElement('p');p.textContent=text;card.append(p);}list.append(card);}
 }catch{status.textContent='Buyurtmalarni yuklab bo‘lmadi. Qayta urinib ko‘ring.';}
})();

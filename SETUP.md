# Mijoz hisobini yakunlash: mavjud loyiha uchun joriy qadamlar

Ushbu bo‘lim avvalgi mijoz migratsiyasi haqidagi qadamlarni almashtiradi. database.sql bu yangilanishda o‘zgartirilmadi.

ERROR 42P07: relation admins already exists chiqsa, SQL Editor’dagi eski matnni tozalab, faqat yangilangan customer-account-migration.sql matnini joylang va Run bosing. Ushbu fayl private.admins, is_admin(), mahsulot/kategoriya/banner jadvallari yoki bazaviy admin policylarini yaratmaydi. database.sql avval bajarilgan va yana bajarilmasligi kerak.

1. Supabase SQL Editor’da **customer-account-migration.sql** faylining to‘liq matnini bajaring. Mavjud loyiha uchun aynan shu fayl yetarli: database.sql yoki 202610100002_customer_accounts.sql faylini qayta bajarmang. Yangi fayl customer_profiles jadvali bo‘lmasa yaratadi; mavjud bo‘lsa ustunlarni qo‘shadi, eski id/address ma’lumotlarini saqlaydi. orders.customer_id yo‘q bo‘lsa qo‘shadi. Migratsiya tranzaksiya ichida ishlaydi va qayta bajarish qo‘llab-quvvatlanadi.
2. Yangilangan checkout funksiyasini loyiha bilan bog‘langan Supabase CLI orqali joylang: supabase functions deploy checkout. Mavjud ALLOWED_ORIGINS va TURNSTILE_SECRET_KEY qiymatlari saqlansin. supabase.js dagi ochiq turnstileSiteKey ham buyurtma yuborish uchun to‘ldirilgan bo‘lsin; Cloudflare Invisible Turnstile kalitidan foydalaning. Auth foydalanuvchi ID si serverda tekshirilgan JWT dan olinadi.
3. Authentication → URL Configuration’da haqiqiy sayt manzilini Site URL qilib kiriting. Redirect URLs ro‘yxatiga **saytingizning aniq manzillari** qo‘shilsin: index.html, profile.html?auth=email_change va reset-password.html. Masalan: https://SIZNING-DOMENINGIZ/index.html, https://SIZNING-DOMENINGIZ/profile.html?auth=email_change, https://SIZNING-DOMENINGIZ/reset-password.html. Mahalliy server uchun mos http://localhost:5500/ manzillari va haqiqiy portni qo‘shing.
4. Authentication → Providers → Email’da email/parol va yangi hisob ochish yoqilgan bo‘lsin. Darhol ro‘yxatdan o‘tib kirish kerak bo‘lsa Confirm email o‘chiriladi; yoqilganida mijoz email havolasini tasdiqlagach hisobga kiradi. Email yuborish uchun SMTP sozlang; Confirm Signup, Change Email Address va Reset Password shablonlarida {{ .ConfirmationURL }} saqlansin. Matnlarni o‘zbekcha yozing.
5. Table Editor’da customer_profiles uchun user_id, first_name, last_name, phone, email, delivery_address, region, created_at va updated_at maydonlarini tekshiring. Eski id/address moslik uchun saqlanadi. Email Auth orqali serverda yangilanadi; parol bu jadvalda yo‘q.
6. Qo‘lda sinov: customer-register.html orqali hisob oching; customer-login.html orqali kiring; sahifani yangilang; profilda Tahrirlash → Saqlash orqali ma’lumotlarni o‘zgartiring; **Ma'lumotlar saqlandi** xabarini tekshiring. Savatni oching va ism, familiya, telefon, email, viloyat/manzil yangi profil bilan to‘lishini tekshiring. Shu buyurtma uchun maydonlarni tahrirlash mumkin.
7. Hisob bilan buyurtma bering va my-orders.html sahifasida sana, mahsulotlar, jami, to‘lov turi, muddat, oyiga to‘lov va holatni tekshiring. Ikkinchi mijoz boshqa mijoz buyurtmalarini ko‘rmasligi kerak. Mehmon checkout ham ishlasin. Eski mehmon buyurtmalari telefon/email asosida hisobga biriktirilmaydi.
8. Chiqishdan keyin header Kirish holatiga qaytsin, savat va saralanganlar saqlansin. Admin login.html orqali alohida kiring: mahsulotlar, barcha buyurtmalar va holatni o‘zgartirish avvalgidek ishlasin.
9. RLS ning haqiqiy SQL sinovi: rivojlantirish loyihasining SQL Editor’ida supabase/tests/customer_account_completion.sql faylini bajaring. Sinov ma’lumotlari yakunda rollback qilinadi. Mahalliy regressiya testlari: node --test --test-isolation=none tests/store.test.cjs tests/pages.test.cjs tests/checkout.test.cjs tests/recovery.test.cjs tests/customer.test.cjs tests/customer-migration.test.cjs.

Tekshiruv chegarasi: Supabase’da faqat ochiq kalit bilan sxema uchun limit=0 o‘qish so‘rovlari va is_admin() ning anonim tekshiruvi bajarildi. REST sxemasida customer_profiles topilmadi, orders.customer_id ustuni yo‘q ekanligi aniqlandi. Migratsiya, haqiqiy email, brauzer sessiyasi va haqiqiy buyurtma sinovi admin ulanishi bo‘lmagani uchun avtomatlashtirib bajarilmadi. JavaScript regressiyalari soxta Supabase javoblari bilan sinovdan o‘tadi.

---

# ZAVO.UZB — Supabase’ni sozlash

Mavjud HTML/CSS dizayni saqlangan. Mahsulotlar, rasmlar, kategoriyalar, qoldiq, bannerlar va buyurtmalar Supabase’da saqlanadi. Savat/saralanganlar — brauzerdagi qulaylik; admin sessiyasini Supabase Auth boshqaradi. Hech qanday admin paroli loyiha fayllarida saqlanmaydi.

## 1. Supabase loyihasini yarating

1. https://supabase.com/dashboard sahifasida yangi loyiha yarating.
2. Loyiha nomini kiriting, kuchli database parolini belgilang va yaqin regionni tanlang. Database parolini frontendga yozmang.
3. Loyiha tayyor bo‘lgach, Connect/API Keys bo‘limidan Project URL va **publishable key** (yoki eski **anon** key) ni oling.
4. `service_role` / secret key frontendda ishlatilmaydi. U faqat Supabase Edge Function server muhitida kerak bo‘ladi.

## 2. `database.sql` faylini bajaring

1. Supabase Dashboard → SQL Editor → New query.
2. Loyiha ildizidagi `database.sql` faylini to‘liq joylashtirib, Run bosing.
3. Skript kerakli olti jadval, RLS, admin ro‘yxati, Storage ruxsatlari, tranzaksion funksiyalar va kategoriyalarni yaratadi. Yangi database’da **bir marta** bajaring. Keyingi o‘zgarishlar alohida migratsiya bilan qilinadi; bu faylni qayta bajarish uchun jadvallarni o‘chirmang.
4. Xuddi shu sxema CLI uchun `supabase/migrations/202610100001_zavo.sql` ichida ham bor. Dashboard va CLI usullaridan bittasini tanlang.
5. Oldingi 20 ta namunaviy mahsulotni saqlashni xohlasangiz, so‘ng `supabase/demo-products.sql` ni bajaring. Narxlar namuna; haqiqiy savdodan oldin yangilang. Aks holda katalog bo‘sh boshlanadi.
6. Eski `zavo-products-v1` va `zavo-orders-v1` brauzer yozuvlari o‘chirilmaydi, ammo yangi sayt ularni biznes bazasi sifatida ishlatmaydi. Mahalliy o‘zgartirish/buyurtmalar bo‘lsa, browser DevTools → Application → Local Storage’dan zaxira nusxa oling. Moliyaviy buyurtmalarni avtomatik import qilish yoqilmagan: ularni alohida tekshirib ko‘chiring.

## 3. Storage bucket’ini tekshiring

1. Storage’da `zavo-images` bucket’i borligini tekshiring. `database.sql` uni avtomatik yaratadi.
2. Bucket ommaviy o‘qish uchun ochiq, yozish/o‘chirish faqat adminlarga ruxsat etiladi.
3. Maksimal fayl hajmi 5 MB; JPEG, PNG, WEBP va GIF qabul qilinadi. SVG/HTML yuklanmaydi.
4. Mahsulot rasmlari `products/`, bannerlar `banners/`, kategoriya rasmlari `categories/` ichiga tasodifiy nom bilan yuklanadi. Bir mahsulotda eng ko‘pi 12 ta rasm bo‘ladi.
5. Storage siyosatlarini `using (true)` bilan yozishga ochmang. [Rasmiy Storage ruxsatlari](https://supabase.com/docs/guides/storage/security/access-control).

## 4. Authentication’ni sozlang

1. Authentication → Providers’da Email/Password kirishini yoqing.
2. Ommaviy foydalanuvchi ro‘yxatdan o‘tishini o‘chiring: bu loyiha admin hisoblarini qo‘lda yaratadi.
3. URL Configuration’da saytingiz HTTPS manzilini belgilang. Lokal sinov uchun `http://localhost:5500` ni ishlating.
4. Authentication → Users orqali birinchi foydalanuvchini yarating; emailni tasdiqlangan qilib belgilang va kuchli parol bering.
5. Parolni `supabase.js`, SQL fayli yoki boshqa frontend kodiga yozmang. [Supabase parol bilan kirish](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).

## 5. Birinchi adminni belgilang

SQL Editor’da, kerakli email bilan bajaring:

```sql
insert into private.admins(user_id)
select id from auth.users where lower(email) = lower('admin@example.com')
on conflict do nothing;
```

Bu emailni o‘zingiz yaratgan foydalanuvchi emailiga almashtiring. Natijada bir foydalanuvchi qo‘shilganini tekshiring:

```sql
select u.email from private.admins a join auth.users u on u.id = a.user_id;
```

Oddiy authenticated foydalanuvchi avtomatik admin bo‘lmaydi. Admin ro‘yxatini mijoz API’dan o‘zgartirib bo‘lmaydi. Huquqni bekor qilish uchun SQL Editor’da `delete from private.admins where user_id = 'FOYDALANUVCHI_UUID';` bajaring. [RLS tushuntirishi](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 6. Project URL va ochiq kalitni kiriting

`supabase.js` yuqorisidagi qiymatlarni to‘ldiring:

```js
window.ZAVO_SUPABASE = Object.freeze({
  url: 'https://YOUR_PROJECT.supabase.co',
  publishableKey: 'YOUR_PUBLISHABLE_OR_ANON_KEY',
  turnstileSiteKey: 'YOUR_PUBLIC_TURNSTILE_SITE_KEY'
});
```

Kalit publishable yoki anon bo‘lishi kerak. `service_role` / `sb_secret_` kalitlari bu faylga kiritilmaydi. Konfiguratsiyasiz sayt faqat oldingi namunaviy katalogni ko‘rsatadi; buyurtma yuborish va admin boshqaruvi ishlamaydi. Sozlangan Supabase ishlamasa, eski localStorage buyurtmasi bilan yashirin almashtirish qilinmaydi.

### Himoyalangan checkout funksiyasini ishga tushiring

Buyurtma summasi va qoldiqni mijozdan qabul qilish xavfli. `checkout` Edge Function himoya tekshiruvidan keyin serverdagi `create_order` funksiyasini chaqiradi. Brauzer `create_order` ni bevosita chaqira olmaydi.

1. Cloudflare Turnstile’da Invisible widget yarating. U ko‘rinadigan chet tilidagi vidjetsiz fonda ishlaydi; [Invisible rejim talabi](https://developers.cloudflare.com/turnstile/concepts/widget/) bo‘yicha do‘konning maxfiylik siyosatida Cloudflare Turnstile Privacy Addendum havolasini ko‘rsating. Sayt domeni va `localhost` ni ruxsat etilgan hostlarga qo‘shing. Ochiq site key’ni yuqoridagi konfiguratsiyaga kiriting; secret key faqat serverda bo‘ladi.
2. [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) ni o‘rnating, loyiha papkasida `supabase login`, so‘ng `supabase link --project-ref YOUR_PROJECT_REF` bajaring.
3. Dashboard → Edge Functions → Secrets’da quyidagilarni belgilang:
   - `TURNSTILE_SECRET_KEY`: Cloudflare maxfiy kaliti.
   - `ALLOWED_ORIGINS`: masalan `https://zavo.uzb,http://localhost:5500`. Haqiqiy sayt domenini yozing, oxiriga `/` qo‘ymang.
4. `SUPABASE_URL` va `SUPABASE_SERVICE_ROLE_KEY` Supabase hosted Edge Functions server muhitida beriladi; ularni frontendga nusxalamang.
5. Loyiha papkasida `supabase functions deploy checkout --no-verify-jwt` bajaring. Ommaviy xaridor Supabase hisobisiz buyurtma berishi uchun gateway JWT tekshiruvi o‘chirilgan; funksiyaning o‘zi origin, Turnstile, IP so‘rov chegarasi va kiritmalarni tekshiradi.
6. Cloudflare widget action’i kodda `checkout`; server shu action va ruxsat etilgan hostni tekshiradi. [Turnstile server tekshiruvi](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
7. Turnstile yoki Edge Function sozlanmagan bo‘lsa buyurtma tugmasi ishlamaydi; xato aniq ko‘rsatiladi. Saytni `file://` orqali emas, lokal HTTP server yoki HTTPS hosting orqali oching. VS Code Live Server (`http://localhost:5500`) mos keladi.

## 7. Admin kirishini tekshiring

1. `login.html` ni ochib yaratilgan admin email/paroli bilan kiring.
2. `admin.html` ochilishi, Supabase bilan sinxronlangan xabar va dashboard ko‘rinishini tekshiring.
3. Chiqish tugmasini bosing. `admin.html` ga qayta kirish login sahifasiga yuborishi kerak.
4. Noto‘g‘ri parol va admin ro‘yxatida bo‘lmagan foydalanuvchini sinang. Boshqaruv ochilmasligi kerak.
5. Incognito brauzerda products narxini yangilash/orderlarni o‘qish API so‘rovlari ruxsat olmasligini tekshiring. Frontenddagi yashirish bazadagi RLS o‘rnini bosmaydi.

## 8. Mahsulot yaratishni tekshiring

1. Admin → Mahsulotlar → Mahsulot qo‘shish.
2. Nomi, kategoriya, tavsif, naqd narx, qoldiq va ixtiyoriy chegirmali narxni kiriting.
3. Faollik va muddatli to‘lov belgilari bilan saqlang.
4. Mijoz saytini boshqa tabda oching; mahsulot chiqishi kerak. Realtime ishlamasa fokus/60 soniyalik yangilash ham mavjud.
5. Qoldiqni `0` qiling: “Tugadi”, Buy tugmasi o‘chiq. Qoldiqni qayta oshiring: “Sotuvda”, xarid faol.
6. Muddatli to‘lovni o‘chiring: kalkulyator yashirinadi va shu mahsulot bor savatda faqat naqd to‘lov qoladi.
7. Mahsulot yoki kategoriya faolligini o‘chiring: mijoz katalogida yashirinishi, adminda qolishi kerak.

## 9. Rasm va bannerlarni tekshiring

1. Mahsulotga bir nechta rasm yuklang; birinchi rasm kartada ko‘rinadi.
2. Rasmni oldinga suring, olib tashlang yoki yangi rasm bilan almashtirib saqlang. Tafsilotlarda rasmlar almashishini tekshiring.
3. 5 MB dan katta va mos bo‘lmagan fayl yuklash bloklanishi kerak.
4. Admin → Bannerlar’da rasm, sarlavha, qo‘shimcha matn, tugma, havola va tartibni belgilang. Faol banner bosh sahifa hero qismida chiqadi; bir nechtasi bo‘lsa strelkalar bilan almashtiriladi.
5. Banner/kategoriya rasmlari ommaviy, hech qanday xaridor hujjati bu bucket’ga yuklanmaydi. Ishlatilmay qolgan fayllarni Storage’da vaqti-vaqti bilan tekshiring.

## 10. Xaridor buyurtmasini tekshiring

1. Incognito’da mahsulotlarni savatga qo‘shing, sonini o‘zgartiring va rasmiylashtirish formasini to‘ldiring.
2. Ism, telefon, viloyat/shahar va manzil kiriting. Izoh ixtiyoriy.
3. Naqd yoki muddatli to‘lovni tanlang. 3, 6, 9, 12 oy tanlovlari summalarni darhol o‘zgartiradi; hisoblash stavkalari ko‘rsatilmaydi.
4. Avtomatik xavfsizlik tekshiruvi yakunlangach Buyurtma berish tugmasini bosing. Qabul qilingan raqam chiqishi kerak.
5. Admin → Buyurtmalar’da barcha tafsilotlar, qidiruv va holat filtrini tekshiring. Buyurtma raqamini bosib tafsilotlarni oching.
6. “Yangi” buyurtma omborni kamaytirmaydi. “Tasdiqlandi” holatida qoldiq tranzaksiya va row lock orqali bir marta kamayadi. Mahsulot yetmasa tasdiqlash rad etiladi va boshqa mahsulotlar ham kamaymaydi.
7. “Tasdiqlandi” → “Yetkazilmoqda” → “Yetkazildi”. Tasdiqlangan/yetkazilayotgan buyurtmani bekor qilish qoldiqni bir marta qaytaradi. “Yangi” buyurtmani bekor qilish qoldiqni o‘zgartirmaydi. Yakuniy holatlarni ortga qaytarish bloklangan.
8. Kam qoldiqli mahsulotga ikki buyurtma yarating; ikkalasini ketma-ket yoki parallel tasdiqlang. Faqat yetarli qoldiq bo‘lganlari o‘tishi, qoldiq manfiy bo‘lmasligi kerak.
9. Browser orqali narx/total maydonini o‘zgartirib yuboring: server narxlarni bazadan qayta oladi. Yuborish tugmasini takror bosish bloklangan; bir xil so‘rov kaliti serverda ikkinchi buyurtma yaratmaydi.

## Tekshiruvlar va ishga tushirish chegaralari

- `node --test --test-isolation=none tests/store.test.cjs tests/pages.test.cjs tests/checkout.test.cjs` — JavaScript va adapter regressiya tekshiruvlari.
- `supabase/tests/database.sql` — SQL Editor’da ishlab chiqish bazasida bajariladigan rollback’li baza/RLS/qoldiq tekshiruvlari. Ishlab turgan savdo bazasida sinov o‘tkazmang.
- Mobil sinov: 360px, 768px va desktop. Login, sidebar, mahsulot formasi, jadvallarni yoniga surish, savat, galereya va kalkulyatorni tekshiring.
- Haqiqiy loyiha URL/kalitlari, schema va Edge Function joylanmaguncha jonli Supabase kirishi/yuklash/buyurtma testi bajarilmaydi. Lokal mock tekshiruvlar jonli RLS yoki haqiqiy mobil browser sinovini almashtirmaydi.
- To‘lov provayderi/online karta yechimi qo‘shilmagan: bu naqd va muddatli buyurtma so‘rovi. Yetkazilgan buyurtmalar dashboard savdosiga kiradi. Domain, HTTPS, haqiqiy aloqa ma’lumotlari (`script.js` dagi `STORE`), zaxiralash, SMTP va do‘konning tasdiqlangan shartlarini ishga tushirishdan oldin sozlang.

## Parolni tiklashni sozlash va tekshirish

1. Supabase **Authentication → URL Configuration** bo‘limida Site URL sifatida saytingizning haqiqiy HTTPS manzilini kiriting.
2. Redirect URLs ro‘yxatiga aniq `https://SIZNING-DOMENINGIZ/reset-password.html` manzilini qo‘shing. Sayt ichki papkada bo‘lsa, shu papkani ham kiriting. Mahalliy sinov uchun, masalan, `http://localhost:5500/reset-password.html` qo‘shing; port sayt serveri bilan bir xil bo‘lsin. HTML faylni file:// orqali ochmang.
3. **Authentication → Email Templates → Reset Password** shablonidagi havolada `{{ .ConfirmationURL }}` saqlansin. Bu Supabase tasdiqlash havolasidir; uni oddiy sayt havolasiga almashtirmang. Email matnini o‘zbekcha yozing.
4. Haqiqiy mijozlar uchun **Authentication → SMTP Settings** orqali o‘z emailingizni yuborish xizmatini ulang. Supabase standart email xizmatining yuborish va qabul qiluvchi cheklovlari bor. Parol siyosatini kamida 12 belgi, katta/kichik harf, raqam va maxsus belgi talab qiladigan qilib sozlang.
5. login.html sahifasida ro‘yxatdan o‘tgan emailni kiriting va **Parolni unutdingizmi?** tugmasini bosing. Emaildagi havola reset-password.html sahifasini ochishi kerak. Oddiy kirilgan sessiya tiklash havolasisiz bu formani ochmaydi.
6. Bir-biriga mos kelmagan va kuchsiz parollarni sinang: yangilash bajarilmasligi kerak. So‘ng 12–128 belgili xavfsiz parolni ikki marta kiriting. **Parol muvaffaqiyatli yangilandi** xabaridan so‘ng login.html ochiladi. Yangi parol bilan admin hisobingizga kiring.
7. Eskirgan yoki ishlatilgan email havolasini boshqa sessiyada oching: yangi havola so‘rash xabari chiqishi kerak. Tiklash sahifasini yangilash shu brauzer tabida 15 daqiqalik tiklash belgisi va haqiqiy Supabase sessiyasi bilan qo‘llab-quvvatlanadi.

Frontend faqat ochiq publishable/anon kalitni ishlatadi. Email yuborish, sessiyani tasdiqlash va parolni saqlash Supabase Authentication orqali amalga oshadi; admin paroli loyiha fayllariga yozilmaydi.

## Mijoz hisoblarini ishga tushirish

- **Avval sozlangan loyiha:** SQL Editor orqali faqat `supabase/migrations/202610100002_customer_accounts.sql` faylini bir marta bajaring. To‘liq database.sql faylini mavjud bazada qayta ishlatmang.
- **Yangi loyiha:** yangilangan database.sql ikkala migratsiyani ketma-ket yaratadi; ikkinchi migratsiyani yana alohida bajarmang.
- Checkout Edge Function yangilandi: `supabase functions deploy checkout` buyrug‘i bilan qayta joylang. Mavjud Turnstile va ALLOWED_ORIGINS sozlamalari saqlansin. Bu funksiya mijoz JWT sini Supabase orqali tekshiradi, so‘ng buyurtmani hisob ID siga bog‘laydi. Frontenddan yuborilgan hisob ID si qabul qilinmaydi.
- Authentication → Providers → Email bo‘limida email/parol bilan ro‘yxatdan o‘tishni yoqing. Talab qilingan **ro‘yxatdan o‘tishi bilan avtomatik kirish** uchun Confirm email sozlamasini o‘chiring. Tasdiqlash yoqilgan holda sayt email tasdiqlash xabarini ko‘rsatadi va tasdiqlangan havola ochilgach mijoz sessiyasini o‘rnatadi. Supabase tasdiqlanmagan hisobga sessiya bermaydi: https://supabase.com/docs/reference/javascript/auth-signup
- URL Configuration → Redirect URLs ro‘yxatiga saytning aniq `https://SIZNING-DOMENINGIZ/index.html` manzilini qo‘shing (mahalliy sinovda, masalan, `http://localhost:5500/index.html`). Tasdiqlash emailida `{{ .ConfirmationURL }}` saqlansin.
- `customer-register.html` orqali mijoz hisobini yarating. Bosh sahifada Saralangan → Savat → Hisob tugmasi tartibini tekshiring. Sahifani yangilaganda sessiya saqlanishi kerak.
- Profilim sahifasida ism, familiya, telefon, viloyat va manzilni tahrirlang. Savatda ism, telefon, email va saqlangan manzil avtomatik to‘lishini tekshiring. Mijoz checkout maydonlarini o‘zgartirishi mumkin.
- Hisob bilan buyurtma bering va Buyurtmalarim sahifasida uni tekshiring. Ikkinchi mijoz hisobiga kirganda birinchi mijoz buyurtmalari ko‘rinmasligi kerak. Hisobsiz buyurtma berish avvalgidek ishlaydi; mehmon yoki eski buyurtmalar avtomatik email/telefon bo‘yicha hech kimga biriktirilmaydi.
- Chiqish tugmasi savat va saralanganlarni saqlaydi. Admin va mijoz bir xil Supabase Auth xizmatidan foydalanadi, ammo brauzer sessiyalari alohida kalitda saqlanadi (`zavo-customer-auth` mijozniki). Admin huquqi faqat private.admins va is_admin() orqali beriladi; ro‘yxatdan o‘tish admin huquqini bermaydi.
- Mahalliy avtomatik tekshiruv: `node --test --test-isolation=none tests/store.test.cjs tests/pages.test.cjs tests/checkout.test.cjs tests/recovery.test.cjs tests/customer.test.cjs`.
- RLS ni haqiqiy rivojlantirish bazasida tekshirish uchun `supabase/tests/customer_accounts.sql` ni SQL Editor da bajaring. Sinov ma’lumotlari yakunda rollback qilinadi. Bu SQL sinovi mahalliy muhitda bajarilmagan.

## Profilni tahrirlash va checkout bilan sinxronlash

- Ism, familiya, telefon, viloyat va yetkazib berish manzili mavjud customer_profiles jadvalida saqlanadi. Email Supabase Auth hisobining tasdiqlangan emailidan olinadi; parol va email nusxasi profil jadvaliga yozilmaydi. Avvalgi mijoz hisoblari migratsiyasi bajarilgan bo‘lsa, bu yangilanish uchun qo‘shimcha SQL kerak emas.
- Emailni tahrirlash `auth.updateUser({email})` orqali bajariladi. Supabase email tasdiqlash talab qilsa, yangi email tasdiqlanguncha checkout avvalgi tasdiqlangan emailni ishlatadi. Secure email change yoqilganida eski va yangi emailga kelgan tasdiqlash havolalarini oching. Manba: https://supabase.com/docs/reference/javascript/auth-updateuser
- Authentication → URL Configuration → Redirect URLs ro‘yxatiga aniq `https://SIZNING-DOMENINGIZ/profile.html?auth=email_change` manzilini qo‘shing. Mahalliy sinovda, masalan, `http://localhost:5500/profile.html?auth=email_change`. Authentication → Email Templates → Change Email Address shablonida `{{ .ConfirmationURL }}` saqlansin; email matni o‘zbekcha bo‘lsin.
- Profilni tahrirlab saqlang: muvaffaqiyat xabari chiqishi kerak. Do‘konga qayting va savatni oching: yangi ism/familiya, telefon va saqlangan manzil avtomatik to‘lsin. Email tasdiqlangach yangi email ham ishlatilsin.
- Do‘kon boshqa tabda ochiq bo‘lsa, profil saqlanganda BroadcastChannel orqali yangilanish signali yuboriladi. Signal shaxsiy ma’lumotlarni saqlamaydi; do‘kon ma’lumotni qayta Supabase’dan o‘qiydi. Sahifaga qaytish yoki savatni ochish ham yangi ma’lumotni yuklaydi. Mijoz shu buyurtma uchun qo‘lda tahrirlagan checkout maydonlari saqlanadi.
- Buyurtmalarim sahifasi buyurtma sanasi, mahsulotlar va soni, jami, to‘lov turi, muddatli to‘lov oylari va buyurtma holatini o‘zbekcha ko‘rsatadi. Mijoz ID filtri va avvalgi orders/order_items RLS siyosatlari saqlangan.

# ZAVO dizayn yangilanishi — 2026-10-11

Bosh sahifa uchun iliq oq, terrakota va to‘q yashil ranglar, yirik tipografika, interyer fotosurati va keng mahsulot kartalari qo‘llandi. Katalog, to‘lov kalkulyatori, savat va mahsulot oynalari bir xil uslubga keltirildi. Kirish, ro‘yxatdan o‘tish, profil va buyurtmalar sahifalari ham moslashtirildi.

## Fayllar

- `storefront.css`: bosh sahifaning dizayni; `style.css` va `customer.css` dan keyin ulanadi.
- `customer-design.css`: mijoz hisobining beshta sahifasi; `customer.css` dan keyin ulanadi.
- `favicon.svg`: sayt belgisi.
- `index.html`: yangi sarlavhalar, rang metama’lumoti va dizayn fayli.

## Tekshiruv natijalari

- `node --test --test-isolation=none tests/*.test.cjs`: 62/62 test o‘tdi.
- O‘zgartirilgan 6 sahifadagi 70 ta mahalliy fayl havolasi mavjud; takrorlangan HTML ID aniqlanmadi.
- Asosiy matn kontrasti 14.08:1, yordamchi matn 5.49:1, asosiy tugma 5.96:1, yashil tugma 12.50:1. Mahsulot kategoriyasi matni dastlabki kontrast tekshiruvidan keyin to‘qroq qilindi. Bu tanlangan rang juftliklarining hisobi; to‘liq accessibility auditi emas.
- Mobil qoidalar 1150, 900, 700 va 380px chegaralarda moslashtirildi. Kamaytirilgan animatsiya sozlamasi qo‘llab-quvvatlanadi.
- Yangi tashqi JavaScript kutubxonasi qo‘shilmadi.

## Hali bajarilishi kerak bo‘lgan vizual tekshiruv

Bu sessiyada boshqariladigan brauzer mavjud emas. Mahalliy HTTP server ham 127.0.0.1:5500 portida EACCES bilan ishga tushmadi. Shuning uchun ekran tasvirlari, haqiqiy mobil joylashuv, Lighthouse va jonli buyurtma tekshirilmagan.

Saytni odatdagi HTTP ishlab chiqish serverida ochib, 360px, 390px, 768px va 1440px kengliklarda tekshirish kerak: menyu, qidiruv, narx filtri, saralanganlar, mahsulot tafsilotlari, savat hamda hisob sahifalari. Fotosuratlar yuklanganda va yuklanmaganda ko‘rinishni ham tekshirish kerak.

Muayyan tashqi reyting tanlanmagan va baho olinmagan. Top-10 natijasi yoki davomli avtomatik monitoring o‘rnatilgani da’vo qilinmaydi.

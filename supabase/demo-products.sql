-- Optional sample catalog. Run only when you want to retain the previous demo products.
begin;
insert into public.products(id,name,category_id,description,cash_price,discount_price,stock_quantity,installment_enabled,is_active) values
(1,'Luna — yumshoq ikki kishilik divan','furniture','Luna — yumshoq ikki kishilik divan',6000000,4800000,10,true,true),
(2,'AirWash — avtomatik kir yuvish mashinasi','appliances','AirWash — avtomatik kir yuvish mashinasi',4200000,null,10,true,true),
(3,'Nova — 128 GB smartfon','phones','Nova — 128 GB smartfon',4000000,3600000,10,true,true),
(4,'Vision — 55 dyuymli Smart TV','tvs','Vision — 55 dyuymli Smart TV',6400000,null,10,true,true),
(5,'Heritage — naqshli gilam, 200 × 300 sm','carpets','Heritage — naqshli gilam, 200 × 300 sm',2000000,1600000,10,true,true),
(6,'Urban — shahar velosipedi','bicycles','Urban — shahar velosipedi',2800000,null,10,true,true),
(7,'Sound — simsiz quloqchin','electronics','Sound — simsiz quloqchin',900000,720000,10,true,true),
(8,'Forma — yumshoq dizayner kreslosi','furniture','Forma — yumshoq dizayner kreslosi',2400000,null,10,true,true),
(9,'Samsung — 43″ Smart TV','tvs','Samsung — 43″ Smart TV',4800000,3840000,10,true,true),
(10,'LG — 55″ 4K Smart TV','tvs','LG — 55″ 4K Smart TV',8000000,7200000,10,true,true),
(11,'Samsung Galaxy A35 — 128 GB','phones','Samsung Galaxy A35 — 128 GB',4000000,3600000,10,true,true),
(12,'Apple iPhone 13 — 128 GB','phones','Apple iPhone 13 — 128 GB',6600000,null,10,true,true),
(13,'Artel — 7 kg kir yuvish mashinasi','appliances','Artel — 7 kg kir yuvish mashinasi',4200000,3360000,10,true,true),
(14,'Samsung — ikki kamerali muzlatkich','appliances','Samsung — ikki kamerali muzlatkich',6400000,5760000,10,true,true),
(15,'Comfort — burchakli divan','furniture','Comfort — burchakli divan',9000000,7200000,10,true,true),
(16,'Nord — 4 kishilik ovqatlanish to‘plami','furniture','Nord — 4 kishilik ovqatlanish to‘plami',4800000,null,10,true,true),
(17,'Buxoro — naqshli gilam, 200 × 300 sm','carpets','Buxoro — naqshli gilam, 200 × 300 sm',2400000,1920000,10,true,true),
(18,'Modern — yumshoq gilam, 160 × 230 sm','carpets','Modern — yumshoq gilam, 160 × 230 sm',1320000,null,0,true,true),
(19,'Trek — 26″ tog‘ velosipedi','bicycles','Trek — 26″ tog‘ velosipedi',4800000,4320000,10,true,true),
(20,'City Ride — 28″ shahar velosipedi','bicycles','City Ride — 28″ shahar velosipedi',3600000,3240000,0,true,true)
on conflict(id) do nothing;
select setval(pg_get_serial_sequence('public.products','id'), greatest(1,(select coalesce(max(id),1) from public.products)),true);
commit;

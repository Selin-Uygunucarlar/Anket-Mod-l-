-- 006_host_yetki_tablolari.sql
--
-- ############################################################################
-- # HOST ŞEMASI REPLİKASI — YALNIZCA GELİŞTİRME/TEST. ÜRETİMDE ÇALIŞTIRILMAZ. #
-- ############################################################################
-- Bu dosya Savronik'in ÇALIŞAN sistemindeki üç yetki tablosunu (webpage,
-- page_abilities, roleright_endpoint_mapping) lokalde yeniden üretir ki anket
-- modülünün sayfa/uç yetkisi replikada TEST EDİLEBİLSİN. Üretim veritabanında bu
-- tablolar ZATEN VARDIR; orada çalıştırmak mevcut sisteme zarar verir.
--
-- Tabloların HİÇBİRİ bize ait DEĞİLDİR. Host'un yeni sayfa/uç kayıt yordamında
-- (Savronik cevabı, 2026-07-28) yalnızca şu üç tabloya satır eklenir:
--   1) webpage                    -> sayfanın adı            (ör. WorkPlan)
--   2) roleright                  -> (webpage_id, ability_id) (001'de mevcut)
--   3) roleright_endpoint_mapping -> (right_id, endpoint)     (yol öneki)
-- Yetenek listesi (read/create/delete/update/all) page_abilities'te durur.
-- Ayrıntı: docs/postgresql_gecis_notlari.txt §1.3 ve §1.4. Bize ait olan tek şey
-- anket modülüdür (bkz. 002_anket_modulu.sql).
--
-- NEDEN AYRI DOSYA (001'e eklenmedi): 001_ilk_sema.sql geliştirme veritabanına
-- UYGULANMIŞTIR. Uygulanmış bir migration geriye dönük DÜZENLENMEZ; yeni şema
-- parçası her zaman yeni numaralı bir migration olarak eklenir (004/005 ile aynı
-- gerekçe).
--
-- Kaynak: host sistemden alınan pg_dump parçaları. Kolon adları, tipleri, sırası,
-- PK/FK constraint ADLARI ve sequence adları kaynağa BİREBİR sadıktır; host'ta
-- bulunan tuhaf yazımlar (category_id_seq, category_endpoint_mapping_pkey)
-- BİLEREK korunmuştur — 001'deki role_rigth_id_seq kararının aynısı.
--
-- ÇALIŞTIRMA: savronik_migrate rolüyle, savronik_akademi veritabanı üzerinde.
-- Şema: public. DDL yalnızca migration ile uygulanır; runtime hesabının
-- (savronik_app) DDL yetkisi YOKTUR.
--
-- ÖN KOŞUL: public.roleright tablosu mevcut olmalıdır (üretimde host'ta zaten
-- vardır, geliştirmede 001_ilk_sema.sql ile kurulur). Aksi halde
-- "mapping_right_FK" düşer.
--
-- **Geliştirme replikasına UYGULANDI (2026-07-29);** 3 tablo (kolon adı/tipi/sırası),
-- 3 sequence (START 1 / INCREMENT 1 / CACHE 1), DEFAULT nextval + OWNED BY bağları,
-- 3 PK, "mapping_right_FK" (convalidated = false, yani NOT VALID) ve savronik_app'in
-- üç tabloda CRUD + üç sequence'ta USAGE/SELECT yetkisi canlı DB'de doğrulanmıştır.
-- Tablolar BOŞTUR: page_abilities satırları bilinçli olarak uygulanmadı (aşağıdaki
-- "ELLE UYGULANIR" notu). ÜRETİMDE henüz uygulanmadı.

-- ---------------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------------

-- Yetki verilebilen SAYFA sözlüğü. roleright.webpage_id bu tablonun id'sine bakar.
CREATE TABLE public.webpage (
    id bigint NOT NULL,
    name character varying
);

-- Bir sayfada yapılabilen EYLEM (yetenek) sözlüğü: read / create / delete /
-- update / all. roleright.ability_id bu tablonun id'sine bakar.
CREATE TABLE public.page_abilities (
    id bigint NOT NULL,
    name character varying
);

-- Hak <-> yol öneki eşlemesi: bir roleright kaydına hangi endpoint (yol kalıbı)
-- karşılık geliyor.
-- KOLON ADI: "right_id"dir (rolerightmapping ile AYNI konvansiyon), "roleright_id"
-- DEĞİL. Host'taki hali budur; değiştirilmemiştir.
CREATE TABLE public.roleright_endpoint_mapping (
    id bigint NOT NULL,
    right_id bigint,
    endpoint character varying
);

-- ---------------------------------------------------------------------------
-- Sequence'ler
--
-- HOST TUHAFLIĞI — ADLAR AYNEN KORUNDU: webpage'i besleyen sequence
-- "category_id_seq", roleright_endpoint_mapping'i besleyen ise
-- "category_endpoint_mapping_id_seq" adını taşır; ikincisinin PK adı da
-- "category_endpoint_mapping_pkey"dir. Bu iki tablo host'ta bir zamanlar
-- category / category_endpoint_mapping olmalıdır. Adlar DÜZELTİLMEZ
-- (001'deki role_rigth_id_seq kararının aynısı) ki replika ile gerçek sistem
-- ad ad karşılaştırılabilsin.
--
-- ÇIKARIM (dump'tan GELMEDİ, kalıptan yazıldı): category_id_seq ve
-- category_endpoint_mapping_id_seq'in CREATE SEQUENCE GÖVDELERİ host dump'ında
-- yoktu; varlıkları OWNED BY satırlarından KESİNDİR. Gövdeleri 001'deki dört
-- sequence ile aynı kalıpla (START 1 / INCREMENT 1 / NO MINVALUE / NO MAXVALUE
-- / CACHE 1) yazılmıştır. page_abilities_id_seq'in gövdesi ise host'tan GELDİ ve
-- zaten aynı kalıptadır.
-- ---------------------------------------------------------------------------

CREATE SEQUENCE public.category_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.page_abilities_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.category_endpoint_mapping_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- ---------------------------------------------------------------------------
-- Sequence <-> kolon bağları
-- DEFAULT nextval: id kolonu INSERT'te verilmezse otomatik dolar.
-- OWNED BY: kolon/tablo silinince artık sahipsiz kalan sequence de birlikte gider.
--
-- 004'teki "OWNED BY BİLEREK YOK" kararı BURAYA UYGULANMAZ: o karar cadre_title'a
-- özgüydü (host dump'ında o tablo için OWNED BY satırı yoktu). Bu üç tabloda
-- OWNED BY host'ta VARDIR; page_abilities için DEFAULT + OWNED BY dump'tan
-- birebir geldi.
--
-- ÇIKARIM (dump'tan GELMEDİ): webpage.id'nin DEFAULT nextval satırı dump'ta yoktu;
-- OWNED BY geldiği için bağın varlığı kesindir, metni 001'in kalıbıyla yazıldı.
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY public.webpage
    ALTER COLUMN id SET DEFAULT nextval('public.category_id_seq'::regclass);
ALTER SEQUENCE public.category_id_seq OWNED BY public.webpage.id;

ALTER TABLE ONLY public.page_abilities
    ALTER COLUMN id SET DEFAULT nextval('public.page_abilities_id_seq'::regclass);
ALTER SEQUENCE public.page_abilities_id_seq OWNED BY public.page_abilities.id;

ALTER TABLE ONLY public.roleright_endpoint_mapping
    ALTER COLUMN id SET DEFAULT nextval('public.category_endpoint_mapping_id_seq'::regclass);
ALTER SEQUENCE public.category_endpoint_mapping_id_seq OWNED BY public.roleright_endpoint_mapping.id;

-- ---------------------------------------------------------------------------
-- Birincil anahtarlar (constraint adları kaynak sistemdeki gibi)
-- roleright_endpoint_mapping'in PK adı tablo adıyla UYUŞMAZ
-- ("category_endpoint_mapping_pkey"); host'taki hali budur, düzeltilmez.
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY public.webpage
    ADD CONSTRAINT webpage_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.page_abilities
    ADD CONSTRAINT page_abilities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.roleright_endpoint_mapping
    ADD CONSTRAINT category_endpoint_mapping_pkey PRIMARY KEY (id);

-- ---------------------------------------------------------------------------
-- Yabancı anahtar (tek tane)
-- Ad kaynak sistemdeki gibi büyük harf içerir; PostgreSQL'de büyük/küçük harfin
-- korunması için çift tırnak ZORUNLUDUR.
--
-- NEDEN "NOT VALID": Host'taki hali budur. NOT VALID = mevcut satırlar
-- DOĞRULANMAMIŞTIR; kısıt yalnızca yeni/değişen satırlara uygulanır. Yani host'ta
-- roleright'ta karşılığı olmayan (öksüz) right_id satırları BULUNABİLİR. NOT VALID
-- atlanırsa replika host'tan DAHA KATI olur ve host'ta sorunsuz geçen bir veri
-- lokalde reddedilir — replika sadakati bozulur.
--
-- DİKKAT — AYNI AD İKİ TABLODA: rolerightmapping.right_id'nin FK'si de
-- "mapping_right_FK" adını taşır (001'de kurulu) ama o NOT VALID DEĞİLDİR.
-- PostgreSQL'de constraint adı TABLO BAZINDA olduğundan bu geçerlidir; iki tablonun
-- kardeşliğini gösterir. Ad DEĞİŞTİRİLMEZ.
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY public.roleright_endpoint_mapping
    ADD CONSTRAINT "mapping_right_FK" FOREIGN KEY (right_id) REFERENCES public.roleright(id) NOT VALID;

-- ---------------------------------------------------------------------------
-- BU MIGRATION'DA KURULMAYAN FK'ler
--   roleright.webpage_id  -> webpage(id)
--   roleright.ability_id  -> page_abilities(id)
-- Hedef tablolar artık replikada OLMASINA RAĞMEN kurulmadılar. Gerekçe: bu
-- FK'lerin host'ta var olup olmadığı ve —varsa— CONSTRAINT ADLARI BİLİNMİYOR
-- (docs/postgresql_gecis_notlari.txt, S15 hâlâ açık). Ad uydurmak replika
-- sadakatini bozar (aynı ilke: 003'teki editor_role_id FK'si).
-- Cevap gelince 005 kalıbıyla AYRI bir migration ile eklenecektir.
-- 001'in dosya sonundaki "REPLİKADA KURULMAYAN FK'ler" notu buna göre güncellendi
-- (001'in DDL'ine DOKUNULMADI).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- page_abilities HOST VERİSİ — MIGRATION'A KONMADI, ELLE UYGULANIR
-- Aşağıdaki satırlar host dump'ından gelmiştir; UYDURMA DEĞİLDİR
-- (bkz. docs/postgresql_gecis_notlari.txt §1.4). Buna rağmen migration'a
-- KONMAZ: proje kuralı gereği DB VERİSİ REPOYA/GİT'E GİRMEZ — şema girer, içerik
-- girmez. Geliştirme replikasına ID'ler AYNEN korunarak ELLE uygulanır; ID'ler
-- roleright.ability_id'den referans alındığı için değişmemelidir.
-- "5 = all" (Hepsi) yeteneğidir; host'un yeni sayfa kaydı örneğinde kullanılan
-- ability_id budur (§1.3).
--
--   INSERT INTO public.page_abilities (id, name) VALUES
--       (1, 'read'),
--       (2, 'create'),
--       (3, 'delete'),
--       (4, 'update'),
--       (5, 'all');
--
-- Elle uygulandıktan sonra sequence'ı ilerletmeyi unutmayın; aksi halde
-- DEFAULT nextval 1'den başlar ve PK çakışması olur:
--   SELECT setval('public.page_abilities_id_seq', 5, true);
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Runtime hesabının yetkileri (en az yetki)
-- savronik_app YALNIZCA veri okur/yazar: DDL (CREATE/ALTER/DROP) VERİLMEZ.
-- NEDEN AYRICA GRANT: 001'deki "GRANT ON ALL TABLES/SEQUENCES IN SCHEMA public"
-- yalnızca O AN var olan nesneleri kapsar; sonradan eklenen bu üç tablo ve üç
-- sequence oradan yetki DEVRALMAZ (004'teki tablo bazlı kalıp).
-- Sequence USAGE+SELECT gerekir; aksi halde nextval() çalışmaz ve INSERT düşer.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webpage TO savronik_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_abilities TO savronik_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roleright_endpoint_mapping TO savronik_app;

GRANT USAGE, SELECT ON SEQUENCE public.category_id_seq TO savronik_app;
GRANT USAGE, SELECT ON SEQUENCE public.page_abilities_id_seq TO savronik_app;
GRANT USAGE, SELECT ON SEQUENCE public.category_endpoint_mapping_id_seq TO savronik_app;

-- ---------------------------------------------------------------------------
-- KAPANIŞ NOTU
-- Bu migration ile host'un yetki zinciri replikada TAMAMLANIR:
--   "user" -> rolerightmapping -> roleright -> roleright_endpoint_mapping
-- ve sözlükler (webpage, page_abilities) yerindedir. Böylece FAZ B'nin yetki
-- sorgusu (notlar §6, B3) replikada çalıştırılabilir hale gelir.
-- Anket modülü (002) bu tabloların HİÇBİRİNE FK VERMEZ; onları yalnızca OKUR.
-- ---------------------------------------------------------------------------

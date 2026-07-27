-- 004_host_cadre_title.sql
--
-- ############################################################################
-- # HOST ŞEMASI REPLİKASI — YALNIZCA GELİŞTİRME/TEST. ÜRETİMDE ÇALIŞTIRILMAZ. #
-- ############################################################################
-- Bu dosya Savronik'in ÇALIŞAN sistemindeki public.cadre_title tablosunu lokalde
-- yeniden üretir ki anket modülü ona karşı geliştirilip test edilebilsin. Üretim
-- veritabanında bu tablo ZATEN VARDIR; orada çalıştırmak mevcut sisteme zarar verir.
--
-- Tablo bize ait DEĞİLDİR: cadre_title host'un personel UNVAN SÖZLÜĞÜDÜR ve
-- staff.cadre_title_id'nin hedefidir. Personel/unvan verisi host sisteminde ZATEN
-- yönetilmektedir; biz onu KULLANIRIZ, kurmayız. Bize ait olan tek şey anket
-- modülüdür (bkz. 002_anket_modulu.sql).
--
-- NEDEN AYRI DOSYA (001'e eklenmedi): 001_ilk_sema.sql geliştirme veritabanına
-- UYGULANMIŞTIR. Uygulanmış bir migration geriye dönük DÜZENLENMEZ; yeni şema
-- parçası her zaman yeni numaralı bir migration olarak eklenir.
--
-- Kaynak: host sistemden alınan pg_dump çıktısı. Kolon adları, tipleri, SIRASI,
-- NOT NULL/DEFAULT değerleri, PK/FK constraint ADLARI ve indeks adları kaynağa
-- BİREBİR sadıktır.
--
-- ÇALIŞTIRMA: savronik_migrate rolüyle, savronik_akademi veritabanı üzerinde.
-- Şema: public. DDL yalnızca migration ile uygulanır; runtime hesabının
-- (savronik_app) DDL yetkisi YOKTUR.
--
-- ÖN KOŞUL: public.staff tablosu mevcut olmalıdır (üretimde host'ta zaten vardır,
-- geliştirmede 001_ilk_sema.sql ile kurulur). Aksi halde FK düşer.

-- ---------------------------------------------------------------------------
-- Sequence
-- staff/"user"dan FARKLI olarak burada id'yi VERİTABANI ÜRETİR: host dump'ında
-- title_id kolonunun nextval DEFAULT'u vardır. "Değer dış sistemden (SAP / İK)
-- gelir, DEFAULT verilmez" gerekçesi staff_id ve user.id'ye özgüdür; unvan
-- sözlüğünün anahtarı yerel bir sayaçtır.
-- ---------------------------------------------------------------------------

CREATE SEQUENCE public.cadre_title_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- ---------------------------------------------------------------------------
-- Tablo
-- DEFAULT nextval, host dump'ında CREATE TABLE'ın İÇİNE gömülü geldiği için burada
-- da öyle yazılmıştır (001'deki ayrı ALTER ... SET DEFAULT biçimi kullanılmadı).
-- ---------------------------------------------------------------------------

-- Personel unvan sözlüğü: staff.cadre_title_id bu tablonun title_id'sine bakar.
CREATE TABLE public.cadre_title (
    title_id bigint DEFAULT nextval('public.cadre_title_id_seq'::regclass) NOT NULL,
    name character varying
);

-- ---------------------------------------------------------------------------
-- ALTER SEQUENCE ... OWNED BY BİLEREK YOKTUR
-- Host dump'ında sequence'ı kolona sahiplendiren bir OWNED BY satırı BULUNMAZ;
-- yani host'ta bu bağ kurulmamıştır. 001'de OWNED BY vardı çünkü orada dump öyleydi.
-- Var olmayan bir bağı uydurmak replikayı gerçek sistemden uzaklaştırır (aynı ilke:
-- 003'teki editor_role_id FK'si). SONUÇ: tablo/kolon silinse bile sequence sahipsiz
-- kalır ve otomatik silinmez — host'taki davranışın aynısı.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Birincil anahtar (constraint adı kaynak sistemdeki gibi)
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY public.cadre_title
    ADD CONSTRAINT title_pk PRIMARY KEY (title_id);

-- ---------------------------------------------------------------------------
-- Yabancı anahtar (ad kaynak sistemdeki gibi; büyük harf içerdiği için çift tırnak)
-- 001'de staff.cadre_title_id, hedef tablo replikada olmadığı için FK'siz kalmıştı;
-- bu dosya o eksiği kapatır (001'in DDL'i DEĞİŞTİRİLMEZ, yalnız notu güncellendi).
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT "staff_title_FK" FOREIGN KEY (cadre_title_id) REFERENCES public.cadre_title(title_id);

-- ---------------------------------------------------------------------------
-- İndeksler — SALT PERFORMANS nesneleri
-- Doğruluğa/bütünlüğe etkileri YOKTUR; host'ta var oldukları için replika sadakati
-- adına alınmışlardır.
-- ---------------------------------------------------------------------------

-- FK'nin ÇOCUK tarafını indeksler. PostgreSQL bunu otomatik yapmaz: indekssiz
-- kalırsa cadre_title'dan silme/güncellemede staff tamamen taranır.
CREATE INDEX idx_staff_cadre_title ON public.staff USING btree (cadre_title_id);

-- Fonksiyonel indeks: YALNIZCA sorgu da lower(name) yazarsa kullanılır
-- (düz "WHERE name = ..." bu indeksten yararlanmaz).
CREATE INDEX idx_cadre_title_name_lower ON public.cadre_title USING btree (lower((name)::text));

-- ---------------------------------------------------------------------------
-- Runtime hesabının yetkileri (en az yetki)
-- savronik_app YALNIZCA veri okur/yazar: DDL (CREATE/ALTER/DROP) VERİLMEZ.
-- NEDEN AYRICA GRANT: 001'deki "GRANT ON ALL TABLES/SEQUENCES" yalnızca O AN var
-- olan nesneleri kapsar; sonradan gelen bu tablo ve sequence oradan yetki DEVRALMAZ.
-- 003'ten FARKLI olarak burada sequence VARDIR: USAGE+SELECT verilmezse nextval()
-- düşer ve savronik_app INSERT atamaz.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cadre_title TO savronik_app;
GRANT USAGE, SELECT ON SEQUENCE public.cadre_title_id_seq TO savronik_app;

-- ---------------------------------------------------------------------------
-- KAPANIŞ NOTU
-- Anket modülü (002) bu tabloya FK VERMEZ ve onu SORGULAMAK ZORUNDA DEĞİLDİR.
-- MariaDB tarafındaki Kullanici.kadro_unvani serbest metindir; unvan sözlüğüne
-- bağlanma kararı verilirse ayrı bir migration ile ele alınır.
-- ---------------------------------------------------------------------------

-- 003_host_user.sql
--
-- ############################################################################
-- # HOST ŞEMASI REPLİKASI — YALNIZCA GELİŞTİRME/TEST. ÜRETİMDE ÇALIŞTIRILMAZ. #
-- ############################################################################
-- Bu dosya Savronik'in ÇALIŞAN sistemindeki public."user" tablosunu lokalde yeniden
-- üretir ki anket modülü ona karşı geliştirilip test edilebilsin. Üretim
-- veritabanında bu tablo ZATEN VARDIR; orada çalıştırmak mevcut sisteme zarar verir.
--
-- Tablo bize ait DEĞİLDİR: "user" host'un oturum/hesap tablosudur. Kimlik, şifre,
-- login ve rol/yetki host sisteminde ZATEN ÇALIŞMAKTADIR; biz onu KULLANIRIZ,
-- kurmayız. Bize ait olan tek şey anket modülüdür (bkz. 002_anket_modulu.sql).
--
-- NEDEN AYRI DOSYA (001'e eklenmedi): 001_ilk_sema.sql geliştirme veritabanına
-- UYGULANMIŞ olabilir. Uygulanmış bir migration geriye dönük DÜZENLENMEZ; yeni şema
-- parçası her zaman yeni numaralı bir migration olarak eklenir.
--
-- Kaynak: host sistemden alınan pg_dump çıktısı. Kolon adları, tipleri, SIRASI,
-- NOT NULL/DEFAULT değerleri ve PK/FK constraint ADLARI kaynağa BİREBİR sadıktır.
--
-- ÇALIŞTIRMA: savronik_migrate rolüyle, savronik_akademi veritabanı üzerinde.
-- Şema: public. DDL yalnızca migration ile uygulanır; runtime hesabının
-- (savronik_app) DDL yetkisi YOKTUR.
--
-- ÖN KOŞUL: public.staff ve public.role tabloları mevcut olmalıdır (üretimde host'ta
-- zaten vardır, geliştirmede 001_ilk_sema.sql ile kurulur). Aksi halde FK'ler düşer.
--
-- ---------------------------------------------------------------------------
-- ALINAN KARAR: ANKET MODÜLÜ "user"A FK VERMEZ
-- Host'ta public."user" oturumu açan kişinin HESABIDIR ve user.id doğrudan
-- staff.staff_id'ye FK'dir (1:1, AYNI DEĞER). Anket modülünün aktörleri kişilerdir,
-- hesaplar değil: survey.created_by, question.prepared_by ve survey_assignment.staff_id
-- staff'a bağlı KALIR (002 değiştirilmez).
-- Oturumdaki kişinin personel kaydı UYGULAMA KATMANINDA "user.id = staff.staff_id"
-- eşitliğiyle çözülür ve anketler staff üzerinden aranır.
-- BİLİNÇLİ KABUL: bu tasarım, hesabı olmayan bir personele DB düzeyinde anket
-- atanmasına izin verir (o kişi zaten giriş yapamaz). Böyle bir kısıt gerekirse
-- uygulama katmanında yapılır, şemaya FK olarak eklenmez.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Tablo
-- DİKKAT: "user" PostgreSQL'de AYRILMIŞ SÖZCÜKTÜR; tablo adı her yerde (DDL,
-- sorgular, GRANT) çift tırnak içinde yazılmak ZORUNDADIR.
-- ---------------------------------------------------------------------------

-- Uygulamanın oturum/hesap kaydı: bir personelin sisteme giriş yapan hesabı.
-- role_id ile yetki rolüne, id ile personel kaydına bağlanır.
CREATE TABLE public."user" (
    id bigint NOT NULL,
    password character varying,
    temp_password character varying,
    role_id bigint NOT NULL,
    editor_role_id bigint,
    theme character varying,
    is_active boolean DEFAULT true
);

-- ---------------------------------------------------------------------------
-- Sequence'ler
-- NEDEN "user" için sequence YOK: id bir hesap sayacı değil, PERSONEL NUMARASIDIR
-- ve staff.staff_id'ye FK'dir. Değeri dış sistemden (SAP / İK) gelen staff kaydı
-- belirler; veritabanı ÜRETMEZ. staff'taki gerekçenin aynısı geçerlidir: DEFAULT
-- tanımlanmaz ki dışarıdan gelen numara yerel bir sayaçla ezilmesin.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Birincil anahtar (constraint adı kaynak sistemdeki gibi)
-- "user_pk" adı host dump'ından BİREBİR alınmıştır; diğer PK/FK adlarında olduğu
-- gibi değiştirilmemiştir ki replika ile gerçek sistem ad ad karşılaştırılabilsin.
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pk PRIMARY KEY (id);

-- ---------------------------------------------------------------------------
-- Yabancı anahtarlar (adlar kaynak sistemdeki gibi)
-- ---------------------------------------------------------------------------

-- PK'nin AYNI ZAMANDA FK olması hesap <-> personel 1:1 bağını ve "user.id =
-- staff.staff_id" eşitliğini DB düzeyinde garanti eder: bir personelin en fazla bir
-- hesabı olur ve hesabın kimliği personel numarasının ta kendisidir.
ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_staff_fk FOREIGN KEY (id) REFERENCES public.staff(staff_id);

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_role_fk FOREIGN KEY (role_id) REFERENCES public.role(id);

-- ---------------------------------------------------------------------------
-- REPLİKADA KURULMAYAN FK (ÜRETİMDE EKSİK OLDUĞU ANLAMINA GELMEZ)
--   "user": editor_role_id
-- Host'ta bu kolonun büyük olasılıkla public.role(id)'ye baktığı düşünülmektedir
-- (adı ve tipi öyle söylüyor), ancak elimizdeki dump satırlarında böyle bir FK
-- BULUNMADIĞI için burada KURULMAMIŞTIR — var olmayan bir kısıtı uydurmak, replikayı
-- gerçek sistemden uzaklaştırır. Bu bir ÇIKARIMDIR; host'taki gerçek durum
-- öğrenildiğinde FK ya eklenmeli ya da "gerçekten FK değil" notu düşülmelidir.
-- SONUÇ: lokal replikada bu kolonun bütünlüğü DB tarafından zorlanmaz.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Runtime hesabının yetkileri (en az yetki)
-- savronik_app YALNIZCA veri okur/yazar: DDL (CREATE/ALTER/DROP) VERİLMEZ.
-- NEDEN AYRICA GRANT: 001'deki "GRANT ON ALL TABLES" yalnızca O AN var olan
-- nesneleri kapsar; sonradan gelen bu tablo oradan yetki DEVRALMAZ.
-- Sequence GRANT'i YOKTUR: bu tablonun sequence'ı da yoktur (bkz. yukarısı).
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public."user" TO savronik_app;

-- ---------------------------------------------------------------------------
-- KAPANIŞ NOTU
-- Anket modülü (002) bu tabloya FK VERMEZ ve onu SORGULAMAK ZORUNDA DEĞİLDİR.
-- Bağ uygulama katmanında kurulur: oturumdaki hesabın id'si, aynı değere sahip
-- staff.staff_id'ye eşitlenir; anket okuma/yazmaları staff üzerinden yürür.
-- ---------------------------------------------------------------------------

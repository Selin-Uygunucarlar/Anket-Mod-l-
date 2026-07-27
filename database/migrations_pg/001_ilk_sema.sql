-- 001_ilk_sema.sql
--
-- ############################################################################
-- # HOST ŞEMASI REPLİKASI — YALNIZCA GELİŞTİRME/TEST. ÜRETİMDE ÇALIŞTIRILMAZ. #
-- ############################################################################
-- Bu dosya Savronik'in ÇALIŞAN sisteminin tablolarını lokalde yeniden üretir ki anket
-- modülü onlara karşı geliştirilip test edilebilsin. Üretim veritabanında bu tablolar
-- ZATEN VARDIR; burada çalıştırmak mevcut sisteme zarar verir.
--
-- Buradaki tabloların HİÇBİRİ bize ait değildir: staff, "role", roleright,
-- rolerightmapping, rolepermissions, act_id_user host'un tablolarıdır. Kimlik, şifre,
-- login ve rol/yetki host sisteminde ZATEN ÇALIŞMAKTADIR; biz onları KULLANIRIZ,
-- kurmayız. Bize ait olan tek şey anket modülüdür (bkz. 002_anket_modulu.sql).
--
-- Amaç: Host sistemin (Savronik personel/yetki şeması) tablolarını lokalde yeniden
-- üretir: personel (staff), rol/yetki eşlemeleri ve act_id_user kimlik tablosu.
-- Kaynak: host sistemden alınan pg_dump çıktısı. Kolon adları, tipleri, sırası,
-- NOT NULL/DEFAULT değerleri ve constraint ADLARI kaynağa BİREBİR sadıktır;
-- host'ta bulunan yazım biçimleri (ör. role_rigth_id_seq) BİLEREK korunmuştur ki
-- replika ile gerçek sistem karşılaştırılabilsin.
--
-- ÇALIŞTIRMA: savronik_migrate rolüyle, savronik_akademi veritabanı üzerinde.
-- Şema: public. DDL yalnızca migration ile uygulanır; runtime hesabının (savronik_app)
-- DDL yetkisi YOKTUR.
--
-- Proje halen MariaDB'de çalışmaktadır; database/migrations/ (001-011) aktif şemadır.

-- ---------------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------------

-- Kimlik/oturum tarafının kullanıcı kaydı (host sistemdeki act_id_user).
-- picture_id_ host'ta act_ge_bytearray'e FK'dir; o tablo replikaya ALINMADIĞI için
-- burada FK'siz kalır (bkz. dosya sonundaki "Replikada kurulmayan FK'ler" notu).
CREATE TABLE public.act_id_user (
    id_ character varying(64) NOT NULL,
    rev_ integer,
    first_ character varying(255),
    last_ character varying(255),
    display_name_ character varying(255),
    email_ character varying(255),
    pwd_ character varying(255),
    picture_id_ character varying(64),
    tenant_id_ character varying(255) DEFAULT ''::character varying
);

-- Yetkilendirme rolü.
CREATE TABLE public.role (
    id bigint NOT NULL,
    name character varying
);

-- Tekil hak tanımı: bir sayfa (webpage) + o sayfada yapılabilen bir eylem (ability).
CREATE TABLE public.roleright (
    id bigint NOT NULL,
    webpage_id bigint,
    ability_id bigint
);

-- Rol <-> hak eşlemesi (N:M ara tablo).
CREATE TABLE public.rolerightmapping (
    id bigint NOT NULL,
    role_id bigint,
    right_id bigint
);

-- Rolün erişebildiği API uç noktaları.
CREATE TABLE public.rolepermissions (
    id bigint NOT NULL,
    role_id bigint,
    endpoint character varying
);

-- Personel kaydı. Organizasyon kırılımları (şirket/bölüm/birim/takım vb.) ve
-- manager_id (öz-ilişki: personelin yöneticisi de personeldir) burada tutulur.
CREATE TABLE public.staff (
    name character varying,
    company_id bigint,
    location_id bigint,
    group_id bigint,
    department_id bigint,
    unit_id bigint,
    team_id bigint,
    cadre_title_id bigint,
    duty_title_id bigint,
    collar character varying,
    hire_date date,
    education_id bigint,
    kadro bigint,
    workplace bigint,
    location2 bigint,
    email character varying,
    internal_phone character varying,
    staff_id bigint NOT NULL,
    is_active boolean DEFAULT true,
    is_checked boolean DEFAULT false NOT NULL,
    deleted_at timestamp without time zone,
    manager_id bigint,
    birth_date date,
    profession_id bigint,
    is_rnd_personnel boolean DEFAULT false NOT NULL,
    mobile_phone character varying,
    acting_roles character varying,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone,
    termination_date date
);

-- ---------------------------------------------------------------------------
-- Sequence'ler
-- NEDEN staff için sequence YOK: staff_id personel numarasıdır ve dış sistemden
-- (SAP / İK) gelir. Veritabanı bu değeri ÜRETMEZ; DEFAULT tanımlanmaz ki dışarıdan
-- gelen numaranın yanlışlıkla yerel bir sayaçla ezilmesi mümkün olmasın.
-- ---------------------------------------------------------------------------

CREATE SEQUENCE public.role_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Adındaki "rigth" yazımı kaynak sistemdeki haliyle KORUNMUŞTUR (düzeltilmedi).
CREATE SEQUENCE public.role_rigth_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.role_right_mapping_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.rolepermissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- ---------------------------------------------------------------------------
-- Sequence <-> kolon bağları
-- DEFAULT nextval: id kolonu INSERT'te verilmezse otomatik dolar.
-- OWNED BY: kolon/tablo silinince artık sahipsiz kalan sequence de birlikte gider.
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY public.role
    ALTER COLUMN id SET DEFAULT nextval('public.role_id_seq'::regclass);
ALTER SEQUENCE public.role_id_seq OWNED BY public.role.id;

ALTER TABLE ONLY public.roleright
    ALTER COLUMN id SET DEFAULT nextval('public.role_rigth_id_seq'::regclass);
ALTER SEQUENCE public.role_rigth_id_seq OWNED BY public.roleright.id;

ALTER TABLE ONLY public.rolerightmapping
    ALTER COLUMN id SET DEFAULT nextval('public.role_right_mapping_id_seq'::regclass);
ALTER SEQUENCE public.role_right_mapping_id_seq OWNED BY public.rolerightmapping.id;

ALTER TABLE ONLY public.rolepermissions
    ALTER COLUMN id SET DEFAULT nextval('public.rolepermissions_id_seq'::regclass);
ALTER SEQUENCE public.rolepermissions_id_seq OWNED BY public.rolepermissions.id;

-- ---------------------------------------------------------------------------
-- Birincil anahtarlar (constraint adları kaynak sistemdeki gibi)
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY public.act_id_user
    ADD CONSTRAINT act_id_user_pkey PRIMARY KEY (id_);

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pk PRIMARY KEY (id);

ALTER TABLE ONLY public.roleright
    ADD CONSTRAINT role_rigth_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rolerightmapping
    ADD CONSTRAINT role_right_mapping_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rolepermissions
    ADD CONSTRAINT rolepermissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pk PRIMARY KEY (staff_id);

-- ---------------------------------------------------------------------------
-- Yabancı anahtarlar
-- Adlar kaynak sistemdeki gibi büyük harf içerir; PostgreSQL'de büyük/küçük harf
-- korunması için çift tırnak ZORUNLUDUR.
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY public.rolerightmapping
    ADD CONSTRAINT "mapping_right_FK" FOREIGN KEY (right_id) REFERENCES public.roleright(id);

ALTER TABLE ONLY public.rolerightmapping
    ADD CONSTRAINT "mapping_role_FK" FOREIGN KEY (role_id) REFERENCES public.role(id);

ALTER TABLE ONLY public.rolepermissions
    ADD CONSTRAINT "rolepermissions_role_FK" FOREIGN KEY (role_id) REFERENCES public.role(id);

-- ---------------------------------------------------------------------------
-- REPLİKADA KURULMAYAN FK'ler (ÜRETİMDE EKSİK DEĞİLDİR)
-- Aşağıdaki kolonlar host sisteminde FK'dir ve ÜRETİMDE ZATEN KURULUDUR. Burada
-- referanssız kalmalarının tek nedeni, hedef tablolarının (company, department,
-- "group", unit, team, kadro, webpage, ability, location, act_ge_bytearray vb.)
-- bu geliştirme replikasına ALINMAMIŞ olmasıdır.
-- Yani bu bir üretim açığı değil, replikanın bilinçli olarak dar tutulmasıdır.
-- SONUÇ: Lokal replikada bu kolonların bütünlüğü DB tarafından zorlanmaz; lokalde
-- tutarsız bir değer yazılabilmesi ÜRETİMDE de yazılabileceği anlamına GELMEZ.
-- Replikaya ileride bu tablolar eklenirse FK'ler de birlikte kurulmalıdır:
--   staff:       company_id, department_id, group_id, team_id, unit_id, kadro,
--                location_id, location2, duty_title_id, education_id,
--                profession_id, workplace, manager_id
--   roleright:   webpage_id, ability_id
--   act_id_user: picture_id_
-- SONRADAN KAPATILDI: staff.cadre_title_id FK'si 004_host_cadre_title.sql ile
-- kurulmuştur (hedef tablo cadre_title replikaya orada eklendi).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Runtime hesabının yetkileri (en az yetki)
-- savronik_app YALNIZCA veri okur/yazar: DDL (CREATE/ALTER/DROP) VERİLMEZ.
-- Sequence USAGE+SELECT gerekir; aksi halde nextval() çalışmaz ve INSERT düşer.
-- NOT: PostgreSQL 15'ten itibaren PUBLIC rolünün public şemasında CREATE yetkisi
-- ZATEN YOKTUR (şema sahibi pg_database_owner'dır); bu nedenle savronik_app'in
-- tablo oluşturabilmesi için ayrıca bir REVOKE gerekmez. Doğrulandı: savronik_app
-- ile CREATE TABLE denemesi "permission denied for schema public" ile reddedilir.
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO savronik_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO savronik_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO savronik_app;

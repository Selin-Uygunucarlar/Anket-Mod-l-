-- 000_veritabani_ve_roller.sql
--
-- ############################################################################
-- # HOST ŞEMASI REPLİKASI — YALNIZCA GELİŞTİRME/TEST. ÜRETİMDE ÇALIŞTIRILMAZ. #
-- ############################################################################
-- Bu dosya Savronik'in ÇALIŞAN sisteminin tablolarını lokalde yeniden üretir ki anket
-- modülü onlara karşı geliştirilip test edilebilsin. Üretim veritabanında bu tablolar
-- ZATEN VARDIR; burada çalıştırmak mevcut sisteme zarar verir.
--
-- Bu dosyanın payına düşen: geliştirme makinesinde replikanın DURACAĞI kabı
-- (savronik_akademi veritabanı) ve en-az-yetki rol ikilisini kurmak. Üretimde
-- veritabanı da, hesaplar da host tarafında zaten tanımlıdır.
--
-- Amaç: PostgreSQL'e geçiş HAZIRLIĞININ ilk adımı; savronik_akademi veritabanını ve
-- en-az-yetki rol ikilisini oluşturur. Proje halen MariaDB üzerinde çalışmaktadır;
-- database/migrations/ (001-011) aktif şemadır, bu klasör ileriye dönük hazırlıktır.
--
-- Roller MariaDB'deki modelin birebir karşılığıdır:
--   savronik_migrate -> DDL yetkili, veritabanının sahibi. Yalnız migration sırasında kullanılır.
--   savronik_app     -> uygulama runtime hesabı. Yalnız CRUD; DDL (CREATE/ALTER/DROP) YOKTUR.
--
-- ÇALIŞTIRMA (postgres süper kullanıcısıyla, şifreler DIŞARIDAN verilir):
--   psql -v migrate_sifre="$MIGRATE_SIFRE" -v app_sifre="$APP_SIFRE" \
--        -f 000_veritabani_ve_roller.sql
--
-- NEDEN psql değişkeni: bu dosya repoya girer. Şifre sabit string olarak yazılsaydı
-- sır repoya sızardı. Gerçek şifreler yalnızca repo dışı (.gitignore'lu) env
-- dosyalarında durur: database/.env.migration.pg ve backend/.env.pg.
--
-- NEDEN BEGIN/COMMIT YOK: CREATE DATABASE transaction bloğu içinde çalıştırılamaz.

-- Roller önce oluşturulur; veritabanının sahibi olarak savronik_migrate atanabilsin diye.
-- NOSUPERUSER/NOCREATEDB/NOCREATEROLE açıkça yazılır: en az yetki, varsayılana güvenilmez.
-- NOINHERIT KULLANILMAZ (varsayılan INHERIT kalır): PostgreSQL 15'te public şeması
-- pg_database_owner'a aittir ve veritabanı sahibi bu haklara ancak devralma (INHERIT)
-- yoluyla ulaşır. NOINHERIT verilseydi savronik_migrate kendi veritabanında tablo
-- oluşturamazdı ("permission denied for schema public").
CREATE ROLE savronik_migrate LOGIN PASSWORD :'migrate_sifre'
  NOSUPERUSER NOCREATEDB NOCREATEROLE;

CREATE ROLE savronik_app LOGIN PASSWORD :'app_sifre'
  NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- Veritabanı: UTF8 + ICU locale provider 'tr-TR'.
-- NEDEN ICU: MariaDB tarafındaki utf8mb4_turkish_ci karşılığı Türkçe sıralamadır
-- (ı < i, c < ç, o < ö, s < ş, u < ü). Sistemde tr_TR libc locale KURULU DEĞİL,
-- ancak PostgreSQL 15 ICU sağlayıcısını destekliyor ve 'tr-TR' ICU collation mevcut.
-- LC_COLLATE/LC_CTYPE, ICU kullanılsa bile PG15'te zorunlu olduğundan sunucunun
-- mevcut libc locale'i (en_GB.UTF-8) verilir; sıralamayı ICU belirler.
-- TEMPLATE template0: template1'in locale'i (en_GB.UTF-8) farklı olduğundan zorunlu.
CREATE DATABASE savronik_akademi
  OWNER savronik_migrate
  TEMPLATE template0
  ENCODING 'UTF8'
  LOCALE_PROVIDER icu
  ICU_LOCALE 'tr-TR'
  LC_COLLATE 'en_GB.UTF-8'
  LC_CTYPE 'en_GB.UTF-8';

-- Veritabanı düzeyinde en az yetki: PUBLIC (yani "herkes") varsayılan CONNECT ve
-- TEMP haklarını kaybeder; bağlanma hakkı yalnızca iki role açıkça verilir.
REVOKE ALL ON DATABASE savronik_akademi FROM PUBLIC;
GRANT CONNECT ON DATABASE savronik_akademi TO savronik_migrate;
GRANT CONNECT ON DATABASE savronik_akademi TO savronik_app;

-- Şema sahipliği AÇIKÇA verilir: DDL hakkı örtük pg_database_owner devralmasına
-- bırakılmaz, migration hesabının yetkisi tek bakışta okunur olur.
-- \connect gerekir çünkü ALTER SCHEMA hedef veritabanının içinde çalışır.
\connect savronik_akademi
ALTER SCHEMA public OWNER TO savronik_migrate;

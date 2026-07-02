-- 001_ilk_sema.sql
-- Amaç: Anket / Eğitim / Yetkinlik modüllerinin ilk ilişkisel şemasını kurar.
-- Kaynak: docs/veritabani_semasi_guncel.md (ERD + tablo referansı).
-- Bu dosya bir migration'dır: DDL yalnızca migration ile uygulanır, canlı
-- uygulama (runtime hesabı) üzerinden çalıştırılmaz.
-- Motor InnoDB (FK desteği), karakter seti utf8mb4 (Türkçe karakterler).

CREATE DATABASE IF NOT EXISTS savronik_akademi
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_turkish_ci;

USE savronik_akademi;

-- Tablolar FK bağımlılık sırasına göre oluşturulur; ana tablolar önce gelir.

-- Sistemdeki personel kayıtları. PK, SAP numarasıdır (kullanici_kodu).
-- ilgili_yonetici_kodu bir öz-ilişkidir: bir kullanıcının yöneticisi de kullanıcıdır.
CREATE TABLE Kullanici (
  kullanici_kodu            VARCHAR(20)  NOT NULL,
  ad                        VARCHAR(100) NOT NULL,
  soyad                     VARCHAR(100) NOT NULL,
  email                     VARCHAR(255) NOT NULL,
  ise_giris_tarihi          DATE         NULL,
  ilgili_yonetici_kodu      VARCHAR(20)  NULL,
  kullanici_turu            VARCHAR(20)  NOT NULL,   -- yalnızca 'admin' veya 'user'
  sirket                    VARCHAR(100) NULL,
  grup                      VARCHAR(100) NULL,
  bolum                     VARCHAR(100) NULL,
  birim                     VARCHAR(100) NULL,
  kadro_grubu               VARCHAR(100) NULL,
  kadro_unvani              VARCHAR(100) NULL,
  gorev_unvani              VARCHAR(100) NULL,
  arge_personeli            VARCHAR(100) NULL,
  personel_sigorta_is_yeri  VARCHAR(100) NULL,
  gorev_yeri                VARCHAR(100) NULL,
  PRIMARY KEY (kullanici_kodu),
  UNIQUE KEY uq_kullanici_email (email),
  CONSTRAINT fk_kullanici_yonetici
    FOREIGN KEY (ilgili_yonetici_kodu) REFERENCES Kullanici (kullanici_kodu)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Giriş/kimlik doğrulama bilgileri (Kullanici ile 1:1). Şifre asla düz metin
-- tutulmaz; sifre_hash yavaş/adaptive bir algoritmanın (bcrypt/scrypt/Argon2id) çıktısıdır.
CREATE TABLE KullaniciKimlik (
  kullanici_kodu          VARCHAR(20)  NOT NULL,
  sifre_hash              VARCHAR(255) NOT NULL,
  sifre_guncelleme_tarihi DATETIME     NULL,
  son_giris_tarihi        DATETIME     NULL,
  hatali_giris_sayisi     INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (kullanici_kodu),
  CONSTRAINT fk_kimlik_kullanici
    FOREIGN KEY (kullanici_kodu) REFERENCES Kullanici (kullanici_kodu)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Anketin kendisi ve davranış ayarları.
CREATE TABLE Anket (
  anket_id            INT          NOT NULL AUTO_INCREMENT,
  ad                  VARCHAR(255) NOT NULL,
  on_yazi             TEXT         NULL,
  son_yazi            TEXT         NULL,
  aciklama            TEXT         NULL,
  durum               VARCHAR(50)  NOT NULL,   -- anketin yaşam döngüsü (taslak/yayında/kapalı)
  anket_tipi          VARCHAR(50)  NULL,
  erisim_seviyesi     VARCHAR(50)  NULL,
  baslangic_tarihi    DATETIME     NULL,
  bitis_tarihi        DATETIME     NULL,
  almak_zorunda       BOOLEAN      NOT NULL DEFAULT FALSE,
  ana_sayfada_goster  BOOLEAN      NOT NULL DEFAULT FALSE,
  sira_no_goster      BOOLEAN      NOT NULL DEFAULT TRUE,
  soru_gosterim_tipi  VARCHAR(50)  NULL,
  PRIMARY KEY (anket_id)
) ENGINE=InnoDB;

-- Bir ankete ait sorular.
CREATE TABLE Soru (
  soru_id     INT         NOT NULL AUTO_INCREMENT,
  anket_id    INT         NOT NULL,
  soru_metni  TEXT        NOT NULL,
  soru_tipi   VARCHAR(50) NOT NULL,   -- metin / çoktan seçmeli / ölçek...
  sira_no     INT         NULL,
  zorunlu_mu  BOOLEAN     NOT NULL DEFAULT FALSE,
  PRIMARY KEY (soru_id),
  CONSTRAINT fk_soru_anket
    FOREIGN KEY (anket_id) REFERENCES Anket (anket_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Çoktan seçmeli soruların şıkları. Açık uçlu sorularda kayıt girilmez.
CREATE TABLE Secenek (
  secenek_id    INT          NOT NULL AUTO_INCREMENT,
  soru_id       INT          NOT NULL,
  secenek_metni VARCHAR(255) NOT NULL,
  sira_no       INT          NULL,
  PRIMARY KEY (secenek_id),
  CONSTRAINT fk_secenek_soru
    FOREIGN KEY (soru_id) REFERENCES Soru (soru_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Anketin bir kullanıcıya atanması (Anket ↔ Kullanici N:M ara tablosu).
-- durum, kişiye özel tamamlanma durumudur (Anket.durum'dan farklı kavram).
CREATE TABLE AnketAtama (
  atama_id          INT         NOT NULL AUTO_INCREMENT,
  anket_id          INT         NOT NULL,
  kullanici_kodu    VARCHAR(20) NOT NULL,
  atama_tarihi      DATETIME    NOT NULL,
  son_tarih         DATETIME    NULL,
  durum             VARCHAR(20) NOT NULL,   -- atandı / devam_ediyor / tamamlandı
  baslama_tarihi    DATETIME    NULL,
  tamamlanma_tarihi DATETIME    NULL,
  PRIMARY KEY (atama_id),
  CONSTRAINT fk_anketatama_anket
    FOREIGN KEY (anket_id) REFERENCES Anket (anket_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_anketatama_kullanici
    FOREIGN KEY (kullanici_kodu) REFERENCES Kullanici (kullanici_kodu)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Kullanıcının verdiği cevaplar. Atama + soru üzerinden bağlanır.
CREATE TABLE Cevap (
  cevap_id            INT  NOT NULL AUTO_INCREMENT,
  atama_id            INT  NOT NULL,
  soru_id             INT  NOT NULL,
  secilen_secenek_id  INT  NULL,   -- çoktan seçmeli için
  cevap_metni         TEXT NULL,   -- açık uçlu için
  PRIMARY KEY (cevap_id),
  CONSTRAINT fk_cevap_atama
    FOREIGN KEY (atama_id) REFERENCES AnketAtama (atama_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cevap_soru
    FOREIGN KEY (soru_id) REFERENCES Soru (soru_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cevap_secenek
    FOREIGN KEY (secilen_secenek_id) REFERENCES Secenek (secenek_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- İlişkili ankete ait mesaj ayrıntıları. (Alanlar netleşince genişletilecek.)
CREATE TABLE MesajAyrintilari (
  mesaj_id INT NOT NULL AUTO_INCREMENT,
  anket_id INT NOT NULL,
  PRIMARY KEY (mesaj_id),
  CONSTRAINT fk_mesaj_anket
    FOREIGN KEY (anket_id) REFERENCES Anket (anket_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Kullanıcıya atanabilen eğitimler. secili_butce_plan_id FK'si, EgitimButcePlan
-- tablosu oluştuktan sonra ALTER ile eklenir (döngüsel bağımlılık).
CREATE TABLE Egitim (
  egitim_id             INT          NOT NULL AUTO_INCREMENT,
  ad                    VARCHAR(255) NOT NULL,
  secili_butce_plan_id  INT          NULL,   -- seçili/onaylı plan (nullable)
  PRIMARY KEY (egitim_id)
) ENGINE=InnoDB;

-- Bir eğitim için hazırlanan alternatif bütçe planları (Egitim 1:N).
CREATE TABLE EgitimButcePlan (
  plan_id           INT          NOT NULL AUTO_INCREMENT,
  egitim_id         INT          NOT NULL,
  plan_adi          VARCHAR(100) NOT NULL,   -- ör. ekonomik / standart / premium
  aciklama          VARCHAR(255) NULL,
  durum             VARCHAR(20)  NOT NULL,   -- taslak / onaylı
  olusturma_tarihi  DATE         NULL,
  PRIMARY KEY (plan_id),
  CONSTRAINT fk_butceplan_egitim
    FOREIGN KEY (egitim_id) REFERENCES Egitim (egitim_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Döngüsel FK: Egitim'in seçili bütçe planı. Plan silinirse seçim boşalır.
ALTER TABLE Egitim
  ADD CONSTRAINT fk_egitim_secili_plan
    FOREIGN KEY (secili_butce_plan_id) REFERENCES EgitimButcePlan (plan_id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Bir bütçe planının masraf kalemleri (EgitimButcePlan 1:N).
CREATE TABLE EgitimButceKalem (
  kalem_id        INT           NOT NULL AUTO_INCREMENT,
  plan_id         INT           NOT NULL,
  kalem_adi       VARCHAR(255)  NOT NULL,   -- eğitmen, salon, materyal...
  tarih           DATE          NULL,
  tedarikci       VARCHAR(255)  NULL,
  planlanan_tutar DECIMAL(15,2) NULL,
  gercek_tutar    DECIMAL(15,2) NULL,
  para_birimi     VARCHAR(10)   NULL,   -- TL / USD / EUR
  PRIMARY KEY (kalem_id),
  CONSTRAINT fk_kalem_plan
    FOREIGN KEY (plan_id) REFERENCES EgitimButcePlan (plan_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Bir eğitime ait dokümanlar (Egitim 1:N). kaynak alanı, herkese açık URL değil
-- iç dosya yolu/kimliği tutar; erişim kimlik doğrulamalı endpoint üzerinden verilir.
CREATE TABLE EgitimDokuman (
  dokuman_id      INT          NOT NULL AUTO_INCREMENT,
  egitim_id       INT          NOT NULL,
  baslik          VARCHAR(255) NOT NULL,
  icerik_tipi     VARCHAR(50)  NULL,   -- video / pdf / word / ppt...
  kaynak_tipi     VARCHAR(50)  NULL,   -- dis_link / yuklenen_dosya
  kaynak          VARCHAR(255) NULL,   -- iç dosya yolu/kimliği veya dış link
  sira_no         INT          NULL,
  yuklenme_tarihi DATE         NULL,
  PRIMARY KEY (dokuman_id),
  CONSTRAINT fk_dokuman_egitim
    FOREIGN KEY (egitim_id) REFERENCES Egitim (egitim_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Eğitimin bir kullanıcıya atanması (Egitim ↔ Kullanici N:M).
CREATE TABLE EgitimAtama (
  egitim_atama_id   INT         NOT NULL AUTO_INCREMENT,
  egitim_id         INT         NOT NULL,
  kullanici_kodu    VARCHAR(20) NOT NULL,
  atama_tarihi      DATETIME    NOT NULL,
  durum             VARCHAR(20) NOT NULL,   -- tamamlandı / tamamlanmadı
  tamamlanma_tarihi DATETIME    NULL,
  PRIMARY KEY (egitim_atama_id),
  CONSTRAINT fk_egitimatama_egitim
    FOREIGN KEY (egitim_id) REFERENCES Egitim (egitim_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_egitimatama_kullanici
    FOREIGN KEY (kullanici_kodu) REFERENCES Kullanici (kullanici_kodu)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Kullanıcıya atanan yetkinlikler. (İçerik netleşince genişletilecek.)
CREATE TABLE Yetkinlik (
  yetkinlik_id INT          NOT NULL AUTO_INCREMENT,
  ad           VARCHAR(255) NOT NULL,
  PRIMARY KEY (yetkinlik_id)
) ENGINE=InnoDB;

-- Yetkinliğin bir kullanıcıya atanması (Yetkinlik ↔ Kullanici N:M).
CREATE TABLE YetkinlikAtama (
  yetkinlik_atama_id INT         NOT NULL AUTO_INCREMENT,
  yetkinlik_id       INT         NOT NULL,
  kullanici_kodu     VARCHAR(20) NOT NULL,
  atama_tarihi       DATETIME    NOT NULL,
  PRIMARY KEY (yetkinlik_atama_id),
  CONSTRAINT fk_yetkinlikatama_yetkinlik
    FOREIGN KEY (yetkinlik_id) REFERENCES Yetkinlik (yetkinlik_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_yetkinlikatama_kullanici
    FOREIGN KEY (kullanici_kodu) REFERENCES Kullanici (kullanici_kodu)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Bir yetkinliğin altındaki puanlanacak parametreler (Yetkinlik 1:N).
-- ust_parametre_id öz-ilişkidir: parametre alt parametrelere bölünebilir.
CREATE TABLE YetkinlikParametre (
  parametre_id     INT          NOT NULL AUTO_INCREMENT,
  yetkinlik_id     INT          NOT NULL,
  ust_parametre_id INT          NULL,   -- üst parametre; boşsa üst seviye
  ad               VARCHAR(255) NOT NULL,
  aciklama         VARCHAR(255) NULL,
  sira_no          INT          NULL,
  PRIMARY KEY (parametre_id),
  CONSTRAINT fk_parametre_yetkinlik
    FOREIGN KEY (yetkinlik_id) REFERENCES Yetkinlik (yetkinlik_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_parametre_ust
    FOREIGN KEY (ust_parametre_id) REFERENCES YetkinlikParametre (parametre_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Bir kullanıcının bir parametre için aldığı puanlar (öz-değerlendirme + yönetici).
-- Puanlar 1–5 aralığında CHECK ile sınırlanır. degerlendiren_yonetici_kodu,
-- puanı veren yöneticiyi ayrıca kaydeder (yönetici zamanla değişebilir).
CREATE TABLE YetkinlikDegerlendirme (
  degerlendirme_id            INT         NOT NULL AUTO_INCREMENT,
  kullanici_kodu              VARCHAR(20) NOT NULL,   -- değerlendirilen kişi
  parametre_id                INT         NOT NULL,
  donem                       VARCHAR(20) NOT NULL,   -- ör. 2026-H1
  oz_puan                     INT         NULL,
  oz_puan_tarihi              DATETIME    NULL,
  yonetici_puan               INT         NULL,
  degerlendiren_yonetici_kodu VARCHAR(20) NULL,       -- puanı veren yönetici
  yonetici_puan_tarihi        DATETIME    NULL,
  PRIMARY KEY (degerlendirme_id),
  CONSTRAINT fk_degerlendirme_kullanici
    FOREIGN KEY (kullanici_kodu) REFERENCES Kullanici (kullanici_kodu)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_degerlendirme_parametre
    FOREIGN KEY (parametre_id) REFERENCES YetkinlikParametre (parametre_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_degerlendirme_yonetici
    FOREIGN KEY (degerlendiren_yonetici_kodu) REFERENCES Kullanici (kullanici_kodu)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_oz_puan       CHECK (oz_puan BETWEEN 1 AND 5),
  CONSTRAINT chk_yonetici_puan CHECK (yonetici_puan BETWEEN 1 AND 5)
) ENGINE=InnoDB;

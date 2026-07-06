-- 005_secenek_ve_gecici_sifre.sql
-- Amaç: (1) Kullanıcı ekleme formundaki 10 "yönetilen dropdown" alanının
-- seçeneklerini TEK tabloda (TanimliSecenek) tutmak (10 ayrı tablo YOK; DRY),
-- (2) KullaniciKimlik'e geçici (tek kullanımlık) şifre bayrağını eklemek.
-- Bu dosya bir migration'dır: DDL yalnızca migration ile ve DDL yetkili migration
-- hesabıyla (savronik_migrate) uygulanır; canlı uygulama (runtime hesabı) çalıştırmaz.
--
-- Tasarım: TanimliSecenek yalnızca ŞEMADIR; seçenek satırları (içerik) migration'a
-- KONMAZ (DB içeriği git'e girmez, normal INSERT ile runtime tarafından eklenir).
-- kategori sabit bir kümedir; kullanici_turu bu tabloda DEĞİLDİR (o admin/user sabiti).
-- sifre_degistirilmeli, kimliğin geçici şifre taşıdığını (kişi kendi şifresini
-- belirleyene kadar TRUE) gösterir.

USE savronik_akademi;

-- Yönetilen dropdown seçenekleri. 10 alanın tümü tek tabloda; her satır bir
-- kategoriye ait bir değerdir. Aynı (kategori, deger) çifti tekrar edemez.
-- kategori sabit küme: sirket, grup, bolum, birim, kadro_grubu, kadro_unvani,
-- gorev_unvani, arge_personeli, personel_sigorta_is_yeri, gorev_yeri.
CREATE TABLE TanimliSecenek (
  id       INT          NOT NULL AUTO_INCREMENT,
  kategori VARCHAR(50)  NOT NULL,   -- dropdown alanının kimliği (sabit küme)
  deger    VARCHAR(100) NOT NULL,   -- o kategoride seçilebilir değer
  PRIMARY KEY (id),
  UNIQUE KEY uq_secenek_kategori_deger (kategori, deger)
) ENGINE=InnoDB;

-- sifre_degistirilmeli: kimlik geçici (tek kullanımlık) şifre taşıyor mu.
-- Yeni eklenen kullanıcıda TRUE; kişi kendi şifresini belirleyince FALSE olur.
-- sifre_hash'ten hemen sonra konumlanır.
ALTER TABLE KullaniciKimlik
  ADD COLUMN sifre_degistirilmeli BOOLEAN NOT NULL DEFAULT FALSE AFTER sifre_hash;

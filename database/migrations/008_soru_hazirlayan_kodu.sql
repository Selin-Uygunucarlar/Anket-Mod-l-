-- 008_soru_hazirlayan_kodu.sql
-- Amaç: Soru tablosuna, soruyu hazırlayan admin'in sicilini (kullanici_kodu)
-- tutan hazirlayan_kodu kolonunu eklemek. Böylece soru listesinde her sorunun
-- kimin tarafından hazırlandığı (ad/soyad) gösterilebilir.
--
-- NEDEN NULL: Soru ekleme akışı henüz yoktur; mevcut Soru satırlarında hazırlayan
-- bilgisi yoktur ve bu satırlar bozulmamalıdır. Ayrıca hazırlayan kullanıcı ileride
-- silinirse soru içeriği KAYBOLMAMALI, yalnızca hazırlayan bağı boşalmalıdır.
-- Bu yüzden kolon NULL kabul eder.
--
-- NEDEN ON DELETE SET NULL: Hazırlayan kullanıcı silinirse soru kaydı KORUNUR;
-- hazirlayan_kodu NULL'a çekilir (yetim/kırık kayıt oluşmaz, soru silinmez).
-- NEDEN ON UPDATE CASCADE: Bir kullanıcının sicili (PK) değişirse, bu kolondaki
-- değer DB tarafından otomatik güncellenir (şemadaki diğer FK'lerle tutarlı davranış).
--
-- SİCİL BAĞIMLILIK NOTU: Bu FK ON DELETE SET NULL + ON UPDATE CASCADE olduğundan,
-- sicil değiştirme/silme bu tablo yüzünden BLOKLANMAZ (rename cascade'lenir, silme
-- null'lanır — hiçbir durumda yetim/kırık veri kalmaz). Bu nedenle bu kolon,
-- kullanici_bagimliligi_var_mi bağımlılık kontrolüne BİLİNÇLİ OLARAK dahil edilmez.
--
-- Bu dosya bir migration'dır: DDL yalnızca migration ile ve DDL yetkili migration
-- hesabıyla (savronik_migrate) uygulanır; canlı uygulama (runtime hesabı) çalıştırmaz.
-- 001'i düzenlemek yerine yeni migration kullanılmasının nedeni migration
-- immutability'sidir: geçmiş migration'lar değiştirilmez, yeni dosya eklenir.

USE savronik_akademi;

ALTER TABLE Soru
  ADD COLUMN hazirlayan_kodu VARCHAR(20) NULL AFTER zorunlu_mu,
  ADD CONSTRAINT fk_soru_hazirlayan
    FOREIGN KEY (hazirlayan_kodu) REFERENCES Kullanici (kullanici_kodu)
    ON DELETE SET NULL ON UPDATE CASCADE;

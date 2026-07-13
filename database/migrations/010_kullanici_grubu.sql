-- 010_kullanici_grubu.sql
-- Amaç: İlişkisel "Kullanıcı Grupları" yapısını kurmak. Yönetici, Mühendis,
-- Tekniker, İnsan Kaynakları gibi gruplar tanımlanır ve bir kullanıcı EN FAZLA
-- BİR gruba ait olur (Kullanici -> KullaniciGrubu, N:1). Bunun için yeni bir
-- KullaniciGrubu tablosu ve Kullanici tablosuna grup_id FK kolonu eklenir.
--
-- ÖNEMLİ AYRIM: Kullanici tablosundaki mevcut serbest-metin `grup VARCHAR(100)`
-- alanı (TanimliSecenek dropdown'ından beslenen organizasyonel etiket) BU YAPIYLA
-- İLGİSİZDİR ve DOKUNULMAZ. Yeni grup_id, ilişkisel gruba işaret eden AYRI bir
-- alandır; iki kavram karıştırılmaz.
--
-- NEDEN ON DELETE SET NULL: Bir grup silinince üyeleri KAYBOLMAMALI, yalnızca
-- grupsuz kalmalıdır (grup_id NULL'a çekilir; kişiler silinmez, yetim kayıt olmaz).
-- NEDEN ON UPDATE CASCADE: Grubun PK'si (grup_id) değişirse Kullanici.grup_id
-- otomatik güncellenir (şemadaki diğer FK'lerle tutarlı davranış).
--
-- SİCİL BAĞIMLILIK NOTU: Bu FK'nin YÖNÜ Kullanici -> KullaniciGrubu'dur; yani
-- KullaniciGrubu, Kullanici.kullanici_kodu'ya FK VERMEZ. Dolayısıyla bu tablo
-- sicil (kullanici_kodu) değiştirme/silme akışını ETKİLEMEZ ve
-- kullanici_bagimliligi_var_mi kontrolüne EKLENMESİ GEREKMEZ (bkz. kullanici_sorgulari
-- yorumu). Ters yönde ise grup silme, ON DELETE SET NULL sayesinde üyeleri
-- bloklamadan grupsuz bırakır.
--
-- Bu dosya bir migration'dır: DDL yalnızca migration ile ve DDL yetkili migration
-- hesabıyla (savronik_migrate) uygulanır; canlı uygulama (runtime hesabı) çalıştırmaz.
-- 001'i düzenlemek yerine yeni migration kullanılmasının nedeni migration
-- immutability'sidir: geçmiş migration'lar değiştirilmez, yeni dosya eklenir.
-- Motor InnoDB (FK desteği), karakter seti utf8mb4_turkish_ci (Türkçe karakterler).
--
-- DB İÇERİĞİ (grup satırları) BURAYA KONMAZ: yeni grup tanımları normal INSERT'tür
-- ve runtime hesabıyla eklenir (git'e DB içeriği girmez).

USE savronik_akademi;

-- İlişkisel kullanıcı grupları. Her grup benzersiz bir ada sahiptir (uq_grup_ad);
-- aynı ad iki kez tanımlanamaz. Üyelik Kullanici.grup_id üzerinden kurulur
-- (bu tabloda kullanıcıya bağ yoktur; yön Kullanici -> KullaniciGrubu).
CREATE TABLE KullaniciGrubu (
  grup_id INT          NOT NULL AUTO_INCREMENT,
  ad      VARCHAR(100) NOT NULL,   -- grup adı (ör. Yönetici, Mühendis, Tekniker)
  PRIMARY KEY (grup_id),
  UNIQUE KEY uq_grup_ad (ad)
) ENGINE=InnoDB;

-- Kullanici'ya ilişkisel grup bağı. NULL: kullanıcı hiçbir gruba ait değil
-- (grupsuz). Mevcut serbest-metin `grup` kolonundan hemen sonra konumlanır ama
-- ondan bağımsızdır. Grup silinince SET NULL ile grupsuz kalır (kişi silinmez).
ALTER TABLE Kullanici
  ADD COLUMN grup_id INT NULL AFTER grup,
  ADD CONSTRAINT fk_kullanici_grup
    FOREIGN KEY (grup_id) REFERENCES KullaniciGrubu (grup_id)
    ON DELETE SET NULL ON UPDATE CASCADE;

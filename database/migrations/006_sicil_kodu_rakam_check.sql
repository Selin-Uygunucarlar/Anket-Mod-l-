-- 006_sicil_kodu_rakam_check.sql
-- Amaç: Sicil numarası (Kullanici.kullanici_kodu) SADECE rakamdan oluşmalıdır.
-- İş kuralı ^[0-9]{1,20}$ öncelikle kod katmanında (Controller doğrulaması)
-- uygulanır; bu migration ise DB'yi NİHAİ GARANTİ (defense-in-depth) yapar:
-- herhangi bir katman atlansa bile harfli/rakam-dışı sicil DB'ye giremez.
-- Bu dosya bir migration'dır: DDL yalnızca migration ile ve DDL yetkili migration
-- hesabıyla (savronik_migrate) uygulanır; canlı uygulama (runtime hesabı) çalıştırmaz.
--
-- Not: ilgili_yonetici_kodu için AYRI CHECK gerekmez. O kolon fk_kullanici_yonetici
-- ile Kullanici.kullanici_kodu'ya FK olduğundan, oraya yazılabilecek her değer zaten
-- Kullanici'de var olmak zorundadır; bu CHECK Kullanici'yi rakama zorlayınca kısıt
-- geçişli olarak ilgili_yonetici_kodu için de garanti altına alınmış olur.
-- Not: Uzunluk üst sınırı (max 20) kolonun VARCHAR(20) tipiyle zaten zorlanır;
-- burada REGEXP yalnızca "rakam dışı karakter yok ve boş değil" kuralını ekler.

USE savronik_akademi;

-- kullanici_kodu yalnızca rakam (en az bir hane) içerebilir; harf/işaret/boş reddedilir.
ALTER TABLE Kullanici
  ADD CONSTRAINT chk_kullanici_kodu_rakam CHECK (kullanici_kodu REGEXP '^[0-9]+$');

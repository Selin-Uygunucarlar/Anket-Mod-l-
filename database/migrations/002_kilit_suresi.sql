-- 002_kilit_suresi.sql
-- Amaç: Geçici hesap kilidi (kaba kuvvete karşı) için KullaniciKimlik'e son
-- başarısız giriş denemesinin zamanını tutan bir kolon ekler.
-- Bu dosya bir migration'dır: DDL yalnızca migration ile ve DDL yetkili
-- migration hesabıyla uygulanır; canlı uygulama (runtime hesabı) çalıştırmaz.
--
-- Tasarım: DB kilidin ne zaman biteceğini DEĞİL, ham gerçeği (son hatalı giriş
-- zamanı) saklar. 5 dakikalık kilit süresini Service yorumlar; yani Service bu
-- kolon + kilit süresini kullanarak kilidin dolup dolmadığına karar verir.

USE savronik_akademi;

-- son_hatali_giris_tarihi: en son başarısız giriş denemesinin zamanı (NULL =
-- bekleyen hatalı deneme yok). hatali_giris_sayisi'ndan hemen sonra konumlanır.
ALTER TABLE KullaniciKimlik
  ADD COLUMN son_hatali_giris_tarihi DATETIME NULL AFTER hatali_giris_sayisi;

-- 004_kullanici_liste_kolonlari.sql
-- Amaç: Admin "Kullanıcı Listesi" ekranı için Kullanici tablosuna kullanıcının
-- aktif/pasif durumunu ve sisteme eklenme tarihini tutan iki kolon ekler.
-- Bu dosya bir migration'dır: DDL yalnızca migration ile ve DDL yetkili migration
-- hesabıyla (savronik_migrate) uygulanır; canlı uygulama (runtime hesabı) çalıştırmaz.
--
-- Tasarım: aktif mevcut satırlar için TRUE varsayılır (geçmiş kayıtlar aktif kalsın).
-- olusturma_tarihi mevcut satırlarda NULL kalır (eklenme anı geriye dönük bilinmiyor);
-- ileride yeni kayıt eklenirken Service tarafından doldurulur.

USE savronik_akademi;

-- aktif: kullanıcının etkin olup olmadığı. Rol/tür (kullanici_turu) ile karıştırılmaz;
-- yalnızca hesabın kullanımda olup olmadığını gösterir. kullanici_turu'ndan sonra konumlanır.
ALTER TABLE Kullanici
  ADD COLUMN aktif BOOLEAN NOT NULL DEFAULT TRUE AFTER kullanici_turu;

-- olusturma_tarihi: kullanıcının sisteme eklendiği an (NULL = geriye dönük bilinmiyor).
-- Personelin işe giriş bilgisiyle kavramsal olarak yakın olduğundan ise_giris_tarihi'nden sonra konumlanır.
ALTER TABLE Kullanici
  ADD COLUMN olusturma_tarihi DATETIME NULL AFTER ise_giris_tarihi;

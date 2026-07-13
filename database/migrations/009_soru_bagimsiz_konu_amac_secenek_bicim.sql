-- 009_soru_bagimsiz_konu_amac_secenek_bicim.sql
-- Amaç: Anket sorusu EKLEME akışını (kayıt) desteklemek için Soru/Secenek
-- şemasını üç noktada güncellemek:
--   1) Soru.anket_id -> NULL: sorular artık BAĞIMSIZ eklenir (bir ankete bağlı
--      olmadan). Ankete bağlama sonraki iştir. FK fk_soru_anket KORUNUR; NULL'a
--      izin verir ama NON-NULL değerlerde hâlâ geçerli bir anket_id zorlar
--      (yetim/kırık bağ oluşmaz).
--   2) Soru'ya konu ve amac kolonları: soru ekleme formunun kategorileri.
--      NEDEN NULL: mevcut Soru satırlarında bu değerler yoktur ve bozulmamalıdır;
--      yeni kayıtlarda ZORUNLULUK Service katmanında uygulanır (DB'de değil).
--   3) Secenek.secenek_metni -> TEXT NOT NULL + COMMENT: şık metni artık DÜZ METİN
--      değil, BİÇİMLENDİRİLMİŞ içerik (HTML/markup) tutabilir. Eski VARCHAR(255)
--      "düz metin" varsayımı GEÇERSİZDİR.
--
-- GÜVENLİK (kritik): secenek_metni HTML/markup içerebildiğinden, bu içerik kayda
-- ya da gösterime bağlanırken SUNUCU TARAFINDA SANİTİZASYON ZORUNLUDUR (XSS).
-- Sanitizasyon Service katmanının sorumluluğudur; bu not zorunluluğu DB kataloğunda
-- da görünür kılar (bkz. 007 aynı kalıp, Soru.soru_metni için).
--
-- Bu dosya bir migration'dır: DDL yalnızca migration ile ve DDL yetkili migration
-- hesabıyla (savronik_migrate) uygulanır; canlı uygulama (runtime hesabı) çalıştırmaz.
-- 001'i düzenlemek yerine yeni migration kullanılmasının nedeni migration
-- immutability'sidir: geçmiş migration'lar değiştirilmez, yeni dosya eklenir.

USE savronik_akademi;

-- (1) anket_id NULL'a çekilir. FK fk_soru_anket'i DROP/ADD etmeye gerek yoktur:
-- kolon tipini NULL yapmak FK'yi bozmaz; NULL değerler FK denetiminden muaftır,
-- NON-NULL değerler hâlâ Anket(anket_id) ile eşleşmek zorundadır.
ALTER TABLE Soru
  MODIFY anket_id INT NULL
  COMMENT 'Sorunun bağlı olduğu anket; BAĞIMSIZ soruda NULL. NON-NULL ise fk_soru_anket ile geçerli bir anket_id zorlanır.';

-- (2) Soru ekleme formunun kategorileri. NULL: mevcut satırlar korunur; yeni
-- kayıtlarda zorunluluk Service'te uygulanır. Konum: soru_tipi'nin hemen ardı.
ALTER TABLE Soru
  ADD COLUMN konu VARCHAR(255) NULL AFTER soru_tipi,
  ADD COLUMN amac VARCHAR(255) NULL AFTER konu;

-- (3) secenek_metni artık biçimli içerik taşıyabilir (TEXT); NOT NULL korunur.
-- COMMENT ile sanitizasyon zorunluluğu DB kataloğunda kalıcılaştırılır.
ALTER TABLE Secenek
  MODIFY secenek_metni TEXT NOT NULL
  COMMENT 'Biçimlendirilmiş içerik (HTML/markup) tutabilir; düz metin değildir. Kayıt/gösterim öncesi SUNUCU TARAFINDA sanitizasyon zorunludur (XSS). Ham HTML güvenilmeden kullanılmaz.';

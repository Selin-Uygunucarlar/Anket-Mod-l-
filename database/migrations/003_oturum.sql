-- 003_oturum.sql
-- Amaç: httpOnly cookie tabanlı sunucu tarafı oturum (server-side session) için
-- Oturum tablosunu kurar. Kullanıcı giriş yapınca sunucu bir oturum üretir; ham
-- token cookie'de tutulur, DB'de ise yalnızca token'ın SHA-256 ÖZETİ saklanır.
-- Bu dosya bir migration'dır: DDL yalnızca migration ile ve DDL yetkili migration
-- hesabıyla (savronik_migrate) uygulanır; canlı uygulama (runtime hesabı) çalıştırmaz.
--
-- Güvenlik tasarımı: DB sızsa bile saklanan özetlerden ham token geri
-- üretilemez, dolayısıyla çalınan satırlarla oturum ele geçirilemez. Kayan
-- (sliding) oturum ve süre hesabı DB'de DEĞİL Service'te yapılır; DB yalnızca
-- ham zaman değerlerini (olusturma/son_erisim/gecerlilik_bitisi) saklar.

USE savronik_akademi;

-- Aktif sunucu oturumları. Her satır bir oturum jetonuna karşılık gelir.
-- kullanici_kodu, Kullanici tablosuyla BİREBİR aynı tip/collation (VARCHAR(20),
-- DB varsayılanı utf8mb4_turkish_ci) olacak şekilde FK ile bağlanır.
CREATE TABLE Oturum (
  -- Oturum jetonunun SHA-256 hex ÖZETİ (64 karakter). Ham token ASLA saklanmaz;
  -- DB sızsa bile bu özetten token geri elde edilemez. PK olarak aramada kullanılır.
  oturum_kodu_hash   CHAR(64)    NOT NULL,
  kullanici_kodu     VARCHAR(20) NOT NULL,
  olusturma_tarihi   DATETIME    NOT NULL,   -- oturumun oluşturulduğu an
  son_erisim_tarihi  DATETIME    NOT NULL,   -- en son kullanıldığı an (sliding)
  gecerlilik_bitisi  DATETIME    NOT NULL,   -- bu andan sonra oturum geçersiz
  PRIMARY KEY (oturum_kodu_hash),
  CONSTRAINT fk_oturum_kullanici
    FOREIGN KEY (kullanici_kodu) REFERENCES Kullanici (kullanici_kodu)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Süresi geçmiş oturumların toplu temizliğini (bakım) hızlandırır.
CREATE INDEX ix_oturum_gecerlilik_bitisi ON Oturum (gecerlilik_bitisi);

-- Bir kullanıcının oturumlarını bulmayı (ör. tüm oturumları kapatma) hızlandırır.
CREATE INDEX ix_oturum_kullanici_kodu ON Oturum (kullanici_kodu);

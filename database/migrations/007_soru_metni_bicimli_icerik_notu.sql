-- 007_soru_metni_bicimli_icerik_notu.sql
-- Amaç: Soru.soru_metni kolonunun DÜZ METİN değil, biçimlendirilmiş içerik
-- (kalın/italik/liste/font boyutu/renk/hizalama/link) tutabileceğini kalıcı bir
-- KARAR NOTU olarak DB kataloğuna işlemek. Biçim bilgisi AYRI bir kolonda değil,
-- doğrudan soru_metni (TEXT) içinde HTML/markup olarak saklanır (Yol 1: içerik+biçim
-- ayrılmaz). Bu migration veri modelini DEĞİŞTİRMEZ, yeni kolon EKLEMEZ; kolonun
-- tip/NULL kısıtları (TEXT NOT NULL) aynen korunur, yalnızca COLUMN COMMENT eklenir.
--
-- GÜVENLİK (kritik): soru_metni HTML/markup içerebildiğinden, bu içerik kayda ya da
-- gösterime bağlanırken SUNUCU TARAFINDA SANİTİZASYON ZORUNLUDUR (XSS koruması).
-- Ham HTML güvenilmeden kullanılamaz; sanitizasyon Service katmanının sorumluluğudur,
-- bu not yalnızca kararı ve zorunluluğu DB tarafında da görünür kılar.
--
-- Bu dosya bir migration'dır: DDL yalnızca migration ile ve DDL yetkili migration
-- hesabıyla (savronik_migrate) uygulanır; canlı uygulama (runtime hesabı) çalıştırmaz.
-- 001'i düzenlemek yerine yeni migration kullanılmasının nedeni migration
-- immutability'sidir: 001 daha önce uygulanmış olabilir, geçmiş migration değiştirilmez.

USE savronik_akademi;

-- Kolonun tip/kısıtları değişmeden yalnızca kalıcı açıklama (COMMENT) eklenir.
ALTER TABLE Soru
  MODIFY soru_metni TEXT NOT NULL
  COMMENT 'Biçimlendirilmiş içerik (HTML/markup) tutabilir; düz metin değildir. Kayıt/gösterim öncesi SUNUCU TARAFINDA sanitizasyon zorunludur (XSS). Ham HTML güvenilmeden kullanılmaz.';

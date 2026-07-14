-- 011_anket_olusturma.sql
-- Amaç: Anket OLUŞTURMA + LİSTELEME akışını şema tarafında desteklemek:
--   1) AnketSoru ara tablosu: Anket <-> Soru bağı artık N:M kurulur.
--   2) Anket.erisim_grup_id: anket 'grup' erişiminde hangi gruba açıktır.
--   3) Anket.olusturan_kodu: liste ekranının "Oluşturan" kolonu (şemada YOKTU).
--   4) Anket.olusturma_tarihi: liste ekranının "Oluşturma Tarihi" kolonu (şemada YOKTU).
--   5) Soru.anket_id: ÖLÜ kolon olarak COMMENT ile işaretlenir (DÜŞÜRÜLMEZ).
--
-- NEDEN ARA TABLO (AnketSoru): Soru artık bir HAVUZ kaydıdır (migration 009 ile
-- bağımsız eklenir, anket_id NULL) ve BİRDEN ÇOK ankette kullanılabilmelidir.
-- Soru.anket_id tek FK'si bunu engellerdi: soru tek ankete hapsolur, üstelik
-- fk_soru_anket ON DELETE CASCADE olduğundan anket silinince HAVUZDAKİ SORU DA
-- SİLİNİRDİ. Ara tabloda ise anket silinince yalnızca BAĞ kopar; soru havuzda yaşar.
-- NEDEN iki FK de CASCADE: anket ya da soru silinince yalnızca ilgili bağ satırı
-- gider; yetim (kaynağı olmayan) bağ satırı kalmaz.
-- NEDEN PK(anket_id, soru_id): aynı soru bir ankete iki kez eklenemez — bu bir DB
-- garantisidir, yalnızca uygulama kontrolüne bırakılmaz.
--
-- NEDEN erisim_grup_id NULL: yalnızca erisim_seviyesi='grup' iken doludur.
-- NEDEN ON DELETE SET NULL: grup silinince ANKET KAYBOLMAMALI, yalnızca grup bağı
-- düşer. ON UPDATE CASCADE: şemadaki diğer FK'lerle tutarlı davranış.
-- NEDEN olusturan_kodu ON DELETE SET NULL: kullanıcı silinince anket silinmez;
-- yalnızca oluşturanı bilinmez olur (listede "-" gösterilir).
--
-- ERİŞİM SEVİYESİ KOD SAKLANIR (güvenlik/veri bütünlüğü): erisim_seviyesi
-- VARCHAR(50)'dir; arayüzün 60+ karakterlik açıklama cümleleri BU KOLONA SIĞMAZ
-- (sessiz kırpma / yazma hatası riski). Bu yüzden DB'de KOD saklanır:
--   'grup' | 'ben' | 'herkes'. Cümleler yalnızca UI etiketidir ve frontend'de kalır.
--
-- SİCİL BAĞIMLILIK NOTU: Anket.olusturan_kodu, Kullanici.kullanici_kodu'ya FK VERİR.
-- Ancak ON DELETE SET NULL + ON UPDATE CASCADE olduğundan sicil değişimini/silmeyi
-- KIRMAZ ve yetim kayıt bırakmaz; bu nedenle kullanici_bagimliligi_var_mi kontrolüne
-- (KULLANICI_BAGIMLILIK_SORGUSU) EXISTS satırı EKLENMEZ. Bu, Soru.hazirlayan_kodu
-- (migration 008) ile AYNI istisnadır. AnketSoru ise kullanici_kodu'ya FK VERMEZ,
-- dolayısıyla o kontrolle ilgisizdir.
--
-- GÜVENLİK: Anket'in serbest metin alanları (ad, on_yazi, son_yazi, aciklama)
-- kullanıcı girdisidir; yalnızca parametreli (prepared) sorgularla yazılır — SQL
-- metnine string birleştirilerek KONMAZ (Repository katmanı garantisi).
--
-- Bu dosya bir migration'dır: DDL yalnızca migration ile ve DDL yetkili migration
-- hesabıyla (savronik_migrate) uygulanır; canlı uygulama (runtime hesabı) çalıştırmaz.
-- 001/009/010'u düzenlemek yerine yeni migration kullanılmasının nedeni migration
-- immutability'sidir: geçmiş migration'lar değiştirilmez, yeni dosya eklenir.
-- Motor InnoDB (FK desteği).
--
-- DB İÇERİĞİ (anket/soru satırları) BURAYA KONMAZ: anket eklemek normal INSERT'tür
-- ve runtime hesabıyla yapılır (git'e DB içeriği girmez, yalnızca şema girer).

USE savronik_akademi;

-- (1) Anket <-> Soru N:M bağı. sira_no: sorunun O ANKETTEKİ görünme sırası
-- (aynı soru başka ankette farklı sırada olabildiği için Soru'da değil, burada).
-- NULL'a izin verilir: sıra belirtmeden bağ kurulabilir.
CREATE TABLE AnketSoru (
  anket_id INT NOT NULL,
  soru_id  INT NOT NULL,
  sira_no  INT NULL,   -- sorunun bu ankette görünme sırası
  PRIMARY KEY (anket_id, soru_id),
  CONSTRAINT fk_anketsoru_anket
    FOREIGN KEY (anket_id) REFERENCES Anket (anket_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_anketsoru_soru
    FOREIGN KEY (soru_id) REFERENCES Soru (soru_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- (2) Anketin açık olduğu kullanıcı grubu. Yalnızca erisim_seviyesi='grup' iken
-- doludur; diğer seviyelerde NULL kalır (bu kural Service katmanında zorlanır).
ALTER TABLE Anket
  ADD COLUMN erisim_grup_id INT NULL AFTER erisim_seviyesi,
  ADD CONSTRAINT fk_anket_erisim_grup
    FOREIGN KEY (erisim_grup_id) REFERENCES KullaniciGrubu (grup_id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- (3) Anketi oluşturan kullanıcının sicili. NULL: oluşturan silinmiş (SET NULL)
-- ya da bu migration'dan önce oluşmuş eski kayıt. Değer CLIENT'TAN ALINMAZ;
-- oturumdaki kullanıcıdan Service tarafından set edilir.
ALTER TABLE Anket
  ADD COLUMN olusturan_kodu VARCHAR(20) NULL AFTER soru_gosterim_tipi,
  ADD CONSTRAINT fk_anket_olusturan
    FOREIGN KEY (olusturan_kodu) REFERENCES Kullanici (kullanici_kodu)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- (4) Oluşturma zamanı. NOT NULL + DEFAULT CURRENT_TIMESTAMP: değer uygulamadan
-- gönderilmez, DB tarafından yazılır (tek doğru kaynak). Mevcut satırlar bu
-- migration'ın çalıştığı ana damgalanır (kabul edilir: eski anket sayısı yok/azdır).
ALTER TABLE Anket
  ADD COLUMN olusturma_tarihi DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    AFTER olusturan_kodu;

-- (5) Soru.anket_id ÖLÜ kolondur. NEDEN DÜŞÜRÜLMÜYOR: kapsam dışı + mevcut veriyi
-- kaybetme riski. COMMENT ile DB kataloğunda işaretlenir ki şemaya bakan bir sonraki
-- geliştirici bu kolonu canlı sanmasın. Kolon tipi/FK'si DEĞİŞTİRİLMEZ (009'daki
-- NULL yapılma kararı korunur; yalnızca COMMENT güncellenir).
ALTER TABLE Soru
  MODIFY anket_id INT NULL
  COMMENT 'KULLANILMIYOR (ölü kolon). Anket-soru bağı AnketSoru ara tablosundadır (migration 011). Bu kolon geriye dönük uyumluluk için durur; yeni kod OKUMAZ/YAZMAZ.';

"""Anket sorusu veri erişiminin SQL sorgu metinleri (tek yer).

Neden: soru_repository.py yalnızca bağlantı/transaction yönetimi, sonuç dönüşümü
ve hata sarmalama sorumluluğunu taşısın; ham SQL metinleri buraya ayrılır
(SRP + dosya boyutu). Tüm sorgular parametrelidir (%s); string birleştirme YASAK —
parametreler Repository'de cursor.execute'a ayrı geçilir.

Güvenlik: soru_metni ve secenek_metni biçimli HAM HTML taşır; sanitizasyon
Service'in işidir. Sorgular ekleme/listeleme/silme için gereken alanları kullanır.
"""

# Tüm anketlerin tüm sorularını düz liste olarak getirir. Hazırlayanın ad/soyad
# bilgisi için Kullanici öz-LEFT JOIN (hazirlayan_kodu NULL ya da kullanıcı
# silinmişse yonetici gibi None döner). Sıralama: en son eklenen üstte
# (soru_id DESC; soru_id auto-increment olduğundan en yeni kayıt en büyük id'dir).
SORULAR_LISTE_SORGUSU = """
    SELECT s.soru_id,
           s.anket_id,
           s.soru_metni,
           s.soru_tipi,
           s.konu,
           s.amac,
           s.sira_no,
           s.zorunlu_mu,
           s.hazirlayan_kodu,
           h.ad    AS hazirlayan_ad,
           h.soyad AS hazirlayan_soyad
    FROM Soru s
    LEFT JOIN Kullanici h ON h.kullanici_kodu = s.hazirlayan_kodu
    ORDER BY s.soru_id DESC
"""

# Tek soruyu soru_id ile getirir; SORULAR_LISTE_SORGUSU ile AYNI alan kümesi
# (hazırlayan öz-LEFT JOIN, konu/amac dahil) + WHERE s.soru_id = %s. DTO tutarlılığı
# için liste ile birebir aynı kolonlar döner. Kayıt yoksa boş sonuç (Repository None
# döner). Parametreli (%s); string birleştirme yok.
SORU_DETAY_SORGUSU = """
    SELECT s.soru_id,
           s.anket_id,
           s.soru_metni,
           s.soru_tipi,
           s.konu,
           s.amac,
           s.sira_no,
           s.zorunlu_mu,
           s.hazirlayan_kodu,
           h.ad    AS hazirlayan_ad,
           h.soyad AS hazirlayan_soyad
    FROM Soru s
    LEFT JOIN Kullanici h ON h.kullanici_kodu = s.hazirlayan_kodu
    WHERE s.soru_id = %s
"""

# Verilen tek soruya ait şıkları sıralı getirir (detay montajı için). Sıralama:
# sira_no, secenek_id (sira_no NULL olabildiğinden secenek_id ikincil deterministik
# anahtar). Parametreli (%s); string birleştirme yok.
SORU_DETAY_SECENEKLER_SORGUSU = """
    SELECT sc.soru_id,
           sc.secenek_metni,
           sc.sira_no
    FROM Secenek sc
    WHERE sc.soru_id = %s
    ORDER BY sc.sira_no, sc.secenek_id
"""

# Tek sorunun düzenlenebilir alanlarını (soru_metni, soru_tipi, konu, amac) günceller.
# anket_id/sira_no/zorunlu_mu/hazirlayan_kodu DÜZENLEMEDE TAŞINMAZ, bu yüzden SET'e
# GİRMEZ (değişmez). soru_metni HAM içerik taşır (sanitizasyon Service'in işi). Kayıt
# yoksa hiçbir satır etkilenmez; "bulunamadı" kararı Service'e aittir. Parametreli (%s).
SORU_GUNCELLE_SORGUSU = """
    UPDATE Soru
    SET soru_metni = %s,
        soru_tipi = %s,
        konu = %s,
        amac = %s
    WHERE soru_id = %s
"""

# Verilen soruya ait TÜM şıkları siler. Güncellemede şıklar "hepsini sil + yeniden
# yaz" ile değiştirilir (SECENEK_EKLE_SORGUSU yeniden kullanılır). Aynı transaction
# içinde çalıştırılır; kayıt yoksa idempotent. Parametreli (%s); string birleştirme yok.
SORU_SECENEKLERINI_SIL_SORGUSU = """
    DELETE FROM Secenek WHERE soru_id = %s
"""

# Tüm soruların tüm şıklarını tek sorguda getirir (N+1 önlemek için). Repository
# bu düz listeyi Python'da soru_id'ye göre gruplar. Sıralama: soru, şık sırası,
# secenek_id (sira_no NULL olabildiğinden secenek_id ikincil deterministik anahtar).
SECENEKLER_LISTE_SORGUSU = """
    SELECT sc.soru_id,
           sc.secenek_metni,
           sc.sira_no
    FROM Secenek sc
    ORDER BY sc.soru_id, sc.sira_no, sc.secenek_id
"""

# Bağımsız veya ankete bağlı tek soru ekler (kayıt). anket_id BAĞIMSIZ soruda
# NULL geçilir; NON-NULL ise fk_soru_anket geçerli anket_id zorlar (bkz. mig 009).
# konu/amac form kategorileridir; soru_metni HAM içerik taşır (sanitizasyon Service'in
# işi). Parametreli (%s); string birleştirme yok. Yeni soru_id cursor.lastrowid'den okunur.
SORU_EKLE_SORGUSU = """
    INSERT INTO Soru
        (anket_id, soru_metni, soru_tipi, konu, amac, sira_no, zorunlu_mu, hazirlayan_kodu)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
"""

# Bir soruya ait tek şıkkı ekler. secenek_metni BİÇİMLİ içerik tutabilir
# (sanitizasyon Service'in işi). Çoklu şık için Repository executemany ile bu tek
# şablonu parametre listesiyle çağırır; string birleştirme yok.
SECENEK_EKLE_SORGUSU = """
    INSERT INTO Secenek (soru_id, secenek_metni, sira_no)
    VALUES (%s, %s, %s)
"""

# Tek soruyu siler. Secenek (fk_secenek_soru) ve Cevap (fk_cevap_soru) FK'leri
# ON DELETE CASCADE olduğundan bu sorunun şıkları ve verilmiş cevapları DB
# tarafından aynı işlemde otomatik silinir. Kayıt yoksa hiçbir satır etkilenmez
# (idempotent). Parametreli; string birleştirme yok.
SORU_SIL_SORGUSU = """
    DELETE FROM Soru WHERE soru_id = %s
"""

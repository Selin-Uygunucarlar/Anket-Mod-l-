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
# silinmişse yonetici gibi None döner). Sıralama: anket, soru sırası, soru_id
# (sira_no NULL olabildiğinden soru_id ikincil deterministik anahtardır).
SORULAR_LISTE_SORGUSU = """
    SELECT s.soru_id,
           s.anket_id,
           s.soru_metni,
           s.soru_tipi,
           s.sira_no,
           s.zorunlu_mu,
           s.hazirlayan_kodu,
           h.ad    AS hazirlayan_ad,
           h.soyad AS hazirlayan_soyad
    FROM Soru s
    LEFT JOIN Kullanici h ON h.kullanici_kodu = s.hazirlayan_kodu
    ORDER BY s.anket_id, s.sira_no, s.soru_id
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

"""Kullanıcı grubu veri erişiminin SQL sorgu metinleri (tek yer).

Neden: grup_repository.py yalnızca bağlantı/transaction yönetimi, sonuç dönüşümü
ve hata sarmalama sorumluluğunu taşısın; ham SQL metinleri buraya ayrılır
(SRP + dosya boyutu). Tüm sorgular parametrelidir (%s); string birleştirme YASAK —
parametreler Repository'de cursor.execute'a ayrı geçilir.

Ayrım: Buradaki grup İLİŞKİSELDİR (KullaniciGrubu + Kullanici.grup_id); mevcut
serbest-metin Kullanici.grup kolonuna DOKUNULMAZ.
"""

# Tüm grupları üye sayısıyla listeler. KullaniciGrubu LEFT JOIN Kullanici
# (grup_id üzerinden; üyesi olmayan grup da listede kalır, uye_sayisi=0).
# Sıralama grup adına göre (tablo collation Türkçe: utf8mb4_turkish_ci).
GRUP_LISTE_SORGUSU = """
    SELECT g.grup_id,
           g.ad,
           COUNT(k.kullanici_kodu) AS uye_sayisi
    FROM KullaniciGrubu g
    LEFT JOIN Kullanici k ON k.grup_id = g.grup_id
    GROUP BY g.grup_id, g.ad
    ORDER BY g.ad
"""

# Yeni grup ekler. ad UNIQUE'tir (uq_grup_ad); aynı ad tekrarı DB'den IntegrityError
# olarak gelir (Repository DataAccessError'a sarar, Service anlamlı hataya çevirir).
# Yeni grup_id cursor.lastrowid'den okunur. Parametreli (%s); string birleştirme yok.
GRUP_EKLE_SORGUSU = """
    INSERT INTO KullaniciGrubu (ad) VALUES (%s)
"""

# Tek grubu siler. Kullanici.grup_id FK'si ON DELETE SET NULL olduğundan bu grubun
# üyeleri DB tarafından aynı işlemde otomatik grupsuz bırakılır (grup_id NULL;
# kişiler silinmez). Kayıt yoksa hiçbir satır etkilenmez (idempotent). Parametreli.
GRUP_SIL_SORGUSU = """
    DELETE FROM KullaniciGrubu WHERE grup_id = %s
"""

# Bir gruba bağlı üyeleri (hafif gösterim) sıralı getirir. Yalnızca gösterimi
# güvenli alanlar seçilir (sifre_hash vb. HİÇ seçilmez). Sıralama ad, soyad
# (tablo collation Türkçe). Parametreli (%s); string birleştirme yok.
GRUP_UYELERI_SORGUSU = """
    SELECT k.kullanici_kodu,
           k.ad,
           k.soyad,
           k.email
    FROM Kullanici k
    WHERE k.grup_id = %s
    ORDER BY k.ad, k.soyad
"""

# Bir kullanıcıyı bir gruba atar veya (grup_id NULL geçilirse) gruptan çıkarır.
# UPDATE Kullanici SET grup_id=%s WHERE kullanici_kodu=%s. Kayıt yoksa UPDATE
# etkisizdir (rowcount 0); "bulunamadı" kararı Service'e aittir. Parametreli.
GRUBA_ATA_SORGUSU = """
    UPDATE Kullanici SET grup_id = %s WHERE kullanici_kodu = %s
"""

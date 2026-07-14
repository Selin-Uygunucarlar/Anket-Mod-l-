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

# Tek bir kullanıcının ilişkisel grup kimliğini okur. kullanici_kodu PK olduğundan
# en fazla bir satır döner. Sonuç iki türlü "boş" olabilir: satır hiç yoktur
# (kullanıcı kaydı yok) ya da grup_id NULL'dur (kullanıcı grupsuz); ikisini de
# Repository None'a çevirir. Parametreli (%s); string birleştirme yok.
KULLANICI_GRUP_ID_SORGUSU = """
    SELECT grup_id FROM Kullanici WHERE kullanici_kodu = %s
"""

# Verilen grup_id'lerden DB'de GERÇEKTEN var olanları döner (client'tan gelen id'ye
# güvenilmez; eksikleri Service karşılaştırıp bulur). IN listesinin yer tutucuları
# Repository'de grup sayısı kadar üretilir; bu şablon tek bir %s taşır ve ", ".join
# ile çoğaltılır. DEĞERLER ASLA metne gömülmez -- yalnızca %s SAYISI dinamiktir;
# tüm id'ler execute'a parametre olarak geçer (SQL injection'a kapalı).
GRUP_IDLERI_VAR_MI_SORGUSU = """
    SELECT grup_id
    FROM KullaniciGrubu
    WHERE grup_id IN ({yer_tutucular})
"""

# Verilen grupların üyelerinin sicillerini (kullanici_kodu) DISTINCT döner. DISTINCT
# gerekmez gibi görünse de (bir kullanıcı en fazla bir gruba bağlıdır) sözleşmenin
# tekilliğini sorgu düzeyinde de garanti eder. Ankete atama KİŞİ bazlıdır: grup DB'ye
# yazılmaz, üyeleri çözülüp kişi olarak yazılır. Yer tutucular yukarıdaki kalıpla
# üretilir; DEĞERLER metne gömülmez.
GRUP_UYE_KODLARI_SORGUSU = """
    SELECT DISTINCT kullanici_kodu
    FROM Kullanici
    WHERE grup_id IN ({yer_tutucular})
"""

# Bir kullanıcıyı bir gruba atar veya (grup_id NULL geçilirse) gruptan çıkarır.
# UPDATE Kullanici SET grup_id=%s WHERE kullanici_kodu=%s. Kayıt yoksa UPDATE
# etkisizdir (rowcount 0); "bulunamadı" kararı Service'e aittir. Parametreli.
GRUBA_ATA_SORGUSU = """
    UPDATE Kullanici SET grup_id = %s WHERE kullanici_kodu = %s
"""

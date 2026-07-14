"""Anket veri erişiminin SQL sorgu metinleri (tek yer).

Neden: anket_repository.py yalnızca bağlantı/transaction yönetimi, sonuç dönüşümü
ve hata sarmalama sorumluluğunu taşısın; ham SQL metinleri buraya ayrılır
(SRP + dosya boyutu; soru_sorgulari.py ile aynı kalıp).

Güvenlik: Tüm sorgular parametrelidir (%s); string birleştirme YASAK — parametreler
Repository'de cursor.execute'a ayrı geçilir. Anket'in serbest metin alanları
(ad, on_yazi, son_yazi, aciklama) kullanıcı girdisidir ve yalnızca parametre
olarak taşınır. SORU_IDLERI_VAR_MI_SORGUSU tek istisna değildir: orada da yalnızca
%s yer tutucularının SAYISI dinamiktir, DEĞERLER asla SQL metnine gömülmez.
"""

# Anket listesi satırları. Oluşturanın ad/soyad'ı için Kullanici LEFT JOIN
# (olusturan_kodu NULL ya da kullanıcı silinmişse -- FK ON DELETE SET NULL -- None
# döner). atanan/yanitlayan sayıları AnketAtama üzerinden ilişkili alt sorgularla
# hesaplanır; kullanıcı ataması sonraki faz olduğu için bugün 0 dönerler (sorgu
# doğrudur, veri yoktur -- sahte sabit yazılmaz). yanitlayan: AnketAtama.durum
# 'tamamlandı' olanlar (bu Anket.durum DEĞİL, kişiye özel atama durumudur).
# Sıralama: en son eklenen üstte (anket_id DESC; auto-increment olduğundan en yeni
# kayıt en büyük id'dir -- soru_sorgulari ile aynı üslup).
ANKETLER_LISTE_SORGUSU = """
    SELECT a.anket_id,
           a.ad,
           a.durum,
           a.olusturma_tarihi,
           k.ad    AS olusturan_ad,
           k.soyad AS olusturan_soyad,
           (SELECT COUNT(*) FROM AnketAtama atama
             WHERE atama.anket_id = a.anket_id) AS atanan_sayisi,
           (SELECT COUNT(*) FROM AnketAtama atama
             WHERE atama.anket_id = a.anket_id
               AND atama.durum = 'tamamlandı') AS yanitlayan_sayisi
    FROM Anket a
    LEFT JOIN Kullanici k ON k.kullanici_kodu = a.olusturan_kodu
    ORDER BY a.anket_id DESC
"""

# Tek anket ekler (kayıt). olusturma_tarihi SET EDİLMEZ: DB DEFAULT CURRENT_TIMESTAMP
# ile yazar (tek doğru zaman kaynağı). almak_zorunda / ana_sayfada_goster /
# sira_no_goster / soru_gosterim_tipi de SET EDİLMEZ: bu faz onları taşımaz, DB
# varsayılanlarında kalır (bilinçli; unutulmuş değil). erisim_seviyesi KOD tutar
# ('grup' | 'ben' | 'herkes'); UI cümleleri VARCHAR(50)'ye sığmayacağından DB'ye
# gelmez. Parametreli (%s); yeni anket_id cursor.lastrowid'den okunur.
ANKET_EKLE_SORGUSU = """
    INSERT INTO Anket
        (ad, on_yazi, son_yazi, aciklama, durum, anket_tipi,
         erisim_seviyesi, erisim_grup_id, baslangic_tarihi, bitis_tarihi,
         olusturan_kodu)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

# Bir anket ile bir soru arasındaki bağı kurar (N:M ara tablosu, migration 011).
# Çoklu soru için Repository executemany ile bu tek şablonu parametre listesiyle
# çağırır; string birleştirme yok. PK(anket_id, soru_id) aynı sorunun ankete iki
# kez eklenmesini DB düzeyinde engeller.
ANKETSORU_EKLE_SORGUSU = """
    INSERT INTO AnketSoru (anket_id, soru_id, sira_no)
    VALUES (%s, %s, %s)
"""

# Verilen soru_id'lerden DB'de GERÇEKTEN var olanları döner (client'tan gelen id'ye
# güvenilmez; eksikleri Service karşılaştırıp bulur). IN listesinin yer tutucuları
# Repository'de soru sayısı kadar üretilir; bu şablon tek bir %s taşır ve
# ", ".join ile çoğaltılır. DEĞERLER ASLA metne gömülmez -- yalnızca %s SAYISI
# dinamiktir; tüm id'ler execute'a parametre olarak geçer (SQL injection'a kapalı).
SORU_IDLERI_VAR_MI_SORGUSU = """
    SELECT soru_id
    FROM Soru
    WHERE soru_id IN ({yer_tutucular})
"""

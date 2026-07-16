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
# hesaplanır (anket oluşturulurken yazılan atamalar buraya yansır; kimseye
# atanmamış anket 0 alır). yanitlayan: AnketAtama.durum
# 'tamamlandı' olanlar (bu Anket.durum DEĞİL, kişiye özel atama durumudur).
# Sıralama: en son eklenen üstte (anket_id DESC; auto-increment olduğundan en yeni
# kayıt en büyük id'dir -- soru_sorgulari ile aynı üslup).
#
# Görünürlük süzgeci (WHERE): anket, yalnızca aşağıdaki seviye kurallarından biri
# tutuyorsa satır olarak döner:
#   'herkes' -> herkese görünür (parametre gerekmez)
#   'grup'   -> erisim_grup_id, talep edenin grup_id'sine eşitse (1. %s)
#   'ben'    -> olusturan_kodu, talep edenin sicili ise (2. %s)
# erisim_seviyesi NULL (alan seçilmemiş ya da bu kolondan önceki eski kayıt)
# COALESCE ile 'ben' sayılır: seviyesi bilinmeyen anketin en dar kapsamda, yalnızca
# oluşturanına görünmesi güvenli varsayılandır.
# NOT: Grubu olmayan talep eden için 1. parametre None gelir; `erisim_grup_id = NULL`
# SQL'de hiçbir satırla eşleşmez ve bu DOĞRU davranıştır (grupsuz kullanıcı zaten
# 'grup' seviyeli anket oluşturamaz) -- bug değildir.
# Seviye KODLARI ('herkes'/'grup'/'ben') DB kolon değerleridir, kullanıcı girdisi
# değil; alt sorgudaki 'tamamlandı' gibi sorgu metninde durur. Kullanıcıdan gelen
# değerler (grup_id, sicil) yalnızca %s ile geçer.
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
    WHERE a.erisim_seviyesi = 'herkes'
       OR (a.erisim_seviyesi = 'grup' AND a.erisim_grup_id = %s)
       OR (COALESCE(a.erisim_seviyesi, 'ben') = 'ben' AND a.olusturan_kodu = %s)
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

# Yeni bir atamanın başlangıç durumu (AnketAtama.durum; şemadaki değerler:
# atandı / devam_ediyor / tamamlandı). Kişiye özel atama durumudur, Anket.durum
# DEĞİL. Sabit burada tanımlanır ki değer SQL metnine ya da Repository koduna
# sihirli dize (magic string) olarak gömülmesin; DB kolon değeri olduğundan yeri
# bu modüldür (katmanlar arası paylaşılan bir iş eşiği değildir -> constants.py'ye
# konmaz). Sorguya PARAMETRE olarak geçer.
ATAMA_BASLANGIC_DURUMU = "atandı"

# Anketin bir kullanıcıya atanmasını (AnketAtama satırı) ekler. Çoklu kişi için
# Repository executemany ile bu tek şablonu parametre listesiyle çağırır; string
# birleştirme yok. baslama_tarihi/tamamlanma_tarihi SET EDİLMEZ: atama anında kişi
# ankete başlamamıştır, DB'de NULL kalırlar (tamamlanma_tarihi <-> durum tutarlılığı
# korunur: durum 'atandı' iken tamamlanma_tarihi NULL'dur). atama_tarihi (yazma anı),
# son_tarih ve durum parametreyle (%s) geçer; sabit metin SQL'e gömülmez.
ANKETATAMA_EKLE_SORGUSU = """
    INSERT INTO AnketAtama (anket_id, kullanici_kodu, atama_tarihi, son_tarih, durum)
    VALUES (%s, %s, %s, %s, %s)
"""

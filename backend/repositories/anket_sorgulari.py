"""Anket veri erişiminin SQL sorgu metinleri (tek yer).

Neden: anket_repository.py yalnızca bağlantı/transaction yönetimi, sonuç dönüşümü
ve hata sarmalama sorumluluğunu taşısın; ham SQL metinleri buraya ayrılır
(SRP + dosya boyutu; soru_sorgulari.py ile aynı kalıp).

Güvenlik: Tüm sorgular parametrelidir (%s); string birleştirme YASAK — parametreler
Repository'de cursor.execute'a ayrı geçilir. Anket'in serbest metin alanları
(ad, on_yazi, son_yazi, aciklama) kullanıcı girdisidir ve yalnızca parametre
olarak taşınır. Sorgu metninde birleştirilen tek şey SABİT parçalardır: paylaşılan
GORUNURLUK_KOSULU (DRY; liste ve detay aynı kuralı kullanır) ile IN listelerindeki
%s yer tutucularının SAYISI (SORU_IDLERI_VAR_MI_SORGUSU, ANKETATAMA_SIL_SORGUSU).
KULLANICI DEĞERLERİ asla SQL metnine gömülmez; hepsi %s ile parametre geçer.
"""

# Anketin bir kullanıcıya görünüp görünmediğini belirleyen TEK koşul metni.
# Hem liste hem detay sorgusu bu tek kaynağı kullanır (DRY): kural iki yere
# kopyalanmaz -- "görebilen güncelleyebilir" olduğundan güncelleme için okunan
# detay, listelemeyle BİREBİR aynı süzgeçten geçer. Kural değişirse tek yer değişir.
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
# değil; bu yüzden sorgu metninde durur. Kullanıcıdan gelen değerler (grup_id,
# sicil) ASLA metne gömülmez; yalnızca %s ile parametre olarak geçer. Bu sabit
# kullanılırken parantez içine alınır (başka koşullarla AND'lenince OR zinciri
# yanlış bağlanmasın).
GORUNURLUK_KOSULU = """
       a.erisim_seviyesi = 'herkes'
    OR (a.erisim_seviyesi = 'grup' AND a.erisim_grup_id = %s)
    OR (COALESCE(a.erisim_seviyesi, 'ben') = 'ben' AND a.olusturan_kodu = %s)
"""

# Anket listesi satırları. Oluşturanın ad/soyad'ı için Kullanici LEFT JOIN
# (olusturan_kodu NULL ya da kullanıcı silinmişse -- FK ON DELETE SET NULL -- None
# döner). atanan/yanitlayan sayıları AnketAtama üzerinden ilişkili alt sorgularla
# hesaplanır (anket oluşturulurken yazılan atamalar buraya yansır; kimseye
# atanmamış anket 0 alır). yanitlayan: AnketAtama.durum
# 'tamamlandı' olanlar (bu Anket.durum DEĞİL, kişiye özel atama durumudur).
# Sıralama: en son eklenen üstte (anket_id DESC; auto-increment olduğundan en yeni
# kayıt en büyük id'dir -- soru_sorgulari ile aynı üslup).
# WHERE = GORUNURLUK_KOSULU (yukarıda); parametre sırası değişmez: grup_id, sicil.
ANKETLER_LISTE_SORGUSU = f"""
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
    WHERE ({GORUNURLUK_KOSULU})
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

# Bir atamanın TAMAMLANDI durumu (AnketAtama.durum; şemadaki değerler:
# atandı / devam_ediyor / tamamlandı). Ana ekran paneli "henüz çözülmemiş"
# anketleri süzerken bu değeri DIŞLAR. Sabit burada tanımlanır ki değer SQL
# metnine sihirli dize (magic string) olarak gömülmesin; DB kolon değeri
# olduğundan yeri bu modüldür (katmanlar arası bir iş eşiği değildir ->
# constants.py'ye konmaz). Sorguya PARAMETRE olarak (%s) geçer.
ATAMA_TAMAMLANDI_DURUMU = "tamamlandı"

# Ana ekran paneli: bir kullanıcıya ATANMIŞ, ANKETİ AKTİF ve HENÜZ ÇÖZÜLMEMİŞ
# anketler. AnketAtama JOIN Anket (INNER): atama.kullanici_kodu FK'dir, anket hep
# vardır. Süzgeçler:
#   - atama.kullanici_kodu = %s : kişiye özel (sicil OTURUMDAN gelir, client'tan
#     DEĞİL; bunu garanti etmek Service'in işi -- Repository yalnızca süzer).
#   - atama.durum <> %s (ATAMA_TAMAMLANDI_DURUMU): tamamlanan atama panelde çıkmaz
#     ('atandı'/'devam_ediyor' kalır). Kişiye özel atama durumudur, Anket.durum DEĞİL.
#   - a.durum = 'Aktif' : anketin yaşam döngüsü kodu (DB kolon değeri, kullanıcı
#     girdisi değil; 'Pasif' anket panelde görünmez).
#   - NOW() BETWEEN a.baslangic_tarihi AND a.bitis_tarihi : bugün tarih aralığında.
#     baslangic/bitis NULL olabilir; NULL uçlu anket BETWEEN'de hiçbir zaman
#     eşleşmez -> tarih penceresi tanımsız anket panelde GÖRÜNMEZ. Bu DOĞRU
#     davranıştır (yayına hazır olmayan/süresiz anket "çözülmeyi bekleyen" sayılmaz).
# Yalnızca a.anket_id, a.ad seçilir (panel yalnızca bunları gösterir). Sıra: yakın
# biten üstte (a.bitis_tarihi), eşitlikte a.anket_id ikincil deterministik anahtar.
# Tüm değerler parametreli (%s); string birleştirme yok. Parametre sırası:
# kullanici_kodu, sonra ATAMA_TAMAMLANDI_DURUMU.
ATANAN_BEKLEYEN_ANKETLER_SORGUSU = """
    SELECT a.anket_id,
           a.ad
    FROM AnketAtama atama
    JOIN Anket a ON a.anket_id = atama.anket_id
    WHERE atama.kullanici_kodu = %s
      AND atama.durum <> %s
      AND a.durum = 'Aktif'
      AND NOW() BETWEEN a.baslangic_tarihi AND a.bitis_tarihi
    ORDER BY a.bitis_tarihi, a.anket_id
"""

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

# Tek anketin düzenleme formunu doldurmaya yeten alanları. Görünürlük süzgeci
# (GORUNURLUK_KOSULU) BURADA DA uygulanır: erişimi olmayan için satır dönmez, yani
# anket "yok" gibi davranır -- ne varlığı ne içeriği sızar (IDOR'a kapalı) ve
# "görebilen güncelleyebilir" kuralı listeyle birebir aynı kaynaktan gelir.
# olusturma_tarihi SELECT EDİLMEZ (form onu taşımaz/değiştirmez); olusturan_kodu
# yalnızca bilgi olarak taşınır. Parametre sırası: anket_id, grup_id, sicil.
ANKET_DETAY_SORGUSU = f"""
    SELECT a.anket_id,
           a.ad,
           a.on_yazi,
           a.son_yazi,
           a.aciklama,
           a.durum,
           a.anket_tipi,
           a.erisim_seviyesi,
           a.erisim_grup_id,
           a.baslangic_tarihi,
           a.bitis_tarihi,
           a.olusturan_kodu
    FROM Anket a
    WHERE a.anket_id = %s
      AND ({GORUNURLUK_KOSULU})
    LIMIT 1
"""

# Anketin bağlı soruları (AnketSoru ara tablosu üzerinden), formun Sorular kartının
# ihtiyacı olan alanlarla. INNER JOIN: bağı olmayan soru zaten bu ankete ait değildir.
# soru_metni HAM HTML döner (sanitizasyon Service'in işi). Sıra: bağın sira_no'su,
# eşitlikte/NULL'da soru_id ikincil deterministik anahtar (soru_sorgulari ile aynı üslup).
ANKET_SORULARI_SORGUSU = """
    SELECT s.soru_id,
           s.soru_metni,
           s.soru_tipi
    FROM AnketSoru bag
    JOIN Soru s ON s.soru_id = bag.soru_id
    WHERE bag.anket_id = %s
    ORDER BY bag.sira_no, s.soru_id
"""

# Ankete atanmış kullanıcılar, formun Kullanıcılar kartında gösterilecek kimlik
# alanlarıyla. INNER JOIN: AnketAtama.kullanici_kodu FK'dir, kullanıcı hep vardır.
# DISTINCT: DB'de (anket_id, kullanici_kodu) tekilliği bir kısıtla zorlanmadığından
# aynı kişi kuramsal olarak iki satır taşıyabilir; liste kişiyi tek kez göstermelidir.
# Hassas alan (sifre_hash vb.) SELECT EDİLMEZ. Sıra: ad, soyad (utf8mb4_turkish_ci).
ANKET_ATANAN_KULLANICILAR_SORGUSU = """
    SELECT DISTINCT k.kullanici_kodu,
                    k.ad,
                    k.soyad,
                    k.email
    FROM AnketAtama atama
    JOIN Kullanici k ON k.kullanici_kodu = atama.kullanici_kodu
    WHERE atama.anket_id = %s
    ORDER BY k.ad, k.soyad
"""

# Ankete atanmış kişilerin YALNIZCA sicilleri. Neden ayrı sorgu: Service, "kim
# eklenecek / kim çıkarılacak" farkını mevcut atamalarla karşılaştırarak hesaplar;
# bu bir iş kararıdır ve Repository fark hesaplamaz. DISTINCT gerekçesi yukarıdakiyle
# aynı (olası yinelenen atama satırı tek kod olarak döner).
ANKET_ATANAN_KODLARI_SORGUSU = """
    SELECT DISTINCT kullanici_kodu
    FROM AnketAtama
    WHERE anket_id = %s
"""

# Anketin düzenlenebilir alanlarını günceller. olusturan_kodu ve olusturma_tarihi
# BİLEREK SET EDİLMEZ: anketin kim tarafından ne zaman oluşturulduğu değişmez bir
# geçmiş bilgisidir (düzenleyen onu devralamaz). ANKET_EKLE_SORGUSU'nda olduğu gibi
# almak_zorunda / ana_sayfada_goster / sira_no_goster / soru_gosterim_tipi de bu faz
# tarafından taşınmadığından DB'deki değerlerinde bırakılır. Serbest metin alanları
# (ad, on_yazi, son_yazi, aciklama) yalnızca %s ile geçer; string birleştirme yok.
ANKET_GUNCELLE_SORGUSU = """
    UPDATE Anket
    SET ad = %s,
        on_yazi = %s,
        son_yazi = %s,
        aciklama = %s,
        durum = %s,
        anket_tipi = %s,
        erisim_seviyesi = %s,
        erisim_grup_id = %s,
        baslangic_tarihi = %s,
        bitis_tarihi = %s
    WHERE anket_id = %s
"""

# Anketin TÜM soru bağlarını siler. Güncellemede bağlar "hepsini sil + yeniden yaz"
# ile tazelenir: bağ satırında korunacak bir durum bilgisi YOKTUR (yalnızca sira_no
# vardır, o da gelen sıraya göre yeniden hesaplanır). Sorular havuzda YAŞAR --
# silinen yalnızca bağdır (soru_guncelle'deki şık tazelemesiyle aynı kalıp).
ANKETSORU_BAGLARINI_SIL_SORGUSU = """
    DELETE FROM AnketSoru
    WHERE anket_id = %s
"""

# Anketten ÇIKARILAN kişilerin atama satırlarını siler. Yalnızca listeden çıkarılanlar
# verilir: listede KALANLARIN satırına dokunulmaz, böylece durum/baslama_tarihi/
# tamamlanma_tarihi gibi ilerleme bilgisi korunur ("hepsini sil + yeniden yaz" burada
# veri kaybı olurdu). Cevap FK'si ON DELETE CASCADE olduğundan çıkarılan kişinin
# cevapları da atamayla birlikte gider (yetim cevap kalmaz) -- kişiyi çıkarma kararı
# Service'indir. IN listesinin yer tutucuları eleman SAYISI kadar üretilir; siciller
# ASLA metne gömülmez, hepsi parametre olarak geçer (SORU_IDLERI_VAR_MI_SORGUSU kalıbı).
ANKETATAMA_SIL_SORGUSU = """
    DELETE FROM AnketAtama
    WHERE anket_id = %s
      AND kullanici_kodu IN ({yer_tutucular})
"""

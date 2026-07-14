"""Kullanıcı yönetimi veri erişiminin SQL sorgu metinleri (tek yer).

Neden: kullanici_repository.py yalnızca bağlantı/transaction yönetimi, sonuç
dönüşümü ve hata sarmalama sorumluluğunu taşısın; ham SQL metinleri buraya
ayrılır (SRP + 400 satır sınırı). Tüm sorgular parametrelidir (%s); değer
birleştirme YASAK — string birleştirme burada da yapılmaz, parametreler
Repository'de cursor.execute'a ayrı geçilir.

Güvenlik: Yalnızca güvenli alanlar seçilir; sifre_hash / hatali_giris_sayisi
hiçbir SELECT'e girmez.
"""

# Tüm kullanıcıları listeler. ilgili_yonetici_kodu için Kullanici öz-LEFT JOIN
# (yönetici olmayabilir), son_giris_tarihi için KullaniciKimlik LEFT JOIN (kimlik
# satırı olmayabilir). Sıralama ad, soyad üzerinden (tablo collation Türkçe).
KULLANICI_LISTE_SORGUSU = """
    SELECT k.kullanici_kodu,
           k.ad,
           k.soyad,
           k.aktif,
           k.email,
           k.ilgili_yonetici_kodu,
           y.ad     AS yonetici_ad,
           y.soyad  AS yonetici_soyad,
           k.olusturma_tarihi,
           kk.son_giris_tarihi
    FROM Kullanici k
    LEFT JOIN Kullanici y ON y.kullanici_kodu = k.ilgili_yonetici_kodu
    LEFT JOIN KullaniciKimlik kk ON kk.kullanici_kodu = k.kullanici_kodu
    ORDER BY k.ad, k.soyad
"""

# Tek kullanıcının tam (güvenli) detayı — kişi detay paneli için. Yönetici adı için
# Kullanici öz-LEFT JOIN (yönetici olmayabilir), son_giris_tarihi için KullaniciKimlik
# LEFT JOIN (kimlik satırı olmayabilir). sifre_hash/hatali_giris_sayisi HİÇ seçilmez.
KULLANICI_DETAY_SORGUSU = """
    SELECT k.kullanici_kodu,
           k.ad,
           k.soyad,
           k.email,
           k.kullanici_turu,
           k.aktif,
           k.ise_giris_tarihi,
           k.ilgili_yonetici_kodu,
           y.ad     AS yonetici_ad,
           y.soyad  AS yonetici_soyad,
           k.sirket,
           k.grup,
           k.bolum,
           k.birim,
           k.kadro_grubu,
           k.kadro_unvani,
           k.gorev_unvani,
           k.arge_personeli,
           k.personel_sigorta_is_yeri,
           k.gorev_yeri,
           k.olusturma_tarihi,
           kk.son_giris_tarihi
    FROM Kullanici k
    LEFT JOIN Kullanici y ON y.kullanici_kodu = k.ilgili_yonetici_kodu
    LEFT JOIN KullaniciKimlik kk ON kk.kullanici_kodu = k.kullanici_kodu
    WHERE k.kullanici_kodu = %s
    LIMIT 1
"""

# Verilen kullanici_kodu (SAP no) kayıtlı mı — benzersizlik ön kontrolü için.
KULLANICI_KODU_VAR_SORGUSU = """
    SELECT 1 FROM Kullanici WHERE kullanici_kodu = %s LIMIT 1
"""

# Verilen email kayıtlı mı — benzersizlik ön kontrolü için.
EMAIL_VAR_SORGUSU = """
    SELECT 1 FROM Kullanici WHERE email = %s LIMIT 1
"""

# Verilen email, verilen kod DIŞINDA bir kullanıcıya ait mi — güncelleme
# senaryosunda çakışma kontrolü (kişinin kendi e-postası çakışma sayılmaz).
EMAIL_BASKASINDA_VAR_SORGUSU = """
    SELECT 1 FROM Kullanici
    WHERE email = %s AND kullanici_kodu <> %s
    LIMIT 1
"""

# Verilen kod bir Kullanici'ye ait mi — yönetici ilişkisinin geçerliliği için.
YONETICI_VAR_SORGUSU = """
    SELECT 1 FROM Kullanici WHERE kullanici_kodu = %s LIMIT 1
"""

# Yeni kullanıcının ana (Kullanici) satırı. aktif=TRUE; olusturma_tarihi Service'ten.
KULLANICI_EKLE_SORGUSU = """
    INSERT INTO Kullanici (
        kullanici_kodu, ad, soyad, email, kullanici_turu, aktif,
        ise_giris_tarihi, olusturma_tarihi, ilgili_yonetici_kodu,
        sirket, grup, bolum, birim, kadro_grubu, kadro_unvani,
        gorev_unvani, arge_personeli, personel_sigorta_is_yeri, gorev_yeri
    ) VALUES (
        %s, %s, %s, %s, %s, TRUE,
        %s, %s, %s,
        %s, %s, %s, %s, %s, %s,
        %s, %s, %s, %s
    )
"""

# Yeni kullanıcının kimlik (KullaniciKimlik) satırı. Geçici şifre bayrağı TRUE,
# hatali_giris_sayisi 0; sifre_guncelleme_tarihi = oluşturma anı.
KIMLIK_EKLE_SORGUSU = """
    INSERT INTO KullaniciKimlik (
        kullanici_kodu, sifre_hash, sifre_degistirilmeli,
        sifre_guncelleme_tarihi, hatali_giris_sayisi
    ) VALUES (%s, %s, %s, %s, 0)
"""

# Tek kullanıcının güncel aktiflik durumu — Service'in toggle (aktif <-> pasif)
# kararını verebilmesi için. Kayıt yoksa satır dönmez.
KULLANICI_AKTIF_OKU_SORGUSU = """
    SELECT aktif FROM Kullanici WHERE kullanici_kodu = %s LIMIT 1
"""

# Kullanıcının aktiflik durumunu ayarlar (aktif kolonu). Parametreli; yeni değer
# Service tarafından (mevcut durumun tersi) belirlenir.
KULLANICI_AKTIF_YAZ_SORGUSU = """
    UPDATE Kullanici SET aktif = %s WHERE kullanici_kodu = %s
"""

# Sicil (PK) DIŞINDAKİ düzenlenebilir alanların tümünü tek UPDATE ile yazar.
# sifre_guncelleme_tarihi, hatali_giris_sayisi, aktif, olusturma_tarihi ve PK'ye
# BİLEREK DOKUNULMAZ. Kolon listesi sabittir (dinamik SQL yok); değerler
# parametreyle (%s) geçer. Parametre sırası KULLANICI_GUNCELLE_ALANLARI ile birebir,
# en sonda WHERE için kullanici_kodu gelir.
KULLANICI_GUNCELLE_SORGUSU = """
    UPDATE Kullanici SET
        ad = %s,
        soyad = %s,
        email = %s,
        kullanici_turu = %s,
        ise_giris_tarihi = %s,
        ilgili_yonetici_kodu = %s,
        sirket = %s,
        grup = %s,
        bolum = %s,
        birim = %s,
        kadro_grubu = %s,
        kadro_unvani = %s,
        gorev_unvani = %s,
        arge_personeli = %s,
        personel_sigorta_is_yeri = %s,
        gorev_yeri = %s
    WHERE kullanici_kodu = %s
"""

# guncelle_kullanici'nin `veri` sözlüğünden okuyacağı alan anahtarları; UPDATE
# sorgusundaki SET sırasıyla BİREBİR aynıdır (sicil hariç). Sıra değişirse ikisi
# birlikte güncellenmelidir.
KULLANICI_GUNCELLE_ALANLARI = (
    "ad",
    "soyad",
    "email",
    "kullanici_turu",
    "ise_giris_tarihi",
    "ilgili_yonetici_kodu",
    "sirket",
    "grup",
    "bolum",
    "birim",
    "kadro_grubu",
    "kadro_unvani",
    "gorev_unvani",
    "arge_personeli",
    "personel_sigorta_is_yeri",
    "gorev_yeri",
)

# Bu sicile bağlı BAŞKA kayıt var mı — tek sorguda OR'lu EXISTS ile (ilk eşleşmede
# durur). KullaniciKimlik BİLEREK dahil değil (aynı kişinin 1:1 kimlik satırı;
# bağımlılık sayılmaz, PK değişince ON UPDATE CASCADE ile birlikte taşınır).
# ÖNEMLİ: Şemaya kullanici_kodu'ya FK veren HER YENİ TABLO eklendiğinde buraya o
# tablo için bir EXISTS satırı EKLENMELİDİR; aksi halde sicil değişimi/silme
# kontrolü o tablodaki kayıtları GÖRMEDEN geçer.
# İSTİSNA: Soru.hazirlayan_kodu FK'si (migration 008) ON DELETE SET NULL + ON UPDATE
# CASCADE olduğundan sicil değişimini kırmaz/yetim bırakmaz; bu sorguya BİLİNÇLİ
# olarak EXISTS satırı EKLENMEZ (unutulmadı, gerekmediği için hariç tutuldu).
# İSTİSNA: KullaniciGrubu (migration 010) kullanici_kodu'ya FK VERMEZ; ilişki TERS
# yöndedir (Kullanici.grup_id -> KullaniciGrubu.grup_id). Yani bu tablo sicil
# değişimini/silmeyi hiç görmez ve bu sorguya EKLENMESİ GEREKMEZ (bağımlılık ters
# yönde olduğundan; bilinçli olarak dahil edilmedi).
# İSTİSNA: Anket.olusturan_kodu FK'si (migration 011) ON DELETE SET NULL + ON UPDATE
# CASCADE olduğundan sicil değişimini kırmaz/yetim bırakmaz (kullanıcı silinince anket
# kalır, yalnızca oluşturanı bilinmez olur); bu sorguya BİLİNÇLİ olarak EXISTS satırı
# EKLENMEZ (unutulmadı, gerekmediği için hariç tutuldu) -- Soru.hazirlayan_kodu ile aynı
# istisna. Aynı migration'daki AnketSoru ise kullanici_kodu'ya FK VERMEZ; ilgisizdir.
KULLANICI_BAGIMLILIK_SORGUSU = """
    SELECT 1
    WHERE EXISTS (SELECT 1 FROM Kullanici WHERE ilgili_yonetici_kodu = %s)
       OR EXISTS (SELECT 1 FROM AnketAtama WHERE kullanici_kodu = %s)
       OR EXISTS (SELECT 1 FROM EgitimAtama WHERE kullanici_kodu = %s)
       OR EXISTS (SELECT 1 FROM YetkinlikAtama WHERE kullanici_kodu = %s)
       OR EXISTS (SELECT 1 FROM YetkinlikDegerlendirme WHERE kullanici_kodu = %s)
       OR EXISTS (SELECT 1 FROM YetkinlikDegerlendirme
                  WHERE degerlendiren_yonetici_kodu = %s)
    LIMIT 1
"""

# Sicili (PK) değiştirir. Şemada Kullanici.kullanici_kodu'ya FK veren TÜM tablolar
# ON UPDATE CASCADE ile tanımlı olduğundan (KullaniciKimlik, AnketAtama, EgitimAtama,
# YetkinlikAtama, YetkinlikDegerlendirme.kullanici_kodu ve degerlendiren_yonetici_kodu,
# Kullanici.ilgili_yonetici_kodu öz-ilişkisi dahil), tek UPDATE yeterlidir; DB tüm
# çocuk satırları aynı işlem içinde otomatik günceller. Benzersizlik/varlık kontrolü
# Service'te; yeni_kod zaten kayıtlıysa PK ihlali DataAccessError olarak yukarı çıkar.
KULLANICI_KODU_GUNCELLE_SORGUSU = """
    UPDATE Kullanici SET kullanici_kodu = %s WHERE kullanici_kodu = %s
"""

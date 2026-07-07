"""Kullanıcı yönetimi (admin kullanıcı listesi) akışının veri erişim katmanı.

Neden: DB ile konuşan tek yer burasıdır; SQL yalnızca bu katmanda yazılır.
Service/Controller tablo/şema/SQL görmez. Tüm sorgular parametreli (prepared)
yazılır; string birleştirme YASAK (SQL injection'a kapalı). Bu dosya, login
sorumluluğundan (kullanici_kimlik_repository) ayrıdır: burada yalnızca kullanıcı
yönetimi okumaları yapılır.

Güvenlik: Yalnızca listede gösterilmesi güvenli alanlar seçilir; sifre_hash ve
diğer hassas kimlik alanları sorguya HİÇ girmez.

Hata yönetimi: Teknik DB istisnaları DataAccessError'a sarmalanıp YUKARI
FIRLATILIR; burada loglanmaz/yutulmaz. Ham DB mesajı, tablo adı veya stack
trace üst katmana giden mesaja konmaz (orijinali `from` ile zincirlenir).
"""

from datetime import date, datetime

import pymysql

from common.db import veritabani_baglantisi
from common.errors import DataAccessError
from models.kullanici_detay import KullaniciDetay
from models.kullanici_ozet import KullaniciOzet

# Tüm kullanıcıları listeler. ilgili_yonetici_kodu için Kullanici öz-LEFT JOIN
# (yönetici olmayabilir), son_giris_tarihi için KullaniciKimlik LEFT JOIN (kimlik
# satırı olmayabilir). Sıralama ad, soyad üzerinden (tablo collation Türkçe).
_KULLANICI_LISTE_SORGUSU = """
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
_KULLANICI_DETAY_SORGUSU = """
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
_KULLANICI_KODU_VAR_SORGUSU = """
    SELECT 1 FROM Kullanici WHERE kullanici_kodu = %s LIMIT 1
"""

# Verilen email kayıtlı mı — benzersizlik ön kontrolü için.
_EMAIL_VAR_SORGUSU = """
    SELECT 1 FROM Kullanici WHERE email = %s LIMIT 1
"""

# Verilen kod bir Kullanici'ye ait mi — yönetici ilişkisinin geçerliliği için.
_YONETICI_VAR_SORGUSU = """
    SELECT 1 FROM Kullanici WHERE kullanici_kodu = %s LIMIT 1
"""

# Yeni kullanıcının ana (Kullanici) satırı. aktif=TRUE; olusturma_tarihi Service'ten.
_KULLANICI_EKLE_SORGUSU = """
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
_KIMLIK_EKLE_SORGUSU = """
    INSERT INTO KullaniciKimlik (
        kullanici_kodu, sifre_hash, sifre_degistirilmeli,
        sifre_guncelleme_tarihi, hatali_giris_sayisi
    ) VALUES (%s, %s, %s, %s, 0)
"""


def list_kullanicilar() -> list[KullaniciOzet]:
    """Tüm kullanıcıları güvenli özet alanlarıyla, ad/soyad sırasına göre döner.

    Yönetici ilişkisi öz-LEFT JOIN ile çözülür (yönetici yoksa None), son giriş
    KullaniciKimlik LEFT JOIN ile alınır (kimlik satırı yoksa None). Yetki/rol
    kontrolü (yalnızca admin) burada DEĞİL, Service/Controller katmanındadır.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_KULLANICI_LISTE_SORGUSU)
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Kullanıcı listesi okunamadı.") from hata

    return [
        KullaniciOzet(
            kullanici_kodu=satir["kullanici_kodu"],
            ad=satir["ad"],
            soyad=satir["soyad"],
            # TINYINT gelebileceğinden Python bool'a çevrilir.
            aktif=bool(satir["aktif"]),
            email=satir["email"],
            ilgili_yonetici_kodu=satir["ilgili_yonetici_kodu"],
            yonetici_ad=satir["yonetici_ad"],
            yonetici_soyad=satir["yonetici_soyad"],
            olusturma_tarihi=satir["olusturma_tarihi"],
            son_giris_tarihi=satir["son_giris_tarihi"],
        )
        for satir in satirlar
    ]


def get_kullanici_detay(kullanici_kodu: str) -> KullaniciDetay | None:
    """Verilen kullanici_kodu'nun tam güvenli detayını döner; kayıt yoksa None.

    Kişi detay paneli için tek kullanıcıyı okur. Yönetici adı öz-LEFT JOIN ile
    (yönetici yoksa None), son giriş KullaniciKimlik LEFT JOIN ile (kimlik satırı
    yoksa None) çözülür. sifre_hash/hatali_giris_sayisi sorguya girmez. Yetki/rol
    ve sahiplik kontrolü burada DEĞİL, Service/Controller katmanındadır.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_KULLANICI_DETAY_SORGUSU, (kullanici_kodu,))
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Kullanıcı detayı okunamadı.") from hata

    if satir is None:
        return None

    return KullaniciDetay(
        kullanici_kodu=satir["kullanici_kodu"],
        ad=satir["ad"],
        soyad=satir["soyad"],
        email=satir["email"],
        kullanici_turu=satir["kullanici_turu"],
        # TINYINT gelebileceğinden Python bool'a çevrilir.
        aktif=bool(satir["aktif"]),
        ise_giris_tarihi=satir["ise_giris_tarihi"],
        ilgili_yonetici_kodu=satir["ilgili_yonetici_kodu"],
        yonetici_ad=satir["yonetici_ad"],
        yonetici_soyad=satir["yonetici_soyad"],
        sirket=satir["sirket"],
        grup=satir["grup"],
        bolum=satir["bolum"],
        birim=satir["birim"],
        kadro_grubu=satir["kadro_grubu"],
        kadro_unvani=satir["kadro_unvani"],
        gorev_unvani=satir["gorev_unvani"],
        arge_personeli=satir["arge_personeli"],
        personel_sigorta_is_yeri=satir["personel_sigorta_is_yeri"],
        gorev_yeri=satir["gorev_yeri"],
        olusturma_tarihi=satir["olusturma_tarihi"],
        son_giris_tarihi=satir["son_giris_tarihi"],
    )


def kullanici_kodu_var_mi(kullanici_kodu: str) -> bool:
    """Verilen kullanici_kodu (SAP no) sistemde kayıtlı mı döndürür.

    Yeni kullanıcı eklemeden önce benzersizlik ön kontrolü içindir; nihai
    garanti PK'dir. Yetki/rol kontrolü burada değil, Service katmanındadır.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_KULLANICI_KODU_VAR_SORGUSU, (kullanici_kodu,))
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Kullanıcı kodu kontrolü yapılamadı.") from hata

    return satir is not None


def email_var_mi(email: str) -> bool:
    """Verilen email sistemde kayıtlı mı döndürür (benzersizlik ön kontrolü).

    Nihai garanti UNIQUE kısıttır; bu yalnızca kullanıcıya erken/anlamlı geri
    bildirim için ön kontroldür.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_EMAIL_VAR_SORGUSU, (email,))
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        raise DataAccessError("E-posta kontrolü yapılamadı.") from hata

    return satir is not None


def yonetici_var_mi(yonetici_kodu: str) -> bool:
    """Verilen kodun bir Kullanici'ye ait olup olmadığını döndürür.

    Yeni kullanıcının ilgili_yonetici_kodu'nun gerçek bir kullanıcıya işaret
    ettiğini doğrulamak içindir (yetim FK oluşmasın). İlişki kuralı (kimin
    kimin yöneticisi olabileceği) Service'in işidir.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_YONETICI_VAR_SORGUSU, (yonetici_kodu,))
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Yönetici kontrolü yapılamadı.") from hata

    return satir is not None


def create_kullanici(
    kullanici_kodu: str,
    ad: str,
    soyad: str,
    email: str,
    kullanici_turu: str,
    ise_giris_tarihi: date | None,
    ilgili_yonetici_kodu: str | None,
    sirket: str | None,
    grup: str | None,
    bolum: str | None,
    birim: str | None,
    kadro_grubu: str | None,
    kadro_unvani: str | None,
    gorev_unvani: str | None,
    arge_personeli: str | None,
    personel_sigorta_is_yeri: str | None,
    gorev_yeri: str | None,
    sifre_hash: str,
    sifre_degistirilmeli: bool,
    olusturma_tarihi: datetime,
) -> None:
    """Yeni kullanıcıyı tek transaction içinde Kullanici + KullaniciKimlik olarak ekler.

    İki INSERT aynı bağlantı/with bloğunda çalışır; herhangi biri patlarsa
    context manager rollback yapar (yarım kayıt kalmaz). Kullanici satırında
    aktif=TRUE; kimlik satırında sifre_degistirilmeli (geçici şifre bayrağı) ve
    hatali_giris_sayisi=0, sifre_guncelleme_tarihi = olusturma_tarihi. Benzersizlik
    (PK/UNIQUE) ve FK bütünlüğü nihai olarak DB'de zorlanır. sifre_hash asla
    loglanmaz. Yetki/rol/şifre üretimi Service katmanının işidir.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    _KULLANICI_EKLE_SORGUSU,
                    (
                        kullanici_kodu,
                        ad,
                        soyad,
                        email,
                        kullanici_turu,
                        ise_giris_tarihi,
                        olusturma_tarihi,
                        ilgili_yonetici_kodu,
                        sirket,
                        grup,
                        bolum,
                        birim,
                        kadro_grubu,
                        kadro_unvani,
                        gorev_unvani,
                        arge_personeli,
                        personel_sigorta_is_yeri,
                        gorev_yeri,
                    ),
                )
                imlec.execute(
                    _KIMLIK_EKLE_SORGUSU,
                    (
                        kullanici_kodu,
                        sifre_hash,
                        sifre_degistirilmeli,
                        olusturma_tarihi,
                    ),
                )
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Kullanıcı oluşturulamadı.") from hata

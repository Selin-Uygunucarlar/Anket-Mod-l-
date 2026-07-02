"""Login (giriş) akışının veri erişim katmanı.

Neden: DB ile konuşan tek yer burasıdır; SQL yalnızca bu katmanda yazılır.
Service/Controller tablo/şema/SQL görmez. Tüm sorgular parametreli (prepared)
yazılır; string birleştirme YASAK (SQL injection'a kapalı).

Hata yönetimi: Teknik DB istisnaları DataAccessError'a sarmalanıp YUKARI
FIRLATILIR; burada loglanmaz/yutulmaz. Ham DB mesajı, tablo adı veya stack
trace üst katmana giden mesaja konmaz (orijinali `from` ile zincirlenir,
detay yalnızca sınır katmanının loguna kalır). sifre_hash asla loglanmaz.
"""

import pymysql

from common.db import veritabani_baglantisi
from common.errors import DataAccessError
from models.kullanici_kimlik import KullaniciKimlikKaydi

# Kullanici + KullaniciKimlik birleşiminden login için gereken alanlar.
_KIMLIK_SORGUSU = """
    SELECT k.kullanici_kodu,
           k.ad,
           k.soyad,
           k.email,
           k.kullanici_turu,
           kk.sifre_hash,
           kk.hatali_giris_sayisi
    FROM Kullanici k
    JOIN KullaniciKimlik kk ON kk.kullanici_kodu = k.kullanici_kodu
    WHERE k.email = %s OR k.kullanici_kodu = %s
"""

_HATALI_GIRIS_ARTTIR_SORGUSU = """
    UPDATE KullaniciKimlik
    SET hatali_giris_sayisi = hatali_giris_sayisi + 1
    WHERE kullanici_kodu = %s
"""

_HATALI_GIRIS_SIFIRLA_SORGUSU = """
    UPDATE KullaniciKimlik
    SET hatali_giris_sayisi = 0,
        son_giris_tarihi = %s
    WHERE kullanici_kodu = %s
"""


def find_kimlik_by_identifier(kimlik: str) -> KullaniciKimlikKaydi | None:
    """Verilen kimliğe (email veya kullanici_kodu/SAP no) ait login kaydını döner.

    Kimlik, email sütunu VEYA kullanici_kodu sütunuyla eşleşebilir; her iki
    olasılık tek parametreli sorguyla (OR) güvenli biçimde denenir. Kayıt yoksa
    None döner.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_KIMLIK_SORGUSU, (kimlik, kimlik))
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Kimlik kaydı okunamadı.") from hata

    if satir is None:
        return None

    return KullaniciKimlikKaydi(
        kullanici_kodu=satir["kullanici_kodu"],
        ad=satir["ad"],
        soyad=satir["soyad"],
        email=satir["email"],
        kullanici_turu=satir["kullanici_turu"],
        sifre_hash=satir["sifre_hash"],
        hatali_giris_sayisi=satir["hatali_giris_sayisi"],
    )


def increment_hatali_giris(kullanici_kodu: str) -> None:
    """Başarısız giriş sonrası hatalı deneme sayacını bir arttırır (kilitleme için)."""
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_HATALI_GIRIS_ARTTIR_SORGUSU, (kullanici_kodu,))
    except pymysql.MySQLError as hata:
        raise DataAccessError("Hatalı giriş sayısı güncellenemedi.") from hata


def reset_hatali_giris_and_son_giris(kullanici_kodu: str, giris_zamani) -> None:
    """Başarılı giriş sonrası sayacı sıfırlar ve son giriş zamanını yazar."""
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    _HATALI_GIRIS_SIFIRLA_SORGUSU, (giris_zamani, kullanici_kodu)
                )
    except pymysql.MySQLError as hata:
        raise DataAccessError("Giriş bilgileri güncellenemedi.") from hata

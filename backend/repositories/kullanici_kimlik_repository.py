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
           kk.hatali_giris_sayisi,
           kk.son_hatali_giris_tarihi,
           kk.sifre_degistirilmeli
    FROM Kullanici k
    JOIN KullaniciKimlik kk ON kk.kullanici_kodu = k.kullanici_kodu
    WHERE k.email = %s OR k.kullanici_kodu = %s
"""

# Kullanıcı kendi (kalıcı) şifresini belirleyince: yeni hash yazılır, geçici şifre
# bayrağı düşürülür ve kilit sayacı sıfırlanır (temiz başlangıç).
_SIFRE_GUNCELLE_SORGUSU = """
    UPDATE KullaniciKimlik
    SET sifre_hash = %s,
        sifre_degistirilmeli = FALSE,
        sifre_guncelleme_tarihi = %s,
        hatali_giris_sayisi = 0
    WHERE kullanici_kodu = %s
"""

# Başarısız denemede: sayacı arttır ve o anın zamanını (hata_zamani) yaz.
_HATALI_GIRIS_ARTTIR_SORGUSU = """
    UPDATE KullaniciKimlik
    SET hatali_giris_sayisi = hatali_giris_sayisi + 1,
        son_hatali_giris_tarihi = %s
    WHERE kullanici_kodu = %s
"""

# Kilit süresi dolunca taze başlangıç: yalnızca sayaç/hata zamanı temizlenir;
# gerçek bir giriş olmadığından son_giris_tarihi'ne DOKUNULMAZ.
_HATALI_GIRIS_SAYAC_SIFIRLA_SORGUSU = """
    UPDATE KullaniciKimlik
    SET hatali_giris_sayisi = 0,
        son_hatali_giris_tarihi = NULL
    WHERE kullanici_kodu = %s
"""

# Başarılı giriş: sayaç ve hata zamanı temizlenir, son_giris_tarihi yazılır.
_HATALI_GIRIS_SIFIRLA_SORGUSU = """
    UPDATE KullaniciKimlik
    SET hatali_giris_sayisi = 0,
        son_hatali_giris_tarihi = NULL,
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
        son_hatali_giris_tarihi=satir["son_hatali_giris_tarihi"],
        # TINYINT gelebileceğinden Python bool'a çevrilir.
        sifre_degistirilmeli=bool(satir["sifre_degistirilmeli"]),
    )


def increment_hatali_giris(kullanici_kodu: str, hata_zamani) -> None:
    """Başarısız giriş sonrası sayacı bir arttırır ve son hatalı giriş zamanını yazar.

    hata_zamani (datetime), denemenin gerçekleştiği andır; Service geçici kilidin
    (kaba kuvvet koruması) dolup dolmadığını bu zamana göre hesaplar.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    _HATALI_GIRIS_ARTTIR_SORGUSU, (hata_zamani, kullanici_kodu)
                )
    except pymysql.MySQLError as hata:
        raise DataAccessError("Hatalı giriş sayısı güncellenemedi.") from hata


def reset_hatali_giris_sayaci(kullanici_kodu: str) -> None:
    """Kilit süresi dolunca sayacı ve son hatalı giriş zamanını temizler (taze başlangıç).

    Gerçek bir giriş gerçekleşmediği için son_giris_tarihi'ne dokunmaz; yalnızca
    kaba kuvvet sayacını sıfırlar ki kullanıcı yeniden deneme hakkı kazansın.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_HATALI_GIRIS_SAYAC_SIFIRLA_SORGUSU, (kullanici_kodu,))
    except pymysql.MySQLError as hata:
        raise DataAccessError("Hatalı giriş sayacı sıfırlanamadı.") from hata


def reset_hatali_giris_and_son_giris(kullanici_kodu: str, giris_zamani) -> None:
    """Başarılı giriş sonrası sayacı ve son hatalı giriş zamanını sıfırlar, son giriş zamanını yazar."""
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    _HATALI_GIRIS_SIFIRLA_SORGUSU, (giris_zamani, kullanici_kodu)
                )
    except pymysql.MySQLError as hata:
        raise DataAccessError("Giriş bilgileri güncellenemedi.") from hata


def sifre_guncelle(kullanici_kodu: str, yeni_sifre_hash: str, guncelleme_zamani) -> None:
    """Kullanıcının şifresini kalıcı olarak günceller ve geçici şifre bayrağını düşürür.

    Yeni hash yazılır, sifre_degistirilmeli FALSE olur, hatali_giris_sayisi
    sıfırlanır ve sifre_guncelleme_tarihi (guncelleme_zamani, datetime) yazılır.
    Hash Service'te üretilir; burada asla loglanmaz. Yetki/sahiplik Service'in işi.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    _SIFRE_GUNCELLE_SORGUSU,
                    (yeni_sifre_hash, guncelleme_zamani, kullanici_kodu),
                )
    except pymysql.MySQLError as hata:
        raise DataAccessError("Şifre güncellenemedi.") from hata

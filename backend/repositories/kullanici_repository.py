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

import pymysql

from common.db import veritabani_baglantisi
from common.errors import DataAccessError
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
           y.ad     AS yonetici_ad,
           y.soyad  AS yonetici_soyad,
           k.olusturma_tarihi,
           kk.son_giris_tarihi
    FROM Kullanici k
    LEFT JOIN Kullanici y ON y.kullanici_kodu = k.ilgili_yonetici_kodu
    LEFT JOIN KullaniciKimlik kk ON kk.kullanici_kodu = k.kullanici_kodu
    ORDER BY k.ad, k.soyad
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
            yonetici_ad=satir["yonetici_ad"],
            yonetici_soyad=satir["yonetici_soyad"],
            olusturma_tarihi=satir["olusturma_tarihi"],
            son_giris_tarihi=satir["son_giris_tarihi"],
        )
        for satir in satirlar
    ]

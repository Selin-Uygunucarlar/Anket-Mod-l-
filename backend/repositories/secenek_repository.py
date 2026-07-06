"""Yönetilen dropdown seçeneklerinin (TanimliSecenek) veri erişim katmanı.

Neden: DB ile konuşan tek yer burasıdır; SQL yalnızca bu katmanda yazılır.
Service/Controller tablo/şema/SQL görmez. Tüm sorgular parametreli (prepared)
yazılır; string birleştirme YASAK (SQL injection'a kapalı). Kullanıcı ekleme
formundaki 10 dropdown alanının seçenekleri tek tabloda tutulur; okuma ve ekleme
işlemleri buradan yapılır.

Yetki: Repository rol/yetki BİLMEZ. Kategori doğrulaması (sabit kümeye ait mi)
Service'in işidir; burada yalnızca parametreli erişim yapılır.

Hata yönetimi: Aynı (kategori, deger) tekrar eklenmeye çalışılırsa UNIQUE ihlali
SESSİZCE yutulmadan SecenekZatenVarError'a; diğer teknik DB istisnaları
DataAccessError'a sarmalanıp YUKARI FIRLATILIR. Ham DB mesajı/tablo adı üst
katmana giden mesaja konmaz (orijinali `from` ile zincirlenir).
"""

import pymysql

from common.db import veritabani_baglantisi
from common.errors import DataAccessError, SecenekZatenVarError
from models.secenek import SecenekKaydi

# Tüm seçenekleri kategori, deger sırasıyla listeler. Sıralama tablo collation'ı
# (utf8mb4_turkish_ci) ile yapılır; Türkçe harf sırası doğru gelir.
_SECENEK_LISTE_SORGUSU = """
    SELECT kategori, deger
    FROM TanimliSecenek
    ORDER BY kategori, deger
"""

# Yeni bir seçenek ekler. Aynı (kategori, deger) çifti UNIQUE ile engellenir.
_SECENEK_EKLE_SORGUSU = """
    INSERT INTO TanimliSecenek (kategori, deger)
    VALUES (%s, %s)
"""

# Verilen (kategori, deger) seçeneğini siler. Kayıt yoksa hiçbir satır etkilenmez
# (idempotent); bu bir hata değildir, çağıran katmana sessizce başarı döner.
_SECENEK_SIL_SORGUSU = """
    DELETE FROM TanimliSecenek
    WHERE kategori = %s AND deger = %s
"""


def list_secenekler() -> list[SecenekKaydi]:
    """Tüm dropdown seçeneklerini kategori/deger sırasına göre döner.

    Kategoriye göre gruplama ve gösterim üst katmanların işidir; burada yalnızca
    tüm satırlar sıralı biçimde okunur.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_SECENEK_LISTE_SORGUSU)
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Seçenek listesi okunamadı.") from hata

    return [
        SecenekKaydi(kategori=satir["kategori"], deger=satir["deger"])
        for satir in satirlar
    ]


def ekle_secenek(kategori: str, deger: str) -> None:
    """Verilen kategori altına yeni bir seçenek değeri ekler.

    Aynı (kategori, deger) zaten varsa UNIQUE ihlali oluşur; bu, yutulmadan
    SecenekZatenVarError'a sarmalanarak yukarı fırlatılır ki çağıran katman
    anlamlı yanıt verebilsin. Diğer teknik DB hataları DataAccessError olur.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_SECENEK_EKLE_SORGUSU, (kategori, deger))
    except pymysql.err.IntegrityError as hata:
        # UNIQUE ihlali: aynı seçenek zaten tanımlı. Ham DB detayı sızdırılmaz.
        raise SecenekZatenVarError() from hata
    except pymysql.MySQLError as hata:
        raise DataAccessError("Seçenek eklenemedi.") from hata


def sil_secenek(kategori: str, deger: str) -> None:
    """Verilen kategori altındaki bir seçenek değerini siler.

    İdempotenttir: silinecek satır yoksa (rowcount 0) bu bir hata sayılmaz,
    standart DELETE davranışı olarak sessizce başarı kabul edilir. Kategori
    doğrulaması Service'in işidir; burada yalnızca parametreli silme yapılır.
    Teknik DB hataları yutulmadan DataAccessError'a sarmalanıp yukarı fırlatılır.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_SECENEK_SIL_SORGUSU, (kategori, deger))
    except pymysql.MySQLError as hata:
        raise DataAccessError("Seçenek silinemedi.") from hata

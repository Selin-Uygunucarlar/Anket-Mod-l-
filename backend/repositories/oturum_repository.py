"""Sunucu tarafı oturum (server-side session) akışının veri erişim katmanı.

Neden: DB ile konuşan tek yer burasıdır; SQL yalnızca bu katmanda yazılır.
Service/Controller tablo/şema/SQL görmez. Tüm sorgular parametreli (prepared)
yazılır; string birleştirme YASAK (SQL injection'a kapalı).

Tasarım: DB yalnızca ham zaman değerlerini saklar; kayan (sliding) pencere ve
süre HESABI burada YAPILMAZ, o Service'in işidir. Zaman değerleri (olusturma,
son_erisim, gecerlilik_bitisi, simdi) çağıran Service tarafından PARAMETRE
olarak verilir. Oturum jetonunun ham hali DB'ye hiç girmez; yalnızca SHA-256
özeti (oturum_kodu_hash) saklanır ve sorgulanır.

Hata yönetimi: Teknik DB istisnaları DataAccessError'a sarmalanıp YUKARI
FIRLATILIR; burada loglanmaz/yutulmaz. Ham DB mesajı, tablo adı veya stack
trace üst katmana giden mesaja konmaz (orijinali `from` ile zincirlenir).
Oturum özeti (hash) asla loglanmaz.
"""

import pymysql

from common.db import veritabani_baglantisi
from common.errors import DataAccessError
from models.oturum import OturumSahibi

# Yeni oturum satırı ekler (giriş sonrası).
_OTURUM_EKLE_SORGUSU = """
    INSERT INTO Oturum (
        oturum_kodu_hash,
        kullanici_kodu,
        olusturma_tarihi,
        son_erisim_tarihi,
        gecerlilik_bitisi
    ) VALUES (%s, %s, %s, %s, %s)
"""

# Hash ile geçerli (süresi dolmamış) oturumu bulur; sahibinin güvenli alanlarını
# Kullanici ile JOIN'leyip döner. gecerlilik_bitisi > simdi koşulu SQL'de uygulanır.
_GECERLI_OTURUM_SORGUSU = """
    SELECT k.kullanici_kodu,
           k.ad,
           k.soyad,
           k.kullanici_turu,
           o.gecerlilik_bitisi
    FROM Oturum o
    JOIN Kullanici k ON k.kullanici_kodu = o.kullanici_kodu
    WHERE o.oturum_kodu_hash = %s
      AND o.gecerlilik_bitisi > %s
"""

# Kayan (sliding) oturum: son erişim ve geçerlilik bitişini günceller.
_SON_ERISIM_GUNCELLE_SORGUSU = """
    UPDATE Oturum
    SET son_erisim_tarihi = %s,
        gecerlilik_bitisi = %s
    WHERE oturum_kodu_hash = %s
"""

# Logout: tek oturum satırını siler.
_OTURUM_SIL_SORGUSU = """
    DELETE FROM Oturum
    WHERE oturum_kodu_hash = %s
"""

# Bakım: geçerliliği geçmiş oturumları toplu temizler.
_SURESI_GECMIS_SIL_SORGUSU = """
    DELETE FROM Oturum
    WHERE gecerlilik_bitisi <= %s
"""


def create_oturum(
    oturum_kodu_hash: str,
    kullanici_kodu: str,
    olusturma_tarihi,
    son_erisim_tarihi,
    gecerlilik_bitisi,
) -> None:
    """Yeni bir oturum satırı ekler (başarılı giriş sonrası).

    oturum_kodu_hash, Service'in ürettiği ham jetonun SHA-256 hex özetidir; ham
    jeton DB'ye hiç gelmez. Zaman değerleri Service tarafından hesaplanıp
    parametre olarak verilir; süre mantığı burada yoktur.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    _OTURUM_EKLE_SORGUSU,
                    (
                        oturum_kodu_hash,
                        kullanici_kodu,
                        olusturma_tarihi,
                        son_erisim_tarihi,
                        gecerlilik_bitisi,
                    ),
                )
    except pymysql.MySQLError as hata:
        raise DataAccessError("Oturum oluşturulamadı.") from hata


def find_gecerli_oturum(oturum_kodu_hash: str, simdi) -> OturumSahibi | None:
    """Verilen jeton özetine ait, henüz süresi dolmamış oturumu döner.

    gecerlilik_bitisi > simdi koşulu SQL'de uygulanır; süresi geçmiş veya hiç
    bulunmayan oturum için None döner. Bulunursa oturum sahibinin güvenli kimlik
    alanları (Kullanici JOIN) DTO olarak döner. simdi, çağıran Service'in ürettiği
    "şu an" değeridir; zaman kararı Service'e aittir.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_GECERLI_OTURUM_SORGUSU, (oturum_kodu_hash, simdi))
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Oturum okunamadı.") from hata

    if satir is None:
        return None

    return OturumSahibi(
        kullanici_kodu=satir["kullanici_kodu"],
        ad=satir["ad"],
        soyad=satir["soyad"],
        kullanici_turu=satir["kullanici_turu"],
        gecerlilik_bitisi=satir["gecerlilik_bitisi"],
    )


def guncelle_son_erisim(
    oturum_kodu_hash: str, yeni_son_erisim, yeni_gecerlilik_bitisi
) -> None:
    """Kayan (sliding) oturum için son erişim ve geçerlilik bitişini günceller.

    Yeni zaman değerleri Service tarafından hesaplanıp parametre verilir; pencere
    uzatma kararı (ör. yenileme eşiği) burada değil Service'te alınır.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    _SON_ERISIM_GUNCELLE_SORGUSU,
                    (yeni_son_erisim, yeni_gecerlilik_bitisi, oturum_kodu_hash),
                )
    except pymysql.MySQLError as hata:
        raise DataAccessError("Oturum güncellenemedi.") from hata


def delete_oturum(oturum_kodu_hash: str) -> None:
    """Tek bir oturumu siler (logout). Kayıt yoksa sessizce etkisizdir."""
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_OTURUM_SIL_SORGUSU, (oturum_kodu_hash,))
    except pymysql.MySQLError as hata:
        raise DataAccessError("Oturum silinemedi.") from hata


def delete_suresi_gecmis_oturumlar(simdi) -> None:
    """Geçerliliği geçmiş oturumları toplu temizler (opsiyonel bakım).

    simdi'den önce dolan tüm satırları siler; çağıran Service periyodik bakım
    için "şu an" değerini verir.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(_SURESI_GECMIS_SIL_SORGUSU, (simdi,))
    except pymysql.MySQLError as hata:
        raise DataAccessError("Süresi geçmiş oturumlar temizlenemedi.") from hata

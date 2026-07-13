"""Anket soruları (ekleme + listeleme + silme) akışının veri erişim katmanı.

Neden: DB ile konuşan tek yer burasıdır; SQL yalnızca bu katmanda çalıştırılır.
Service/Controller tablo/şema/SQL görmez. Tüm sorgular parametreli (prepared)
çalıştırılır; string birleştirme YASAK (SQL injection'a kapalı). Ham SQL metinleri
soru_sorgulari.py'ye ayrılmıştır (SRP + dosya boyutu); bu dosya bağlantı yönetimi,
sonuç dönüşümü/montajı ve hata sarmalama sorumluluğunu taşır.

Güvenlik: soru_metni biçimli HAM HTML olarak döner; XSS'e karşı sanitizasyon
Service katmanının işidir (bkz. migration 007). Repository yetki/rol/sahiplik
BİLMEZ; bunlar Service/Controller katmanındadır.

Hata yönetimi: Teknik DB istisnaları DataAccessError'a sarmalanıp YUKARI
FIRLATILIR; burada loglanmaz/yutulmaz. Ham DB mesajı, tablo adı veya stack
trace üst katmana giden mesaja konmaz (orijinali `from` ile zincirlenir).
"""

import pymysql

from common.db import veritabani_baglantisi
from common.errors import DataAccessError
from models.soru import SoruKaydi, SoruSecenegi
from repositories import soru_sorgulari as sorgular


def sorulari_getir() -> list[SoruKaydi]:
    """Tüm anketlerin tüm sorularını, hazırlayan bilgisi ve şıklarıyla döner.

    Sıra: anket_id, sira_no, soru_id. Şıklar N+1 yapılmadan tek sorguda çekilip
    Python'da soru_id'ye göre gruplanır (bu bir veri montajıdır, iş kuralı değil;
    Repository'de uygundur). Şıksız/sorusu olmayan sorular boş secenekler=[] alır.
    Yetki/rol kontrolü ve soru_metni sanitizasyonu burada DEĞİL, Service'tedir.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.SORULAR_LISTE_SORGUSU)
                soru_satirlari = imlec.fetchall()
                imlec.execute(sorgular.SECENEKLER_LISTE_SORGUSU)
                secenek_satirlari = imlec.fetchall()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Soru listesi okunamadı.") from hata

    # Şıkları soru_id'ye göre grupla (tek geçiş); her soru için sıralı listesi hazır olsun.
    secenekler_by_soru: dict[int, list[SoruSecenegi]] = {}
    for satir in secenek_satirlari:
        secenekler_by_soru.setdefault(satir["soru_id"], []).append(
            SoruSecenegi(
                secenek_metni=satir["secenek_metni"],
                sira_no=satir["sira_no"],
            )
        )

    return [
        SoruKaydi(
            soru_id=satir["soru_id"],
            anket_id=satir["anket_id"],
            soru_metni=satir["soru_metni"],
            soru_tipi=satir["soru_tipi"],
            sira_no=satir["sira_no"],
            # TINYINT gelebileceğinden Python bool'a çevrilir.
            zorunlu_mu=bool(satir["zorunlu_mu"]),
            hazirlayan_kodu=satir["hazirlayan_kodu"],
            hazirlayan_ad=satir["hazirlayan_ad"],
            hazirlayan_soyad=satir["hazirlayan_soyad"],
            secenekler=secenekler_by_soru.get(satir["soru_id"], []),
        )
        for satir in soru_satirlari
    ]


def soru_ekle(
    anket_id: int | None,
    soru_metni: str,
    soru_tipi: str,
    sira_no: int | None,
    zorunlu_mu: bool,
    hazirlayan_kodu: str | None,
    konu: str | None,
    amac: str | None,
    secenekler: list[str],
) -> int:
    """Bir soruyu ve (varsa) şıklarını TEK transaction'da ekler; yeni soru_id döner.

    Önce Soru INSERT edilir; oluşan soru_id (cursor.lastrowid) alınır ve
    `secenekler` listesindeki her metin için sıralı Secenek satırı (sira_no =
    index+1) çoklu INSERT (executemany) ile eklenir. Boş liste HATA DEĞİLDİR:
    yalnızca Soru eklenir, hiç şık girilmez (açık uçlu soru). anket_id None ise
    soru BAĞIMSIZ eklenir (migration 009; ankete bağlama sonraki iş).

    İşlem bütünlüğü veritabani_baglantisi context manager'ına aittir: blok
    sorunsuz biterse commit, herhangi bir adımda istisna olursa ROLLBACK yapar
    (Soru eklenip şıklar patlarsa yarım kayıt kalmaz). Tüm sorgular parametreli
    (%s); string birleştirme yoktur. secenek_metni/soru_metni HAM içerik olarak
    yazılır — sanitizasyon (XSS) Service'in işidir; Repository yetki/rol bilmez,
    loglamaz. Teknik DB hatası DataAccessError'a sarmalanıp yukarı fırlatılır;
    ham DB mesajı/tablo adı üst mesaja konmaz (orijinal `from` ile zincirlenir).
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    sorgular.SORU_EKLE_SORGUSU,
                    (
                        anket_id,
                        soru_metni,
                        soru_tipi,
                        konu,
                        amac,
                        sira_no,
                        zorunlu_mu,
                        hazirlayan_kodu,
                    ),
                )
                yeni_soru_id = imlec.lastrowid

                if secenekler:
                    # Şıklar giriş sırasına göre 1'den başlayan sira_no ile eklenir.
                    secenek_parametreleri = [
                        (yeni_soru_id, metin, indeks + 1)
                        for indeks, metin in enumerate(secenekler)
                    ]
                    imlec.executemany(
                        sorgular.SECENEK_EKLE_SORGUSU, secenek_parametreleri
                    )
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Soru eklenemedi.") from hata

    return yeni_soru_id


def soru_sil(soru_id: int) -> None:
    """Verilen soruyu siler; şıkları ve verilmiş cevapları CASCADE ile birlikte gider.

    İdempotenttir: silinecek soru yoksa (rowcount 0) bu bir hata sayılmaz,
    standart DELETE davranışı olarak sessizce başarı kabul edilir. Secenek
    (fk_secenek_soru) ve Cevap (fk_cevap_soru) FK'leri ON DELETE CASCADE
    olduğundan bu soruya ait şıklar ve cevaplar DB tarafından aynı işlemde
    otomatik silinir (yetim kayıt kalmaz). Yetki/sahiplik kontrolü burada DEĞİL,
    Service/Controller'dadır. Teknik DB hataları yutulmadan DataAccessError'a
    sarmalanıp yukarı fırlatılır (ham DB mesajı/tablo adı sızmaz).
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.SORU_SIL_SORGUSU, (soru_id,))
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Soru silinemedi.") from hata

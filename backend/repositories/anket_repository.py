"""Anket (oluşturma + kullanıcı atama + listeleme) veri erişim katmanı.

Neden: DB ile konuşan tek yer burasıdır; SQL yalnızca bu katmanda çalıştırılır.
Service/Controller tablo/şema/SQL görmez. Tüm sorgular parametreli (prepared)
çalıştırılır; string birleştirme YASAK (SQL injection'a kapalı). Ham SQL metinleri
anket_sorgulari.py'ye ayrılmıştır (SRP + dosya boyutu); bu dosya bağlantı yönetimi,
sonuç dönüşümü ve hata sarmalama sorumluluğunu taşır.

Güvenlik: Repository yetki/rol/sahiplik BİLMEZ (admin kontrolü, erişim seviyesi
kuralları, tarih hesabı ve soru id doğrulaması Service'tedir). olusturan_kodu
buraya oturumdan gelir; client'tan alınmaz -- bunu garanti etmek Service'in işidir.

Hata yönetimi: Teknik DB istisnaları DataAccessError'a sarmalanıp YUKARI
FIRLATILIR; burada loglanmaz/yutulmaz. Ham DB mesajı, tablo adı veya stack trace
üst katmana giden mesaja konmaz (orijinali `from` ile zincirlenir).
"""

from datetime import datetime

import pymysql

from common.db import veritabani_baglantisi
from common.errors import DataAccessError
from models.anket import AnketOzeti
from repositories import anket_sorgulari as sorgular


def anketleri_getir() -> list[AnketOzeti]:
    """Tüm anketleri, oluşturan bilgisi ve atama/yanıt sayılarıyla döner.

    Sıra: en yeni anket üstte (anket_id DESC). Atama/yanıt sayıları AnketAtama
    üzerinden hesaplanır (anket oluşturulurken yazılan atamalar buraya yansır;
    kimseye atanmamış anket 0 alır). Yetki kontrolü burada DEĞİL, Service'tedir.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.ANKETLER_LISTE_SORGUSU)
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Anket listesi okunamadı.") from hata

    return [
        AnketOzeti(
            anket_id=satir["anket_id"],
            ad=satir["ad"],
            durum=satir["durum"],
            olusturan_ad=satir["olusturan_ad"],
            olusturan_soyad=satir["olusturan_soyad"],
            olusturma_tarihi=satir["olusturma_tarihi"],
            atanan_sayisi=satir["atanan_sayisi"],
            yanitlayan_sayisi=satir["yanitlayan_sayisi"],
        )
        for satir in satirlar
    ]


def anket_ekle(
    ad: str,
    on_yazi: str | None,
    son_yazi: str | None,
    aciklama: str | None,
    durum: str,
    anket_tipi: str | None,
    erisim_seviyesi: str | None,
    erisim_grup_id: int | None,
    baslangic_tarihi: datetime,
    bitis_tarihi: datetime,
    olusturan_kodu: str | None,
    soru_idler: list[int],
    atanacak_kullanici_kodlari: list[str],
    son_tarih: datetime,
) -> int:
    """Anketi, soru bağlarını ve kullanıcı atamalarını TEK transaction'da ekler.

    Önce Anket INSERT edilir; oluşan anket_id (cursor.lastrowid) alınır ve
    `soru_idler` listesindeki her soru için AnketSoru bağ satırı (sira_no =
    index+1, yani gelen sıra korunur) çoklu INSERT (executemany) ile yazılır.
    Ardından `atanacak_kullanici_kodlari`ndaki her kişi için AnketAtama satırı
    yazılır (atama_tarihi = yazma anı, son_tarih = anketin bitişi, durum =
    ATAMA_BASLANGIC_DURUMU). Atama KİŞİ bazlıdır: grup DB'ye yazılmaz; grubu
    üyelerine çözmek, tekilleştirmek ve atamanın zorunlu olup olmadığına karar
    vermek Service'in işidir. Liste boşsa AnketAtama'ya hiç INSERT yapılmaz.

    İşlem bütünlüğü veritabani_baglantisi context manager'ına aittir: blok
    sorunsuz biterse commit, herhangi bir adımda istisna olursa ROLLBACK yapar.
    Bu yüzden KISMİ KAYIT OLUŞMAZ: soru bağları ya da atamalar yazılamazsa anket
    de yazılmaz. olusturma_tarihi gönderilmez; DB DEFAULT CURRENT_TIMESTAMP ile
    yazar. Tüm sorgular parametreli (%s); string birleştirme yoktur. Doğrulama
    (soru/kullanıcı id'lerinin varlığı, erişim seviyesi kuralları, tarih hesabı)
    Service'in işidir. Yeni anket_id döner.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    sorgular.ANKET_EKLE_SORGUSU,
                    (
                        ad,
                        on_yazi,
                        son_yazi,
                        aciklama,
                        durum,
                        anket_tipi,
                        erisim_seviyesi,
                        erisim_grup_id,
                        baslangic_tarihi,
                        bitis_tarihi,
                        olusturan_kodu,
                    ),
                )
                yeni_anket_id = imlec.lastrowid

                if soru_idler:
                    # Sorular gelen sıraya göre 1'den başlayan sira_no ile bağlanır.
                    bag_parametreleri = [
                        (yeni_anket_id, soru_id, indeks + 1)
                        for indeks, soru_id in enumerate(soru_idler)
                    ]
                    imlec.executemany(
                        sorgular.ANKETSORU_EKLE_SORGUSU, bag_parametreleri
                    )

                if atanacak_kullanici_kodlari:
                    # Atamalar tek anda yazıldığından hepsi aynı atama_tarihi'ni taşır.
                    atama_tarihi = datetime.now()
                    atama_parametreleri = [
                        (
                            yeni_anket_id,
                            kullanici_kodu,
                            atama_tarihi,
                            son_tarih,
                            sorgular.ATAMA_BASLANGIC_DURUMU,
                        )
                        for kullanici_kodu in atanacak_kullanici_kodlari
                    ]
                    imlec.executemany(
                        sorgular.ANKETATAMA_EKLE_SORGUSU, atama_parametreleri
                    )
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Anket eklenemedi.") from hata

    return yeni_anket_id


def soru_idleri_getir(soru_idler: list[int]) -> list[int]:
    """Verilen soru_id'lerden DB'de gerçekten var olanları döner.

    Neden: client'tan gelen soru id'lerine güvenilmez; Service dönen kümeyi
    isteneni ile karşılaştırıp eksikleri bulur ("hangi id geçersiz" kararı bir iş
    kararıdır, Service'e aittir). IN listesinin yer tutucuları soru SAYISI kadar
    üretilir; id DEĞERLERİ SQL metnine gömülmez, hepsi parametre olarak geçer.
    Boş liste ile çağrılmaz (Service en az 1 soru şartını önce uygular).
    """
    yer_tutucular = ", ".join(["%s"] * len(soru_idler))
    sorgu = sorgular.SORU_IDLERI_VAR_MI_SORGUSU.format(yer_tutucular=yer_tutucular)

    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgu, tuple(soru_idler))
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Sorular okunamadı.") from hata

    return [satir["soru_id"] for satir in satirlar]

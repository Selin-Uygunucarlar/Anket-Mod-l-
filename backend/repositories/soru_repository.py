"""Anket soruları (ekleme + toplu ekleme + listeleme + silme + detay + güncelleme)
veri erişim katmanı.

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
from models.soru import SoruKaydi, SoruSecenegi, YuklenecekSoru
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
            konu=satir["konu"],
            amac=satir["amac"],
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


def sorulari_toplu_ekle(kayitlar: list[YuklenecekSoru]) -> list[int]:
    """Birden çok soruyu (ve şıklarını) TEK transaction'da ekler; soru_id'leri döner.

    Excel ile toplu soru yükleme akışının yazma ucudur. Her kayıt için önce Soru
    INSERT edilir (mevcut SORU_EKLE_SORGUSU), oluşan soru_id cursor.lastrowid ile
    alınır ve varsa şıkları sira_no = index+1 ile executemany edilir — tek soru
    ekleyen soru_ekle ile birebir aynı kalıp. Sabitler de aynıdır: anket_id=None
    (bağımsız soru), sira_no=None, zorunlu_mu=False. Şıksız kayıt HATA DEĞİLDİR;
    yalnızca Soru satırı yazılır.

    ATOMİK: tüm kayıtlar tek bağlantı/tek transaction içinde yazılır. Herhangi bir
    kayıtta istisna oluşursa veritabani_baglantisi context manager'ı ROLLBACK yapar
    (doğrulandı: blok sorunsuz biterse commit, istisnada rollback + yukarı fırlat),
    yani ya HEPSİ yazılır ya HİÇBİRİ. Dönüş: eklenen soru_id'ler GİRİŞ SIRASIYLA.

    Boş liste geldiğinde DB'ye hiç gidilmez, doğrudan boş liste dönülür (yazacak
    kayıt yokken bağlantı açmanın anlamı yok; "boş girdi" kararı Service'e aittir,
    burada hata sayılmaz). Tüm sorgular parametreli (%s); string birleştirme yok.
    Metinler HAM yazılır — sanitizasyon (XSS) Service'in işidir; Repository
    yetki/rol/sahiplik BİLMEZ ve loglamaz. Teknik DB hatası DataAccessError'a
    sarmalanıp yukarı fırlatılır (ham DB mesajı/tablo adı üst mesaja konmaz).
    """
    if not kayitlar:
        return []

    eklenen_soru_idleri: list[int] = []
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                for kayit in kayitlar:
                    imlec.execute(
                        sorgular.SORU_EKLE_SORGUSU,
                        (
                            None,  # anket_id: toplu yüklenen soru BAĞIMSIZ eklenir
                            kayit.soru_metni,
                            kayit.soru_tipi,
                            kayit.konu,
                            kayit.amac,
                            None,  # sira_no: ankete bağlanmadığı için tanımsız
                            False,  # zorunlu_mu: ankete bağlanırken belirlenir
                            kayit.hazirlayan_kodu,
                        ),
                    )
                    yeni_soru_id = imlec.lastrowid
                    eklenen_soru_idleri.append(yeni_soru_id)

                    if kayit.secenekler:
                        # Şıklar giriş sırasına göre 1'den başlayan sira_no ile eklenir.
                        secenek_parametreleri = [
                            (yeni_soru_id, metin, indeks + 1)
                            for indeks, metin in enumerate(kayit.secenekler)
                        ]
                        imlec.executemany(
                            sorgular.SECENEK_EKLE_SORGUSU, secenek_parametreleri
                        )
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Sorular toplu eklenemedi.") from hata

    return eklenen_soru_idleri


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


def soru_getir(soru_id: int) -> SoruKaydi | None:
    """Tek soruyu hazırlayan bilgisi ve şıklarıyla döner; yoksa None.

    Neden None: "bulunamadı" bir iş kararıdır ve Service'e aittir (Repository
    NotFound fırlatmaz). Şıklar SORU_DETAY_SECENEKLER_SORGUSU ile sıralı çekilir;
    sorulari_getir'deki montaj üslubuyla tutarlı olarak Python'da SoruKaydi'ye
    (konu/amac dahil) eşlenir. zorunlu_mu Python bool'a çevrilir (DB'den TINYINT
    gelebilir). soru_metni HAM döner (sanitizasyon Service'in işi). Yetki/rol
    kontrolü burada DEĞİL, Service/Controller'dadır. Teknik DB hatası
    DataAccessError'a sarmalanıp yukarı fırlatılır; ham DB mesajı/tablo adı sızmaz.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.SORU_DETAY_SORGUSU, (soru_id,))
                soru_satiri = imlec.fetchone()
                if soru_satiri is None:
                    return None
                imlec.execute(
                    sorgular.SORU_DETAY_SECENEKLER_SORGUSU, (soru_id,)
                )
                secenek_satirlari = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Soru okunamadı.") from hata

    secenekler = [
        SoruSecenegi(
            secenek_metni=satir["secenek_metni"],
            sira_no=satir["sira_no"],
        )
        for satir in secenek_satirlari
    ]

    return SoruKaydi(
        soru_id=soru_satiri["soru_id"],
        anket_id=soru_satiri["anket_id"],
        soru_metni=soru_satiri["soru_metni"],
        soru_tipi=soru_satiri["soru_tipi"],
        konu=soru_satiri["konu"],
        amac=soru_satiri["amac"],
        sira_no=soru_satiri["sira_no"],
        # TINYINT gelebileceğinden Python bool'a çevrilir.
        zorunlu_mu=bool(soru_satiri["zorunlu_mu"]),
        hazirlayan_kodu=soru_satiri["hazirlayan_kodu"],
        hazirlayan_ad=soru_satiri["hazirlayan_ad"],
        hazirlayan_soyad=soru_satiri["hazirlayan_soyad"],
        secenekler=secenekler,
    )


def soru_guncelle(
    soru_id: int,
    soru_metni: str,
    soru_tipi: str,
    konu: str | None,
    amac: str | None,
    secenekler: list[str],
) -> None:
    """Bir sorunun metnini/kategorilerini ve şıklarını TEK transaction'da günceller.

    Sıra: (1) SORU_GUNCELLE_SORGUSU ile Soru satırının düzenlenebilir alanları
    (soru_metni, soru_tipi, konu, amac) güncellenir; (2) SORU_SECENEKLERINI_SIL_
    SORGUSU ile eski şıklar silinir; (3) `secenekler` listesindeki her metin
    sira_no = index+1 ile SECENEK_EKLE_SORGUSU (executemany) ile yeniden eklenir
    ("hepsini sil + yeniden yaz" — şık düzenlemenin en yalın tutarlı yolu).
    anket_id/sira_no/zorunlu_mu/hazirlayan_kodu DEĞİŞMEZ (düzenleme bunları taşımaz).

    Boş `secenekler` HATA DEĞİLDİR: yalnızca eski şıklar silinir, yeni şık eklenmez
    (açık uçlu soru). Kayıt yoksa UPDATE etkisizdir (rowcount 0) ve bu SESSİZCE
    geçilir — "bulunamadı" kararını Service verir (önce soru_getir ile varlık
    doğrular); burada NotFound FIRLATILMAZ. İşlem bütünlüğü context manager'a
    aittir: blok sorunsuz biterse commit, herhangi bir adımda istisna olursa
    ROLLBACK (yarım güncelleme kalmaz). Tüm sorgular parametreli (%s); string
    birleştirme yok. secenek_metni/soru_metni HAM yazılır (sanitizasyon Service'in
    işi). Teknik DB hatası DataAccessError'a sarmalanıp yukarı fırlatılır; ham DB
    mesajı/tablo adı üst mesaja konmaz (orijinal `from` ile zincirlenir).
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    sorgular.SORU_GUNCELLE_SORGUSU,
                    (soru_metni, soru_tipi, konu, amac, soru_id),
                )
                imlec.execute(
                    sorgular.SORU_SECENEKLERINI_SIL_SORGUSU, (soru_id,)
                )
                if secenekler:
                    # Şıklar giriş sırasına göre 1'den başlayan sira_no ile yeniden eklenir.
                    secenek_parametreleri = [
                        (soru_id, metin, indeks + 1)
                        for indeks, metin in enumerate(secenekler)
                    ]
                    imlec.executemany(
                        sorgular.SECENEK_EKLE_SORGUSU, secenek_parametreleri
                    )
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Soru güncellenemedi.") from hata

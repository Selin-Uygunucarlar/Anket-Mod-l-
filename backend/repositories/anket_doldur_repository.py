"""Anket doldurma (cevaplama) veri erişim katmanı.

Neden ayrı dosya: anket_repository.py 500 satır sınırına yaklaştığından, cevaplama
akışının okuma/yazma erişimi buraya alındı (SRP + dosya boyutu). DB ile konuşan tek
yer yine burasıdır; SQL yalnızca bu katmanda çalıştırılır ve tüm sorgular parametreli
(prepared) geçer -- string birleştirme YASAK (SQL injection'a kapalı). Ham SQL metinleri
anket_sorgulari.py'de tek yerde toplanır.

Sorumluluk: (1) anketin cevaplanmaya hazır içeriğini + atama sahiplik bilgisini okur;
(2) verilen cevapları TEK transaction'da yazıp atamayı tamamlandı işaretler.

Güvenlik: Repository yetki/rol BİLMEZ. Cevaplama okuması AnketAtama'yı kullanici_kodu
ile SÜZER; bu bir SAHİPLİK girdisidir (satır yoksa None). Sicilin oturum sahibine ait
olduğunu garanti etmek (IDOR koruması) ve "None = bulunamadı" yorumu Service'in işidir;
burada NotFound FIRLATILMAZ. Cevap tuple'ları Service'ten DOĞRULANMIŞ gelir (soru/şık
aidiyeti, zorunluluk, kardinalite) -- Repository doğrulamaz. soru_metni/secenek_metni/
cevap_metni HAM taşınır (sanitizasyon Service'in işi).

Hata yönetimi: Teknik DB istisnaları DataAccessError'a sarmalanıp YUKARI FIRLATILIR;
burada loglanmaz/yutulmaz. Ham DB mesajı, tablo adı veya stack trace üst katmana giden
mesaja konmaz (orijinali `from` ile zincirlenir).
"""

from datetime import datetime

import pymysql

from common.db import veritabani_baglantisi
from common.errors import DataAccessError
from models.anket_doldur import AnketDoldurKaynak, DoldurSecenek, DoldurSoru
from repositories import anket_sorgulari as sorgular


def anket_doldur_kaynak_getir(
    anket_id: int, kullanici_kodu: str
) -> AnketDoldurKaynak | None:
    """Anketi cevaplanmaya hazır içeriğiyle (sorular + şıklar) ve atama sahipliğiyle döner.

    Önce anket meta + atama satırı okunur: anket bu kullanıcıya ATANMIŞ değilse
    (AnketAtama satırı yok) None döner -- sahiplik kapısı. "None = bulunamadı" yorumu
    (NotFound) bir iş kararıdır ve Service'e aittir; burada NotFound FIRLATILMAZ.
    Anketin 'Aktif' olup olmadığı / tarih penceresinde olup olmadığı / atamanın
    tamamlanmış olup olmadığı KARARI da Service'te verilir -- burada ham veri (durum,
    baslangic/bitis, atama_durum) yalnızca taşınır.

    Sorular AnketSoru JOIN Soru ile deterministik sırada çekilir; grid tipli sorular
    BU TURDA KAPSAM DIŞI olduğundan sorguda dışlanır. Şıklar N+1 YAPILMADAN: bulunan
    soruların tüm Secenek satırları TEK sorguda çekilip Python'da soru_id'ye göre
    gruplanır (sorulari_getir montaj üslubu). Şıksız (açık uçlu) soru boş secenekler=[]
    alır; soru listesi boşsa şık sorgusu ÇALIŞTIRILMAZ. soru_metni/secenek_metni HAM
    döner; zorunlu_mu Python bool'a çevrilir (DB'den TINYINT gelebilir).
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                # Sahiplik kapısı: anket_id + kullanici_kodu ile atama satırı.
                imlec.execute(
                    sorgular.ANKET_DOLDUR_KAYNAK_SORGUSU,
                    (anket_id, kullanici_kodu),
                )
                kaynak_satiri = imlec.fetchone()
                if kaynak_satiri is None:
                    return None

                imlec.execute(
                    sorgular.ANKET_DOLDUR_SORULARI_SORGUSU, (anket_id,)
                )
                soru_satirlari = imlec.fetchall()

                # Şıklar yalnızca soru varsa ve tek sorguda (N+1 yok) çekilir.
                secenek_satirlari: list = []
                if soru_satirlari:
                    soru_idler = [satir["soru_id"] for satir in soru_satirlari]
                    yer_tutucular = ", ".join(["%s"] * len(soru_idler))
                    secenek_sorgusu = (
                        sorgular.ANKET_DOLDUR_SECENEKLERI_SORGUSU.format(
                            yer_tutucular=yer_tutucular
                        )
                    )
                    imlec.execute(secenek_sorgusu, tuple(soru_idler))
                    secenek_satirlari = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Anket okunamadı.") from hata

    # Şıkları soru_id'ye göre grupla (montaj veri dönüşümüdür, iş kuralı değil).
    secenekler_soruya_gore: dict[int, list[DoldurSecenek]] = {}
    for satir in secenek_satirlari:
        secenekler_soruya_gore.setdefault(satir["soru_id"], []).append(
            DoldurSecenek(
                secenek_id=satir["secenek_id"],
                secenek_metni=satir["secenek_metni"],
                sira_no=satir["sira_no"],
            )
        )

    sorular = [
        DoldurSoru(
            soru_id=satir["soru_id"],
            soru_metni=satir["soru_metni"],
            soru_tipi=satir["soru_tipi"],
            zorunlu_mu=bool(satir["zorunlu_mu"]),
            sira_no=satir["sira_no"],
            secenekler=secenekler_soruya_gore.get(satir["soru_id"], []),
        )
        for satir in soru_satirlari
    ]

    return AnketDoldurKaynak(
        anket_id=kaynak_satiri["anket_id"],
        ad=kaynak_satiri["ad"],
        on_yazi=kaynak_satiri["on_yazi"],
        son_yazi=kaynak_satiri["son_yazi"],
        durum=kaynak_satiri["durum"],
        baslangic_tarihi=kaynak_satiri["baslangic_tarihi"],
        bitis_tarihi=kaynak_satiri["bitis_tarihi"],
        atama_id=kaynak_satiri["atama_id"],
        atama_durum=kaynak_satiri["atama_durum"],
        sorular=sorular,
    )


def cevaplari_kaydet(
    atama_id: int,
    cevap_satirlari: list[tuple],
    tamamlanma_zamani: datetime,
) -> None:
    """Bir atamanın cevaplarını TEK transaction'da yazar ve atamayı tamamlandı işaretler.

    Sıra: (1) atamanın önceki cevapları TÜMÜYLE silinir (yeniden gönderime/temiz
    sayfaya karşı; eski kalıntı kalmaz); (2) cevap_satirlari executemany ile Cevap'a
    yazılır -- her öğe (soru_id, secilen_secenek_id | None, cevap_metni | None); liste
    BOŞSA INSERT atlanır (savunma; normalde boş gelmez); (3) AnketAtama tamamlandı
    işaretlenir: durum = ATAMA_TAMAMLANDI_DURUMU, tamamlanma_tarihi = tamamlanma_zamani,
    baslama_tarihi COALESCE ile korunur (daha önce başladıysa değişmez, ilk kez
    tamamlanıyorsa gönderim anı yazılır -> NULL kalmaz; tamamlanma_tarihi <-> durum
    tutarlılığı korunur).

    İşlem bütünlüğü veritabani_baglantisi context manager'ına aittir: blok sorunsuz
    biterse commit, herhangi bir adımda istisna olursa ROLLBACK -- KISMİ KAYIT OLMAZ
    (cevaplar yazılıp atama tamamlanmadan kalmaz ya da tersi). Değerler Service'ten
    DOĞRULANMIŞ gelir (soru/şık aidiyeti, zorunluluk, kardinalite, cevap_metni
    sanitizasyonu); Repository doğrulamaz. Tüm sorgular parametreli (%s); string
    birleştirme yok.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.CEVAPLARI_SIL_SORGUSU, (atama_id,))

                if cevap_satirlari:
                    # Her öğe (soru_id, secilen_secenek_id|None, cevap_metni|None);
                    # atama_id başa eklenerek tam Cevap satırı kurulur.
                    ekleme_parametreleri = [
                        (atama_id, soru_id, secilen_secenek_id, cevap_metni)
                        for soru_id, secilen_secenek_id, cevap_metni in cevap_satirlari
                    ]
                    imlec.executemany(
                        sorgular.CEVAP_EKLE_SORGUSU, ekleme_parametreleri
                    )

                imlec.execute(
                    sorgular.ATAMA_TAMAMLANDI_ISARETLE_SORGUSU,
                    (
                        sorgular.ATAMA_TAMAMLANDI_DURUMU,
                        tamamlanma_zamani,
                        tamamlanma_zamani,
                        atama_id,
                    ),
                )
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Cevaplar kaydedilemedi.") from hata

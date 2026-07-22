"""Anket sonuçları (atanan/yanıtlayan listesi + tek kişinin cevapları) veri erişim katmanı.

Neden ayrı dosya: anket_repository.py 500 satır sınırına yaklaştığından (oluşturma,
listeleme, detay, güncelleme), anket listesi ekranından açılan SONUÇ okumaları buraya
alındı (SRP + dosya boyutu; anket_doldur_repository.py ile aynı kalıp). DB ile konuşan
tek yer yine burasıdır; tüm sorgular parametreli (prepared) çalışır -- string
birleştirme YASAK. Ham SQL metinleri anket_sonuc_sorgulari.py'dedir.

Sorumluluk: (1) bir ankete atanmış kişileri atama durumlarıyla okur; (2) tek kişinin o
ankete verdiği cevapları, anketin cevaplanabilir sorularıyla birlikte okur.

Güvenlik: Repository yetki/rol BİLMEZ. Görünürlük parametreleri bir YETKİ KARARI değil,
SÜZME girdisidir; kararı Service verir. Her iki okuma da anketin görünürlük kapısından
geçer: kapı düşerse None döner ("anket yok" ile "bana görünmüyor" AYRILMAZ -- varlık
sızmaz, IDOR'a kapalı). "None = bulunamadı" yorumu Service'e aittir; burada NotFound
FIRLATILMAZ. Metinler (soru_metni, secenek_metni, cevap_metni) HAM taşınır;
sanitizasyon (XSS) okuma sınırında Service'in işidir. Hassas alan (sifre_hash vb.)
okunmaz.

Hata yönetimi: Teknik DB istisnaları DataAccessError'a sarmalanıp YUKARI FIRLATILIR;
burada loglanmaz/yutulmaz. Ham DB mesajı, tablo adı veya stack trace üst katmana giden
mesaja konmaz (orijinali `from` ile zincirlenir).
"""

import pymysql

from common.db import veritabani_baglantisi
from common.errors import DataAccessError
from models.anket_sonuc import (
    AnketAtamaSatiri,
    CevaplananSoru,
    KullaniciCevapKaynagi,
    VerilenCevap,
)
from repositories import anket_sonuc_sorgulari as sorgular


def anket_atamalarini_getir(
    anket_id: int,
    gorunur_kullanici_kodu: str,
    gorunur_grup_id: int | None,
) -> list[AnketAtamaSatiri] | None:
    """Bir ankete atanmış kişileri, kişiye özel atama durumlarıyla döner.

    Liste ekranındaki "Atanan / Yanıtlayan Kullanıcı Sayısı" hücrelerinin arkasındaki
    kişi listesidir: kimin atandığı ve her birinin atama durumu (HAM AnketAtama.durum)
    döner. "Yanıtladı mı" bir iş kararıdır ve Service'e aittir -- burada türetilmez.

    GÖRÜNÜRLÜK KAPISI: önce anketin talep edene görünüp görünmediği sınanır; satır
    yoksa None döner (anket YOK ya da bu kişiye GÖRÜNMÜYOR; ayrımı yapılmaz, Service
    "bulunamadı"ya çevirir). Anket görünüyor ama kimse atanmamışsa BOŞ LİSTE döner --
    None ile karışmaz. Görünürlük parametreleri bir süzme girdisidir; bunların oturum
    sahibine ait olduğunu garanti etmek Service'in işidir.

    İki sorgu da TEK bağlantıda çalışır (kapı ile veri arasında bağlantı değişmez).
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                # Parametre sırası sorgudaki %s sırasıyla eşleşir: anket_id, sonra
                # görünürlük koşulunun (grup_id, sicil) sırası.
                imlec.execute(
                    sorgular.ANKET_GORUNUR_MU_SORGUSU,
                    (anket_id, gorunur_grup_id, gorunur_kullanici_kodu),
                )
                if imlec.fetchone() is None:
                    return None

                imlec.execute(sorgular.ANKET_ATAMALARI_SORGUSU, (anket_id,))
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Anket atamaları okunamadı.") from hata

    return [
        AnketAtamaSatiri(
            kullanici_kodu=satir["kullanici_kodu"],
            ad=satir["ad"],
            soyad=satir["soyad"],
            email=satir["email"],
            durum=satir["durum"],
            tamamlanma_tarihi=satir["tamamlanma_tarihi"],
        )
        for satir in satirlar
    ]


def kullanici_cevaplarini_getir(
    anket_id: int,
    kullanici_kodu: str,
    gorunur_kullanici_kodu: str,
    gorunur_grup_id: int | None,
) -> KullaniciCevapKaynagi | None:
    """Tek kişinin bir ankete verdiği cevapları, anketin sorularıyla birlikte döner.

    "Cevapları Gör" akışının veri kaynağıdır. İki kapı vardır ve ikisi de None üretir:
    (1) anket talep edene görünmüyorsa (ya da yoksa); (2) `kullanici_kodu` bu ankete
    atanmamışsa (atama satırı yok -> cevabı da olamaz). Ayrım yapılmaz; "bulunamadı"
    yorumu Service'e aittir. Atanmış ama hiç cevap vermemiş kişide cevaplar boş liste
    döner (None ile karışmaz).

    Kişinin bu anketteki atama durumu (HAM AnketAtama.durum) da taşınır: kişi anketi
    tamamlamadan bırakmışsa gösterilen cevaplar KISMİ olabilir; bunu yorumlamak
    (ör. "tamamlanmamış" notu) Service'in işidir -- burada karar verilmez.

    Sorular, CEVAPLAMA ekranının kullandığı sorgudan (ANKET_DOLDUR_SORULARI_SORGUSU)
    okunur: gösterilen soru kümesi cevaplanabilir kümeyle birebir aynı olsun diye
    (grid dışlanır) sorgu kopyalanmaz. Cevaplar tek sorguda, seçilen şıkkın metniyle
    birlikte çekilir -- N+1 YOK. Soru↔cevap eşleştirmesi ve sanitizasyon Service'te.

    Tüm okumalar TEK bağlantıda yapılır; görünürlük parametreleri süzme girdisidir
    (yetki kararı Service'te).
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    sorgular.ANKET_GORUNUR_MU_SORGUSU,
                    (anket_id, gorunur_grup_id, gorunur_kullanici_kodu),
                )
                if imlec.fetchone() is None:
                    return None

                # Cevaplar atamaya bağlıdır: atama yoksa kişi bu ankete atanmamıştır.
                imlec.execute(
                    sorgular.ATAMA_ID_GETIR_SORGUSU, (anket_id, kullanici_kodu)
                )
                atama_satiri = imlec.fetchone()
                if atama_satiri is None:
                    return None

                imlec.execute(sorgular.ANKET_DOLDUR_SORULARI_SORGUSU, (anket_id,))
                soru_satirlari = imlec.fetchall()

                imlec.execute(
                    sorgular.KULLANICI_CEVAPLARI_SORGUSU,
                    (atama_satiri["atama_id"],),
                )
                cevap_satirlari = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Kullanıcı cevapları okunamadı.") from hata

    return KullaniciCevapKaynagi(
        atama_durum=atama_satiri["durum"],
        sorular=[
            CevaplananSoru(
                soru_id=satir["soru_id"],
                soru_metni=satir["soru_metni"],
                soru_tipi=satir["soru_tipi"],
            )
            for satir in soru_satirlari
        ],
        cevaplar=[
            VerilenCevap(
                soru_id=satir["soru_id"],
                secenek_metni=satir["secenek_metni"],
                cevap_metni=satir["cevap_metni"],
            )
            for satir in cevap_satirlari
        ],
    )

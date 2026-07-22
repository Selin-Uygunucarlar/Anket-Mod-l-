"""Anket doldurma (cevaplama) iş katmanı.

Neden ayrı dosya: anket_service.py 500 satır sınırına yakın olduğundan cevaplama
akışının iş kuralları buraya alındı (SRP + dosya boyutu). Bu uç bir YÖNETİM ucu
DEĞİLDİR: yetki, kullanici_turu (admin/user) ile değil SAHİPLİK ile belirlenir --
anketin bu kullanıcıya ATANMIŞ olması yeter. Sicil client'tan ALINMAZ, oturum
sahibinden (OturumSahibi) geçirilir; kimse başkasının anketini okuyamaz/gönderemez
(IDOR'a kapalı). Görünmeyen/atanmamış anket NotFoundError ile "yok" gibi ele alınır
(varlık sızmaz).

Sorumluluk: (1) anketi cevaplanmaya hazır, metinleri sanitize edilmiş görünümüyle
döner; (2) gelen cevapları -- otoriteyi DB'den YENİDEN okuyarak, client'a güvenmeden --
iş kurallarına göre doğrulayıp Cevap satırlarına çevirir ve kaydettirir.

İş kuralları: anket 'Aktif' olmalı ve bugün başlangıç-bitiş penceresinde olmalı --
bu kural İKİ AKIŞIN ORTAĞIDIR (_bul_cevaplama_engeli): görüntülemede sağlanmıyorsa
anket "yok" sayılır (NotFoundError; pasif/süresi geçmiş anketin formu doğrudan URL
ile de açılmaz), gönderimde BusinessRuleError olur. Atamanın tamamlanmamış olması
YALNIZCA gönderim koşuludur; tamamlanmış anket salt-okunur görüntülenebilir
(tamamlandi_mi). Ayrıca her cevaplanan soru ankete ait olmalı, her seçilen şık o
sorunun şık kümesinde olmalı (aidiyet/enjeksiyon koruması), soru tipine göre kardinalite
tutmalı ve zorunlu sorular cevaplanmış olmalı. Yorum metni okuma değil YAZMA sınırında
da temizle_html ile sanitize edilir.

Bu katman HTTP ve SQL bilmez; veriye Repository üzerinden erişir. Hatalar burada
LOGLANMAZ, yukarı fırlatılır; loglama yalnızca sınır katmanında bir kez yapılır.
"""

import dataclasses
from datetime import datetime

from common.errors import BusinessRuleError, NotFoundError, ValidationError
from common.html_temizle import temizle_html
from models.anket_doldur import (
    AnketDoldurGorunumu,
    AnketDoldurKaynak,
    CevapGirdisi,
    DoldurSoru,
)
from models.oturum import OturumSahibi
from repositories import anket_doldur_repository
from repositories.anket_sorgulari import ATAMA_TAMAMLANDI_DURUMU

# Anketin cevaplanabilmesi için gereken yaşam döngüsü durumu (Anket.durum). Kişiye
# özel AnketAtama.durum ile KARIŞTIRILMAZ: bu, anketin genel durumudur.
_AKTIF_DURUM = "Aktif"

# Soru tipi slug'ları (frontend ile birebir). Tekil seçim tiplerinde tam BİR şık
# seçilir; çoklu seçimde >=1; yorumda serbest metin. grid bu turda YOK (Repository
# zaten dışlar), bu yüzden burada da yer almaz.
_TEKIL_SECIM_TIPLERI = frozenset(
    {"coktan_secmeli_tek", "evet_hayir", "skala_5", "listeden_secmeli"}
)
_COKLU_SECIM_TIPI = "coktan_secmeli_coklu"
_YORUM_TIPI = "yorum"


def get_anket_doldur(talep_eden: OturumSahibi, anket_id: int) -> AnketDoldurGorunumu:
    """Anketi cevaplama ekranı için metinleri sanitize edilmiş görünümüyle döner.

    Sahiplik kapısı: anket talep edene ATANMIŞ değilse Repository None döner; bu
    "yok" olarak ele alınır (NotFoundError -> varlık sızmaz). Anket pasifse ya da
    cevaplama penceresi dışındaysa da AYNI şekilde "yok" sayılır (doldurulamayacak
    form açılmaz). Admin/user ayrımı YOKTUR; sicil oturumdan gelir (IDOR'a kapalı).
    Atama tamamlanmış olsa bile görünüm DÖNER (salt okunur). Soru ve şık metinleri okuma
    sınırında temizle_html ile temizlenir (frontend HTML olarak render eder).
    tamamlandi_mi, kişiye özel atamanın tamamlanıp tamamlanmadığıdır. Hata loglanmaz,
    YUKARI FIRLAR.
    """
    kaynak = anket_doldur_repository.anket_doldur_kaynak_getir(
        anket_id, talep_eden.kullanici_kodu
    )
    if kaynak is None:
        raise NotFoundError("Anket bulunamadı.")
    # Pasife alınmış ya da süresi dışındaki anketin FORMU da açılmaz: doğrudan URL
    # ile gelinse bile "yok" gibi ele alınır (boşuna doldurulacak form açılmaz,
    # anketin varlığı sızmaz). Kural gonder_anket ile TEK yerden paylaşılır.
    if _bul_cevaplama_engeli(kaynak) is not None:
        raise NotFoundError("Anket bulunamadı.")

    return AnketDoldurGorunumu(
        anket_id=kaynak.anket_id,
        ad=kaynak.ad,
        on_yazi=kaynak.on_yazi,
        son_yazi=kaynak.son_yazi,
        tamamlandi_mi=kaynak.atama_durum == ATAMA_TAMAMLANDI_DURUMU,
        sorular=[_sanitize_soru(soru) for soru in kaynak.sorular],
    )


def gonder_anket(
    talep_eden: OturumSahibi, anket_id: int, cevaplar: list[CevapGirdisi]
) -> None:
    """Kullanıcının anket cevaplarını doğrulayıp kaydeder; atamayı tamamlandı yapar.

    Otorite client'a GÜVENİLMEDEN DB'den yeniden okunur (get sırasındaki görünüme
    dayanılmaz). Sahiplik kapısı None -> NotFoundError. Gönderim iş kuralları
    (aktiflik, tarih penceresi, atama zaten tamamlanmış mı) doğrulanır; ardından
    cevaplar kaynağa göre doğrulanıp Cevap satırlarına çevrilir ve tek transaction'da
    kaydettirilir. Herhangi bir ihlalde ValidationError/BusinessRuleError fırlar
    (loglanmaz, yukarı çıkar).
    """
    kaynak = anket_doldur_repository.anket_doldur_kaynak_getir(
        anket_id, talep_eden.kullanici_kodu
    )
    if kaynak is None:
        raise NotFoundError("Anket bulunamadı.")

    _dogrula_gonderim_kosullari(kaynak)
    cevap_satirlari = _dogrula_ve_uret_satirlar(kaynak, cevaplar)

    anket_doldur_repository.cevaplari_kaydet(
        kaynak.atama_id, cevap_satirlari, datetime.now()
    )


def _sanitize_soru(soru: DoldurSoru) -> DoldurSoru:
    """Bir sorunun ve şıklarının HAM metinlerini XSS'e karşı temizler (okuma sınırı).

    soru_metni ve secenek_metni biçimli HAM HTML'dir; frontend onları HTML olarak
    render ettiğinden okuma yolunda sanitize edilir (defense-in-depth). Diğer alanlar
    (tip, zorunluluk, sıra, kimlikler) düz veridir, dokunulmaz.
    """
    temiz_secenekler = [
        dataclasses.replace(secenek, secenek_metni=temizle_html(secenek.secenek_metni))
        for secenek in soru.secenekler
    ]
    return dataclasses.replace(
        soru, soru_metni=temizle_html(soru.soru_metni), secenekler=temiz_secenekler
    )


def _dogrula_gonderim_kosullari(kaynak: AnketDoldurKaynak) -> None:
    """Cevap göndermenin ön koşullarını (atama durumu + anketin cevaplanabilirliği)
    doğrular.

    Bunlar girdi hatası değil DURUM/İŞ KURALI ihlalleridir (BusinessRuleError): atama
    zaten tamamlanmışsa yeniden gönderilemez. "Tamamlanmışlık" YALNIZCA gönderime
    özgüdür; tamamlanmış anket salt-okunur GÖRÜNTÜLENEBİLİR olduğundan ortak kurala
    KONMAZ. Anketin aktifliği/tarih penceresi ise görüntüleme ile paylaşılan kuraldır
    (_bul_cevaplama_engeli); engel metni burada BusinessRuleError'a çevrilir.
    """
    if kaynak.atama_durum == ATAMA_TAMAMLANDI_DURUMU:
        raise BusinessRuleError("Bu anketi zaten tamamladınız.")

    engel = _bul_cevaplama_engeli(kaynak)
    if engel is not None:
        raise BusinessRuleError(engel)


def _bul_cevaplama_engeli(kaynak: AnketDoldurKaynak) -> str | None:
    """Anketin cevaplanmasını engelleyen durumu bulur; engel yoksa None döner.

    Neden ortak: aynı kural hem doldurma EKRANINI açarken hem cevap GÖNDERİRKEN
    geçerlidir; iki yere kopyalanmaması için tek yerde toplanır. Kural: anket 'Aktif'
    olmalı ve şu an başlangıç-bitiş penceresinde olmalı. Hata TİPİ burada seçilmez
    (çağıran görüntülemede NotFoundError, gönderimde BusinessRuleError fırlatır);
    dönen metin kullanıcıya gösterilebilir güvenli bir mesajdır.
    """
    if kaynak.durum != _AKTIF_DURUM:
        return "Bu anket şu anda cevaplanamaz."
    if not _bugun_pencerede_mi(kaynak.baslangic_tarihi, kaynak.bitis_tarihi):
        return "Bu anketin cevaplama süresi dışındasınız."
    return None


def _bugun_pencerede_mi(
    baslangic: datetime | None, bitis: datetime | None
) -> bool:
    """Şu anın anketin başlangıç-bitiş penceresinde olup olmadığını söyler.

    NULL sınır o yönde kısıt getirmez; her iki sınır da varsa [başlangıç, bitiş]
    kapalı aralığı esas alınır.
    """
    su_an = datetime.now()
    if baslangic is not None and su_an < baslangic:
        return False
    if bitis is not None and su_an > bitis:
        return False
    return True


def _dogrula_ve_uret_satirlar(
    kaynak: AnketDoldurKaynak, cevaplar: list[CevapGirdisi]
) -> list[tuple]:
    """Cevapları kaynağa göre doğrular ve Cevap satır tuple'larına çevirir.

    Her cevabın soru_id'si ankete ait olmalı ve aynı soru iki kez gönderilmemeli
    (client'a güvenilmez). Soru tipine göre kardinalite/şık aidiyeti doğrulanır ve
    o soru için satırlar üretilir; boş/atlanan (zorunsuz, cevapsız) sorular satır
    üretmez. Son olarak ZORUNLU sorular cevaplanmış olmalıdır. Üretilen her tuple:
    (soru_id, secilen_secenek_id | None, cevap_metni | None).
    """
    soru_haritasi = {soru.soru_id: soru for soru in kaynak.sorular}
    izinli_secenek_haritasi = {
        soru.soru_id: {secenek.secenek_id for secenek in soru.secenekler}
        for soru in kaynak.sorular
    }

    satirlar: list[tuple] = []
    cevaplanan_soru_idler: set[int] = set()
    gorulen_soru_idler: set[int] = set()

    for girdi in cevaplar:
        soru = soru_haritasi.get(girdi.soru_id)
        if soru is None:
            raise ValidationError("Ankette olmayan bir soru cevaplanamaz.")
        if girdi.soru_id in gorulen_soru_idler:
            raise ValidationError("Bir soru birden fazla kez cevaplanamaz.")
        gorulen_soru_idler.add(girdi.soru_id)

        soru_satirlari = _uret_soru_satirlari(
            soru, girdi, izinli_secenek_haritasi[girdi.soru_id]
        )
        if soru_satirlari:
            cevaplanan_soru_idler.add(girdi.soru_id)
            satirlar.extend(soru_satirlari)

    _dogrula_zorunlu_cevaplandi(kaynak.sorular, cevaplanan_soru_idler)
    return satirlar


def _uret_soru_satirlari(
    soru: DoldurSoru, girdi: CevapGirdisi, izinli_secenek_idler: set[int]
) -> list[tuple]:
    """Tek bir soru için cevabı doğrulayıp Cevap satırlarını üretir (tipe göre).

    Seçim tipleri ile yorum tipi farklı doğrulama gerektirir; ortak olmadıklarından
    (yanlış DRY'dan kaçınmak için) ayrı yardımcılara devredilir. Cevapsız (boş) girdi
    boş liste döndürür; zorunluluk kararı çağırana aittir.
    """
    if soru.soru_tipi == _YORUM_TIPI:
        return _uret_yorum_satirlari(soru, girdi)
    if soru.soru_tipi in _TEKIL_SECIM_TIPLERI or soru.soru_tipi == _COKLU_SECIM_TIPI:
        return _uret_secim_satirlari(soru, girdi, izinli_secenek_idler)
    # Kaynak yalnızca bu turdaki 6 tipi taşır (grid dışlanır); buraya düşülmesi veri
    # tutarsızlığıdır. Sessizce atlanmaz; anlamlı hata verilir.
    raise ValidationError("Desteklenmeyen soru tipi.")


def _uret_secim_satirlari(
    soru: DoldurSoru, girdi: CevapGirdisi, izinli_secenek_idler: set[int]
) -> list[tuple]:
    """Seçim tipli bir soru için seçilen şıkları doğrulayıp satır üretir.

    Seçim sorusuna metin cevabı gönderilemez. Aynı şık iki kez seçilemez ve seçilen
    her şık o sorunun izinli kümesinde OLMALIDIR (aidiyet/enjeksiyon koruması; client'a
    güvenilmez). Tekil tipte en fazla bir şık seçilebilir. Hiç şık seçilmemişse cevapsız
    sayılır (boş liste). Üretilen satırlar: (soru_id, secenek_id, None).
    """
    if girdi.cevap_metni is not None and girdi.cevap_metni.strip():
        raise ValidationError("Seçim sorusuna metin cevabı gönderilemez.")

    secenek_idler = girdi.secenek_idler
    if len(set(secenek_idler)) != len(secenek_idler):
        raise ValidationError("Aynı şık birden fazla kez seçilemez.")
    for secenek_id in secenek_idler:
        if secenek_id not in izinli_secenek_idler:
            raise ValidationError("Geçersiz şık seçimi.")

    if soru.soru_tipi in _TEKIL_SECIM_TIPLERI and len(secenek_idler) > 1:
        raise ValidationError("Bu soru için yalnızca bir şık seçilebilir.")

    return [(soru.soru_id, secenek_id, None) for secenek_id in secenek_idler]


def _uret_yorum_satirlari(soru: DoldurSoru, girdi: CevapGirdisi) -> list[tuple]:
    """Yorum tipli bir soru için serbest metni doğrulayıp sanitize edip satır üretir.

    Yorum sorusuna şık seçimi gönderilemez. Metin YAZMA sınırında temizle_html ile
    temizlenir; sanitize sonrası görünür içerik kalmıyorsa cevapsız sayılır (boş liste).
    Üretilen satır: (soru_id, None, temiz_metin).
    """
    if girdi.secenek_idler:
        raise ValidationError("Yorum sorusuna şık seçimi gönderilemez.")

    ham_metin = (girdi.cevap_metni or "").strip()
    if not ham_metin:
        return []
    temiz_metin = temizle_html(ham_metin)
    if not temiz_metin.strip():
        return []
    return [(soru.soru_id, None, temiz_metin)]


def _dogrula_zorunlu_cevaplandi(
    sorular: list[DoldurSoru], cevaplanan_soru_idler: set[int]
) -> None:
    """Zorunlu (zorunlu_mu) her sorunun cevaplanmış olduğunu doğrular; değilse hata.

    Cevaplanma, o soru için en az bir Cevap satırı üretilmiş olması demektir (seçim
    yapılmış ya da yorum metni boş değil). Zorunlu olmayan soru boş bırakılabilir.
    """
    for soru in sorular:
        if soru.zorunlu_mu and soru.soru_id not in cevaplanan_soru_idler:
            raise ValidationError("Zorunlu soruların tümü cevaplanmalıdır.")

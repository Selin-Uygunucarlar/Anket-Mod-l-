"""Anket soruları (ekleme + listeleme + silme) iş katmanı.

Neden: Soru ekleme/listeleme/silme bir YÖNETİM ucudur; yalnızca admin
çağırabilir. Yetki, client'tan gelen role değil, sunucu tarafı oturumun sahibine
(OturumSahibi) göre belirlenir. soru_metni biçimli HAM HTML olduğundan XSS'e karşı
SUNUCU TARAFI sanitizasyon (migration 007/009) burada, kayda/gösterime çıkmadan
önce yapılır. Ekleme akışında şık metinleri (secenek_metni) de artık BİÇİMLİ HTML
olduğundan (migration 009) aynı allowlist ile sanitize edilir.

Şık listesinin ANLAMI soru tipine göre değişir (kablo sözleşmesi list[str] aynı
kalır): evet_hayir'de client şıkları YOK SAYILIR, sunucu kanonik ["Evet","Hayır"]
kurar; skala_5'te client 2 uç ifade gönderir (sanitize edilir), sunucu ara
noktaları ekleyip [uc1,"2","3","4",uc5] kurar; diğer tiplerde her şık sanitize
edilen serbest listedir. Bu normalizasyon _secenekleri_tipe_gore_hazirla'da toplanır.

Bu katman HTTP ve SQL bilmez; veriye Repository üzerinden erişir. Hatalar burada
LOGLANMAZ, yukarı fırlatılır; loglama yalnızca sınır katmanında bir kez yapılır.
"""

import dataclasses
import html
import re

import nh3

from common.errors import NotFoundError, ValidationError, YetkiYokError
from models.oturum import OturumSahibi
from models.soru import SoruKaydi
from repositories import soru_repository

_ADMIN_TURU = "admin"

# Şık normalizasyonunda özel davranışa sahip tip kimlikleri (aşağıdaki kümenin
# üyeleri). Bu iki tip _secenekleri_tipe_gore_hazirla'da ayrı dallanır.
_EVET_HAYIR_TIPI = "evet_hayir"
_SKALA_5_TIPI = "skala_5"

# Bir sorunun alabileceği geçerli soru tipleri (iş kuralı sabiti). Frontend'in
# gösterdiği 7 tipin kimlikleriyle birebir; bu küme DIŞINDA bir tip reddedilir.
_GECERLI_SORU_TIPLERI = frozenset(
    {
        "coktan_secmeli_tek",
        "coktan_secmeli_coklu",
        _EVET_HAYIR_TIPI,
        _SKALA_5_TIPI,
        "listeden_secmeli",
        "yorum",
        "grid",
    }
)

# evet_hayir sorusu için sunucunun kurduğu KANONİK şık listesi. Client'tan gelen
# şık metinleri yok sayılır; bu iki değer sunucu sabitidir (kullanıcı girdisi
# değil) ve güvenli literal olduklarından sanitize gerektirmez.
_EVET_HAYIR_SECENEKLERI = ["Evet", "Hayır"]

# 5'li skalanın SUNUCU tarafından kurulan ara nokta etiketleri. Yalnızca iki uç
# ifade kullanıcı girdisidir (sanitize edilir); aradaki 2/3/4 düz metin
# sabitleridir ve sanitize gerektirmez.
_SKALA_ARA_NOKTALAR = ["2", "3", "4"]

# soru_metni sanitizasyonunun izinli etiket kümesi. Editör (SoruMetniKart) yalnızca
# document.execCommand ile biçim üretir: kalın/italik/altı çizili (b,strong,i,em,u),
# madde/numaralı liste (ul,ol,li), bağlantı (a), font boyutu/rengi (font),
# hizalama/renk (span/div/p üzerinde style) ve Enter'la oluşan blok/satır sonu
# (p,div,span,br). Bu kümenin DIŞINDA kalan her şey (script/style etiketi, img,
# iframe vb.) içerik korunarak etiketi sıyrılır; script gibi tehlikeli etiketlerin
# metni de zaten çalıştırılamaz hale gelir.
_IZINLI_ETIKETLER = {
    "b", "strong", "i", "em", "u",
    "ul", "ol", "li",
    "a",
    "p", "div", "span", "br",
    "font",
}

# Etiket bazında izinli nitelikler. Bunlar dışındaki tüm nitelikler (özellikle
# onerror/onclick gibi olay yakalayıcılar) düşürülür. style niteliği yalnızca
# _IZINLI_STIL_OZELLIKLERI ile CSS düzeyinde süzülür (aşağıya bakınız).
_IZINLI_NITELIKLER = {
    "a": {"href", "title"},
    "font": {"color", "size"},
    "span": {"style"},
    "div": {"style", "align"},
    "p": {"style", "align"},
    "li": {"style"},
    "ul": {"style"},
    "ol": {"style"},
}

# style niteliğinde İZİN VERİLEN CSS özellikleri. Editör yalnızca hizalama
# (text-align) ve yazı rengi (color) üretir; bunun dışındaki bildirimler (ör.
# position, background, url(...) içeren değerler) nh3 tarafından atılır. Böylece
# style niteliği tamamen yasaklanmadan güvenli tutulur.
_IZINLI_STIL_OZELLIKLERI = {"color", "text-align"}

# Bağlantılarda izinli URL şemaları. javascript: / data: gibi tehlikeli şemalar
# bu kümede olmadığından href'ten düşürülür (link protokolü güvenli kalır).
_IZINLI_URL_SEMALARI = {"http", "https", "mailto"}


def _sanitize_soru_metni(ham_html: str) -> str:
    """Bir sorunun HAM HTML metnini XSS'e karşı temizler (allowlist tabanlı).

    Yalnızca izinli etiket/nitelikler korunur; script/style etiketi, olay
    yakalayıcı nitelikler ve javascript: şemalı bağlantılar temizlenir. Editörün
    ürettiği biçimlendirme (kalın, liste, hizalama, renk, bağlantı) korunur.
    """
    return nh3.clean(
        ham_html,
        tags=_IZINLI_ETIKETLER,
        attributes=_IZINLI_NITELIKLER,
        filter_style_properties=_IZINLI_STIL_OZELLIKLERI,
        url_schemes=_IZINLI_URL_SEMALARI,
    )


def _sanitize_edilmis_bos_mu(sanitize_edilmis: str) -> bool:
    """Sanitize edilmiş HTML'in görünür metin taşıyıp taşımadığını doğrular.

    Neden: Kullanıcı yalnız boşluk/etiket (ör. "<p></p>", "&nbsp;") gönderip
    içerikmiş gibi kaydedememeli. Etiketler sıyrılıp HTML varlıkları çözülür;
    geriye yalnızca boşluk (nbsp dahil) kalıyorsa içerik boş sayılır. Bu bir
    DOĞRULAMA yardımcısıdır, yeniden sanitizasyon değildir (değer zaten güvenli).
    """
    metinsiz = re.sub(r"<[^>]+>", "", sanitize_edilmis)
    duz_metin = html.unescape(metinsiz).replace("\xa0", " ")
    return not duz_metin.strip()


def _sanitize_serbest_secenekler(secenek_metinleri: list[str]) -> list[str]:
    """Serbest şık listesindeki her metni XSS'e karşı sanitize eder; boş şıkkı reddeder.

    Neden: çoktan seçmeli/liste/grid/yorum tiplerinde şıklar KULLANICI girdisidir;
    her biri allowlist ile temizlenir ve sanitize sonrası görünür içerik taşımalıdır
    (yalnız boşluk/etiket -> reddedilir). Boş liste kabul edilir (açık uçlu soru).
    İhlalde ValidationError fırlatılır (loglanmaz, yukarı çıkar).
    """
    temiz_secenekler: list[str] = []
    for ham_secenek in secenek_metinleri:
        temiz_secenek = _sanitize_soru_metni(ham_secenek)
        if _sanitize_edilmis_bos_mu(temiz_secenek):
            raise ValidationError("Seçenek metni boş olamaz.")
        temiz_secenekler.append(temiz_secenek)
    return temiz_secenekler


def _hazirla_skala_secenekleri(secenek_metinleri: list[str]) -> list[str]:
    """5'li skala için iki uç ifadeyi doğrulayıp [uc1,'2','3','4',uc5] listesini kurar.

    Neden: Skala uçları (1 ve 5) KULLANICI girdisidir; sanitize edilir ve boş
    olamaz. Ara noktalar (2,3,4) bir İŞ KURALIDIR ve UI'da değil BURADA, sunucu
    tarafında eklenir. Tam olarak 2 uç beklenir; değilse ValidationError. İhlalde
    ValidationError fırlatılır (loglanmaz, yukarı çıkar).
    """
    if len(secenek_metinleri) != 2:
        raise ValidationError("5'li skala için 1 ve 5 uç ifadeleri gereklidir.")

    temiz_uclar: list[str] = []
    for ham_uc in secenek_metinleri:
        temiz_uc = _sanitize_soru_metni(ham_uc)
        if _sanitize_edilmis_bos_mu(temiz_uc):
            raise ValidationError("Skala uç ifadeleri boş olamaz.")
        temiz_uclar.append(temiz_uc)

    return [temiz_uclar[0], *_SKALA_ARA_NOKTALAR, temiz_uclar[1]]


def _secenekleri_tipe_gore_hazirla(
    soru_tipi: str, secenek_metinleri: list[str]
) -> list[str]:
    """Soru tipine göre şık listesini normalize/doğrular; kayda hazır list[str] döner.

    Neden: şıkkın ANLAMI tipe göre değişir (kablo sözleşmesi list[str] aynı kalır).
    evet_hayir: client değeri YOK SAYILIR, sunucu kanonik ['Evet','Hayır'] kurar.
    skala_5: client 2 uç ifade gönderir (sanitize), sunucu [uc1,'2','3','4',uc5]
    kurar. Diğer tipler: her şık sanitize + boş reddi (boş liste = açık uçlu).
    ekle_soru ve guncelle_soru bu TEK kuralı paylaşır (DRY). Yalnızca kullanıcı
    girdileri sanitize edilir; sunucu sabitleri (Evet/Hayır/2/3/4) gerektirmez.
    """
    if soru_tipi == _EVET_HAYIR_TIPI:
        return list(_EVET_HAYIR_SECENEKLERI)
    if soru_tipi == _SKALA_5_TIPI:
        return _hazirla_skala_secenekleri(secenek_metinleri)
    return _sanitize_serbest_secenekler(secenek_metinleri)


def _hazirla_soru_alanlari(
    soru_tipi: str,
    konu: str,
    amac: str,
    soru_metni_ham: str,
    secenek_metinleri: list[str],
) -> tuple[str, str, list[str]]:
    """Soru ekleme/güncelleme için ortak iş kuralı doğrulaması + XSS sanitizasyonu.

    Neden: ekle_soru ve guncelle_soru AYNI kurallara uyar; bu gerçek tekrar tek
    yerde toplanır (DRY). soru_tipi geçerli kümede olmalı; konu/amac dolu olmalı
    (TanimliSecenek'e karşı DOĞRULANMAZ, yalnız boş kontrolü). soru_metni HAM
    HTML'dir: sanitize edilir ve sanitize sonrası görünür içerik taşımalıdır (yalnız
    boşluk/etiket -> reddedilir). Şıklar TİPE GÖRE _secenekleri_tipe_gore_hazirla ile
    normalize edilir (evet_hayir kanonik, skala_5 uç+ara, diğerleri serbest). Yetki
    kontrolü BURADA DEĞİL, çağıran public fonksiyondadır (admin kontrolü doğrulamadan
    önce yapılır). Döner: (konu_temiz, amac_temiz, sanitize_soru_metni,
    hazir_secenekler). İhlalde ValidationError fırlatılır (loglanmaz, yukarı çıkar).
    """
    if soru_tipi not in _GECERLI_SORU_TIPLERI:
        raise ValidationError("Geçersiz soru tipi.")

    konu_temiz = (konu or "").strip()
    amac_temiz = (amac or "").strip()
    if not konu_temiz:
        raise ValidationError("Konu zorunludur.")
    if not amac_temiz:
        raise ValidationError("Amaç zorunludur.")

    soru_metni = _sanitize_soru_metni(soru_metni_ham)
    if _sanitize_edilmis_bos_mu(soru_metni):
        raise ValidationError("Soru metni boş olamaz.")

    secenekler = _secenekleri_tipe_gore_hazirla(soru_tipi, secenek_metinleri)

    return konu_temiz, amac_temiz, soru_metni, secenekler


def ekle_soru(
    talep_eden: OturumSahibi,
    soru_tipi: str,
    konu: str,
    amac: str,
    soru_metni_ham: str,
    secenek_metinleri: list[str],
) -> int:
    """BAĞIMSIZ (ankete bağlı olmayan) yeni bir soru ekler; yeni soru_id döner.

    Yalnızca admin çağırabilir (talep_eden'e göre; client'tan gelen role/id'ye
    güvenilmez). İş kuralları (tip kümesi, konu/amac dolu, XSS sanitizasyonu +
    boş-içerik kontrolü) _hazirla_soru_alanlari'nda ortaktır (guncelle_soru ile
    paylaşılır). hazirlayan_kodu OTURUMDAN alınır. anket_id=None (bağımsız),
    sira_no=None, zorunlu_mu=False sabit geçilir. Hata burada loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    konu_temiz, amac_temiz, soru_metni, secenekler = _hazirla_soru_alanlari(
        soru_tipi, konu, amac, soru_metni_ham, secenek_metinleri
    )

    return soru_repository.soru_ekle(
        anket_id=None,
        soru_metni=soru_metni,
        soru_tipi=soru_tipi,
        sira_no=None,
        zorunlu_mu=False,
        hazirlayan_kodu=talep_eden.kullanici_kodu,
        konu=konu_temiz,
        amac=amac_temiz,
        secenekler=secenekler,
    )


def _sanitize_soru_kaydi(soru: SoruKaydi) -> SoruKaydi:
    """Bir SoruKaydi'nin görünen HTML alanlarını okuma sınırında sanitize eder.

    soru_metni VE her şıkkın secenek_metni artık biçimli HTML'dir (migration 009);
    frontend bunları HTML olarak render ettiğinden ikisi de XSS'e karşı burada
    temizlenir. Bu defense-in-depth: yazma yolunda da sanitize edilir, ancak
    migration 009 ÖNCESİ eklenmiş eski/güvenilmez satırlar ve tek güven sınırı için
    okuma yolunda da uygulanır. sira_no ve diğer alanlar korunur (yalnız render için).
    """
    temiz_secenekler = [
        dataclasses.replace(
            secenek, secenek_metni=_sanitize_soru_metni(secenek.secenek_metni)
        )
        for secenek in soru.secenekler
    ]
    return dataclasses.replace(
        soru,
        soru_metni=_sanitize_soru_metni(soru.soru_metni),
        secenekler=temiz_secenekler,
    )


def list_sorular(talep_eden: OturumSahibi) -> list[SoruKaydi]:
    """Tüm anketlerin tüm sorularını döner; yalnızca admin çağırabilir.

    admin değilse veri erişimine geçilmeden YetkiYokError fırlatılır. Admin ise
    Repository'den sorular çekilir; her sorunun soru_metni HEM de her şıkkın
    secenek_metni HTML'i sunucu tarafında sanitize edilir (XSS). Seçenekler de
    biçimli HTML'dir; frontend HTML olarak render ettiğinden okuma sınırında
    temizlenir (defense-in-depth; eski/güvenilmez satırlar da kapsanır).
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    sorular = soru_repository.sorulari_getir()
    return [_sanitize_soru_kaydi(soru) for soru in sorular]


def sil_soru(talep_eden: OturumSahibi, soru_id: int) -> None:
    """Verilen soruyu siler; yalnızca admin çağırabilir. Silme idempotenttir.

    admin değilse veri erişimine geçilmeden YetkiYokError fırlatılır. Admin ise
    Repository'de silme yapılır; şıklar ve verilmiş cevaplar DB tarafında CASCADE
    ile birlikte gider. Kayıt yoksa da başarı sayılır (Repository sessizce döner).
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    soru_repository.soru_sil(soru_id)


def get_soru(talep_eden: OturumSahibi, soru_id: int) -> SoruKaydi:
    """Tek bir soruyu tüm alanları + şıklarıyla döner (düzenleme ön-doldurma için).

    Yalnızca admin çağırabilir; admin değilse veri erişimine geçilmeden
    YetkiYokError fırlatılır. Repository soru_getir None dönerse "bulunamadı" iş
    kararı burada verilir -> NotFoundError. Bulunan kaydın soru_metni ve her şıkkın
    secenek_metni okuma sınırında _sanitize_soru_kaydi ile sanitize edilir
    (defense-in-depth; list_sorular ile aynı üslup). Hata loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    soru = soru_repository.soru_getir(soru_id)
    if soru is None:
        raise NotFoundError("Soru bulunamadı.")
    return _sanitize_soru_kaydi(soru)


def guncelle_soru(
    talep_eden: OturumSahibi,
    soru_id: int,
    soru_tipi: str,
    konu: str,
    amac: str,
    soru_metni_ham: str,
    secenek_metinleri: list[str],
) -> None:
    """Var olan bir soruyu (metin/kategori/tip + şıklar) günceller.

    Yalnızca admin çağırabilir; admin değilse veri erişimine geçilmeden
    YetkiYokError. İş kuralları (tip kümesi, konu/amac dolu, XSS sanitizasyonu +
    boş-içerik kontrolü) ekle_soru ile ORTAK _hazirla_soru_alanlari'ndan geçer.
    Güncellemeden ÖNCE soru_repository.soru_getir ile varlık doğrulanır; kayıt yoksa
    NotFoundError (Repository soru_guncelle NotFound FIRLATMAZ, sessizce geçer).
    Sonra soru_guncelle sanitize edilmiş soru_metni + şık listesiyle çağrılır.
    anket_id/sira_no/zorunlu_mu/hazirlayan_kodu düzenlemeyle DEĞİŞMEZ. Hata loglanmaz,
    YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    konu_temiz, amac_temiz, soru_metni, secenekler = _hazirla_soru_alanlari(
        soru_tipi, konu, amac, soru_metni_ham, secenek_metinleri
    )

    if soru_repository.soru_getir(soru_id) is None:
        raise NotFoundError("Soru bulunamadı.")

    soru_repository.soru_guncelle(
        soru_id=soru_id,
        soru_metni=soru_metni,
        soru_tipi=soru_tipi,
        konu=konu_temiz,
        amac=amac_temiz,
        secenekler=secenekler,
    )

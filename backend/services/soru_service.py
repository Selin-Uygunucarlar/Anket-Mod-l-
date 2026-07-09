"""Anket soruları (listeleme + silme) iş katmanı.

Neden: Soru listeleme ve tek soru silme bir YÖNETİM ucudur; yalnızca admin
çağırabilir. Yetki, client'tan gelen role değil, sunucu tarafı oturumun sahibine
(OturumSahibi) göre belirlenir. Ayrıca listeleme akışında her sorunun soru_metni
biçimli HAM HTML olduğundan, XSS'e karşı SUNUCU TARAFI sanitizasyon (migration 007
zorunluluğu) burada, gösterime/kayda çıkmadan önce yapılır. secenek_metni düz
metindir; sanitize EDİLMEZ.

Bu katman HTTP ve SQL bilmez; veriye Repository üzerinden erişir. Hatalar burada
LOGLANMAZ, yukarı fırlatılır; loglama yalnızca sınır katmanında bir kez yapılır.
"""

import dataclasses

import nh3

from common.errors import YetkiYokError
from models.oturum import OturumSahibi
from models.soru import SoruKaydi
from repositories import soru_repository

_ADMIN_TURU = "admin"

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


def list_sorular(talep_eden: OturumSahibi) -> list[SoruKaydi]:
    """Tüm anketlerin tüm sorularını döner; yalnızca admin çağırabilir.

    admin değilse veri erişimine geçilmeden YetkiYokError fırlatılır. Admin ise
    Repository'den sorular çekilir ve her sorunun soru_metni HTML'i sunucu tarafında
    sanitize edilir (XSS); sanitize edilmiş metinle SoruKaydi kopyası döndürülür.
    secenek_metni düz metin olduğundan olduğu gibi bırakılır.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    sorular = soru_repository.sorulari_getir()
    return [
        dataclasses.replace(soru, soru_metni=_sanitize_soru_metni(soru.soru_metni))
        for soru in sorular
    ]


def sil_soru(talep_eden: OturumSahibi, soru_id: int) -> None:
    """Verilen soruyu siler; yalnızca admin çağırabilir. Silme idempotenttir.

    admin değilse veri erişimine geçilmeden YetkiYokError fırlatılır. Admin ise
    Repository'de silme yapılır; şıklar ve verilmiş cevaplar DB tarafında CASCADE
    ile birlikte gider. Kayıt yoksa da başarı sayılır (Repository sessizce döner).
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    soru_repository.soru_sil(soru_id)

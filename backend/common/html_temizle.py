"""Biçimli (zengin metin) HTML alanları için ortak XSS sanitizasyon yardımcısı.

Neden: Projede birden fazla Service (soru_service, anket_service) editörden gelen
biçimli HTML metinlerini (soru_metni, şık metinleri) hem YAZMA hem OKUMA sınırında
temizlemek zorundadır (defense-in-depth). Bu allowlist yapılandırması TEK bir güven
sınırıdır ve iki farklı Service'e KOPYALANMAMALIDIR; bu yüzden katmandan bağımsız
Common katmanında toplanır.

Bu bir GÜVENLİK yardımcısıdır, iş kuralı DEĞİLDİR: hangi etiket/nitelik/şema izinli
diye karar verir; "boş içerik reddi", "şık kuralı" gibi iş kararları ilgili Service'te
kalır. Burada yalnızca temizleme yapılır; hata fırlatılmaz (temiz metin döner).
"""

import nh3

# İzinli etiket kümesi. Editör (SoruMetniKart) yalnızca document.execCommand ile
# biçim üretir: kalın/italik/altı çizili (b,strong,i,em,u), madde/numaralı liste
# (ul,ol,li), bağlantı (a), font boyutu/rengi (font), hizalama/renk (span/div/p style)
# ve Enter'la oluşan blok/satır sonu (p,div,span,br). Bu kümenin DIŞINDA kalan her şey
# (script/style etiketi, img, iframe vb.) içerik korunarak etiketi sıyrılır; script
# gibi tehlikeli etiketlerin metni de zaten çalıştırılamaz hale gelir.
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


def temizle_html(ham_html: str) -> str:
    """Bir HAM HTML metnini XSS'e karşı allowlist tabanlı temizler; güvenli HTML döner.

    Yalnızca izinli etiket/nitelikler korunur; script/style etiketi, olay yakalayıcı
    nitelikler ve javascript: şemalı bağlantılar temizlenir. Editörün ürettiği
    biçimlendirme (kalın, liste, hizalama, renk, bağlantı) korunur. Bu yardımcı iş
    kararı vermez; içerik boş mu / şık kuralı gibi kontroller çağıran Service'e aittir.
    """
    return nh3.clean(
        ham_html,
        tags=_IZINLI_ETIKETLER,
        attributes=_IZINLI_NITELIKLER,
        filter_style_properties=_IZINLI_STIL_OZELLIKLERI,
        url_schemes=_IZINLI_URL_SEMALARI,
    )

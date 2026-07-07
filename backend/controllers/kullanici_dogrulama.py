"""Kullanıcı ekleme gövdesinin tip/biçim doğrulaması (Controller sınır yardımcıları).

Neden: Girdi doğrulaması Controller'ın sorumluluğudur. Bu modül, HTTP gövdesinden
gelen ham alanların beklenen VERİ TİPİNDE ve BİÇİMDE olduğunu sınırda doğrular
(ör. sicil kodu yalnızca rakam). Böylece "ahöet" gibi hatalı biçimli değer daha
Service'e ulaşmadan reddedilir. İş kuralları (email regex, admin/user enum,
benzersizlik, yönetici var mı) buraya KONMAZ; onlar Service'te kalır (DRY).

Bu modül loglama yapmaz: uygun olmayan girdide ValidationError (güvenli, kullanıcı
dostu mesaj) YUKARI FIRLATILIR; sınırdaki try/except hatayı bir kez loglar.
Beklenen str alana sayı/dizi gelirse str() ile zorla stringleme YOK; isinstance
kontrolü yapılıp değilse hata fırlatılır.
"""

import re

from common.errors import ValidationError

# Sicil kodu (SAP no) biçimi: yalnızca rakam, 1-20 hane (DB VARCHAR(20) ile uyumlu).
_SICIL_DESENI = re.compile(r"^[0-9]{1,20}$")

# Alan uzunluk sınırları (DB kolon genişlikleriyle birebir).
_AD_SOYAD_MAX = 100
_EMAIL_MAX = 255
_OPSIYONEL_METIN_MAX = 100


def dogrula_sicil_kodu(deger, alan_adi: str, *, zorunlu: bool) -> str | None:
    """Sicil kodunu (kullanici_kodu / ilgili_yonetici_kodu) tip ve biçim olarak doğrular.

    Ortak kural (DRY): kırpılmış değer yalnızca rakamlardan oluşmalı ve 1-20 hane
    olmalı. str değilse tip hatası; opsiyonel ve boşsa None; biçim tutmuyorsa
    ValidationError. Bu tek yardımcı hem zorunlu (kullanici_kodu) hem opsiyonel
    (ilgili_yonetici_kodu) kod için kullanılır.
    """
    if deger is None:
        if zorunlu:
            raise ValidationError(f"{alan_adi} zorunludur.")
        return None
    if not isinstance(deger, str):
        raise ValidationError(f"{alan_adi} yalnızca rakamlardan oluşmalıdır.")

    kirpilmis = deger.strip()
    if not kirpilmis:
        if zorunlu:
            raise ValidationError(f"{alan_adi} zorunludur.")
        return None
    if not _SICIL_DESENI.match(kirpilmis):
        raise ValidationError(
            f"{alan_adi} yalnızca rakamlardan oluşmalıdır (en fazla 20 hane)."
        )
    return kirpilmis


def dogrula_ad_soyad(deger, alan_adi: str) -> str:
    """Ad/soyad alanını doğrular: zorunlu str, rakam içermez, en fazla 100 karakter.

    str değilse tip hatası; boş/whitespace ise zorunlu hatası; rakam içeriyorsa veya
    100 karakteri aşıyorsa ValidationError. Ad/soyad kişi adıdır; rakam beklenmez.
    """
    if not isinstance(deger, str):
        raise ValidationError(f"{alan_adi} metin olmalıdır.")

    kirpilmis = deger.strip()
    if not kirpilmis:
        raise ValidationError(f"{alan_adi} zorunludur.")
    if any(karakter.isdigit() for karakter in kirpilmis):
        raise ValidationError(f"{alan_adi} rakam içeremez.")
    if len(kirpilmis) > _AD_SOYAD_MAX:
        raise ValidationError(f"{alan_adi} en fazla {_AD_SOYAD_MAX} karakter olabilir.")
    return kirpilmis


def dogrula_zorunlu_metin(deger, alan_adi: str, max_uzunluk: int | None = None) -> str:
    """Zorunlu bir metin alanını tip ve uzunluk olarak doğrular; içerik kuralı Service'te.

    str değilse tip hatası; boş/whitespace ise zorunlu hatası; max_uzunluk verilmiş
    ve aşılmışsa ValidationError. E-posta biçim regex'i ve kullanici_turu enum'u
    burada DEĞİL, Service iş kuralında kontrol edilir (DRY: aynı regex kopyalanmaz).
    """
    if not isinstance(deger, str):
        raise ValidationError(f"{alan_adi} metin olmalıdır.")

    kirpilmis = deger.strip()
    if not kirpilmis:
        raise ValidationError(f"{alan_adi} zorunludur.")
    if max_uzunluk is not None and len(kirpilmis) > max_uzunluk:
        raise ValidationError(f"{alan_adi} en fazla {max_uzunluk} karakter olabilir.")
    return kirpilmis


def dogrula_opsiyonel_metin(deger, alan_adi: str, max_uzunluk: int = _OPSIYONEL_METIN_MAX):
    """Opsiyonel bir metin alanını doğrular: boş -> None, str değilse hata, uzunluk sınırı.

    None veya boş/whitespace ise None döner (opsiyonel). Dolu ama str değilse tip
    hatası; max_uzunluk aşılırsa ValidationError. Dropdown (tanımlı seçenek) alanları
    için kullanılır; değerin gerçekten tanımlı olup olmadığı ayrı bir konudur.
    """
    if deger is None:
        return None
    if not isinstance(deger, str):
        raise ValidationError(f"{alan_adi} metin olmalıdır.")

    kirpilmis = deger.strip()
    if not kirpilmis:
        return None
    if len(kirpilmis) > max_uzunluk:
        raise ValidationError(f"{alan_adi} en fazla {max_uzunluk} karakter olabilir.")
    return kirpilmis


# E-posta zorunlu metin doğrulaması için uzunluk sınırı (Controller'ın kullanması için).
EMAIL_MAX_UZUNLUK = _EMAIL_MAX

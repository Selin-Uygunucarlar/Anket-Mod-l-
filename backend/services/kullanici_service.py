"""Kullanıcı yönetimi (admin kullanıcı listesi) iş katmanı.

Neden: Kullanıcı listeleme işleminin yetki iş kuralı burada uygulanır. Bu uç
YALNIZCA admin içindir; yetki kontrolü client'tan gelen role/id'ye değil, sunucu
tarafı oturumun sahibine (OturumSahibi) göre yapılır. Bu katman HTTP ve SQL
bilmez; veriye Repository üzerinden erişir, DB'ye doğrudan dokunmaz.

Hata yönetimi: Hatalar burada LOGLANMAZ, yukarı fırlatılır. Admin olmayan istek
için YetkiYokError döner (Repository ÇAĞRILMADAN); loglama yalnızca sınır
katmanında bir kez yapılır.
"""

import re
import secrets
from datetime import datetime

from common.errors import ValidationError, YetkiYokError
from common.guvenlik import hash_sifre
from models.kullanici_ozet import KullaniciOzet
from models.oturum import OturumSahibi
from repositories import kullanici_repository

_ADMIN_TURU = "admin"

# Yeni kullanıcının alabileceği kullanıcı türleri (rol/tür sabit kümesi).
_GECERLI_TURLER = ("admin", "user")

# Basit e-posta biçim kontrolü: '@' ve sonrasında '.' içeren makul bir adres.
# Ağır/RFC doğrulaması değildir; nihai doğruluk gönderim/kayıt anlamındadır.
_EMAIL_DESENI = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Yeni kullanıcı için üretilen geçici (tek kullanımlık) şifrenin entropi uzunluğu.
_GECICI_SIFRE_BAYT = 9

# create_kullanici'da veri dict'inden alınan opsiyonel string alanlar (boş -> None).
_OPSIYONEL_STR_ALANLAR = (
    "sirket",
    "grup",
    "bolum",
    "birim",
    "kadro_grubu",
    "kadro_unvani",
    "gorev_unvani",
    "arge_personeli",
    "personel_sigorta_is_yeri",
    "gorev_yeri",
)


def list_kullanicilar(talep_eden: OturumSahibi) -> list[KullaniciOzet]:
    """Tüm kullanıcıları güvenli özet olarak döner; yalnızca admin çağırabilir.

    Yetki, talep edenin (doğrulanmış oturum sahibi) kullanici_turu'ne göre
    belirlenir; admin değilse veri erişimine geçilmeden YetkiYokError fırlatılır.
    Admin ise Repository'den kullanıcı listesi döndürülür.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()
    return kullanici_repository.list_kullanicilar()


def create_kullanici(talep_eden: OturumSahibi, veri: dict) -> str:
    """Yeni kullanıcı oluşturur ve üretilen DÜZ geçici şifreyi döner (bir kez iletmek için).

    Yalnızca admin çağırabilir (talep_eden'e göre; client'tan gelen role güvenilmez).
    İş kuralları: zorunlu alanların dolu olması, kullanici_turu'nun geçerli olması,
    e-posta biçimi, kullanici_kodu/e-posta benzersizliği ve (verilmişse) belirtilen
    yöneticinin gerçekten var olması. Geçici şifre kriptografik güvenli üretilir,
    yalnızca bcrypt HASH'i DB'ye yazılır; DÜZ şifre yalnızca dönüş değeriyle bir kez
    iletilir. Düz şifre/hash asla loglanmaz. Hata burada loglanmaz, yukarı fırlatılır.

    veri sözlüğü (Controller'ın normalize ettiği): kullanici_kodu, ad, soyad, email,
    kullanici_turu (zorunlu str); ise_giris_tarihi (date | None); ilgili_yonetici_kodu
    ve diğer opsiyonel str alanlar (boş -> None).
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    kullanici_kodu = _zorunlu_alan(veri.get("kullanici_kodu"), "Kullanıcı kodu")
    ad = _zorunlu_alan(veri.get("ad"), "Ad")
    soyad = _zorunlu_alan(veri.get("soyad"), "Soyad")
    email = _zorunlu_alan(veri.get("email"), "E-posta")
    kullanici_turu = _zorunlu_alan(veri.get("kullanici_turu"), "Kullanıcı türü")

    if kullanici_turu not in _GECERLI_TURLER:
        raise ValidationError("Kullanıcı türü 'admin' veya 'user' olmalı.")
    if not _EMAIL_DESENI.match(email):
        raise ValidationError("Geçerli bir e-posta adresi giriniz.")

    # Benzersizlik ön kontrolü (nihai garanti DB PK/UNIQUE; admin ucu, enumerasyon önemsiz).
    if kullanici_repository.kullanici_kodu_var_mi(kullanici_kodu):
        raise ValidationError("Bu kullanıcı kodu zaten kayıtlı.")
    if kullanici_repository.email_var_mi(email):
        raise ValidationError("Bu e-posta zaten kayıtlı.")

    # Yönetici ilişkisi: verilmişse gerçek bir kullanıcıya işaret etmeli (yetim FK yok).
    ilgili_yonetici_kodu = _bos_ise_none(veri.get("ilgili_yonetici_kodu"))
    if ilgili_yonetici_kodu is not None and not kullanici_repository.yonetici_var_mi(
        ilgili_yonetici_kodu
    ):
        raise ValidationError("Belirtilen yönetici bulunamadı.")

    opsiyonel = {ad_: _bos_ise_none(veri.get(ad_)) for ad_ in _OPSIYONEL_STR_ALANLAR}

    # Geçici şifre: kriptografik güvenli üretilir; DB'ye yalnızca bcrypt HASH'i gider.
    duz_gecici_sifre = secrets.token_urlsafe(_GECICI_SIFRE_BAYT)
    sifre_hash = hash_sifre(duz_gecici_sifre)
    olusturma_tarihi = datetime.now()

    # Repository imza SIRASI kontratla birebir; keyword ile netleştirilir.
    kullanici_repository.create_kullanici(
        kullanici_kodu,
        ad,
        soyad,
        email,
        kullanici_turu,
        veri.get("ise_giris_tarihi"),
        ilgili_yonetici_kodu,
        opsiyonel["sirket"],
        opsiyonel["grup"],
        opsiyonel["bolum"],
        opsiyonel["birim"],
        opsiyonel["kadro_grubu"],
        opsiyonel["kadro_unvani"],
        opsiyonel["gorev_unvani"],
        opsiyonel["arge_personeli"],
        opsiyonel["personel_sigorta_is_yeri"],
        opsiyonel["gorev_yeri"],
        sifre_hash,
        True,
        olusturma_tarihi,
    )

    # Düz geçici şifre yalnızca çağırana (admin'e bir kez göstermek üzere) döner.
    return duz_gecici_sifre


def _zorunlu_alan(deger, alan_adi: str) -> str:
    """Zorunlu string alanı doğrular; boş/whitespace ise ValidationError fırlatır."""
    if not deger or not str(deger).strip():
        raise ValidationError(f"{alan_adi} zorunludur.")
    return str(deger).strip()


def _bos_ise_none(deger):
    """Opsiyonel string değeri normalize eder: boş/whitespace -> None, aksi halde strip'li."""
    if deger is None:
        return None
    kirpilmis = str(deger).strip()
    return kirpilmis if kirpilmis else None

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

from common.errors import (
    BusinessRuleError,
    NotFoundError,
    ValidationError,
    YetkiYokError,
)
from common.guvenlik import hash_sifre
from models.kullanici_detay import KullaniciDetay
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


def get_kullanici_detay(talep_eden: OturumSahibi, kullanici_kodu: str) -> KullaniciDetay:
    """Tek bir kullanıcının güvenli detayını döner; yalnızca admin çağırabilir.

    Yetki, talep edenin (doğrulanmış oturum sahibi) kullanici_turu'ne göre belirlenir;
    admin değilse veri erişimine geçilmeden YetkiYokError fırlatılır. kullanici_kodu
    boş/whitespace ise ValidationError; kayıt yoksa (Repository None döner) NotFoundError.
    Hata burada loglanmaz, YUKARI FIRLAR (loglama yalnızca sınır katmanında bir kez).
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    kod = _zorunlu_alan(kullanici_kodu, "Kullanıcı kodu")
    detay = kullanici_repository.get_kullanici_detay(kod)
    if detay is None:
        raise NotFoundError("Kullanıcı bulunamadı.")
    return detay


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

    # Ortak iş kuralları (create + güncelle ile DRY): tür enum, e-posta biçimi ve
    # (verilmişse) yönetici ilişkisinin gerçekliği. Doğrulanmış yönetici kodu döner.
    ilgili_yonetici_kodu = _dogrula_kullanici_is_kurallari(
        kullanici_turu, email, veri.get("ilgili_yonetici_kodu")
    )

    # Benzersizlik ön kontrolü (yalnızca create; nihai garanti DB PK/UNIQUE).
    if kullanici_repository.kullanici_kodu_var_mi(kullanici_kodu):
        raise ValidationError("Bu kullanıcı kodu zaten kayıtlı.")
    if kullanici_repository.email_var_mi(email):
        raise ValidationError("Bu e-posta zaten kayıtlı.")

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


def guncelle_kullanici(
    talep_eden: OturumSahibi, kullanici_kodu: str, veri: dict
) -> None:
    """Var olan bir kullanıcının bilgilerini (gerekirse sicilini) günceller.

    Yalnızca admin çağırabilir (talep_eden'e göre; client'tan gelen role güvenilmez).
    kullanici_kodu path'ten gelen MEVCUT sicildir; veri["kullanici_kodu"] ise İSTENEN
    (aynı ya da yeni) sicildir. İş kuralları create ile ortaktır (tür enum, e-posta
    biçimi, yönetici ilişkisi). Sicil değişimi yalnızca yeni sicil benzersizse VE
    kullanıcının bağlı kaydı yoksa yapılır; aksi halde reddedilir. Hata burada
    loglanmaz, YUKARI FIRLAR.

    veri sözlüğü (Controller'ın normalize ettiği): kullanici_kodu (istenen sicil), ad,
    soyad, email, kullanici_turu; ise_giris_tarihi (date | None); ilgili_yonetici_kodu
    ve diğer opsiyonel str alanlar (boş -> None).
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    eski_kod = _zorunlu_alan(kullanici_kodu, "Kullanıcı kodu")

    # Hedef kullanıcı gerçekten var mı? (aktiflik okuma varlık kontrolü olarak yeterli;
    # None -> kayıt yok). Kör güncelleme yapılmaz; olmayan sicile UPDATE etkisizdir.
    if kullanici_repository.get_kullanici_aktif(eski_kod) is None:
        raise NotFoundError("Kullanıcı bulunamadı.")

    # Zorunlu temel alanlar (create ile aynı guard) — Service kendi sınırında doğrular.
    _zorunlu_alan(veri.get("ad"), "Ad")
    _zorunlu_alan(veri.get("soyad"), "Soyad")
    email = _zorunlu_alan(veri.get("email"), "E-posta")
    kullanici_turu = _zorunlu_alan(veri.get("kullanici_turu"), "Kullanıcı türü")

    # Ortak iş kuralları (create ile DRY): tür enum, e-posta biçimi, yönetici ilişkisi.
    _dogrula_kullanici_is_kurallari(
        kullanici_turu, email, veri.get("ilgili_yonetici_kodu")
    )

    # E-posta çakışması: aynı e-posta BAŞKA bir kullanıcıya aitse reddet. Kişinin kendi
    # e-postası hariç tutulduğundan (eski_kod) e-posta değişmese de güvenle çalışır;
    # böylece DB UNIQUE'e düşüp genel 500 yerine net bir iş kuralı hatası döner.
    if kullanici_repository.email_baskasinda_var_mi(email, eski_kod):
        raise BusinessRuleError("Bu e-posta başka bir kullanıcıya ait.")

    yeni_kod = _zorunlu_alan(veri.get("kullanici_kodu"), "Kullanıcı kodu")
    sicil_degisecek = yeni_kod != eski_kod

    # Sicil değişimi ön kontrolleri: HERHANGİ bir yazma yapılmadan önce doğrulanır,
    # böylece reddedilen sicil değişiminde alanlar boşuna güncellenmiş olmaz.
    if sicil_degisecek:
        if kullanici_repository.kullanici_kodu_var_mi(yeni_kod):
            raise ValidationError("Bu kullanıcı kodu zaten kayıtlı.")
        if kullanici_repository.kullanici_bagimliligi_var_mi(eski_kod):
            raise BusinessRuleError(
                "Bu kullanıcının bağlı kayıtları olduğu için sicili değiştirilemez."
            )

    # SIRA + KISMİ BAŞARI: alan güncellemesi ile sicil değişimi iki AYRI transaction'dır
    # (tek transaction repo fonksiyonu istenmez). Önce alanlar ESKİ kodla yazılır, SONRA
    # sicil değişir. Neden bu sıra: ikinci adım (PK değişimi) patlarsa kayıt HÂLÂ orijinal
    # sicille adreslenebilir kalır ve işlem güvenle yeniden denenebilir. Ters sırada (önce
    # PK) ikinci adım patlarsa kayıt yeni sicile taşınmış olur ve orijinal path 404 verir.
    kullanici_repository.guncelle_kullanici(eski_kod, veri)
    if sicil_degisecek:
        kullanici_repository.guncelle_kullanici_kodu(eski_kod, yeni_kod)


def degistir_kullanici_aktiflik(talep_eden: OturumSahibi, kullanici_kodu: str) -> bool:
    """Kullanıcının aktiflik durumunu tersine çevirir; yeni durumu (bool) döner.

    Yalnızca admin çağırabilir; yetki client'tan gelen role değil, doğrulanmış
    oturum sahibine göre belirlenir (admin değil -> YetkiYokError, Repository
    ÇAĞRILMADAN). kullanici_kodu boş/whitespace -> ValidationError; kayıt yok
    (Repository None döner) -> NotFoundError. Kendini pasife alma engellenir
    (bir admin kendi hesabını erişilemez kılamaz). Hata burada loglanmaz,
    YUKARI FIRLAR (loglama yalnızca sınır katmanında bir kez).
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    kod = _zorunlu_alan(kullanici_kodu, "Kullanıcı kodu")
    mevcut = kullanici_repository.get_kullanici_aktif(kod)
    if mevcut is None:
        raise NotFoundError("Kullanıcı bulunamadı.")

    yeni_aktif = not mevcut
    # Kendini pasife alma engeli: admin, kendi hesabını erişilemez hale getiremez.
    if kod == talep_eden.kullanici_kodu and yeni_aktif is False:
        raise ValidationError("Kendi hesabınızı pasife alamazsınız.")

    kullanici_repository.set_kullanici_aktif(kod, yeni_aktif)
    return yeni_aktif


def _dogrula_kullanici_is_kurallari(
    kullanici_turu: str, email: str, ham_yonetici_kodu
) -> str | None:
    """Create + güncelle için ORTAK iş kuralı doğrulaması (DRY).

    Kurallar: kullanici_turu geçerli kümede olmalı (admin/user); e-posta biçimi
    geçerli olmalı; verilmişse ilgili_yonetici_kodu gerçek bir kullanıcıya işaret
    etmeli (yetim FK yok). Doğrulanmış (boş -> None) ilgili_yonetici_kodu döner.
    Benzersizlik/varlık ön kontrolleri çağırana özgüdür; buraya konmaz.
    """
    if kullanici_turu not in _GECERLI_TURLER:
        raise ValidationError("Kullanıcı türü 'admin' veya 'user' olmalı.")
    if not _EMAIL_DESENI.match(email):
        raise ValidationError("Geçerli bir e-posta adresi giriniz.")

    ilgili_yonetici_kodu = _bos_ise_none(ham_yonetici_kodu)
    if ilgili_yonetici_kodu is not None and not kullanici_repository.yonetici_var_mi(
        ilgili_yonetici_kodu
    ):
        raise ValidationError("Belirtilen yönetici bulunamadı.")
    return ilgili_yonetici_kodu


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

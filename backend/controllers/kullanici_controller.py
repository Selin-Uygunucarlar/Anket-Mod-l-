"""Kullanıcı yönetimi (admin kullanıcı listesi) Controller katmanı — ince sınır.

Neden: Oturum doğrulaması (kimlik), Service çağrısı ve response dönüşümü burada
orkestre edilir. İş kuralı İÇERMEZ (yetki/rol kararı kullanici_service'te, oturum
mantığı oturum_service'te); SQL/DB detayı bilmez.

Sınır (boundary) sorumluluğu: Bu katman error pipeline'ın giriş noktasıdır. Hata
burada BİR KEZ loglanır ve kullanıcıya güvenli yanıt döner. Stack trace, ham DB
hatası, tablo adı ve hassas alan ASLA yanıta konmaz. datetime alanları JSON'a
uygun ISO 8601 string'e (ya da None) çevrilir; gösterim/locale frontend'in işidir.
"""

from datetime import datetime

from common.errors import AppError, ValidationError
from common.logger import logla_sinir_hatasi
from controllers.kullanici_dogrulama import (
    EMAIL_MAX_UZUNLUK,
    dogrula_ad_soyad,
    dogrula_opsiyonel_metin,
    dogrula_sicil_kodu,
    dogrula_zorunlu_metin,
)
from models.kullanici_detay import KullaniciDetay
from models.kullanici_ozet import KullaniciOzet
from services import kullanici_service, oturum_service

# Kullanıcı ekleme gövdesindeki opsiyonel dropdown (tanımlı seçenek) alanları.
# Her biri doluysa str olmalı ve <=100 karakter; boş string -> None.
_OPSIYONEL_DROPDOWN_ALANLAR = (
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


def list_kullanicilar(ham_jeton: str) -> dict:
    """Oturumu doğrulanmış admin için tüm kullanıcıların güvenli listesini döndürür.

    Cookie'den gelen ham jetonu oturum_service ile doğrular (geçersiz/boş oturum ->
    OturumError). Ardından yetki kararı kullanici_service'e bırakılır (admin değilse
    YetkiYokError). Her iki durumda da hata BİR KEZ loglanır ve güvenli yanıt döner.

    Başarılı: {"basari": True, "kullanicilar": [ {...}, ... ]}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "kullanici_listesi"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        ozetler = kullanici_service.list_kullanicilar(sahip)
        return _basari_yaniti(ozetler)
    except AppError as hata:
        # Tanımlı kod/severity ile bir kez loglanır; kullanıcıya güvenli mesaj.
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        # Beklenmeyen hata: CRITICAL loglanır, kullanıcıya genel güvenli mesaj.
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def get_kullanici_detay(ham_jeton: str, kullanici_kodu: str) -> dict:
    """Oturumu doğrulanmış admin için tek bir kullanıcının güvenli detayını döndürür.

    Cookie'den gelen ham jetonu oturum_service ile doğrular (geçersiz/boş oturum ->
    OturumError). Yetki (yalnızca admin) kararı ve kayıt bulunamadı durumu
    kullanici_service'e bırakılır (admin değil -> YetkiYokError, kayıt yok ->
    NotFoundError). Hata BİR KEZ loglanır ve güvenli yanıt döner; teknik detay sızmaz.

    Başarılı: {"basari": True, "kullanici": {...}} (tarih alanları ISO string veya null).
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "kullanici_detay"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        detay = kullanici_service.get_kullanici_detay(sahip, kullanici_kodu)
        return {"basari": True, "kullanici": _detay_to_dict(detay)}
    except AppError as hata:
        # Tanımlı kod/severity ile bir kez loglanır; kullanıcıya güvenli mesaj.
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        # Beklenmeyen hata: CRITICAL loglanır, kullanıcıya genel güvenli mesaj.
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def create_kullanici(ham_jeton: str, govde: dict) -> dict:
    """Oturumu doğrulanmış admin için yeni kullanıcı oluşturur; geçici şifreyi döndürür.

    Controller sorumluluğu request dönüşümüdür: opsiyonel boş string'ler None'a
    çevrilir, ise_giris_tarihi 'YYYY-MM-DD' string'i date'e parse edilir (boş -> None,
    geçersiz format -> ValidationError). İş kuralları/yetki kullanici_service'te.
    Üretilen düz geçici şifre yalnızca yanıtta bir kez döner; loga/bağlama KONMAZ.

    Başarılı: {"basari": True, "kullanici_kodu": <kod>, "gecici_sifre": <düz şifre>}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "kullanici_ekle"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        veri = _normalize_kullanici_govdesi(govde)
        gecici_sifre = kullanici_service.create_kullanici(sahip, veri)
        return {
            "basari": True,
            "kullanici_kodu": veri["kullanici_kodu"],
            "gecici_sifre": gecici_sifre,
        }
    except AppError as hata:
        # Tanımlı kod/severity ile bir kez loglanır; gecici_sifre/hassas alan baglama KONMAZ.
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def degistir_aktiflik(ham_jeton: str, kullanici_kodu: str) -> dict:
    """Oturumu doğrulanmış admin için bir kullanıcının aktiflik durumunu tersine çevirir.

    Cookie'den gelen ham jetonu oturum_service ile doğrular (geçersiz/boş oturum ->
    OturumError). Yetki (yalnızca admin), kayıt bulunamadı ve kendini pasife alma
    engeli kararları kullanici_service'e bırakılır (admin değil -> YetkiYokError,
    kayıt yok -> NotFoundError, kendini pasife alma -> ValidationError). Hata BİR KEZ
    loglanır ve güvenli yanıt döner; teknik detay sızmaz.

    Başarılı: {"basari": True, "kullanici_kodu": <kod>, "aktif": <yeni durum bool>}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "kullanici_aktiflik_degistir"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        yeni_aktif = kullanici_service.degistir_kullanici_aktiflik(sahip, kullanici_kodu)
        return {"basari": True, "kullanici_kodu": kullanici_kodu, "aktif": yeni_aktif}
    except AppError as hata:
        # Tanımlı kod/severity ile bir kez loglanır; kullanıcıya güvenli mesaj.
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        # Beklenmeyen hata: CRITICAL loglanır, kullanıcıya genel güvenli mesaj.
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def guncelle_kullanici(ham_jeton: str, kullanici_kodu: str, govde: dict) -> dict:
    """Oturumu doğrulanmış admin için var olan bir kullanıcıyı günceller.

    kullanici_kodu path'ten gelen MEVCUT sicildir; gövdedeki `kullanici_kodu` alanı
    İSTENEN (aynı ya da yeni) sicildir. Controller sorumluluğu request dönüşümüdür:
    _normalize_kullanici_govdesi ile aynı tip/biçim doğrulaması yapılır (sicil rakam-
    only, ad/soyad rakamsız, uzunluk, tarih parse). İş kuralları/yetki/sicil değişimi
    kararı kullanici_service'te. Hata BİR KEZ loglanır; teknik detay sızmaz.

    Başarılı: {"basari": True, "kullanici_kodu": <güncel/yeni sicil>}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "kullanici_guncelle"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        veri = _normalize_kullanici_govdesi(govde)
        kullanici_service.guncelle_kullanici(sahip, kullanici_kodu, veri)
        return {"basari": True, "kullanici_kodu": veri["kullanici_kodu"]}
    except AppError as hata:
        # Tanımlı kod/severity ile bir kez loglanır; kullanıcıya güvenli mesaj.
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        # Beklenmeyen hata: CRITICAL loglanır, kullanıcıya genel güvenli mesaj.
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def _normalize_kullanici_govdesi(govde: dict) -> dict:
    """HTTP gövdesini doğrulayıp Service'in beklediği normalize veri dict'ine çevirir.

    Girdi doğrulaması Controller'ın işidir: her alanın TİPİ ve BİÇİMİ sınırda
    doğrulanır (sicil kodu yalnızca rakam, ad/soyad rakamsız, uzunluk sınırları);
    uygun değilse ValidationError fırlar. E-posta biçim regex'i ve admin/user enum'u
    Service iş kuralında kalır (DRY). Opsiyonel string'ler boşsa None yapılır;
    ise_giris_tarihi string'i date'e parse edilir.
    """
    veri = {
        "kullanici_kodu": dogrula_sicil_kodu(
            govde.get("kullanici_kodu"), "Sicil kodu", zorunlu=True
        ),
        "ad": dogrula_ad_soyad(govde.get("ad"), "Ad"),
        "soyad": dogrula_ad_soyad(govde.get("soyad"), "Soyad"),
        "email": dogrula_zorunlu_metin(govde.get("email"), "E-posta", EMAIL_MAX_UZUNLUK),
        "kullanici_turu": dogrula_zorunlu_metin(
            govde.get("kullanici_turu"), "Kullanıcı türü"
        ),
        "ise_giris_tarihi": _parse_tarih(govde.get("ise_giris_tarihi")),
        "ilgili_yonetici_kodu": dogrula_sicil_kodu(
            govde.get("ilgili_yonetici_kodu"), "Yönetici sicil kodu", zorunlu=False
        ),
    }
    for alan in _OPSIYONEL_DROPDOWN_ALANLAR:
        veri[alan] = dogrula_opsiyonel_metin(govde.get(alan), alan)
    return veri


def _parse_tarih(ham_tarih):
    """'YYYY-MM-DD' string'ini date'e çevirir; boş -> None, geçersiz format -> ValidationError."""
    if ham_tarih is None or (isinstance(ham_tarih, str) and not ham_tarih.strip()):
        return None
    try:
        return datetime.strptime(str(ham_tarih).strip(), "%Y-%m-%d").date()
    except ValueError as hata:
        raise ValidationError("Geçersiz işe giriş tarihi.") from hata


def _basari_yaniti(ozetler: list[KullaniciOzet]) -> dict:
    """KullaniciOzet listesini güvenli bir yanıt sözlüğüne çevirir."""
    return {
        "basari": True,
        "kullanicilar": [_ozet_to_dict(ozet) for ozet in ozetler],
    }


def _ozet_to_dict(ozet: KullaniciOzet) -> dict:
    """Tek bir KullaniciOzet'i JSON-güvenli sözlüğe çevirir (datetime -> ISO string)."""
    return {
        "kullanici_kodu": ozet.kullanici_kodu,
        "ad": ozet.ad,
        "soyad": ozet.soyad,
        "aktif": ozet.aktif,
        "email": ozet.email,
        "ilgili_yonetici_kodu": ozet.ilgili_yonetici_kodu,
        "yonetici_ad": ozet.yonetici_ad,
        "yonetici_soyad": ozet.yonetici_soyad,
        "olusturma_tarihi": _iso_veya_none(ozet.olusturma_tarihi),
        "son_giris_tarihi": _iso_veya_none(ozet.son_giris_tarihi),
    }


def _detay_to_dict(detay: KullaniciDetay) -> dict:
    """Tek bir KullaniciDetay'i JSON-güvenli sözlüğe çevirir (date/datetime -> ISO string).

    DTO'nun tüm güvenli alanları taşınır; ise_giris_tarihi/olusturma_tarihi/
    son_giris_tarihi ISO 8601 string'e (ya da None) çevrilir. DTO'da hassas alan
    (sifre_hash, hatali_giris_sayisi) zaten yoktur; gösterim/locale frontend'in işidir.
    """
    return {
        "kullanici_kodu": detay.kullanici_kodu,
        "ad": detay.ad,
        "soyad": detay.soyad,
        "email": detay.email,
        "kullanici_turu": detay.kullanici_turu,
        "aktif": detay.aktif,
        "ise_giris_tarihi": _iso_veya_none(detay.ise_giris_tarihi),
        "ilgili_yonetici_kodu": detay.ilgili_yonetici_kodu,
        "yonetici_ad": detay.yonetici_ad,
        "yonetici_soyad": detay.yonetici_soyad,
        "sirket": detay.sirket,
        "grup": detay.grup,
        "bolum": detay.bolum,
        "birim": detay.birim,
        "kadro_grubu": detay.kadro_grubu,
        "kadro_unvani": detay.kadro_unvani,
        "gorev_unvani": detay.gorev_unvani,
        "arge_personeli": detay.arge_personeli,
        "personel_sigorta_is_yeri": detay.personel_sigorta_is_yeri,
        "gorev_yeri": detay.gorev_yeri,
        "olusturma_tarihi": _iso_veya_none(detay.olusturma_tarihi),
        "son_giris_tarihi": _iso_veya_none(detay.son_giris_tarihi),
    }


def _iso_veya_none(deger):
    """datetime değerini ISO 8601 string'e çevirir; None ise None döner."""
    return deger.isoformat() if deger is not None else None


def _hata_yaniti(kod: str, mesaj: str) -> dict:
    """Güvenli hata yanıtı üretir (yalnızca kod + kullanıcıya uygun mesaj)."""
    return {"basari": False, "kod": kod, "mesaj": mesaj}

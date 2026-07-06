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
from models.kullanici_ozet import KullaniciOzet
from services import kullanici_service, oturum_service

# Kullanıcı ekleme gövdesindeki opsiyonel string alanlar (boş string -> None).
_OPSIYONEL_STR_ALANLAR = (
    "ilgili_yonetici_kodu",
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


def _normalize_kullanici_govdesi(govde: dict) -> dict:
    """HTTP gövdesini Service'in beklediği normalize veri dict'ine çevirir.

    Zorunlu alanlar aynen taşınır (içerik doğrulaması Service'in işi); opsiyonel
    string'ler boşsa None yapılır; ise_giris_tarihi string'i date'e parse edilir.
    """
    veri = {
        "kullanici_kodu": govde.get("kullanici_kodu"),
        "ad": govde.get("ad"),
        "soyad": govde.get("soyad"),
        "email": govde.get("email"),
        "kullanici_turu": govde.get("kullanici_turu"),
        "ise_giris_tarihi": _parse_tarih(govde.get("ise_giris_tarihi")),
    }
    for alan in _OPSIYONEL_STR_ALANLAR:
        deger = govde.get(alan)
        veri[alan] = deger.strip() if isinstance(deger, str) and deger.strip() else None
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
        "yonetici_ad": ozet.yonetici_ad,
        "yonetici_soyad": ozet.yonetici_soyad,
        "olusturma_tarihi": _iso_veya_none(ozet.olusturma_tarihi),
        "son_giris_tarihi": _iso_veya_none(ozet.son_giris_tarihi),
    }


def _iso_veya_none(deger):
    """datetime değerini ISO 8601 string'e çevirir; None ise None döner."""
    return deger.isoformat() if deger is not None else None


def _hata_yaniti(kod: str, mesaj: str) -> dict:
    """Güvenli hata yanıtı üretir (yalnızca kod + kullanıcıya uygun mesaj)."""
    return {"basari": False, "kod": kod, "mesaj": mesaj}

"""Kullanıcı yönetimi (admin kullanıcı listesi) Controller katmanı — ince sınır.

Neden: Oturum doğrulaması (kimlik), Service çağrısı ve response dönüşümü burada
orkestre edilir. İş kuralı İÇERMEZ (yetki/rol kararı kullanici_service'te, oturum
mantığı oturum_service'te); SQL/DB detayı bilmez.

Sınır (boundary) sorumluluğu: Bu katman error pipeline'ın giriş noktasıdır. Hata
burada BİR KEZ loglanır ve kullanıcıya güvenli yanıt döner. Stack trace, ham DB
hatası, tablo adı ve hassas alan ASLA yanıta konmaz. datetime alanları JSON'a
uygun ISO 8601 string'e (ya da None) çevrilir; gösterim/locale frontend'in işidir.
"""

from common.errors import AppError
from common.logger import logla_sinir_hatasi
from models.kullanici_ozet import KullaniciOzet
from services import kullanici_service, oturum_service


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

"""Giriş (login) Controller katmanı — ince (thin) sınır.

Neden: Girdi doğrulaması, Service çağrısı ve response dönüşümü burada yapılır.
İş kuralı İÇERMEZ (kilit/şifre mantığı Service'te); SQL/DB detayı bilmez.

Sınır (boundary) sorumluluğu: Bu katman error pipeline'ın giriş noktasıdır.
Hata burada BİR KEZ loglanır ve kullanıcıya severity'ye uygun GÜVENLİ yanıt
döner. Stack trace, ham DB hatası, tablo adı ve hash ASLA yanıta konmaz.
"""

from common.errors import AppError, ValidationError
from common.logger import logla_sinir_hatasi
from models.giris_sonucu import GirisSonucu
from services import auth_service


def login(kimlik: str, sifre: str) -> dict:
    """Giriş isteğini karşılar; güvenli bir sonuç sözlüğü döndürür.

    Başarılı: {"basari": True, "kullanici": {...}}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    Her istek için hata (varsa) tam bir kez loglanır; teknik detay sızmaz.
    """
    baglam = {"islem": "login", "kimlik": kimlik}
    try:
        _validate_giris_alanlari(kimlik, sifre)
        sonuc = auth_service.verify_login(kimlik, sifre)
        return _basari_yaniti(sonuc)
    except AppError as hata:
        # Tanımlı kod/severity ile bir kez loglanır; kullanıcıya güvenli mesaj.
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        # Beklenmeyen hata: CRITICAL loglanır, kullanıcıya genel güvenli mesaj.
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def _validate_giris_alanlari(kimlik: str, sifre: str) -> None:
    """Zorunlu giriş alanlarının boş olmadığını doğrular (yalnızca biçimsel kontrol)."""
    if not kimlik or not kimlik.strip():
        raise ValidationError("Kullanıcı adı/e-posta zorunludur.")
    if not sifre:
        raise ValidationError("Şifre zorunludur.")


def _basari_yaniti(sonuc: GirisSonucu) -> dict:
    """GirisSonucu DTO'sunu kullanıcıya dönülebilecek güvenli sözlüğe çevirir."""
    return {
        "basari": True,
        "kullanici": {
            "kullanici_kodu": sonuc.kullanici_kodu,
            "ad": sonuc.ad,
            "soyad": sonuc.soyad,
            "kullanici_turu": sonuc.kullanici_turu,
        },
    }


def _hata_yaniti(kod: str, mesaj: str) -> dict:
    """Güvenli hata yanıtı üretir (yalnızca kod + kullanıcıya uygun mesaj)."""
    return {"basari": False, "kod": kod, "mesaj": mesaj}

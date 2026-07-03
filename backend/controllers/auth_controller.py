"""Kimlik/oturum (login, me, logout) Controller katmanı — ince (thin) sınır.

Neden: Girdi doğrulaması, Service çağrısı ve response dönüşümü burada yapılır.
İş kuralı İÇERMEZ (kilit/şifre mantığı auth_service'te, jeton/hash/süre mantığı
oturum_service'te); SQL/DB detayı bilmez.

Sınır (boundary) sorumluluğu: Bu katman error pipeline'ın giriş noktasıdır.
Hata burada BİR KEZ loglanır ve kullanıcıya severity'ye uygun GÜVENLİ yanıt
döner. Stack trace, ham DB hatası, tablo adı ve hash ASLA yanıta konmaz.
"""

from common.errors import AppError, ValidationError
from common.logger import logla_sinir_hatasi
from models.giris_sonucu import GirisSonucu
from models.oturum import OturumSahibi
from services import auth_service, oturum_service


def login(kimlik: str, sifre: str) -> dict:
    """Giriş isteğini karşılar; güvenli bir sonuç sözlüğü döndürür.

    Başarılı doğrulama sonrası oturum açılır; üretilen HAM jeton yanıt sözlüğüne
    `oturum_jetonu` anahtarıyla eklenir. Bu jeton yalnızca HTTP sınırının cookie'ye
    koyup GÖVDEDEN çıkarması içindir; kullanıcı yanıtının gövdesine dönmez.

    Başarılı: {"basari": True, "kullanici": {...}, "oturum_jetonu": <ham jeton>}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    Her istek için hata (varsa) tam bir kez loglanır; teknik detay sızmaz.
    """
    baglam = {"islem": "login", "kimlik": kimlik}
    try:
        _validate_giris_alanlari(kimlik, sifre)
        sonuc = auth_service.verify_login(kimlik, sifre)
        # Orkestrasyon: doğrulama başarılıysa oturumu aç (hash/süre üretimi Service'te).
        ham_jeton = oturum_service.oturum_olustur(sonuc.kullanici_kodu)
        return _basari_yaniti(sonuc, ham_jeton)
    except AppError as hata:
        # Tanımlı kod/severity ile bir kez loglanır; kullanıcıya güvenli mesaj.
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        # Beklenmeyen hata: CRITICAL loglanır, kullanıcıya genel güvenli mesaj.
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def me(ham_jeton: str) -> dict:
    """Geçerli oturumun sahibi kullanıcının güvenli kimlik bilgilerini döndürür.

    Cookie'den gelen ham jetonu Service'e doğrulatır; geçerliyse kayan pencere
    yenilenir ve kullanıcı döner. Geçersiz/süresi dolmuş oturumda OturumError
    (SESSION_INVALID) bir kez loglanır ve güvenli yanıt döner.

    Başarılı: {"basari": True, "kullanici": {...}}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "me"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        return _oturum_sahibi_yaniti(sahip)
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def logout(ham_jeton: str) -> dict:
    """Mevcut oturumu sonlandırır (logout).

    Cookie'deki ham jetona karşılık gelen oturum silinir; boş jetonda Service
    no-op'tur. İşlem daima güvenli bir başarı sözlüğüyle döner.

    Başarılı: {"basari": True}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "logout"}
    try:
        oturum_service.oturum_sonlandir(ham_jeton)
        return {"basari": True}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def _validate_giris_alanlari(kimlik: str, sifre: str) -> None:
    """Zorunlu giriş alanlarının boş olmadığını doğrular (yalnızca biçimsel kontrol)."""
    if not kimlik or not kimlik.strip():
        raise ValidationError("Kullanıcı adı/e-posta zorunludur.")
    if not sifre:
        raise ValidationError("Şifre zorunludur.")


def _basari_yaniti(sonuc: GirisSonucu, ham_jeton: str) -> dict:
    """GirisSonucu DTO'sunu güvenli sözlüğe çevirir; ham jetonu transport için ekler.

    `oturum_jetonu` yalnızca HTTP sınırının cookie'ye taşıması içindir; sınır bu
    anahtarı gövdeden çıkarır. Kullanıcıya gövdede jeton DÖNMEZ.
    """
    return {
        "basari": True,
        "kullanici": {
            "kullanici_kodu": sonuc.kullanici_kodu,
            "ad": sonuc.ad,
            "soyad": sonuc.soyad,
            "kullanici_turu": sonuc.kullanici_turu,
        },
        "oturum_jetonu": ham_jeton,
    }


def _oturum_sahibi_yaniti(sahip: OturumSahibi) -> dict:
    """OturumSahibi DTO'sunu /me için güvenli kullanıcı sözlüğüne çevirir.

    gecerlilik_bitisi bilerek gövdeye konmaz; yalnızca güvenli kimlik alanları döner.
    """
    return {
        "basari": True,
        "kullanici": {
            "kullanici_kodu": sahip.kullanici_kodu,
            "ad": sahip.ad,
            "soyad": sahip.soyad,
            "kullanici_turu": sahip.kullanici_turu,
        },
    }


def _hata_yaniti(kod: str, mesaj: str) -> dict:
    """Güvenli hata yanıtı üretir (yalnızca kod + kullanıcıya uygun mesaj)."""
    return {"basari": False, "kod": kod, "mesaj": mesaj}

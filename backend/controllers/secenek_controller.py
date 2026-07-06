"""Yönetilen dropdown seçenekleri (admin) Controller katmanı — ince sınır.

Neden: Oturum doğrulaması, Service çağrısı ve response dönüşümü burada orkestre
edilir. İş kuralı/yetki kararı secenek_service'te, oturum mantığı oturum_service'te;
bu katman SQL/DB detayı bilmez.

Sınır (boundary) sorumluluğu: Bu katman error pipeline'ın giriş noktasıdır. Hata
burada BİR KEZ loglanır ve kullanıcıya güvenli yanıt döner. Stack trace, ham DB
hatası, tablo adı ASLA yanıta konmaz.
"""

from common.errors import AppError
from common.logger import logla_sinir_hatasi
from models.secenek import SecenekKaydi
from services import oturum_service, secenek_service


def list_secenekler(ham_jeton: str) -> dict:
    """Oturumu doğrulanmış admin için tüm dropdown seçeneklerini döndürür.

    Cookie'den gelen ham jeton oturum_service ile doğrulanır (geçersiz -> OturumError);
    yetki kararı secenek_service'e bırakılır (admin değil -> YetkiYokError). Hata BİR
    KEZ loglanır ve güvenli yanıt döner.

    Başarılı: {"basari": True, "secenekler": [ {"kategori":.., "deger":..}, ... ]}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "secenek_listesi"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        secenekler = secenek_service.list_secenekler(sahip)
        return {
            "basari": True,
            "secenekler": [_secenek_to_dict(secenek) for secenek in secenekler],
        }
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def ekle_secenek(ham_jeton: str, kategori: str, deger: str) -> dict:
    """Oturumu doğrulanmış admin için yeni bir dropdown seçeneği ekler.

    Oturum doğrulanır; kategori/deger doğrulaması ve yazma secenek_service'te yapılır.
    Aynı seçenek zaten varsa SECENEK_ZATEN_VAR ile döner. Hata BİR KEZ loglanır.

    Başarılı: {"basari": True}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "secenek_ekle", "kategori": kategori}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        secenek_service.ekle_secenek(sahip, kategori, deger)
        return {"basari": True}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def sil_secenek(ham_jeton: str, kategori: str, deger: str) -> dict:
    """Oturumu doğrulanmış admin için bir dropdown seçeneğini siler.

    Oturum doğrulanır; kategori/deger doğrulaması ve silme secenek_service'te yapılır.
    Silme idempotenttir: kayıt olmasa da başarı döner. Hata BİR KEZ loglanır.

    Başarılı: {"basari": True}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "secenek_sil", "kategori": kategori}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        secenek_service.sil_secenek(sahip, kategori, deger)
        return {"basari": True}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def _secenek_to_dict(secenek: SecenekKaydi) -> dict:
    """Tek bir SecenekKaydi'ni JSON-güvenli sözlüğe çevirir."""
    return {"kategori": secenek.kategori, "deger": secenek.deger}


def _hata_yaniti(kod: str, mesaj: str) -> dict:
    """Güvenli hata yanıtı üretir (yalnızca kod + kullanıcıya uygun mesaj)."""
    return {"basari": False, "kod": kod, "mesaj": mesaj}

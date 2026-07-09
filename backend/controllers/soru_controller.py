"""Anket soruları (admin) Controller katmanı — ince sınır.

Neden: Oturum doğrulaması, girdi doğrulaması, Service çağrısı ve response
dönüşümü burada orkestre edilir. İş kuralı/yetki kararı soru_service'te, oturum
mantığı oturum_service'te; bu katman SQL/DB detayı bilmez.

Sınır (boundary) sorumluluğu: Bu katman error pipeline'ın giriş noktasıdır. Hata
burada BİR KEZ loglanır ve kullanıcıya güvenli yanıt döner. Stack trace, ham DB
hatası, tablo adı ASLA yanıta konmaz. soru_metni sanitizasyonu Service'te yapılır;
buraya sanitize edilmiş HTML gelir.
"""

from common.errors import AppError, ValidationError
from common.logger import logla_sinir_hatasi
from models.soru import SoruKaydi
from services import oturum_service, soru_service


def list_sorular(ham_jeton: str) -> dict:
    """Oturumu doğrulanmış admin için tüm anket sorularını döndürür.

    Cookie'den gelen ham jeton oturum_service ile doğrulanır (geçersiz ->
    OturumError); yetki kararı soru_service'e bırakılır (admin değil ->
    YetkiYokError). Sorular sanitize edilmiş soru_metni ile döner. Hata BİR KEZ
    loglanır ve güvenli yanıt döner.

    Başarılı: {"basari": True, "sorular": [ {soru alanları...}, ... ]}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "soru_listesi"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        sorular = soru_service.list_sorular(sahip)
        return {
            "basari": True,
            "sorular": [_soru_to_dict(soru) for soru in sorular],
        }
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def sil_soru(ham_jeton: str, soru_id: int) -> dict:
    """Oturumu doğrulanmış admin için tek bir anket sorusunu siler.

    Oturum doğrulanır; soru_id pozitif tamsayı değilse ValidationError. Silme ve
    yetki kararı soru_service'te yapılır (admin değil -> YetkiYokError). Silme
    idempotenttir: kayıt olmasa da başarı döner. Hata BİR KEZ loglanır.

    Başarılı: {"basari": True}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "soru_sil", "soru_id": soru_id}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_soru_id(soru_id)
        soru_service.sil_soru(sahip, soru_id)
        return {"basari": True}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def _dogrula_soru_id(soru_id: int) -> None:
    """soru_id'nin pozitif tamsayı olduğunu doğrular; değilse ValidationError.

    bool, int'in alt tipidir; True/False'un geçerli kimlik sayılmaması için tip
    ayrıca bool'a karşı elenir.
    """
    if isinstance(soru_id, bool) or not isinstance(soru_id, int) or soru_id <= 0:
        raise ValidationError("Geçersiz soru kimliği.")


def _soru_to_dict(soru: SoruKaydi) -> dict:
    """Tek bir SoruKaydi'ni JSON-güvenli sözlüğe çevirir.

    soru_metni Service'te sanitize edilmiş HTML'dir. Hazırlayan ad/soyad AYRI
    tutulur (isim birleştirme/format frontend'in işidir). Şıklar {secenek_metni,
    sira_no} sözlükleri olarak listelenir.
    """
    return {
        "soru_id": soru.soru_id,
        "anket_id": soru.anket_id,
        "soru_metni": soru.soru_metni,
        "soru_tipi": soru.soru_tipi,
        "sira_no": soru.sira_no,
        "zorunlu_mu": soru.zorunlu_mu,
        "hazirlayan_kodu": soru.hazirlayan_kodu,
        "hazirlayan_ad": soru.hazirlayan_ad,
        "hazirlayan_soyad": soru.hazirlayan_soyad,
        "secenekler": [
            {"secenek_metni": secenek.secenek_metni, "sira_no": secenek.sira_no}
            for secenek in soru.secenekler
        ],
    }


def _hata_yaniti(kod: str, mesaj: str) -> dict:
    """Güvenli hata yanıtı üretir (yalnızca kod + kullanıcıya uygun mesaj)."""
    return {"basari": False, "kod": kod, "mesaj": mesaj}

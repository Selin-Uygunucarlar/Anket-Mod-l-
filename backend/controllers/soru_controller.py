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

# Bir sorunun kabul edilen şık (seçenek) sayısı aralığı; frontend "Seçenek Sayısı"
# alanıyla birebir. Aralık dışı istek sınırda ValidationError ile elenir.
_SECENEK_ADET_MIN = 2
_SECENEK_ADET_MAX = 15


def ekle_soru(
    ham_jeton: str,
    soru_tipi: str,
    konu: str,
    amac: str,
    soru_metni: str,
    secenekler: list[str],
) -> dict:
    """Oturumu doğrulanmış admin için BAĞIMSIZ yeni bir anket sorusu ekler.

    Oturum doğrulanır; girdinin tip/şekli bu sınırda doğrulanır (str + boş değil;
    secenekler bir liste, her elemanı str, uzunluğu 2–15). İş kuralı (geçerli tip
    kümesi), XSS sanitizasyonu ve yazma soru_service'e aittir; yetki de Service'te
    (admin değil -> YetkiYokError). hazirlayan_kodu Service'te oturumdan alınır.
    Hata BİR KEZ loglanır ve güvenli yanıt döner.

    Başarılı: {"basari": True, "soru_id": <int>}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "soru_ekle", "soru_tipi": soru_tipi}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_ekle_girdisi(soru_tipi, konu, amac, soru_metni, secenekler)
        yeni_soru_id = soru_service.ekle_soru(
            sahip, soru_tipi, konu, amac, soru_metni, secenekler
        )
        return {"basari": True, "soru_id": yeni_soru_id}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


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


def get_soru_detay(ham_jeton: str, soru_id: int) -> dict:
    """Oturumu doğrulanmış admin için tek bir anket sorusunun detayını döndürür.

    Cookie'den gelen ham jeton oturum_service ile doğrulanır (geçersiz ->
    OturumError); soru_id pozitif tamsayı değilse ValidationError. Yetki (yalnızca
    admin) ve kayıt bulunamadı durumu soru_service'e bırakılır (admin değil ->
    YetkiYokError, kayıt yok -> NotFoundError). Dönen sorunun soru_metni/şıkları
    Service'te sanitize edilmiştir (düzenleme ön-doldurma için). Hata BİR KEZ
    loglanır ve güvenli yanıt döner; teknik detay sızmaz.

    Başarılı: {"basari": True, "soru": {soru alanları...}}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "soru_detay", "soru_id": soru_id}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_soru_id(soru_id)
        soru = soru_service.get_soru(sahip, soru_id)
        return {"basari": True, "soru": _soru_to_dict(soru)}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def guncelle_soru(
    ham_jeton: str,
    soru_id: int,
    soru_tipi: str,
    konu: str,
    amac: str,
    soru_metni: str,
    secenekler: list[str],
) -> dict:
    """Oturumu doğrulanmış admin için var olan bir anket sorusunu günceller.

    Oturum doğrulanır; soru_id pozitif tamsayı olmalı (_dogrula_soru_id) ve girdinin
    tip/şekli ekleme ile aynı sınırda doğrulanır (_dogrula_ekle_girdisi: str + boş
    değil; secenekler liste, her elemanı str, uzunluğu 2–15). İş kuralı (geçerli
    tip kümesi), XSS sanitizasyonu, varlık kontrolü ve yazma soru_service'e aittir;
    yetki de Service'te (admin değil -> YetkiYokError, kayıt yok -> NotFoundError).
    Hata BİR KEZ loglanır ve güvenli yanıt döner; teknik detay sızmaz.

    Başarılı: {"basari": True}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "soru_guncelle", "soru_id": soru_id}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_soru_id(soru_id)
        _dogrula_ekle_girdisi(soru_tipi, konu, amac, soru_metni, secenekler)
        soru_service.guncelle_soru(
            sahip, soru_id, soru_tipi, konu, amac, soru_metni, secenekler
        )
        return {"basari": True}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def _dogrula_ekle_girdisi(
    soru_tipi: str, konu: str, amac: str, soru_metni: str, secenekler: list[str]
) -> None:
    """Soru ekleme girdisinin tip/şeklini sınırda doğrular; ihlalde ValidationError.

    Yalnızca şekil kontrolü yapılır (str + boş değil; secenekler liste, her elemanı
    str, uzunluğu 2–15). İş kuralı (tipin geçerli kümede olması) ve sanitize sonrası
    içerik kontrolü Service'in işidir; sınır ince tutulur.
    """
    _dogrula_zorunlu_metin(soru_tipi, "Soru tipi")
    _dogrula_zorunlu_metin(konu, "Konu")
    _dogrula_zorunlu_metin(amac, "Amaç")
    _dogrula_zorunlu_metin(soru_metni, "Soru metni")
    _dogrula_secenek_listesi(secenekler)


def _dogrula_zorunlu_metin(deger, alan_adi: str) -> None:
    """Bir alanın string ve boş/whitespace olmadığını doğrular; değilse ValidationError."""
    if not isinstance(deger, str) or not deger.strip():
        raise ValidationError(f"{alan_adi} zorunludur.")


def _dogrula_secenek_listesi(secenekler) -> None:
    """secenekler'in liste, her elemanının str ve adedin 2–15 olduğunu doğrular."""
    if not isinstance(secenekler, list):
        raise ValidationError("Seçenekler bir liste olmalıdır.")
    if not _SECENEK_ADET_MIN <= len(secenekler) <= _SECENEK_ADET_MAX:
        raise ValidationError(
            f"Seçenek sayısı {_SECENEK_ADET_MIN}-{_SECENEK_ADET_MAX} arasında olmalıdır."
        )
    for secenek in secenekler:
        if not isinstance(secenek, str):
            raise ValidationError("Her seçenek metin olmalıdır.")


def _dogrula_soru_id(soru_id: int) -> None:
    """soru_id'nin pozitif tamsayı olduğunu doğrular; değilse ValidationError.

    bool, int'in alt tipidir; True/False'un geçerli kimlik sayılmaması için tip
    ayrıca bool'a karşı elenir.
    """
    if isinstance(soru_id, bool) or not isinstance(soru_id, int) or soru_id <= 0:
        raise ValidationError("Geçersiz soru kimliği.")


def _soru_to_dict(soru: SoruKaydi) -> dict:
    """Tek bir SoruKaydi'ni JSON-güvenli sözlüğe çevirir.

    soru_metni Service'te sanitize edilmiş HTML'dir. konu/amac düzenleme formunun
    ön-doldurması için taşınır (liste de taşır, sorun değil). Hazırlayan ad/soyad
    AYRI tutulur (isim birleştirme/format frontend'in işidir). Şıklar {secenek_metni,
    sira_no} sözlükleri olarak listelenir.
    """
    return {
        "soru_id": soru.soru_id,
        "anket_id": soru.anket_id,
        "soru_metni": soru.soru_metni,
        "soru_tipi": soru.soru_tipi,
        "konu": soru.konu,
        "amac": soru.amac,
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

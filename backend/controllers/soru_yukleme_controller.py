"""Excel ile toplu soru yükleme (admin) Controller katmanı — ince sınır.

Neden ayrı dosya: soru_controller tek soru uçlarıyla zaten doludur (SRP + dosya
boyutu). Bu dosya iki ucu orkestre eder: şablon indirme ve toplu yükleme.

Sorumluluk: oturum doğrulaması, DOSYA düzeyinde şekil doğrulaması (uzantı, boyut,
boş içerik), Excel<->satır dönüşümünü dönüştürücüye devretme ve Service çağrısı.
İş kuralı, yetki kararı ve sanitizasyon soru_yukleme_service/soru_service'tedir;
bu katman SQL/DB detayı bilmez.

Sınır (boundary) sorumluluğu: Hata burada BİR KEZ loglanır ve kullanıcıya güvenli
yanıt döner. Stack trace/ham istisna ASLA yanıta konmaz. Satır bazlı doğrulama
hataları (satir_hatalari) kullanıcının KENDİ verisine aittir ve yanıta konur.
"""

from common.constants import MAKS_EXCEL_DOSYA_BAYTI
from common.errors import AppError, TopluYuklemeDogrulamaHatasi, ValidationError
from common.logger import logla_sinir_hatasi
from controllers import soru_excel_donusturucu
from services import oturum_service, soru_yukleme_service

# İndirilen şablonun kullanıcıya görünen dosya adı.
_SABLON_DOSYA_ADI = "anket_sorulari_sablonu.xlsx"

# Kabul edilen tek yükleme biçimi (openpyxl yalnızca bu biçimi okur).
_KABUL_EDILEN_UZANTI = ".xlsx"


def yukle_sorular(ham_jeton: str, dosya_baytlari: bytes, dosya_adi: str) -> dict:
    """Oturumu doğrulanmış admin için Excel dosyasındaki soruları TOPLU ekler.

    Oturum doğrulanır; dosyanın ŞEKLİ bu sınırda doğrulanır (.xlsx uzantısı, boş
    olmama, boyut sınırı) — dosya bu kontrolleri geçmeden AÇILMAZ. Ardından
    dönüştürücü satırları çıkarır ve iş kuralları/yetki/atomik yazma Service'e
    geçer (admin değil -> YetkiYokError). Hata BİR KEZ loglanır.

    Başarılı: {"basari": True, "eklenen_sayisi": <int>}.
    Satır hatası: {"basari": False, "kod": ..., "mesaj": ..., "satir_hatalari": [...]}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "soru_toplu_yukle"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_yuklenen_dosya(dosya_baytlari, dosya_adi)
        satirlar = soru_excel_donusturucu.oku_soru_satirlari(dosya_baytlari)
        eklenen_sayisi = soru_yukleme_service.yukle_sorular(sahip, satirlar)
        return {"basari": True, "eklenen_sayisi": eklenen_sayisi}
    except TopluYuklemeDogrulamaHatasi as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        yanit = _hata_yaniti(hata.kod, hata.mesaj)
        # Satır hataları kullanıcının kendi gönderdiği veriye aittir (teknik
        # detay değil); düzeltebilmesi için yanıtta döner.
        yanit["satir_hatalari"] = hata.satir_hatalari
        return yanit
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def indir_sablon(ham_jeton: str) -> dict:
    """Oturumu doğrulanmış admin için toplu yükleme Excel şablonunu üretir.

    Oturum doğrulanır; şablonun İÇERİĞİ (yüklenebilir soru tipi etiketleri, tanımlı
    konu/amaç değerleri) Service'ten gelir ve yetki de orada uygulanır (admin değil
    -> YetkiYokError). Excel dosyasının kurulumu biçim işidir, dönüştürücüye
    aittir. Hata BİR KEZ loglanır ve güvenli yanıt döner.

    Başarılı: {"basari": True, "dosya_baytlari": <bytes>, "dosya_adi": <str>}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "soru_sablon_indir"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        sablon_verisi = soru_yukleme_service.uret_sablon_verisi(sahip)
        dosya_baytlari = soru_excel_donusturucu.uret_sablon_baytlari(sablon_verisi)
        return {
            "basari": True,
            "dosya_baytlari": dosya_baytlari,
            "dosya_adi": _SABLON_DOSYA_ADI,
        }
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def _dogrula_yuklenen_dosya(dosya_baytlari: bytes, dosya_adi: str) -> None:
    """Yüklenen dosyanın uzantı/boyut şeklini sınırda doğrular; ihlalde ValidationError.

    Yalnızca ŞEKİL kontrolüdür: dosya adı .xlsx ile bitmeli, içerik boş olmamalı ve
    boyut MAKS_EXCEL_DOSYA_BAYTI'yı aşmamalıdır. Böylece büyük/alakasız dosya
    çözümlenmeye çalışılmadan reddedilir. İçeriğin ANLAMI Service'te doğrulanır.
    """
    if not isinstance(dosya_adi, str) or not dosya_adi.lower().endswith(
        _KABUL_EDILEN_UZANTI
    ):
        raise ValidationError("Yalnızca .xlsx uzantılı dosya yüklenebilir.")
    if not dosya_baytlari:
        raise ValidationError("Yüklenen dosya boş.")
    if len(dosya_baytlari) > MAKS_EXCEL_DOSYA_BAYTI:
        raise ValidationError(
            f"Dosya boyutu en fazla {MAKS_EXCEL_DOSYA_BAYTI // (1024 * 1024)} MB "
            "olabilir."
        )


def _hata_yaniti(kod: str, mesaj: str) -> dict:
    """Güvenli hata yanıtı üretir (yalnızca kod + kullanıcıya uygun mesaj)."""
    return {"basari": False, "kod": kod, "mesaj": mesaj}

"""Anket sonuçları (atananlar/yanıtlayanlar + tek kişinin cevapları) Controller — ince sınır.

Neden ayrı dosya: anket_controller.py 500 satır sınırına yakın olduğundan, anket
listesi ekranından açılan sonuç okumalarının sınır orkestrasyonu buraya alındı
(anket_doldur_controller.py ile aynı kalıp).

Sorumluluk: oturum doğrulama + girdinin tip/şekil doğrulaması + response dönüşümü.
İŞ KURALI/YETKİ KARARI BURADA YOK: admin kısıtı, görünürlük süzgeci, "yanıtladı mı"
türetimi, soru↔cevap montajı ve HTML sanitizasyonu anket_sonuc_service'e; oturum
mantığı oturum_service'e aittir. Bu katman SQL/DB detayı bilmez ve Repository'yi
ÇAĞIRMAZ.

Sınır (boundary) sorumluluğu: error pipeline'ın giriş noktasıdır. Hata burada BİR KEZ
loglanır ve kullanıcıya güvenli yanıt döner. Stack trace, ham DB hatası veya tablo adı
ASLA yanıta konmaz.
"""

from common.errors import AppError, ValidationError
from common.logger import logla_sinir_hatasi
from controllers.kullanici_dogrulama import dogrula_sicil_kodu
from models.anket_sonuc import AnketAtamaGorunumu, KullaniciCevapGorunumu
from services import anket_sonuc_service, oturum_service


def list_anket_atamalari(ham_jeton: str, anket_id: int) -> dict:
    """Oturumu doğrulanmış admin için bir ankete atanmış kişilerin listesini döndürür.

    Oturum doğrulanır; anket_id pozitif tamsayı olmalı. Yetki (yalnızca admin),
    görünürlük ve "yanıtladı mı" türetimi anket_sonuc_service'e bırakılır (admin değil
    -> YetkiYokError; görünmüyor/yok -> NotFoundError). Hata BİR KEZ loglanır ve
    güvenli yanıt döner; teknik detay sızmaz.

    Başarılı: {"basari": True, "atamalar": [ {kişi + atama durumu...}, ... ]}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "anket_atamalari", "anket_id": anket_id}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_pozitif_kimlik(anket_id, "Geçersiz anket kimliği.")
        atamalar = anket_sonuc_service.list_anket_atamalari(sahip, anket_id)
        return {
            "basari": True,
            "atamalar": [_atama_to_dict(atama) for atama in atamalar],
        }
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def get_kullanici_cevaplari(
    ham_jeton: str, anket_id: int, kullanici_kodu: str
) -> dict:
    """Oturumu doğrulanmış admin için tek kişinin anket cevaplarını döndürür.

    Oturum doğrulanır; anket_id pozitif tamsayı, kullanici_kodu ise projedeki sicil
    biçimine uymalıdır (ortak dogrula_sicil_kodu ile; DRY). Yetki/görünürlük ve
    soru↔cevap montajı + sanitizasyon anket_sonuc_service'e aittir; anket görünmüyor
    ya da kişi ankete atanmamışsa NotFoundError döner (ayrım yapılmaz). Hata BİR KEZ
    loglanır ve güvenli yanıt döner.

    Başarılı: {"basari": True, "cevaplar": {kullanici_kodu, tamamlandi_mi, sorular}}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "anket_kullanici_cevaplari", "anket_id": anket_id}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_pozitif_kimlik(anket_id, "Geçersiz anket kimliği.")
        temiz_kod = dogrula_sicil_kodu(kullanici_kodu, "Kullanıcı kodu", zorunlu=True)
        gorunum = anket_sonuc_service.get_kullanici_cevaplari(
            sahip, anket_id, temiz_kod
        )
        return {"basari": True, "cevaplar": _cevap_gorunumu_to_dict(gorunum)}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def _dogrula_pozitif_kimlik(deger, hata_mesaji: str) -> None:
    """Bir kimliğin pozitif tamsayı olduğunu doğrular; değilse ValidationError.

    bool, int'in alt tipidir; True/False'un geçerli kimlik sayılmaması için tip
    ayrıca bool'a karşı elenir.
    """
    if isinstance(deger, bool) or not isinstance(deger, int) or deger <= 0:
        raise ValidationError(hata_mesaji)


def _atama_to_dict(atama: AnketAtamaGorunumu) -> dict:
    """AnketAtamaGorunumu'nu atanan/yanıtlayan listesi için JSON-güvenli sözlüğe çevirir.

    Yalnızca gösterilecek kimlik alanları taşınır (hassas alan yok). yanitladi_mi
    Service'te türetilmiştir; frontend "Yanıtlayan" listesini bununla süzer.
    """
    return {
        "kullanici_kodu": atama.kullanici_kodu,
        "ad": atama.ad,
        "soyad": atama.soyad,
        "email": atama.email,
        "durum": atama.durum,
        "yanitladi_mi": atama.yanitladi_mi,
        "tamamlanma_tarihi": _iso_ya_da_none(atama.tamamlanma_tarihi),
    }


def _cevap_gorunumu_to_dict(gorunum: KullaniciCevapGorunumu) -> dict:
    """KullaniciCevapGorunumu'nu "Cevapları Gör" ekranının JSON-güvenli sözlüğüne çevirir.

    soru_metni ve cevap metinleri Service'te sanitize edilmiş HTML'dir (frontend
    render eder). Cevapsız soru da listede kalır (verilen_secenekler boş, cevap_metni
    None); iç iş alanı (atama_id, ham atama durumu) taşınmaz.
    """
    return {
        "kullanici_kodu": gorunum.kullanici_kodu,
        "tamamlandi_mi": gorunum.tamamlandi_mi,
        "sorular": [
            {
                "soru_id": soru.soru_id,
                "soru_metni": soru.soru_metni,
                "soru_tipi": soru.soru_tipi,
                "verilen_secenekler": soru.verilen_secenekler,
                "cevap_metni": soru.cevap_metni,
            }
            for soru in gorunum.sorular
        ],
    }


def _iso_ya_da_none(deger):
    """Bir date/datetime değerini ISO 8601 string'e çevirir; None ise None döner."""
    return deger.isoformat() if deger is not None else None


def _hata_yaniti(kod: str, mesaj: str) -> dict:
    """Güvenli hata yanıtı üretir (yalnızca kod + kullanıcıya uygun mesaj)."""
    return {"basari": False, "kod": kod, "mesaj": mesaj}

"""Anket doldurma (cevaplama) Controller — ince sınır.

Neden ayrı dosya: anket_controller.py 500 satır sınırına yakın olduğundan cevaplama
akışının sınır orkestrasyonu buraya alındı. Bu uç admin-only DEĞİLDİR: yetki
SAHİPLİK üzerinden (anketin kullanıcıya atanmış olması) Service'te uygulanır; burada
yalnızca oturum doğrulama + girdinin tip/şekil doğrulaması + response dönüşümü yapılır.

İŞ KURALI BURADA YOK: aktiflik, tarih penceresi, atama tamamlanmış mı, soru/şık
aidiyeti, kardinalite ve zorunluluk anket_doldur_service'e; oturum mantığı
oturum_service'e aittir. Bu katman SQL/DB detayı bilmez ve Repository'yi çağırmaz.

Sınır (boundary) sorumluluğu: error pipeline'ın giriş noktasıdır. Hata burada BİR KEZ
loglanır ve kullanıcıya güvenli yanıt döner. Stack trace, ham DB hatası, tablo adı ya
da ham HTML ASLA yanıta konmaz.
"""

from common.errors import AppError, ValidationError
from common.logger import logla_sinir_hatasi
from models.anket_doldur import AnketDoldurGorunumu, CevapGirdisi
from services import anket_doldur_service, oturum_service


def get_anket_doldur(ham_jeton: str, anket_id: int) -> dict:
    """Oturumu doğrulanmış kullanıcı için anketi cevaplama görünümüyle döndürür.

    Oturum doğrulanır; anket_id pozitif tamsayı olmalı. Sahiplik/yetki ("bu anket bana
    atanmış mı") ve metin sanitizasyonu anket_doldur_service'e bırakılır (atanmamış/yok
    -> NotFoundError). Hata BİR KEZ loglanır ve güvenli yanıt döner; teknik detay sızmaz.

    Başarılı: {"basari": True, "anket": {anket + sorular + şıklar}}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "anket_doldur", "anket_id": anket_id}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_pozitif_kimlik(anket_id, "Geçersiz anket kimliği.")
        gorunum = anket_doldur_service.get_anket_doldur(sahip, anket_id)
        return {"basari": True, "anket": _gorunum_to_dict(gorunum)}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def gonder_anket(ham_jeton: str, anket_id: int, cevaplar) -> dict:
    """Oturumu doğrulanmış kullanıcının anket cevaplarını gönderir (tamamlar).

    Oturum doğrulanır; anket_id pozitif tamsayı olmalı ve cevaplar yalnızca ŞEKİL
    olarak doğrulanır (liste; her öğe soru_id pozitif int, secenek_idler pozitif int
    listesi, cevap_metni str|None). Aidiyet, kardinalite, zorunluluk, aktiflik/tarih ve
    sahiplik iş kuralları anket_doldur_service'e aittir. Hata BİR KEZ loglanır ve
    güvenli yanıt döner.

    Başarılı: {"basari": True}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "anket_gonder", "anket_id": anket_id}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_pozitif_kimlik(anket_id, "Geçersiz anket kimliği.")
        cevap_girdileri = _cevaplari_donustur(cevaplar)
        anket_doldur_service.gonder_anket(sahip, anket_id, cevap_girdileri)
        return {"basari": True}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def _cevaplari_donustur(cevaplar) -> list[CevapGirdisi]:
    """Ham cevap listesini sınırda tip/şekil olarak doğrulayıp CevapGirdisi'ye çevirir.

    Yalnızca ŞEKİL kontrolü: cevaplar bir liste; her öğe dict ve soru_id pozitif int,
    secenek_idler pozitif int listesi, cevap_metni None ya da str olmalıdır. Değerlerin
    anlamı (soru/şık aidiyeti, kardinalite, zorunluluk) Service'in işidir; ihlalde
    ValidationError fırlar.
    """
    if not isinstance(cevaplar, list):
        raise ValidationError("Cevaplar bir liste olmalıdır.")

    girdiler: list[CevapGirdisi] = []
    for kalem in cevaplar:
        if not isinstance(kalem, dict):
            raise ValidationError("Her cevap bir nesne olmalıdır.")
        _dogrula_pozitif_kimlik(kalem.get("soru_id"), "Geçersiz soru kimliği.")
        secenek_idler = kalem.get("secenek_idler", [])
        _dogrula_secenek_idler(secenek_idler)
        cevap_metni = kalem.get("cevap_metni")
        if cevap_metni is not None and not isinstance(cevap_metni, str):
            raise ValidationError("Cevap metni metin olmalıdır.")
        girdiler.append(
            CevapGirdisi(
                soru_id=kalem["soru_id"],
                secenek_idler=list(secenek_idler),
                cevap_metni=cevap_metni,
            )
        )
    return girdiler


def _dogrula_secenek_idler(secenek_idler) -> None:
    """secenek_idler'in liste ve her elemanının pozitif tamsayı olduğunu doğrular.

    Boş liste burada reddedilmez: kaç şık gerektiği (kardinalite) bir İŞ KURALIDIR ve
    Service'e aittir. Elemanların o soruya ait olup olmadığı da Service'te doğrulanır.
    """
    if not isinstance(secenek_idler, list):
        raise ValidationError("Şıklar bir liste olmalıdır.")
    for secenek_id in secenek_idler:
        _dogrula_pozitif_kimlik(secenek_id, "Geçersiz şık kimliği.")


def _dogrula_pozitif_kimlik(deger, hata_mesaji: str) -> None:
    """Bir kimliğin pozitif tamsayı olduğunu doğrular; değilse ValidationError.

    bool, int'in alt tipidir; True/False'un geçerli kimlik sayılmaması için tip
    ayrıca bool'a karşı elenir.
    """
    if isinstance(deger, bool) or not isinstance(deger, int) or deger <= 0:
        raise ValidationError(hata_mesaji)


def _gorunum_to_dict(gorunum: AnketDoldurGorunumu) -> dict:
    """AnketDoldurGorunumu'nu cevaplama ekranının beklediği JSON-güvenli sözlüğe çevirir.

    soru_metni/secenek_metni Service'te sanitize edilmiş HTML'dir (frontend render
    eder). Hassas/iç alan (durum, tarih, atama_id) taşınmaz. tamamlandi_mi frontend'in
    formu salt-okunur gösterebilmesi içindir; otorite yine sunucudadır.
    """
    return {
        "anket_id": gorunum.anket_id,
        "ad": gorunum.ad,
        "on_yazi": gorunum.on_yazi,
        "son_yazi": gorunum.son_yazi,
        "tamamlandi_mi": gorunum.tamamlandi_mi,
        "sorular": [
            {
                "soru_id": soru.soru_id,
                "soru_metni": soru.soru_metni,
                "soru_tipi": soru.soru_tipi,
                "zorunlu_mu": soru.zorunlu_mu,
                "sira_no": soru.sira_no,
                "secenekler": [
                    {
                        "secenek_id": secenek.secenek_id,
                        "secenek_metni": secenek.secenek_metni,
                        "sira_no": secenek.sira_no,
                    }
                    for secenek in soru.secenekler
                ],
            }
            for soru in gorunum.sorular
        ],
    }


def _hata_yaniti(kod: str, mesaj: str) -> dict:
    """Güvenli hata yanıtı üretir (yalnızca kod + kullanıcıya uygun mesaj)."""
    return {"basari": False, "kod": kod, "mesaj": mesaj}

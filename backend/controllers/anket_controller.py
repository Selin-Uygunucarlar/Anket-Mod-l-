"""Anket (oluşturma + listeleme + detay + güncelleme, admin) Controller — ince sınır.

Neden: Oturum doğrulaması, girdinin tip/biçim doğrulaması, Service çağrısı ve
response dönüşümü burada orkestre edilir. İŞ KURALI BURADA YOK: geçerli durum/
anket tipi/erişim seviyesi kümeleri, tarih hesabı, soruların DB'de var olması,
"görebilen güncelleyebilir" görünürlük/yetki kararı anket_service'te; oturum mantığı
oturum_service'te. Bu katman SQL/DB detayı bilmez ve Repository'yi çağırmaz.

Ekleme ile güncelleme AYNI gövdeyi paylaşır; tip/şekil doğrulaması tek yerde
(_dogrula_ekle_girdisi) yapılır ve iki uç da onu kullanır (DRY).

Sınır (boundary) sorumluluğu: Bu katman error pipeline'ın giriş noktasıdır. Hata
burada BİR KEZ loglanır ve kullanıcıya güvenli yanıt döner. Stack trace, ham DB
hatası veya tablo adı ASLA yanıta konmaz.
"""

from common.errors import AppError, ValidationError
from common.logger import logla_sinir_hatasi
from models.anket import AnketDetay, AnketOzeti
from services import anket_service, oturum_service


def list_anketler(ham_jeton: str) -> dict:
    """Oturumu doğrulanmış admin için tüm anketlerin liste özetini döndürür.

    Cookie'den gelen ham jeton oturum_service ile doğrulanır (geçersiz ->
    OturumError); yetki kararı anket_service'e bırakılır (admin değil ->
    YetkiYokError). Hata BİR KEZ loglanır ve güvenli yanıt döner.

    Başarılı: {"basari": True, "anketler": [ {anket alanları...}, ... ]}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "anket_listesi"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        anketler = anket_service.list_anketler(sahip)
        return {
            "basari": True,
            "anketler": [_anket_to_dict(anket) for anket in anketler],
        }
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def get_anket_detay(ham_jeton: str, anket_id: int) -> dict:
    """Oturumu doğrulanmış admin için tek bir anketin düzenleme detayını döndürür.

    Oturum doğrulanır; anket_id pozitif tamsayı olmalı (_dogrula_pozitif_kimlik).
    Yetki (yalnızca admin) ve "görebilen görebilir/güncelleyebilir" görünürlük kararı
    anket_service'e bırakılır (admin değil -> YetkiYokError; görünmüyor/yok ->
    NotFoundError). Dönen anketin bağlı soru metinleri Service'te sanitize edilmiştir.
    Hata BİR KEZ loglanır ve güvenli yanıt döner; teknik detay sızmaz.

    Başarılı: {"basari": True, "anket": {anket alanları...}}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "anket_detay", "anket_id": anket_id}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_pozitif_kimlik(anket_id, "Geçersiz anket kimliği.")
        anket = anket_service.get_anket(sahip, anket_id)
        return {"basari": True, "anket": _detay_to_dict(anket)}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def ekle_anket(
    ham_jeton: str,
    ad: str,
    on_yazi: str | None,
    son_yazi: str | None,
    aciklama: str | None,
    durum: str,
    anket_tipi: str,
    erisim_seviyesi: str | None,
    baslangic_secim: str,
    baslangic_tarih: str | None,
    bitis_secim: str,
    bitis_tarih: str | None,
    soru_idler: list[int],
    grup_idler: list[int],
    kullanici_kodlari: list[str],
) -> dict:
    """Oturumu doğrulanmış admin için yeni bir anket oluşturur (atamalarıyla birlikte).

    Oturum doğrulanır; girdinin yalnızca tip/şekli bu sınırda doğrulanır (zorunlu
    metinler str + boş değil; opsiyonel metinler str ya da None; soru_idler/grup_idler
    pozitif int listesi; kullanici_kodlari boş olmayan metin listesi). İş kuralları,
    tarih hesabı, atanacak kişilerin çözümü ve yetki anket_service'e aittir;
    olusturan_kodu ve erişim grubu Service'te oturumdan çözülür (gövdede yoktur).
    Hata BİR KEZ loglanır ve güvenli yanıt döner.

    Başarılı: {"basari": True, "anket_id": <int>}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "anket_ekle"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_ekle_girdisi(
            ad,
            on_yazi,
            son_yazi,
            aciklama,
            durum,
            anket_tipi,
            erisim_seviyesi,
            baslangic_secim,
            baslangic_tarih,
            bitis_secim,
            bitis_tarih,
            soru_idler,
            grup_idler,
            kullanici_kodlari,
        )
        yeni_anket_id = anket_service.ekle_anket(
            sahip,
            ad,
            on_yazi,
            son_yazi,
            aciklama,
            durum,
            anket_tipi,
            erisim_seviyesi,
            baslangic_secim,
            baslangic_tarih,
            bitis_secim,
            bitis_tarih,
            soru_idler,
            grup_idler,
            kullanici_kodlari,
        )
        return {"basari": True, "anket_id": yeni_anket_id}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def guncelle_anket(
    ham_jeton: str,
    anket_id: int,
    ad: str,
    on_yazi: str | None,
    son_yazi: str | None,
    aciklama: str | None,
    durum: str,
    anket_tipi: str,
    erisim_seviyesi: str | None,
    baslangic_secim: str,
    baslangic_tarih: str | None,
    bitis_secim: str,
    bitis_tarih: str | None,
    soru_idler: list[int],
    grup_idler: list[int],
    kullanici_kodlari: list[str],
) -> dict:
    """Oturumu doğrulanmış admin için var olan bir anketi günceller (atamalarıyla).

    Oturum doğrulanır; anket_id pozitif tamsayı olmalı ve gövdenin tip/şekli EKLEME
    ile AYNI sınırda doğrulanır (_dogrula_ekle_girdisi yeniden kullanılır; ikinci bir
    doğrulama fonksiyonu yazılmaz). İş kuralları, tarih hesabı, atama farkı ve
    "görebilen güncelleyebilir" görünürlük/yetki kararı anket_service'e aittir
    (admin değil -> YetkiYokError; görünmüyor/yok -> NotFoundError); olusturan_kodu
    ve erişim grubu Service'te oturumdan çözülür. Hata BİR KEZ loglanır ve güvenli
    yanıt döner.

    Başarılı: {"basari": True}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "anket_guncelle", "anket_id": anket_id}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_pozitif_kimlik(anket_id, "Geçersiz anket kimliği.")
        _dogrula_ekle_girdisi(
            ad,
            on_yazi,
            son_yazi,
            aciklama,
            durum,
            anket_tipi,
            erisim_seviyesi,
            baslangic_secim,
            baslangic_tarih,
            bitis_secim,
            bitis_tarih,
            soru_idler,
            grup_idler,
            kullanici_kodlari,
        )
        anket_service.guncelle_anket(
            sahip,
            anket_id,
            ad,
            on_yazi,
            son_yazi,
            aciklama,
            durum,
            anket_tipi,
            erisim_seviyesi,
            baslangic_secim,
            baslangic_tarih,
            bitis_secim,
            bitis_tarih,
            soru_idler,
            grup_idler,
            kullanici_kodlari,
        )
        return {"basari": True}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def _dogrula_ekle_girdisi(
    ad,
    on_yazi,
    son_yazi,
    aciklama,
    durum,
    anket_tipi,
    erisim_seviyesi,
    baslangic_secim,
    baslangic_tarih,
    bitis_secim,
    bitis_tarih,
    soru_idler,
    grup_idler,
    kullanici_kodlari,
) -> None:
    """Anket ekleme girdisinin tip/şeklini sınırda doğrular; ihlalde ValidationError.

    Yalnızca ŞEKİL kontrolü yapılır. Değerlerin anlamlı olup olmadığı (durumun/
    tipin/seviyenin geçerli kümede olması, tarih hesabı, soru/grup/kullanıcıların
    DB'de bulunması, tekrar ve tekilleştirme) Service'in işidir; sınır ince tutulur.
    """
    _dogrula_zorunlu_metin(ad, "Anket adı")
    _dogrula_zorunlu_metin(durum, "Durum")
    _dogrula_zorunlu_metin(anket_tipi, "Anket tipi")
    _dogrula_zorunlu_metin(baslangic_secim, "Başlangıç tarihi seçimi")
    _dogrula_zorunlu_metin(bitis_secim, "Bitiş tarihi seçimi")

    _dogrula_istege_bagli_metin(on_yazi, "Ön yazı")
    _dogrula_istege_bagli_metin(son_yazi, "Son yazı")
    _dogrula_istege_bagli_metin(aciklama, "Açıklama")
    _dogrula_istege_bagli_metin(erisim_seviyesi, "Erişim seviyesi")
    _dogrula_istege_bagli_metin(baslangic_tarih, "Başlangıç tarihi")
    _dogrula_istege_bagli_metin(bitis_tarih, "Bitiş tarihi")

    _dogrula_soru_idler(soru_idler)
    _dogrula_grup_idler(grup_idler)
    _dogrula_kullanici_kodlari(kullanici_kodlari)


def _dogrula_zorunlu_metin(deger, alan_adi: str) -> None:
    """Bir alanın string ve boş/whitespace olmadığını doğrular; değilse ValidationError."""
    if not isinstance(deger, str) or not deger.strip():
        raise ValidationError(f"{alan_adi} zorunludur.")


def _dogrula_istege_bagli_metin(deger, alan_adi: str) -> None:
    """Opsiyonel bir alanın None ya da string olduğunu doğrular; değilse ValidationError.

    Boşluk/içerik kararı verilmez (boş metnin None'a çevrilmesi Service'in işidir);
    burada yalnızca tip elenir.
    """
    if deger is not None and not isinstance(deger, str):
        raise ValidationError(f"{alan_adi} metin olmalıdır.")


def _dogrula_soru_idler(soru_idler) -> None:
    """soru_idler'in liste ve her elemanının pozitif tamsayı olduğunu doğrular.

    Boş liste burada reddedilmez: "en az bir soru" bir İŞ KURALIDIR ve Service'e
    aittir. Elemanların DB'de var olup olmadığı da Service'te doğrulanır.
    """
    if not isinstance(soru_idler, list):
        raise ValidationError("Sorular bir liste olmalıdır.")
    for soru_id in soru_idler:
        _dogrula_pozitif_kimlik(soru_id, "Geçersiz soru kimliği.")


def _dogrula_grup_idler(grup_idler) -> None:
    """Ankete atanacak grup id'lerinin liste + pozitif tamsayı olduğunu doğrular.

    Boş liste burada reddedilmez: atama seçimi zorunlu DEĞİLDİR ve "kim atanır"
    kararı (grubun varlığı, üyelerine çözülmesi, tekrar) Service'e aittir.
    """
    if not isinstance(grup_idler, list):
        raise ValidationError("Gruplar bir liste olmalıdır.")
    for grup_id in grup_idler:
        _dogrula_pozitif_kimlik(grup_id, "Geçersiz grup kimliği.")


def _dogrula_kullanici_kodlari(kullanici_kodlari) -> None:
    """Ankete atanacak sicillerin liste + boş olmayan metin olduğunu doğrular.

    Boş liste burada reddedilmez. Sicillerin DB'de var olup olmadığı Service'te
    doğrulanır; client'tan gelen sicile güvenilmez.
    """
    if not isinstance(kullanici_kodlari, list):
        raise ValidationError("Kullanıcılar bir liste olmalıdır.")
    for kullanici_kodu in kullanici_kodlari:
        if not isinstance(kullanici_kodu, str) or not kullanici_kodu.strip():
            raise ValidationError("Geçersiz kullanıcı sicili.")


def _dogrula_pozitif_kimlik(deger, hata_mesaji: str) -> None:
    """Bir kimliğin pozitif tamsayı olduğunu doğrular; değilse ValidationError.

    bool, int'in alt tipidir; True/False'un geçerli kimlik sayılmaması için tip
    ayrıca bool'a karşı elenir.
    """
    if isinstance(deger, bool) or not isinstance(deger, int) or deger <= 0:
        raise ValidationError(hata_mesaji)


def _anket_to_dict(anket: AnketOzeti) -> dict:
    """Tek bir AnketOzeti'ni JSON-güvenli sözlüğe çevirir.

    olusturma_tarihi ISO 8601 string'e çevrilir. Oluşturan ad/soyad AYRI tutulur
    (isim birleştirme/format frontend'in işidir); oluşturan silinmişse None kalır.
    """
    return {
        "anket_id": anket.anket_id,
        "ad": anket.ad,
        "durum": anket.durum,
        "olusturan_ad": anket.olusturan_ad,
        "olusturan_soyad": anket.olusturan_soyad,
        "olusturma_tarihi": anket.olusturma_tarihi.isoformat(),
        "atanan_sayisi": anket.atanan_sayisi,
        "yanitlayan_sayisi": anket.yanitlayan_sayisi,
    }


def _detay_to_dict(anket: AnketDetay) -> dict:
    """Tek bir AnketDetay'i düzenleme formunun beklediği JSON-güvenli sözlüğe çevirir.

    baslangic_tarihi/bitis_tarihi ISO 8601 string'e (ya da None) çevrilir. Bağlı
    sorular {soru_id, soru_metni, soru_tipi} (soru_metni Service'te sanitize edilmiş
    HTML), atanan kullanıcılar {kullanici_kodu, ad, soyad, email} olarak listelenir
    (isim birleştirme/format frontend'in işidir). erisim_seviyesi/erisim_grup_id/
    olusturan_kodu aynen taşınır; hassas alan yoktur.
    """
    return {
        "anket_id": anket.anket_id,
        "ad": anket.ad,
        "on_yazi": anket.on_yazi,
        "son_yazi": anket.son_yazi,
        "aciklama": anket.aciklama,
        "durum": anket.durum,
        "anket_tipi": anket.anket_tipi,
        "erisim_seviyesi": anket.erisim_seviyesi,
        "erisim_grup_id": anket.erisim_grup_id,
        "baslangic_tarihi": _iso_ya_da_none(anket.baslangic_tarihi),
        "bitis_tarihi": _iso_ya_da_none(anket.bitis_tarihi),
        "olusturan_kodu": anket.olusturan_kodu,
        "bagli_sorular": [
            {
                "soru_id": soru.soru_id,
                "soru_metni": soru.soru_metni,
                "soru_tipi": soru.soru_tipi,
            }
            for soru in anket.bagli_sorular
        ],
        "atanan_kullanicilar": [
            {
                "kullanici_kodu": kullanici.kullanici_kodu,
                "ad": kullanici.ad,
                "soyad": kullanici.soyad,
                "email": kullanici.email,
            }
            for kullanici in anket.atanan_kullanicilar
        ],
    }


def _iso_ya_da_none(deger):
    """Bir date/datetime değerini ISO 8601 string'e çevirir; None ise None döner."""
    return deger.isoformat() if deger is not None else None


def _hata_yaniti(kod: str, mesaj: str) -> dict:
    """Güvenli hata yanıtı üretir (yalnızca kod + kullanıcıya uygun mesaj)."""
    return {"basari": False, "kod": kod, "mesaj": mesaj}

"""Kullanıcı grupları (admin) Controller katmanı — ince sınır.

Neden: Oturum doğrulaması, sınır tip/şekil doğrulaması, Service çağrısı ve response
dönüşümü burada orkestre edilir. İş kuralı/yetki kararı grup_service'te, oturum
mantığı oturum_service'te; bu katman SQL/DB detayı bilmez.

Sınır (boundary) sorumluluğu: Bu katman error pipeline'ın giriş noktasıdır. Hata
burada BİR KEZ loglanır ve kullanıcıya güvenli yanıt döner. Stack trace, ham DB
hatası, tablo adı ASLA yanıta konmaz. Serileştirme yalnızca gösterimi güvenli
alanları taşır (GrupUyesi'de hassas alan yoktur).
"""

from common.errors import AppError, ValidationError
from common.logger import logla_sinir_hatasi
from models.kullanici_grubu import GrupUyesi, KullaniciGrubu
from services import grup_service, oturum_service


def list_gruplar(ham_jeton: str) -> dict:
    """Oturumu doğrulanmış admin için tüm grupları üye sayısıyla döndürür.

    Cookie'den gelen ham jeton oturum_service ile doğrulanır (geçersiz ->
    OturumError); yetki kararı grup_service'e bırakılır (admin değil -> YetkiYokError).
    Hata BİR KEZ loglanır ve güvenli yanıt döner.

    Başarılı: {"basari": True, "gruplar": [ {grup_id, ad, uye_sayisi}, ... ]}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "grup_listesi"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        gruplar = grup_service.list_gruplar(sahip)
        return {"basari": True, "gruplar": [_grup_to_dict(grup) for grup in gruplar]}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def create_grup(ham_jeton: str, ad: str) -> dict:
    """Oturumu doğrulanmış admin için yeni bir grup oluşturur; grup_id döndürür.

    Oturum doğrulanır; girdinin tip/şekli sınırda doğrulanır (ad metin olmalı). İş
    kuralı (boş/uzunluk/tekrar) ve yetki grup_service'e aittir. Hata BİR KEZ loglanır.

    Başarılı: {"basari": True, "grup_id": <int>}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "grup_ekle"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_metin(ad, "Grup adı")
        yeni_grup_id = grup_service.create_grup(sahip, ad)
        return {"basari": True, "grup_id": yeni_grup_id}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def delete_grup(ham_jeton: str, grup_id) -> dict:
    """Oturumu doğrulanmış admin için bir grubu siler (idempotent).

    Oturum doğrulanır; grup_id sınırda int'e çevrilir. Yetki/iş kuralı (geçerli
    kimlik) grup_service'te. Silme idempotenttir; üyeler grupsuz kalır. Hata BİR KEZ
    loglanır ve güvenli yanıt döner.

    Başarılı: {"basari": True}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "grup_sil"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        grup_service.delete_grup(sahip, _int_grup_id(grup_id))
        return {"basari": True}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def list_grup_uyeleri(ham_jeton: str, grup_id) -> dict:
    """Oturumu doğrulanmış admin için bir grubun üyelerini döndürür.

    Oturum doğrulanır; grup_id sınırda int'e çevrilir. Yetki/iş kuralı grup_service'te.
    Grup yoksa ya da üyesi yoksa boş liste döner. Hata BİR KEZ loglanır.

    Başarılı: {"basari": True, "uyeler": [ {kullanici_kodu, ad, soyad, email}, ... ]}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "grup_uyeleri"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        uyeler = grup_service.list_grup_uyeleri(sahip, _int_grup_id(grup_id))
        return {"basari": True, "uyeler": [_uye_to_dict(uye) for uye in uyeler]}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def assign_uye(ham_jeton: str, grup_id, kullanici_kodu: str) -> dict:
    """Oturumu doğrulanmış admin için bir kullanıcıyı bir gruba atar.

    Oturum doğrulanır; grup_id int'e çevrilir, kullanici_kodu metin olarak doğrulanır.
    İş kuralı (geçerli kimlik, tek grup kuralı: taşıma) ve yetki grup_service'te. Hata
    BİR KEZ loglanır ve güvenli yanıt döner.

    Başarılı: {"basari": True}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "grup_uye_ata"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_metin(kullanici_kodu, "Kullanıcı kodu")
        grup_service.assign_uye(sahip, _int_grup_id(grup_id), kullanici_kodu)
        return {"basari": True}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def remove_uye(ham_jeton: str, kullanici_kodu: str) -> dict:
    """Oturumu doğrulanmış admin için bir kullanıcıyı (bulunduğu) gruptan çıkarır.

    Oturum doğrulanır; kullanici_kodu metin olarak doğrulanır. Tek grup kuralı gereği
    hangi gruptan çıkarıldığı önemli değildir (üyelik NULL'lanır); bu yüzden grup_id
    Service'e taşınmaz. Yetki grup_service'te. Hata BİR KEZ loglanır.

    Başarılı: {"basari": True}.
    Başarısız: {"basari": False, "kod": <hata kodu>, "mesaj": <güvenli mesaj>}.
    """
    baglam = {"islem": "grup_uye_cikar"}
    try:
        sahip = oturum_service.oturum_dogrula(ham_jeton)
        _dogrula_metin(kullanici_kodu, "Kullanıcı kodu")
        grup_service.remove_uye(sahip, kullanici_kodu)
        return {"basari": True}
    except AppError as hata:
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti(hata.kod, hata.mesaj)
    except Exception as hata:  # noqa: BLE001 - sınır katmanı: yut değil, logla+güvenli dön
        logla_sinir_hatasi(hata, baglam=baglam)
        return _hata_yaniti("UNEXPECTED_ERROR", "Beklenmeyen bir hata oluştu.")


def _dogrula_metin(deger, alan_adi: str) -> None:
    """Bir alanın string ve boş/whitespace olmadığını doğrular; değilse ValidationError.

    Sınır tip/şekil kontrolüdür (iş kuralı değil); içerik/uzunluk/tekrar kararı Service'e
    aittir.
    """
    if not isinstance(deger, str) or not deger.strip():
        raise ValidationError(f"{alan_adi} zorunludur.")


def _int_grup_id(grup_id) -> int:
    """grup_id'yi sınırda int'e çevirir; çevrilemezse ValidationError.

    HTTP path parametresi zaten int gelir; yine de client'a körlemesine güvenilmez,
    çevrilebilirlik burada garanti edilir. Geçerli aralık (pozitif) kararı Service'te.
    """
    if isinstance(grup_id, bool):
        raise ValidationError("Geçersiz grup kimliği.")
    try:
        return int(grup_id)
    except (TypeError, ValueError) as hata:
        raise ValidationError("Geçersiz grup kimliği.") from hata


def _grup_to_dict(grup: KullaniciGrubu) -> dict:
    """Tek bir KullaniciGrubu'nu JSON-güvenli sözlüğe çevirir."""
    return {
        "grup_id": grup.grup_id,
        "ad": grup.ad,
        "uye_sayisi": grup.uye_sayisi,
    }


def _uye_to_dict(uye: GrupUyesi) -> dict:
    """Tek bir GrupUyesi'ni JSON-güvenli sözlüğe çevirir (yalnızca güvenli alanlar)."""
    return {
        "kullanici_kodu": uye.kullanici_kodu,
        "ad": uye.ad,
        "soyad": uye.soyad,
        "email": uye.email,
    }


def _hata_yaniti(kod: str, mesaj: str) -> dict:
    """Güvenli hata yanıtı üretir (yalnızca kod + kullanıcıya uygun mesaj)."""
    return {"basari": False, "kod": kod, "mesaj": mesaj}

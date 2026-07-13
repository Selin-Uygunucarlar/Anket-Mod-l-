"""Kullanıcı grupları (ilişkisel) iş katmanı.

Neden: İlişkisel "Kullanıcı Grupları" özelliğinin iş kuralları burada uygulanır:
tüm uçlar YÖNETİM ucudur -> YALNIZCA admin. Yetki client'tan gelen role/id'ye
değil, sunucu tarafı oturumun sahibine (OturumSahibi) göre belirlenir; admin
değilse veri erişimine geçilmeden YetkiYokError fırlatılır (Repository ÇAĞRILMADAN).

Bu katman HTTP ve SQL bilmez; veriye Repository üzerinden erişir, DB'ye doğrudan
dokunmaz. Ayrım: buradaki "grup" Kullanici.grup_id ile kurulan İLİŞKİSEL gruptur;
mevcut serbest-metin Kullanici.grup etiketiyle karıştırılmaz (tek grup kuralı:
bir kullanıcı en fazla bir gruba aittir).

Hata yönetimi: Hatalar burada LOGLANMAZ, yukarı fırlatılır; loglama yalnızca sınır
katmanında bir kez yapılır. Ad tekrarında kullanıcıya anlamlı mesaj vermek için
ön kontrol yapılır; nihai benzersizlik garantisi DB UNIQUE'tir (yarış durumunda
teknik hata DataAccessError olarak yukarı çıkar).
"""

from common.errors import ValidationError, YetkiYokError
from models.kullanici_grubu import GrupUyesi, KullaniciGrubu
from models.oturum import OturumSahibi
from repositories import grup_repository

_ADMIN_TURU = "admin"

# Grup adı üst uzunluk sınırı (DB KullaniciGrubu.ad VARCHAR(100) ile birebir).
_AD_MAX_UZUNLUK = 100


def list_gruplar(talep_eden: OturumSahibi) -> list[KullaniciGrubu]:
    """Tüm grupları üye sayısıyla döner; yalnızca admin çağırabilir.

    Yetki talep edenin (doğrulanmış oturum sahibi) kullanici_turu'ne göre belirlenir;
    admin değilse veri erişimine geçilmeden YetkiYokError fırlatılır.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()
    return grup_repository.gruplari_getir()


def create_grup(talep_eden: OturumSahibi, ad: str) -> int:
    """Yeni bir grup oluşturur ve oluşan grup_id'yi döner; yalnızca admin çağırabilir.

    İş kuralları: ad boş/whitespace olamaz (strip'lenir), 100 karakteri aşamaz. Ad
    tekrarında kullanıcıya anlamlı mesaj vermek için mevcut gruplarla Türkçe/case-
    insensitive kıyas yapılır; çakışmada ValidationError üretilir. NİHAİ benzersizlik
    garantisi DB UNIQUE'tir: iki isteğin yarıştığı durumda DB ihlali DataAccessError
    olarak yukarı çıkar (jenerik güvenli mesaj) — bu kabul edilebilir. Hata loglanmaz.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    ad_temiz = _zorunlu_alan(ad, "Grup adı")
    if len(ad_temiz) > _AD_MAX_UZUNLUK:
        raise ValidationError(
            f"Grup adı en fazla {_AD_MAX_UZUNLUK} karakter olabilir."
        )

    # Anlamlı "zaten var" mesajı için ön kontrol (Türkçe/case-insensitive); nihai
    # garanti DB UNIQUE. Yarış durumunda DB ihlali DataAccessError olarak döner.
    hedef = _turkce_kucult(ad_temiz)
    for grup in grup_repository.gruplari_getir():
        if _turkce_kucult(grup.ad) == hedef:
            raise ValidationError("Bu grup adı zaten var.")

    return grup_repository.grup_ekle(ad_temiz)


def delete_grup(talep_eden: OturumSahibi, grup_id: int) -> None:
    """Bir grubu siler; yalnızca admin çağırabilir. Silme idempotenttir.

    grup_id geçerli (pozitif) bir tamsayı değilse ValidationError. Grup yoksa da
    hata değildir (Repository idempotent); üyeler FK ON DELETE SET NULL ile grupsuz
    kalır. Hata loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    gecerli_id = _dogrula_grup_id(grup_id)
    grup_repository.grup_sil(gecerli_id)


def list_grup_uyeleri(talep_eden: OturumSahibi, grup_id: int) -> list[GrupUyesi]:
    """Bir grubun üyelerini güvenli özet olarak döner; yalnızca admin çağırabilir.

    grup_id geçerli (pozitif) bir tamsayı değilse ValidationError. Grup yoksa ya da
    üyesi yoksa boş liste döner (Repository NotFound fırlatmaz). Hata loglanmaz.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    gecerli_id = _dogrula_grup_id(grup_id)
    return grup_repository.grup_uyeleri(gecerli_id)


def assign_uye(talep_eden: OturumSahibi, grup_id: int, kullanici_kodu: str) -> None:
    """Bir kullanıcıyı bir gruba atar; yalnızca admin çağırabilir.

    grup_id geçerli (pozitif) tamsayı, kullanici_kodu boş olmayan metin olmalıdır;
    değilse ValidationError. Tek grup kuralı gereği kullanıcı zaten başka bir gruptaysa
    bu atama onu YENİ gruba taşır (beklenen davranış; Repository UPDATE tek satır).
    Hata loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    gecerli_id = _dogrula_grup_id(grup_id)
    kod = _zorunlu_alan(kullanici_kodu, "Kullanıcı kodu")
    grup_repository.gruba_ata(kod, gecerli_id)


def remove_uye(talep_eden: OturumSahibi, kullanici_kodu: str) -> None:
    """Bir kullanıcıyı (bulunduğu) gruptan çıkarır; yalnızca admin çağırabilir.

    Tek grup kuralı gereği kullanıcı en fazla bir gruba ait olduğundan hangi gruptan
    çıkarıldığı önemli değildir: grup_id=None ile üyelik kaldırılır (grup_id NULL).
    kullanici_kodu boş olamaz -> ValidationError. Hata loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    kod = _zorunlu_alan(kullanici_kodu, "Kullanıcı kodu")
    grup_repository.gruba_ata(kod, None)


def _dogrula_grup_id(grup_id) -> int:
    """grup_id'nin pozitif tamsayı olduğunu doğrular; değilse ValidationError.

    bool, int'in alt tipidir; True/False'un geçerli kimlik sayılmaması için tip
    ayrıca bool'a karşı elenir.
    """
    if isinstance(grup_id, bool) or not isinstance(grup_id, int) or grup_id <= 0:
        raise ValidationError("Geçersiz grup kimliği.")
    return grup_id


def _zorunlu_alan(deger, alan_adi: str) -> str:
    """Zorunlu string alanı doğrular; boş/whitespace ise ValidationError fırlatır."""
    if not deger or not str(deger).strip():
        raise ValidationError(f"{alan_adi} zorunludur.")
    return str(deger).strip()


def _turkce_kucult(metin: str) -> str:
    """Metni Türkçe kurallarıyla küçük harfe indirger (case-insensitive kıyas için).

    Neden: Grup adı benzersizliği DB'de Türkçe collation'la (utf8mb4_turkish_ci)
    denetlenir; "zaten var" ön kontrolü de aynı davranışa yaklaşsın diye 'I'/'İ'
    Türkçe eşlenip ardından casefold uygulanır (ör. "IK" ile "ık" eşit sayılır).
    """
    return metin.replace("I", "ı").replace("İ", "i").casefold()

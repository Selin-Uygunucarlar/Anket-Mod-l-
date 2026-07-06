"""Yönetilen dropdown seçenekleri (TanimliSecenek) iş katmanı.

Neden: Kullanıcı ekleme formundaki 10 dropdown alanının seçeneklerini listeleme ve
yeni seçenek ekleme iş kuralları burada toplanır. Bu bir YÖNETİM ucudur: yalnızca
admin listeleyebilir/ekleyebilir. Yetki, client'tan gelen role değil, sunucu tarafı
oturumun sahibine (OturumSahibi) göre belirlenir. Kategori, sabit kümeye ait mi
kontrolü de burada yapılır (Repository kategori/rol bilmez).

Bu katman HTTP ve SQL bilmez; veriye Repository üzerinden erişir. Hatalar burada
LOGLANMAZ, yukarı fırlatılır (dup seçenek -> Repository'den SecenekZatenVarError
geçer); loglama yalnızca sınır katmanında bir kez yapılır.
"""

from common.errors import ValidationError, YetkiYokError
from models.oturum import OturumSahibi
from models.secenek import SecenekKaydi
from repositories import secenek_repository

_ADMIN_TURU = "admin"

# Dropdown alanlarının sabit kimlik kümesi; DB şemasıyla (migration 005) birebir.
# kullanici_turu bu kümede DEĞİL (sabit 'admin'/'user', seçenekle yönetilmez).
KATEGORILER = (
    "sirket",
    "grup",
    "bolum",
    "birim",
    "kadro_grubu",
    "kadro_unvani",
    "gorev_unvani",
    "arge_personeli",
    "personel_sigorta_is_yeri",
    "gorev_yeri",
)


def list_secenekler(talep_eden: OturumSahibi) -> list[SecenekKaydi]:
    """Tüm dropdown seçeneklerini döner; yalnızca admin çağırabilir.

    admin değilse veri erişimine geçilmeden YetkiYokError fırlatılır. Admin ise
    Repository'den tüm seçenekler döndürülür; kategoriye göre gruplama üst katmanın işi.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()
    return secenek_repository.list_secenekler()


def ekle_secenek(talep_eden: OturumSahibi, kategori: str, deger: str) -> None:
    """Verilen kategoriye yeni bir seçenek değeri ekler; yalnızca admin çağırabilir.

    admin değilse YetkiYokError. kategori sabit kümede değilse veya deger boş/whitespace
    ise ValidationError. deger .strip()'lenerek Repository'ye yazılır. Aynı (kategori,
    deger) zaten varsa Repository SecenekZatenVarError fırlatır; olduğu gibi geçer.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()
    if kategori not in KATEGORILER:
        raise ValidationError("Geçersiz seçenek kategorisi.")
    if not deger or not deger.strip():
        raise ValidationError("Seçenek değeri zorunludur.")

    secenek_repository.ekle_secenek(kategori, deger.strip())


def sil_secenek(talep_eden: OturumSahibi, kategori: str, deger: str) -> None:
    """Verilen kategorideki bir seçenek değerini siler; yalnızca admin çağırabilir.

    admin değilse YetkiYokError. kategori sabit kümede değilse veya deger boş/whitespace
    ise ValidationError. deger .strip()'lenerek Repository'ye geçilir. Silme idempotenttir:
    kayıt yoksa da başarı sayılır (Repository sessizce döner).
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()
    if kategori not in KATEGORILER:
        raise ValidationError("Geçersiz seçenek kategorisi.")
    if not deger or not deger.strip():
        raise ValidationError("Seçenek değeri zorunludur.")

    secenek_repository.sil_secenek(kategori, deger.strip())

"""Kullanıcı yönetimi (admin kullanıcı listesi) iş katmanı.

Neden: Kullanıcı listeleme işleminin yetki iş kuralı burada uygulanır. Bu uç
YALNIZCA admin içindir; yetki kontrolü client'tan gelen role/id'ye değil, sunucu
tarafı oturumun sahibine (OturumSahibi) göre yapılır. Bu katman HTTP ve SQL
bilmez; veriye Repository üzerinden erişir, DB'ye doğrudan dokunmaz.

Hata yönetimi: Hatalar burada LOGLANMAZ, yukarı fırlatılır. Admin olmayan istek
için YetkiYokError döner (Repository ÇAĞRILMADAN); loglama yalnızca sınır
katmanında bir kez yapılır.
"""

from common.errors import YetkiYokError
from models.kullanici_ozet import KullaniciOzet
from models.oturum import OturumSahibi
from repositories import kullanici_repository

_ADMIN_TURU = "admin"


def list_kullanicilar(talep_eden: OturumSahibi) -> list[KullaniciOzet]:
    """Tüm kullanıcıları güvenli özet olarak döner; yalnızca admin çağırabilir.

    Yetki, talep edenin (doğrulanmış oturum sahibi) kullanici_turu'ne göre
    belirlenir; admin değilse veri erişimine geçilmeden YetkiYokError fırlatılır.
    Admin ise Repository'den kullanıcı listesi döndürülür.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()
    return kullanici_repository.list_kullanicilar()

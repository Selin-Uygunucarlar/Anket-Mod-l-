"""Kişi detay panelinin veri nesnesi (DTO).

Neden: Admin, kullanıcı listesinde bir kişiye tıklayınca sağdaki detay paneli o
kullanıcının DB'de saklanan tüm güvenli bilgilerini gösterir. Repository, Kullanici
(öz-JOIN ile yönetici adı) ve KullaniciKimlik (son giriş) satırlarını bu tek nesneye
eşleyip Service'e döner; Service tablo/şema detayı bilmeden çalışır. KullaniciOzet
liste satırının kısa özetidir; bu DTO ise tek kullanıcının tam (güvenli) detayıdır.

Güvenlik: sifre_hash, hatali_giris_sayisi ve diğer hassas kimlik alanları bu DTO'ya
BİLEREK konmaz; yalnızca gösterilmesi güvenli alanlar taşınır. Böylece hassas veri
kazara yanıta veya loga sızamaz.
"""

from dataclasses import dataclass
from datetime import date, datetime


@dataclass
class KullaniciDetay:
    """Kişi detay panelinde gösterilen tek bir kullanıcının tam güvenli detayı."""

    kullanici_kodu: str
    ad: str
    soyad: str
    email: str
    kullanici_turu: str                       # yalnızca 'admin' veya 'user'
    aktif: bool                               # hesap etkin mi (rol/tür değil, kullanım durumu)
    ise_giris_tarihi: date | None             # işe giriş; bilinmiyorsa None
    ilgili_yonetici_kodu: str | None          # yöneticinin kullanici_kodu'su; yönetici yoksa None
    yonetici_ad: str | None                   # ilgili yöneticinin adı; yönetici yoksa None
    yonetici_soyad: str | None                # ilgili yöneticinin soyadı; yönetici yoksa None
    sirket: str | None                        # organizasyon bilgileri; tanımsızsa None
    grup: str | None
    bolum: str | None
    birim: str | None
    kadro_grubu: str | None
    kadro_unvani: str | None
    gorev_unvani: str | None
    arge_personeli: str | None
    personel_sigorta_is_yeri: str | None
    gorev_yeri: str | None
    olusturma_tarihi: datetime | None         # sisteme eklenme anı; geriye dönük bilinmiyorsa None
    son_giris_tarihi: datetime | None         # sisteme son giriş anı; hiç giriş yoksa None

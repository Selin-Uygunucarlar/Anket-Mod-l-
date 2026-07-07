"""Kullanıcı listesi satırının veri nesnesi (DTO).

Neden: Repository, admin kullanıcı listesi için Kullanici (öz-JOIN ile yönetici)
ve KullaniciKimlik satırlarını bu tek nesneye eşleyip Service'e döner; Service
tablo/şema detayı bilmeden çalışır. Her satır listede gösterilecek bir kullanıcıyı
özetler.

Güvenlik: sifre_hash veya herhangi bir hassas kimlik alanı bu DTO'ya BİLEREK
konmaz; yalnızca listede gösterilmesi güvenli olan alanlar taşınır. Böylece
hassas veri kazara yanıta veya loga sızamaz.
"""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class KullaniciOzet:
    """Admin kullanıcı listesinde gösterilen tek bir kullanıcının güvenli özeti."""

    kullanici_kodu: str
    ad: str
    soyad: str
    aktif: bool                        # hesap etkin mi (rol/tür değil, kullanım durumu)
    email: str
    ilgili_yonetici_kodu: str | None   # yöneticinin kullanici_kodu'su; listede adına tıklayınca detayını açmak için (yönetici yoksa None)
    yonetici_ad: str | None            # ilgili yöneticinin adı; yönetici yoksa None
    yonetici_soyad: str | None         # ilgili yöneticinin soyadı; yönetici yoksa None
    olusturma_tarihi: datetime | None  # sisteme eklenme anı; geriye dönük bilinmiyorsa None
    son_giris_tarihi: datetime | None  # sisteme son giriş anı; hiç giriş yoksa None

"""Login (giriş) akışının veri nesnesi (DTO).

Neden: Repository, Kullanici + KullaniciKimlik satırlarını bu tek nesneye
eşleyip Service'e döner; Service tablo/şema detayı bilmeden çalışır.

Güvenlik: sifre_hash yalnızca Service içi şifre doğrulaması için taşınır.
`repr=False` ile hash, nesnenin metinsel gösterimine (ve dolayısıyla kazara
loglara) girmez. sifre_hash asla loglanmaz veya kullanıcıya döndürülmez.
"""

from dataclasses import dataclass, field


@dataclass
class KullaniciKimlikKaydi:
    """Bir kullanıcının giriş için gereken kimlik + hesap bilgileri."""

    kullanici_kodu: str
    ad: str
    soyad: str
    email: str
    kullanici_turu: str
    sifre_hash: str = field(repr=False)  # gösterime/loglara sızmaması için
    hatali_giris_sayisi: int

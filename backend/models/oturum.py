"""Oturum doğrulama sonucunun veri nesnesi (DTO).

Neden: Repository, geçerli bir oturumu Oturum + Kullanici satırlarını JOIN'leyip
bu tek nesneye eşleyerek Service'e döner. Böylece /me benzeri uçlar, oturumun
sahibi kullanıcının güvenli kimlik bilgilerine tek çağrıda erişir; Service
tablo/şema detayı bilmeden çalışır.

Güvenlik: Oturum jetonu (ham token) ve SHA-256 özeti bu DTO'ya BİLEREK konmaz;
kimlik doğrulama sonucu yalnızca güvenli/genel alanları taşır. Böylece token/hash
kazara yanıta veya loga sızamaz.
"""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class OturumSahibi:
    """Geçerli bir oturumun sahibi kullanıcının güvenli kimlik bilgileri."""

    kullanici_kodu: str
    ad: str
    soyad: str
    kullanici_turu: str            # yalnızca 'admin' veya 'user'
    # Oturumun geçerlilik bitiş anı; Service kayan (sliding) yenilemeyi buna
    # göre yorumlar (yenileme eşiğine göre gecerlilik_bitisi'ni uzatabilir).
    gecerlilik_bitisi: datetime

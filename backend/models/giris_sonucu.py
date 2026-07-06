"""Başarılı giriş sonucu veri nesnesi (DTO).

Neden: Service, başarılı doğrulama sonrası kullanıcının YALNIZCA güvenli/genel
alanlarını üst katmana taşımak için bu nesneyi döner. sifre_hash gibi hassas
alanlar bu DTO'ya BİLEREK konmaz; böylece hash'in kazara yanıta/loga sızması
yapısal olarak imkânsız kılınır.
"""

from dataclasses import dataclass


@dataclass
class GirisSonucu:
    """Kimliği doğrulanmış kullanıcının güvenli kimlik bilgileri (hash yok)."""

    kullanici_kodu: str
    ad: str
    soyad: str
    kullanici_turu: str
    # Kimlik geçici (tek kullanımlık) şifre taşıyor mu. TRUE ise UI, girişten sonra
    # kullanıcıyı zorunlu kalıcı şifre belirlemeye yönlendirir. Hassas değildir.
    sifre_degistirilmeli: bool = False

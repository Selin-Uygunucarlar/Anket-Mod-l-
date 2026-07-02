"""Giriş (login) iş katmanı.

Neden: Tüm kimlik doğrulama iş kuralları burada toplanır: kaba kuvvet kilidi,
şifre doğrulama, kullanıcı enumerasyonu önleme. Bu katman HTTP ve SQL bilmez;
veriye Repository üzerinden erişir, DB'ye doğrudan dokunmaz.

Hata yönetimi: Hatalar burada LOGLANMAZ, yukarı fırlatılır. Kimlik doğrulama
başarısızlıkları tek genel AuthError ile döner. sifre/sifre_hash asla loglara,
hata mesajlarına veya döndürülen DTO'ya sızmaz.
"""

from datetime import datetime

import bcrypt

from common.constants import MAKS_HATALI_GIRIS
from common.errors import AuthError
from models.giris_sonucu import GirisSonucu
from repositories import kullanici_kimlik_repository as kimlik_repo


def verify_login(kimlik: str, sifre: str) -> GirisSonucu:
    """Kimlik (email veya SAP no) + şifre ile kullanıcıyı doğrular.

    Akış:
      1. Kaydı Repository'den çek; yoksa genel AuthError (enumerasyon önleme).
      2. Hesap kilitli mi (hatali_giris_sayisi >= eşik) → şifreyi KONTROL ETMEDEN
         AuthError.
      3. bcrypt ile şifreyi doğrula; yanlışsa hatalı sayacı arttır, AuthError.
      4. Doğruysa sayacı sıfırla + son giriş zamanını yaz, GirisSonucu döndür.

    Başarısız durumların hepsi AYNI genel AuthError mesajını taşır; "kayıt yok",
    "şifre yanlış", "kilitli" ayrımı dışarı sızdırılmaz.
    """
    kayit = kimlik_repo.find_kimlik_by_identifier(kimlik)

    # Kayıt yoksa şifre yanlışıyla aynı genel hata döner (enumerasyon önleme).
    if kayit is None:
        raise AuthError()

    # Kaba kuvvet kilidi: eşiğe ulaşmışsa şifre doğrulaması bile yapılmaz.
    if kayit.hatali_giris_sayisi >= MAKS_HATALI_GIRIS:
        raise AuthError()

    sifre_dogru = bcrypt.checkpw(
        sifre.encode("utf-8"), kayit.sifre_hash.encode("utf-8")
    )
    if not sifre_dogru:
        kimlik_repo.increment_hatali_giris(kayit.kullanici_kodu)
        raise AuthError()

    kimlik_repo.reset_hatali_giris_and_son_giris(
        kayit.kullanici_kodu, datetime.now()
    )

    # Yalnızca güvenli alanlar döner; sifre_hash bilerek taşınmaz.
    return GirisSonucu(
        kullanici_kodu=kayit.kullanici_kodu,
        ad=kayit.ad,
        soyad=kayit.soyad,
        kullanici_turu=kayit.kullanici_turu,
    )

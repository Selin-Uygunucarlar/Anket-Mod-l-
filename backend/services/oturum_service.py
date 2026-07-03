"""Sunucu tarafı oturum (server-side session) iş katmanı.

Neden: Oturum jetonu üretimi, jetonun SHA-256 özetlenmesi, kayan (sliding)
pencere/süre hesabı ve doğrulama/sonlandırma iş kuralları burada toplanır. Bu
katman HTTP ve SQL bilmez; veriye Repository üzerinden erişir, DB'ye doğrudan
dokunmaz.

Güvenlik: Ham oturum jetonu YALNIZCA bu katmanda üretilir ve çağırana (sonuçta
cookie'ye) döndürülür; DB'ye asla ham jeton değil, SHA-256 hex ÖZETİ verilir.
Ham jeton veya özeti log'a, hata mesajına ya da yanıt gövdesine ASLA konmaz.

Zaman kararı Service'e aittir: simdi = datetime.now() bir kez alınır; geçerlilik
bitişi "simdi + OTURUM_SURESI_DAKIKA" olarak hesaplanıp Repository'ye hazır
datetime parametreleriyle verilir. Repository süre/pencere hesabı yapmaz.

Hata yönetimi: Hatalar burada LOGLANMAZ, yukarı fırlatılır. Geçersiz/süresi
dolmuş/boş jeton için OturumError döner; loglama yalnızca sınır katmanında bir
kez yapılır.
"""

import hashlib
import secrets
from datetime import datetime, timedelta

from common.constants import OTURUM_SURESI_DAKIKA
from common.errors import OturumError
from models.oturum import OturumSahibi
from repositories import oturum_repository as oturum_repo


def oturum_olustur(kullanici_kodu: str) -> str:
    """Kullanıcı için yeni bir oturum açar ve HAM jetonu döndürür.

    Kriptografik güvenli bir ham jeton üretir, SHA-256 özetini DB'ye yazdırır ve
    geçerlilik bitişini kayan pencere uzunluğuna göre hesaplar. Ham jeton yalnızca
    çağırana (cookie'ye) döner; DB'ye yalnızca özeti girer.
    """
    ham_jeton = secrets.token_urlsafe(32)
    oturum_kodu_hash = _jeton_ozeti(ham_jeton)

    simdi = datetime.now()
    gecerlilik_bitisi = simdi + timedelta(minutes=OTURUM_SURESI_DAKIKA)

    oturum_repo.create_oturum(
        oturum_kodu_hash=oturum_kodu_hash,
        kullanici_kodu=kullanici_kodu,
        olusturma_tarihi=simdi,
        son_erisim_tarihi=simdi,
        gecerlilik_bitisi=gecerlilik_bitisi,
    )
    return ham_jeton


def oturum_dogrula(ham_jeton: str) -> OturumSahibi:
    """Ham jetonu doğrular; geçerliyse kayan pencereyi yenileyip sahibini döner.

    Boş/None jeton ya da eşleşen geçerli oturum yoksa OturumError fırlatır.
    Geçerliyse son erişim ve geçerlilik bitişini "şu an" referansına göre yeniler
    (sliding) ve oturum sahibinin güvenli kimlik bilgilerini döndürür.
    """
    if not ham_jeton:
        raise OturumError()

    oturum_kodu_hash = _jeton_ozeti(ham_jeton)
    simdi = datetime.now()

    sahip = oturum_repo.find_gecerli_oturum(oturum_kodu_hash, simdi)
    if sahip is None:
        raise OturumError()

    yeni_gecerlilik_bitisi = simdi + timedelta(minutes=OTURUM_SURESI_DAKIKA)
    oturum_repo.guncelle_son_erisim(
        oturum_kodu_hash=oturum_kodu_hash,
        yeni_son_erisim=simdi,
        yeni_gecerlilik_bitisi=yeni_gecerlilik_bitisi,
    )
    return sahip


def oturum_sonlandir(ham_jeton: str) -> None:
    """Ham jetona karşılık gelen oturumu siler (logout).

    Boş/None jetonda no-op'tur (silinecek oturum yok). Aksi halde jetonun özetiyle
    ilgili oturum satırı silinir; kayıt yoksa Repository sessizce etkisizdir.
    """
    if not ham_jeton:
        return
    oturum_repo.delete_oturum(_jeton_ozeti(ham_jeton))


def _jeton_ozeti(ham_jeton: str) -> str:
    """Ham jetonun SHA-256 hex özetini üretir (DB'de saklanan/sorgulanan değer).

    Ham jeton DB'ye hiç girmez; yalnızca bu geri döndürülemez özet saklanır.
    """
    return hashlib.sha256(ham_jeton.encode("utf-8")).hexdigest()

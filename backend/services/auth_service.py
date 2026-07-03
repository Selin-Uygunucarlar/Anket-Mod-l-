"""Giriş (login) iş katmanı.

Neden: Tüm kimlik doğrulama iş kuralları burada toplanır: kaba kuvvet kilidi ve
onun 5 dakikalık geçici penceresinin yorumlanması, şifre doğrulama, kullanıcı
enumerasyonu önleme. Bu katman HTTP ve SQL bilmez; veriye Repository üzerinden
erişir, DB'ye doğrudan dokunmaz.

Kilit yorumu: DB kilidin bitişini SAKLAMAZ; yalnızca son hatalı giriş anını
tutar. 5 dakikalık pencere burada (Service) yorumlanır; süre dolunca hesap
otomatik açılır.

Hata yönetimi: Hatalar burada LOGLANMAZ, yukarı fırlatılır. "Kayıt yok" ve
"şifre yanlış" tek genel AuthError ile döner; "hesap kilitli" ayrı
HesapKilitliError ile döner. sifre/sifre_hash asla loglara, hata mesajlarına
veya döndürülen DTO'ya sızmaz.
"""

from datetime import datetime, timedelta

import bcrypt

from common.constants import KILIT_SURESI_DAKIKA, MAKS_HATALI_GIRIS
from common.errors import AuthError, HesapKilitliError
from models.giris_sonucu import GirisSonucu
from repositories import kullanici_kimlik_repository as kimlik_repo


def verify_login(kimlik: str, sifre: str) -> GirisSonucu:
    """Kimlik (email veya SAP no) + şifre ile kullanıcıyı doğrular.

    Akış:
      1. Kaydı Repository'den çek; yoksa genel AuthError (enumerasyon önleme).
      2. Kaba kuvvet kilidi: sayaç eşiğe ulaşmışsa geçici kilidin (5 dk) dolup
         dolmadığına bakılır. Süre dolmamışsa şifre KONTROL EDİLMEDEN
         HesapKilitliError. Süre dolmuşsa sayaç sıfırlanır ve deneme sürer.
      3. bcrypt ile şifreyi doğrula; yanlışsa hatalı sayacı (o anki zamanla)
         arttır. Bu artışla sayaç eşiğe (MAKS_HATALI_GIRIS) ulaşıyorsa hesap o
         denemede kilitlenir ve HesapKilitliError döner; aksi halde AuthError.
      4. Doğruysa sayacı sıfırla + son giriş zamanını yaz, GirisSonucu döndür.

    "Kayıt yok" ve "şifre yanlış" AYNI genel AuthError mesajını taşır (ayrım
    sızdırılmaz); "hesap kilitli" ayrı HesapKilitliError ile bildirilir.
    """
    # Kilit penceresi ve zaman damgaları için tek bir referans an kullanılır.
    simdi = datetime.now()

    kayit = kimlik_repo.find_kimlik_by_identifier(kimlik)

    # Kayıt yoksa şifre yanlışıyla aynı genel hata döner (enumerasyon önleme).
    if kayit is None:
        raise AuthError()

    # Bu denemeden önceki geçerli hatalı sayaç; reset dalında 0'a düşer.
    mevcut_hatali_sayi = kayit.hatali_giris_sayisi

    # Kaba kuvvet kilidi: eşiğe ulaşılmışsa geçici kilit süresini yorumla.
    if kayit.hatali_giris_sayisi >= MAKS_HATALI_GIRIS:
        if _kilit_suresi_doldu_mu(kayit.son_hatali_giris_tarihi, simdi):
            # Süre dolmuş: taze başlangıç. Sayacı sıfırla ki tek yanlış giriş
            # hesabı hemen yeniden kilitlemesin; deneme aşağıda sürer.
            kimlik_repo.reset_hatali_giris_sayaci(kayit.kullanici_kodu)
            mevcut_hatali_sayi = 0
        else:
            # Kilit hâlâ aktif: şifre doğrulaması bile yapılmaz.
            raise HesapKilitliError()

    sifre_dogru = bcrypt.checkpw(
        sifre.encode("utf-8"), kayit.sifre_hash.encode("utf-8")
    )
    if not sifre_dogru:
        kimlik_repo.increment_hatali_giris(kayit.kullanici_kodu, simdi)
        # Bu hatalı deneme sayacı eşiğe taşıyorsa hesap ŞİMDİ kilitlenir; kilit
        # bir sonraki denemeye ertelenmez (off-by-one önlenir).
        yeni_hatali_sayi = mevcut_hatali_sayi + 1
        if yeni_hatali_sayi >= MAKS_HATALI_GIRIS:
            raise HesapKilitliError()
        raise AuthError()

    kimlik_repo.reset_hatali_giris_and_son_giris(kayit.kullanici_kodu, simdi)

    # Yalnızca güvenli alanlar döner; sifre_hash bilerek taşınmaz.
    return GirisSonucu(
        kullanici_kodu=kayit.kullanici_kodu,
        ad=kayit.ad,
        soyad=kayit.soyad,
        kullanici_turu=kayit.kullanici_turu,
    )


def _kilit_suresi_doldu_mu(
    son_hatali_giris_tarihi: datetime | None, simdi: datetime
) -> bool:
    """Geçici kilit penceresinin (KILIT_SURESI_DAKIKA) dolup dolmadığını söyler.

    son_hatali_giris_tarihi None ise (ör. migration öncesi kilitli eski satır)
    kalıcı kilit oluşmaması için SÜRESİ DOLMUŞ sayılır ve denemeye izin verilir.
    """
    if son_hatali_giris_tarihi is None:
        return True
    return simdi >= son_hatali_giris_tarihi + timedelta(minutes=KILIT_SURESI_DAKIKA)

"""Ortak hata sınıfı hiyerarşisinin temeli.

Neden: Tüm katmanlar aynı hata ailesini kullansın; her hata kendi kodunu ve
severity'sini OLUŞTURULDUĞU anda taşısın, katmanlar arası yukarı çıkarken bu
değerler değişmesin. Loglama bu sınıflarda YAPILMAZ; hata yalnızca sınır
katmanında (error pipeline) bir kez loglanır.

Not: Bu dosya genişletilmeye açıktır. Auth/validation modülü sonradan
ValidationError, AuthError gibi tipleri AppError'dan türeterek buraya ekler.
"""

from enum import Enum


class Severity(str, Enum):
    """Bir hatanın önem derecesi. Değeri, hata oluşturulurken bir kez belirlenir."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AppError(Exception):
    """Uygulama hatalarının ortak tabanı.

    Her alt tip kendi `kod` ve `severity` sınıf değerini tanımlar; böylece bir
    hatanın tek bir kimliği ve tek bir severity'si olur. İstenirse örnek
    bazında geçersiz kılınabilir, ancak varsayılan olarak sınıf değeri geçerlidir.
    """

    kod: str = "APP_ERROR"
    severity: Severity = Severity.ERROR

    def __init__(
        self,
        mesaj: str,
        *,
        kod: str | None = None,
        severity: Severity | None = None,
    ) -> None:
        super().__init__(mesaj)
        # Güvenli, kullanıcıya gösterilebilir mesaj. Ham teknik detay buraya konmaz.
        self.mesaj = mesaj
        if kod is not None:
            self.kod = kod
        if severity is not None:
            self.severity = severity


class DataAccessError(AppError):
    """Veri erişim (Repository) katmanındaki teknik DB hatasının domain karşılığı.

    Repository, sürücü/DB istisnasını bu tipe sarmalayıp YUKARI FIRLATIR; ham DB
    mesajı, tablo adı veya stack trace bu hatanın mesajına konmaz. Orijinal
    istisna `raise ... from ...` ile zincirlenir; tam teknik detay yalnızca
    sınır katmanındaki loglayıcının erişebileceği __cause__ üzerinde kalır.
    """

    kod = "DATA_ACCESS_ERROR"
    severity = Severity.ERROR


class SecenekZatenVarError(AppError):
    """Aynı (kategori, deger) seçeneği zaten tanımlıyken tekrar eklenmesi.

    Repository, TanimliSecenek üzerindeki UNIQUE ihlalini (IntegrityError) bu tipe
    sarmalayıp YUKARI FIRLATIR; sessizce yutulmaz, böylece çağıran katman durumu
    anlamlı biçimde ele alabilir. Kullanıcı/veri hatasıdır (kritik değil), bu
    yüzden severity WARNING. Mesaj sabittir: ham DB detayı/tablo adı konmaz.
    """

    kod = "SECENEK_ZATEN_VAR"
    severity = Severity.WARNING
    _VARSAYILAN_MESAJ = "Bu seçenek zaten tanımlı."

    def __init__(
        self,
        mesaj: str | None = None,
        *,
        kod: str | None = None,
        severity: Severity | None = None,
    ) -> None:
        super().__init__(mesaj or self._VARSAYILAN_MESAJ, kod=kod, severity=severity)


class NotFoundError(AppError):
    """İstenen kaydın/kaynağın bulunamaması hatası.

    Örn. admin bir kişinin detayını isterken o kullanici_kodu'na ait kayıt yoktur.
    Kullanıcı/veri kaynaklı bir durumdur (kritik değil), bu yüzden severity WARNING.
    Mesajı kullanıcıya gösterilebilir; ham teknik detay/tablo adı içermez.
    """

    kod = "NOT_FOUND"
    severity = Severity.WARNING
    _VARSAYILAN_MESAJ = "Kayıt bulunamadı."

    def __init__(
        self,
        mesaj: str | None = None,
        *,
        kod: str | None = None,
        severity: Severity | None = None,
    ) -> None:
        super().__init__(mesaj or self._VARSAYILAN_MESAJ, kod=kod, severity=severity)


class ValidationError(AppError):
    """Geçersiz/eksik girdi hatası (Controller validation veya Service iş kuralı).

    Kullanıcı hatasıdır (kritik değil), bu yüzden severity WARNING. Mesajı
    kullanıcıya gösterilebilir; ham teknik detay içermez.
    """

    kod = "VALIDATION_ERROR"
    severity = Severity.WARNING


class AuthError(AppError):
    """Kimlik doğrulama başarısızlığı için genel/güvenli hata tipi.

    Neden tek genel mesaj: Kullanıcı enumerasyonunu önlemek için "kayıt yok" ve
    "şifre yanlış" durumları AYNI mesajla döner; saldırgan hangi kimliğin var
    olduğunu ayırt edemez. "Hesap kilitli" durumu ise AYRI HesapKilitliError ile
    döner (kullanıcının kendi hesabı için anlaşılır uyarı). Şifre/hash asla
    mesaja konmaz.
    """

    kod = "AUTH_ERROR"
    severity = Severity.WARNING
    # Kayıt yok / şifre yanlış durumlarında aynı güvenli mesaj (enumerasyon önleme).
    _VARSAYILAN_MESAJ = "Kullanıcı adı/e-posta veya şifre hatalı."

    def __init__(
        self,
        mesaj: str | None = None,
        *,
        kod: str | None = None,
        severity: Severity | None = None,
    ) -> None:
        super().__init__(mesaj or self._VARSAYILAN_MESAJ, kod=kod, severity=severity)


class OturumError(AppError):
    """Geçersiz/süresi dolmuş sunucu tarafı oturum (session) hatası.

    /me benzeri korumalı uçlarda, cookie'deki jeton yoksa/boşsa ya da eşleşen
    geçerli bir oturum bulunmuyorsa fırlatılır. Kullanıcı hatasıdır (yeniden
    giriş gerekir), bu yüzden severity WARNING. Jeton/hash veya teknik detay
    mesaja KONMAZ; yalnızca güvenli, yönlendirici bir metin döner.
    """

    kod = "SESSION_INVALID"
    severity = Severity.WARNING
    # Geçersiz/süresi dolmuş oturumda döner; ham jeton/hash asla konmaz.
    _VARSAYILAN_MESAJ = "Oturumunuz geçersiz veya sona ermiş. Lütfen tekrar giriş yapın."

    def __init__(
        self,
        mesaj: str | None = None,
        *,
        kod: str | None = None,
        severity: Severity | None = None,
    ) -> None:
        super().__init__(mesaj or self._VARSAYILAN_MESAJ, kod=kod, severity=severity)


class YetkiYokError(AppError):
    """Kimliği doğrulanmış ama işlem için yetkisiz kullanıcı hatası.

    Neden: Admin-only uçlarda (ör. kullanıcı listesi) oturumu geçerli olsa bile
    kullanici_turu 'admin' değilse erişim reddedilir. Yetki client'tan gelen
    rol/id'ye değil, sunucu oturumundaki role göre belirlenir. Kullanıcı hatasıdır
    (yeniden giriş değil, yetki eksikliği), bu yüzden severity WARNING. Mesaj
    sabittir: hangi rolün gerektiği/teknik detay KONMAZ (bilgi sızdırılmaz).
    """

    kod = "YETKI_YOK"
    severity = Severity.WARNING
    # Yetkisiz erişimde döner; rol/kaynak detayı sızdırılmaz.
    _VARSAYILAN_MESAJ = "Bu işlem için yetkiniz bulunmuyor."

    def __init__(
        self,
        mesaj: str | None = None,
        *,
        kod: str | None = None,
        severity: Severity | None = None,
    ) -> None:
        super().__init__(mesaj or self._VARSAYILAN_MESAJ, kod=kod, severity=severity)


class HesapKilitliError(AppError):
    """Hesabın geçici kilit süresi dolmadan yapılan giriş denemesi.

    Kaba kuvvet koruması: eşik aşıldığında hesap KILIT_SURESI_DAKIKA boyunca
    kilitlenir. Kilit süresi dolmadan gelen deneme bu hata ile reddedilir; şifre
    kontrol EDİLMEZ. Mesaj sabittir: kalan süre, hash veya teknik detay konmaz.
    """

    kod = "ACCOUNT_LOCKED"
    severity = Severity.WARNING
    # Kalan süre GÖSTERİLMEZ; her kilitli denemede aynı sabit güvenli mesaj döner.
    _VARSAYILAN_MESAJ = (
        "Çok sayıda hatalı giriş nedeniyle hesabınız geçici olarak kilitlendi. "
        "Lütfen bir süre sonra tekrar deneyin."
    )

    def __init__(
        self,
        mesaj: str | None = None,
        *,
        kod: str | None = None,
        severity: Severity | None = None,
    ) -> None:
        super().__init__(mesaj or self._VARSAYILAN_MESAJ, kod=kod, severity=severity)

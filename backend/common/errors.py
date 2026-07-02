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


class ValidationError(AppError):
    """Geçersiz/eksik girdi hatası (Controller validation veya Service iş kuralı).

    Kullanıcı hatasıdır (kritik değil), bu yüzden severity WARNING. Mesajı
    kullanıcıya gösterilebilir; ham teknik detay içermez.
    """

    kod = "VALIDATION_ERROR"
    severity = Severity.WARNING


class AuthError(AppError):
    """Kimlik doğrulama başarısızlığı için TEK genel/güvenli hata tipi.

    Neden tek tip: Kullanıcı enumerasyonunu önlemek için "kayıt yok", "şifre
    yanlış" ve "hesap kilitli" durumları AYNI mesajla döner; saldırgan hangi
    kimliğin var olduğunu ayırt edemez. Şifre/hash asla mesaja konmaz.
    """

    kod = "AUTH_ERROR"
    severity = Severity.WARNING
    # Tüm auth başarısızlıklarında aynı güvenli mesaj (enumerasyon önleme).
    _VARSAYILAN_MESAJ = "Kullanıcı adı/e-posta veya şifre hatalı."

    def __init__(
        self,
        mesaj: str | None = None,
        *,
        kod: str | None = None,
        severity: Severity | None = None,
    ) -> None:
        super().__init__(mesaj or self._VARSAYILAN_MESAJ, kod=kod, severity=severity)

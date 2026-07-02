"""Yapılandırılmış (structured) loglama yapılandırması ve sınır loglayıcısı.

Neden: "İç katmanda fırlat, sınırda logla" ilkesi gereği loglama YALNIZCA
sınır katmanında (Controller/error pipeline) ve bir hata için TAM BİR KEZ
yapılır. Bu dosya, log kayıtlarını JSON olarak (zaman, severity, kod, bağlam,
stack) üreten tek merkezi loglayıcıyı kurar.

Güvenlik: Bağlam (baglam) sözlüğüne şifre/hash gibi hassas alanlar KONMAZ;
loglayıcı çağıranın verdiği bağlamı olduğu gibi yazar, bu yüzden hassas veriyi
çağıran katman zaten geçirmemelidir.
"""

import json
import logging
import sys

from common.errors import AppError, Severity

_LOGGER_ADI = "savronik"

# AppError severity'sini standart logging seviyesine eşler; hatanın önem
# derecesi origin'de belirlenir, burada yalnızca uygun seviyeye çevrilir.
_SEVERITY_LOG_SEVIYESI = {
    Severity.INFO: logging.INFO,
    Severity.WARNING: logging.WARNING,
    Severity.ERROR: logging.ERROR,
    Severity.CRITICAL: logging.CRITICAL,
}


class _JsonFormatter(logging.Formatter):
    """Log kayıtlarını tek satır JSON'a çevirir (structured logging)."""

    def format(self, kayit: logging.LogRecord) -> str:
        """Zaman, severity, kod, mesaj, bağlam ve varsa stack'i JSON olarak üretir."""
        govde = {
            "zaman": self.formatTime(kayit, "%Y-%m-%dT%H:%M:%S%z"),
            "severity": kayit.levelname,
            "kod": getattr(kayit, "kod", None),
            "mesaj": kayit.getMessage(),
            "baglam": getattr(kayit, "baglam", None),
        }
        if kayit.exc_info:
            # Tam teknik detay/stack YALNIZCA loga yazılır, kullanıcıya değil.
            govde["stack"] = self.formatException(kayit.exc_info)
        return json.dumps(govde, ensure_ascii=False)


def al_logger() -> logging.Logger:
    """Merkezi structured logger'ı döner; ilk çağrıda bir kez yapılandırır."""
    logger = logging.getLogger(_LOGGER_ADI)
    if not logger.handlers:
        el = logging.StreamHandler(sys.stdout)
        el.setFormatter(_JsonFormatter())
        logger.addHandler(el)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


def logla_sinir_hatasi(hata: Exception, *, baglam: dict) -> None:
    """Bir hatayı sınır katmanında TAM BİR KEZ, structured biçimde loglar.

    AppError ise hata OLUŞTURULDUĞU anda belirlenen kod/severity korunarak
    loglanır (severity yeniden atanmaz). AppError değilse beklenmeyen bir hata
    kabul edilip CRITICAL seviyede, tam stack ile loglanır.
    """
    if isinstance(hata, AppError):
        seviye = _SEVERITY_LOG_SEVIYESI.get(hata.severity, logging.ERROR)
        kod = hata.kod
        mesaj = hata.mesaj
    else:
        seviye = logging.CRITICAL
        kod = "UNEXPECTED_ERROR"
        mesaj = "Beklenmeyen hata."

    al_logger().log(
        seviye,
        mesaj,
        exc_info=hata,
        extra={"kod": kod, "baglam": baglam},
    )

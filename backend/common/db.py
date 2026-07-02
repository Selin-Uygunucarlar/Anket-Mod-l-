"""Veritabanı bağlantı yardımcısı (Repository katmanının kullandığı tek giriş).

Neden: Bağlantı kurma/kapatma ve işlem (transaction) sınırlarını tek yerde
toplar; Repository'ler bağlantı ayrıntısıyla uğraşmaz.

Güvenlik: DB kimlik bilgileri KODA GÖMÜLMEZ; backend/.env dosyasından
(ortam değişkenleri) okunur. TLS, DB_SSL_CA tanımlıysa etkinleştirilir.
Uygulama en az yetki ilkesiyle DDL'siz/CRUD'lu runtime hesabıyla bağlanır;
hesap yetkisi bu koddan değil, DB tarafından belirlenir.
"""

import os
from contextlib import contextmanager

import pymysql
from pymysql.cursors import DictCursor

# backend/.env -> bu dosya backend/common/db.py olduğundan iki üst klasör backend'dir.
_BACKEND_DIZINI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ENV_DOSYASI = os.path.join(_BACKEND_DIZINI, ".env")


def _env_dosyasini_yukle(dosya_yolu: str) -> None:
    """`.env` dosyasındaki anahtar=deger satırlarını os.environ'a ekler.

    Gerçek ortam değişkeni zaten tanımlıysa üzerine yazmaz (setdefault); böylece
    prod'da secret manager'dan gelen değer .env dosyasını ezmeden geçerli kalır.
    """
    if not os.path.exists(dosya_yolu):
        return
    with open(dosya_yolu, "r", encoding="utf-8") as dosya:
        for satir in dosya:
            temiz = satir.strip()
            if not temiz or temiz.startswith("#") or "=" not in temiz:
                continue
            anahtar, _, deger = temiz.partition("=")
            os.environ.setdefault(anahtar.strip(), deger.strip())


def _zorunlu_env(anahtar: str) -> str:
    """Zorunlu bir ortam değişkenini okur; yoksa güvenli (sırsız) hata fırlatır."""
    deger = os.environ.get(anahtar)
    if not deger:
        # Değer LOGLANMAZ/mesaja konmaz; yalnızca eksik anahtarın adı bildirilir.
        raise RuntimeError(f"Zorunlu ortam değişkeni tanımlı değil: {anahtar}")
    return deger


def _baglanti_ac() -> pymysql.connections.Connection:
    """.env'den okunan ayarlarla yeni bir PyMySQL bağlantısı kurar."""
    _env_dosyasini_yukle(_ENV_DOSYASI)

    baglanti_ayarlari = {
        "host": _zorunlu_env("DB_HOST"),
        "port": int(_zorunlu_env("DB_PORT")),
        "db": _zorunlu_env("DB_NAME"),
        "user": _zorunlu_env("DB_USER"),
        "password": _zorunlu_env("DB_PASSWORD"),
        "charset": "utf8mb4",
        "cursorclass": DictCursor,
        # İşlem sınırlarını context manager yönetsin diye autocommit kapalı.
        "autocommit": False,
    }

    # TLS: sertifika yolu verildiyse şifreli bağlantı zorlanır.
    ssl_ca = os.environ.get("DB_SSL_CA")
    if ssl_ca:
        baglanti_ayarlari["ssl"] = {"ca": ssl_ca}

    return pymysql.connect(**baglanti_ayarlari)


@contextmanager
def veritabani_baglantisi():
    """Bir bağlantı açar ve işlem sınırını yönetir.

    Blok sorunsuz biterse commit, istisna olursa rollback yapar; her durumda
    bağlantıyı kapatır. Repository bu context manager içinde cursor açar.
    Hata yakalanıp yutulmaz; rollback sonrası yukarı fırlatılır.
    """
    baglanti = _baglanti_ac()
    try:
        yield baglanti
        baglanti.commit()
    except Exception:
        baglanti.rollback()
        raise
    finally:
        baglanti.close()

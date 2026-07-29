"""PostgreSQL (host replikası) bağlantı yardımcısı — common/db.py'nin kardeşi.

Neden: Anket modülü Savronik'in çalışan PostgreSQL sistemine eklenecek; yetki
(sayfa hakkı) bilgisi orada durur. Bu dosya, o veritabanına bakan Repository'lerin
tek bağlantı girişidir. Uygulamanın bugünkü MariaDB bağlantısı (common/db.py) bundan
BAĞIMSIZDIR ve DEĞİŞMEZ; ikisi yan yana yaşar.

Kimlik bilgileri KODA GÖMÜLMEZ; backend/.env.pg dosyasından okunur. Hesap en az
yetki ilkesiyle CRUD'ludur, DDL yetkisi yoktur (yetki DB tarafında verilir).

!!! DİKKAT — .env ve .env.pg AYNI ANAHTAR ADLARINI kullanır (DB_HOST, DB_PORT,
DB_NAME, DB_USER, DB_PASSWORD). common/db.py bu anahtarları os.environ'a
setdefault ile yazar. Aynı kalıp burada TEKRARLANIRSA, db.py önce yüklendiğinde
.env.pg değerleri setdefault yüzünden YAZILMAZ ve PostgreSQL'e MariaDB kimlik
bilgileriyle bağlanılmaya çalışılır (sessiz, teşhisi zor hata). Bu yüzden bu dosya
os.environ'a HİÇBİR ŞEY YAZMAZ: .env.pg yerel bir sözlüğe ayrıştırılır. Gerçek
ortam değişkeni önceliği ÇAKIŞMAYAN "PG_" önekiyle korunur (PG_DB_HOST varsa o
kazanır, yoksa dosyadaki DB_HOST kullanılır).
"""

import os
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from common.errors import DataAccessError

# backend/.env.pg -> bu dosya backend/common/db_pg.py olduğundan iki üst klasör backend'dir.
_BACKEND_DIZINI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ENV_PG_DOSYASI = os.path.join(_BACKEND_DIZINI, ".env.pg")

# Ortam değişkeni tarafındaki çakışmasız önek (bkz. dosya başı uyarısı).
_ORTAM_ONEKI = "PG_"


def _env_pg_okur() -> dict[str, str]:
    """.env.pg dosyasını anahtar=deger sözlüğüne çevirir (os.environ'a YAZMAZ).

    Dosya yoksa boş sözlük döner; eksik anahtarın hatası okuma anında değil,
    _ayar() içinde tekil olarak bildirilir.
    """
    ayarlar: dict[str, str] = {}
    if not os.path.exists(_ENV_PG_DOSYASI):
        return ayarlar
    with open(_ENV_PG_DOSYASI, "r", encoding="utf-8") as dosya:
        for satir in dosya:
            temiz = satir.strip()
            if not temiz or temiz.startswith("#") or "=" not in temiz:
                continue
            anahtar, _, deger = temiz.partition("=")
            ayarlar[anahtar.strip()] = deger.strip()
    return ayarlar


def _ayar(dosya_ayarlari: dict[str, str], anahtar: str) -> str | None:
    """Bir ayarı önce PG_ önekli ortam değişkeninden, yoksa .env.pg'den okur.

    Önek sayesinde prod'da secret manager'dan gelen değer MariaDB'nin aynı adlı
    değişkenleriyle ÇAKIŞMADAN öncelik kazanır.
    """
    ortam_degeri = os.environ.get(_ORTAM_ONEKI + anahtar)
    if ortam_degeri:
        return ortam_degeri
    return dosya_ayarlari.get(anahtar) or None


def _zorunlu_ayar(dosya_ayarlari: dict[str, str], anahtar: str) -> str:
    """Zorunlu bir ayarı okur; yoksa güvenli (sırsız) hata fırlatır."""
    deger = _ayar(dosya_ayarlari, anahtar)
    if not deger:
        # Değer LOGLANMAZ/mesaja konmaz; yalnızca eksik anahtarın adı bildirilir.
        raise RuntimeError(f"Zorunlu PostgreSQL ayarı tanımlı değil: {anahtar}")
    return deger


def _baglanti_ac() -> psycopg.Connection:
    """.env.pg'den okunan ayarlarla yeni bir psycopg bağlantısı kurar.

    Teknik bağlantı hatası DataAccessError'a sarmalanıp yukarı fırlatılır; burada
    LOGLANMAZ ve kimlik bilgisi mesaja konmaz (orijinal istisna `from` ile zincirlenir).
    """
    dosya_ayarlari = _env_pg_okur()

    baglanti_ayarlari = {
        "host": _zorunlu_ayar(dosya_ayarlari, "DB_HOST"),
        "port": int(_zorunlu_ayar(dosya_ayarlari, "DB_PORT")),
        "dbname": _zorunlu_ayar(dosya_ayarlari, "DB_NAME"),
        "user": _zorunlu_ayar(dosya_ayarlari, "DB_USER"),
        "password": _zorunlu_ayar(dosya_ayarlari, "DB_PASSWORD"),
        "row_factory": dict_row,
        # İşlem sınırlarını context manager yönetsin diye autocommit kapalı.
        "autocommit": False,
    }

    # TLS: sertifika/mod verildiyse şifreli bağlantı zorlanır (varsayılanı sürücü belirler).
    ssl_ca = _ayar(dosya_ayarlari, "DB_SSL_CA")
    if ssl_ca:
        baglanti_ayarlari["sslrootcert"] = ssl_ca
    ssl_modu = _ayar(dosya_ayarlari, "DB_SSLMODE")
    if ssl_modu:
        baglanti_ayarlari["sslmode"] = ssl_modu

    try:
        return psycopg.connect(**baglanti_ayarlari)
    except psycopg.Error as hata:
        # Sunucu adı/kullanıcı/şifre mesaja konmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("PostgreSQL bağlantısı kurulamadı.") from hata


@contextmanager
def postgres_baglantisi():
    """Bir PostgreSQL bağlantısı açar ve işlem sınırını yönetir.

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

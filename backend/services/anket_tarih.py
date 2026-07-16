"""Anket başlangıç/bitiş tarihi hesabı (iş kuralı yardımcıları).

Neden: Formun "ne zaman başlar/biter" seçimleri (bugün / yarın / bir ay / iki ay /
tarih seç) birer İŞ KURALIDIR ve gerçek tarihe SUNUCUDA çevrilir. Bu hesap hem anket
OLUŞTURMA hem GÜNCELLEME akışında AYNIDIR; iki yerde tekrarlanmasın diye (DRY) ve
anket_service'in tek sorumluluğa odaklanması için (SRP) burada toplanır.

Bu modül iş katmanının bir parçasıdır: HTTP/SQL bilmez, Repository çağırmaz, saf
tarih mantığı içerir. Geçersiz seçim/biçimde ValidationError fırlatır (loglanmaz,
yukarı çıkar); loglama yalnızca sınır katmanında bir kez yapılır.
"""

import calendar
from datetime import date, datetime, time, timedelta

from common.errors import ValidationError

# Tarih seçim kimlikleri (frontend BASLANGIC/BITIS_TARIHI_SECENEKLERI ile birebir).
_TARIH_SEC = "tarih_sec"
_BASLANGIC_BUGUN = "bugun"
_BASLANGIC_YARIN = "yarin"
_BITIS_BIR_AY = "bir_ay"
_BITIS_IKI_AY = "iki_ay"

# "Yarın" hesabındaki tek günlük fark (magic number koda gömülmesin diye sabit).
_BIR_GUN = timedelta(days=1)


def hesapla_baslangic_tarihi(secim: str, tarih_metni: str | None) -> datetime:
    """Başlangıç seçimini gerçek tarihe çevirir; geçersiz seçimde ValidationError.

    'bugun' -> bugün, 'yarin' -> bugün+1 gün, 'tarih_sec' -> kullanıcının seçtiği
    ISO tarih (zorunlu). Bu hesap bir İŞ KURALIDIR; frontend yalnızca seçimi taşır.
    """
    if secim == _BASLANGIC_BUGUN:
        return _gun_basi(date.today())
    if secim == _BASLANGIC_YARIN:
        return _gun_basi(date.today()) + _BIR_GUN
    if secim == _TARIH_SEC:
        return _cozumle_iso_tarih(tarih_metni, "Başlangıç tarihi")
    raise ValidationError("Geçersiz başlangıç tarihi seçimi.")


def hesapla_bitis_tarihi(
    secim: str, tarih_metni: str | None, baslangic_tarihi: datetime
) -> datetime:
    """Bitiş seçimini gerçek tarihe çevirir; geçersiz seçimde ValidationError.

    'bir_ay'/'iki_ay' başlangıç tarihine göre hesaplanır (bu yüzden başlangıç
    parametre olarak alınır), 'tarih_sec' ise kullanıcının seçtiği ISO tarihtir
    (zorunlu). Bitiş > başlangıç kuralı çağıran Service'te uygulanır.
    """
    if secim == _BITIS_BIR_AY:
        return _ay_ekle(baslangic_tarihi, 1)
    if secim == _BITIS_IKI_AY:
        return _ay_ekle(baslangic_tarihi, 2)
    if secim == _TARIH_SEC:
        return _cozumle_iso_tarih(tarih_metni, "Bitiş tarihi")
    raise ValidationError("Geçersiz bitiş tarihi seçimi.")


def _ay_ekle(tarih: datetime, ay_sayisi: int) -> datetime:
    """Bir tarihe ay ekler; hedef ayda karşılığı olmayan günü ayın son gününe kırpar.

    Neden elle: dateutil (relativedelta) bir bağımlılık olarak kurulu değildir ve
    yalnızca bu hesap için yeni bağımlılık eklenmez. Kural: ay taşırılır (Aralık ->
    Ocak yıl artar) ve gün hedef ayın son gününü aşarsa son güne çekilir
    (31 Ocak + 1 ay -> 28/29 Şubat). Saat bileşeni korunur.
    """
    toplam_ay = tarih.month - 1 + ay_sayisi
    yil = tarih.year + toplam_ay // 12
    ay = toplam_ay % 12 + 1
    ayin_son_gunu = calendar.monthrange(yil, ay)[1]
    return tarih.replace(year=yil, month=ay, day=min(tarih.day, ayin_son_gunu))


def _cozumle_iso_tarih(tarih_metni: str | None, alan_adi: str) -> datetime:
    """'YYYY-MM-DD' biçimli tarih metnini gün başı datetime'a çevirir.

    Takvimden seçilen tarih zorunludur ve ISO biçiminde olmalıdır; boş ya da
    biçimsiz değer ValidationError ile reddedilir (ham parse hatası kullanıcıya
    sızdırılmaz, `from` ile zincirlenir).
    """
    if not tarih_metni or not tarih_metni.strip():
        raise ValidationError(f"{alan_adi} seçilmelidir.")
    try:
        return _gun_basi(date.fromisoformat(tarih_metni.strip()))
    except ValueError as hata:
        raise ValidationError(f"{alan_adi} geçersiz.") from hata


def _gun_basi(gun: date) -> datetime:
    """Bir günü, o günün başlangıcını (00:00) gösteren datetime'a çevirir.

    Anket.baslangic_tarihi/bitis_tarihi DATETIME'dır; gün seçimlerinin saat
    bileşeni olmadığından tüm tarihler gün başına sabitlenir (tutarlı kıyas).
    """
    return datetime.combine(gun, time.min)

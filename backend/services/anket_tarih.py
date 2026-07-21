"""Anket başlangıç/bitiş tarihi hesabı + liste filtresi oluşturulma aralığı (iş kuralı).

Neden: Formun "ne zaman başlar/biter" seçimleri (bugün / yarın / bir ay / iki ay /
tarih seç) birer İŞ KURALIDIR ve gerçek tarihe SUNUCUDA çevrilir. Bu hesap hem anket
OLUŞTURMA hem GÜNCELLEME akışında AYNIDIR; iki yerde tekrarlanmasın diye (DRY) ve
anket_service'in tek sorumluluğa odaklanması için (SRP) burada toplanır. Aynı SRP
gereği anket LİSTESİ filtresinin "oluşturulma tarih aralığı" seçimini (son 1 hafta/ay/
3 ay/1 yıl / tarih seç) somut (baslangic, bitis) datetime çiftine çeviren hesap da
buradadır; iki hesap aynı gün-başı/ay-ekleme/ISO-çözme yardımcılarını paylaşır (DRY).

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

# Liste filtresi "oluşturulma aralığı" kimlikleri (frontend seçenekleriyle birebir).
# 'tumu' (ve boş/None) = aralık süzgeci YOK; 'tarih_sec' = kullanıcı iki takvim seçer.
_ARALIK_TUMU = "tumu"
_ARALIK_SON_1_HAFTA = "son_1_hafta"

# "Son N ay/yıl" seçimlerinde bugüne göre GERİYE gidilecek ay sayısı (yıl = 12 ay).
# Negatif, çünkü alt sınır geçmiştedir (_ay_ekle negatif ay ile geriye gider).
_ARALIK_AY_GERI = {
    "son_1_ay": -1,
    "son_3_ay": -3,
    "son_1_yil": -12,
}

# "Son 1 hafta" alt sınırının bugünden farkı (ay hesabına girmeyen tek haftalık aralık).
_BIR_HAFTA = timedelta(days=7)


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


def hesapla_olusturma_araligi(
    tarih_araligi: str | None,
    baslangic_metni: str | None,
    bitis_metni: str | None,
) -> tuple[datetime | None, datetime | None]:
    """Liste filtresi aralık seçimini (alt, üst) datetime çiftine çevirir; None = süzme yok.

    Anket listesi filtresinin "oluşturulma tarih aralığı" bir İŞ KURALIDIR ve Repository'ye
    somut sınır olarak SUNUCUDA hesaplanır. Alt sınır DAHİL (>=), üst sınır DIŞLAYICIDIR
    (<); bu yüzden 'tarih_sec'te seçilen bitiş GÜNÜNÜN TAMAMINI kapsamak için üst sınıra
    +1 gün eklenir. Hazır aralıklarda üst sınır yoktur (bugüne kadar açık).

    - None / '' / 'tumu'            -> (None, None): aralık süzgeci uygulanmaz.
    - 'son_1_hafta'                 -> (bugün gün başı - 7 gün, None).
    - 'son_1_ay'/'son_3_ay'/'son_1_yil' -> (bugün gün başından N ay geri, None).
    - 'tarih_sec'                   -> (başlangıç gün başı, bitiş günü + 1 gün); iki tarih
      de zorunlu ve ISO 'YYYY-MM-DD' olmalı (eksik/biçimsiz -> _cozumle_iso_tarih
      ValidationError verir), ve bitiş < başlangıç ise ValidationError.
    - Bilinmeyen aralık kimliği     -> ValidationError.

    Hata loglanmaz, YUKARI FIRLAR (loglama yalnızca sınır katmanında bir kez).
    """
    if tarih_araligi is None or tarih_araligi == "" or tarih_araligi == _ARALIK_TUMU:
        return (None, None)

    bugun_basi = _gun_basi(date.today())
    if tarih_araligi == _ARALIK_SON_1_HAFTA:
        return (bugun_basi - _BIR_HAFTA, None)
    if tarih_araligi in _ARALIK_AY_GERI:
        return (_ay_ekle(bugun_basi, _ARALIK_AY_GERI[tarih_araligi]), None)
    if tarih_araligi == _TARIH_SEC:
        return _hesapla_secilen_aralik(baslangic_metni, bitis_metni)

    raise ValidationError("Geçersiz tarih aralığı.")


def _hesapla_secilen_aralik(
    baslangic_metni: str | None, bitis_metni: str | None
) -> tuple[datetime, datetime]:
    """'Tarih seç' modunda iki takvim değerini (alt dahil, üst dışlayıcı) çifte çevirir.

    Her iki tarih de zorunludur (_cozumle_iso_tarih eksik/biçimsizde ValidationError
    verir). Üst sınır dışlayıcı olduğundan seçilen bitiş gününü dahil etmek için bitişe
    +1 gün eklenir; sınır tutarlılığı için önce ham bitiş < başlangıç kıyaslanır ve
    ihlalde ValidationError fırlatılır.
    """
    baslangic = _cozumle_iso_tarih(baslangic_metni, "Başlangıç tarihi")
    bitis_ham = _cozumle_iso_tarih(bitis_metni, "Bitiş tarihi")
    if bitis_ham < baslangic:
        raise ValidationError("Bitiş tarihi başlangıç tarihinden önce olamaz.")
    return (baslangic, bitis_ham + _BIR_GUN)


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

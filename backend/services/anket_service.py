"""Anket (oluşturma + listeleme) iş katmanı.

Neden: Anket oluşturma/listeleme bir YÖNETİM ucudur; yalnızca admin çağırabilir.
Yetki, client'tan gelen role/id'ye değil, sunucu tarafı oturumun sahibine
(OturumSahibi) göre belirlenir. Formun "ne zaman başlar/biter" seçimleri (bugün /
yarın / bir ay / iki ay) birer İŞ KURALIDIR: gerçek tarihe burada, sunucuda
çevrilir (frontend yalnızca seçimi taşır).

Güvenlik: client'a güvenilmez. olusturan_kodu OTURUMDAN alınır; erişim grubu
client'tan ALINMAZ, erisim_seviyesi 'grup' iken oturum sahibinin KENDİ grubundan
(Kullanici.grup_id) çözülür; gönderilen soru id'lerinin tamamının DB'de var olduğu
doğrulanır (aksi halde ValidationError).

Sanitizasyon notu: on_yazi/son_yazi/aciklama DÜZ METİN girdileridir
(<input type="text">), zengin metin DEĞİL -> nh3 sanitizasyonu GEREKMEZ, yalnızca
trim edilir (unutulmuş değil, bilinçli). Biçimli HTML tutan soru metinleri zaten
soru_service'te sanitize edilir.

Kapsam notu: Formun "Kullanıcılar", "Mesaj Ayarları" ve "İşlemler" kartları bu
fazın DIŞINDADIR; sunucuya gönderilmez ve yazılmaz. Bu yüzden Anket.almak_zorunda /
ana_sayfada_goster / sira_no_goster DB varsayılanında kalır, soru_gosterim_tipi
NULL kalır. Bu bilinçli bir kapsam kararıdır, eksik/unutulmuş değildir.

Bu katman HTTP ve SQL bilmez; veriye Repository üzerinden erişir. Hatalar burada
LOGLANMAZ, yukarı fırlatılır; loglama yalnızca sınır katmanında bir kez yapılır.
"""

import calendar
from datetime import date, datetime, time, timedelta

from common.errors import ValidationError, YetkiYokError
from models.anket import AnketOzeti
from models.oturum import OturumSahibi
from repositories import anket_repository, grup_repository

_ADMIN_TURU = "admin"

# Anketin yaşam döngüsü değerleri (Anket.durum). Kişiye özel AnketAtama.durum ile
# KARIŞTIRILMAZ: bu kolon anketin kendi durumudur, kimsenin tamamlanma bilgisi değil.
_GECERLI_DURUMLAR = frozenset({"Aktif", "Pasif"})

# Geçerli anket tipleri (frontend ANKET_TIPI_SECENEKLERI ile birebir). Alan
# zorunludur; bu kümenin dışındaki değer reddedilir.
_GECERLI_ANKET_TIPLERI = frozenset(
    {
        "Kullanıcı Bilgi Anketi",
        "Etkinlik Değerlendirme Anketi",
        "Eğitim Değerlendirme Anketi",
        "Etkinlik Davranış Anketi",
        "Eğitim Davranış Anketi",
    }
)

# Erişim seviyesi KODLARI (DB'de saklanan değerler). Frontend'in uzun cümleleri
# yalnızca UI etiketidir ve VARCHAR(50)'ye sığmaz; sunucuya bu kodlar gelir.
_ERISIM_GRUP = "grup"
_GECERLI_ERISIM_SEVIYELERI = frozenset({_ERISIM_GRUP, "ben", "herkes"})

# Tarih seçim kimlikleri (frontend BASLANGIC/BITIS_TARIHI_SECENEKLERI ile birebir).
_TARIH_SEC = "tarih_sec"
_BASLANGIC_BUGUN = "bugun"
_BASLANGIC_YARIN = "yarin"
_BITIS_BIR_AY = "bir_ay"
_BITIS_IKI_AY = "iki_ay"

# "Yarın" hesabındaki tek günlük fark (magic number koda gömülmesin diye sabit).
_BIR_GUN = timedelta(days=1)


def list_anketler(talep_eden: OturumSahibi) -> list[AnketOzeti]:
    """Tüm anketleri liste özeti olarak döner; yalnızca admin çağırabilir.

    Yetki talep edenin (doğrulanmış oturum sahibi) kullanici_turu'ne göre belirlenir;
    admin değilse veri erişimine geçilmeden YetkiYokError fırlatılır.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()
    return anket_repository.anketleri_getir()


def ekle_anket(
    talep_eden: OturumSahibi,
    ad: str,
    on_yazi: str | None,
    son_yazi: str | None,
    aciklama: str | None,
    durum: str,
    anket_tipi: str,
    erisim_seviyesi: str | None,
    baslangic_secim: str,
    baslangic_tarih: str | None,
    bitis_secim: str,
    bitis_tarih: str | None,
    soru_idler: list[int],
) -> int:
    """Yeni bir anket oluşturur (soru bağlarıyla birlikte); yeni anket_id döner.

    Yalnızca admin çağırabilir. Tüm iş kuralları burada uygulanır: zorunlu ad,
    geçerli durum/anket_tipi, erişim seviyesi, tarih hesabı ve bitiş > başlangıç,
    soruların varlığı. olusturan_kodu ve (seviye 'grup' ise) erişim grubu OTURUMDAN
    çözülür; client gönderse bile dikkate alınmaz. Hata loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    ad_temiz = _zorunlu_alan(ad, "Anket adı")

    if durum not in _GECERLI_DURUMLAR:
        raise ValidationError("Geçersiz anket durumu.")
    if anket_tipi not in _GECERLI_ANKET_TIPLERI:
        raise ValidationError("Geçersiz anket tipi.")

    gecerli_grup_id = _dogrula_erisim(erisim_seviyesi, talep_eden)

    baslangic_tarihi = _hesapla_baslangic_tarihi(baslangic_secim, baslangic_tarih)
    bitis_tarihi = _hesapla_bitis_tarihi(bitis_secim, bitis_tarih, baslangic_tarihi)
    if bitis_tarihi <= baslangic_tarihi:
        raise ValidationError("Bitiş tarihi başlangıç tarihinden sonra olmalıdır.")

    _dogrula_sorular(soru_idler)

    return anket_repository.anket_ekle(
        ad=ad_temiz,
        on_yazi=_bos_ise_none(on_yazi),
        son_yazi=_bos_ise_none(son_yazi),
        aciklama=_bos_ise_none(aciklama),
        durum=durum,
        anket_tipi=anket_tipi,
        erisim_seviyesi=erisim_seviyesi,
        erisim_grup_id=gecerli_grup_id,
        baslangic_tarihi=baslangic_tarihi,
        bitis_tarihi=bitis_tarihi,
        olusturan_kodu=talep_eden.kullanici_kodu,
        soru_idler=soru_idler,
    )


def _dogrula_erisim(erisim_seviyesi: str | None, talep_eden: OturumSahibi) -> int | None:
    """Erişim seviyesini doğrular ve kayda gidecek erisim_grup_id'yi belirler.

    Seviye zorunlu değildir (None kabul); dolu ise geçerli kod kümesinde olmalıdır.
    Grup bağı yalnızca 'grup' seviyesinde doludur ve CLIENT'TAN ALINMAZ: anketi
    oluşturan oturum sahibinin kendi grubundan (Kullanici.grup_id) çözülür. Grupsuz
    bir kullanıcı bu seviyeyi seçemez; kayıt NULL grupla bırakılmaz, anlamlı iş
    hatası verilir. İhlalde ValidationError (loglanmaz, yukarı çıkar).
    """
    if erisim_seviyesi is None:
        return None
    if erisim_seviyesi not in _GECERLI_ERISIM_SEVIYELERI:
        raise ValidationError("Geçersiz erişim seviyesi.")
    if erisim_seviyesi != _ERISIM_GRUP:
        return None

    # Değer Kullanici.grup_id FK'sinden geldiğinden ayrıca "grup var mı" sorgusu
    # gerekmez; grupsuzluk tek olası iş hatasıdır.
    grup_id = grup_repository.kullanici_grup_id_getir(talep_eden.kullanici_kodu)
    if grup_id is None:
        raise ValidationError(
            "Bir çalışma grubuna ait olmadığınız için bu erişim seviyesi seçilemez."
        )
    return grup_id


def _dogrula_sorular(soru_idler: list[int]) -> None:
    """Ankete bağlanacak soruların iş kurallarını doğrular; ihlalde ValidationError.

    En az bir soru seçilmiş olmalı (form'da Sorular zorunlu), aynı soru iki kez
    eklenemez (DB PK'si de bunu reddederdi; kullanıcıya anlamlı mesaj için önce
    burada elenir) ve gönderilen id'lerin TAMAMI DB'de var olmalıdır (client'tan
    gelen id'ye güvenilmez; var olmayan id'yle anket yaratılamaz).
    """
    if not soru_idler:
        raise ValidationError("En az bir soru seçilmelidir.")
    if len(set(soru_idler)) != len(soru_idler):
        raise ValidationError("Aynı soru birden fazla kez eklenemez.")

    var_olanlar = set(anket_repository.soru_idleri_getir(soru_idler))
    if len(var_olanlar) != len(soru_idler):
        raise ValidationError("Seçilen sorulardan bazıları bulunamadı.")


def _hesapla_baslangic_tarihi(secim: str, tarih_metni: str | None) -> datetime:
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


def _hesapla_bitis_tarihi(
    secim: str, tarih_metni: str | None, baslangic_tarihi: datetime
) -> datetime:
    """Bitiş seçimini gerçek tarihe çevirir; geçersiz seçimde ValidationError.

    'bir_ay'/'iki_ay' başlangıç tarihine göre hesaplanır (bu yüzden başlangıç
    parametre olarak alınır), 'tarih_sec' ise kullanıcının seçtiği ISO tarihtir
    (zorunlu). Bitiş > başlangıç kuralı çağıran ekle_anket'te uygulanır.
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


def _bos_ise_none(deger: str | None) -> str | None:
    """Opsiyonel düz metin alanını trim'ler; boş kalıyorsa None döner.

    Neden None: "" ile "girilmemiş" DB'de aynı şey sayılsın (kolonlar NULL kabul
    eder). Bu alanlar düz metindir; sanitizasyon gerekmez (bkz. dosya başı notu).
    """
    if deger is None:
        return None
    temiz = deger.strip()
    return temiz or None


def _zorunlu_alan(deger, alan_adi: str) -> str:
    """Zorunlu string alanı doğrular; boş/whitespace ise ValidationError fırlatır."""
    if not deger or not str(deger).strip():
        raise ValidationError(f"{alan_adi} zorunludur.")
    return str(deger).strip()

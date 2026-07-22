"""Anket oluşturma/güncellemenin ORTAK alan doğrulama + normalizasyon iş kuralları.

Neden ayrı dosya: anket_service.py 500 satır sınırına dayandığından, oluşturma ile
güncellemenin paylaştığı alan hazırlama bloğu buraya alındı (SRP + dosya boyutu;
anket_tarih.py'nin anket_service'ten ayrılmasıyla aynı gerekçe). anket_service artık
"akış + yetki + görünürlük" kararlarına odaklanır, bu dosya ise "gelen alanlar geçerli
mi, kayda ne gidecek" sorusuna cevap verir.

Sorumluluk: zorunlu ad, geçerli durum/anket_tipi, erişim seviyesi ve grup bağının
OTURUMDAN çözülmesi, tarih hesabı + bitiş > başlangıç, soruların/grupların/
kullanıcıların DB'de var olması ve ankete atanacak nihai kişi listesinin çözülmesi.
Client'tan gelen hiçbir id/sicil doğrulanmadan kabul edilmez.

Anketin yaşam döngüsü (durum) ve tip değer kümeleri TEK KAYNAK olarak burada
tanımlanır; listeleme süzgeci de (anket_service) aynı kümeleri buradan kullanır.

Bu katman HTTP ve SQL bilmez; veriye Repository üzerinden erişir. Hatalar burada
LOGLANMAZ, yukarı fırlatılır; loglama yalnızca sınır katmanında bir kez yapılır.
"""

from dataclasses import dataclass
from datetime import datetime

from common.errors import ValidationError
from models.oturum import OturumSahibi
from repositories import anket_repository, grup_repository, kullanici_repository
from services import anket_tarih

# Anketin yaşam döngüsü değerleri (Anket.durum). Kişiye özel AnketAtama.durum ile
# KARIŞTIRILMAZ: bu kolon anketin kendi durumudur, kimsenin tamamlanma bilgisi değil.
ANKET_AKTIF_DURUM = "Aktif"
ANKET_PASIF_DURUM = "Pasif"
GECERLI_DURUMLAR = frozenset({ANKET_AKTIF_DURUM, ANKET_PASIF_DURUM})

# Geçerli anket tipleri (frontend ANKET_TIPI_SECENEKLERI ile birebir). Alan
# zorunludur; bu kümenin dışındaki değer reddedilir.
GECERLI_ANKET_TIPLERI = frozenset(
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


@dataclass
class AnketAlanlari:
    """Oluşturma/güncelleme öncesi doğrulanıp normalize edilmiş anket alanları.

    hazirla_anket_alanlari'nın çıktısı; ekle_anket ve guncelle_anket bu tek pakete
    dayanır (DRY). durum/anket_tipi burada YOKTUR: değişmeden geçtiklerinden çağıran
    orijinal değeri Repository'ye taşır (yalnızca doğrulaması ortak helper'da yapılır).
    """

    ad: str
    on_yazi: str | None
    son_yazi: str | None
    aciklama: str | None
    erisim_grup_id: int | None
    baslangic_tarihi: datetime
    bitis_tarihi: datetime
    atanacak_kullanici_kodlari: list[str]


def hazirla_anket_alanlari(
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
    grup_idler: list[int],
    kullanici_kodlari: list[str],
) -> AnketAlanlari:
    """Oluşturma/güncelleme için ortak iş kuralı doğrulaması + normalizasyon.

    Neden: ekle_anket ve guncelle_anket AYNI kurallara uyar; bu gerçek tekrar tek
    yerde toplanır (DRY, soru_service._hazirla_soru_alanlari kalıbı). Uygulanan
    kurallar: ad trim sonrası boş olamaz; durum/anket_tipi geçerli kümede olmalı;
    erişim seviyesi doğrulanır ve grup bağı OTURUMDAN çözülür (_dogrula_erisim);
    tarihler hesaplanır ve bitiş > başlangıç olmalı; soruların varlığı/tekrarı ve
    atanacak kişilerin çözümü+doğrulaması yapılır. Serbest metinler trim'lenir, boş
    ise None olur. Yetki kontrolü BURADA DEĞİL, çağıran public Service fonksiyonundadır.
    İhlalde ValidationError fırlatılır (loglanmaz, yukarı çıkar).
    """
    ad_temiz = _zorunlu_alan(ad, "Anket adı")

    if durum not in GECERLI_DURUMLAR:
        raise ValidationError("Geçersiz anket durumu.")
    if anket_tipi not in GECERLI_ANKET_TIPLERI:
        raise ValidationError("Geçersiz anket tipi.")

    gecerli_grup_id = _dogrula_erisim(erisim_seviyesi, talep_eden)

    baslangic_tarihi = anket_tarih.hesapla_baslangic_tarihi(
        baslangic_secim, baslangic_tarih
    )
    bitis_tarihi = anket_tarih.hesapla_bitis_tarihi(
        bitis_secim, bitis_tarih, baslangic_tarihi
    )
    if bitis_tarihi <= baslangic_tarihi:
        raise ValidationError("Bitiş tarihi başlangıç tarihinden sonra olmalıdır.")

    _dogrula_sorular(soru_idler)
    atanacak_kullanici_kodlari = _cozumle_atanacak_kisiler(grup_idler, kullanici_kodlari)

    return AnketAlanlari(
        ad=ad_temiz,
        on_yazi=bos_ise_none(on_yazi),
        son_yazi=bos_ise_none(son_yazi),
        aciklama=bos_ise_none(aciklama),
        erisim_grup_id=gecerli_grup_id,
        baslangic_tarihi=baslangic_tarihi,
        bitis_tarihi=bitis_tarihi,
        atanacak_kullanici_kodlari=atanacak_kullanici_kodlari,
    )


def bos_ise_none(deger: str | None) -> str | None:
    """Opsiyonel düz metin alanını trim'ler; boş kalıyorsa None döner.

    Neden None: "" ile "girilmemiş" DB'de aynı şey sayılsın (kolonlar NULL kabul
    eder). Bu alanlar düz metindir; sanitizasyon gerekmez. Alan hazırlama dışında
    anket listeleme süzgeci de aynı "boş = filtre yok" kuralını paylaşır (DRY).
    """
    if deger is None:
        return None
    temiz = deger.strip()
    return temiz or None


def _dogrula_erisim(erisim_seviyesi: str | None, talep_eden: OturumSahibi) -> int | None:
    """Erişim seviyesini doğrular ve kayda gidecek erisim_grup_id'yi belirler.

    Seviye zorunlu değildir (None kabul); dolu ise geçerli kod kümesinde olmalıdır.
    Grup bağı yalnızca 'grup' seviyesinde doludur ve CLIENT'TAN ALINMAZ: anketi
    düzenleyen oturum sahibinin kendi grubundan (Kullanici.grup_id) çözülür. Grupsuz
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
    gelen id'ye güvenilmez; var olmayan id'yle anket yaratılamaz/güncellenemez).
    """
    if not soru_idler:
        raise ValidationError("En az bir soru seçilmelidir.")
    if len(set(soru_idler)) != len(soru_idler):
        raise ValidationError("Aynı soru birden fazla kez eklenemez.")

    var_olanlar = set(anket_repository.soru_idleri_getir(soru_idler))
    if len(var_olanlar) != len(soru_idler):
        raise ValidationError("Seçilen sorulardan bazıları bulunamadı.")


def _cozumle_atanacak_kisiler(
    grup_idler: list[int], kullanici_kodlari: list[str]
) -> list[str]:
    """Seçilen grup ve kullanıcılardan ankete atanacak NİHAİ kişi listesini üretir.

    Atama KİŞİ bazlıdır: grup DB'ye yazılmaz, üyelerine çözülür. İki kaynaktan da
    gelen kişi TEK atama satırı alsın diye sonuç tekilleştirilir. Hiç seçim
    yapılmaması geçerlidir: anket ATAMASIZ kalabilir ("en az bir kişi" kuralı
    YOKTUR). Üyesi olmayan grup da hata değildir, yalnızca kişi katkısı vermez.
    """
    _dogrula_gruplar(grup_idler)
    _dogrula_kullanicilar(kullanici_kodlari)

    grup_uyeleri = grup_repository.grup_uye_kodlari_getir(grup_idler)
    return _tekillestir_sirayi_koruyarak(grup_uyeleri + kullanici_kodlari)


def _dogrula_gruplar(grup_idler: list[int]) -> None:
    """Atama için seçilen grupların iş kurallarını doğrular; ihlalde ValidationError.

    Aynı grup iki kez gönderilemez ve gönderilen id'lerin TAMAMI DB'de var olmalıdır
    (client'tan gelen grup id'sine güvenilmez). Boş seçim geçerlidir.
    """
    if not grup_idler:
        return
    if len(set(grup_idler)) != len(grup_idler):
        raise ValidationError("Aynı grup birden fazla kez eklenemez.")

    var_olanlar = set(grup_repository.grup_idleri_getir(grup_idler))
    if len(var_olanlar) != len(grup_idler):
        raise ValidationError("Seçilen gruplardan bazıları bulunamadı.")


def _dogrula_kullanicilar(kullanici_kodlari: list[str]) -> None:
    """Atama için tek tek seçilen kullanıcıları doğrular; ihlalde ValidationError.

    Aynı kullanıcı iki kez gönderilemez ve gönderilen sicillerin TAMAMI DB'de var
    olmalıdır (client'tan gelen sicile güvenilmez). Boş seçim geçerlidir.
    """
    if not kullanici_kodlari:
        return
    if len(set(kullanici_kodlari)) != len(kullanici_kodlari):
        raise ValidationError("Aynı kullanıcı birden fazla kez eklenemez.")

    var_olanlar = set(kullanici_repository.kullanici_kodlari_getir(kullanici_kodlari))
    if len(var_olanlar) != len(kullanici_kodlari):
        raise ValidationError("Seçilen kullanıcılardan bazıları bulunamadı.")


def _tekillestir_sirayi_koruyarak(kullanici_kodlari: list[str]) -> list[str]:
    """Sicil listesindeki tekrarları, ilk görülme sırasını koruyarak eler.

    Neden set değil: set'in sırası rastgeledir; atama satırlarının sırası (ve
    dolayısıyla davranış/hata ayıklama) deterministik kalsın diye sıra korunur.
    """
    return list(dict.fromkeys(kullanici_kodlari))


def _zorunlu_alan(deger, alan_adi: str) -> str:
    """Zorunlu string alanı doğrular; boş/whitespace ise ValidationError fırlatır."""
    if not deger or not str(deger).strip():
        raise ValidationError(f"{alan_adi} zorunludur.")
    return str(deger).strip()

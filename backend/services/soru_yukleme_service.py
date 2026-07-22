"""Excel (.xlsx) ile TOPLU anket sorusu yükleme iş katmanı.

Neden ayrı dosya: soru_service tek soru ekleme/güncelleme/silme sorumluluğuyla
zaten doludur (SRP + dosya boyutu). Toplu yükleme AYRI bir iş akışıdır: çok
satırlı girdi, satır bazlı hata raporu ve atomik yazma.

Sorumluluk: yetki (yalnız admin), Excel'in kullanıcıya görünen Türkçe soru tipi
etiketini teknik tip kimliğine (slug) çevirme, düz metin soru gövdesini güvenli
HTML'e dönüştürme, her satırı doğrulama ve TÜM hataları toplayıp tek seferde
bildirme. Doğrulama/sanitizasyon/şık kuralları KOPYALANMAZ; soru_service'in
ortak hazirla_soru_alanlari fonksiyonu yeniden kullanılır (DRY) — kural tek yerde.

Atomiklik: tek satır bile hatalıysa Repository HİÇ çağrılmaz; hiçbir kayıt
yazılmaz (TopluYuklemeDogrulamaHatasi). Hatasız durumda tüm kayıtlar Repository'nin
tek transaction'ında yazılır.

Bu katman HTTP, Excel ve SQL bilmez (Excel çözümlemesi sınır katmanının işidir;
buraya çözümlenmiş satır sözlükleri gelir). Hatalar burada LOGLANMAZ, yukarı
fırlatılır; loglama yalnızca sınır katmanında bir kez yapılır.
"""

import html

from common.errors import (
    TopluYuklemeDogrulamaHatasi,
    ValidationError,
    YetkiYokError,
)
from models.oturum import OturumSahibi
from models.secenek import SecenekKaydi
from models.soru import YuklenecekSoru
from repositories import soru_repository
from services import secenek_service, soru_service

_ADMIN_TURU = "admin"

# Excel ile YÜKLENEMEYEN soru tipi: grid çok boyutlu bir yapı olduğundan tek
# satır + 15 şık sütunlu şablona sığmaz. Şablon listesinde görünmez, gelirse
# satır reddedilir.
_IMPORT_DISI_TIP = "grid"

# Excel ile yüklenebilen soru tipleri. Tip kümesinin TEK kaynağı soru_service'tir;
# liste burada kopyalanmaz, oradan türetilir.
IMPORT_EDILEBILIR_TIPLER = soru_service.GECERLI_SORU_TIPLERI - {_IMPORT_DISI_TIP}

# Soru tipi kimliği -> kullanıcıya gösterilen Türkçe etiket (gösterim sırasıyla).
# Son kullanıcı Excel'e slug YAZMAZ; şablonun dropdown'ı da bu eşlemeden beslenir,
# böylece "kullanıcının seçtiği etiket" ile "kabul edilen etiket" tek yerdedir.
# Etiketler frontend/src/common/soruTipleri.js ile birebir aynı metinlerdir.
_TIP_ETIKETLERI = {
    "coktan_secmeli_tek": "Çoktan seçmeli (tek yanıt)",
    "coktan_secmeli_coklu": "Çoktan seçmeli (çoklu yanıt)",
    "evet_hayir": "Evet-hayır sorusu",
    "skala_5": "5'li skala sorusu",
    "listeden_secmeli": "Listeden seçmeli soru",
    "yorum": "Yorum sorusu",
    _IMPORT_DISI_TIP: "Grid Sorusu",
}

# Etiket -> tip kimliği (yalnız import edilebilir tipler). Grid burada YOKTUR;
# Excel'de "Grid Sorusu" yazılırsa tanınmayan etiket olarak reddedilir.
_ETIKET_TIP_ESLEMESI = {
    etiket: tip
    for tip, etiket in _TIP_ETIKETLERI.items()
    if tip in IMPORT_EDILEBILIR_TIPLER
}

# Satır hatasının hangi sütuna ait olduğunu bildiren etiketler (kullanıcı Excel'de
# bu başlıkları görür). Ortak iş kuralı tek bir sütuna atfedilemediğinde (şık
# kuralları, boş içerik vb.) _GENEL_ALAN kullanılır; mesajın kendisi zaten ilgili
# alanı Türkçe olarak adlandırır.
_TIP_ALANI = "Soru Tipi"
_GENEL_ALAN = "Satır"

# Şablon verisinde konu/amaç değerlerinin çekildiği seçenek kategorileri.
_KONU_KATEGORISI = "konu"
_AMAC_KATEGORISI = "amac"


def _duz_metni_htmle_cevir(duz_metin: str) -> str:
    """Excel'den gelen DÜZ METİN soru gövdesini güvenli HTML'e çevirir.

    Neden: Soru metni DB'de biçimli HTML olarak tutulur, ancak Excel hücresi düz
    metindir. Önce html.escape ile kaçış yapılır ("a < b" bozulmaz ve kullanıcının
    yazdığı '<script>' etiket olarak DOĞMAZ), sonra satır sonları <br> ile
    korunur. Bu dönüşüm ortak doğrulama/sanitizasyon hattından ÖNCE uygulanır.
    """
    kacisli = html.escape(duz_metin)
    return kacisli.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br>")


def _tip_etiketini_cozumle(tip_etiketi: str) -> str:
    """Türkçe soru tipi etiketini teknik tip kimliğine çevirir; tanınmazsa ValidationError.

    Grid etiketi bu eşlemede bilerek YOKTUR: grid Excel ile yüklenemez, bu yüzden
    tanınmayan etiketle aynı yola düşer ve mesajda ayrıca belirtilir.
    """
    tip = _ETIKET_TIP_ESLEMESI.get(tip_etiketi.strip())
    if tip is None:
        raise ValidationError(
            "Geçersiz soru tipi; şablondaki listeden seçiniz "
            "(Grid sorusu Excel ile yüklenemez)."
        )
    return tip


def _satiri_kayda_cevir(
    satir: dict, soru_tipi: str, hazirlayan_kodu: str
) -> YuklenecekSoru:
    """Tip'i çözülmüş bir Excel satırını doğrulanmış/sanitize YuklenecekSoru'ya çevirir.

    Soru metni düz metinden HTML'e dönüştürülür; tüm iş kuralları (tip kümesi,
    konu/amaç zorunluluğu, XSS sanitizasyonu, tipe göre şık kardinalitesi)
    soru_service'in ORTAK hazirla_soru_alanlari'ndan geçer — kural burada
    tekrarlanmaz. hazirlayan_kodu çağrandan (oturumdan) gelir. İhlalde
    ValidationError fırlar; çağıran satır bazında toplar.
    """
    soru_metni_html = _duz_metni_htmle_cevir(str(satir.get("soru_metni", "")))

    konu_temiz, amac_temiz, soru_metni, secenekler = soru_service.hazirla_soru_alanlari(
        soru_tipi,
        str(satir.get("konu", "")),
        str(satir.get("amac", "")),
        soru_metni_html,
        list(satir.get("secenekler") or []),
    )

    return YuklenecekSoru(
        soru_metni=soru_metni,
        soru_tipi=soru_tipi,
        konu=konu_temiz,
        amac=amac_temiz,
        hazirlayan_kodu=hazirlayan_kodu,
        secenekler=secenekler,
    )


def _satirlari_dogrula(
    satirlar: list[dict], hazirlayan_kodu: str
) -> tuple[list[YuklenecekSoru], list[dict]]:
    """Tüm satırları doğrular; (yazılmaya hazır kayıtlar, satır hataları) döner.

    İlk hatada DURULMAZ: kullanıcı tüm sorunları tek raporda görsün diye her satır
    ayrı ayrı işlenir. Hata satırı {"satir_no", "alan", "mesaj"} şeklindedir; alan,
    hatanın oluştuğu adıma göre verilir (tip çözümlemesi -> "Soru Tipi", ortak iş
    kuralı -> tek sütuna atfedilemediği için "Satır"; mesaj ilgili alanı zaten
    adlandırır). Mesajlar güvenli ValidationError metinleridir; teknik detay YOK.
    """
    kayitlar: list[YuklenecekSoru] = []
    satir_hatalari: list[dict] = []

    for satir in satirlar:
        satir_no = satir.get("satir_no")
        try:
            soru_tipi = _tip_etiketini_cozumle(str(satir.get("soru_tipi", "")))
        except ValidationError as hata:
            satir_hatalari.append(
                {"satir_no": satir_no, "alan": _TIP_ALANI, "mesaj": hata.mesaj}
            )
            continue

        try:
            kayitlar.append(_satiri_kayda_cevir(satir, soru_tipi, hazirlayan_kodu))
        except ValidationError as hata:
            satir_hatalari.append(
                {"satir_no": satir_no, "alan": _GENEL_ALAN, "mesaj": hata.mesaj}
            )

    return kayitlar, satir_hatalari


def yukle_sorular(talep_eden: OturumSahibi, satirlar: list[dict]) -> int:
    """Excel'den çözümlenmiş soru satırlarını doğrulayıp TOPLU ekler; eklenen sayıyı döner.

    Yalnızca admin çağırabilir (talep_eden'e göre; client'tan gelen role/id'ye
    güvenilmez) ve yetki kontrolü veri erişimine geçmeden ÖNCE yapılır. `satirlar`
    her öğesi {"satir_no", "soru_tipi", "konu", "amac", "soru_metni", "secenekler"}
    olan sözlüktür; satir_no kullanıcının Excel'de gördüğü GERÇEK satır numarasıdır.
    Boş liste ValidationError'dır ("yüklenecek bir şey yok" bir iş kararıdır).

    İlk hatada DURULMAZ: tüm satırlar doğrulanır, hatalar toplanır. Bir tek hata
    varsa bile HİÇBİR kayıt yazılmadan TopluYuklemeDogrulamaHatasi fırlatılır
    (atomiklik). Hatasızsa kayıtlar Repository'nin tek transaction'ında yazılır;
    hazirlayan_kodu OTURUMDAN alınır. Hata burada loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    if not satirlar:
        raise ValidationError("Yüklenecek soru bulunamadı.")

    kayitlar, satir_hatalari = _satirlari_dogrula(
        satirlar, talep_eden.kullanici_kodu
    )

    if satir_hatalari:
        raise TopluYuklemeDogrulamaHatasi(
            "Bazı satırlar geçersiz olduğu için hiçbir soru yüklenmedi.",
            satir_hatalari=satir_hatalari,
        )

    return len(soru_repository.sorulari_toplu_ekle(kayitlar))


def _kategori_degerleri(
    secenekler: list[SecenekKaydi], kategori: str
) -> list[str]:
    """Verilen kategoriye ait tanımlı seçenek değerlerini alfabetik sırayla döner."""
    return sorted(
        secenek.deger for secenek in secenekler if secenek.kategori == kategori
    )


def uret_sablon_verisi(talep_eden: OturumSahibi) -> dict:
    """Excel şablonunun dropdown içeriğini döner; yalnızca admin çağırabilir.

    İçerik: import edilebilir soru tipi ETİKETLERİ (yükleme sırasında kabul edilen
    etiketlerle AYNI kaynaktan — böylece şablon ile doğrulama ayrışamaz) + tanımlı
    konu/amaç değerleri. Konu/amaç seçenekleri secenek_service üzerinden alınır
    (mevcut yetki + kategori mantığı yeniden kullanılır; yeni kod türetilmez).
    Excel biçimi/dosya üretimi bu katmanın işi DEĞİLDİR (sınır katmanına aittir).
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    secenekler = secenek_service.list_secenekler(talep_eden)
    return {
        "soru_tipi_etiketleri": [
            etiket
            for tip, etiket in _TIP_ETIKETLERI.items()
            if tip in IMPORT_EDILEBILIR_TIPLER
        ],
        "konular": _kategori_degerleri(secenekler, _KONU_KATEGORISI),
        "amaclar": _kategori_degerleri(secenekler, _AMAC_KATEGORISI),
    }

"""Anket sonuçları (kimler atandı / kimler yanıtladı / ne cevapladı) iş katmanı.

Neden ayrı dosya: anket_service.py 500 satır sınırına yakın olduğundan, anket
listesi ekranından açılan SONUÇ okumalarının iş kuralları buraya alındı (SRP +
dosya boyutu; anket_doldur_service.py ile aynı kalıp).

Yetki: Bu bir YÖNETİM ucudur -> yalnızca admin. Rol client'tan gelen değere değil,
doğrulanmış oturum sahibine (OturumSahibi.kullanici_turu) göre belirlenir; admin
değilse veri erişimine GEÇMEDEN YetkiYokError fırlar. Admin olmak tek başına yetmez:
görünürlük anketin erisim_seviyesi'ne de bağlıdır ve süzme değerleri (sicil + grup)
OTURUMDAN çözülür, client'tan ALINMAZ (IDOR'a kapalı). Repository None dönerse
NotFoundError verilir: "anket yok" ile "bana görünmüyor" (ve cevap ucunda "kişi bu
ankete atanmamış") AYRILMAZ -- varlık sızmaz.

Türetmeler burada yapılır: yanitladi_mi / tamamlandi_mi (ham atama durumundan),
soru↔cevap eşleştirmesi ve okuma sınırındaki XSS sanitizasyonu (soru metni, şık
metinleri, kişinin açık uçlu cevabı).

Bu katman HTTP ve SQL bilmez; veriye Repository üzerinden erişir. Hatalar burada
LOGLANMAZ, yukarı fırlatılır; loglama yalnızca sınır katmanında bir kez yapılır.
"""

from common.errors import NotFoundError, YetkiYokError
from common.html_temizle import temizle_html
from models.anket_sonuc import (
    AnketAtamaGorunumu,
    CevaplananSoru,
    CevaplananSoruGorunumu,
    KullaniciCevapGorunumu,
    KullaniciCevapKaynagi,
    VerilenCevap,
)
from models.oturum import OturumSahibi
from repositories import anket_sonuc_repository, grup_repository
from repositories.anket_sorgulari import ATAMA_TAMAMLANDI_DURUMU

_ADMIN_TURU = "admin"

# Aynı soruya birden çok açık uçlu satır yazılması KURAMSALDIR (cevaplama akışı yorum
# tipinde tek satır üretir). Veride yine de birden çok satır varsa hiçbiri gizlenmez;
# metinler bu ayraçla birleştirilerek gösterilir (frontend HTML render eder).
_METIN_AYRACI = "<br>"


def list_anket_atamalari(
    talep_eden: OturumSahibi, anket_id: int
) -> list[AnketAtamaGorunumu]:
    """Bir ankete atanmış kişileri, yanıtlayıp yanıtlamadıkları bilgisiyle döner.

    Liste ekranındaki "Atanan / Yanıtlayan Kullanıcı Sayısı" hücrelerinin arkasındaki
    kişi listesidir. Yalnızca admin çağırabilir; görünürlük süzgeci oturum sahibinin
    kendi sicili + kendi grubuyla kurulur (client'tan gelen id/role güvenilmez).
    Anket görünmüyor/yok -> NotFoundError (varlık sızmaz). Anket görünüyor ama kimse
    atanmamışsa boş liste döner. ad/soyad/email düz metindir -> sanitize gerekmez.
    Hata loglanmaz, YUKARI FIRLAR.
    """
    gorunur_grup_id = _dogrula_yetki_ve_coz_grup(talep_eden)

    satirlar = anket_sonuc_repository.anket_atamalarini_getir(
        anket_id, talep_eden.kullanici_kodu, gorunur_grup_id
    )
    if satirlar is None:
        raise NotFoundError("Anket bulunamadı.")

    return [
        AnketAtamaGorunumu(
            kullanici_kodu=satir.kullanici_kodu,
            ad=satir.ad,
            soyad=satir.soyad,
            email=satir.email,
            durum=satir.durum,
            yanitladi_mi=satir.durum == ATAMA_TAMAMLANDI_DURUMU,
            tamamlanma_tarihi=satir.tamamlanma_tarihi,
        )
        for satir in satirlar
    ]


def get_kullanici_cevaplari(
    talep_eden: OturumSahibi, anket_id: int, kullanici_kodu: str
) -> KullaniciCevapGorunumu:
    """Tek kişinin bir ankete verdiği cevapları soru↔cevap eşleştirilmiş halde döner.

    "Cevapları Gör" akışıdır. Yetki ve görünürlük kuralı atama listesiyle AYNIDIR
    (yalnızca admin + oturumdan çözülen görünürlük). Anket görünmüyor/yok ya da kişi
    bu ankete atanmamışsa Repository None döner ve tek bir NotFoundError'a çevrilir
    (iki durum AYRILMAZ; hangi anketin/kişinin var olduğu sızmaz). Kişi anketi
    tamamlamadan bıraktıysa cevaplar kısmi olabilir; tamamlandi_mi bunu bildirir.
    Metinler okuma sınırında sanitize edilir. Hata loglanmaz, YUKARI FIRLAR.
    """
    gorunur_grup_id = _dogrula_yetki_ve_coz_grup(talep_eden)

    kaynak = anket_sonuc_repository.kullanici_cevaplarini_getir(
        anket_id, kullanici_kodu, talep_eden.kullanici_kodu, gorunur_grup_id
    )
    if kaynak is None:
        raise NotFoundError("Anket cevapları bulunamadı.")

    return KullaniciCevapGorunumu(
        kullanici_kodu=kullanici_kodu,
        tamamlandi_mi=kaynak.atama_durum == ATAMA_TAMAMLANDI_DURUMU,
        sorular=_montajla_sorular(kaynak),
    )


def _dogrula_yetki_ve_coz_grup(talep_eden: OturumSahibi) -> int | None:
    """Yönetim yetkisini doğrular ve görünürlük süzgecinin grup kimliğini çözer.

    İki ucun ortak kapısıdır (DRY): admin değilse veri erişimine GEÇMEDEN
    YetkiYokError; adminse görünürlük grubu client'tan değil oturum sahibinin KENDİ
    kaydından okunur (grupsuzsa None -> 'grup' seviyeli anketler görünmez).
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()
    return grup_repository.kullanici_grup_id_getir(talep_eden.kullanici_kodu)


def _montajla_sorular(kaynak: KullaniciCevapKaynagi) -> list[CevaplananSoruGorunumu]:
    """Anketin sorularını, kişinin o sorulara verdiği cevaplarla birleştirir.

    Cevaplar soru_id ile gruplanır (çoklu seçimde aynı soru için birden çok satır
    gelir). Cevapsız soru da listede KALIR: hangi sorunun boş bırakıldığı ekranda
    görünmelidir.
    """
    soruya_gore_cevaplar: dict[int, list[VerilenCevap]] = {}
    for cevap in kaynak.cevaplar:
        soruya_gore_cevaplar.setdefault(cevap.soru_id, []).append(cevap)

    return [
        _montajla_soru(soru, soruya_gore_cevaplar.get(soru.soru_id, []))
        for soru in kaynak.sorular
    ]


def _montajla_soru(
    soru: CevaplananSoru, cevaplar: list[VerilenCevap]
) -> CevaplananSoruGorunumu:
    """Tek sorunun görünümünü kurar: metinleri sanitize eder, cevabı iki alana ayırır.

    Seçim tipinde şık metinleri verilen_secenekler'e; açık uçlu (yorum) cevap
    cevap_metni'ne düşer. secenek_metni None olan satır dışlanır (şık sonradan
    silinmiş -> gösterilecek metin yok). soru_metni, şık metinleri ve kullanıcının
    cevabı HAM'dır; frontend HTML render ettiğinden okuma sınırında temizlenir.
    """
    verilen_secenekler = [
        temizle_html(cevap.secenek_metni)
        for cevap in cevaplar
        if cevap.secenek_metni is not None
    ]
    metin_parcalari = [
        temizle_html(cevap.cevap_metni)
        for cevap in cevaplar
        if cevap.cevap_metni is not None and cevap.cevap_metni.strip()
    ]

    return CevaplananSoruGorunumu(
        soru_id=soru.soru_id,
        soru_metni=temizle_html(soru.soru_metni),
        soru_tipi=soru.soru_tipi,
        verilen_secenekler=verilen_secenekler,
        cevap_metni=_METIN_AYRACI.join(metin_parcalari) if metin_parcalari else None,
    )

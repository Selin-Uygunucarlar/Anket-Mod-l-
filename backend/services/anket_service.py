"""Anket (oluşturma + listeleme + detay + güncelleme) iş katmanı.

Neden: Anket oluşturma/listeleme/detay/güncelleme birer YÖNETİM ucudur; yalnızca
admin çağırabilir. Yetki, client'tan gelen role/id'ye değil, sunucu tarafı oturumun
sahibine (OturumSahibi) göre belirlenir. Formun "ne zaman başlar/biter" seçimleri
birer İŞ KURALIDIR ve gerçek tarihe sunucuda çevrilir (bkz. anket_tarih).

Görebilen güncelleyebilir: Güncelleme yetkisi listeleme GÖRÜNÜRLÜĞÜYLE BİREBİR aynı
kuraldır (ek kısıt yok). Bu yüzden hem detay okuma hem güncelleme, önce anketi OTURUM
SAHİBİNİN sicili + grubuyla çeker; görünmüyorsa NotFoundError verilir (403/404 ayrımı
anketin VARLIĞINI sızdırır -- bu yüzden görünmeyen anket "yok" gibi ele alınır, IDOR'a
kapalı; client'tan gelen anket_id'ye körlemesine güvenilmez).

Güvenlik: client'a güvenilmez. olusturan_kodu OTURUMDAN alınır (güncellemede
DEĞİŞMEZ); erişim grubu client'tan ALINMAZ, erisim_seviyesi 'grup' iken oturum
sahibinin KENDİ grubundan (Kullanici.grup_id) çözülür; gönderilen soru id'lerinin,
grup id'lerinin ve kullanıcı sicillerinin tamamının DB'de var olduğu doğrulanır.

Kavram ayrımı (KARIŞTIRILMAZ): erisim_seviyesi 'grup', anketi KİMİN GÖREBİLECEĞİdir.
Ankete ATANACAK kişiler ise ayrı bir kavramdır. Güncellemede atamalara FARK uygulanır:
mevcut ile istenen karşılaştırılır, yalnız eklenecek/çıkarılacak kişilere dokunulur;
listede kalanın atama satırı (durum/tarihler/cevapları) korunur.

Oluşturma ile güncelleme AYNI iş kurallarına uyar; bu ortak kurallar İKİNCİ KEZ
YAZILMAZ: _hazirla_anket_alanlari'nda toplanır ve iki akış da onu çağırır (DRY).
Serbest metin alanları (on_yazi/son_yazi/aciklama) düz metindir -> yalnız trim edilir;
biçimli HTML tutan soru metinleri okuma sınırında (detay dönerken)
common.html_temizle.temizle_html ile sanitize edilir (defense-in-depth). Formun Mesaj
Ayarları/İşlemler kartları hâlâ kapsam DIŞINDADIR (sunucuya gönderilmez/yazılmaz).

Bu katman HTTP ve SQL bilmez; veriye Repository üzerinden erişir. Hatalar burada
LOGLANMAZ, yukarı fırlatılır; loglama yalnızca sınır katmanında bir kez yapılır.
"""

import dataclasses
from dataclasses import dataclass
from datetime import datetime

from common.errors import NotFoundError, ValidationError, YetkiYokError
from common.html_temizle import temizle_html
from models.anket import AnketDetay, AnketOzeti, AtanmisAnketKarti
from models.oturum import OturumSahibi
from repositories import anket_repository, grup_repository, kullanici_repository
from services import anket_tarih

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


@dataclass
class _HazirAnketAlanlari:
    """Oluşturma/güncelleme öncesi doğrulanıp normalize edilmiş anket alanları.

    _hazirla_anket_alanlari'nın çıktısı; ekle_anket ve guncelle_anket bu tek pakete
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


def list_anketler(
    talep_eden: OturumSahibi,
    anket_tipi: str | None = None,
    durum: str | None = None,
    tarih_araligi: str | None = None,
    baslangic_tarih: str | None = None,
    bitis_tarih: str | None = None,
) -> list[AnketOzeti]:
    """Talep edenin GÖREBİLDİĞİ (ve istenirse süzülmüş) anketleri liste özeti olarak
    döner; yalnızca admin çağırabilir.

    Yetki talep edenin (doğrulanmış oturum sahibi) kullanici_turu'ne göre belirlenir;
    admin değilse veri erişimine geçilmeden YetkiYokError fırlatılır. Admin olmak tüm
    anketleri görmeye yetmez: görünürlük ayrıca anketin erisim_seviyesi'ne bağlıdır.
    'herkes' -> herkese görünür; 'grup' -> yalnızca anketin erisim_grup_id'si talep
    edenin KENDİ grubuyla aynıysa; 'ben'/NULL -> yalnızca anketi kendisi oluşturduysa.
    Süzme değerleri client'tan ALINMAZ; doğrulanmış oturum sahibinin kendi sicilinden
    ve kendi grubundan çözülür.

    İsteğe bağlı filtreler (görünürlük süzgecinin ÜSTÜNE eklenir, onu GEVŞETMEZ; boş/
    None -> o filtre uygulanmaz): anket_tipi ve durum dolu ise geçerli kümede olmalı
    (aksi halde ValidationError). tarih_araligi + baslangic_tarih/bitis_tarih anket_tarih
    ile somut (alt, üst) oluşturulma sınırlarına çevrilir (üst sınır dışlayıcı). Hata
    loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    tip_filtre = _bos_ise_none(anket_tipi)
    if tip_filtre is not None and tip_filtre not in _GECERLI_ANKET_TIPLERI:
        raise ValidationError("Geçersiz anket tipi.")
    durum_filtre = _bos_ise_none(durum)
    if durum_filtre is not None and durum_filtre not in _GECERLI_DURUMLAR:
        raise ValidationError("Geçersiz anket durumu.")

    olusturma_baslangic, olusturma_bitis = anket_tarih.hesapla_olusturma_araligi(
        tarih_araligi, baslangic_tarih, bitis_tarih
    )

    gorunur_grup_id = grup_repository.kullanici_grup_id_getir(talep_eden.kullanici_kodu)
    return anket_repository.anketleri_getir(
        gorunur_kullanici_kodu=talep_eden.kullanici_kodu,
        gorunur_grup_id=gorunur_grup_id,
        anket_tipi=tip_filtre,
        durum=durum_filtre,
        olusturma_baslangic=olusturma_baslangic,
        olusturma_bitis=olusturma_bitis,
    )


def list_atanmis_anketler(talep_eden: OturumSahibi) -> list[AtanmisAnketKarti]:
    """Talep edenin ana ekranına düşen bekleyen anketleri döner (kişiye özel panel).

    Yönetim ucu DEĞİLDİR: admin/user ayrımı YOKTUR, her giriş yapmış kullanıcı
    yalnızca KENDİ atanmış, aktif ve henüz tamamlamadığı anketlerini görür (hangi
    anketlerin "bekleyen" sayılacağı Repository'nin süzgecindedir). IDOR koruması:
    süzme sicili client'tan ALINMAZ, doğrulanmış oturum sahibinden geçirilir; kimse
    başkasının bekleyen anketlerini isteyemez. ad düz metindir -> sanitize gerekmez.
    Hata loglanmaz, YUKARI FIRLAR.
    """
    return anket_repository.atanan_bekleyen_anketleri_getir(talep_eden.kullanici_kodu)


def get_anket(talep_eden: OturumSahibi, anket_id: int) -> AnketDetay:
    """Tek anketi düzenleme formunu ön-doldurmaya yeten tam görünümüyle döner.

    Yalnızca admin çağırabilir; admin değilse veri erişimine geçilmeden YetkiYokError.
    "Görebilen güncelleyebilir/görebilir": anket OTURUM SAHİBİNİN sicili + grubuyla
    çekilir; görünmüyorsa NotFoundError (varlık/içerik sızmaz). Dönen anketin bağlı
    soru metinleri okuma sınırında sanitize edilir (defense-in-depth; frontend HTML
    olarak render eder). Hata loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    anket = _getir_gorunur_anket(talep_eden, anket_id)
    return _sanitize_anket_detay(anket)


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
    grup_idler: list[int],
    kullanici_kodlari: list[str],
) -> int:
    """Yeni anketi soru bağları ve kullanıcı atamalarıyla oluşturur; anket_id döner.

    Yalnızca admin çağırabilir. Tüm ortak iş kuralları _hazirla_anket_alanlari'nda
    (guncelle_anket ile paylaşılan) uygulanır: zorunlu ad, geçerli durum/anket_tipi,
    erişim seviyesi, tarih hesabı ve bitiş > başlangıç, soruların/grupların/
    kullanıcıların varlığı, atanacak kişilerin çözümü. olusturan_kodu ve (seviye
    'grup' ise) erişim grubu OTURUMDAN çözülür. Hata loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    hazir = _hazirla_anket_alanlari(
        talep_eden,
        ad,
        on_yazi,
        son_yazi,
        aciklama,
        durum,
        anket_tipi,
        erisim_seviyesi,
        baslangic_secim,
        baslangic_tarih,
        bitis_secim,
        bitis_tarih,
        soru_idler,
        grup_idler,
        kullanici_kodlari,
    )

    return anket_repository.anket_ekle(
        ad=hazir.ad,
        on_yazi=hazir.on_yazi,
        son_yazi=hazir.son_yazi,
        aciklama=hazir.aciklama,
        durum=durum,
        anket_tipi=anket_tipi,
        erisim_seviyesi=erisim_seviyesi,
        erisim_grup_id=hazir.erisim_grup_id,
        baslangic_tarihi=hazir.baslangic_tarihi,
        bitis_tarihi=hazir.bitis_tarihi,
        olusturan_kodu=talep_eden.kullanici_kodu,
        soru_idler=soru_idler,
        atanacak_kullanici_kodlari=hazir.atanacak_kullanici_kodlari,
        son_tarih=hazir.bitis_tarihi,
    )


def guncelle_anket(
    talep_eden: OturumSahibi,
    anket_id: int,
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
) -> None:
    """Var olan bir anketi (alanlar + soru bağları + atamalar) günceller.

    Yalnızca admin çağırabilir. "Görebilen güncelleyebilir": önce anket OTURUM
    SAHİBİNİN sicili + grubuyla çekilir; görünmüyorsa NotFoundError (varlık sızmaz).
    Ortak iş kuralları ekle_anket ile AYNI _hazirla_anket_alanlari'ndan geçer.
    Atamalara FARK uygulanır: mevcut atananlarla istenen liste karşılaştırılıp yalnız
    eklenecek/çıkarılacak kişiler belirlenir (kalan kişiye dokunulmaz). son_tarih
    anketin YENİ bitiş tarihidir; olusturan_kodu DEĞİŞMEZ. Hata loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    # Varlık + görünürlük ("görebilen güncelleyebilir"); None -> NotFoundError.
    _getir_gorunur_anket(talep_eden, anket_id)

    hazir = _hazirla_anket_alanlari(
        talep_eden,
        ad,
        on_yazi,
        son_yazi,
        aciklama,
        durum,
        anket_tipi,
        erisim_seviyesi,
        baslangic_secim,
        baslangic_tarih,
        bitis_secim,
        bitis_tarih,
        soru_idler,
        grup_idler,
        kullanici_kodlari,
    )

    mevcut_kodlar = anket_repository.anket_atanan_kodlari_getir(anket_id)
    eklenecek, cikarilacak = _atama_farki(
        mevcut_kodlar, hazir.atanacak_kullanici_kodlari
    )

    anket_repository.anket_guncelle(
        anket_id=anket_id,
        ad=hazir.ad,
        on_yazi=hazir.on_yazi,
        son_yazi=hazir.son_yazi,
        aciklama=hazir.aciklama,
        durum=durum,
        anket_tipi=anket_tipi,
        erisim_seviyesi=erisim_seviyesi,
        erisim_grup_id=hazir.erisim_grup_id,
        baslangic_tarihi=hazir.baslangic_tarihi,
        bitis_tarihi=hazir.bitis_tarihi,
        soru_idler=soru_idler,
        eklenecek_kullanici_kodlari=eklenecek,
        cikarilacak_kullanici_kodlari=cikarilacak,
        son_tarih=hazir.bitis_tarihi,
    )


def _getir_gorunur_anket(talep_eden: OturumSahibi, anket_id: int) -> AnketDetay:
    """Anketi OTURUM SAHİBİNİN görünürlüğüyle çeker; görünmüyorsa NotFoundError.

    "Görebilen güncelleyebilir" kuralının tek kaynağı: görünürlük parametreleri
    (sicil + kendi grup_id'si) client'tan değil oturumdan çözülür ve Repository'ye
    geçirilir. Anket görünmüyorsa (erişimi yok ya da gerçekten yoksa) None döner;
    bu durumda anketin varlığını sızdırmamak için NotFoundError verilir (403/404
    ayrımı yapılmaz). Detay okuma ve güncelleme bu tek yeri paylaşır (DRY).
    """
    gorunur_grup_id = grup_repository.kullanici_grup_id_getir(talep_eden.kullanici_kodu)
    anket = anket_repository.anket_detay_getir(
        anket_id, talep_eden.kullanici_kodu, gorunur_grup_id
    )
    if anket is None:
        raise NotFoundError("Anket bulunamadı.")
    return anket


def _sanitize_anket_detay(anket: AnketDetay) -> AnketDetay:
    """Anket detayının bağlı soru metinlerini okuma sınırında XSS'e karşı temizler.

    soru_metni biçimli HAM HTML'dir ve frontend onu HTML olarak render eder; okuma
    yolunda da sanitize edilir (defense-in-depth; eski/güvenilmez satırlar da kapsanır).
    Serbest metin alanları (on_yazi/son_yazi/aciklama) ve atanan kullanıcı bilgileri
    düz metindir -> sanitize gerekmez, dokunulmaz.
    """
    temiz_sorular = [
        dataclasses.replace(soru, soru_metni=temizle_html(soru.soru_metni))
        for soru in anket.bagli_sorular
    ]
    return dataclasses.replace(anket, bagli_sorular=temiz_sorular)


def _hazirla_anket_alanlari(
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
) -> _HazirAnketAlanlari:
    """Oluşturma/güncelleme için ortak iş kuralı doğrulaması + normalizasyon.

    Neden: ekle_anket ve guncelle_anket AYNI kurallara uyar; bu gerçek tekrar tek
    yerde toplanır (DRY, soru_service._hazirla_soru_alanlari kalıbı). Uygulanan
    kurallar: ad trim sonrası boş olamaz; durum/anket_tipi geçerli kümede olmalı;
    erişim seviyesi doğrulanır ve grup bağı OTURUMDAN çözülür (_dogrula_erisim);
    tarihler hesaplanır ve bitiş > başlangıç olmalı; soruların varlığı/tekrarı ve
    atanacak kişilerin çözümü+doğrulaması yapılır. Serbest metinler trim'lenir, boş
    ise None olur. Yetki kontrolü BURADA DEĞİL, çağıran public fonksiyondadır. İhlalde
    ValidationError fırlatılır (loglanmaz, yukarı çıkar).
    """
    ad_temiz = _zorunlu_alan(ad, "Anket adı")

    if durum not in _GECERLI_DURUMLAR:
        raise ValidationError("Geçersiz anket durumu.")
    if anket_tipi not in _GECERLI_ANKET_TIPLERI:
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

    return _HazirAnketAlanlari(
        ad=ad_temiz,
        on_yazi=_bos_ise_none(on_yazi),
        son_yazi=_bos_ise_none(son_yazi),
        aciklama=_bos_ise_none(aciklama),
        erisim_grup_id=gecerli_grup_id,
        baslangic_tarihi=baslangic_tarihi,
        bitis_tarihi=bitis_tarihi,
        atanacak_kullanici_kodlari=atanacak_kullanici_kodlari,
    )


def _atama_farki(
    mevcut_kodlar: list[str], istenen_kodlar: list[str]
) -> tuple[list[str], list[str]]:
    """Mevcut ve istenen atama listelerinden eklenecek/çıkarılacak kişileri hesaplar.

    Neden fark: güncellemede listede KALAN kişinin atama satırına (durum/tarihler/
    cevapları) dokunulmaz. eklenecek = istenen - mevcut, cikarilacak = mevcut - istenen.
    Sıra korunur (deterministik davranış): eklenecek istenen sırasında, çıkarılacak
    mevcut sırasında üretilir.
    """
    mevcut_kumesi = set(mevcut_kodlar)
    istenen_kumesi = set(istenen_kodlar)
    eklenecek = [kod for kod in istenen_kodlar if kod not in mevcut_kumesi]
    cikarilacak = [kod for kod in mevcut_kodlar if kod not in istenen_kumesi]
    return eklenecek, cikarilacak


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

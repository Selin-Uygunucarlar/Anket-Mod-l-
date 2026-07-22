"""Anket (oluşturma + listeleme + detay + güncelleme + durum değiştirme) iş katmanı.

Neden: Anket oluşturma/listeleme/detay/güncelleme ve durum değiştirme birer YÖNETİM
ucudur; yalnızca admin çağırabilir. Yetki, client'tan gelen role/id'ye değil, sunucu
tarafı oturumun sahibine (OturumSahibi) göre belirlenir. Formun "ne zaman başlar/biter"
seçimleri birer İŞ KURALIDIR ve gerçek tarihe sunucuda çevrilir (bkz. anket_tarih).

Görebilen güncelleyebilir: Güncelleme yetkisi listeleme GÖRÜNÜRLÜĞÜYLE BİREBİR aynı
kuraldır (ek kısıt yok). Bu yüzden hem detay okuma hem güncelleme/durum değiştirme,
önce anketi OTURUM SAHİBİNİN sicili + grubuyla çeker; görünmüyorsa NotFoundError
verilir (403/404 ayrımı anketin VARLIĞINI sızdırır -- bu yüzden görünmeyen anket "yok"
gibi ele alınır, IDOR'a kapalı; client'tan gelen anket_id'ye körlemesine güvenilmez).

Güvenlik: client'a güvenilmez. olusturan_kodu OTURUMDAN alınır (güncellemede
DEĞİŞMEZ); erişim grubu client'tan ALINMAZ, erisim_seviyesi 'grup' iken oturum
sahibinin KENDİ grubundan (Kullanici.grup_id) çözülür; gönderilen soru id'lerinin,
grup id'lerinin ve kullanıcı sicillerinin tamamının DB'de var olduğu doğrulanır.

Kavram ayrımı (KARIŞTIRILMAZ): erisim_seviyesi 'grup', anketi KİMİN GÖREBİLECEĞİdir.
Ankete ATANACAK kişiler ise ayrı bir kavramdır. Güncellemede atamalara FARK uygulanır:
mevcut ile istenen karşılaştırılır, yalnız eklenecek/çıkarılacak kişilere dokunulur;
listede kalanın atama satırı (durum/tarihler/cevapları) korunur.

Oluşturma ile güncelleme AYNI iş kurallarına uyar; bu ortak kurallar (ve anket
durum/tip değer kümeleri) BURADA DEĞİL, anket_alan_hazirla modülündedir; iki akış da
onu çağırır (DRY + dosya boyutu/SRP). Serbest metin alanları (on_yazi/son_yazi/
aciklama) düz metindir -> yalnız trim edilir; biçimli HTML tutan soru metinleri okuma
sınırında (detay dönerken) common.html_temizle.temizle_html ile sanitize edilir
(defense-in-depth). Formun Mesaj Ayarları/İşlemler kartları hâlâ kapsam DIŞINDADIR.

Bu katman HTTP ve SQL bilmez; veriye Repository üzerinden erişir. Hatalar burada
LOGLANMAZ, yukarı fırlatılır; loglama yalnızca sınır katmanında bir kez yapılır.
"""

import dataclasses

from common.errors import NotFoundError, ValidationError, YetkiYokError
from common.html_temizle import temizle_html
from models.anket import AnketDetay, AnketOzeti, AtanmisAnketKarti
from models.oturum import OturumSahibi
from repositories import anket_repository, grup_repository
from services import anket_tarih
from services.anket_alan_hazirla import (
    ANKET_AKTIF_DURUM,
    ANKET_PASIF_DURUM,
    GECERLI_ANKET_TIPLERI,
    GECERLI_DURUMLAR,
    bos_ise_none,
    hazirla_anket_alanlari,
)

_ADMIN_TURU = "admin"


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

    tip_filtre = bos_ise_none(anket_tipi)
    if tip_filtre is not None and tip_filtre not in GECERLI_ANKET_TIPLERI:
        raise ValidationError("Geçersiz anket tipi.")
    durum_filtre = bos_ise_none(durum)
    if durum_filtre is not None and durum_filtre not in GECERLI_DURUMLAR:
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

    Yalnızca admin çağırabilir. Tüm ortak iş kuralları hazirla_anket_alanlari'nda
    (guncelle_anket ile paylaşılan) uygulanır: zorunlu ad, geçerli durum/anket_tipi,
    erişim seviyesi, tarih hesabı ve bitiş > başlangıç, soruların/grupların/
    kullanıcıların varlığı, atanacak kişilerin çözümü. olusturan_kodu ve (seviye
    'grup' ise) erişim grubu OTURUMDAN çözülür. Hata loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    hazir = hazirla_anket_alanlari(
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
    Ortak iş kuralları ekle_anket ile AYNI hazirla_anket_alanlari'ndan geçer.
    Atamalara FARK uygulanır: mevcut atananlarla istenen liste karşılaştırılıp yalnız
    eklenecek/çıkarılacak kişiler belirlenir (kalan kişiye dokunulmaz). son_tarih
    anketin YENİ bitiş tarihidir; olusturan_kodu DEĞİŞMEZ. Hata loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    # Varlık + görünürlük ("görebilen güncelleyebilir"); None -> NotFoundError.
    _getir_gorunur_anket(talep_eden, anket_id)

    hazir = hazirla_anket_alanlari(
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


def degistir_anket_durumu(talep_eden: OturumSahibi, anket_id: int) -> str:
    """Anketin yayın durumunu tersine çevirir (Aktif <-> Pasif); YENİ durumu döner.

    Yalnızca admin çağırabilir; yetki client'ın role'üne değil doğrulanmış oturum
    sahibine göre verilir (admin değil -> YetkiYokError, veri erişimine GEÇMEDEN).
    "Görebilen güncelleyebilir": anket oturum sahibinin sicili + grubuyla çekilir,
    görünmüyorsa NotFoundError (varlık sızmaz, IDOR'a kapalı). HEDEF DURUM CLIENT'TAN
    ALINMAZ: mevcut durum 'Aktif' ise 'Pasif', değilse 'Aktif' olur (kullanıcı
    aktiflik toggle'ı ile aynı kalıp) -> geçersiz durum Repository'ye hiç gitmez.
    Anketin diğer alanlarına dokunulmaz. Hata loglanmaz, YUKARI FIRLAR.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

    anket = _getir_gorunur_anket(talep_eden, anket_id)
    yeni_durum = (
        ANKET_PASIF_DURUM if anket.durum == ANKET_AKTIF_DURUM else ANKET_AKTIF_DURUM
    )

    anket_repository.anket_durumu_guncelle(anket_id, yeni_durum)
    return yeni_durum


def _getir_gorunur_anket(talep_eden: OturumSahibi, anket_id: int) -> AnketDetay:
    """Anketi OTURUM SAHİBİNİN görünürlüğüyle çeker; görünmüyorsa NotFoundError.

    "Görebilen güncelleyebilir" kuralının tek kaynağı: görünürlük parametreleri
    (sicil + kendi grup_id'si) client'tan değil oturumdan çözülür ve Repository'ye
    geçirilir. Anket görünmüyorsa (erişimi yok ya da gerçekten yoksa) None döner;
    bu durumda anketin varlığını sızdırmamak için NotFoundError verilir (403/404
    ayrımı yapılmaz). Detay okuma, güncelleme ve durum değiştirme bu tek yeri
    paylaşır (DRY).
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

"""Kullanıcı yönetimi (admin kullanıcı listesi) akışının veri erişim katmanı.

Neden: DB ile konuşan tek yer burasıdır; SQL yalnızca bu katmanda çalıştırılır.
Service/Controller tablo/şema/SQL görmez. Tüm sorgular parametreli (prepared)
çalıştırılır; string birleştirme YASAK (SQL injection'a kapalı). Ham SQL metinleri
kullanici_sorgulari.py'ye ayrılmıştır (SRP + dosya boyutu); bu dosya bağlantı/
transaction yönetimi, sonuç dönüşümü ve hata sarmalama sorumluluğunu taşır. Bu
dosya login sorumluluğundan (kullanici_kimlik_repository) ayrıdır.

Güvenlik: Yalnızca listede gösterilmesi güvenli alanlar seçilir; sifre_hash ve
diğer hassas kimlik alanları sorguya HİÇ girmez.

Hata yönetimi: Teknik DB istisnaları DataAccessError'a sarmalanıp YUKARI
FIRLATILIR; burada loglanmaz/yutulmaz. Ham DB mesajı, tablo adı veya stack
trace üst katmana giden mesaja konmaz (orijinali `from` ile zincirlenir).
"""

from datetime import date, datetime

import pymysql

from common.db import veritabani_baglantisi
from common.errors import DataAccessError
from models.kullanici_detay import KullaniciDetay
from models.kullanici_ozet import KullaniciOzet
from repositories import kullanici_sorgulari as sorgular


def list_kullanicilar() -> list[KullaniciOzet]:
    """Tüm kullanıcıları güvenli özet alanlarıyla, ad/soyad sırasına göre döner.

    Yönetici ilişkisi öz-LEFT JOIN ile çözülür (yönetici yoksa None), son giriş
    KullaniciKimlik LEFT JOIN ile alınır (kimlik satırı yoksa None). Yetki/rol
    kontrolü (yalnızca admin) burada DEĞİL, Service/Controller katmanındadır.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.KULLANICI_LISTE_SORGUSU)
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Kullanıcı listesi okunamadı.") from hata

    return [
        KullaniciOzet(
            kullanici_kodu=satir["kullanici_kodu"],
            ad=satir["ad"],
            soyad=satir["soyad"],
            # TINYINT gelebileceğinden Python bool'a çevrilir.
            aktif=bool(satir["aktif"]),
            email=satir["email"],
            ilgili_yonetici_kodu=satir["ilgili_yonetici_kodu"],
            yonetici_ad=satir["yonetici_ad"],
            yonetici_soyad=satir["yonetici_soyad"],
            olusturma_tarihi=satir["olusturma_tarihi"],
            son_giris_tarihi=satir["son_giris_tarihi"],
        )
        for satir in satirlar
    ]


def get_kullanici_detay(kullanici_kodu: str) -> KullaniciDetay | None:
    """Verilen kullanici_kodu'nun tam güvenli detayını döner; kayıt yoksa None.

    Kişi detay paneli için tek kullanıcıyı okur. Yönetici adı öz-LEFT JOIN ile
    (yönetici yoksa None), son giriş KullaniciKimlik LEFT JOIN ile (kimlik satırı
    yoksa None) çözülür. sifre_hash/hatali_giris_sayisi sorguya girmez. Yetki/rol
    ve sahiplik kontrolü burada DEĞİL, Service/Controller katmanındadır.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.KULLANICI_DETAY_SORGUSU, (kullanici_kodu,))
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Kullanıcı detayı okunamadı.") from hata

    if satir is None:
        return None

    return KullaniciDetay(
        kullanici_kodu=satir["kullanici_kodu"],
        ad=satir["ad"],
        soyad=satir["soyad"],
        email=satir["email"],
        kullanici_turu=satir["kullanici_turu"],
        # TINYINT gelebileceğinden Python bool'a çevrilir.
        aktif=bool(satir["aktif"]),
        ise_giris_tarihi=satir["ise_giris_tarihi"],
        ilgili_yonetici_kodu=satir["ilgili_yonetici_kodu"],
        yonetici_ad=satir["yonetici_ad"],
        yonetici_soyad=satir["yonetici_soyad"],
        sirket=satir["sirket"],
        grup=satir["grup"],
        bolum=satir["bolum"],
        birim=satir["birim"],
        kadro_grubu=satir["kadro_grubu"],
        kadro_unvani=satir["kadro_unvani"],
        gorev_unvani=satir["gorev_unvani"],
        arge_personeli=satir["arge_personeli"],
        personel_sigorta_is_yeri=satir["personel_sigorta_is_yeri"],
        gorev_yeri=satir["gorev_yeri"],
        olusturma_tarihi=satir["olusturma_tarihi"],
        son_giris_tarihi=satir["son_giris_tarihi"],
    )


def kullanici_kodu_var_mi(kullanici_kodu: str) -> bool:
    """Verilen kullanici_kodu (SAP no) sistemde kayıtlı mı döndürür.

    Yeni kullanıcı eklemeden önce benzersizlik ön kontrolü içindir; nihai
    garanti PK'dir. Yetki/rol kontrolü burada değil, Service katmanındadır.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.KULLANICI_KODU_VAR_SORGUSU, (kullanici_kodu,))
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Kullanıcı kodu kontrolü yapılamadı.") from hata

    return satir is not None


def email_var_mi(email: str) -> bool:
    """Verilen email sistemde kayıtlı mı döndürür (benzersizlik ön kontrolü).

    Nihai garanti UNIQUE kısıttır; bu yalnızca kullanıcıya erken/anlamlı geri
    bildirim için ön kontroldür.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.EMAIL_VAR_SORGUSU, (email,))
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        raise DataAccessError("E-posta kontrolü yapılamadı.") from hata

    return satir is not None


def email_baskasinda_var_mi(email: str, haric_kullanici_kodu: str) -> bool:
    """Verilen email, haric_kullanici_kodu DIŞINDA bir kullanıcıya ait mi döndürür.

    Güncelleme senaryosunun benzersizlik ön kontrolüdür: kullanıcı kendi
    e-postasını değiştirmeden kaydederse çakışma SAYILMAZ (kendi satırı hariç
    tutulur). Nihai garanti UNIQUE kısıttır; yetki/rol kontrolü Service'tedir.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    sorgular.EMAIL_BASKASINDA_VAR_SORGUSU,
                    (email, haric_kullanici_kodu),
                )
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        raise DataAccessError("E-posta kontrolü yapılamadı.") from hata

    return satir is not None


def yonetici_var_mi(yonetici_kodu: str) -> bool:
    """Verilen kodun bir Kullanici'ye ait olup olmadığını döndürür.

    Yeni kullanıcının ilgili_yonetici_kodu'nun gerçek bir kullanıcıya işaret
    ettiğini doğrulamak içindir (yetim FK oluşmasın). İlişki kuralı (kimin
    kimin yöneticisi olabileceği) Service'in işidir.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.YONETICI_VAR_SORGUSU, (yonetici_kodu,))
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Yönetici kontrolü yapılamadı.") from hata

    return satir is not None


def create_kullanici(
    kullanici_kodu: str,
    ad: str,
    soyad: str,
    email: str,
    kullanici_turu: str,
    ise_giris_tarihi: date | None,
    ilgili_yonetici_kodu: str | None,
    sirket: str | None,
    grup: str | None,
    bolum: str | None,
    birim: str | None,
    kadro_grubu: str | None,
    kadro_unvani: str | None,
    gorev_unvani: str | None,
    arge_personeli: str | None,
    personel_sigorta_is_yeri: str | None,
    gorev_yeri: str | None,
    sifre_hash: str,
    sifre_degistirilmeli: bool,
    olusturma_tarihi: datetime,
) -> None:
    """Yeni kullanıcıyı tek transaction içinde Kullanici + KullaniciKimlik olarak ekler.

    İki INSERT aynı bağlantı/with bloğunda çalışır; herhangi biri patlarsa
    context manager rollback yapar (yarım kayıt kalmaz). Kullanici satırında
    aktif=TRUE; kimlik satırında sifre_degistirilmeli (geçici şifre bayrağı) ve
    hatali_giris_sayisi=0, sifre_guncelleme_tarihi = olusturma_tarihi. Benzersizlik
    (PK/UNIQUE) ve FK bütünlüğü nihai olarak DB'de zorlanır. sifre_hash asla
    loglanmaz. Yetki/rol/şifre üretimi Service katmanının işidir.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    sorgular.KULLANICI_EKLE_SORGUSU,
                    (
                        kullanici_kodu,
                        ad,
                        soyad,
                        email,
                        kullanici_turu,
                        ise_giris_tarihi,
                        olusturma_tarihi,
                        ilgili_yonetici_kodu,
                        sirket,
                        grup,
                        bolum,
                        birim,
                        kadro_grubu,
                        kadro_unvani,
                        gorev_unvani,
                        arge_personeli,
                        personel_sigorta_is_yeri,
                        gorev_yeri,
                    ),
                )
                imlec.execute(
                    sorgular.KIMLIK_EKLE_SORGUSU,
                    (
                        kullanici_kodu,
                        sifre_hash,
                        sifre_degistirilmeli,
                        olusturma_tarihi,
                    ),
                )
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Kullanıcı oluşturulamadı.") from hata


def guncelle_kullanici(kullanici_kodu: str, veri: dict) -> None:
    """Bir kullanıcının sicil DIŞINDAKİ düzenlenebilir alanlarını tek UPDATE ile yazar.

    Güncellenen alanlar create_kullanici ile aynı kümedir (ad, soyad, email,
    kullanici_turu, ise_giris_tarihi, ilgili_yonetici_kodu ve 10 profil alanı);
    `veri` sözlüğü bu anahtarları taşır (bkz. kullanici_sorgulari.
    KULLANICI_GUNCELLE_ALANLARI). sifre_guncelleme_tarihi, hatali_giris_sayisi,
    aktif, olusturma_tarihi ve PK'ye DOKUNULMAZ. Değerler yalnızca parametreyle
    (%s) geçer; kolon listesi sabittir (dinamik SQL yok). Doğrulama (kullanici_turu,
    yönetici ilişkisi, benzersiz email) Service'in işidir; DB (UNIQUE/FK/CHECK)
    son güvenlik ağıdır. Kayıt yoksa UPDATE etkisizdir; varlık kontrolü Service'te.
    """
    parametreler = tuple(
        veri.get(alan) for alan in sorgular.KULLANICI_GUNCELLE_ALANLARI
    ) + (kullanici_kodu,)
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.KULLANICI_GUNCELLE_SORGUSU, parametreler)
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Kullanıcı güncellenemedi.") from hata


def kullanici_bagimliligi_var_mi(kullanici_kodu: str) -> bool:
    """Bu sicile bağlı BAŞKA kayıt (yetim bırakılacak veri) var mı döndürür.

    Sicil değiştirme/silme öncesi güvenlik kontrolüdür: başka bir Kullanici'nin
    yöneticisi mi, AnketAtama/EgitimAtama/YetkinlikAtama'da mı, YetkinlikDegerlendirme'de
    değerlendirilen ya da değerlendiren olarak mı geçiyor — tek sorguda OR'lu EXISTS
    ile (ilk eşleşmede durur) bakılır. KullaniciKimlik (aynı kişinin 1:1 kimlik satırı)
    BİLEREK dahil değildir; bağımlılık sayılmaz.

    ÖNEMLİ: Şemaya kullanici_kodu'ya FK veren HER YENİ TABLO eklendiğinde bu fonksiyonun
    kullandığı sorguya (kullanici_sorgulari.KULLANICI_BAGIMLILIK_SORGUSU) o tablo için
    de bir kontrol EKLENMELİDİR; aksi halde sicil değişimi o tablodaki kayıtları
    sessizce kırar (kontrol onları görmeden geçer). İSTİSNA: Soru.hazirlayan_kodu FK'si
    (migration 008) ON DELETE SET NULL + ON UPDATE CASCADE olduğundan sicil değişimini
    kıramaz/yetim bırakamaz; bu yüzden bağımlılık kontrolüne BİLİNÇLİ olarak dahil edilmez.
    """
    parametreler = (kullanici_kodu,) * 6
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.KULLANICI_BAGIMLILIK_SORGUSU, parametreler)
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Kullanıcı bağımlılık kontrolü yapılamadı.") from hata

    return satir is not None


def guncelle_kullanici_kodu(eski_kod: str, yeni_kod: str) -> None:
    """Kullanıcının sicilini (PK) tek transaction içinde değiştirir.

    Şemada Kullanici.kullanici_kodu'ya FK veren TÜM tablolar ON UPDATE CASCADE ile
    tanımlıdır (KullaniciKimlik, AnketAtama, EgitimAtama, YetkinlikAtama,
    YetkinlikDegerlendirme.kullanici_kodu ve degerlendiren_yonetici_kodu ile
    Kullanici.ilgili_yonetici_kodu öz-ilişkisi). Bu yüzden EN TEMİZ ve EN AZ RİSKLİ
    yol tek UPDATE'tir: DB tüm çocuk satırları (KullaniciKimlik dahil) AYNI işlem
    içinde otomatik günceller — ayrıca elle KullaniciKimlik güncellemek gereksiz
    olur, hatta yanlış olur (satır zaten cascade ile yeni koda taşınmıştır).
    Benzersizlik/varlık kontrolü Service'te; yeni_kod zaten kayıtlıysa PK ihlali
    DataAccessError olarak yukarı çıkar (ham DB mesajı/tablo adı sızmaz).
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    sorgular.KULLANICI_KODU_GUNCELLE_SORGUSU, (yeni_kod, eski_kod)
                )
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Kullanıcı kodu güncellenemedi.") from hata


def get_kullanici_aktif(kullanici_kodu: str) -> bool | None:
    """Verilen kullanici_kodu'nun güncel aktiflik durumunu döner; kayıt yoksa None.

    Service, durum değiştir (aktif <-> pasif) akışında önce mevcut değeri okur;
    None ise NotFoundError üretir, aksi halde tersini yazar. Yetki/iş kuralı
    burada DEĞİL, Service katmanındadır.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.KULLANICI_AKTIF_OKU_SORGUSU, (kullanici_kodu,))
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        raise DataAccessError("Kullanıcı durumu okunamadı.") from hata

    if satir is None:
        return None

    # TINYINT gelebileceğinden Python bool'a çevrilir.
    return bool(satir["aktif"])


def set_kullanici_aktif(kullanici_kodu: str, aktif: bool) -> None:
    """Kullanıcının aktiflik durumunu verilen değere ayarlar (aktif <-> pasif).

    Yeni değeri (mevcut durumun tersi) Service belirler; burada yalnızca yazılır.
    Yetki/sahiplik ve toggle kararı burada DEĞİL, Service katmanındadır.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.KULLANICI_AKTIF_YAZ_SORGUSU, (aktif, kullanici_kodu))
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Kullanıcı durumu güncellenemedi.") from hata

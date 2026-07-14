"""Kullanıcı grupları (listeleme + ekleme + silme + üyeler + varlık + atama) veri
erişim katmanı.

Neden: DB ile konuşan tek yer burasıdır; SQL yalnızca bu katmanda çalıştırılır.
Service/Controller tablo/şema/SQL görmez. Tüm sorgular parametreli (prepared)
çalıştırılır; string birleştirme YASAK (SQL injection'a kapalı). Ham SQL metinleri
grup_sorgulari.py'ye ayrılmıştır (SRP + dosya boyutu); bu dosya bağlantı yönetimi,
sonuç dönüşümü ve hata sarmalama sorumluluğunu taşır.

Ayrım: İşlenen grup İLİŞKİSELDİR (KullaniciGrubu + Kullanici.grup_id); mevcut
serbest-metin Kullanici.grup kolonuna DOKUNULMAZ.

Güvenlik: Repository yetki/rol/sahiplik BİLMEZ; bunlar Service/Controller
katmanındadır (grup yönetimi yalnızca admin'e açık — kararı üst katman verir).

Hata yönetimi: Teknik DB istisnaları DataAccessError'a sarmalanıp YUKARI FIRLATILIR;
burada loglanmaz/yutulmaz. Ham DB mesajı, tablo adı veya stack trace üst katmana
giden mesaja konmaz (orijinali `from` ile zincirlenir). Ad benzersizliği (UNIQUE)
ihlali de DB'den gelir; teknik hata DataAccessError'a sarılır, "zaten var" anlamlı
kararını Service verir.
"""

import pymysql

from common.db import veritabani_baglantisi
from common.errors import DataAccessError
from models.kullanici_grubu import GrupUyesi, KullaniciGrubu
from repositories import grup_sorgulari as sorgular


def gruplari_getir() -> list[KullaniciGrubu]:
    """Tüm grupları üye sayısıyla döner (üyesi olmayan grup uye_sayisi=0 alır).

    KullaniciGrubu LEFT JOIN Kullanici (grup_id üzerinden) ile her grubun üye
    sayısı tek sorguda COUNT'lanır. Sıralama grup adına göre (Türkçe collation).
    Yetki/rol kontrolü burada DEĞİL, Service/Controller'dadır. Teknik DB hatası
    DataAccessError'a sarmalanıp yukarı fırlatılır; ham DB mesajı/tablo adı sızmaz.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.GRUP_LISTE_SORGUSU)
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Grup listesi okunamadı.") from hata

    return [
        KullaniciGrubu(
            grup_id=satir["grup_id"],
            ad=satir["ad"],
            # COUNT DECIMAL/int dönebildiğinden Python int'e çevrilir.
            uye_sayisi=int(satir["uye_sayisi"]),
        )
        for satir in satirlar
    ]


def grup_ekle(ad: str) -> int:
    """Yeni bir grup ekler; oluşan grup_id'yi (cursor.lastrowid) döner.

    ad UNIQUE'tir: aynı ad zaten varsa DB IntegrityError fırlatır; bu teknik hata
    DataAccessError'a sarmalanıp yukarı fırlatılır (Repository "zaten var" kararını
    VERMEZ, loglamaz — anlamlı hata Service'in işi). Parametreli (%s); string
    birleştirme yok. Ham DB mesajı/tablo adı üst mesaja konmaz.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.GRUP_EKLE_SORGUSU, (ad,))
                yeni_grup_id = imlec.lastrowid
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Grup eklenemedi.") from hata

    return yeni_grup_id


def grup_sil(grup_id: int) -> None:
    """Verilen grubu siler; üyeleri FK ON DELETE SET NULL ile grupsuz kalır.

    İdempotenttir: silinecek grup yoksa (rowcount 0) bu bir hata sayılmaz. Kullanici.
    grup_id FK'si (fk_kullanici_grup) ON DELETE SET NULL olduğundan bu gruba bağlı
    kullanıcılar aynı işlemde otomatik grupsuz bırakılır (grup_id NULL; kişiler
    silinmez, yetim kayıt kalmaz). Yetki/sahiplik kontrolü burada DEĞİL,
    Service/Controller'dadır. Teknik DB hatası yutulmadan DataAccessError'a
    sarmalanıp yukarı fırlatılır (ham DB mesajı/tablo adı sızmaz).
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.GRUP_SIL_SORGUSU, (grup_id,))
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Grup silinemedi.") from hata


def grup_uyeleri(grup_id: int) -> list[GrupUyesi]:
    """Bir gruba bağlı üyelerin hafif (güvenli) gösterimini sıralı döner.

    Yalnızca gösterimi güvenli alanlar (kullanici_kodu, ad, soyad, email) çekilir;
    hassas kimlik alanı seçilmez. Sıralama ad, soyad (Türkçe collation). Grup yoksa
    ya da üyesi yoksa boş liste döner (Repository NotFound FIRLATMAZ; varlık kararı
    Service'e aittir). Yetki/rol kontrolü burada DEĞİL, Service/Controller'dadır.
    Teknik DB hatası DataAccessError'a sarmalanıp yukarı fırlatılır; ham DB
    mesajı/tablo adı sızmaz.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.GRUP_UYELERI_SORGUSU, (grup_id,))
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Grup üyeleri okunamadı.") from hata

    return [
        GrupUyesi(
            kullanici_kodu=satir["kullanici_kodu"],
            ad=satir["ad"],
            soyad=satir["soyad"],
            email=satir["email"],
        )
        for satir in satirlar
    ]


def grup_idleri_getir(grup_idler: list[int]) -> list[int]:
    """Verilen grup_id'lerden DB'de gerçekten var olanları döner.

    Neden: client'tan gelen grup id'lerine güvenilmez; Service dönen kümeyi
    isteneni ile karşılaştırıp eksikleri bulur ("hangi id geçersiz" kararı bir iş
    kararıdır, Service'e aittir). Boş liste gelirse DB'ye HİÇ gidilmez ve boş liste
    dönülür (SQL'de "IN ()" geçersizdir). IN listesinin yer tutucuları grup SAYISI
    kadar üretilir; id DEĞERLERİ SQL metnine gömülmez, hepsi parametre olarak geçer.
    """
    if not grup_idler:
        return []

    yer_tutucular = ", ".join(["%s"] * len(grup_idler))
    sorgu = sorgular.GRUP_IDLERI_VAR_MI_SORGUSU.format(yer_tutucular=yer_tutucular)

    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgu, tuple(grup_idler))
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Gruplar okunamadı.") from hata

    return [satir["grup_id"] for satir in satirlar]


def grup_uye_kodlari_getir(grup_idler: list[int]) -> list[str]:
    """Verilen grupların üyelerinin sicillerini (kullanici_kodu) tekil döner.

    Ankete atama KİŞİ bazlıdır: grup DB'ye yazılmaz, üyeleri kişi olarak yazılır;
    bu fonksiyon o çözümlemenin veri erişim adımıdır. Aynı kişi birden çok kez
    dönmez (DISTINCT). Üyesi olmayan/var olmayan grup boş katkı verir; "grup boş"
    kararı Service'e aittir. Boş liste gelirse DB'ye HİÇ gidilmez ("IN ()" geçersiz
    SQL). Yer tutucular grup SAYISI kadar üretilir; DEĞERLER parametreyle geçer.
    """
    if not grup_idler:
        return []

    yer_tutucular = ", ".join(["%s"] * len(grup_idler))
    sorgu = sorgular.GRUP_UYE_KODLARI_SORGUSU.format(yer_tutucular=yer_tutucular)

    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgu, tuple(grup_idler))
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Grup üyeleri okunamadı.") from hata

    return [satir["kullanici_kodu"] for satir in satirlar]


def kullanici_grup_id_getir(kullanici_kodu: str) -> int | None:
    """Bir kullanıcının ilişkisel grup kimliğini (Kullanici.grup_id) döner.

    İki durumda da None döner: kullanıcı grupsuzsa (grup_id NULL) ya da kullanıcı
    kaydı hiç yoksa. Yani Repository NotFound FIRLATMAZ — çağıran Service zaten
    doğrulanmış oturum sahibinin kodunu geçtiğinden "kayıt yok" ayrı bir iş
    durumu olarak ele alınmaz; varlık kararı gerekiyorsa Service'e aittir.
    Yetki/sahiplik kontrolü burada DEĞİL, Service/Controller'dadır. Teknik DB
    hatası DataAccessError'a sarmalanıp yukarı fırlatılır; ham DB mesajı/tablo
    adı sızmaz.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.KULLANICI_GRUP_ID_SORGUSU, (kullanici_kodu,))
                satir = imlec.fetchone()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Kullanıcının grubu okunamadı.") from hata

    if satir is None or satir["grup_id"] is None:
        return None

    return int(satir["grup_id"])


def gruba_ata(kullanici_kodu: str, grup_id: int | None) -> None:
    """Bir kullanıcıyı bir gruba atar; grup_id None ise gruptan çıkarır (NULL yapar).

    UPDATE Kullanici SET grup_id=%s WHERE kullanici_kodu=%s. grup_id=None geçilirse
    üyelik kaldırılır (grup_id NULL). İdempotenttir: kullanıcı yoksa UPDATE etkisizdir
    (rowcount 0) ve SESSİZCE geçilir — "bulunamadı" kararını Service verir (varlığı
    önce doğrular); burada NotFound FIRLATILMAZ. Geçersiz bir grup_id verilirse FK
    (fk_kullanici_grup) DB tarafından reddeder; bu teknik hata DataAccessError'a
    sarmalanıp yukarı fırlatılır. Parametreli (%s); string birleştirme yok. Yetki/
    sahiplik kontrolü burada DEĞİL, Service/Controller'dadır.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.GRUBA_ATA_SORGUSU, (grup_id, kullanici_kodu))
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Kullanıcı gruba atanamadı.") from hata

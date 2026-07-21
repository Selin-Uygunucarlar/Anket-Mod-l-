"""Anket (oluşturma + kullanıcı atama + listeleme + detay + güncelleme) veri erişim katmanı.

Neden: DB ile konuşan tek yer burasıdır; SQL yalnızca bu katmanda çalıştırılır.
Service/Controller tablo/şema/SQL görmez. Tüm sorgular parametreli (prepared)
çalıştırılır; string birleştirme YASAK (SQL injection'a kapalı). Ham SQL metinleri
anket_sorgulari.py'ye ayrılmıştır (SRP + dosya boyutu); bu dosya bağlantı yönetimi,
sonuç dönüşümü ve hata sarmalama sorumluluğunu taşır.

Güvenlik: Repository yetki/rol/sahiplik BİLMEZ (admin kontrolü, erişim seviyesi
kuralları, tarih hesabı ve soru id doğrulaması Service'tedir). olusturan_kodu
buraya oturumdan gelir; client'tan alınmaz -- bunu garanti etmek Service'in işidir.
Okuma sorgularının aldığı görünürlük parametreleri de bir yetki kararı değil, bir
SÜZME girdisidir: kararı Service verir, burada yalnızca sorguya geçirilir.

Hata yönetimi: Teknik DB istisnaları DataAccessError'a sarmalanıp YUKARI
FIRLATILIR; burada loglanmaz/yutulmaz. Ham DB mesajı, tablo adı veya stack trace
üst katmana giden mesaja konmaz (orijinali `from` ile zincirlenir).
"""

from datetime import datetime

import pymysql

from common.db import veritabani_baglantisi
from common.errors import DataAccessError
from models.anket import (
    AnketDetay,
    AnketOzeti,
    AtananKullanici,
    AtanmisAnketKarti,
    BagliSoru,
)
from repositories import anket_sorgulari as sorgular


def anketleri_getir(
    gorunur_kullanici_kodu: str,
    gorunur_grup_id: int | None,
    anket_tipi: str | None = None,
    durum: str | None = None,
    olusturma_baslangic: datetime | None = None,
    olusturma_bitis: datetime | None = None,
) -> list[AnketOzeti]:
    """Görünürlük süzgecine (ve verilirse isteğe bağlı filtrelere) uyan anketleri,
    oluşturan bilgisi ve atama/yanıt sayılarıyla döner.

    Repository yetki/rol BİLMEZ: "kim neyi görür" bir iş kararıdır ve Service'e
    aittir. Burada yalnızca gelen değerlerle süzme yapılır -- anketin erişim
    seviyesi 'herkes' ise, 'grup' olup erisim_grup_id `gorunur_grup_id` ile
    eşleşiyorsa, ya da 'ben'/NULL olup olusturan_kodu `gorunur_kullanici_kodu`
    ise satır döner (kural ve NULL seviyenin neden 'ben' sayıldığı sorgu
    yorumunda). Grubu olmayan için `gorunur_grup_id` None geçilir; 'grup'
    seviyeli hiçbir anket eşleşmez (beklenen davranış).

    İSTEĞE BAĞLI FİLTRELER (hepsi None ise davranış bugünküyle birebir aynı):
      - anket_tipi: doluysa `a.anket_tipi = %s` süzgeci eklenir.
      - durum: doluysa `a.durum = %s` süzgeci eklenir.
      - olusturma_baslangic: doluysa `a.olusturma_tarihi >= %s` (alt sınır dahil).
      - olusturma_bitis: doluysa `a.olusturma_tarihi < %s` (üst sınır DIŞLAYICI;
        gün sonuna kadar kapsamak için bitişi +1 gün vermek Service'in işi).
    Bu değerler Service'ten DOĞRULANMIŞ gelir (enum üyeliği/tarih hesabı Service'te);
    Repository yalnızca süzer. Dolu her filtrenin SABİT fragmanı sorguya eklenir ve
    parametresi görünürlükten SONRA, WHERE'deki %s ile AYNI SIRAYLA parametre
    listesine konur; DEĞERLER asla SQL metnine gömülmez.

    Sıra: en yeni anket üstte (anket_id DESC). Atama/yanıt sayıları AnketAtama
    üzerinden hesaplanır (anket oluşturulurken yazılan atamalar buraya yansır;
    kimseye atanmamış anket 0 alır).
    """
    # Parametre sırası WHERE'deki %s sırasıyla BİREBİR eşleşmelidir: önce görünürlük
    # (grup_id, sicil), sonra dolu filtreler ekleniş sırasıyla. Fragman ve parametre
    # AYNI koşulda birlikte eklenir ki sıra bozulmasın.
    filtre_fragmanlari: list[str] = []
    parametreler: list = [gorunur_grup_id, gorunur_kullanici_kodu]

    if anket_tipi is not None:
        filtre_fragmanlari.append(sorgular.ANKET_TIPI_FILTRE_KOSULU)
        parametreler.append(anket_tipi)
    if durum is not None:
        filtre_fragmanlari.append(sorgular.DURUM_FILTRE_KOSULU)
        parametreler.append(durum)
    if olusturma_baslangic is not None:
        filtre_fragmanlari.append(sorgular.OLUSTURMA_BASLANGIC_FILTRE_KOSULU)
        parametreler.append(olusturma_baslangic)
    if olusturma_bitis is not None:
        filtre_fragmanlari.append(sorgular.OLUSTURMA_BITIS_FILTRE_KOSULU)
        parametreler.append(olusturma_bitis)

    # Yalnızca SABİT fragmanlar birleştirilir (kullanıcı değeri değil); hiç filtre
    # yoksa yer tutucu boş dizeye çözülür ve sorgu bugünküyle aynı kalır.
    sorgu = sorgular.ANKETLER_LISTE_SORGUSU_TABAN.format(
        filtre_kosullari="".join(filtre_fragmanlari)
    )

    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgu, tuple(parametreler))
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Anket listesi okunamadı.") from hata

    return [
        AnketOzeti(
            anket_id=satir["anket_id"],
            ad=satir["ad"],
            durum=satir["durum"],
            olusturan_ad=satir["olusturan_ad"],
            olusturan_soyad=satir["olusturan_soyad"],
            olusturma_tarihi=satir["olusturma_tarihi"],
            atanan_sayisi=satir["atanan_sayisi"],
            yanitlayan_sayisi=satir["yanitlayan_sayisi"],
        )
        for satir in satirlar
    ]


def atanan_bekleyen_anketleri_getir(kullanici_kodu: str) -> list[AtanmisAnketKarti]:
    """Bir kullanıcıya atanmış, anketi aktif ve henüz çözülmemiş anketleri döner.

    Ana ekran panelinin veri kaynağıdır: AnketAtama satırı bu kullanıcıya ait,
    atama durumu 'tamamlandı' DEĞİL, anketin durumu 'Aktif' ve bugün anketin
    başlangıç–bitiş penceresinde olan anketler döner (kural ve NULL tarih davranışı
    sorgu yorumunda). Yakın biten üstte sıralanır.

    Repository yetki/rol/sahiplik BİLMEZ: sicil bir SÜZME girdisidir. Bunun oturum
    sahibinin sicili olduğunu garanti etmek (IDOR koruması) Service'in işidir;
    client'tan gelen bir sicile körlemesine güvenilmez.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                # Parametre sırası WHERE'deki %s sırasıyla eşleşir: önce sicil,
                # sonra dışlanan atama durumu (tamamlandı).
                imlec.execute(
                    sorgular.ATANAN_BEKLEYEN_ANKETLER_SORGUSU,
                    (kullanici_kodu, sorgular.ATAMA_TAMAMLANDI_DURUMU),
                )
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Atanmış anketler okunamadı.") from hata

    return [
        AtanmisAnketKarti(anket_id=satir["anket_id"], ad=satir["ad"])
        for satir in satirlar
    ]


def anket_ekle(
    ad: str,
    on_yazi: str | None,
    son_yazi: str | None,
    aciklama: str | None,
    durum: str,
    anket_tipi: str | None,
    erisim_seviyesi: str | None,
    erisim_grup_id: int | None,
    baslangic_tarihi: datetime,
    bitis_tarihi: datetime,
    olusturan_kodu: str | None,
    soru_idler: list[int],
    atanacak_kullanici_kodlari: list[str],
    son_tarih: datetime,
) -> int:
    """Anketi, soru bağlarını ve kullanıcı atamalarını TEK transaction'da ekler.

    Önce Anket INSERT edilir; oluşan anket_id (cursor.lastrowid) alınır ve
    `soru_idler` listesindeki her soru için AnketSoru bağ satırı (sira_no =
    index+1, yani gelen sıra korunur) çoklu INSERT (executemany) ile yazılır.
    Ardından `atanacak_kullanici_kodlari`ndaki her kişi için AnketAtama satırı
    yazılır (atama_tarihi = yazma anı, son_tarih = anketin bitişi, durum =
    ATAMA_BASLANGIC_DURUMU). Atama KİŞİ bazlıdır: grup DB'ye yazılmaz; grubu
    üyelerine çözmek, tekilleştirmek ve atamanın zorunlu olup olmadığına karar
    vermek Service'in işidir. Liste boşsa AnketAtama'ya hiç INSERT yapılmaz.

    İşlem bütünlüğü veritabani_baglantisi context manager'ına aittir: blok
    sorunsuz biterse commit, herhangi bir adımda istisna olursa ROLLBACK yapar.
    Bu yüzden KISMİ KAYIT OLUŞMAZ: soru bağları ya da atamalar yazılamazsa anket
    de yazılmaz. olusturma_tarihi gönderilmez; DB DEFAULT CURRENT_TIMESTAMP ile
    yazar. Tüm sorgular parametreli (%s); string birleştirme yoktur. Doğrulama
    (soru/kullanıcı id'lerinin varlığı, erişim seviyesi kuralları, tarih hesabı)
    Service'in işidir. Yeni anket_id döner.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    sorgular.ANKET_EKLE_SORGUSU,
                    (
                        ad,
                        on_yazi,
                        son_yazi,
                        aciklama,
                        durum,
                        anket_tipi,
                        erisim_seviyesi,
                        erisim_grup_id,
                        baslangic_tarihi,
                        bitis_tarihi,
                        olusturan_kodu,
                    ),
                )
                yeni_anket_id = imlec.lastrowid

                if soru_idler:
                    # Sorular gelen sıraya göre 1'den başlayan sira_no ile bağlanır.
                    bag_parametreleri = [
                        (yeni_anket_id, soru_id, indeks + 1)
                        for indeks, soru_id in enumerate(soru_idler)
                    ]
                    imlec.executemany(
                        sorgular.ANKETSORU_EKLE_SORGUSU, bag_parametreleri
                    )

                if atanacak_kullanici_kodlari:
                    # Atamalar tek anda yazıldığından hepsi aynı atama_tarihi'ni taşır.
                    atama_tarihi = datetime.now()
                    atama_parametreleri = [
                        (
                            yeni_anket_id,
                            kullanici_kodu,
                            atama_tarihi,
                            son_tarih,
                            sorgular.ATAMA_BASLANGIC_DURUMU,
                        )
                        for kullanici_kodu in atanacak_kullanici_kodlari
                    ]
                    imlec.executemany(
                        sorgular.ANKETATAMA_EKLE_SORGUSU, atama_parametreleri
                    )
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Anket eklenemedi.") from hata

    return yeni_anket_id


def soru_idleri_getir(soru_idler: list[int]) -> list[int]:
    """Verilen soru_id'lerden DB'de gerçekten var olanları döner.

    Neden: client'tan gelen soru id'lerine güvenilmez; Service dönen kümeyi
    isteneni ile karşılaştırıp eksikleri bulur ("hangi id geçersiz" kararı bir iş
    kararıdır, Service'e aittir). IN listesinin yer tutucuları soru SAYISI kadar
    üretilir; id DEĞERLERİ SQL metnine gömülmez, hepsi parametre olarak geçer.
    Boş liste ile çağrılmaz (Service en az 1 soru şartını önce uygular).
    """
    yer_tutucular = ", ".join(["%s"] * len(soru_idler))
    sorgu = sorgular.SORU_IDLERI_VAR_MI_SORGUSU.format(yer_tutucular=yer_tutucular)

    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgu, tuple(soru_idler))
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Sorular okunamadı.") from hata

    return [satir["soru_id"] for satir in satirlar]


def anket_detay_getir(
    anket_id: int, gorunur_kullanici_kodu: str, gorunur_grup_id: int | None
) -> AnketDetay | None:
    """Tek anketi bağlı soruları ve atanan kullanıcılarıyla döner; görünmüyorsa None.

    Görünürlük parametreleri anketleri_getir ile AYNI koşula (anket_sorgulari.
    GORUNURLUK_KOSULU) girer; yani listede görünmeyen bir anket burada da satır
    döndürmez ve fonksiyon None verir. Böylece erişimi olmayan için anket "yok" gibi
    davranır: ne varlığı ne içeriği sızar (client'tan gelen anket_id'ye körlemesine
    güvenilmez -- IDOR'a kapalı). "Bulunamadı"nın nasıl yorumlanacağı (NotFound) bir
    iş kararıdır ve Service'e aittir; burada NotFound FIRLATILMAZ.

    Soru bağları ve atamalar, anket satırı bulunduktan sonra aynı bağlantıda iki ek
    sorguyla çekilip tek AnketDetay'e monte edilir (montaj veri dönüşümüdür, iş
    kuralı değil). soru_metni HAM döner (sanitizasyon Service'in işi).
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                # Parametre sırası sorgudaki %s sırasıyla eşleşir: anket_id, sonra
                # görünürlük koşulunun grup_id ve sicil'i.
                imlec.execute(
                    sorgular.ANKET_DETAY_SORGUSU,
                    (anket_id, gorunur_grup_id, gorunur_kullanici_kodu),
                )
                anket_satiri = imlec.fetchone()
                if anket_satiri is None:
                    return None

                imlec.execute(sorgular.ANKET_SORULARI_SORGUSU, (anket_id,))
                soru_satirlari = imlec.fetchall()
                imlec.execute(
                    sorgular.ANKET_ATANAN_KULLANICILAR_SORGUSU, (anket_id,)
                )
                atanan_satirlari = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Anket okunamadı.") from hata

    return AnketDetay(
        anket_id=anket_satiri["anket_id"],
        ad=anket_satiri["ad"],
        on_yazi=anket_satiri["on_yazi"],
        son_yazi=anket_satiri["son_yazi"],
        aciklama=anket_satiri["aciklama"],
        durum=anket_satiri["durum"],
        anket_tipi=anket_satiri["anket_tipi"],
        erisim_seviyesi=anket_satiri["erisim_seviyesi"],
        erisim_grup_id=anket_satiri["erisim_grup_id"],
        baslangic_tarihi=anket_satiri["baslangic_tarihi"],
        bitis_tarihi=anket_satiri["bitis_tarihi"],
        olusturan_kodu=anket_satiri["olusturan_kodu"],
        bagli_sorular=[
            BagliSoru(
                soru_id=satir["soru_id"],
                soru_metni=satir["soru_metni"],
                soru_tipi=satir["soru_tipi"],
            )
            for satir in soru_satirlari
        ],
        atanan_kullanicilar=[
            AtananKullanici(
                kullanici_kodu=satir["kullanici_kodu"],
                ad=satir["ad"],
                soyad=satir["soyad"],
                email=satir["email"],
            )
            for satir in atanan_satirlari
        ],
    )


def anket_atanan_kodlari_getir(anket_id: int) -> list[str]:
    """Ankete şu an atanmış kişilerin sicillerini döner (atama yoksa boş liste).

    Neden ayrı okuma: güncellemede atamalara FARK uygulanır ve "kim eklenecek / kim
    çıkarılacak" karşılaştırmasını Service yapar (iş kararı). Repository fark
    HESAPLAMAZ; yalnızca mevcut durumu bildirir.
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.ANKET_ATANAN_KODLARI_SORGUSU, (anket_id,))
                satirlar = imlec.fetchall()
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Anket atamaları okunamadı.") from hata

    return [satir["kullanici_kodu"] for satir in satirlar]


def anket_guncelle(
    anket_id: int,
    ad: str,
    on_yazi: str | None,
    son_yazi: str | None,
    aciklama: str | None,
    durum: str,
    anket_tipi: str | None,
    erisim_seviyesi: str | None,
    erisim_grup_id: int | None,
    baslangic_tarihi: datetime,
    bitis_tarihi: datetime,
    soru_idler: list[int],
    eklenecek_kullanici_kodlari: list[str],
    cikarilacak_kullanici_kodlari: list[str],
    son_tarih: datetime,
) -> None:
    """Anketi, soru bağlarını ve atama farkını TEK transaction'da günceller.

    Sıra: (1) ANKET_GUNCELLE_SORGUSU ile anketin düzenlenebilir alanları yazılır
    (olusturan_kodu/olusturma_tarihi DEĞİŞMEZ); (2) ANKETSORU_BAGLARINI_SIL_SORGUSU
    ile eski soru bağları silinip `soru_idler` gelen sıraya göre (sira_no = index+1)
    yeniden yazılır -- bağ satırında korunacak durum bilgisi olmadığından "sil +
    yeniden yaz" güvenlidir; (3) `eklenecek_kullanici_kodlari` için yeni AnketAtama
    satırları (atama_tarihi = yazma anı, son_tarih = anketin yeni bitişi, durum =
    ATAMA_BASLANGIC_DURUMU) eklenir; (4) `cikarilacak_kullanici_kodlari`nın atama
    satırları silinir.

    ATAMALARDA FARK UYGULANIR, hepsi silinip yeniden yazılmaz: listede KALAN kişinin
    satırına DOKUNULMAZ, böylece durum/baslama_tarihi/tamamlanma_tarihi ve (Cevap FK'si
    CASCADE olduğundan) verdiği cevaplar korunur. Ekle/çıkar listeleri Service'ten
    PARAMETRE gelir; farkı Repository HESAPLAMAZ (iş kararı). Her iki liste de boş
    olabilir (o adım atlanır).

    İşlem bütünlüğü veritabani_baglantisi context manager'ına aittir: blok sorunsuz
    biterse commit, herhangi bir adımda istisna olursa ROLLBACK -- kısmi güncelleme
    kalmaz. Kayıt yoksa/görünmüyorsa UPDATE etkisizdir (rowcount 0) ve sessizce
    geçilir: varlık + görünürlük ("görebilen güncelleyebilir") doğrulamasını Service
    ÖNCE anket_detay_getir ile yapar. Tüm sorgular parametreli (%s); serbest metinler
    (ad/on_yazi/son_yazi/aciklama) SQL metnine gömülmez, HAM yazılır (sanitizasyon
    Service'in işi).
    """
    try:
        with veritabani_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(
                    sorgular.ANKET_GUNCELLE_SORGUSU,
                    (
                        ad,
                        on_yazi,
                        son_yazi,
                        aciklama,
                        durum,
                        anket_tipi,
                        erisim_seviyesi,
                        erisim_grup_id,
                        baslangic_tarihi,
                        bitis_tarihi,
                        anket_id,
                    ),
                )

                imlec.execute(
                    sorgular.ANKETSORU_BAGLARINI_SIL_SORGUSU, (anket_id,)
                )
                if soru_idler:
                    # Sorular gelen sıraya göre 1'den başlayan sira_no ile bağlanır.
                    bag_parametreleri = [
                        (anket_id, soru_id, indeks + 1)
                        for indeks, soru_id in enumerate(soru_idler)
                    ]
                    imlec.executemany(
                        sorgular.ANKETSORU_EKLE_SORGUSU, bag_parametreleri
                    )

                if eklenecek_kullanici_kodlari:
                    # Yeni atamalar tek anda yazıldığından hepsi aynı atama_tarihi'ni taşır.
                    atama_tarihi = datetime.now()
                    atama_parametreleri = [
                        (
                            anket_id,
                            kullanici_kodu,
                            atama_tarihi,
                            son_tarih,
                            sorgular.ATAMA_BASLANGIC_DURUMU,
                        )
                        for kullanici_kodu in eklenecek_kullanici_kodlari
                    ]
                    imlec.executemany(
                        sorgular.ANKETATAMA_EKLE_SORGUSU, atama_parametreleri
                    )

                if cikarilacak_kullanici_kodlari:
                    # Yer tutucular sicil SAYISI kadar üretilir; DEĞERLER parametre geçer.
                    yer_tutucular = ", ".join(
                        ["%s"] * len(cikarilacak_kullanici_kodlari)
                    )
                    silme_sorgusu = sorgular.ANKETATAMA_SIL_SORGUSU.format(
                        yer_tutucular=yer_tutucular
                    )
                    imlec.execute(
                        silme_sorgusu,
                        (anket_id, *cikarilacak_kullanici_kodlari),
                    )
    except pymysql.MySQLError as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Anket güncellenemedi.") from hata

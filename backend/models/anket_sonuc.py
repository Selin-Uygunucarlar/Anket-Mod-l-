"""Anket sonuçları (kim atandı / kim yanıtladı / ne cevapladı) veri nesneleri (DTO).

Neden: Anket listesi ekranında "Atanan Kullanıcı Sayısı" ve "Yanıtlayan Kullanıcı
Sayısı" hücrelerinin ARKASINDAKİ kişi listesi ile tek kişinin cevapları okunur;
Repository bu satırları aşağıdaki nesnelere eşleyip Service'e döner (Service
tablo/şema/SQL bilmez).

Kapsam: AtananKullanici (anket.py) ile KARIŞTIRILMAZ -- o, düzenleme formunun
salt kimlik listesidir; buradaki AnketAtamaSatiri atamanın DURUM bilgisini de
taşır. Cevaplama akışının DTO'ları (anket_doldur.py) da ayrıdır: onlar cevap
VERMEK için, bunlar verilmiş cevabı OKUMAK içindir.

Güvenlik: Yalnızca gösterilmesi güvenli kimlik alanları taşınır; sifre_hash gibi
hassas alanlar bu DTO'lara BİLEREK konmaz. Metin alanları (soru_metni,
secenek_metni, cevap_metni) HAM taşınır; sanitizasyon (XSS) okuma sınırında
Service'in işidir. `yanitladi_mi` gibi TÜRETİLMİŞ alan da yoktur: ham durum
taşınır, yorumu Service yapar.
"""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class AnketAtamaSatiri:
    """Ankete atanmış tek kişi ve o kişinin atama durumu (atanan/yanıtlayan listesi).

    durum HAM AnketAtama.durum değeridir (atandı / devam_ediyor / tamamlandı);
    "yanıtladı mı" kararı bir iş kuralıdır ve Service'e aittir.
    """

    kullanici_kodu: str
    ad: str
    soyad: str
    email: str
    durum: str                    # kişiye özel atama durumu (Anket.durum DEĞİL)
    tamamlanma_tarihi: datetime | None  # tamamlanmadıysa None


@dataclass
class VerilenCevap:
    """Bir soruya verilmiş tek cevap satırı (Cevap tablosunun bir kaydı).

    Çoklu seçimde aynı soru_id için birden çok satır gelir. Seçim tipinde
    secenek_metni dolu / cevap_metni None; açık uçlu (yorum) tipte tersi. Şık
    sonradan silinmişse (FK SET NULL) ikisi de None olabilir.
    """

    soru_id: int
    secenek_metni: str | None     # seçilen şıkkın metni; HAM (sanitizasyon Service'te)
    cevap_metni: str | None       # açık uçlu cevap; HAM (sanitizasyon Service'te)


@dataclass
class CevaplananSoru:
    """Anketin cevaplanabilir tek sorusu (cevapların bağlanacağı soru başlığı).

    Cevabı olmayan soru da bu listede yer alır (kişi boş bırakmış olabilir);
    soru ile cevabı eşleştirmek Service'in işidir.
    """

    soru_id: int
    soru_metni: str               # HAM HTML/markup; sanitizasyon Service'in işi
    soru_tipi: str


@dataclass
class KullaniciCevapKaynagi:
    """Tek kişinin bir ankete verdiği cevapların ham iç görünümü (Repository -> Service).

    Soru↔cevap eşleştirmesi ve frontend'e giden görünümün montajı Service'in
    işidir; burada iki HAM liste yan yana taşınır (cevaplar soru_id ile bağlanır).
    """

    atama_durum: str               # HAM AnketAtama.durum; "tamamladı mı" yorumu Service'te
    sorular: list[CevaplananSoru]  # anketin cevaplanabilir soruları (grid hariç); yoksa []
    cevaplar: list[VerilenCevap]   # kişinin yazdığı cevap satırları; hiç yoksa []


@dataclass
class AnketAtamaGorunumu:
    """Ankete atanmış tek kişinin FRONTEND-GÜVENLİ satırı (Service -> Controller).

    AnketAtamaSatiri'nın (Repository iç görünümü) aksine türetilmiş `yanitladi_mi`
    alanını taşır: "Yanıtlayan Kullanıcı Sayısı" hücresinin arkasındaki liste bu
    bayrakla süzülür. Ham `durum` da korunur (ekran "devam ediyor"u ayırt edebilsin).
    ad/soyad/email düz metindir -> sanitize edilmez; hassas alan taşınmaz.
    """

    kullanici_kodu: str
    ad: str
    soyad: str
    email: str
    durum: str                          # HAM AnketAtama.durum (kişiye özel; Anket.durum DEĞİL)
    yanitladi_mi: bool                  # durum == "tamamlandı" (Service türetir)
    tamamlanma_tarihi: datetime | None  # tamamlanmadıysa None


@dataclass
class CevaplananSoruGorunumu:
    """Tek sorunun ve o kişinin o soruya verdiği cevabın birleşik görünümü.

    Soru↔cevap montajı Service'te yapılır: seçim tiplerinde işaretlenen şık metinleri
    verilen_secenekler'e, açık uçlu (yorum) cevap cevap_metni'ne düşer. Kişinin BOŞ
    bıraktığı soru da listede kalır (ikisi de boş) -- "hangi soru cevapsız" ekranda
    görünmelidir. Metinler Service'te SANITIZE EDİLMİŞTİR (frontend HTML render eder).
    """

    soru_id: int
    soru_metni: str                     # sanitize edilmiş HTML
    soru_tipi: str
    verilen_secenekler: list[str]       # sanitize edilmiş şık metinleri; cevapsızsa []
    cevap_metni: str | None             # sanitize edilmiş açık uçlu cevap; yoksa None


@dataclass
class KullaniciCevapGorunumu:
    """Tek kişinin bir ankete verdiği cevapların FRONTEND-GÜVENLİ görünümü.

    tamamlandi_mi, kişiye özel atamanın tamamlanıp tamamlanmadığıdır: tamamlanmamışsa
    gösterilen cevaplar KISMİ olabilir ve ekran bunu not düşer. Ham atama durumu,
    atama_id gibi iç iş alanları bu görünüme KONMAZ.
    """

    kullanici_kodu: str
    tamamlandi_mi: bool
    sorular: list[CevaplananSoruGorunumu]  # soru yoksa []

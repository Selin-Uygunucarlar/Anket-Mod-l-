"""Anket doldurma (cevaplama) veri nesneleri (DTO).

Neden: Repository, anketin cevaplanmaya hazır tüm içeriğini (meta + sorular +
şıklar) ve atama sahiplik bilgisini bu nesnelere eşleyip Service'e döner; Service
tablo/şema/SQL detayı bilmeden çalışır ve iş kurallarını (anket Aktif mi, tarih
penceresinde mi, atama tamamlanmış mı, soru/şık aidiyeti) bu görünüm üzerinden uygular.

Kapsam: AtanmisAnketKarti (ana ekran paneli) ve AnketDetay (düzenleme formu) ile
KARIŞTIRILMAZ -- bu DTO'lar cevaplama akışının okuma tarafına özgüdür: soruların
şıklarını da taşırlar ve atama satırının kimlik/durumunu birlikte getirirler.

Güvenlik: soru_metni ve secenek_metni HAM (biçimli HTML/markup) taşınır;
sanitizasyon (XSS) okuma sınırında Service'in işidir. AnketDoldurKaynak bir
Repository->Service İÇ görünümüdür; frontend'e giden güvenli DTO'yu Service kurar.
"""

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class DoldurSecenek:
    """Cevaplanacak bir sorunun tek şıkkı (radyo/checkbox/dropdown öğesi)."""

    secenek_id: int
    secenek_metni: str            # HAM HTML/markup; sanitizasyon Service'in işi
    sira_no: int | None           # gösterim sırası; NULL olabilir (deterministik ikincil: secenek_id)


@dataclass
class DoldurSoru:
    """Cevaplanacak tek soru: metni, tipi, zorunluluğu ve (varsa) şıkları.

    grid tipli sorular bu görünüme HİÇ girmez (Repository sorgusunda dışlanır;
    bu tur kapsam dışı). Açık uçlu (yorum) sorularda secenekler boş liste kalır.
    """

    soru_id: int
    soru_metni: str               # HAM HTML/markup; sanitizasyon Service'in işi
    soru_tipi: str
    zorunlu_mu: bool
    sira_no: int | None           # ankette görünme sırası; NULL olabilir (ikincil: soru_id)
    secenekler: list[DoldurSecenek] = field(default_factory=list)


@dataclass
class AnketDoldurKaynak:
    """Anketin cevaplanmaya hazır tam iç görünümü (Repository -> Service).

    atama_id / atama_durum, bu anketin talep eden kullanıcıya ATANMIŞ olduğunu
    (sahiplik kapısı) ve atamanın kişiye özel durumunu (Anket.durum DEĞİL) taşır.
    Service iş kurallarını (Aktif mi, tarih penceresi, atama tamamlandı mı, soru/şık
    aidiyeti) BU görünümle uygular; frontend'e giden güvenli DTO'yu kendisi kurar.
    """

    anket_id: int
    ad: str
    on_yazi: str | None           # serbest metin; girilmemişse None
    son_yazi: str | None
    durum: str                    # anketin yaşam döngüsü (AnketAtama.durum ile karıştırılmaz)
    baslangic_tarihi: datetime | None
    bitis_tarihi: datetime | None
    atama_id: int                 # bu kullanıcının bu ankete atama satırının kimliği (sahiplik)
    atama_durum: str              # kişiye özel atama durumu: atandı / devam_ediyor / tamamlandı
    sorular: list[DoldurSoru]     # cevaplanacak sorular (grid hariç); soru yoksa []


@dataclass
class CevapGirdisi:
    """Tek bir soruya verilen ham cevap (Controller/HTTP -> Service girdisi).

    Frontend'ten gelir; İÇERİĞİNE GÜVENİLMEZ. Service, soru_id'nin ankete, her
    secenek_id'nin o sorunun şık kümesine ait olduğunu ve tipe göre kardinaliteyi
    (tekil seçim = tek şık, çoklu seçim = >=1 şık, yorum = serbest metin) doğrular.
    Seçim tiplerinde cevap_metni boş kalır; yorum tipinde secenek_idler boş kalır ve
    cevap_metni Service'te sanitize edilir. Boş/atlanan (zorunsuz, cevapsız) soru için
    de bir CevapGirdisi gelebilir; Service o soruya satır yazmaz.
    """

    soru_id: int
    secenek_idler: list[int]      # seçilen şık kimlikleri; yorum tipinde boş
    cevap_metni: str | None       # yorum tipinde HAM metin; seçim tiplerinde boş/None


@dataclass
class AnketDoldurGorunumu:
    """Anketin cevaplanmaya hazır FRONTEND-GÜVENLİ görünümü (Service -> Controller).

    AnketDoldurKaynak'ın (Repository iç görünümü) aksine yalnızca cevaplama ekranının
    ihtiyaç duyduğu alanları taşır ve soru/şık metinleri Service'te XSS'e karşı SANITIZE
    EDİLMİŞTİR (frontend HTML olarak render eder). tamamlandi_mi, kişiye özel atamanın
    tamamlanıp tamamlanmadığıdır (frontend formu salt-okunur gösterip yeniden gönderimi
    engelleyebilir; otorite yine sunucudadır). durum/tarih/atama_id gibi iç iş kuralı
    alanları bu görünüme KONMAZ (dışa sızmaz).
    """

    anket_id: int
    ad: str
    on_yazi: str | None
    son_yazi: str | None
    tamamlandi_mi: bool
    sorular: list[DoldurSoru]     # metinleri sanitize edilmiş sorular; soru yoksa []

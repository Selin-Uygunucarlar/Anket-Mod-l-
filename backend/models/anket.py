"""Anket veri nesneleri (DTO).

Neden: Repository, anket verisini bu nesnelere eşleyip Service'e döner; Service
tablo/şema/SQL detayı bilmeden çalışır.

Kapsam: anket OLUŞTUR + LİSTELE (AnketOzeti) ve anket GÜNCELLE'nin düzenleme
formunu ön-doldurma ihtiyacı (AnketDetay + taşıdığı BagliSoru / AtananKullanici).
Ayrıca ana ekranın "bana atanmış, aktif, henüz çözülmemiş anketler" paneli için
dar bir liste satırı (AtanmisAnketKarti).
Liste ile detay AYRI DTO'lardır: liste satırı sayaç gösterir, detay formu doldurur.

Güvenlik: AtananKullanici yalnızca formda gösterilmesi güvenli kimlik alanlarını
taşır; sifre_hash gibi hassas alan bu DTO'lara BİLEREK konmaz.
"""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class AnketOzeti:
    """Anket listesi satırı: liste ekranının kolonlarının birebir karşılığı."""

    anket_id: int
    ad: str
    durum: str                    # anketin yaşam döngüsü (AnketAtama.durum ile karıştırılmaz)
    olusturan_ad: str | None      # Kullanici LEFT JOIN; oluşturan silinmişse (SET NULL) None
    olusturan_soyad: str | None
    olusturma_tarihi: datetime
    atanan_sayisi: int            # bu ankete atanan kullanıcı sayısı
    yanitlayan_sayisi: int        # atamasını 'tamamlandı' işaretleyen kullanıcı sayısı


@dataclass
class AtanmisAnketKarti:
    """Ana ekran panelinin bir satırı: kullanıcıya atanmış, çözülmeyi bekleyen anket.

    AnketOzeti yeniden kullanılmaz: o, admin liste ekranının sayaç/JOIN alanlarını
    (oluşturan ad-soyad, atanan/yanıtlayan sayısı) taşır ve bu panel için gereksiz
    JOIN/hesaplama getirirdi. Burada yalnızca panelde gösterip ankete gitmeye yeten
    en dar kimlik alanları tutulur.
    """

    anket_id: int
    ad: str


@dataclass
class BagliSoru:
    """Ankete bağlı bir soru: düzenleme formunun Sorular kartının gösterdiği alanlar.

    Soru havuzunun tam kaydı (SoruKaydi) DEĞİLDİR: burada yalnızca ankete bağlı
    sorunun listelenmesi için gerekenler taşınır (bağın sira_no'su sıralamada
    kullanılır, gösterilmez).
    """

    soru_id: int
    soru_metni: str               # HAM HTML/markup; sanitizasyon Service'in işi
    soru_tipi: str


@dataclass
class AtananKullanici:
    """Ankete atanmış bir kişi: düzenleme formunun Kullanıcılar kartının alanları.

    KullaniciOzet yeniden kullanılmaz: o, admin kullanıcı listesinin (aktif/yönetici/
    son giriş) kolonlarını taşır ve buradaki iş için gereksiz JOIN/alan getirirdi.
    """

    kullanici_kodu: str
    ad: str
    soyad: str
    email: str


@dataclass
class AnketDetay:
    """Tek anketin düzenleme formunu ön-doldurmaya yeten tam görünümü.

    olusturma_tarihi taşınmaz (form onu göstermez/değiştirmez); olusturan_kodu
    yalnızca bilgi olarak gelir -- güncelleme onu değiştirmez.
    """

    anket_id: int
    ad: str
    on_yazi: str | None           # serbest metin alanları; girilmemişse None
    son_yazi: str | None
    aciklama: str | None
    durum: str                    # anketin yaşam döngüsü (AnketAtama.durum ile karıştırılmaz)
    anket_tipi: str | None
    erisim_seviyesi: str | None   # KOD: 'herkes' | 'grup' | 'ben' (UI cümlesi değil); eski kayıtta None
    erisim_grup_id: int | None    # yalnızca seviye 'grup' iken dolu; grup silinmişse (SET NULL) None
    baslangic_tarihi: datetime | None
    bitis_tarihi: datetime | None
    olusturan_kodu: str | None    # oluşturan silinmişse (SET NULL) None
    bagli_sorular: list[BagliSoru]          # anketin soruları, ankette görünme sırasıyla
    atanan_kullanicilar: list[AtananKullanici]  # ankete atanmış kişiler; kimse yoksa []

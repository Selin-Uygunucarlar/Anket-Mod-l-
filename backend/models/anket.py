"""Anket veri nesneleri (DTO).

Neden: Repository, anket verisini bu nesnelere eşleyip Service'e döner; Service
tablo/şema/SQL detayı bilmeden çalışır.

Kapsam: Bu faz yalnızca anket OLUŞTUR + LİSTELE'yi kapsar; bu yüzden burada tek
DTO vardır (AnketOzeti). Detay/güncelleme DTO'su bugün bir ihtiyaç olmadığından
PEŞİNEN EKLENMEZ (over-engineering yasağı).
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

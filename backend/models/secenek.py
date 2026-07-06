"""Yönetilen dropdown seçeneğinin veri nesnesi (DTO).

Neden: Kullanıcı ekleme formundaki 10 dropdown alanının (sirket, grup, bolum ...)
seçenekleri TanimliSecenek tablosunda tek bir şemada tutulur. Repository, her
satırı bu tek nesneye eşleyip Service'e döner; Service tablo/şema detayı bilmeden
kategoriye göre seçenekleri gruplayabilir.
"""

from dataclasses import dataclass


@dataclass
class SecenekKaydi:
    """Bir dropdown kategorisine ait tek bir seçilebilir değer."""

    kategori: str  # dropdown alanının kimliği (sabit küme; ör. sirket, grup)
    deger: str     # o kategoride seçilebilir değer

"""Anket sorusu ve şıklarının veri nesneleri (DTO'lar).

Neden: Repository, soru listeleme akışında Soru (hazırlayan için Kullanici öz-JOIN)
ve Secenek satırlarını bu nesnelere eşleyip Service'e döner; Service tablo/şema
detayı bilmeden çalışır. Her SoruKaydi bir soruyu ve (varsa) şıklarını özetler.

Güvenlik: soru_metni biçimlendirilmiş HAM HTML/markup taşır ve BURADA
sanitize EDİLMEZ; XSS'e karşı sunucu tarafı sanitizasyon Service katmanının
sorumluluğudur (bkz. migration 007). Repository ham içeriği aynen döner.
"""

from dataclasses import dataclass, field


@dataclass
class SoruSecenegi:
    """Bir soruya ait tek bir şık (çoktan seçmeli seçeneği)."""

    secenek_metni: str        # şıkkın metni
    sira_no: int | None       # şıkkın gösterim sırası; tanımsızsa None


@dataclass
class SoruKaydi:
    """Bir soruyu hazırlayan bilgisi ve şıklarıyla özetler; hem liste hem tekil detay için ortak."""

    soru_id: int
    anket_id: int
    soru_metni: str           # HAM HTML/markup; sanitizasyon Service'te yapılır (XSS)
    soru_tipi: str            # metin / çoktan seçmeli / ölçek ...
    konu: str | None          # soru ekleme/düzenleme formunun kategorisi; tanımsızsa None
    amac: str | None          # soru ekleme/düzenleme formunun kategorisi; tanımsızsa None
    sira_no: int | None       # sorunun anket içi sırası; tanımsızsa None
    zorunlu_mu: bool          # cevaplanması zorunlu mu
    hazirlayan_kodu: str | None   # hazırlayan admin'in sicili; bilinmiyorsa None
    hazirlayan_ad: str | None     # hazırlayanın adı; hazırlayan yoksa None
    hazirlayan_soyad: str | None  # hazırlayanın soyadı; hazırlayan yoksa None
    secenekler: list[SoruSecenegi] = field(default_factory=list)  # şıklar; yoksa boş

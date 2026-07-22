"""Anket sorusu ve şıklarının veri nesneleri (DTO'lar).

Neden: Repository, soru listeleme akışında Soru (hazırlayan için Kullanici öz-JOIN)
ve Secenek satırlarını bu nesnelere eşleyip Service'e döner; Service tablo/şema
detayı bilmeden çalışır. Her SoruKaydi bir soruyu ve (varsa) şıklarını özetler.
Ters yönde (Service -> Repository) YuklenecekSoru, Excel'den gelen toplu soru
yüklemenin tek bir kayıt girdisini taşır.

Güvenlik: OKUMA yönünde (SoruKaydi/SoruSecenegi) soru_metni biçimlendirilmiş HAM
HTML/markup taşır ve BURADA sanitize EDİLMEZ; XSS'e karşı sunucu tarafı
sanitizasyon Service katmanının sorumluluğudur (bkz. migration 007). YAZMA
yönünde (YuklenecekSoru) metinler Service'te ZATEN sanitize edilmiş gelir;
DTO'da yeniden temizleme yapılmaz.
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


@dataclass
class YuklenecekSoru:
    """Excel ile TOPLU yüklemede yazılacak tek soru (Service -> Repository girdisi).

    Service, Excel satırlarını doğrulayıp normalize ettikten sonra bu nesnelerin
    listesini Repository'ye verir; Repository hepsini tek transaction'da yazar.
    Metinler (soru_metni, secenekler) BURAYA SANITIZE EDİLMİŞ gelir — temizleme
    Service'te yapılır, DTO/Repository yeniden temizlemez. Soru bağımsız eklenir
    (anket_id/sira_no/zorunlu_mu Repository'de sabit), bu yüzden alan taşımaz.
    """

    soru_metni: str            # sanitize edilmiş biçimli içerik (Service'te temizlendi)
    soru_tipi: str             # çoktan seçmeli / yorum / skala ...
    konu: str                  # form kategorisi; zorunluluğu Service doğrular
    amac: str                  # form kategorisi; zorunluluğu Service doğrular
    hazirlayan_kodu: str | None  # yükleyen admin'in sicili; bilinmiyorsa None
    secenekler: list[str] = field(default_factory=list)  # sıralı şık metinleri; yoksa boş

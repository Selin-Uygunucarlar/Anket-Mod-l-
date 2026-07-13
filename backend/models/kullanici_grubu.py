"""Kullanıcı grubu veri nesneleri (DTO).

Neden: Repository, ilişkisel "Kullanıcı Grupları" özelliğinin verisini bu
nesnelere eşleyip Service'e döner; Service tablo/şema/SQL detayı bilmeden çalışır.
Bu dosya iki hafif DTO taşır: KullaniciGrubu (grup + üye sayısı özeti) ve
GrupUyesi (bir grubun üyesinin listede gösterilecek güvenli özeti).

Ayrım: Buradaki "grup", Kullanici.grup_id ile kurulan İLİŞKİSEL gruptur; mevcut
serbest-metin Kullanici.grup etiketiyle karıştırılmaz.

Güvenlik: GrupUyesi yalnızca gösterimi güvenli alanları (kimlik/ad/e-posta)
taşır; sifre_hash veya hassas kimlik alanı BİLEREK konmaz.
"""

from dataclasses import dataclass


@dataclass
class KullaniciGrubu:
    """Bir kullanıcı grubunun özeti (grup listesi satırı)."""

    grup_id: int      # grubun kimliği (PK)
    ad: str           # grup adı (ör. Yönetici, Mühendis)
    uye_sayisi: int   # bu gruba bağlı kullanıcı sayısı (üyesi yoksa 0)


@dataclass
class GrupUyesi:
    """Bir gruba bağlı kullanıcının listede gösterilen güvenli özeti."""

    kullanici_kodu: str  # üyenin sicili (SAP no)
    ad: str              # üyenin adı
    soyad: str           # üyenin soyadı
    email: str           # üyenin e-postası

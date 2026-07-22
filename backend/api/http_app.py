"""HTTP / sınır (boundary) adaptörü — Controller'ı HTTP üzerinden açar.

Neden: Frontend ile backend Controller katmanı arasındaki TEK HTTP giriş
noktasıdır. Sorumluluğu yalnızca protokol adaptasyonudur: HTTP isteğini
Controller imzasına çevirir, Controller'ın döndürdüğü güvenli sözlüğü uygun
HTTP durum koduna eşler.

Bu dosya İŞ MANTIĞI İÇERMEZ ve LOGLAMA YAPMAZ. Doğrulama, yetki ve hata
loglaması zaten Controller/Service katmanında (error pipeline) bir kez yapılır;
burada tekrar loglama veya hata yutma yoktur. Sızıntı önlemek için yanıt gövdesi
Controller'ın ürettiği güvenli sözlüğün AYNISIDIR; ek alan/teknik detay eklenmez.
"""

import os

from fastapi import Cookie, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from common.constants import OTURUM_SURESI_DAKIKA
from controllers import (
    anket_controller,
    anket_doldur_controller,
    auth_controller,
    grup_controller,
    kullanici_controller,
    secenek_controller,
    soru_controller,
)

# Geliştirme (Vite) origin'leri; üretimde ortam bazlı genişletilir. "*" AÇILMAZ.
_IZINLI_ORIGINLER = ["http://localhost:5173", "http://127.0.0.1:5173"]

# Hata kodu -> HTTP durum kodu eşlemesi. Controller'ın döndürdüğü `kod` alanı
# tek yetkili kaynaktır; burada yeniden yorumlanmaz, yalnızca protokole çevrilir.
_KOD_HTTP_ESLEME = {
    "VALIDATION_ERROR": 400,
    "AUTH_ERROR": 401,
    "ACCOUNT_LOCKED": 423,
    "SESSION_INVALID": 401,
    "YETKI_YOK": 403,
    "NOT_FOUND": 404,
    "SECENEK_ZATEN_VAR": 409,
    "BUSINESS_RULE_ERROR": 409,
    "UNEXPECTED_ERROR": 500,
}

# httpOnly oturum cookie'sinin adı ve ortak bayrakları (transport kararı).
_OTURUM_COOKIE_ADI = "oturum"
_COOKIE_PATH = "/"
_COOKIE_MAX_AGE = OTURUM_SURESI_DAKIKA * 60


def _cookie_secure_bayragi() -> bool:
    """`Secure` cookie bayrağını ortamdan okur (dev'de kapalı, prod'da açık).

    Sır değildir ama dağıtıma bağlı bir karardır: COOKIE_SECURE=true ise HTTPS
    zorunlu kılınır. Varsayılan (tanımsız) dev için false'tur; koda gömülmez.
    """
    return os.environ.get("COOKIE_SECURE", "false").strip().lower() == "true"


def _oturum_cookiesini_yaz(yanit: JSONResponse, ham_jeton: str) -> None:
    """Ham oturum jetonunu httpOnly cookie olarak yazar (kayan pencereyle senkron).

    Bayraklar: httponly (JS erişemez), samesite=lax, path=/, secure ortam bazlı,
    max_age kayan pencere uzunluğu. Jeton yalnızca cookie'ye gider; gövdeye konmaz.
    """
    yanit.set_cookie(
        key=_OTURUM_COOKIE_ADI,
        value=ham_jeton,
        max_age=_COOKIE_MAX_AGE,
        path=_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=_cookie_secure_bayragi(),
    )


app = FastAPI(title="Savronik Akademi API", version="0.1.0")

# CORS: yalnızca dev origin'lere; cookie tabanlı oturum için credentials açık.
# allow_credentials ile "*" origin zaten geçersiz olur; sabit liste korunur.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_IZINLI_ORIGINLER,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["content-type"],
)


class GirisIstegi(BaseModel):
    """Login istek gövdesi. Ek kısıt yok; boş-alan doğrulaması Controller'a aittir.

    `kimlik` sicil kodu VEYA e-posta olabilir (Controller.login imzasıyla birebir).
    """

    kimlik: str
    sifre: str


class SecenekEkleIstegi(BaseModel):
    """Yeni dropdown seçeneği istek gövdesi. Kategori/deger doğrulaması Service'te."""

    kategori: str
    deger: str


class SecenekSilIstegi(BaseModel):
    """Silinecek dropdown seçeneği istek gövdesi. Kategori/deger doğrulaması Service'te."""

    kategori: str
    deger: str


class SoruEkleIstegi(BaseModel):
    """BAĞIMSIZ anket sorusu ekleme/güncelleme istek gövdesi (anket_id YOK).

    Aynı alan kümesi hem POST (ekle) hem PUT (güncelle) için kullanılır (DRY, tıpkı
    KullaniciEkleIstegi gibi). Tip/şekil doğrulaması Controller'da, iş kuralı + XSS
    sanitizasyonu Service'te. hazirlayan_kodu gövdede DEĞİL: sunucu tarafı oturumdan
    alınır (client'a güvenilmez). Güncellemede kaydın soru_id'si path'ten gelir.
    """

    soru_tipi: str
    konu: str
    amac: str
    soru_metni: str
    secenekler: list[str]


class AnketEkleIstegi(BaseModel):
    """Anket oluşturma/güncelleme istek gövdesi (form alanları).

    Aynı alan kümesi hem POST (ekle) hem PUT (güncelle) için kullanılır (DRY, tıpkı
    KullaniciEkleIstegi/SoruEkleIstegi gibi). Tip/şekil doğrulaması Controller'da, iş
    kuralı (geçerli durum/tip/seviye, tarih hesabı, soruların varlığı, güncellemede
    "görebilen güncelleyebilir" görünürlük) Service'te. olusturan_kodu ve
    (erisim_seviyesi 'grup' ise) erişim grubu gövdede DEĞİL: sunucu tarafı oturumdan
    çözülür (client'a güvenilmez). Güncellemede kaydın anket_id'si path'ten gelir.
    Tarihler ham seçim olarak taşınır
    ('bugun'/'yarin'/'bir_ay'/'iki_ay'/'tarih_sec'); gerçek tarihi Service hesaplar.
    grup_idler/kullanici_kodlari, Kullanıcılar kartında ankete ATANMAK üzere seçilen
    gruplar ve kişilerdir (erisim_seviyesi ile ilgisi yoktur); seçim zorunlu değildir,
    gönderilmezse anket atamasız kalır. Formun Mesaj Ayarları/İşlemler kartları bu
    fazın DIŞINDA olduğundan burada alanları YOKTUR (bilinçli kapsam kararı).
    """

    ad: str
    on_yazi: str | None = None
    son_yazi: str | None = None
    aciklama: str | None = None
    durum: str
    anket_tipi: str
    erisim_seviyesi: str | None = None
    baslangic_secim: str
    baslangic_tarih: str | None = None
    bitis_secim: str
    bitis_tarih: str | None = None
    soru_idler: list[int]
    grup_idler: list[int] = []
    kullanici_kodlari: list[str] = []


class CevapKalemi(BaseModel):
    """Tek bir soruya verilen ham cevap (anket cevaplama istek gövdesi öğesi).

    Seçim tiplerinde secenek_idler dolu / cevap_metni boş; yorum tipinde tersi. Tip/
    şekil doğrulaması Controller'da, aidiyet/kardinalite/zorunluluk iş kuralı Service'te.
    Varsayılanlar boş liste / None; böylece cevapsız (zorunsuz) soru da temsil edilebilir.
    """

    soru_id: int
    secenek_idler: list[int] = []
    cevap_metni: str | None = None


class AnketCevapIstegi(BaseModel):
    """Anket cevaplama istek gövdesi: tüm soruların cevapları tek seferde gönderilir.

    Cevaplar kaydedilir ve atama 'tamamlandı' işaretlenir (taslak yok). anket_id
    gövdede DEĞİL, path'ten gelir; kullanıcı sicili sunucu oturumundan çözülür
    (client'a güvenilmez). İş kuralları Service'te uygulanır.
    """

    cevaplar: list[CevapKalemi] = []


class GrupEkleIstegi(BaseModel):
    """Yeni kullanıcı grubu istek gövdesi. Boş/uzunluk/tekrar doğrulaması Service'te."""

    ad: str


class GrupUyeEkleIstegi(BaseModel):
    """Gruba üye atama istek gövdesi. Sicil biçim/varlık doğrulaması Controller/Service'te."""

    kullanici_kodu: str


class SifreBelirleIstegi(BaseModel):
    """Kalıcı şifre belirleme istek gövdesi. Uzunluk/kural doğrulaması Service'te."""

    yeni_sifre: str


class KullaniciEkleIstegi(BaseModel):
    """Kullanıcı ekleme/güncelleme istek gövdesi (form alanları).

    Aynı alan kümesi hem POST (ekle) hem PUT (güncelle) için kullanılır (DRY). Zorunlu
    alanlar str; opsiyoneller varsayılan None. Boş->None normalizasyonu ve tarih parse'ı
    Controller'da, iş kuralı doğrulaması Service'te yapılır. Güncellemede `kullanici_kodu`
    İSTENEN (aynı ya da yeni) sicildir; kaydın mevcut sicili path'ten gelir.
    """

    kullanici_kodu: str
    ad: str
    soyad: str
    email: str
    kullanici_turu: str
    ise_giris_tarihi: str | None = None
    ilgili_yonetici_kodu: str | None = None
    sirket: str | None = None
    grup: str | None = None
    bolum: str | None = None
    birim: str | None = None
    kadro_grubu: str | None = None
    kadro_unvani: str | None = None
    gorev_unvani: str | None = None
    arge_personeli: str | None = None
    personel_sigorta_is_yeri: str | None = None
    gorev_yeri: str | None = None


def _kod_to_http_durum(kod: str) -> int:
    """Controller hata kodunu HTTP durum koduna çevirir; bilinmeyen kod -> 500."""
    return _KOD_HTTP_ESLEME.get(kod, 500)


@app.get("/health")
def health() -> dict:
    """Readiness kontrolü: DB'ye DOKUNMADAN servisin ayakta olduğunu bildirir."""
    return {"durum": "ok"}


@app.post("/api/auth/login")
def login(istek: GirisIstegi) -> JSONResponse:
    """Login isteğini Controller'a iletir; başarılıysa oturum cookie'si yazar.

    Controller güvenli bir sözlük döndürür; başarılı yanıttaki `oturum_jetonu`
    GÖVDEDEN ÇIKARILIR (pop) ve httpOnly cookie olarak set edilir. Böylece ham
    jeton kullanıcı yanıtının gövdesine SIZMAZ. Burada hata yutulmaz/loglanmaz.
    """
    sonuc = auth_controller.login(istek.kimlik, istek.sifre)
    # Ham jeton gövdeye asla dönmez: her durumda çıkar, başarılıysa cookie'ye koy.
    ham_jeton = sonuc.pop("oturum_jetonu", None)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and ham_jeton:
        _oturum_cookiesini_yaz(yanit, ham_jeton)
    return yanit


@app.get("/api/auth/me")
def me(oturum: str | None = Cookie(default=None)) -> JSONResponse:
    """Cookie'deki oturum jetonuyla mevcut kullanıcıyı döndürür (kimlik doğrulamalı).

    Jeton `oturum` cookie'sinden okunur; Controller doğrular. Başarılı doğrulamada
    kayan pencereyi tarayıcıyla senkron tutmak için cookie aynı bayraklarla YENİDEN
    set edilir (max_age tazelenir). Geçersiz oturum SESSION_INVALID -> 401.
    """
    sonuc = auth_controller.me(oturum)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.get("/api/kullanicilar")
def list_kullanicilar(oturum: str | None = Cookie(default=None)) -> JSONResponse:
    """Oturumdaki admin için tüm kullanıcıların güvenli listesini döndürür.

    Jeton `oturum` cookie'sinden okunur; Controller oturumu doğrular ve yetkiyi
    (yalnızca admin) uygular. Başarılı yanıtta kayan pencereyi tarayıcıyla senkron
    tutmak için cookie aynı bayraklarla YENİDEN set edilir. Yetkisiz -> 403,
    geçersiz oturum -> 401. Burada iş mantığı/loglama YOK; yalnızca protokol.
    """
    sonuc = kullanici_controller.list_kullanicilar(oturum)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.get("/api/kullanicilar/{kullanici_kodu}")
def get_kullanici_detay(
    kullanici_kodu: str, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki admin için tek bir kullanıcının güvenli detayını döndürür.

    kullanici_kodu path segment'inden alınır; jeton `oturum` cookie'sinden okunur.
    Controller oturumu doğrular ve yetkiyi (yalnızca admin) uygular. Başarılı yanıtta
    kayan pencereyi tarayıcıyla senkron tutmak için cookie aynı bayraklarla YENİDEN
    set edilir. Kayıt yok -> 404, yetkisiz -> 403, geçersiz oturum -> 401. Sabit
    `GET /api/kullanicilar` (liste) ile çakışmaz: FastAPI statik path'i önce eşler.
    Burada iş mantığı/loglama YOK; yalnızca protokol.
    """
    sonuc = kullanici_controller.get_kullanici_detay(oturum, kullanici_kodu)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.post("/api/kullanicilar")
def create_kullanici(
    istek: KullaniciEkleIstegi, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki admin için yeni kullanıcı oluşturur (yalnızca protokol adaptasyonu).

    Gövde Controller'a dict olarak geçilir; oturum/yetki/doğrulama Controller/Service'te.
    Başarılı yanıtta kayan pencere için cookie yenilenir. GET /api/kullanicilar ayrıdır
    (aynı path, farklı method). Yanıt gövdesi Controller'ın güvenli sözlüğüdür.
    """
    sonuc = kullanici_controller.create_kullanici(oturum, istek.model_dump())
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.put("/api/kullanicilar/{kullanici_kodu}")
def guncelle_kullanici(
    kullanici_kodu: str,
    istek: KullaniciEkleIstegi,
    oturum: str | None = Cookie(default=None),
) -> JSONResponse:
    """Oturumdaki admin için var olan bir kullanıcıyı günceller (yalnızca protokol).

    kullanici_kodu path segment'i kaydın MEVCUT sicilidir; istek gövdesindeki
    `kullanici_kodu` ise İSTENEN (aynı ya da yeni) sicildir. Oturum/yetki/doğrulama ve
    sicil değişimi kararı Controller/Service'te. Sicil bağlı kayıtlar nedeniyle
    değiştirilemezse BUSINESS_RULE_ERROR -> 409. GET/PUT aynı path'te method ile ayrışır.
    Başarılı yanıtta kayan pencere için cookie yenilenir. Yanıt Controller'ın güvenli
    sözlüğüdür.
    """
    sonuc = kullanici_controller.guncelle_kullanici(
        oturum, kullanici_kodu, istek.model_dump()
    )
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.post("/api/kullanicilar/{kullanici_kodu}/aktiflik")
def degistir_kullanici_aktiflik(
    kullanici_kodu: str, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki admin için bir kullanıcının aktiflik durumunu değiştirir (yalnızca protokol).

    kullanici_kodu path segment'inden alınır; jeton `oturum` cookie'sinden okunur.
    Oturum/yetki/iş kuralı (yalnızca admin, kayıt yok, kendini pasife alma engeli)
    Controller/Service'te. Path'e `/aktiflik` segmenti eklendiğinden GET
    /api/kullanicilar/{kullanici_kodu} (detay) ile çakışmaz. Başarılı yanıtta kayan
    pencere için cookie aynı bayraklarla YENİDEN set edilir.
    """
    sonuc = kullanici_controller.degistir_aktiflik(oturum, kullanici_kodu)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.get("/api/secenekler")
def list_secenekler(oturum: str | None = Cookie(default=None)) -> JSONResponse:
    """Oturumdaki admin için tüm dropdown seçeneklerini döndürür (yalnızca protokol).

    Jeton `oturum` cookie'sinden okunur; Controller oturumu doğrular ve yetkiyi uygular.
    Başarılı yanıtta kayan pencere için cookie aynı bayraklarla yenilenir.
    """
    sonuc = secenek_controller.list_secenekler(oturum)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.post("/api/secenekler")
def ekle_secenek(
    istek: SecenekEkleIstegi, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki admin için yeni bir dropdown seçeneği ekler (yalnızca protokol).

    Kategori/deger Controller'a iletilir; doğrulama/yetki Controller/Service'te. Aynı
    seçenek zaten varsa SECENEK_ZATEN_VAR -> 409. Başarılıysa cookie yenilenir.
    """
    sonuc = secenek_controller.ekle_secenek(oturum, istek.kategori, istek.deger)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.delete("/api/secenekler")
def sil_secenek(
    istek: SecenekSilIstegi, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki admin için bir dropdown seçeneğini siler (yalnızca protokol).

    Kategori/deger Controller'a iletilir; doğrulama/yetki Controller/Service'te. Silme
    idempotenttir. Başarılıysa kayan pencere için cookie yenilenir. Aynı path'teki
    GET (liste) ve POST (ekle) uçlarından method ile ayrışır.
    """
    sonuc = secenek_controller.sil_secenek(oturum, istek.kategori, istek.deger)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.get("/api/sorular")
def list_sorular(oturum: str | None = Cookie(default=None)) -> JSONResponse:
    """Oturumdaki admin için tüm anket sorularını döndürür (yalnızca protokol).

    Jeton `oturum` cookie'sinden okunur; Controller oturumu doğrular ve yetkiyi
    (yalnızca admin) uygular. soru_metni sunucu tarafında sanitize edilmiş HTML'dir.
    Başarılı yanıtta kayan pencere için cookie aynı bayraklarla yenilenir.
    """
    sonuc = soru_controller.list_sorular(oturum)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.post("/api/sorular")
def ekle_soru(
    istek: SoruEkleIstegi, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki admin için BAĞIMSIZ yeni bir anket sorusu ekler (yalnızca protokol).

    Gövde alanları Controller'a iletilir; oturum/yetki/doğrulama/sanitize
    Controller/Service'te. hazirlayan_kodu gövdede yoktur, oturumdan alınır. Aynı
    path'teki GET (liste) ve DELETE (sil) uçlarından method ile ayrışır. Başarılı
    yanıtta (soru_id dahil güvenli sözlük) kayan pencere için cookie yenilenir.
    """
    sonuc = soru_controller.ekle_soru(
        oturum,
        istek.soru_tipi,
        istek.konu,
        istek.amac,
        istek.soru_metni,
        istek.secenekler,
    )
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.get("/api/sorular/{soru_id}")
def get_soru_detay(
    soru_id: int, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki admin için tek bir anket sorusunun detayını döndürür (yalnızca protokol).

    soru_id path segment'inden alınır (int); jeton `oturum` cookie'sinden okunur.
    Controller oturumu doğrular, yetkiyi (yalnızca admin) uygular; kayıt yok -> 404.
    soru_metni/şıklar Service'te sanitize edilmiş HTML'dir (düzenleme ön-doldurma).
    Sabit `GET /api/sorular` (liste) ile çakışmaz; DELETE/PUT aynı path'te method ile
    ayrışır. Başarılı yanıtta kayan pencere için cookie aynı bayraklarla yenilenir.
    """
    sonuc = soru_controller.get_soru_detay(oturum, soru_id)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.put("/api/sorular/{soru_id}")
def guncelle_soru(
    soru_id: int,
    istek: SoruEkleIstegi,
    oturum: str | None = Cookie(default=None),
) -> JSONResponse:
    """Oturumdaki admin için var olan bir anket sorusunu günceller (yalnızca protokol).

    soru_id path segment'inden alınır (int); gövde SoruEkleIstegi (ekleme ile aynı
    model). Oturum/yetki/doğrulama/sanitize/varlık kontrolü Controller/Service'te;
    hazirlayan_kodu gövdede yoktur. Kayıt yok -> NOT_FOUND -> 404. GET/PUT/DELETE
    aynı path'te method ile ayrışır. Başarılı yanıtta kayan pencere için cookie yenilenir.
    """
    sonuc = soru_controller.guncelle_soru(
        oturum,
        soru_id,
        istek.soru_tipi,
        istek.konu,
        istek.amac,
        istek.soru_metni,
        istek.secenekler,
    )
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.delete("/api/sorular/{soru_id}")
def sil_soru(
    soru_id: int, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki admin için tek bir anket sorusunu siler (yalnızca protokol).

    soru_id path segment'inden alınır (int); gövde YOKTUR. Oturum/yetki/doğrulama
    Controller/Service'te. Silme idempotenttir; şıklar ve cevaplar DB'de CASCADE
    ile birlikte gider. Başarılı yanıtta kayan pencere için cookie yenilenir.
    """
    sonuc = soru_controller.sil_soru(oturum, soru_id)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.get("/api/anketler")
def list_anketler(
    oturum: str | None = Cookie(default=None),
    anket_tipi: str | None = Query(default=None),
    durum: str | None = Query(default=None),
    tarih_araligi: str | None = Query(default=None),
    baslangic_tarih: str | None = Query(default=None),
    bitis_tarih: str | None = Query(default=None),
) -> JSONResponse:
    """Oturumdaki admin için (istenirse süzülmüş) anketlerin liste özetini döndürür (yalnızca protokol).

    Jeton `oturum` cookie'sinden okunur; Controller oturumu doğrular ve yetkiyi
    (yalnızca admin) uygular. İsteğe bağlı filtreler query parametresi olarak alınır
    (anket_tipi/durum/tarih_araligi/baslangic_tarih/bitis_tarih; hepsi opsiyonel);
    değer/enum/tarih doğrulaması Controller/Service'e aittir, burada yalnızca taşınır.
    Başarılı yanıtta kayan pencere için cookie aynı bayraklarla yenilenir. Aynı path'teki
    POST (ekle) uçundan method ile ayrışır.
    """
    sonuc = anket_controller.list_anketler(
        oturum, anket_tipi, durum, tarih_araligi, baslangic_tarih, bitis_tarih
    )
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.get("/api/anketlerim")
def list_anketlerim(oturum: str | None = Cookie(default=None)) -> JSONResponse:
    """Oturumdaki kullanıcının ana ekran bekleyen anket listesini döndürür (yalnızca protokol).

    Jeton `oturum` cookie'sinden okunur; Controller oturumu doğrular. KİŞİYE ÖZEL
    panel: admin/user ayrımı yoktur, sicil oturumdan çözülür (client'a güvenilmez).
    Başarılı yanıtta kayan pencere için cookie aynı bayraklarla yenilenir. Sabit
    `GET /api/anketler` (admin liste) ile ayrı bir path'tir; çakışmaz.
    """
    sonuc = anket_controller.list_atanmis_anketler(oturum)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.post("/api/anketler")
def ekle_anket(
    istek: AnketEkleIstegi, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki admin için yeni bir anket oluşturur (yalnızca protokol adaptasyonu).

    Gövde alanları Controller'a iletilir; oturum/yetki/doğrulama/tarih hesabı
    Controller/Service'te. olusturan_kodu gövdede yoktur, oturumdan alınır. Başarılı
    yanıtta (anket_id dahil güvenli sözlük) kayan pencere için cookie yenilenir.
    """
    sonuc = anket_controller.ekle_anket(
        oturum,
        istek.ad,
        istek.on_yazi,
        istek.son_yazi,
        istek.aciklama,
        istek.durum,
        istek.anket_tipi,
        istek.erisim_seviyesi,
        istek.baslangic_secim,
        istek.baslangic_tarih,
        istek.bitis_secim,
        istek.bitis_tarih,
        istek.soru_idler,
        istek.grup_idler,
        istek.kullanici_kodlari,
    )
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.get("/api/anketler/{anket_id}")
def get_anket_detay(
    anket_id: int, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki admin için tek bir anketin düzenleme detayını döndürür (yalnızca protokol).

    anket_id path segment'inden alınır (int); jeton `oturum` cookie'sinden okunur.
    Controller oturumu doğrular, yetkiyi (yalnızca admin) ve "görebilen görebilir"
    görünürlüğünü uygular; görünmüyor/yok -> 404. Bağlı soru metinleri Service'te
    sanitize edilmiş HTML'dir (düzenleme ön-doldurma). Sabit `GET /api/anketler`
    (liste) ile çakışmaz; PUT aynı path'te method ile ayrışır. Başarılı yanıtta kayan
    pencere için cookie aynı bayraklarla yenilenir.
    """
    sonuc = anket_controller.get_anket_detay(oturum, anket_id)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.put("/api/anketler/{anket_id}")
def guncelle_anket(
    anket_id: int,
    istek: AnketEkleIstegi,
    oturum: str | None = Cookie(default=None),
) -> JSONResponse:
    """Oturumdaki admin için var olan bir anketi günceller (yalnızca protokol adaptasyonu).

    anket_id path segment'inden alınır (int); gövde AnketEkleIstegi (ekleme ile aynı
    model). Oturum/yetki/doğrulama/tarih hesabı/atama farkı ve "görebilen
    güncelleyebilir" görünürlük kontrolü Controller/Service'te. olusturan_kodu ve
    erişim grubu gövdede yoktur, oturumdan çözülür. Görünmüyor/yok -> NOT_FOUND -> 404.
    GET/PUT aynı path'te method ile ayrışır. Başarılı yanıtta kayan pencere için
    cookie yenilenir.
    """
    sonuc = anket_controller.guncelle_anket(
        oturum,
        anket_id,
        istek.ad,
        istek.on_yazi,
        istek.son_yazi,
        istek.aciklama,
        istek.durum,
        istek.anket_tipi,
        istek.erisim_seviyesi,
        istek.baslangic_secim,
        istek.baslangic_tarih,
        istek.bitis_secim,
        istek.bitis_tarih,
        istek.soru_idler,
        istek.grup_idler,
        istek.kullanici_kodlari,
    )
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.get("/api/anketler/{anket_id}/doldur")
def get_anket_doldur(
    anket_id: int, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki kullanıcı için anketi cevaplama görünümüyle döndürür (yalnızca protokol).

    anket_id path segment'inden alınır (int); jeton `oturum` cookie'sinden okunur.
    Admin-only DEĞİL: sahiplik/yetki ("bu anket bana atanmış mı") ve metin sanitizasyonu
    Controller/Service'te; atanmamış/yok -> 404 (varlık sızmaz). `/doldur` alt segmenti
    admin detay `GET /api/anketler/{anket_id}` ile ÇAKIŞMAZ. Başarılı yanıtta kayan
    pencere için cookie aynı bayraklarla yenilenir.
    """
    sonuc = anket_doldur_controller.get_anket_doldur(oturum, anket_id)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.post("/api/anketler/{anket_id}/cevaplar")
def gonder_anket_cevaplari(
    anket_id: int,
    istek: AnketCevapIstegi,
    oturum: str | None = Cookie(default=None),
) -> JSONResponse:
    """Oturumdaki kullanıcının anket cevaplarını gönderir/tamamlar (yalnızca protokol).

    anket_id path segment'inden alınır (int); gövde AnketCevapIstegi. Cevap kalemleri
    dict listesine çevrilip Controller'a iletilir; sahiplik/aidiyet/kardinalite/zorunluluk
    ve aktiflik/tarih iş kuralları Controller/Service'te. Atanmamış/yok -> 404, geçersiz
    girdi -> 400, iş kuralı (zaten tamamlandı / pencere dışı / pasif) -> 409. Başarılı
    yanıtta kayan pencere için cookie yenilenir.
    """
    cevaplar = [kalem.model_dump() for kalem in istek.cevaplar]
    sonuc = anket_doldur_controller.gonder_anket(oturum, anket_id, cevaplar)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.get("/api/gruplar")
def list_gruplar(oturum: str | None = Cookie(default=None)) -> JSONResponse:
    """Oturumdaki admin için tüm kullanıcı gruplarını üye sayısıyla döndürür (yalnızca protokol).

    Jeton `oturum` cookie'sinden okunur; Controller oturumu doğrular ve yetkiyi
    (yalnızca admin) uygular. Başarılı yanıtta kayan pencere için cookie yenilenir.
    """
    sonuc = grup_controller.list_gruplar(oturum)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.post("/api/gruplar")
def ekle_grup(
    istek: GrupEkleIstegi, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki admin için yeni bir kullanıcı grubu oluşturur (yalnızca protokol).

    Gövde GrupEkleIstegi { ad }. Oturum/yetki/doğrulama (boş/uzunluk/tekrar)
    Controller/Service'te. Ad zaten varsa VALIDATION_ERROR -> 400. Aynı path'teki
    GET (liste) uçundan method ile ayrışır. Başarılıysa cookie yenilenir.
    """
    sonuc = grup_controller.create_grup(oturum, istek.ad)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.delete("/api/gruplar/{grup_id}")
def sil_grup(
    grup_id: int, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki admin için bir kullanıcı grubunu siler (yalnızca protokol).

    grup_id path segment'inden alınır (int). Oturum/yetki/doğrulama Controller/Service'te.
    Silme idempotenttir; üyeler FK ON DELETE SET NULL ile grupsuz kalır. Başarılı
    yanıtta kayan pencere için cookie yenilenir.
    """
    sonuc = grup_controller.delete_grup(oturum, grup_id)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.get("/api/gruplar/{grup_id}/uyeler")
def list_grup_uyeleri(
    grup_id: int, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumdaki admin için bir grubun üyelerini döndürür (yalnızca protokol).

    grup_id path segment'inden alınır (int). Oturum/yetki/doğrulama Controller/Service'te.
    Grup yoksa ya da üyesi yoksa boş liste döner. `/uyeler` segmenti sabit
    `DELETE /api/gruplar/{grup_id}` ile çakışmaz. Başarılıysa cookie yenilenir.
    """
    sonuc = grup_controller.list_grup_uyeleri(oturum, grup_id)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.post("/api/gruplar/{grup_id}/uyeler")
def ekle_grup_uyesi(
    grup_id: int,
    istek: GrupUyeEkleIstegi,
    oturum: str | None = Cookie(default=None),
) -> JSONResponse:
    """Oturumdaki admin için bir kullanıcıyı gruba atar (yalnızca protokol).

    grup_id path segment'inden (int), gövde GrupUyeEkleIstegi { kullanici_kodu }.
    Oturum/yetki/doğrulama Controller/Service'te. Tek grup kuralı: kullanıcı zaten
    başka gruptaysa yeni gruba TAŞINIR. Aynı path'teki GET (üye listesi) uçundan
    method ile ayrışır. Başarılıysa cookie yenilenir.
    """
    sonuc = grup_controller.assign_uye(oturum, grup_id, istek.kullanici_kodu)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.delete("/api/gruplar/{grup_id}/uyeler/{kullanici_kodu}")
def sil_grup_uyesi(
    grup_id: int,
    kullanici_kodu: str,
    oturum: str | None = Cookie(default=None),
) -> JSONResponse:
    """Oturumdaki admin için bir kullanıcıyı gruptan çıkarır (yalnızca protokol).

    grup_id ve kullanici_kodu path segment'lerinden alınır. Tek grup kuralı gereği
    üyelik NULL'lanır; grup_id URL semantiği içindir, Service'e taşınmaz. Oturum/yetki/
    doğrulama Controller/Service'te. Başarılıysa cookie yenilenir.
    """
    sonuc = grup_controller.remove_uye(oturum, kullanici_kodu)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.post("/api/auth/sifre-belirle")
def sifre_belirle(
    istek: SifreBelirleIstegi, oturum: str | None = Cookie(default=None)
) -> JSONResponse:
    """Oturumlu kullanıcının kalıcı şifresini belirler (yalnızca protokol adaptasyonu).

    yeni_sifre Controller'a iletilir; kural/yazma Controller/Service'te. Kişi hâlâ
    oturumlu olduğundan başarılı yanıtta cookie yenilenir. yeni_sifre gövdede DÖNMEZ.
    """
    sonuc = auth_controller.sifre_belirle(oturum, istek.yeni_sifre)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    if sonuc.get("basari") and oturum:
        _oturum_cookiesini_yaz(yanit, oturum)
    return yanit


@app.post("/api/auth/logout")
def logout(oturum: str | None = Cookie(default=None)) -> JSONResponse:
    """Mevcut oturumu sonlandırır ve oturum cookie'sini siler.

    Jeton `oturum` cookie'sinden okunur; Controller ilgili oturumu siler. Ardından
    cookie aynı path ile temizlenir. İşlem güvenli bir başarı sözlüğüyle 200 döner.
    """
    sonuc = auth_controller.logout(oturum)
    durum = 200 if sonuc.get("basari") else _kod_to_http_durum(sonuc.get("kod", ""))
    yanit = JSONResponse(status_code=durum, content=sonuc)
    yanit.delete_cookie(key=_OTURUM_COOKIE_ADI, path=_COOKIE_PATH)
    return yanit

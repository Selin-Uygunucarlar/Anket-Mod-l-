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

from fastapi import Cookie, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from common.constants import OTURUM_SURESI_DAKIKA
from controllers import auth_controller, kullanici_controller

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
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["content-type"],
)


class GirisIstegi(BaseModel):
    """Login istek gövdesi. Ek kısıt yok; boş-alan doğrulaması Controller'a aittir.

    `kimlik` sicil kodu VEYA e-posta olabilir (Controller.login imzasıyla birebir).
    """

    kimlik: str
    sifre: str


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

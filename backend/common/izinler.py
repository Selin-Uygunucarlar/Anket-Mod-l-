"""Uygulamanın izin anahtarlarının TEK kaynağı.

Neden: Yetki isteyen her eylem, gerektirdiği izni bir sabitle söyler; "admin"
gibi sabit dizeler Service dosyalarına dağılmaz. Anahtarın DEĞERİ tek yerde
durur, kullanımı ise yetki_service.dogrula_izin çağrısındadır.

İzin birimi UÇ DEĞİL SAYFA'dır: host (Savronik PostgreSQL) yetkiyi personele
sayfa olarak verir (webpage -> roleright -> roleright_endpoint_mapping). Bu
yüzden katalog uç sayısı kadar değil, sayfa sayısı kadar büyür. Buradaki
anahtarın host'taki gerçek webpage.name ile eşlenmesi Faz B'de yetki_service
içinde TEK YERDE yapılacaktır; bu dosya o eşlemeyi bilmez.

"Anketlerim" (anket doldurma/cevaplama) için BİLEREK sabit tanımlanmamıştır:
o uçlarda yetki rol/izin değil SAHİPLİK kontrolüdür (atama bana mı ait — IDOR
koruması) ve dogrula_izin çağrılmaz. Çağrılmayan bir sabit ölü koddur.
"""

# Anket/soru YÖNETİMİ sayfası: anket oluşturma-güncelleme-durum değiştirme,
# soru CRUD + Excel toplu yükleme ve anket sonuçlarını görme bu izne bağlıdır.
ANKET_YONETIMI = "anket_yonetimi"

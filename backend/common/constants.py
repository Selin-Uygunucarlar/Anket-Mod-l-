"""Uygulama geneli sabitler.

Neden: Sihirli sayıların (magic number) koda gömülmesini önler; iş kuralı
eşiği tek yerden yönetilir. Belirli bir Service'e ait hesaplama buraya KONMAZ;
burada yalnızca katmandan bağımsız, paylaşılan sabitler bulunur.
"""

# Ardışık başarısız girişte hesabın kilitleneceği eşik (kaba kuvvet koruması).
# Sayaç bu değere ULAŞTIĞINDA (>=) hesap kilitli sayılır ve şifre kontrol edilmez.
MAKS_HATALI_GIRIS = 5

# Kilit oluştuktan sonra hesabın otomatik açılacağı süre (dakika). Kaba kuvvet
# korumasının süresini belirler; MAKS_HATALI_GIRIS ile aynı aile. DB kilit
# bitişini saklamaz; Service, son hatalı giriş anına bu pencereyi ekleyerek yorumlar.
KILIT_SURESI_DAKIKA = 5

# Sunucu tarafı oturumun kayan (sliding) pencere uzunluğu (dakika). Her geçerli
# doğrulamada oturumun geçerlilik bitişi "şu an + bu süre" olarak yenilenir.
OTURUM_SURESI_DAKIKA = 480

# Kullanıcının kendi kalıcı şifresini belirlerken uyması gereken en az uzunluk.
# Zayıf şifreyi Service reddeder; geçici (sistem üretimi) şifreler için değil,
# kullanıcı tarafından belirlenen kalıcı şifreler için alt sınırdır.
MIN_SIFRE_UZUNLUK = 8

# Toplu soru yüklemede kabul edilen en büyük Excel (.xlsx) dosya boyutu (bayt).
# Kaynak tüketimini sınırlar: dosya AÇILMADAN önce sınırda reddedilir.
MAKS_EXCEL_DOSYA_BAYTI = 2 * 1024 * 1024

# Tek bir Excel yüklemesinde işlenebilecek en fazla soru (veri) satırı. Aşılırsa
# dosya doğrulanmadan reddedilir; tek seferde çok büyük yazma denemesi önlenir.
MAKS_EXCEL_SORU_SATIRI = 500

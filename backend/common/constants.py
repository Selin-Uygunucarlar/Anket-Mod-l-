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

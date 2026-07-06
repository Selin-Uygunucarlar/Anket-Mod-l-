"""Şifre karma (hash) yardımcıları — katmandan bağımsız güvenlik aracı.

Neden: Şifre hash'leme birden fazla Service'te (yeni kullanıcı için geçici şifre
ve kullanıcının kalıcı şifre belirlemesi) aynı biçimde gereklidir. Algoritma
seçimi (bcrypt) TEK yerde tutulur ki her çağrı aynı güvenli üretimi kullansın ve
seçim değişirse tek noktadan güncellensin.

Güvenlik: Yalnızca hash üretilir; düz şifre ve üretilen hash burada loglanmaz,
döndürülen hash dışında hiçbir yere yazılmaz. Çağıran katman düz şifre/hash'i
log/yanıt/bağlama koymamaktan sorumludur.
"""

import bcrypt


def hash_sifre(duz_sifre: str) -> str:
    """Düz şifreyi bcrypt ile hash'leyip saklanabilir string olarak döndürür.

    Her çağrıda yeni bir tuz (salt) üretilir; sonuç DB'ye yazılabilir metindir.
    Düz şifre bu fonksiyondan sonra bellekten atılmalı, asla loglanmamalıdır.
    """
    hash_baytlari = bcrypt.hashpw(duz_sifre.encode("utf-8"), bcrypt.gensalt())
    return hash_baytlari.decode("utf-8")

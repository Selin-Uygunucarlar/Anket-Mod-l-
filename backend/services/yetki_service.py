"""İzin (sayfa hakkı) kararının TEK noktası.

Neden: Yetki kararı daha önce her serviste ayrı ayrı "kullanici_turu == 'admin'"
karşılaştırmasıyla veriliyordu (13 nokta). Karar tek gövdeye alındı; böylece
kontrolün KAYNAĞI değiştiğinde (Faz B: host'un roleright zinciri) yalnızca bu
dosya değişir, çağıran servisler değişmez.

Bu katman HTTP ve SQL bilmez. Hata burada LOGLANMAZ, yukarı fırlatılır; loglama
yalnızca sınır katmanında bir kez yapılır.
"""

from common.errors import YetkiYokError
from models.oturum import OturumSahibi

# Yönetim yetkisini bugün taşıyan kullanıcı türü. GEÇİCİDİR: Faz B'de yerini
# host'un sayfa hakkı sorgusu alacak (bkz. dogrula_izin).
_ADMIN_TURU = "admin"


def dogrula_izin(talep_eden: OturumSahibi, izin: str) -> None:
    """Talep edenin verilen izne (sayfa hakkına) sahip olduğunu doğrular.

    Hakkı yoksa YetkiYokError fırlatır (mevcut hata tipi; kod/severity hatanın
    kendi tanımından gelir, burada değiştirilmez). Yetki client'tan gelen role/id'ye
    değil, doğrulanmış oturum sahibine göre belirlenir.

    GÖVDE GEÇİCİDİR: bugün karar tek bir kullanici_turu karşılaştırmasıdır. Faz B'de
    bunun yerine host'un yetki zincirinden (rolerightmapping -> roleright ->
    roleright_endpoint_mapping) sayfa hakkı okunacaktır; DEĞİŞECEK TEK YER burasıdır.

    `izin` bugün gövdede kullanılmıyor ama imzada DURUR: ölü parametre değildir,
    Faz B'de sayfa ayrımını (hangi sayfanın hakkı sorgulanacak) o taşıyacaktır.
    Bugün tek katalog anahtarı olduğu için ayrım henüz gerekmez.
    """
    if talep_eden.kullanici_turu != _ADMIN_TURU:
        raise YetkiYokError()

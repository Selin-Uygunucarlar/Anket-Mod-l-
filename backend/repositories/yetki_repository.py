"""Host'un yetki zincirinden SAYFA HAKKI okuyan veri erişim katmanı (PostgreSQL).

Neden: Anket modülü Savronik'in çalışan sistemine eklenirken kendi rol/izin
modelini kurmaz; "bu personel şu sayfayı görebilir mi" sorusunu host'un
webpage -> roleright -> rolerightmapping zincirinden okur (bkz.
docs/postgresql_gecis_notlari.txt 1.3 ve 4.6). DB ile konuşan tek yer burasıdır;
Service/Controller SQL veya tablo adı görmez. Ham SQL metinleri
yetki_sorgulari.py'dedir.

Bağlantı: common/db_pg.py (PostgreSQL host replikası, CRUD-only hesap). MariaDB
bağlantısı (common/db.py) BURADA KULLANILMAZ.

SORGU SAPMASI (bilinçli, 2026-07-29): Plandaki (B3) ilk taslak kullanıcının
endpoint ÖNEKLERİNİ döndürüp eşleştirmeyi Service'e bırakıyordu. Bunun yerine
doğrudan SAYFA ADIYLA sorulur çünkü (a) 4.6 gereği baktığımız tek şey sayfa
görünürlüğüdür, (b) host'un '**' kalıp semantiği hâlâ cevapsızdır (S14) ve LIKE
ile doğru karşılanmaz, (c) host'un yetkilendirme ekranı da yetkiyi SAYFA olarak
verir. roleright_endpoint_mapping bu sorguda kullanılmaz; o tablo host'un kendi
yol kontrolü için doldurulur.

Hata yönetimi: Teknik DB istisnası DataAccessError'a sarmalanıp YUKARI FIRLATILIR;
burada loglanmaz ve False'a çevrilerek YUTULMAZ ("hak yok" ile "sorgu çalışmadı"
karışmamalıdır). Ham DB mesajı/tablo adı üst mesaja konmaz.
"""

import psycopg

from common.db_pg import postgres_baglantisi
from common.errors import DataAccessError
from repositories import yetki_sorgulari as sorgular


def sayfa_hakki_var_mi(staff_id: int, sayfa_adi: str) -> bool:
    """Personelin (staff_id) verilen sayfa üzerinde hakkı olup olmadığını döner.

    Hak, kişinin hesabının rolüne bağlı roleright kayıtlarından okunur; sonuç
    yoksa False'tur. Sayfa adı ve staff_id SQL metnine GÖMÜLMEZ, parametre (%s)
    olarak geçirilir. Yetki KARARI (hangi eylem hangi sayfayı ister) Service'in
    işidir; burada yalnızca veri okunur.
    """
    try:
        with postgres_baglantisi() as baglanti:
            with baglanti.cursor() as imlec:
                imlec.execute(sorgular.SAYFA_HAKKI_SORGUSU, (staff_id, sayfa_adi))
                satir = imlec.fetchone()
    except psycopg.Error as hata:
        # Ham DB mesajı/tablo adı sızdırılmaz; orijinali `from` ile zincirlenir.
        raise DataAccessError("Sayfa hakkı okunamadı.") from hata

    return satir is not None

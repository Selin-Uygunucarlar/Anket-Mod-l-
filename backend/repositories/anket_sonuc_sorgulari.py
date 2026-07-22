"""Anket sonuçları (atanan/yanıtlayan listesi + tek kişinin cevapları) SQL metinleri.

Neden ayrı dosya: anket_sorgulari.py 500 satır sınırına yaklaştığından (anket
oluşturma/liste/detay/güncelleme + cevaplama SQL'leri orada), sonuç OKUMA sorguları
buraya alındı (SRP + dosya boyutu). Kural KOPYALANMAZ: görünürlük koşulu, atama
"tamamlandı" değeri ve cevaplanabilir soru sorgusu anket_sorgulari.py'den yeniden
kullanılır (DRY) -- kural değişirse tek yer değişir.

Güvenlik: Tüm sorgular parametrelidir (%s); string birleştirme YASAK. Sorgu metninde
birleştirilen tek şey SABİT parçalardır (paylaşılan GORUNURLUK_KOSULU). Kullanıcı
değerleri (anket_id, sicil, grup_id) ASLA metne gömülmez; hepsi execute'a parametre
olarak geçer. Hassas alan (sifre_hash vb.) hiçbir sorguda SELECT EDİLMEZ.
"""

# ANKET_DOLDUR_SORULARI_SORGUSU buradan YENİDEN DIŞA VERİLİR (noqa: F401): sonuç
# okuması, cevaplama ekranıyla BİREBİR aynı soru kümesini (grid hariç) göstermek
# zorundadır -- sorgu kopyalanmaz, tek kaynaktan kullanılır (DRY). Böylece sonuç
# Repository'si tek bir SQL modülüne bakar.
from repositories.anket_sorgulari import (  # noqa: F401
    ANKET_DOLDUR_SORULARI_SORGUSU,
    GORUNURLUK_KOSULU,
)

# Anketin talep edene GÖRÜNÜP görünmediğini sınayan kapı sorgusu. Sonuç satırı
# önemsizdir (SELECT 1): yalnızca "görünür mü" bilgisi gerekir. Kural
# ANKET_DETAY_SORGUSU ile BİREBİR aynı kaynaktan (GORUNURLUK_KOSULU) gelir; satır
# dönmezse anket yoktur VEYA bu kişiye görünmez -- ayrımı yapmamak bilinçlidir
# (varlık sızmaz, IDOR'a kapalı). "Bulunamadı" yorumu Service'e aittir.
# Parametre sırası: anket_id, sonra GORUNURLUK_KOSULU'nun %s sırası ->
#   (anket_id, gorunur_grup_id, gorunur_kullanici_kodu)
ANKET_GORUNUR_MU_SORGUSU = f"""
    SELECT 1
    FROM Anket a
    WHERE a.anket_id = %s
      AND ({GORUNURLUK_KOSULU})
    LIMIT 1
"""

# Ankete atanmış kişiler + her kişinin atama durumu (liste ekranındaki "atanan/
# yanıtlayan" hücresinin arkasındaki kişi listesi). INNER JOIN: AnketAtama.
# kullanici_kodu FK'dir, kullanıcı hep vardır.
# TEKİLLİK: (anket_id, kullanici_kodu) DB'de bir kısıtla zorlanmadığından aynı kişi
# kuramsal olarak birden çok atama satırı taşıyabilir (ANKET_ATANAN_KULLANICILAR_
# SORGUSU'ndaki gerekçe). Orada DISTINCT yetiyordu; BURADA durum/tamamlanma_tarihi de
# seçildiğinden farklı durumlu iki satır DISTINCT'i geçer ve kişi listede iki kez
# çıkardı. Bu yüzden kişi başına EN SON atama (MAX(atama_id)) seçilir: auto-increment
# olduğundan en büyük id en güncel atamadır ve kişinin YÜRÜRLÜKTEKİ durumunu taşır.
# Seçim deterministiktir (aynı veride hep aynı satır döner).
# Hassas alan SELECT EDİLMEZ. Sıra: ad, soyad. Parametre: anket_id (tek %s;
# korelasyonlu alt sorgu dış satırın anket_id'sini kullanır, ikinci parametre almaz).
ANKET_ATAMALARI_SORGUSU = """
    SELECT k.kullanici_kodu,
           k.ad,
           k.soyad,
           k.email,
           atama.durum,
           atama.tamamlanma_tarihi
    FROM AnketAtama atama
    JOIN Kullanici k ON k.kullanici_kodu = atama.kullanici_kodu
    WHERE atama.anket_id = %s
      AND atama.atama_id = (
            SELECT MAX(en_son.atama_id)
            FROM AnketAtama en_son
            WHERE en_son.anket_id = atama.anket_id
              AND en_son.kullanici_kodu = atama.kullanici_kodu
      )
    ORDER BY k.ad, k.soyad
"""

# Bir kişinin bu anketteki atama kimliği (cevapları Cevap.atama_id ile bağlıdır).
# Satır DÖNMEZSE kişi bu ankete atanmamıştır; "bulunamadı" yorumu Service'e aittir
# (Repository NotFound fırlatmaz). Yinelenen atama olasılığına karşı EN SON atama
# seçilir (ORDER BY atama_id DESC LIMIT 1) -- ANKET_ATAMALARI_SORGUSU'ndaki MAX
# seçimiyle AYNI satırı verir, böylece listede görünen durum ile açılan cevaplar
# aynı atamaya aittir. durum da döner: Service "tamamlamamış kişinin cevabı" gibi
# kararları buna göre verir. Parametre sırası: anket_id, kullanici_kodu.
ATAMA_ID_GETIR_SORGUSU = """
    SELECT atama_id,
           durum
    FROM AnketAtama
    WHERE anket_id = %s
      AND kullanici_kodu = %s
    ORDER BY atama_id DESC
    LIMIT 1
"""

# Bir atamanın TÜM cevap satırları, seçilen şıkkın metniyle birlikte.
# LEFT JOIN Secenek: Cevap.secilen_secenek_id FK'si ON DELETE SET NULL'dur; şık
# sonradan silinirse alan NULL kalır. INNER JOIN olsaydı bu cevap satırı listeden
# TÜMÜYLE KAYBOLURDU (açık uçlu cevaplarda da secilen_secenek_id zaten NULL'dur).
# LEFT JOIN ile satır korunur, secenek_metni None döner -- "şık silinmiş" durumunu
# gösterme kararı Service/UI'ye kalır. secenek_metni/cevap_metni HAM döner
# (sanitizasyon Service'in işi). Sıra deterministik: soru_id, sonra cevap_id
# (çoklu seçimde aynı soruya ait satırlar yazılış sırasında kalır).
# Parametre: atama_id.
KULLANICI_CEVAPLARI_SORGUSU = """
    SELECT c.soru_id,
           s.secenek_metni,
           c.cevap_metni
    FROM Cevap c
    LEFT JOIN Secenek s ON s.secenek_id = c.secilen_secenek_id
    WHERE c.atama_id = %s
    ORDER BY c.soru_id, c.cevap_id
"""

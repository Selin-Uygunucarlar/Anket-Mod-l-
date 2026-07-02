# Proje Mimarisi ve Geliştirme Kuralları

Bu proje **katmanlı mimari (layered architecture)** ile geliştirilecek.
Temel kural: bağımlılık her zaman aşağı doğru akar. Üst katman alt katmanı
çağırabilir, ancak alt katman üst katmanı asla tanımaz veya import etmez.

## Katmanlar

### 1. Sunum / UI Katmanı (frontend)
- Kullanıcıya veriyi uygun formatta gösterir.
- Kullanıcıdan veriyi uygun formatta alır.
- İş kuralı veya hesaplama İÇERMEZ.
- Yalnızca gösterim ve girdi toplama işleriyle ilgilenir.

### 2. Controller / API Katmanı
- Gelen istekleri karşılar ve gitmesi gereken iş katmanı metoduna yönlendirir.
- Girdi doğrulaması (validation), yetki kontrolü ve request/response dönüşümü yapar.
- İş mantığı İÇERMEZ. İnce (thin) tutulmalıdır.
- SQL veya veritabanı detayı bilmez.

### 3. İş Katmanı (Business / Service)
- Uygulamanın kalbi. Tüm iş kuralları, hesaplamalar ve kararlar burada.
- HTTP bilmez, SQL bilmez. Yalnızca saf iş mantığı içerir.
- Veriye ihtiyaç duyduğunda Veri Erişim katmanını çağırır.

### 4. Veri Erişim Katmanı (Data Access / Repository)
- Veritabanıyla konuşan TEK katman.
- Sorguları burada yazar, sonucu nesne olarak döner.
- İş katmanı hiçbir zaman doğrudan SQL görmez.

### 5. Veritabanı
- Veriyi saklar.

## Ortak Kütüphane (Common / Shared / Utils)
- Tüm katmanların kullanabildiği, katmana bağımlı OLMAYAN yardımcı kod.
- Örnek: tarih/string formatlama, genel doğrulama yardımcıları, sabitler,
  ortak hata sınıfları, logger yapılandırması.
- KURAL: Belirli bir iş kuralına ait hesaplama buraya KONULMAZ, ilgili
  Service içinde kalır. Burası "her şeyin çöplüğü" olmamalı.

## Hata Yönetimi ve Loglama

### Felsefe: "İç katmanlarda fırlat (raise), sınırda logla (log at the boundary)"
- Hiçbir hata SESSİZCE YUTULMAZ. Boş `catch {}` blokları, hatayı yakalayıp
  hiçbir şey yapmadan geçmek, hatayı `null`/varsayılan değere çevirip
  görmezden gelmek YASAKTIR.
- İç katmanlar (Repository, Service) hatayı YAKALAYIP LOGLAMAZ. Hatayı
  yukarı fırlatır (raise/throw). Gerekirse bağlam ekleyerek sarmalar
  (wrap), ama loglamaz.
- Loglama YALNIZCA sınır katmanında (boundary) yapılır: global error
  handler / middleware. Bir hata tam olarak BİR KEZ loglanır.
- Bu sayede aynı hata her katmanda tekrar tekrar loglanmaz ve log
  gürültüsü oluşmaz.

### Error Pipeline (Tek Hata Boru Hattı)
- Tüm hatalar tek bir merkezi hata işleyiciden geçer (error pipeline).
- Bir hatanın önem derecesi (severity) ve etiketleri (tag/kod) TEK BİR
  YERDE, hata OLUŞTURULDUĞU anda belirlenir. Hata katmanlar arasında
  yukarı çıkarken bu parametreler DEĞİŞTİRİLMEZ.
- Böylece aynı hatanın farklı katmanlarda farklı önem/uyarı
  parametreleriyle etiketlenmesinin önüne geçilir. Bir hatanın tek bir
  kimliği ve tek bir severity'si vardır.
- Hata sarmalanırken (wrap) bağlam eklenebilir, ancak orijinal hata ve
  onun severity'si korunur; ezilmez.

### Uygulama Kuralları
- Ortak bir hata sınıfı hiyerarşisi tanımlanır (Common katmanında).
  Her hata tipi kendi severity ve kodunu taşır (örn. ValidationError,
  NotFoundError, BusinessRuleError, DataAccessError).
- Repository ve Service, teknik hataları anlamlı domain hatalarına
  sarmalayabilir, ancak bunları LOGLAMAZ, yukarı fırlatır.
- Controller/boundary katmanı hatayı yakalar, BİR KEZ loglar ve
  kullanıcıya uygun formatta (severity'ye göre) yanıt döner.
- Loglar yapılandırılmış (structured) olur: zaman, severity, hata kodu,
  bağlam (istek id, kullanıcı vb.), stack trace. Serbest metin log yerine
  tek merkezi logger kullanılır.
- Kullanıcıya teknik detay/stack trace SIZDIRILMAZ; sadece güvenli mesaj
  döner. Tam detay yalnızca loga yazılır.

## İstek Akışı Örneği
1. Kullanıcı UI'da bir işlem tetikler.
2. Controller isteği alır, doğrular, ilgili Service metodunu çağırır.
3. Service hesaplamayı yapar, gerekiyorsa Repository'den veri ister.
4. Repository veritabanından veriyi çeker ve döner.
5. Sonuç aynı yoldan geri döner, UI uygun formatta gösterir.

## Hata Akışı Örneği
1. Repository'de DB hatası oluşur -> teknik hata DataAccessError'a
   sarmalanır ve YUKARI FIRLATILIR (loglanmaz).
2. Service hatayı görür; kendi bağlamını ekleyebilir ama yakalayıp
   yutmaz, yine yukarı fırlatır.
3. Controller/boundary hatayı yakalar -> error pipeline devreye girer ->
   hata BİR KEZ, tanımlı severity'siyle loglanır.
4. Kullanıcıya severity'ye uygun, güvenli bir yanıt döner.

## Güvenlik (Yetki, Sırlar, Hassas Veri)

### Yetkilendirme kod katmanında yapılır
- Rol/izin/sahiplik kontrolleri Controller/Service katmanında uygulanır;
  DB hesabı yetkisiyle KARIŞTIRILMAZ.
- İzin-tabanlı model (grup + hak) kullanılır; bu bir proje geneli mimari
  karardır.
- Client'tan gelen ID veya role ASLA doğrudan güvenilmez. Her istekte
  kaynağın sahipliği doğrulanır (IDOR koruması genel ilke olarak).

### Sırlar koda/repoya gömülmez
- Connection string, DB şifresi, API anahtarı vb. sabit string olarak koda
  YAZILMAZ; ortam değişkeni ya da secret manager'dan okunur.
- Bu tüm proje için geçerli bir güvenlik kuralıdır, yalnızca DB için değil.

### Hassas veri korunur
- Şifre/hash asla düz metin tutulmaz; log'a, hata mesajına veya kullanıcı
  yanıtına YAZILMAZ.
- Bu genel kuraldır; hangi hash algoritmasının (bcrypt/Argon2) kullanılacağı
  ilgili auth modülüne ait bir uygulama detayıdır.

## Modülerlik / Genişletilebilirlik
- Bileşenler bağımsız/modüler ve gevşek bağlı (loose coupling) yazılır.
- Yeni bir modül eklemek mevcut kodu BOZMADAN mümkün olmalıdır; sistem
  büyüdükçe genişletilebilir kalmalıdır.
- Bu SRP/DRY ile aynı aileden, proje geneline ait bir kuraldır. Ancak
  "over-engineering YASAK" kuralına uyulur: gevşek bağlılık uğruna bugün
  olmayan bir ihtiyaç için soyutlama/factory/generic eklenmez.

## Klasör Yapısı
```
/frontend            -> UI katmanı
/backend
  /controllers       -> yönlendirme + validation
  /services          -> iş katmanı, hesaplamalar
  /repositories      -> veri erişimi
  /models            -> veri nesneleri / DTO'lar
  /common            -> ortak yardımcı fonksiyonlar, hata sınıfları, logger
  /middleware        -> global error handler (boundary / error pipeline)
/database            -> şema, migration'lar
```

## Uyulması Gereken Kurallar
- Her katman yalnızca kendi sorumluluğunu üstlensin.
- Katmanlar arası bağımlılık yalnızca aşağı doğru olsun.
- İş mantığı SADECE Service katmanında bulunsun.
- Veritabanı erişimi SADECE Repository katmanından yapılsın.
- Tekrarlayan yardımcı fonksiyonlar Common katmanında toplansın.
- Hiçbir hata sessizce yutulmasın; iç katmanlar fırlatsın, sınırda loglansın.
- Her hata tek bir yerde etiketlensin ve tek bir kez loglansın.
- **Anlamlı isimlendirme:** Fonksiyon ve değişken isimleri, yaptığı işi
  açıkça belli eden kısa ve net ifadeler olsun. Kısaltma, tek harf veya
  belirsiz isim (data, temp, x, handle) kullanılmasın. Fonksiyon isimleri
  fiille başlasın (ör. calculateTotal, fetchUser, validateInput).
- **Fonksiyon yorumları:** Her fonksiyonun başında, o fonksiyonun ne
  yaptığını anlatan kısa bir yorum bulunsun. Yorum "nasıl"ı değil "ne/neden"i
  anlatsın; kodu tekrar etmesin.
- **Dosya başı yorumu:** Her dosyanın en üstünde, o dosyanın neden var
  olduğunu ve ne iş yaptığını (sorumluluğunu) anlatan kısa bir açıklama
  bulunsun.
- **Yorumlar kısa ve güncel olsun:** Uzun, gereksiz veya kodu birebir
  tekrarlayan yorum yazılmasın. Kod değişince yorum da güncellensin;
  yanıltıcı/eski yorum bırakılmasın.
- **Dosya boyutu:** Tek bir kod dosyası 400 satırı geçmesin. Bu sınıra
  yaklaşan dosyalar, sorumluluklarına göre daha küçük ve anlamlı dosyalara
  bölünsün. (Satır sınırını aşmamak uğruna kod yapay olarak sıkıştırılmasın
  veya okunabilirlik feda edilmesin; sınır, dosyanın çok fazla iş yaptığının
  işaretidir.)
- **SRP (Tek Sorumluluk):** Her sınıf/fonksiyon/modül yalnızca tek bir işi
  yapsın ve değişmek için tek bir nedeni olsun. Bir fonksiyon hem hesaplama
  hem loglama hem formatlama yapıyorsa böl.
- **DRY (Tekrar Etme):** Aynı mantık iki yerde tekrarlanıyorsa ortak bir
  yere çıkar. Ancak yalnızca gerçekten aynı olan mantık birleştirilsin;
  tesadüfen benzeyen ama farklı amaçlara hizmet eden kod zorla
  birleştirilmesin (yanlış DRY, gereksiz bağımlılık yaratır).
- **Katmanlı mimari ihlali YASAK:** Katman atlanmasın (ör. Controller'ın
  doğrudan Repository'yi çağırması), bağımlılık yukarı doğru akmasın,
  iş mantığı Service dışına sızmasın.
- **Yetki kod katmanında:** Rol/izin/sahiplik kontrolü Controller/Service'te
  yapılsın; client'tan gelen id/role'e güvenilmesin, her istekte sahiplik
  doğrulansın (IDOR koruması).
- **Sırlar koda gömülmesin:** Şifre, connection string, API anahtarı env/secret
  manager'dan okunsun; parolalar hash'lensin ve log/hata/yanıta sızmasın.
- **Modüler ve genişletilebilir:** Bileşenler gevşek bağlı yazılsın; yeni modül
  mevcut kodu bozmadan eklenebilsin (over-engineering yasağını ihlal etmeden).
- **Over-engineering YASAK:** Bugün olmayan bir ihtiyaç için soyutlama
  eklenmesin. Tek bir yerde kullanılan şey için interface/factory/generic
  katman kurulmasın. Basit çözüm yeterliyse basit çözüm tercih edilsin.
  Kural: soyutlama ancak somut ve mevcut bir tekrar/ihtiyaç varsa eklenir.
- **Doğruluk esastır:** Amaç, doğru davranışı sergileyen kodu yazmaktır.
  Bir işi tamamlamış görünmek veya testi geçirmek uğruna amaç ya da kod
  eğilip bükülmesin; belirti gizlenmesin, kısayol/hack ile gerçek problem
  örtülmesin. Doğru çözüm zorsa, zorlaştığı yer eğip bükerek değil açıkça
  belirtilerek ele alınsın.
- Plan sunulmadan kod yazılmasın.

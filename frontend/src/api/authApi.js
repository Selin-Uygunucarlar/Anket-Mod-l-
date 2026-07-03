// Kimlik doğrulama (auth) API erişim noktası — sunum katmanının backend'e
// bakan TEK yeri. UI bileşenleri doğrudan istek atmaz; buradaki fonksiyonu
// çağırır. Backend HTTP endpoint'i hazır olduğunda gerçek istek YALNIZCA
// burada bağlanır (imza kontrat dosyasındaki Controller.login ile birebir).

// login: kullanıcının kimlik (sicil kodu / e-posta) ve parolasını backend'e
// iletir; başarılı yanıtı çağırana döndürür. Şu an endpoint yok, bu yüzden
// bilinçli olarak hata fırlatır (UI'nin hata durumu akışı test edilebilsin).
export async function login(kimlik, sifre) {
  // TODO: API bağlanınca gerçek istek buraya (ör. POST /auth/login;
  // gövde: { kimlik, sifre }; yanıt: { basari, kullanici } | { basari, kod, mesaj }).
  // Şimdilik parametreler kullanılmadan tek noktada beklemede tutulur.
  void kimlik
  void sifre
  throw new Error('API henüz bağlanmadı')
}

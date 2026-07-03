// Anasayfa. Şimdilik yalnızca "Anasayfa" başlığını gösteren boş bir sayfadır;
// asıl içerik/tasarım sonraki adımlarda eklenecektir. Korumalı bir rotadır
// (yalnızca oturumu olan kullanıcı görebilir).

// AnaSayfaPage: yer tutucu anasayfa gösterimi.
function AnaSayfaPage() {
  return (
    <div className="anasayfa">
      <h1>Anasayfa</h1>
    </div>
  )
}

export default AnaSayfaPage

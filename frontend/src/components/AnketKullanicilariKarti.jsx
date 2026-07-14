// Anket formunun "Kullanıcılar" kartı: ankete kimlerin atanacağını belirleyen
// seçenekleri ve seçilmiş kullanıcı/grupları gösterir. "Sabit liste" ve "Kullanıcı
// Grupları" checkbox'tır; İKİSİ DE aynı anda işaretlenebilir (bağımsız). Zorunlu
// değildir. Salt gösterimdir: API çağırmaz, iş kuralı/hesap İÇERMEZ; seçme ekranını
// açma ve kaldırma işlerini üst bileşene (props) bırakır. Bu seçimler SUNUCUYA
// GÖNDERİLMEZ; yalnızca form state'inde tutulur, ileride atama akışına bağlanacaktır.
// "Excel ile ekle" bağlantısı TAMAMEN GÖRSELDİR; tıklama hiçbir şey yapmaz (bu
// fazın kapsamı dışında). Görünüm sınıfları anket-ekle.css'ten paylaşılır (DRY).

import AnketKart from './AnketKart'
import { buyukHarfeCevir } from '../common/metinBicimlendir.js'
import {
  KULLANICI_ATAMA_SECENEKLERI,
  SABIT_LISTE_ATAMASI,
  KULLANICI_GRUPLARI_ATAMASI,
} from '../common/anketFormAlanlari.js'
import '../styles/anket-ekle.css'

// atamaEtiketi: verilen atama seçeneğinin ekranda görünen metnini döndürür
// (etiketler tek yerde, KULLANICI_ATAMA_SECENEKLERI içinde tanımlıdır).
function atamaEtiketi(deger) {
  return KULLANICI_ATAMA_SECENEKLERI.find(
    (secenek) => secenek.deger === deger,
  ).etiket
}

// AtamaSatiri: bir atama seçeneğinin satırı — solda checkbox + etiket, sağda
// aksiyon bağlantıları. Aksiyonlar bilinçli olarak <label> DIŞINDADIR: label'ın
// içinde olsalardı tıklamaları checkbox'ı da işaretler/kaldırırdı.
// props: etiket -> görünen metin; isaretli -> checkbox durumu; onDegis() ->
//   işaret değişince çağrılır; children -> satırın sağındaki aksiyon bağlantıları.
function AtamaSatiri({ etiket, isaretli, onDegis, children }) {
  return (
    <div className="anket-atama-satir">
      <label className="anket-radyo-secenek">
        <input
          type="checkbox"
          name="kullanici-atama"
          checked={isaretli}
          onChange={onDegis}
        />
        <span>{etiket}</span>
      </label>
      <div className="anket-atama-aksiyonlar">{children}</div>
    </div>
  )
}

// SeciliAtamaListesi: seçilmiş kullanıcı/grup satırlarını alt alta listeler; her
// satırda "Kaldır" bağlantısı bulunur (seçili soru listesiyle aynı üslup).
// props: satirlar -> [{ kimlik, baslik, altBilgi }]; onKaldir(kimlik) -> "Kaldır"
//   tıklanınca çağrılır.
function SeciliAtamaListesi({ satirlar, onKaldir }) {
  return (
    <ul className="anket-secili-atama-listesi">
      {satirlar.map((satir) => (
        <li key={satir.kimlik} className="anket-secili-soru">
          <div className="anket-secili-soru-govde">
            <span>{satir.baslik}</span>
            <span className="anket-secili-soru-tip">{satir.altBilgi}</span>
          </div>
          <button
            type="button"
            className="baglanti-buton"
            onClick={() => onKaldir(satir.kimlik)}
          >
            Kaldır
          </button>
        </li>
      ))}
    </ul>
  )
}

// AnketKullanicilariKarti: atama seçenekleri ile seçili kullanıcı/grup listelerini
// render eder.
// props: seciliAtamalar -> işaretli seçenek degerleri dizisi;
//   onSecimDegistir(deger) -> bir seçeneğin işareti değişince çağrılır;
//   secilenKullanicilar -> [{ kullanici_kodu, ad, soyad, email }];
//   secilenGruplar -> [{ grup_id, ad, uye_sayisi }];
//   onKullaniciSecmeyiAc() / onGrupSecmeyiAc() -> ilgili "Listeden seç" tıklanınca
//   çağrılır (üst bileşen seçme ekranını yeni sekmede açar);
//   onKullaniciKaldir(kullaniciKodu) / onGrupKaldir(grupId) -> "Kaldır" tıklanınca.
function AnketKullanicilariKarti({
  seciliAtamalar,
  onSecimDegistir,
  secilenKullanicilar,
  secilenGruplar,
  onKullaniciSecmeyiAc,
  onGrupSecmeyiAc,
  onKullaniciKaldir,
  onGrupKaldir,
}) {
  // Listelerin gösterim biçimi: ad soyad başlıkta, sicil/üye sayısı alt bilgide.
  const kullaniciSatirlari = secilenKullanicilar.map((kullanici) => ({
    kimlik: kullanici.kullanici_kodu,
    baslik: `${buyukHarfeCevir(kullanici.ad)} ${buyukHarfeCevir(
      kullanici.soyad,
    )}`,
    altBilgi: `${kullanici.kullanici_kodu} - ${kullanici.email}`,
  }))
  const grupSatirlari = secilenGruplar.map((grup) => ({
    kimlik: grup.grup_id,
    baslik: grup.ad,
    altBilgi: `${grup.uye_sayisi} üye`,
  }))

  return (
    <AnketKart baslik="Kullanıcılar">
      <div className="anket-atama-bolum">
        <AtamaSatiri
          etiket={atamaEtiketi(SABIT_LISTE_ATAMASI)}
          isaretli={seciliAtamalar.includes(SABIT_LISTE_ATAMASI)}
          onDegis={() => onSecimDegistir(SABIT_LISTE_ATAMASI)}
        >
          {/* "Excel ile ekle": bağlantı görünümlü, tamamen görsel; tıklama hiçbir
              şey yapmaz (bu fazın kapsamı dışında). */}
          <button type="button" className="baglanti-buton">
            Excel ile ekle
          </button>
          <button
            type="button"
            className="baglanti-buton"
            onClick={onKullaniciSecmeyiAc}
          >
            Listeden seç
          </button>
        </AtamaSatiri>

        {/* Seçim yoksa liste hiç render edilmez (boş kutu göstermeyiz). */}
        {kullaniciSatirlari.length > 0 && (
          <SeciliAtamaListesi
            satirlar={kullaniciSatirlari}
            onKaldir={onKullaniciKaldir}
          />
        )}

        <AtamaSatiri
          etiket={atamaEtiketi(KULLANICI_GRUPLARI_ATAMASI)}
          isaretli={seciliAtamalar.includes(KULLANICI_GRUPLARI_ATAMASI)}
          onDegis={() => onSecimDegistir(KULLANICI_GRUPLARI_ATAMASI)}
        >
          <button
            type="button"
            className="baglanti-buton"
            onClick={onGrupSecmeyiAc}
          >
            Listeden seç
          </button>
        </AtamaSatiri>

        {grupSatirlari.length > 0 && (
          <SeciliAtamaListesi satirlar={grupSatirlari} onKaldir={onGrupKaldir} />
        )}
      </div>
    </AnketKart>
  )
}

export default AnketKullanicilariKarti

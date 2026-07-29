// Anket listesi tablosunun sütun tanımları. AnketListesi.jsx'ten AYRI durur çünkü
// sütun tanımları (başlık, hücre gösterimi, satır butonları) tek başına bir sunum
// sorumluluğudur ve liste bileşenini gereksiz büyütür (dosya boyutu / SRP).
// Yalnızca GÖSTERİM yapar: veri çekmez, state tutmaz, iş kuralı veya hesaplama
// İÇERMEZ. Satırda tetiklenen her eylem (düzenleme, durum değiştirme, kişi listesi
// açma) dışarıdan geçirilen geri çağırımlara devredilir; kararı üst bileşen ve
// nihayetinde sunucu verir.

import { Button, Space, Tag } from 'antd'
import {
  adSoyadBirlestir,
  tarihSaatBicimlendir,
} from '../common/metinBicimlendir.js'

// Sunucunun "yayında" anlamına gelen durum metni; yalnızca etiket rengini seçmek
// için karşılaştırılır (salt gösterim).
const AKTIF_DURUM = 'Aktif'

// SayiHucresi: atanan/yanıtlayan sayısını gösterir. Sayı 0'dan büyükken ilgili
// kişi listesini açan gerçek bir buton (klavyeyle erişilebilir), 0 iken düz
// metindir (açılacak liste yoktur). Gösterme/gizleme salt UX'tir; yetki sunucuda.
// props: sayi -> gösterilecek adet; ariaEtiketi -> butonun okunur açıklaması;
// onAc() -> butona basılınca ilgili kutuyu açar.
function SayiHucresi({ sayi, ariaEtiketi, onAc }) {
  const deger = sayi ?? 0
  if (deger <= 0) {
    return <span>{deger}</span>
  }
  return (
    <Button type="link" size="small" onClick={onAc} aria-label={ariaEtiketi}>
      {deger}
    </Button>
  )
}

// anketSutunlariniKur: anket tablosunun sütun tanımlarını üretir. Satır eylemleri
// dışarıdan alınır; böylece sütunlar üst bileşenin state'ini bilmez.
// props (tek nesne): onAnketDuzenle(anket) -> "Güncelle"; onDurumDegistir(anket) ->
// durum butonu (önce onay sorar); durumButonEtiketi(anket) -> o satırdaki durum
// butonunun metni (salt gösterim eşlemesi); onAtananlariAc(anket) /
// onYanitlayanlariAc(anket) -> sayı hücrelerinin açtığı kişi listeleri.
export function anketSutunlariniKur({
  onAnketDuzenle,
  onDurumDegistir,
  durumButonEtiketi,
  onAtananlariAc,
  onYanitlayanlariAc,
}) {
  return [
    {
      title: 'Anket Adı',
      dataIndex: 'ad',
      key: 'ad',
    },
    {
      title: 'Durum',
      dataIndex: 'durum',
      key: 'durum',
      // Durum metni sunucudan gelir; burada yalnızca renkli etikete dönüşür.
      render: (durum) => (
        <Tag color={durum === AKTIF_DURUM ? 'success' : 'default'}>{durum}</Tag>
      ),
    },
    {
      title: 'Oluşturan',
      key: 'olusturan',
      // Ad ve soyad ortak biçimlendiriciyle tek okunur metinde birleşir.
      render: (_, anket) =>
        adSoyadBirlestir(anket.olusturan_ad, anket.olusturan_soyad),
    },
    {
      title: 'Oluşturma Tarihi',
      dataIndex: 'olusturma_tarihi',
      key: 'olusturma_tarihi',
      render: (tarih) => tarihSaatBicimlendir(tarih),
    },
    {
      title: 'Atanan Kullanıcı Sayısı',
      dataIndex: 'atanan_sayisi',
      key: 'atanan_sayisi',
      render: (sayi, anket) => (
        <SayiHucresi
          sayi={sayi}
          ariaEtiketi={`${anket.ad} anketine atanan kullanıcıları göster`}
          onAc={() => onAtananlariAc(anket)}
        />
      ),
    },
    {
      title: 'Yanıtlayan Kullanıcı Sayısı',
      dataIndex: 'yanitlayan_sayisi',
      key: 'yanitlayan_sayisi',
      render: (sayi, anket) => (
        <SayiHucresi
          sayi={sayi}
          ariaEtiketi={`${anket.ad} anketini yanıtlayan kullanıcıları göster`}
          onAc={() => onYanitlayanlariAc(anket)}
        />
      ),
    },
    {
      title: 'İşlem',
      key: 'islem',
      render: (_, anket) => (
        <Space size="small">
          {/* Güncelle: üst bileşene haber vererek bu anket için güncelleme
              görünümünü açar (form alanları backend'den çekilir). */}
          <Button size="small" onClick={() => onAnketDuzenle(anket)}>
            Güncelle
          </Button>
          {/* Durum değiştirme: doğrudan istek atmaz, önce onay kutusu açar.
              Etiket satırın durumuna bakan salt gösterimdir; hedef durumu ve
              yetkiyi sunucu belirler. */}
          <Button size="small" onClick={() => onDurumDegistir(anket)}>
            {durumButonEtiketi(anket)}
          </Button>
        </Space>
      ),
    },
  ]
}

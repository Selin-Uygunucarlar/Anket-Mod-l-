// Anket listesindeki "Atanan Kullanıcı Sayısı" / "Yanıtlayan Kullanıcı Sayısı"
// hücresine tıklanınca açılan kişi listesi kutusu (modal). Yalnızca sunum
// sorumluluğundadır: anketApi üzerinden atama listesini ister ve tabloda gösterir;
// iş kuralı, yetki kararı veya hesaplama İÇERMEZ (yetki sunucuda uygulanır).
// "Yanıtladı mı" bilgisi SUNUCUDA türetilir (yanitladi_mi); UI yalnızca bu bayrakla
// süzer, durum metnine bakıp kendi kararını VERMEZ.
// Aynı anket için iki mod (atanan / yanıtlayan) TEK React Query anahtarını
// paylaşır; hücreler arasında geçişte liste cache'ten gelir.
// Görünüm Ant Design bileşenleriyle kurulur (Modal + Table); tema ConfigProvider
// token'larından gelir, bu kutuya ait özel CSS dosyası YOKTUR.
// Escape / perdeye tıklama / "Kapat" ile kapanır; üstünde cevap kutusu açıkken
// (ustKutuAcik) Escape ve perde bu kutuyu KAPATMAZ — kapatma en üsttekine aittir.

import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Modal, Table } from 'antd'
import { anketAtamalariniGetir } from '../api/anketApi.js'
import { adSoyadBirlestir, tarihSaatBicimlendir } from '../common/metinBicimlendir.js'

// Kutunun genişliği: ad soyad + e-posta + durum/tarih sütunları rahat sığsın.
const KUTU_GENISLIGI = 900

// Moda göre değişen sunum metinleri ve son bilgi kolonu. Kutunun iki kullanımı
// (tüm atananlar / yalnızca yanıtlayanlar) arasındaki tek fark budur.
const MOD_AYARLARI = {
  atanan: {
    baslik: 'Atanan Kullanıcılar',
    sonKolonBasligi: 'Durum',
    bosMesaj: 'Bu ankete kimse atanmamış.',
  },
  yanitlayan: {
    baslik: 'Yanıtlayan Kullanıcılar',
    sonKolonBasligi: 'Tamamlanma Tarihi',
    bosMesaj: 'Bu anketi henüz kimse yanıtlamamış.',
  },
}

// atamaSutunlariniKur: kişi listesi tablosunun sütunlarını moda göre üretir.
// Yanıtlayan modunda son kolon tamamlanma tarihi olur ve satır sonuna "Cevapları
// Gör" butonu eklenir; atanan modunda ham atama durumu gösterilir.
function atamaSutunlariniKur({ yanitlayanModu, sonKolonBasligi, onCevaplariGor }) {
  const sutunlar = [
    {
      title: 'Ad Soyad',
      key: 'ad_soyad',
      render: (_, atama) => adSoyadBirlestir(atama.ad, atama.soyad),
    },
    {
      title: 'E-posta',
      dataIndex: 'email',
      key: 'email',
      render: (email) => email || '-',
    },
    {
      title: sonKolonBasligi,
      key: 'son_bilgi',
      render: (_, atama) =>
        yanitlayanModu
          ? tarihSaatBicimlendir(atama.tamamlanma_tarihi)
          : atama.durum,
    },
  ]

  if (yanitlayanModu) {
    sutunlar.push({
      title: 'İşlem',
      key: 'islem',
      // Cevapları Gör: üst bileşene haber vererek bu kişinin cevap kutusunu açar.
      render: (_, atama) => {
        const adSoyad = adSoyadBirlestir(atama.ad, atama.soyad)
        return (
          <Button
            size="small"
            onClick={() =>
              onCevaplariGor({
                kullanici_kodu: atama.kullanici_kodu,
                ad: atama.ad,
                soyad: atama.soyad,
              })
            }
            aria-label={`${adSoyad} kişisinin cevaplarını gör`}
          >
            Cevapları Gör
          </Button>
        )
      },
    })
  }

  return sutunlar
}

// AnketAtamaKutusu: ankete atanmış kişileri (moda göre süzülmüş) modal içinde
// listeler.
// props: anket -> liste satırı ({ anket_id, ad }); mod -> 'atanan' | 'yanitlayan';
// ustKutuAcik -> üstünde cevap kutusu açık mı (açıkken Escape/perde bu kutuyu
// kapatmaz, kapatma en üsttekine aittir); onKapat() -> kutuyu kaldırır;
// onCevaplariGor(kullanici) -> yanıtlayan satırındaki butona basılınca çağrılır.
function AnketAtamaKutusu({
  anket,
  mod,
  ustKutuAcik = false,
  onKapat,
  onCevaplariGor,
}) {
  const ayar = MOD_AYARLARI[mod]
  const yanitlayanModu = mod === 'yanitlayan'

  // İki mod AYNI anahtarı paylaşır: hücreler arasında geçişte veri cache'ten gelir.
  const {
    data: atamalar,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['anket-atamalari', anket.anket_id],
    queryFn: () => anketAtamalariniGetir(anket.anket_id),
  })

  // Yanıtlayan modunda liste sunucudan gelen yanitladi_mi bayrağıyla süzülür;
  // "yanıtladı mı" kararı UI'da ÜRETİLMEZ.
  const tumAtamalar = atamalar ?? []
  const satirlar = yanitlayanModu
    ? tumAtamalar.filter((atama) => atama.yanitladi_mi === true)
    : tumAtamalar

  const sutunlar = atamaSutunlariniKur({
    yanitlayanModu,
    sonKolonBasligi: ayar.sonKolonBasligi,
    onCevaplariGor,
  })

  return (
    <Modal
      open
      title={`${ayar.baslik} — ${anket.ad}`}
      width={KUTU_GENISLIGI}
      onCancel={onKapat}
      // Üstte cevap kutusu varken Escape ve perde bu kutuyu kapatmaz; kapatma
      // en üstteki kutuya aittir (salt UX kuralı).
      keyboard={!ustKutuAcik}
      mask={{ closable: !ustKutuAcik }}
      footer={<Button onClick={onKapat}>Kapat</Button>}
    >
      {/* error.message backend'in güvenli mesajıdır; teknik detay sızmaz. */}
      {isError ? (
        <Alert type="error" showIcon title={error.message} role="alert" />
      ) : (
        <Table
          rowKey="kullanici_kodu"
          columns={sutunlar}
          dataSource={satirlar}
          loading={isPending}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content', y: 420 }}
          locale={{ emptyText: ayar.bosMesaj }}
        />
      )}
    </Modal>
  )
}

export default AnketAtamaKutusu

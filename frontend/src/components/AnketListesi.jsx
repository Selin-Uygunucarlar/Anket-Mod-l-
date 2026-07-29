// Anket listesi bileşeni. Admin panelinden "Anket Listesi" seçilince anasayfa
// içerik alanında render edilir. Yalnızca sunum sorumluluğundadır: veriyi anketApi
// üzerinden ister ve tabloda gösterir; iş kuralı, yetki kontrolü veya hesaplama
// İÇERMEZ (yetki sunucuda uygulanır). Yükleniyor, hata ve boş durumlarının üçü de
// ayrı ayrı ele alınır; kullanıcıya yalnızca güvenli mesaj gösterilir.
// Görünüm Ant Design bileşenleriyle kurulur (Table / Button / Tag / Input / Alert);
// renk ve köşe değerleri ConfigProvider tema token'larından gelir, bu ekrana ait
// özel CSS dosyası YOKTUR. Bu nedenle ekran artık kullanıcı/soru listeleriyle
// birebir aynı görünmez; bu, antd'ye taşımanın bilinçli ve kabul edilmiş sonucudur.
// "Anket Ekle" butonu üst bileşene (onAnketEkle) haber vererek içerik alanında anket
// oluşturma formunu açar. Filtre kartı (AnketFiltre) GERÇEK filtrelemeye bağlıdır:
// seçilen anket tipi/durum/oluşturulma tarih aralığı bu bileşende state'te tutulur
// ve uygulanacakFiltre ile sunucuya taşınır; seçim değişince liste React Query
// üzerinden anında yeniden çekilir (süzme SUNUCUDA, iş kuralı/tarih hesabı UI'a
// KONMAZ). Arama kutusu (aramaMetni) bu işin kapsamı DIŞINDADIR: tasarım bütünlüğü
// için durur, gerçek arama YAPMAZ. "İşlem" sütunundaki "Güncelle" butonu, üst
// bileşene (onAnketDuzenle) haber vererek içerik alanında anket güncelleme
// görünümünü açar (satır özetini taşır; form detayı backend'den kendisi çeker).
// Yanındaki "Pasife Al" / "Aktife Al" butonu ise önce onay kutusu açar (antd
// App.useApp().modal.confirm — tema ve Türkçe metinleri görsün diye statik çağrı
// KULLANILMAZ), onaylanınca anketin durumunu sunucuya tersine çevirtir ve listeyi
// tazeler; buton etiketi satırdaki duruma bakan SALT GÖSTERİMDİR, hedef durumu ve
// yetkiyi SUNUCU belirler.
// "Atanan Kullanıcı Sayısı" ve "Yanıtlayan Kullanıcı Sayısı" hücreleri sayı 0'dan
// büyükken tıklanabilir birer butondur: ilki ankete atanmış herkesi, ikincisi
// yalnızca yanıtlayanları AnketAtamaKutusu'nda gösterir; oradaki "Cevapları Gör"
// ile kişinin cevapları AnketKullaniciCevaplariKutusu'nda AÇILAN kutunun ÜSTÜNDE
// açılır. Hangi kutunun kimin için açık olduğu burada saf UI state'te tutulur;
// veri çekme ve gösterim ilgili kutu bileşenlerine aittir (SRP).

import { useState } from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import { Alert, App, Button, Flex, Input, Table, Typography } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { anketleriGetir, anketDurumuDegistir } from '../api/anketApi.js'
import {
  BOS_ANKET_FILTRESI,
  uygulanacakFiltre,
} from '../common/anketFiltreAlanlari.js'
import { anketSutunlariniKur } from './AnketListesiSutunlari.jsx'
import AnketFiltre from './AnketFiltre'
import AnketAtamaKutusu from './AnketAtamaKutusu'
import AnketKullaniciCevaplariKutusu from './AnketKullaniciCevaplariKutusu'

const { Title } = Typography

// Arama kutusunun genişliği (kapsam dışı, dekoratif alan; bkz. dosya başı yorumu).
const ARAMA_KUTUSU_GENISLIGI = 420

// Sunucunun "yayında" anlamına gelen durum metni. Yalnızca onay/buton metnini
// seçmek için karşılaştırılır; hangi durumun yazılacağına SUNUCU karar verir.
const AKTIF_DURUM = 'Aktif'

// durumButonEtiketi: satırın mevcut durumuna göre işlem butonunun etiketini döner
// ("Aktif" ise "Pasife Al", değilse "Aktife Al"). Salt gösterim eşlemesidir.
function durumButonEtiketi(anket) {
  return anket.durum === AKTIF_DURUM ? 'Pasife Al' : 'Aktife Al'
}

// durumOnayMesaji: onay kutusunda gösterilecek, anket adını içeren net soruyu
// kurar. Yalnızca metin üretir; işlemin sonucunu sunucu belirler.
function durumOnayMesaji(anket) {
  return anket.durum === AKTIF_DURUM
    ? `"${anket.ad}" anketini pasife almak istediğinize emin misiniz?`
    : `"${anket.ad}" anketini aktife almak istediğinize emin misiniz?`
}

// AnketListesi: anketleri React Query ile çeker ve durumuna göre yükleniyor /
// hata / boş / tablo gösterir. Veri kaynağı yalnızca anketApi'dir.
// props: onAnketEkle() -> "Anket Ekle" butonuna tıklanınca çağrılır (üst bileşen
// anket ekleme görünümünü açar); onAnketDuzenle(anket) -> bir satırın "Güncelle"
// butonu tıklanınca çağrılır (üst bileşen o anket için güncelleme görünümünü açar).
function AnketListesi({ onAnketEkle, onAnketDuzenle }) {
  const [aramaMetni, setAramaMetni] = useState('')
  const [filtre, setFiltre] = useState(BOS_ANKET_FILTRESI)
  // Açık kişi listesi kutusu: null = kapalı; { anket, mod } = ilgili anketin
  // atananları ('atanan') ya da yanıtlayanları ('yanitlayan').
  const [atamaKutusu, setAtamaKutusu] = useState(null)
  // Açık cevap kutusu: null = kapalı; { anket, kullanici } = o kişinin cevapları.
  // Kişi listesi kutusu açık kalır; cevap kutusu kapanınca listeye geri dönülür.
  const [cevapKutusu, setCevapKutusu] = useState(null)
  // Durum değiştirme başarısız olursa gösterilecek güvenli, kısa mesaj.
  const [islemHatasi, setIslemHatasi] = useState('')

  const queryClient = useQueryClient()
  // Onay kutusu ConfigProvider'ın teması ve Türkçe metinleriyle çıksın diye
  // statik Modal.confirm yerine App bağlamından alınır.
  const { modal } = App.useApp()

  // onFiltreDegis: filtre kartındaki tek bir alanın değerini günceller (kontrollü).
  // Değişiklik queryKey'i değiştireceğinden liste anında yeniden çekilir.
  function onFiltreDegis(kimlik, deger) {
    setFiltre((oncekiler) => ({ ...oncekiler, [kimlik]: deger }))
  }

  // Sunucuya gönderilecek nihai filtre; hem cache anahtarı hem istek argümanı olur.
  const uygulanan = uygulanacakFiltre(filtre)

  const {
    data: anketler,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['anketler', uygulanan],
    queryFn: () => anketleriGetir(uygulanan),
    // Filtre değişince önceki listeyi ekranda tut: isPending yalnızca ilk yüklemede
    // true olur, sonraki filtrelemelerde tablonun boşalıp dolması ve filtre kartının
    // unmount olması engellenir (arka planda sessizce yeniden çekilir).
    placeholderData: keepPreviousData,
  })

  // Durum değiştirme isteği: gövdesizdir, yeni durumu SUNUCU belirler. Başarıda
  // liste (filtreli tüm varyantlarıyla) tazelenir; hatada backend'in güvenli mesajı
  // ekrana yansıtılır (hata sessizce yutulmaz, teknik detay sızmaz). Yetki sunucuda
  // uygulanır.
  // Ana ekranın atanmış anket paneli (AtanmisAnketPaneli) React Query CACHE'i
  // KULLANMAZ; her mount olduğunda kendisi yeniden çeker. Bu yüzden burada onun
  // için geçersiz kılınacak bir anahtar yoktur (ana ekrana dönünce zaten güncel).
  const durumMutation = useMutation({
    mutationFn: anketDurumuDegistir,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anketler'] })
    },
    onError: (hata) => {
      setIslemHatasi(hata.message)
    },
  })

  // durumDegistirmeyiSor: satırın durum butonu tıklanınca varsa önceki hatayı
  // temizler ve onay kutusunu açar (istek henüz ATILMAZ). Onaylanırsa isteği
  // bekletir; böylece istek sürerken onay butonu kilitli/yüklenir görünür.
  function durumDegistirmeyiSor(anket) {
    setIslemHatasi('')
    modal.confirm({
      title: 'Anket durumunu değiştir',
      content: durumOnayMesaji(anket),
      okText: durumButonEtiketi(anket),
      cancelText: 'Vazgeç',
      onOk: () =>
        durumMutation.mutateAsync(anket.anket_id).catch(() => {
          // Hata mutation'ın onError'ında yakalanıp ekrandaki uyarı alanına
          // yazılır; buradaki yakalamanın TEK amacı onay kutusunun kapanmasıdır
          // (hata yutulmaz, kullanıcıya güvenli mesajla gösterilir).
        }),
    })
  }

  // Tablo sütunları ayrı dosyadadır (dosya boyutu/SRP); satır eylemleri buradan
  // geçirilir, sütunlar yalnızca gösterim yapar.
  const sutunlar = anketSutunlariniKur({
    onAnketDuzenle,
    onDurumDegistir: durumDegistirmeyiSor,
    durumButonEtiketi,
    onAtananlariAc: (anket) => setAtamaKutusu({ anket, mod: 'atanan' }),
    onYanitlayanlariAc: (anket) => setAtamaKutusu({ anket, mod: 'yanitlayan' }),
  })

  const anketListesi = anketler ?? []

  return (
    <Flex vertical gap={16}>
      <Flex align="center" justify="space-between" gap={12} wrap="wrap">
        <Flex align="center" gap={12} wrap="wrap">
          <Title level={2} style={{ margin: 0, fontSize: 20 }}>
            Anket Listesi
          </Title>
          {/* Arama kutusu: tasarım bütünlüğü için durur, gerçek arama YAPMAZ. */}
          <Input
            style={{ width: ARAMA_KUTUSU_GENISLIGI }}
            prefix={<SearchOutlined />}
            value={aramaMetni}
            onChange={(olay) => setAramaMetni(olay.target.value)}
            placeholder="Ara: anket"
            aria-label="Anket listesinde ara"
          />
        </Flex>
        {/* "Anket Ekle": üst bileşene haber vererek içerik alanında anket
            oluşturma formunu açar. */}
        <Button type="primary" icon={<PlusOutlined />} onClick={onAnketEkle}>
          Anket Ekle
        </Button>
      </Flex>

      {/* Durum değiştirme başarısız olursa tek hata alanı: backend'in güvenli
          mesajı gösterilir; teknik detay sızmaz. */}
      {islemHatasi && (
        <Alert type="error" showIcon title={islemHatasi} role="alert" />
      )}

      {/* Başlıksız filtre kartı: arama satırının hemen altında, tablonun üstünde.
          Kontrollü bileşen: seçimi filtre propundan okur, değişikliği onFiltreDegis
          ile bildirir; süzme sunucuda yapılır (queryKey değişince yeniden çekilir). */}
      <AnketFiltre filtre={filtre} onFiltreDegis={onFiltreDegis} />

      {/* Liste çekilemezse tablo yerine güvenli hata mesajı gösterilir
          (error.message backend'in güvenli metnidir; teknik detay sızmaz).
          Filtre kartı ekranda kalır ki kullanıcı seçimini geri alabilsin. */}
      {isError ? (
        <Alert type="error" showIcon title={error.message} role="alert" />
      ) : (
        <Table
          rowKey="anket_id"
          columns={sutunlar}
          dataSource={anketListesi}
          // Yalnızca İLK yüklemede döner; filtre değişiminde önceki liste
          // ekranda kalır (keepPreviousData).
          loading={isPending}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Kayıtlı anket bulunamadı.' }}
        />
      )}

      {/* Kişi listesi kutusu: hangi anket ve hangi mod için açıldığı state'te
          tutulur. Cevap kutusu açıkken bu kutu açık KALIR (kullanıcı listeyi
          kaybetmesin) ama kapatma en üstteki kutuya aittir. */}
      {atamaKutusu && (
        <AnketAtamaKutusu
          anket={atamaKutusu.anket}
          mod={atamaKutusu.mod}
          ustKutuAcik={cevapKutusu !== null}
          onKapat={() => setAtamaKutusu(null)}
          onCevaplariGor={(kullanici) =>
            setCevapKutusu({ anket: atamaKutusu.anket, kullanici })
          }
        />
      )}

      {/* Cevap kutusu listenin ÜSTÜNDE açılır; kapanınca kişi listesine dönülür. */}
      {cevapKutusu && (
        <AnketKullaniciCevaplariKutusu
          anket={cevapKutusu.anket}
          kullanici={cevapKutusu.kullanici}
          onKapat={() => setCevapKutusu(null)}
        />
      )}
    </Flex>
  )
}

export default AnketListesi

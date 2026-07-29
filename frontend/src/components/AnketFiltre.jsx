// Anket listesi filtre kartı. Anket listesinde arama satırı ile tablo arasında
// render edilir. KONTROLLÜ bir bileşendir: kendi state'ini tutmaz; seçilen filtre
// değerlerini `filtre` propundan okur, her değişikliği `onFiltreDegis(kimlik, deger)`
// ile üst bileşene (AnketListesi) bildirir. Gerçek filtreleme SUNUCUDA yapılır;
// tarih aralığı hesabı UI'a KONMAZ. Yalnızca sunum sorumluluğundadır: filtre
// alanlarını gösterir ve seçim toplar. Anket Tipi ve Durum seçenekleri
// anketFormAlanlari.js'ten yeniden kullanılır (DRY); tarih aralığı seçenekleri
// anketFiltreAlanlari.js'ten gelir. BAŞLIKSIZ bir karttır. Yerleşim iki kolonludur:
// solda sabit genişlikli etiket sütunu, sağda kontrol sütunu; böylece tüm satırların
// kontrolleri aynı x'ten hizalanır.
// Görünüm Ant Design bileşenleriyle kurulur (Card / Select / Radio / DatePicker);
// tema ConfigProvider token'larından gelir, bu ekrana ait ayrı CSS dosyası YOKTUR.
// DatePicker dayjs nesnesiyle çalışır; ortak anketFiltreAlanlari.js sözleşmesi ise
// 'YYYY-MM-DD' METİN bekler — dönüşüm bu dosyada yapılır, sözleşme DEĞİŞMEZ.

import { Card, DatePicker, Flex, Radio, Select, Typography } from 'antd'
import dayjs from 'dayjs'
import {
  ANKET_TIPI_SECENEKLERI,
  DURUM_SECENEKLERI,
} from '../common/anketFormAlanlari.js'
import { TARIH_ARALIGI_SECENEKLERI } from '../common/anketFiltreAlanlari.js'

const { Text } = Typography

// Sol etiket sütununun sabit genişliği: en uzun etiket ("Oluşturulma Tarih
// Aralığı") sığsın ve tüm satırların kontrolleri aynı hizadan başlasın.
const ETIKET_GENISLIGI = 200

// Dropdown genişliği: "Tümü" ve en uzun seçenek rahat okunacak kadar.
const KUTU_GENISLIGI = 260

// Filtre state'inde ve sunucuya giden istekte kullanılan tarih metni biçimi.
const TARIH_BICIMI = 'YYYY-MM-DD'

// secenekListesiKur: düz metin seçenek dizisini antd Select'in beklediği
// { value, label } listesine çevirir ve başına "Tümü" (boş değer) placeholder'ını
// koyar. Boş değer, filtrenin uygulanmadığı anlamına gelir.
function secenekListesiKur(secenekler) {
  return [
    { value: '', label: 'Tümü' },
    ...secenekler.map((secenek) => ({ value: secenek, label: secenek })),
  ]
}

// metinTarihi: filtre state'indeki 'YYYY-MM-DD' metnini DatePicker'ın beklediği
// dayjs nesnesine çevirir; alan boşsa seçim yok demektir (null).
function metinTarihi(deger) {
  return deger ? dayjs(deger) : null
}

// tarihMetni: DatePicker'ın verdiği dayjs nesnesini ortak filtre sözleşmesinin
// beklediği 'YYYY-MM-DD' metnine çevirir; seçim temizlenirse boş metin döner.
function tarihMetni(secilenTarih) {
  return secilenTarih ? secilenTarih.format(TARIH_BICIMI) : ''
}

// FiltreSatiri: solda sabit genişlikli etiket, sağda kontrol düzenini kurar.
// props: etiket -> sol sütunda görünen metin; hizalama -> etiketin dikey hizası
// (radyo grubu sarabildiği için o satırda üstten hizalanır); children -> kontrol.
function FiltreSatiri({ etiket, hizalama = 'center', children }) {
  return (
    <Flex align={hizalama} gap={12}>
      <Text strong style={{ flex: `0 0 ${ETIKET_GENISLIGI}px` }}>
        {etiket}
      </Text>
      {children}
    </Flex>
  )
}

// AnketFiltre: anket listesi için başlıksız filtre kartını gösterir ve seçim toplar.
// Saf sunumdur; iş kuralı/veri çekimi/hesap içermez.
// props: filtre (BOS_ANKET_FILTRESI şeklinde mevcut seçimler), onFiltreDegis(kimlik,
// deger) -> bir alan değişince üst bileşene haber verir (kontrollü bileşen).
function AnketFiltre({ filtre, onFiltreDegis }) {
  return (
    <Card size="small" aria-label="Anket listesi filtreleri">
      <Flex vertical gap={16}>
        {/* Boş değer ("Tümü") filtrenin uygulanmadığı anlamına gelir; süzme SUNUCUDA. */}
        <FiltreSatiri etiket="Anket Tipi">
          <Select
            style={{ width: KUTU_GENISLIGI }}
            value={filtre.anket_tipi}
            onChange={(deger) => onFiltreDegis('anket_tipi', deger)}
            options={secenekListesiKur(ANKET_TIPI_SECENEKLERI)}
            aria-label="Anket tipine göre filtrele"
          />
        </FiltreSatiri>

        <FiltreSatiri etiket="Durum">
          <Select
            style={{ width: KUTU_GENISLIGI }}
            value={filtre.durum}
            onChange={(deger) => onFiltreDegis('durum', deger)}
            options={secenekListesiKur(DURUM_SECENEKLERI)}
            aria-label="Duruma göre filtrele"
          />
        </FiltreSatiri>

        {/* Oluşturulma tarih aralığı: radyolar sarabildiği için etiket üstten
            hizalanır. Aralığın gerçek tarih karşılığı SUNUCUDA hesaplanır. */}
        <FiltreSatiri etiket="Oluşturulma Tarih Aralığı" hizalama="flex-start">
          <Radio.Group
            value={filtre.tarih_araligi}
            onChange={(olay) => onFiltreDegis('tarih_araligi', olay.target.value)}
          >
            {TARIH_ARALIGI_SECENEKLERI.map((secenek) => (
              <Radio key={secenek.deger} value={secenek.deger}>
                {secenek.etiket}
              </Radio>
            ))}
          </Radio.Group>
        </FiltreSatiri>

        {/* Yalnızca "Tarih Seç" işaretliyken iki takvim girdisi KOŞULLU görünür.
            Sol etiket hücresi boş kalır ki kutular kontrol sütunuyla hizalansın.
            Aralık hesabı SUNUCUDA; iki tarih de dolmadan istek atılmaz (bkz.
            uygulanacakFiltre). */}
        {filtre.tarih_araligi === 'tarih_sec' && (
          <FiltreSatiri etiket="">
            <Flex align="center" gap={16} wrap="wrap">
              <Flex align="center" gap={8}>
                <Text>Başlangıç</Text>
                <DatePicker
                  value={metinTarihi(filtre.baslangic_tarih)}
                  onChange={(secilenTarih) =>
                    onFiltreDegis('baslangic_tarih', tarihMetni(secilenTarih))
                  }
                  aria-label="Başlangıç tarihi"
                />
              </Flex>
              <Flex align="center" gap={8}>
                <Text>Bitiş</Text>
                <DatePicker
                  value={metinTarihi(filtre.bitis_tarih)}
                  onChange={(secilenTarih) =>
                    onFiltreDegis('bitis_tarih', tarihMetni(secilenTarih))
                  }
                  aria-label="Bitiş tarihi"
                />
              </Flex>
            </Flex>
          </FiltreSatiri>
        )}
      </Flex>
    </Card>
  )
}

export default AnketFiltre

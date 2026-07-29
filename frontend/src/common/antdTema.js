// Ant Design bileşenlerinin projedeki görünüm ayarı (ConfigProvider tema token'ları).
// Neden var: antd v6 CSS-in-JS kullanır ve ".ant-*" seçicileri özel CSS ile EZİLMEZ;
// renk/köşe/yazı tipi ayarı yalnızca token üzerinden yapılır. Buradaki değerler
// styles/login.css içindeki :root değişkenlerinin KOPYASIDIR: antd ile geri kalan
// ekranlar aynı paleti kullansın diye. İki yer bilerek ayrıdır (CSS değişkenleri
// runtime, token'lar JS) ve TUTARLI tutulmalıdır: renk değişecekse ikisi birden
// değişir. Salt sunum sabitidir; iş kuralı veya hesaplama içermez.

// Palet: styles/login.css :root ile birebir aynı değerler (tek kaynak orası).
const RENK_MARKA_MAVI = '#0072CE'
const RENK_MARKA_MAVI_KOYU = '#005ba6'
const RENK_LACIVERT = '#1f2530'
const RENK_METIN_SOLUK = '#6b7385'
const RENK_KENARLIK = '#d5dae4'
const RENK_ZEMIN_ACIK = '#eef1f6'
const RENK_BEYAZ = '#ffffff'
const RENK_HATA = '#c0392b'
const RENK_VURGU = '#0080ff'

// ConfigProvider'a verilen tema nesnesi. Yalnızca genel (global) token'lar
// belirlenir; bileşen bazlı ince ayar bugün gerekmediği için eklenmez.
export const ANTD_TEMASI = {
  token: {
    colorPrimary: RENK_MARKA_MAVI,
    colorPrimaryHover: RENK_MARKA_MAVI_KOYU,
    // Odak halkası mevcut vurgu rengiyle aynı kalsın.
    colorPrimaryBorderHover: RENK_VURGU,
    colorText: RENK_LACIVERT,
    colorTextHeading: RENK_LACIVERT,
    colorTextSecondary: RENK_METIN_SOLUK,
    colorBorder: RENK_KENARLIK,
    colorBgLayout: RENK_ZEMIN_ACIK,
    colorBgContainer: RENK_BEYAZ,
    colorError: RENK_HATA,
    borderRadius: 10,
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  },
}

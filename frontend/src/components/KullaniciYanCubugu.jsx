// Sol kullanıcı yan çubuğu (rail) bileşeni. Üst barın altından başlayan, sol
// kenarda kalıcı ve daraltılıp genişletilebilen dar bir menü çubuğudur. Sağdaki
// admin panelinden (drawer) BAĞIMSIZDIR ve ona ektir; oturumu olan HER kullanıcıya
// (user ve admin) gösterilir. Üstte bir aç/kapa (chevron) butonu ve altında üç
// menü öğesi (Anketlerim, Eğitimlerim, Yetkinliklerim) bulunur. Öğeler şimdilik
// işlevsiz görsel yer tutuculardır. Daraltılmış/genişletilmiş durum üst bileşenden
// (AnaSayfaPage) props ile gelir, çünkü içerik alanının sol marjı bu duruma göre
// kayar. Yalnızca gösterim sorumluluğundadır; iş kuralı/hesaplama içermez.
import '../styles/kullanici-yan-cubugu.css'

// AnketlerimIcon: pano/liste (clipboard-list) amblemini çizer. Pano gövdesi,
// üstte klips ve içinde birkaç satır çizgisiyle "anket listesi" çağrışımı verir.
function AnketlerimIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="18" rx="2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="16" y2="15" />
      <line x1="8" y1="19" x2="13" y2="19" />
    </svg>
  )
}

// EgitimlerimIcon: mezuniyet külahı (graduation cap / mortarboard) amblemini
// çizer. Üstte kare külah, ortada bağlantı ve yanda sarkan püskül ipiyle
// "eğitim" çağrışımı verir.
function EgitimlerimIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 9 12 4 22 9 12 14 2 9Z" />
      <path d="M6 11v5c0 1 2.5 2.5 6 2.5s6 -1.5 6 -2.5v-5" />
      <line x1="22" y1="9" x2="22" y2="14" />
    </svg>
  )
}

// YetkinliklerimIcon: rozet/madalya (award) amblemini çizer. Üstte daire madalya,
// altında iki uçlu kurdele ile "yetkinlik/başarı" çağrışımı verir.
function YetkinliklerimIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14 7.5 22 12 19.5 16.5 22 15 14" />
    </svg>
  )
}

// ChevronIcon: sağa dönük chevron (ok) simgesini çizer. AdminPaneli'ndeki chevron
// stiliyle aynı; aç/kapa butonunda kullanılır ve CSS ile daraltılmışken sağa,
// genişletilmişken sola bakacak şekilde döndürülür.
function ChevronIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

// Yan çubukta gösterilecek menü öğeleri. Her öğe bir etiket ve o etikete ait
// amblem bileşenini taşır. Öğeler şimdilik işlevsizdir (görsel yer tutucu).
const MENU_OGELERI = [
  { etiket: 'Anketlerim', IkonBileseni: AnketlerimIcon },
  { etiket: 'Eğitimlerim', IkonBileseni: EgitimlerimIcon },
  { etiket: 'Yetkinliklerim', IkonBileseni: YetkinliklerimIcon },
]

// KullaniciYanCubugu: sol yan çubuğu render eder.
// props:
//   genis (bool) -> çubuk genişletilmiş mi (true) yoksa daraltılmış mı (false).
//   durumDegistir() -> aç/kapa butonuna tıklanınca çağrılır; üst bileşen durumu
//     tersine çevirir (içerik alanının sol marjı da bu duruma göre kayar).
function KullaniciYanCubugu({ genis, durumDegistir }) {
  // acKapaEtiketi: aç/kapa butonunun erişilebilirlik etiketini duruma göre üretir.
  const acKapaEtiketi = genis ? 'Menüyü daralt' : 'Menüyü genişlet'

  return (
    <nav
      className={`yan-cubuk${genis ? ' genis' : ''}`}
      aria-label="Kullanıcı menüsü"
    >
      <div className="yan-cubuk-ust">
        <button
          type="button"
          className="yan-cubuk-ackapa"
          onClick={durumDegistir}
          aria-label={acKapaEtiketi}
          aria-expanded={genis}
          title={acKapaEtiketi}
        >
          <span className={`yan-cubuk-chevron${genis ? ' genis' : ''}`}>
            <ChevronIcon />
          </span>
        </button>
      </div>

      <ul className="yan-cubuk-liste">
        {MENU_OGELERI.map(({ etiket, IkonBileseni }) => (
          <li key={etiket}>
            <button
              type="button"
              className="yan-cubuk-oge"
              aria-label={etiket}
              title={etiket}
            >
              <span className="yan-cubuk-oge-ikon">
                <IkonBileseni />
              </span>
              <span className="yan-cubuk-oge-etiket">{etiket}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default KullaniciYanCubugu

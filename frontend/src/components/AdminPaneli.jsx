// Admin paneli bileşeni. Sağ kenardan kayarak açılan dar bir panel (drawer)
// olarak, başlık, kapatma butonu ve yer tutucu yönetim seçeneklerini gösterir.
// Panel açıkken üst barın altından başlayan, beyaza yakın/hafif buzlu açık bir
// perde sayfayı örter (karartmaz). Perdeye veya başlıktaki ok butonuna
// tıklanınca panel kapanır. Açık/kapalı durumu üst bileşenden (AnaSayfaPage)
// props ile gelir; kendi state'ini tutmaz. Seçenekler şimdilik işlevsiz görsel
// yer tutuculardır. Yalnızca gösterim sorumluluğundadır.

// Panelde gösterilecek yer tutucu yönetim seçenekleri. Şimdilik işlevsizdir;
// gerçek yönlendirme/işlev sonraki adımda eklenecektir.
const YONETIM_SECENEKLERI = [
  'Kullanıcı Yönetimi',
  'Anket Yönetimi',
  'Eğitim Yönetimi',
  'Raporlar',
]

// SagOkIcon: sağa dönük chevron (ok) simgesini çizer. Kapatma butonunda
// kullanılır; panelin sağa doğru kapandığını görsel olarak ima eder.
function SagOkIcon() {
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

// AdminPaneli: sağdan kayan yönetim panelini ve arkasındaki açık perdeyi render
// eder. props: acik (bool), panelKapat() -> perdeye veya kapatma ok butonuna
// tıklanınca çağrılır.
function AdminPaneli({ acik, panelKapat }) {
  return (
    <>
      <div
        className={`admin-overlay${acik ? ' acik' : ''}`}
        onClick={panelKapat}
        aria-hidden="true"
      />
      <aside
        className={`admin-panel${acik ? ' acik' : ''}`}
        role="dialog"
        aria-label="Yönetim paneli"
        aria-hidden={!acik}
      >
        <div className="admin-panel-baslik">
          <h2>Yönetim</h2>
          <button
            type="button"
            className="admin-kapat-buton"
            onClick={panelKapat}
            aria-label="Yönetim panelini kapat"
          >
            <SagOkIcon />
          </button>
        </div>

        <ul className="admin-secenek-listesi">
          {YONETIM_SECENEKLERI.map((secenek) => (
            <li key={secenek}>
              <button type="button" className="admin-secenek">
                {secenek}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </>
  )
}

export default AdminPaneli

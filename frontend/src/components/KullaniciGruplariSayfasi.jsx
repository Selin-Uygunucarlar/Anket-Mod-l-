// Kullanıcı Grupları (grup-odaklı üye yönetimi) görünümü. Admin panelinden
// "Kullanıcı Grupları" seçilince anasayfa içerik alanında render edilir. Akış:
// üstte bir grup seçilir -> o grubun üyeleri listelenir -> üye çıkarılabilir
// veya üye olmayan kullanıcılardan biri seçilip gruba eklenebilir. Sayfa
// yerleşimi baştan sabittir: üye ekleme kutusu ve "Ekle" butonu grup seçilmeden
// de görünür ama pasiftir, liste alanında ise tek bir boş üye kartı yönlendirme
// metni gösterir; böylece grup seçilince öğeler yerinden oynamaz. Yalnızca
// sunum sorumluluğundadır: veriyi grupApi/kullaniciApi üzerinden ister ve gösterir,
// girdi toplar; iş kuralı, yetki veya hesaplama İÇERMEZ (yetki sunucuda). Bir
// kullanıcı zaten başka gruptaysa gruba eklenince taşınır — bu backend davranışıdır,
// UI ek kural koymaz. Yükleniyor/boş/hata durumları ayrı ele alınır; kullanıcıya
// yalnızca backend'in güvenli mesajı gösterilir (teknik detay sızmaz).

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listGruplar,
  listGrupUyeleri,
  grubaAta,
  gruptanCikar,
} from '../api/grupApi.js'
import { listKullanicilar } from '../api/kullaniciApi.js'
import { buyukHarfeCevir } from '../common/metinBicimlendir.js'
import OnayKutusu from './OnayKutusu.jsx'
import '../styles/kullanici-gruplari.css'

// uyeOlmayanKullanicilar: tüm kullanıcılardan, verilen grubun mevcut üyelerini
// çıkararak eklenmeye aday olanları döndürür. Saf sunum süzme mantığıdır (üyeleri
// listeden gizlemek için); iş kuralı taşımaz — asıl atama kararı backend'dedir.
function uyeOlmayanKullanicilar(tumKullanicilar, mevcutUyeler) {
  const uyeKodlari = new Set((mevcutUyeler ?? []).map((uye) => uye.kullanici_kodu))
  return (tumKullanicilar ?? []).filter(
    (kullanici) => !uyeKodlari.has(kullanici.kullanici_kodu),
  )
}

// KullaniciGruplariSayfasi: grup seçimi + üye listesi + üye ekle/çıkar akışı.
function KullaniciGruplariSayfasi() {
  // Seçili grubun kimliği ('' iken henüz grup seçilmemiştir).
  const [secilenGrupId, setSecilenGrupId] = useState('')
  // Üye ekleme kutusunda seçili aday kullanıcının kodu ('' iken seçim yok).
  const [eklenecekKod, setEklenecekKod] = useState('')
  // Çıkarma onay kutusunun hedefi olan üye (null iken onay kutusu kapalı).
  const [cikarilacakUye, setCikarilacakUye] = useState('')
  const queryClient = useQueryClient()

  const {
    data: gruplar,
    isPending: gruplarYukleniyor,
    isError: gruplarHatali,
    error: gruplarHatasi,
  } = useQuery({
    queryKey: ['gruplar'],
    queryFn: listGruplar,
  })

  // Seçili grubun üyeleri: grup seçilene kadar sorgu çalışmaz (enabled).
  const {
    data: uyeler,
    isPending: uyelerYukleniyor,
    isError: uyelerHatali,
    error: uyelerHatasi,
  } = useQuery({
    queryKey: ['grup-uyeleri', secilenGrupId],
    queryFn: () => listGrupUyeleri(secilenGrupId),
    enabled: secilenGrupId !== '',
  })

  // Üye ekleme adaylarını türetmek için tüm kullanıcı listesi (mevcut uç).
  const { data: tumKullanicilar } = useQuery({
    queryKey: ['kullanicilar'],
    queryFn: listKullanicilar,
    enabled: secilenGrupId !== '',
  })

  // Üye ekleme ve çıkarma sonrası hem grup listesi (üye sayısı) hem seçili grubun
  // üye listesi tazelenir; kullanıcı adayları da güncellensin.
  function uyeSorgulariniTazele() {
    queryClient.invalidateQueries({ queryKey: ['gruplar'] })
    queryClient.invalidateQueries({ queryKey: ['grup-uyeleri', secilenGrupId] })
  }

  const ataMutation = useMutation({
    mutationFn: (kullaniciKodu) => grubaAta(secilenGrupId, kullaniciKodu),
    onSuccess: () => {
      uyeSorgulariniTazele()
      setEklenecekKod('')
    },
  })

  const cikarMutation = useMutation({
    mutationFn: (kullaniciKodu) => gruptanCikar(secilenGrupId, kullaniciKodu),
    onSuccess: () => {
      uyeSorgulariniTazele()
      setCikarilacakUye('')
    },
    onError: () => {
      // Onay kutusunu kapat; güvenli hata mesajı liste üstünde gösterilir.
      setCikarilacakUye('')
    },
  })

  // grupSecildi: grup seçimi değişince seçili grubu günceller ve ekleme seçimini
  // sıfırlar (yeni grubun adayları farklıdır).
  function grupSecildi(olay) {
    setSecilenGrupId(olay.target.value)
    setEklenecekKod('')
  }

  // uyeEkle: seçili aday kullanıcıyı seçili gruba ekleme isteğini gönderir.
  // Boş seçimde buton pasif olduğundan burada ek kontrol yapılmaz (yalnız UX).
  function uyeEkle() {
    if (eklenecekKod === '') {
      return
    }
    ataMutation.mutate(eklenecekKod)
  }

  // cikarmayiOnayla: onay kutusundaki onay butonuna basılınca hedef üyeyi gruptan
  // çıkarma isteğini tetikler.
  function cikarmayiOnayla() {
    cikarMutation.mutate(cikarilacakUye.kullanici_kodu)
  }

  const adaylar = uyeOlmayanKullanicilar(tumKullanicilar, uyeler)
  const grupSecilmedi = secilenGrupId === ''
  // Ekleme yalnızca bir grup ve bir aday seçiliyken ve istek sürmüyorken mümkün.
  const eklePasif = grupSecilmedi || eklenecekKod === '' || ataMutation.isPending

  return (
    <section className="gruplar">
      <h2 className="gruplar-baslik">Kullanıcı Grupları</h2>

      <div className="gruplar-kontrol">
        <label className="gruplar-alan">
          <span className="gruplar-etiket">Grup</span>
          <select
            className="gruplar-kutu"
            value={secilenGrupId}
            onChange={grupSecildi}
            disabled={gruplarYukleniyor || gruplarHatali}
          >
            <option value="">Grup seçin</option>
            {(gruplar ?? []).map((grup) => (
              <option key={grup.grup_id} value={grup.grup_id}>
                {`${grup.ad} (${grup.uye_sayisi} üye)`}
              </option>
            ))}
          </select>
        </label>

        <label className="gruplar-alan">
          <span className="gruplar-etiket">Üye Ekle</span>
          <select
            className="gruplar-kutu"
            value={eklenecekKod}
            onChange={(olay) => setEklenecekKod(olay.target.value)}
            disabled={grupSecilmedi}
          >
            <option value="">Kullanıcı seçin</option>
            {adaylar.map((kullanici) => (
              <option
                key={kullanici.kullanici_kodu}
                value={kullanici.kullanici_kodu}
              >
                {`${buyukHarfeCevir(kullanici.ad)} ${buyukHarfeCevir(
                  kullanici.soyad,
                )} (${kullanici.kullanici_kodu})`}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="birincil-buton"
          onClick={uyeEkle}
          disabled={eklePasif}
        >
          {ataMutation.isPending ? 'Ekleniyor...' : 'Ekle'}
        </button>
      </div>

      {ataMutation.isError && (
        <div className="gruplar-hata" role="alert">
          {ataMutation.error?.message ||
            'Kullanıcı gruba eklenemedi. Lütfen tekrar deneyin.'}
        </div>
      )}

      {cikarMutation.isError && (
        <div className="gruplar-hata" role="alert">
          {cikarMutation.error?.message ||
            'Kullanıcı gruptan çıkarılamadı. Lütfen tekrar deneyin.'}
        </div>
      )}

      {gruplarHatali && (
        <p className="gruplar-durum gruplar-durum-hata">{gruplarHatasi.message}</p>
      )}

      {grupSecilmedi && !gruplarHatali && (
        <ul className="gruplar-uye-listesi">
          <li className="gruplar-uye gruplar-uye-bos">
            <span className="gruplar-uye-bilgi">
              <span className="gruplar-uye-ad">
                Üyelerini görmek için bir grup seçin.
              </span>
            </span>
            <button
              type="button"
              className="gruplar-cikar-buton"
              disabled
              aria-hidden="true"
            >
              Çıkar
            </button>
          </li>
        </ul>
      )}

      {secilenGrupId !== '' && uyelerYukleniyor && (
        <p className="gruplar-durum">Yükleniyor...</p>
      )}

      {secilenGrupId !== '' && uyelerHatali && (
        <p className="gruplar-durum gruplar-durum-hata">{uyelerHatasi.message}</p>
      )}

      {secilenGrupId !== '' &&
        !uyelerYukleniyor &&
        !uyelerHatali &&
        (uyeler?.length ?? 0) === 0 && (
          <p className="gruplar-durum">Bu grupta henüz üye yok.</p>
        )}

      {secilenGrupId !== '' &&
        !uyelerYukleniyor &&
        !uyelerHatali &&
        (uyeler?.length ?? 0) > 0 && (
          <ul className="gruplar-uye-listesi">
            {uyeler.map((uye) => (
              <li key={uye.kullanici_kodu} className="gruplar-uye">
                <span className="gruplar-uye-bilgi">
                  <span className="gruplar-uye-ad">
                    {`${buyukHarfeCevir(uye.ad)} ${buyukHarfeCevir(uye.soyad)}`}
                  </span>
                  <span className="gruplar-uye-email">{uye.email}</span>
                </span>
                <button
                  type="button"
                  className="gruplar-cikar-buton"
                  onClick={() => setCikarilacakUye(uye)}
                  disabled={cikarMutation.isPending}
                >
                  Çıkar
                </button>
              </li>
            ))}
          </ul>
        )}

      {cikarilacakUye && (
        <OnayKutusu
          baslik="Üyeyi gruptan çıkar"
          mesaj={`${buyukHarfeCevir(cikarilacakUye.ad)} ${buyukHarfeCevir(
            cikarilacakUye.soyad,
          )} adlı kullanıcı gruptan çıkarılacak. Emin misiniz?`}
          onaylaMetni="Çıkar"
          onOnayla={cikarmayiOnayla}
          onVazgec={() => setCikarilacakUye('')}
          islemAktif={cikarMutation.isPending}
        />
      )}
    </section>
  )
}

export default KullaniciGruplariSayfasi

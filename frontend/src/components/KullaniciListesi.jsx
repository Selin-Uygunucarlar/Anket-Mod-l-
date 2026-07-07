// Kullanıcı listesi bileşeni. Admin panelinden "Kullanıcı Listesi" seçilince
// anasayfa içerik alanında render edilir. Yalnızca sunum sorumluluğundadır:
// veriyi kullaniciApi üzerinden ister ve tabloda gösterir; iş kuralı, yetki
// kontrolü veya hesaplama İÇERMEZ (yetki sunucuda uygulanır). Yükleniyor, hata,
// boş ve dolu durumları ayrı ayrı ele alınır; kullanıcıya yalnızca güvenli
// mesaj gösterilir. Başlık yanındaki arama kutusu, ekranda zaten çekili olan
// veriyi client-side süzer (ad soyad, durum, e-posta, sicil, eklenme tarihi);
// backend'e ek istek atmaz. Çalışan ve yönetici adları tıklanınca üst bileşene
// iletilir (onKisiSec) ve sağdan kayan kişi detay panelinde gösterilir. Başlık
// satırındaki "Kullanıcı Ekle" butonu, üst bileşene (onKullaniciEkle) haber
// vererek içerik alanında kullanıcı ekleme formunu açar.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listKullanicilar } from '../api/kullaniciApi.js'
import {
  buyukHarfeCevir,
  tarihSaatBicimlendir,
} from '../common/metinBicimlendir.js'
import '../styles/kullanici-listesi.css'

// ArtiIcon: artı (+) simgesini çizer. Başlık satırındaki "Kullanıcı Ekle"
// butonunda kullanılır.
function ArtiIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

// BuyutecIcon: büyüteç (arama) simgesini çizer. Başlık yanındaki arama
// kutusunun içinde görsel ipucu olarak kullanılır.
function BuyutecIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  )
}

// kullaniciAramayaUyuyorMu: bir kullanıcı satırının, girilen arama metnine
// uyup uymadığını döner. Ekranda görünen alanlardan (ad soyad, durum metni,
// e-posta, sicil no, biçimlenmiş eklenme tarihi) tek bir metin oluşturup
// Türkçe locale ile büyük/küçük harf duyarsız alt-dize kontrolü yapar. Boş
// aramada tüm satırlar uyar. Saf sunum süzme mantığıdır; iş kuralı taşımaz.
function kullaniciAramayaUyuyorMu(kullanici, aramaMetni) {
  const aranan = aramaMetni.trim().toLocaleLowerCase('tr')
  if (aranan === '') {
    return true
  }
  const aranabilirAlanlar = [
    `${kullanici.ad} ${kullanici.soyad}`,
    kullanici.aktif ? 'Aktif' : 'Pasif',
    kullanici.email,
    kullanici.kullanici_kodu,
    tarihSaatBicimlendir(kullanici.olusturma_tarihi),
  ]
  const aranabilirMetin = aranabilirAlanlar.join(' ').toLocaleLowerCase('tr')
  return aranabilirMetin.includes(aranan)
}

// UcNoktaIcon: dikey üç nokta (⋮) simgesini çizer. İşlemler sütunundaki menü
// butonunda kullanılır; şimdilik yalnızca görsel yer tutucudur.
function UcNoktaIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  )
}

// KullaniciListesi: kullanıcıları React Query ile çeker ve durumuna göre
// yükleniyor / hata / boş / tablo gösterir. props: onKisiSec(kisi) -> bir
// çalışan veya yönetici adına tıklanınca { kullanici_kodu, ad, soyad } ile
// çağrılır (kullanici_kodu detay panelinin backend'den çekimi için);
// onKullaniciEkle() -> "Kullanıcı Ekle" butonuna tıklanınca çağrılır (üst
// bileşen kullanıcı ekleme görünümünü açar).
function KullaniciListesi({ onKisiSec, onKullaniciEkle }) {
  const [aramaMetni, setAramaMetni] = useState('')
  const {
    data: kullanicilar,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['kullanicilar'],
    queryFn: listKullanicilar,
  })

  if (isPending) {
    return <p className="kullanici-liste-durum">Yükleniyor...</p>
  }

  if (isError) {
    // error.message backend'in güvenli mesajıdır (ör. 403 yetki mesajı);
    // teknik detay sızmaz.
    return (
      <p className="kullanici-liste-durum kullanici-liste-hata">
        {error.message}
      </p>
    )
  }

  if (!kullanicilar || kullanicilar.length === 0) {
    return (
      <p className="kullanici-liste-durum">Kayıtlı kullanıcı bulunamadı.</p>
    )
  }

  // Ekranda çekili veri, arama metnine göre süzülür; boş aramada tümü gelir.
  const filtreliKullanicilar = kullanicilar.filter((kullanici) =>
    kullaniciAramayaUyuyorMu(kullanici, aramaMetni),
  )

  return (
    <section className="kullanici-liste">
      <div className="kullanici-liste-baslik-satiri">
        <div className="kullanici-liste-baslik-grup">
          <h2 className="kullanici-liste-baslik">Kullanıcı Listesi</h2>
          <div className="kullanici-arama-sarmalayici">
            <span className="kullanici-arama-ikon">
              <BuyutecIcon />
            </span>
            <input
              type="search"
              className="kullanici-arama-kutusu"
              value={aramaMetni}
              onChange={(olay) => setAramaMetni(olay.target.value)}
              placeholder="Ara: ad soyad, durum, e-posta, sicil, tarih"
              aria-label="Kullanıcı listesinde ara"
            />
          </div>
        </div>
        <button
          type="button"
          className="kullanici-ekle-buton"
          onClick={onKullaniciEkle}
        >
          <ArtiIcon />
          <span>Kullanıcı Ekle</span>
        </button>
      </div>
      {filtreliKullanicilar.length === 0 ? (
        <p className="kullanici-liste-durum">Eşleşen kullanıcı bulunamadı.</p>
      ) : (
      <div className="kullanici-tablo-sarmalayici">
        <table className="kullanici-tablo">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>Sicil No</th>
              <th>Durum</th>
              <th>E-posta</th>
              <th>Yönetici</th>
              <th>Sisteme Eklenme</th>
              <th>Son Giriş</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filtreliKullanicilar.map((kullanici) => {
              // Yönetici adı ikisi de yoksa tıklanamaz düz tire olarak kalır.
              const yoneticiVar =
                Boolean(kullanici.yonetici_ad) ||
                Boolean(kullanici.yonetici_soyad)
              return (
                <tr key={kullanici.kullanici_kodu}>
                  <td>
                    <button
                      type="button"
                      className="kisi-ad-buton"
                      onClick={() =>
                        onKisiSec({
                          kullanici_kodu: kullanici.kullanici_kodu,
                          ad: kullanici.ad,
                          soyad: kullanici.soyad,
                        })
                      }
                    >
                      {`${buyukHarfeCevir(kullanici.ad)} ${buyukHarfeCevir(
                        kullanici.soyad,
                      )}`}
                    </button>
                  </td>
                  <td>{kullanici.kullanici_kodu}</td>
                  <td>{kullanici.aktif ? 'Aktif' : 'Pasif'}</td>
                  <td>{kullanici.email}</td>
                  <td>
                    {yoneticiVar ? (
                      <button
                        type="button"
                        className="kisi-ad-buton"
                        onClick={() =>
                          onKisiSec({
                            kullanici_kodu: kullanici.ilgili_yonetici_kodu,
                            ad: kullanici.yonetici_ad,
                            soyad: kullanici.yonetici_soyad,
                          })
                        }
                      >
                        {`${buyukHarfeCevir(
                          kullanici.yonetici_ad,
                        )} ${buyukHarfeCevir(kullanici.yonetici_soyad)}`.trim()}
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{tarihSaatBicimlendir(kullanici.olusturma_tarihi)}</td>
                  <td>{tarihSaatBicimlendir(kullanici.son_giris_tarihi)}</td>
                  <td>
                    <button
                      type="button"
                      className="kullanici-islem-buton"
                      aria-label="İşlemler menüsü"
                    >
                      <UcNoktaIcon />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
    </section>
  )
}

export default KullaniciListesi

// Giriş işlemini React Query mutation'ı olarak saran hook.
// UI bileşeni, istek durumunu (pending/error) ve tetikleyiciyi buradan alır;
// böylece bileşen ağ/istek yönetimi detaylarıyla uğraşmaz.
import { useMutation } from '@tanstack/react-query'
import { login } from '../api/authApi.js'

// useLogin: authApi.login'i mutation olarak sunar.
// Dönen mutation nesnesi: mutate(degiskenler), isPending, isError vb. içerir.
export function useLogin() {
  return useMutation({
    // { kimlik, sifre } alır ve tek stub noktası olan authApi.login'e iletir.
    mutationFn: ({ kimlik, sifre }) => login(kimlik, sifre),
  })
}

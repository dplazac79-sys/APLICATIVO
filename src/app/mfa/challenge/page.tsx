'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// MFA desactivado — esta página desenrolla los factores activos y redirige al app
export default function MfaChallengePage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function unenrollAndRedirect() {
      try {
        const { data } = await supabase.auth.mfa.listFactors()
        const allFactors = data?.all ?? []
        for (const factor of allFactors) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id })
        }
      } catch {
        // ignorar errores, igual redirigimos
      }
      const { data: { user } } = await supabase.auth.getUser()
      const { data: usuario } = await supabase
        .from('usuario')
        .select('rol')
        .eq('id', user?.id ?? '')
        .single()
      router.replace(usuario?.rol === 'usuario_cliente' ? '/portal' : '/bienvenida')
    }
    unenrollAndRedirect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#04060f' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite', color: '#38bdf8' }}>
          <circle cx="12" cy="12" r="10" stroke="rgba(56,189,248,0.2)" strokeWidth="3"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <p style={{ color: '#475569', fontSize: 13 }}>Redirigiendo…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

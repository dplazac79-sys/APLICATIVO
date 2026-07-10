'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// MFA desactivado — esta página limpia los factores del usuario vía API de
// admin (no requiere AAL2, a diferencia del unenroll del lado del cliente,
// que se queda colgado si la sesión todavía está en AAL1) y redirige al app.
export default function MfaChallengePage() {
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    async function cleanupAndRedirect() {
      try {
        await fetch('/api/auth/mfa-cleanup', { method: 'POST' })
      } catch {
        // seguimos igual, no debe bloquear el acceso
      }
      if (cancelled) return

      const { data: { user } } = await supabase.auth.getUser()
      const { data: usuario } = await supabase
        .from('usuario')
        .select('rol')
        .eq('id', user?.id ?? '')
        .single()

      window.location.href = usuario?.rol === 'usuario_cliente' ? '/portal' : '/bienvenida'
    }

    cleanupAndRedirect()

    // Red de seguridad: si algo se cuelga, forzamos la salida igual
    const fallback = setTimeout(() => {
      if (!cancelled) window.location.href = '/bienvenida'
    }, 6000)

    return () => { cancelled = true; clearTimeout(fallback) }
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

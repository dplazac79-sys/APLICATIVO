'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function OlvidePasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Siempre mostramos el mismo mensaje de éxito exista o no la cuenta —
    // evita que este formulario sirva para confirmar qué correos están
    // registrados en el sistema (enumeración de usuarios).
    const { error: errReset } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/cambiar-password`,
    })

    setLoading(false)
    if (errReset && errReset.status && errReset.status >= 500) {
      setError('Ocurrió un error inesperado. Intenta de nuevo en unos minutos.')
      return
    }
    setEnviado(true)
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '12px 14px', borderRadius: 10, fontSize: 14,
    color: '#f8fafc', background: 'rgba(3,7,18,0.6)',
    border: '1px solid rgba(255,255,255,0.07)', outline: 'none',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#04060f', fontFamily: 'system-ui, -apple-system, sans-serif', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: 'rgba(8,12,28,0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20, padding: '40px 36px',
        backdropFilter: 'blur(20px)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent)' }} />

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(29,78,216,0.12)', border: '1px solid rgba(29,78,216,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>
            </svg>
          </div>
        </div>

        <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.03em', textAlign: 'center' }}>
          Recuperar contraseña
        </h1>

        {enviado ? (
          <>
            <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', margin: '0 0 28px', lineHeight: 1.6 }}>
              Si <strong style={{ color: '#cbd5e1' }}>{email}</strong> corresponde a una cuenta registrada, te enviamos un correo con un enlace para crear una nueva contraseña. Revisa también tu carpeta de spam.
            </p>
            <Link href="/login" style={{
              display: 'block', textAlign: 'center', padding: '13px 0', borderRadius: 10,
              background: 'linear-gradient(90deg, #1d4ed8, #0891b2)', color: '#fff',
              fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              textDecoration: 'none',
            }}>
              Volver al inicio de sesión
            </Link>
          </>
        ) : (
          <>
            <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', margin: '0 0 28px', lineHeight: 1.5 }}>
              Ingresa tu correo corporativo y te enviaremos un enlace para crear una nueva contraseña.
            </p>

            {error && (
              <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 10, background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <span style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
                  Correo corporativo
                </label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="nombre@empresa.com" autoComplete="email"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'rgba(56,189,248,0.45)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
                />
              </div>

              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(90deg, #1d4ed8, #0891b2)', color: '#fff',
                  fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
                }}
              >
                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>

              <Link href="/login" style={{ textAlign: 'center', color: '#475569', fontSize: 12, textDecoration: 'none' }}>
                Volver al inicio de sesión
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

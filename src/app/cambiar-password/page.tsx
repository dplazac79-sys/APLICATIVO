'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CambiarPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (nueva.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    // Actualizar contraseña y limpiar el flag
    const { error: errUpdate } = await supabase.auth.updateUser({
      password: nueva,
      data: { must_change_password: false },
    })

    if (errUpdate) {
      setError(errUpdate.message)
      setLoading(false)
      return
    }

    // Obtener rol para redirigir al destino correcto
    const { data: { user } } = await supabase.auth.getUser()
    const { data: usuario } = await supabase
      .from('usuario')
      .select('rol')
      .eq('id', user!.id)
      .single()

    router.push(usuario?.rol === 'usuario_cliente' ? '/portal' : '/bienvenida')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#04060f',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'rgba(8,12,28,0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        padding: '40px 36px',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Línea superior decorativa */}
        <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent)' }} />

        {/* Ícono */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(29,78,216,0.12)',
            border: '1px solid rgba(29,78,216,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
        </div>

        <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.03em', textAlign: 'center' }}>
          Crea tu contraseña
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', margin: '0 0 28px', lineHeight: 1.5 }}>
          Es tu primer acceso. Elige una contraseña personal para continuar.
        </p>

        {error && (
          <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 10, background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
              Nueva contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={nueva}
              onChange={e => setNueva(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, fontSize: 14, color: '#f8fafc', background: 'rgba(3,7,18,0.6)', border: '1px solid rgba(255,255,255,0.07)', outline: 'none', transition: 'border-color 0.15s' }}
              onFocus={e => { e.target.style.borderColor = 'rgba(56,189,248,0.45)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
              Confirmar contraseña
            </label>
            <input
              type="password"
              required
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              placeholder="Repite la contraseña"
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, fontSize: 14, color: '#f8fafc', background: 'rgba(3,7,18,0.6)', border: '1px solid rgba(255,255,255,0.07)', outline: 'none', transition: 'border-color 0.15s' }}
              onFocus={e => { e.target.style.borderColor = 'rgba(56,189,248,0.45)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? '#1e293b' : 'linear-gradient(90deg, #1d4ed8, #0891b2)',
              color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', opacity: loading ? 0.7 : 1, transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading
              ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>Guardando...</>
              : 'Guardar y continuar'
            }
          </button>
        </form>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

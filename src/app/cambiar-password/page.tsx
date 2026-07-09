'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Validación de fortaleza ────────────────────────────────────────────────────

interface PasswordCheck { label: string; ok: boolean }

function getChecks(pwd: string): PasswordCheck[] {
  return [
    { label: 'Mínimo 8 caracteres',            ok: pwd.length >= 8 },
    { label: 'Al menos una letra mayúscula',    ok: /[A-Z]/.test(pwd) },
    { label: 'Al menos una letra minúscula',    ok: /[a-z]/.test(pwd) },
    { label: 'Al menos un número',              ok: /[0-9]/.test(pwd) },
    { label: 'Al menos un carácter especial (!@#$%&*)', ok: /[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>/?]/.test(pwd) },
  ]
}

function strengthLevel(checks: PasswordCheck[]): { level: number; label: string; color: string } {
  const passed = checks.filter(c => c.ok).length
  if (passed <= 1) return { level: 1, label: 'Muy débil',  color: '#ef4444' }
  if (passed === 2) return { level: 2, label: 'Débil',      color: '#f97316' }
  if (passed === 3) return { level: 3, label: 'Regular',    color: '#eab308' }
  if (passed === 4) return { level: 4, label: 'Fuerte',     color: '#22c55e' }
  return               { level: 5, label: 'Muy fuerte',  color: '#06b6d4' }
}

// ── Componente principal ───────────────────────────────────────────────────────

function CambiarPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const expired = searchParams.get('expired') === '1'
  const supabase = createClient()

  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showNueva, setShowNueva] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const checks = getChecks(nueva)
  const strength = nueva.length > 0 ? strengthLevel(checks) : null
  const allPassed = checks.every(c => c.ok)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!allPassed) {
      setError('La contraseña no cumple todos los requisitos de seguridad.')
      return
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const { error: errUpdate } = await supabase.auth.updateUser({
      password: nueva,
      data: {
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
      },
    })

    if (errUpdate) {
      setError(errUpdate.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: usuario } = await supabase
      .from('usuario')
      .select('rol')
      .eq('id', user!.id)
      .single()

    router.push(usuario?.rol === 'usuario_cliente' ? '/portal' : '/bienvenida')
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '12px 42px 12px 14px', borderRadius: 10, fontSize: 14,
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
        width: '100%', maxWidth: 460,
        background: 'rgba(8,12,28,0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20, padding: '40px 36px',
        backdropFilter: 'blur(20px)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent)' }} />

        {/* Ícono */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: expired ? 'rgba(251,146,60,0.1)' : 'rgba(29,78,216,0.12)',
            border: `1px solid ${expired ? 'rgba(251,146,60,0.3)' : 'rgba(29,78,216,0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {expired
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            }
          </div>
        </div>

        <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.03em', textAlign: 'center' }}>
          {expired ? 'Tu contraseña ha caducado' : 'Crea tu contraseña'}
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', margin: '0 0 28px', lineHeight: 1.5 }}>
          {expired
            ? 'Han pasado 90 días. Debes establecer una nueva contraseña para continuar.'
            : 'Es tu primer acceso. Elige una contraseña personal y segura.'}
        </p>

        {error && (
          <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 10, background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Nueva contraseña */}
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
              Nueva contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNueva ? 'text' : 'password'}
                required
                value={nueva}
                onChange={e => setNueva(e.target.value)}
                placeholder="Crea una contraseña segura"
                autoComplete="new-password"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'rgba(56,189,248,0.45)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
              />
              <button type="button" onClick={() => setShowNueva(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2 }}>
                {showNueva
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>

            {/* Barra de fortaleza */}
            {nueva.length > 0 && strength && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 5 }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{
                      flex: 1, height: 3, borderRadius: 2,
                      background: i <= strength.level ? strength.color : 'rgba(255,255,255,0.06)',
                      transition: 'background 0.2s',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>{strength.label}</span>
              </div>
            )}
          </div>

          {/* Confirmar contraseña */}
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
              Confirmar contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmar ? 'text' : 'password'}
                required
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                style={{ ...inputStyle, borderColor: confirmar && confirmar !== nueva ? 'rgba(239,68,68,0.4)' : undefined }}
                onFocus={e => { e.target.style.borderColor = confirmar && confirmar !== nueva ? 'rgba(239,68,68,0.5)' : 'rgba(56,189,248,0.45)' }}
                onBlur={e => { e.target.style.borderColor = confirmar && confirmar !== nueva ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)' }}
              />
              <button type="button" onClick={() => setShowConfirmar(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2 }}>
                {showConfirmar
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {confirmar && confirmar !== nueva && (
              <p style={{ fontSize: 11, color: '#f87171', marginTop: 5 }}>Las contraseñas no coinciden</p>
            )}
          </div>

          {/* Checklist de requisitos */}
          {nueva.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Requisitos de seguridad</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {checks.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      background: c.ok ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${c.ok ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {c.ok && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{ fontSize: 12, color: c.ok ? '#86efac' : '#475569' }}>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buenas prácticas */}
          <div style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ color: '#38bdf8', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Buenas prácticas</p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                'No uses tu nombre, fecha de nacimiento ni datos personales',
                'Nunca compartas tu contraseña con nadie, ni con el equipo de soporte',
                'Usa una contraseña distinta para cada servicio',
                'Tu contraseña caducará cada 90 días por seguridad',
                'Si sospechas que fue comprometida, cámbiala de inmediato',
              ].map((tip, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#38bdf8', flexShrink: 0, marginTop: 1 }}>·</span>
                  <span style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading || !allPassed || nueva !== confirmar}
            style={{
              marginTop: 4, width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
              cursor: loading || !allPassed || nueva !== confirmar ? 'not-allowed' : 'pointer',
              background: allPassed && nueva === confirmar
                ? 'linear-gradient(90deg, #1d4ed8, #0891b2)'
                : 'rgba(30,41,59,0.8)',
              color: allPassed && nueva === confirmar ? '#fff' : '#475569',
              fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
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

export default function CambiarPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#04060f' }} />
    }>
      <CambiarPasswordForm />
    </Suspense>
  )
}

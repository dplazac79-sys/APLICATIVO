'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const router  = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Las credenciales proporcionadas no corresponden a un perfil activo.')
      setLoading(false)
      return
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
      router.push('/mfa/challenge')
    } else if (aal?.nextLevel === 'aal1') {
      router.push('/mfa/enroll')
    } else {
      router.push('/dashboard')
    }
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#04060f', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Header ── */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} className="px-8 py-4 flex items-center justify-between">

        {/* ── Logo ProcessOS ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Ícono geométrico: nodos de proceso conectados */}
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Fondo */}
            <rect width="38" height="38" rx="10" fill="#04060f"/>
            <rect width="38" height="38" rx="10" fill="url(#logoGrad)" fillOpacity="0.12"/>
            <rect x="0.5" y="0.5" width="37" height="37" rx="9.5" stroke="url(#logoGrad)" strokeOpacity="0.4"/>
            {/* Nodo izquierdo */}
            <circle cx="10" cy="19" r="3" fill="#38bdf8"/>
            {/* Nodo centro-arriba */}
            <circle cx="19" cy="11" r="3" fill="url(#logoGrad)"/>
            {/* Nodo centro-abajo */}
            <circle cx="19" cy="27" r="3" fill="url(#logoGrad)"/>
            {/* Nodo derecho */}
            <circle cx="28" cy="19" r="3" fill="#38bdf8"/>
            {/* Líneas de conexión */}
            <line x1="13" y1="19" x2="16" y2="13" stroke="#1d4ed8" strokeWidth="1.2" strokeOpacity="0.8"/>
            <line x1="13" y1="19" x2="16" y2="25" stroke="#1d4ed8" strokeWidth="1.2" strokeOpacity="0.8"/>
            <line x1="22" y1="13" x2="25" y2="18" stroke="#0891b2" strokeWidth="1.2" strokeOpacity="0.8"/>
            <line x1="22" y1="25" x2="25" y2="20" stroke="#0891b2" strokeWidth="1.2" strokeOpacity="0.8"/>
            {/* Línea central diagonal */}
            <line x1="19" y1="14" x2="19" y2="24" stroke="rgba(56,189,248,0.25)" strokeWidth="1" strokeDasharray="2 2"/>
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1d4ed8"/>
                <stop offset="1" stopColor="#0891b2"/>
              </linearGradient>
            </defs>
          </svg>

          {/* Wordmark */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
              <span style={{ color: '#f8fafc', fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em' }}>Process</span>
              <span style={{
                color: '#38bdf8', fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em',
                background: 'linear-gradient(90deg,#38bdf8,#818cf8)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>OS</span>
            </div>
            <span style={{ color: '#334155', fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              by AICOUNTS CONSULTORES
            </span>
          </div>
        </div>

        {/* Estado sistema */}
        <div className="hidden md:flex items-center gap-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} />
            <span style={{ color: '#475569', fontSize: 11 }}>Sistemas operativos</span>
          </div>
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L2 4v4c0 3.3 2.5 6.4 6 7 3.5-.6 6-3.7 6-7V4L8 1Z" stroke="#334155" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
            <span style={{ color: '#334155', fontSize: 11 }}>Enterprise Security</span>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col lg:flex-row max-w-[1400px] w-full mx-auto px-8 py-16 lg:py-0 gap-16 lg:gap-24 items-center">

        {/* ────── LEFT ────── */}
        <div className="w-full lg:w-1/2 flex flex-col gap-12 lg:py-20">

          {/* Eyebrow — más grande y con borde */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: 100, padding: '8px 18px', width: 'fit-content',
            background: 'rgba(56,189,248,0.04)',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#38bdf8', display: 'inline-block',
              boxShadow: '0 0 8px #38bdf8',
            }} />
            <span style={{ color: '#7dd3fc', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Consultoría Estratégica de Procesos
            </span>
          </div>

          {/* Headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <h1 style={{ fontSize: 'clamp(40px, 5vw, 68px)', fontWeight: 900, lineHeight: 1.05, color: '#f8fafc', letterSpacing: '-0.03em', margin: 0 }}>
              El estándar operativo<br />
              de las organizaciones<br />
              <span style={{
                background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>que lideran.</span>
            </h1>
            <p style={{ color: '#64748b', fontSize: 17, lineHeight: 1.75, maxWidth: 480, margin: 0, fontWeight: 400 }}>
              La primera plataforma de inteligencia artificial que transforma
              documentación operacional en arquitecturas de procesos accionables,
              con impacto medible desde el primer día.
            </p>
          </div>

          {/* Separador */}
          <div style={{ width: 48, height: 1, background: 'rgba(56,189,248,0.3)' }} />

          {/* Tres capacidades revolucionarias */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              {
                icon: (
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1l1.5 4.5H14l-3.7 2.7 1.4 4.3L8 9.8l-3.7 2.7 1.4-4.3L2 5.5h4.5L8 1z" fill="#38bdf8"/>
                  </svg>
                ),
                title: 'IA que documenta por ti.',
                desc: 'Carga tu documentación existente y la IA genera el inventario completo de procesos, detecta brechas y calcula oportunidades de mejora — en horas, no en meses.',
              },
              {
                icon: (
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8h12M8 2l4 6-4 6" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
                title: 'Del proceso al ROI en tiempo real.',
                desc: 'Cada proceso analizado entrega automáticamente su análisis de impacto financiero, riesgos operacionales y KPIs proyectados — validados y aprobados digitalmente.',
              },
              {
                icon: (
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6.5" stroke="#34d399" strokeWidth="1.4"/>
                    <path d="M5 8l2 2 4-4" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
                title: 'Implementación lista para ejecutar.',
                desc: 'El sistema prioriza automáticamente qué automatizar primero (ERP, RPA, BPM) y genera el plan tecnológico con los sistemas exactos que necesita tu organización.',
              },
            ].map((item) => (
              <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
                }}>
                  {item.icon}
                </div>
                <div>
                  <p style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
                    {item.title}
                  </p>
                  <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.65, margin: 0 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingTop: 8 }}>
            {[
              { value: '10×', label: 'más rápido que consultoría tradicional' },
              { value: '< 48h', label: 'del diagnóstico al plan' },
            ].map((t, i) => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: i === 0 ? 0 : 20 }}>
                {i > 0 && <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.06)', marginRight: 20 }} />}
                <div>
                  <div style={{ color: '#f8fafc', fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{t.value}</div>
                  <div style={{ color: '#334155', fontSize: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{t.label}</div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* ────── RIGHT — Formulario ────── */}
        <div className="w-full lg:w-5/12 max-w-[420px] lg:py-24">

          <div style={{
            background: 'rgba(12,15,28,0.8)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20,
            padding: '40px 36px',
            backdropFilter: 'blur(16px)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Línea superior sutil */}
            <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.35), transparent)' }} />

            {/* Título form */}
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
                Acceso al portal
              </h2>
              <p style={{ color: '#475569', fontSize: 13, marginTop: 6, margin: '6px 0 0' }}>
                Ingresa tus credenciales corporativas
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginBottom: 24, padding: '12px 16px', borderRadius: 10,
                background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.2)',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }}>
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span style={{ color: '#fca5a5', fontSize: 12, lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Email */}
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Correo corporativo
                </label>
                <div style={{ position: 'relative' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }}>
                    <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M1 6l7 4.5L15 6" stroke="currentColor" strokeWidth="1.4"/>
                  </svg>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nombre@empresa.com"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      paddingLeft: 38, paddingRight: 14, paddingTop: 12, paddingBottom: 12,
                      borderRadius: 10, fontSize: 14, color: '#f8fafc',
                      background: 'rgba(3,7,18,0.5)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      outline: 'none', transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(56,189,248,0.4)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Contraseña
                  </label>
                  <a href="#" style={{ color: '#475569', fontSize: 11, textDecoration: 'none' }}
                    onMouseEnter={e => ((e.target as HTMLElement).style.color = '#94a3b8')}
                    onMouseLeave={e => ((e.target as HTMLElement).style.color = '#475569')}
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }}>
                    <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.4"/>
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      paddingLeft: 38, paddingRight: 42, paddingTop: 12, paddingBottom: 12,
                      borderRadius: 10, fontSize: 14, color: '#f8fafc',
                      background: 'rgba(3,7,18,0.5)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      outline: 'none', transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(56,189,248,0.4)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#475569' }}
                  >
                    {showPassword ? (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* MFA badge inline */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ accentColor: '#38bdf8', width: 14, height: 14 }} />
                  <span style={{ color: '#475569', fontSize: 12 }}>Recordar dispositivo</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: '#38bdf8' }}>
                    <path d="M8 1L2 4v4c0 3.3 2.5 6.4 6 7 3.5-.6 6-3.7 6-7V4L8 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ color: '#38bdf8', fontSize: 11, fontWeight: 500 }}>MFA activo</span>
                </div>
              </div>

              {/* Botón */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '13px 0',
                  borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? '#1e293b' : 'linear-gradient(90deg, #1d4ed8, #0891b2)',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s, transform 0.1s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)' }}
              >
                {loading ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Verificando
                  </>
                ) : 'Ingresar al sistema'}
              </button>
            </form>

            {/* SSO */}
            <div style={{ margin: '28px 0', position: 'relative', textAlign: 'center' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.05)' }} />
              </div>
              <span style={{ position: 'relative', padding: '0 12px', background: 'rgba(12,15,28,0.8)', color: '#334155', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                o continúa con
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                {
                  label: 'Azure AD',
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect width="7" height="7" fill="#0078d4"/><rect x="9" width="7" height="7" fill="#50e6ff"/>
                      <rect y="9" width="7" height="7" fill="#50e6ff"/><rect x="9" y="9" width="7" height="7" fill="#0078d4"/>
                    </svg>
                  ),
                },
                {
                  label: 'Google Workspace',
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M8 6.5h6.5c.1.5.1 1 .1 1.5 0 3.6-2.4 6-6.6 6C4 14 1 11 1 8s3-6 6.6-6c1.6 0 3 .6 4 1.5L9.9 5.2C9.2 4.6 8.7 4.5 8 4.5 5.8 4.5 4 6.2 4 8s1.8 3.5 4 3.5c2 0 3.2-1 3.4-2.5H8V6.5z" fill="#4285f4"/>
                    </svg>
                  ),
                },
              ].map(p => (
                <button key={p.label}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    color: '#64748b', fontSize: 12, fontWeight: 500, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b' }}
                >
                  {p.icon}
                  {p.label}
                </button>
              ))}
            </div>

          </div>

          {/* Nota seguridad */}
          <p style={{ textAlign: 'center', color: '#334155', fontSize: 11, marginTop: 20, lineHeight: 1.7 }}>
            Acceso auditado bajo RBAC. Cada sesión queda registrada en <span style={{ fontFamily: 'monospace', color: '#475569' }}>audit_log</span>.
          </p>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#334155', fontSize: 11 }}>© 2026 AICOUNTS. Todos los derechos reservados.</span>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Privacidad', 'EULA', 'Soporte'].map(link => (
            <a key={link} href="#" style={{ color: '#334155', fontSize: 11, textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => ((e.target as HTMLElement).style.color = '#64748b')}
              onMouseLeave={e => ((e.target as HTMLElement).style.color = '#334155')}
            >{link}</a>
          ))}
        </div>
      </footer>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

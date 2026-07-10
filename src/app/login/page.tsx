'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Canvas: red de partículas animadas ────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const PARTICLE_COUNT = 55
    const MAX_DIST       = 160
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.8 + 0.6,
    }))

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Mover
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      }

      // Líneas entre partículas cercanas
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx   = particles[i].x - particles[j].x
          const dy   = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.18
            ctx.strokeStyle = `rgba(56,189,248,${alpha})`
            ctx.lineWidth   = 0.7
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // Puntos
      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(56,189,248,0.45)'
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  )
}

// ── Diagrama animado del flujo ProcessOS ─────────────────────────────────────
function FlowDiagram() {
  const STEPS = [
    { label: 'Documento', sub: 'PDF / DOCX', color: '#38bdf8', delay: 0 },
    { label: 'IA Analiza', sub: 'Motor IA', color: '#818cf8', delay: 0.4 },
    { label: 'Proceso', sub: 'Enriquecido', color: '#a78bfa', delay: 0.8 },
    { label: 'Aprobación', sub: 'Digital', color: '#34d399', delay: 1.2 },
    { label: 'Implementa', sub: 'ERP / RPA', color: '#fb923c', delay: 1.6 },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
      {STEPS.map((step, i) => (
        <div key={step.label} style={{ display: 'flex', alignItems: 'center' }}>
          {/* Nodo */}
          <div
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              animation: `fadeSlideUp 0.5s ease both`,
              animationDelay: `${step.delay}s`,
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              border: `1px solid ${step.color}40`,
              background: `${step.color}10`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              boxShadow: `0 0 18px ${step.color}20`,
              animation: `pulse-${i} 3s ease-in-out infinite`,
              animationDelay: `${step.delay + 0.5}s`,
            }}>
              {/* Ícono */}
              {i === 0 && <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke={step.color} strokeWidth="1.3"/><path d="M10 2v3h3" stroke={step.color} strokeWidth="1.3"/></svg>}
              {i === 1 && <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke={step.color} strokeWidth="1.3"/><path d="M8 2v1M8 13v1M2 8h1M13 8h1M3.8 3.8l.7.7M11.5 11.5l.7.7M3.8 12.2l.7-.7M11.5 4.5l.7-.7" stroke={step.color} strokeWidth="1.3" strokeLinecap="round"/></svg>}
              {i === 2 && <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke={step.color} strokeWidth="1.3"/><rect x="9" y="2" width="5" height="5" rx="1" stroke={step.color} strokeWidth="1.3"/><rect x="2" y="9" width="5" height="5" rx="1" stroke={step.color} strokeWidth="1.3"/><rect x="9" y="9" width="5" height="5" rx="1" stroke={step.color} strokeWidth="1.3"/></svg>}
              {i === 3 && <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke={step.color} strokeWidth="1.3"/><path d="M5 8l2 2 4-4" stroke={step.color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              {i === 4 && <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 2l2 4h4l-3.3 2.4 1.3 3.9L8 10l-3.9 2.3 1.3-3.9L2 6h4L8 2z" stroke={step.color} strokeWidth="1.3" strokeLinejoin="round"/></svg>}
              {/* Punto pulsante */}
              <span style={{
                position: 'absolute', top: -3, right: -3,
                width: 8, height: 8, borderRadius: '50%',
                background: step.color,
                animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
                animationDelay: `${step.delay}s`,
              }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#e2e8f0', fontSize: 10, fontWeight: 700, margin: 0, letterSpacing: '0.03em' }}>{step.label}</p>
              <p style={{ color: '#475569', fontSize: 9, margin: '2px 0 0', letterSpacing: '0.02em' }}>{step.sub}</p>
            </div>
          </div>

          {/* Conector animado */}
          {i < STEPS.length - 1 && (
            <div style={{ position: 'relative', width: 28, height: 2, margin: '0 4px', marginBottom: 28 }}>
              <div style={{
                width: '100%', height: '100%',
                background: `linear-gradient(90deg, ${step.color}60, ${STEPS[i+1].color}60)`,
                borderRadius: 1,
              }} />
              {/* Partícula que viaja */}
              <div style={{
                position: 'absolute', top: -2, width: 6, height: 6,
                borderRadius: '50%', background: '#38bdf8',
                animation: 'travel 2s linear infinite',
                animationDelay: `${i * 0.4}s`,
              }} />
            </div>
          )}
        </div>
      ))}

      <style>{`
        @keyframes ping {
          0%   { transform: scale(1); opacity: 0.8; }
          70%  { transform: scale(2); opacity: 0; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes travel {
          0%   { left: 0;    opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { left: 22px; opacity: 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatA {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(30px, -40px); }
        }
        @keyframes floatB {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(-20px, 30px); }
        }
        @keyframes floatC {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(25px, 25px); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes textIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ── Orbs de fondo ─────────────────────────────────────────────────────────────
function BackgroundOrbs() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {/* Orb azul — top left */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-10%',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(29,78,216,0.12) 0%, transparent 70%)',
        animation: 'floatA 18s ease-in-out infinite',
      }} />
      {/* Orb cyan — center right */}
      <div style={{
        position: 'absolute', top: '20%', right: '-8%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(8,145,178,0.09) 0%, transparent 70%)',
        animation: 'floatB 22s ease-in-out infinite',
      }} />
      {/* Orb violeta — bottom center */}
      <div style={{
        position: 'absolute', bottom: '-20%', left: '30%',
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(129,140,248,0.07) 0%, transparent 70%)',
        animation: 'floatC 26s ease-in-out infinite',
      }} />
      {/* Grid sutil */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }} />
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

// Barra de confianza estática — afirmaciones concretas y verificables, sin rotación
// (una promesa que compite por atención en vez de cinco que se diluyen entre sí)
function TrustBar() {
  const items = [
    { icon: '🔐', label: 'Control de acceso por rol' },
    { icon: '📋', label: 'Registro de auditoría en cada acción' },
    { icon: '🔒', label: 'Datos cifrados en tránsito y en reposo' },
  ]
  return (
    <div style={{
      paddingTop: 8, animation: 'textIn 0.6s ease both', animationDelay: '0.95s',
      display: 'flex', flexWrap: 'wrap', gap: '10px 20px',
      padding: '14px 18px', borderRadius: 12,
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
    }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 13 }}>{item.icon}</span>
          <span style={{ color: '#64748b', fontSize: 12 }}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [isMobile, setIsMobile]         = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 600)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Llama al endpoint de bloqueo sin dejar que un fallo de red tumbe el login completo
  async function callLockout(action: 'check' | 'fail' | 'reset'): Promise<{ locked?: boolean; remaining?: number }> {
    try {
      const res = await fetch('/api/auth/lockout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, email }),
      })
      if (!res.ok) return {}
      return await res.json()
    } catch {
      return {}
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // 1. Verificar bloqueo antes de intentar (si falla, no bloqueamos el intento)
      const lockData = await callLockout('check')
      if (lockData.locked) {
        setError('Tu cuenta está bloqueada por demasiados intentos fallidos. Contacta al administrador del sistema.')
        return
      }

      // 2. Intentar login
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const failData = await callLockout('fail')
        if (failData.locked) {
          setError('Tu cuenta ha sido bloqueada por demasiados intentos fallidos. Contacta al administrador.')
        } else {
          const rem = failData.remaining ?? 0
          setError(`Credenciales incorrectas.${rem > 0 ? ` Te queda${rem === 1 ? '' : 'n'} ${rem} intento${rem === 1 ? '' : 's'} antes del bloqueo.` : ''}`)
        }
        return
      }

      // 3. Login exitoso — resetear contador (no bloqueante)
      callLockout('reset')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('No se pudo iniciar sesión. Intenta de nuevo.')
        return
      }

      // 4. Forzar cambio de contraseña si es primer acceso o si caducó
      if (user.user_metadata?.must_change_password === true) {
        router.push('/cambiar-password')
        return
      }

      // 5. Redirigir según rol
      const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
      router.push(usuario?.rol === 'usuario_cliente' ? '/portal' : '/bienvenida')
      router.refresh()
    } catch {
      setError('Ocurrió un error inesperado. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#04060f', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative' }}>

      {/* ── Media queries responsivas ── */}
      <style>{`
        .login-header-status { display: flex; }
        .login-flow { display: flex; }
        .login-grid { display: grid; grid-template-columns: 1fr auto; gap: 80px; }
        .login-form-wrap { width: 440px; flex-shrink: 0; }
        .login-footer { display: flex; }
        .login-footer-links { display: flex; }
        .login-input { padding-top: 12px !important; padding-bottom: 12px !important; font-size: 14px !important; }
        @keyframes ping {
          0%   { transform: scale(1); opacity: 0.8; }
          70%  { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes travel {
          0%   { left: 0;    opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { left: 13px; opacity: 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatA {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(30px, -40px); }
        }
        @keyframes floatB {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(-20px, 30px); }
        }
        @keyframes floatC {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(25px, 25px); }
        }
        @keyframes textIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* ── Tablet (≤ 900px) ── */
        @media (max-width: 900px) {
          .login-header-status { display: none !important; }
          .login-flow { display: none !important; }
          .login-grid { grid-template-columns: 1fr !important; gap: 0 !important; }
          .login-form-wrap { width: 100% !important; max-width: 480px; margin: 0 auto; }
          .login-left { display: none !important; }
          .login-main { justify-content: center !important; padding: 24px 20px !important; min-height: 0; }
        }

        /* ── Móvil (≤ 600px) ── */
        @media (max-width: 600px) {
          .login-header { padding: 14px 18px !important; }
          .login-header-logo-text { font-size: 15px !important; }
          .login-header-sub { display: none !important; }

          .login-main {
            padding: 0 !important;
            justify-content: flex-start !important;
            align-items: stretch !important;
            min-height: calc(100vh - 60px) !important;
          }

          .login-grid { width: 100% !important; }

          .login-form-wrap {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
          }

          .login-form-card {
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
            padding: 28px 20px 32px !important;
            min-height: calc(100vh - 60px) !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
          }

          .login-form-title { font-size: 24px !important; }
          .login-form-subtitle { font-size: 14px !important; }

          .login-input {
            padding-top: 15px !important;
            padding-bottom: 15px !important;
            font-size: 16px !important; /* evita zoom en iOS */
            border-radius: 12px !important;
          }

          .login-btn {
            padding-top: 16px !important;
            padding-bottom: 16px !important;
            font-size: 14px !important;
            border-radius: 12px !important;
          }

          .login-audit-note { display: none !important; }

          .login-footer { display: none !important; }

          .login-flow { display: none !important; }
        }
      `}</style>

      <BackgroundOrbs />

      {/* ── Header — oculto en mobile (logo va dentro del form) ── */}
      <header className="login-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '16px 32px', display: isMobile ? 'none' : 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="38" height="38" rx="10" fill="#04060f"/>
            <rect width="38" height="38" rx="10" fill="url(#logoGrad)" fillOpacity="0.12"/>
            <rect x="0.5" y="0.5" width="37" height="37" rx="9.5" stroke="url(#logoGrad)" strokeOpacity="0.4"/>
            <circle cx="10" cy="19" r="3" fill="#38bdf8"/>
            <circle cx="19" cy="11" r="3" fill="url(#logoGrad)"/>
            <circle cx="19" cy="27" r="3" fill="url(#logoGrad)"/>
            <circle cx="28" cy="19" r="3" fill="#38bdf8"/>
            <line x1="13" y1="19" x2="16" y2="13" stroke="#1d4ed8" strokeWidth="1.2" strokeOpacity="0.8"/>
            <line x1="13" y1="19" x2="16" y2="25" stroke="#1d4ed8" strokeWidth="1.2" strokeOpacity="0.8"/>
            <line x1="22" y1="13" x2="25" y2="18" stroke="#0891b2" strokeWidth="1.2" strokeOpacity="0.8"/>
            <line x1="22" y1="25" x2="25" y2="20" stroke="#0891b2" strokeWidth="1.2" strokeOpacity="0.8"/>
            <line x1="19" y1="14" x2="19" y2="24" stroke="rgba(56,189,248,0.25)" strokeWidth="1" strokeDasharray="2 2"/>
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1d4ed8"/><stop offset="1" stopColor="#0891b2"/>
              </linearGradient>
            </defs>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div className="login-header-logo-text" style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{ color: '#f8fafc', fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em' }}>Process</span>
              <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em', background: 'linear-gradient(90deg,#38bdf8,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OS</span>
            </div>
            <span className="login-header-sub" style={{ color: '#334155', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>by AICOUNTS CONSULTORES</span>
          </div>
        </div>
        <div className="login-header-status" style={{ alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e', animation: 'ping 2.5s ease-in-out infinite' }} />
          <span style={{ color: '#475569', fontSize: 11 }}>Sistema operativo</span>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="login-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? '0' : '40px 32px', position: 'relative', zIndex: 10, gap: 48 }}>

        {/* Contenido principal — dos columnas en desktop, una en móvil */}
        <div className="login-grid" style={{ width: '100%', maxWidth: isMobile ? '100%' : 1300, alignItems: 'center' }}>

          {/* ── LEFT ── */}
          <div className="login-left" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* Eyebrow pill */}
            <div style={{
              animation: 'textIn 0.6s ease both', animationDelay: '0.2s',
              display: 'inline-flex', alignItems: 'center', gap: 10,
              border: '1px solid rgba(56,189,248,0.25)', borderRadius: 100,
              padding: '8px 18px', width: 'fit-content',
              background: 'rgba(56,189,248,0.05)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 10px #38bdf8', animation: 'ping 2s ease-in-out infinite' }} />
              <span style={{ color: '#7dd3fc', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Consultoría Estratégica de Procesos
              </span>
            </div>

            {/* Headline */}
            <h1 style={{
              animation: 'textIn 0.7s ease both', animationDelay: '0.35s',
              fontSize: 'clamp(36px, 4vw, 60px)', fontWeight: 900, lineHeight: 1.07,
              color: '#f8fafc', letterSpacing: '-0.03em', margin: 0,
            }}>
              El estándar operativo<br />
              de las organizaciones<br />
              <span style={{ background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                que lideran.
              </span>
            </h1>

            <p style={{
              animation: 'textIn 0.7s ease both', animationDelay: '0.5s',
              color: '#94a3b8', fontSize: 16, lineHeight: 1.75, maxWidth: 480, margin: 0,
            }}>
              IA que convierte tu documentación operacional dispersa
              en procesos claros, medibles y listos para ejecutar.
            </p>

            {/* Diagrama de flujo — soporta el titular, no compite con él */}
            <div className="login-flow" style={{ animation: 'textIn 0.7s ease both', animationDelay: '0.6s' }}>
              <FlowDiagram />
            </div>

            {/* 2 capacidades — foco, no catálogo */}
            <div className="login-left-caps" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[
                { icon: '★', color: '#38bdf8', title: 'IA que documenta por ti.', desc: 'Sube tu documentación y en horas tienes el inventario completo de procesos, brechas y oportunidades de mejora.', delay: '0.75s' },
                { icon: '→', color: '#818cf8', title: 'De proceso a ROI, automáticamente.', desc: 'Cada proceso analizado entrega su impacto financiero, riesgos y KPIs proyectados — listos para aprobar e implementar.', delay: '0.9s' },
              ].map((item) => (
                <div key={item.title} style={{ display: 'flex', gap: 14, animation: 'textIn 0.6s ease both', animationDelay: item.delay }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${item.color}10`, border: `1px solid ${item.color}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: item.color, fontSize: 13, fontWeight: 800, marginTop: 2,
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <p style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, margin: '0 0 3px', letterSpacing: '-0.01em' }}>{item.title}</p>
                    <p style={{ color: '#64748b', fontSize: 12.5, lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <TrustBar />
          </div>

          {/* ── RIGHT — Formulario ── */}
          <div className="login-form-wrap" style={{ animation: 'textIn 0.8s ease both', animationDelay: '0.3s', width: isMobile ? '100%' : undefined }}>
            <div className="login-form-card" style={{
              background: isMobile ? 'transparent' : 'rgba(8,12,28,0.94)',
              border: isMobile ? 'none' : '1px solid rgba(255,255,255,0.14)',
              borderRadius: isMobile ? 0 : 20,
              padding: isMobile ? '52px 28px 48px' : '40px 36px',
              backdropFilter: isMobile ? 'none' : 'blur(20px)',
              boxShadow: isMobile ? 'none' : '0 24px 70px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.04)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Línea superior */}
              <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent)' }} />
              {/* Glow esquina */}
              <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(29,78,216,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

              {/* Flow diagram compacto — solo mobile */}
              {isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 32 }}>
                  {[
                    { label: 'Documento', sub: 'PDF/DOCX', color: '#38bdf8', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="#38bdf8" strokeWidth="1.3"/><path d="M10 2v3h3" stroke="#38bdf8" strokeWidth="1.3"/></svg> },
                    { label: 'IA', sub: 'Motor IA', color: '#818cf8', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="#818cf8" strokeWidth="1.3"/><path d="M8 2v1M8 13v1M2 8h1M13 8h1" stroke="#818cf8" strokeWidth="1.3" strokeLinecap="round"/></svg> },
                    { label: 'Proceso', sub: 'IA', color: '#a78bfa', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="#a78bfa" strokeWidth="1.3"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="#a78bfa" strokeWidth="1.3"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="#a78bfa" strokeWidth="1.3"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="#a78bfa" strokeWidth="1.3"/></svg> },
                    { label: 'Aprob.', sub: 'Digital', color: '#34d399', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#34d399" strokeWidth="1.3"/><path d="M5 8l2 2 4-4" stroke="#34d399" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                    { label: 'Implmta', sub: 'ERP/RPA', color: '#fb923c', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l2 4h4l-3.3 2.4 1.3 3.9L8 10l-3.9 2.3 1.3-3.9L2 6h4L8 2z" stroke="#fb923c" strokeWidth="1.3" strokeLinejoin="round"/></svg> },
                  ].map((step, i, arr) => (
                    <div key={step.label} style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 12,
                          border: `1px solid ${step.color}35`,
                          background: `${step.color}0d`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: `0 0 14px ${step.color}18`,
                          position: 'relative',
                        }}>
                          {step.icon}
                          <span style={{
                            position: 'absolute', top: -3, right: -3,
                            width: 7, height: 7, borderRadius: '50%',
                            background: step.color,
                            animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
                            animationDelay: `${i * 0.4}s`,
                          }} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ color: '#e2e8f0', fontSize: 9, fontWeight: 700, margin: 0, letterSpacing: '0.02em' }}>{step.label}</p>
                          <p style={{ color: '#334155', fontSize: 8, margin: '1px 0 0' }}>{step.sub}</p>
                        </div>
                      </div>
                      {i < arr.length - 1 && (
                        <div style={{ position: 'relative', width: 18, height: 2, margin: '0 2px', marginBottom: 22, background: `linear-gradient(90deg,${step.color}50,${arr[i+1].color}50)`, borderRadius: 1 }}>
                          <div style={{ position: 'absolute', top: -2, width: 5, height: 5, borderRadius: '50%', background: '#38bdf8', animation: 'travel 2s linear infinite', animationDelay: `${i * 0.4}s` }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Logo inline — solo mobile */}
              {isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                  <svg width="58" height="58" viewBox="0 0 38 38" fill="none">
                    <rect width="38" height="38" rx="10" fill="#04060f"/>
                    <rect width="38" height="38" rx="10" fill="url(#mLogoGrad)" fillOpacity="0.15"/>
                    <rect x="0.5" y="0.5" width="37" height="37" rx="9.5" stroke="url(#mLogoGrad)" strokeOpacity="0.5"/>
                    <circle cx="10" cy="19" r="3" fill="#38bdf8"/>
                    <circle cx="19" cy="11" r="3" fill="url(#mLogoGrad)"/>
                    <circle cx="19" cy="27" r="3" fill="url(#mLogoGrad)"/>
                    <circle cx="28" cy="19" r="3" fill="#38bdf8"/>
                    <line x1="13" y1="19" x2="16" y2="13" stroke="#1d4ed8" strokeWidth="1.2" strokeOpacity="0.8"/>
                    <line x1="13" y1="19" x2="16" y2="25" stroke="#1d4ed8" strokeWidth="1.2" strokeOpacity="0.8"/>
                    <line x1="22" y1="13" x2="25" y2="18" stroke="#0891b2" strokeWidth="1.2" strokeOpacity="0.8"/>
                    <line x1="22" y1="25" x2="25" y2="20" stroke="#0891b2" strokeWidth="1.2" strokeOpacity="0.8"/>
                    <defs>
                      <linearGradient id="mLogoGrad" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#1d4ed8"/><stop offset="1" stopColor="#0891b2"/>
                      </linearGradient>
                    </defs>
                  </svg>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <span style={{ color: '#f8fafc', fontWeight: 800, fontSize: 24, letterSpacing: '-0.03em' }}>Process</span>
                      <span style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.03em', background: 'linear-gradient(90deg,#38bdf8,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OS</span>
                    </div>
                    <span style={{ color: '#475569', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>by AICOUNTS CONSULTORES</span>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: isMobile ? 32 : 28 }}>
                <h2 className="login-form-title" style={{ color: '#f8fafc', fontSize: isMobile ? 28 : 19, fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>Acceso al portal</h2>
                <p className="login-form-subtitle" style={{ color: '#64748b', fontSize: isMobile ? 15 : 13, marginTop: 6, margin: '6px 0 0' }}>Ingresa tus credenciales corporativas</p>
              </div>

              {error && (
                <div style={{ marginBottom: 20, padding: '11px 14px', borderRadius: 10, background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: '#f87171', fontSize: 13, marginTop: 1 }}>⚠</span>
                  <span style={{ color: '#fca5a5', fontSize: 12, lineHeight: 1.5 }}>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>Correo corporativo</label>
                  <div style={{ position: 'relative' }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#475569' }}>
                      <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M1 6l7 4.5L15 6" stroke="currentColor" strokeWidth="1.4"/>
                    </svg>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="nombre@empresa.com"
                      className="login-input"
                      style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 40, paddingRight: 12, paddingTop: isMobile ? 16 : 11, paddingBottom: isMobile ? 16 : 11, borderRadius: isMobile ? 14 : 10, fontSize: isMobile ? 16 : 13.5, color: '#f8fafc', background: 'rgba(3,7,18,0.6)', border: '1px solid rgba(255,255,255,0.07)', outline: 'none', transition: 'border-color 0.15s' }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(56,189,248,0.45)' }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <label style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Contraseña</label>
                    <a href="#" style={{ color: '#475569', fontSize: 11, textDecoration: 'none' }}
                      onMouseEnter={e => ((e.target as HTMLElement).style.color = '#94a3b8')}
                      onMouseLeave={e => ((e.target as HTMLElement).style.color = '#475569')}
                    >¿Olvidaste?</a>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#475569' }}>
                      <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.4"/>
                    </svg>
                    <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="login-input"
                      style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 40, paddingRight: 44, paddingTop: isMobile ? 16 : 11, paddingBottom: isMobile ? 16 : 11, borderRadius: isMobile ? 14 : 10, fontSize: isMobile ? 16 : 13.5, color: '#f8fafc', background: 'rgba(3,7,18,0.6)', border: '1px solid rgba(255,255,255,0.07)', outline: 'none', transition: 'border-color 0.15s' }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(56,189,248,0.45)' }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}>
                      {showPassword
                        ? <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        : <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/></svg>
                      }
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ color: '#38bdf8', flexShrink: 0 }}>
                    <path d="M8 1L2 4v4c0 3.3 2.5 6.4 6 7 3.5-.6 6-3.7 6-7V4L8 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ color: '#38bdf8', fontSize: 11, fontWeight: 500 }}>Conexión cifrada de extremo a extremo</span>
                </div>

                <button type="submit" disabled={loading}
                  className="login-btn"
                  style={{ width: '100%', padding: isMobile ? '18px 0' : '13px 0', borderRadius: isMobile ? 14 : 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? '#1e293b' : 'linear-gradient(90deg, #1d4ed8, #0891b2)', color: '#fff', fontSize: isMobile ? 15 : 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: loading ? 0.7 : 1, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, position: 'relative', overflow: 'hidden', marginTop: isMobile ? 8 : 0 }}
                  onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(29,78,216,0.35)' } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
                >
                  {loading
                    ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>Verificando</>
                    : 'Ingresar al sistema'
                  }
                </button>
              </form>

            </div>
            {!isMobile && <p className="login-audit-note" style={{ textAlign: 'center', color: '#334155', fontSize: 11.5, marginTop: 18, lineHeight: 1.7 }}>
              ¿Problemas para ingresar? Contacta al administrador de tu organización.
            </p>}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      {!isMobile && <footer className="login-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.03)', padding: '14px 32px', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
        <span style={{ color: '#1e293b', fontSize: 11 }}>© 2026 AICOUNTS CONSULTORES. Todos los derechos reservados.</span>
        <div className="login-footer-links" style={{ display: 'flex', gap: 24 }}>
          {['Privacidad', 'EULA', 'Soporte'].map(link => (
            <a key={link} href="#" style={{ color: '#1e293b', fontSize: 11, textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => ((e.target as HTMLElement).style.color = '#475569')}
              onMouseLeave={e => ((e.target as HTMLElement).style.color = '#1e293b')}
            >{link}</a>
          ))}
        </div>
      </footer>}
    </div>
  )
}

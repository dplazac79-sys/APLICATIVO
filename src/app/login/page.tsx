'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const FASES = [
  {
    tag: 'Fases 1 & 2', color: 'text-cyan-400', weeks: 'Semanas 1–16',
    title: 'Fundación & Descubrimiento AI',
    desc: 'Ingesta documental automatizada, clasificación y primer inventario de procesos (Niveles 0–2).',
  },
  {
    tag: 'Fases 3 & 4', color: 'text-blue-400', weeks: 'Semanas 17–34',
    title: 'Artefactos & Gestión PMI',
    desc: 'Generación de los 12 artefactos metodológicos (SIPOC, RACI, BPMN) y control integral del proyecto.',
  },
  {
    tag: 'Fases 5 & 6', color: 'text-emerald-400', weeks: 'Semanas 35–54',
    title: 'Simulación & Automatización',
    desc: 'Cálculo de ROI operacional/financiero y diseño de automatizaciones mediante Knowledge Graphs.',
  },
]

const CAPABILITIES = [
  { icon: '🔍', color: 'bg-cyan-500/10 text-cyan-400', title: 'Process Discovery Integrado', desc: 'Mapeo y extracción automática de roles, riesgos y actividades desde texto desestructurado.' },
  { icon: '⚙️', color: 'bg-blue-500/10 text-blue-400', title: '12 Artefactos Dinámicos', desc: 'SIPOC, BPMN AS-IS/TO-BE interactivos, RACI y matrices completas de control de riesgos.' },
  { icon: '📈', color: 'bg-emerald-500/10 text-emerald-400', title: 'Simulación de Impacto ROI', desc: 'Modelado de escenarios (conservador, base, optimista) con recálculo dinámico de eficiencias.' },
  { icon: '🧠', color: 'bg-purple-500/10 text-purple-400', title: 'Knowledge Graph Corporativo', desc: 'Aprendizaje continuo cross-proyecto y recomendación de automatizaciones candidatas.' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'roadmap' | 'capabilities'>('roadmap')
  const router = useRouter()
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
    <div
      className="min-h-screen flex flex-col font-sans text-slate-100"
      style={{
        backgroundColor: '#030712',
        backgroundImage:
          'radial-gradient(circle at 0% 0%, rgba(15,23,42,0.9) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(6,182,212,0.08) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(59,130,246,0.04) 0%, transparent 60%)',
      }}
    >
      {/* Header */}
      <header className="w-full px-6 py-4 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg p-[1px] shadow-lg" style={{ background: 'linear-gradient(135deg, #3B82F6, #06B6D4)' }}>
            <div className="h-full w-full rounded-[7px] flex items-center justify-center" style={{ background: '#050B14' }}>
              <span className="font-extrabold text-xs tracking-wider" style={{ background: 'linear-gradient(90deg, #F8FAFC, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AP</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">APAC</span>
              <span className="text-[9px] px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full font-semibold uppercase tracking-wider">Platform</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">AICOUNTS Process Intelligence</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Región Sudamérica (v1.0)</span>
          </div>
          <span className="text-slate-700">|</span>
          <span>Enterprise Grade Security</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col lg:flex-row max-w-[1700px] w-full mx-auto px-4 py-8 md:px-8 lg:py-12 gap-10 items-center justify-center">

        {/* LEFT — Value Proposition */}
        <div className="w-full lg:w-3/5 flex flex-col justify-center gap-8 lg:pr-8">

          {/* Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full w-fit border border-cyan-500/20" style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.1), rgba(6,182,212,0.1))' }}>
            <span className="text-cyan-400 text-xs">✦</span>
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">Nivel Consultoría Estratégica</span>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              De la{' '}
              <span style={{ background: 'linear-gradient(90deg, #06B6D4, #3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Complejidad Documental
              </span>{' '}
              a la Optimización Operativa
            </h1>
            <p className="text-slate-400 text-base md:text-lg max-w-xl font-light leading-relaxed">
              Sintetice silos documentales masivos en arquitecturas de procesos interactivas y planes estructurados de hiperautomatización con precisión basada en datos.
            </p>
          </div>

          {/* Tabs panel */}
          <div className="rounded-2xl p-6 space-y-6" style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex border-b border-white/5 text-xs font-semibold gap-1">
              <button
                onClick={() => setTab('roadmap')}
                className={`pb-3 pr-4 border-b-2 transition-all ${tab === 'roadmap' ? 'border-cyan-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
              >
                📍 PLAN DE TRABAJO (6 FASES)
              </button>
              <button
                onClick={() => setTab('capabilities')}
                className={`pb-3 px-4 border-b-2 transition-all ${tab === 'capabilities' ? 'border-cyan-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
              >
                ⚡ ENGINE CAPABILITIES
              </button>
            </div>

            {tab === 'roadmap' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {FASES.map(f => (
                  <div key={f.tag} className="group p-4 rounded-xl transition-all" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)')}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${f.color}`}>{f.tag}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{f.weeks}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-200">{f.title}</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === 'capabilities' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CAPABILITIES.map(c => (
                  <div key={c.title} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className={`p-2 rounded text-sm shrink-0 ${c.color}`}>{c.icon}</div>
                    <div>
                      <h5 className="text-xs font-semibold text-white">{c.title}</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="flex flex-wrap gap-x-10 gap-y-4 pt-2">
            <div>
              <span className="block text-2xl font-bold text-white tracking-tight">100%</span>
              <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Objetivo & Medible</span>
            </div>
            <div className="border-l border-white/10 pl-6">
              <span className="block text-2xl font-bold text-cyan-400 tracking-tight">10 / 10</span>
              <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Módulos Operacionales</span>
            </div>
            <div className="border-l border-white/10 pl-6">
              <span className="block text-2xl font-bold text-blue-400 tracking-tight">&lt; 1 Día</span>
              <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Time-to-Value</span>
            </div>
          </div>
        </div>

        {/* RIGHT — Login */}
        <div className="w-full lg:w-2/5 max-w-[460px]">
          <div className="rounded-2xl p-8 shadow-2xl relative overflow-hidden" style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* Top glow line */}
            <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.4), transparent)' }} />

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white tracking-tight">Portal Ejecutivo</h2>
              <p className="text-xs text-slate-400 mt-1.5">Ingrese credenciales corporativas para acceder a APAC</p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
                <div>
                  <h4 className="text-xs font-semibold text-red-200">Error de Autenticación</h4>
                  <p className="text-[11px] text-red-300/80 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Correo Corporativo</label>
                  <span className="text-[10px] text-cyan-400 font-medium">Directorio Activo</span>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm">✉</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nombre.apellido@empresa.com"
                    className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                    style={{ background: 'rgba(3,7,18,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.5)'; e.target.style.boxShadow = '0 0 15px rgba(6,182,212,0.15)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Contraseña</label>
                  <a href="#" className="text-[10px] text-slate-400 hover:text-cyan-400 transition-colors">¿Olvidó su contraseña?</a>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm">🔒</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-3 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                    style={{ background: 'rgba(3,7,18,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.5)'; e.target.style.boxShadow = '0 0 15px rgba(6,182,212,0.15)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 text-sm">
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              {/* MFA tag */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-white/10 h-4 w-4 accent-cyan-400" />
                  <label className="text-xs text-slate-400 select-none">Recordar este dispositivo</label>
                </div>
                <div className="flex items-center text-[11px] text-slate-400 gap-1">
                  <span className="text-cyan-400">🛡</span> MFA Activo
                </div>
              </div>

              {/* CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full relative overflow-hidden rounded-xl p-[1px] transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(90deg, #3B82F6, #06B6D4, #3B82F6)' }}
              >
                <div className="px-8 py-3.5 rounded-[11px] flex justify-center items-center gap-2 transition-all"
                  style={{ background: loading ? 'transparent' : 'rgba(5,11,20,0.9)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'transparent')}
                  onMouseLeave={e => (e.currentTarget.style.background = loading ? 'transparent' : 'rgba(5,11,20,0.9)')}
                >
                  <span className="text-sm font-semibold text-white tracking-wide">
                    {loading ? 'AUTENTICANDO...' : 'INGRESAR AL SISTEMA'}
                  </span>
                  {!loading && <span className="text-cyan-400 text-xs">→</span>}
                </div>
              </button>
            </form>

            {/* Divider SSO */}
            <div className="relative my-7 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
              <span className="relative px-3 text-[10px] font-semibold text-slate-500 tracking-widest uppercase" style={{ background: 'rgba(15,23,42,0.9)' }}>Federated Login SSO</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '🪟', label: 'Azure AD' },
                { icon: '🔵', label: 'Google Workspace' },
              ].map(p => (
                <button key={p.label} className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-medium text-slate-300 transition-all hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.01)' }}
                >
                  <span>{p.icon}</span><span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="text-center mt-6">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              🔒 Acceso auditado bajo estándares de gobernanza y control RBAC.<br />
              Cada intento queda registrado en <span className="font-mono text-slate-400">audit_log</span>.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-6 py-4 flex flex-col md:flex-row justify-between items-center border-t border-white/5 text-[10px] text-slate-500 gap-2">
        <span>© 2026 AICOUNTS. Todos los derechos reservados.</span>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-white transition-colors">Políticas de Privacidad</a>
          <span>•</span>
          <a href="#" className="hover:text-white transition-colors">EULA</a>
          <span>•</span>
          <a href="#" className="hover:text-white transition-colors">Soporte Técnico</a>
        </div>
      </footer>
    </div>
  )
}

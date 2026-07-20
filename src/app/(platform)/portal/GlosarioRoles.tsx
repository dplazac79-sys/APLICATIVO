'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, Users, Sparkles, CheckCircle2, AlertTriangle, Plus, Trash2, ChevronDown, ChevronUp, RefreshCw, BookOpen, UserCheck, UserX, ArrowRightLeft } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface RolMapeo {
  rol_proceso: string
  descripcion_rol: string
  tipo: 'mapeo_directo' | 'equivalencia' | 'crear_cargo'
  persona_sugerida: string | null
  cargo_sugerido: string | null
  confianza: number
  justificacion: string
  skills_requeridos: string[]
  gap_detectado: string | null
  accion_recomendada: string
}

interface Analisis {
  id: string
  estado: 'generando' | 'completado' | 'error'
  mapeos: RolMapeo[] | null
  resumen_ejecutivo: string | null
  total_mapeados: number
  total_equivalencias: number
  total_crear_cargo: number
  created_at: string
}

interface Organigrama {
  id: string
  nombre_archivo: string
  estado: string
}

interface Persona {
  id: string
  nombre_persona: string
  cargo_actual: string
}

interface Props {
  proyectoId: string
  nombreProyecto: string
  // Roles extraídos de los procesos aprobados del proyecto
  rolesDetectados: Array<{ rol: string; descripcion: string; procesos: string[] }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TIPO_CONFIG = {
  mapeo_directo: { label: 'Asignación directa', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', Icon: UserCheck },
  equivalencia:  { label: 'Rol equivalente',    color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', Icon: ArrowRightLeft },
  crear_cargo:   { label: 'Crear cargo nuevo',  color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', Icon: UserX },
}

function ConfianzaBar({ value }: { value: number }) {
  // Sin clamp, un valor fuera de 0-100 (ej. la IA devuelve algo inesperado)
  // rompía visualmente la barra — ya se hacía bien en ConfianzaMeter
  // (src/components/discovery/ProcesoCard.tsx), acá faltaba. Hallazgo de
  // auditoría de correctitud de negocio.
  const clamped = Math.max(0, Math.min(100, value))
  const color = clamped >= 80 ? '#22c55e' : clamped >= 55 ? '#f59e0b' : '#f87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${clamped}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ color, fontSize: 11, fontWeight: 700, minWidth: 32 }}>{clamped}%</span>
    </div>
  )
}

function MapeoCard({ mapeo, index }: { mapeo: RolMapeo; index: number }) {
  const [open, setOpen] = useState(false)
  const cfg = TIPO_CONFIG[mapeo.tipo]
  const Icon = cfg.Icon

  return (
    <div style={{
      border: `1px solid ${cfg.border}`, borderRadius: 12,
      background: cfg.bg, overflow: 'hidden',
      animation: `fadeSlideUp 0.4s ease both`, animationDelay: `${index * 0.06}s`,
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <Icon size={16} style={{ color: cfg.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700 }}>{mapeo.rol_proceso}</span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: cfg.border, color: cfg.color, fontWeight: 600 }}>
              {cfg.label}
            </span>
          </div>
          {mapeo.persona_sugerida && (
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '2px 0 0' }}>
              → {mapeo.persona_sugerida} · {mapeo.cargo_sugerido}
            </p>
          )}
          {mapeo.tipo === 'crear_cargo' && (
            <p style={{ color: '#fca5a5', fontSize: 12, margin: '2px 0 0' }}>
              → Se recomienda crear este cargo
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <ConfianzaBar value={mapeo.confianza} />
          {open ? <ChevronUp size={14} style={{ color: '#475569' }} /> : <ChevronDown size={14} style={{ color: '#475569' }} />}
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${cfg.border}` }}>
          <p style={{ color: '#64748b', fontSize: 12, margin: '12px 0 8px', fontStyle: 'italic' }}>{mapeo.descripcion_rol}</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
              <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Justificación</p>
              <p style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.6, margin: 0 }}>{mapeo.justificacion}</p>
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
              <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Acción recomendada</p>
              <p style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.6, margin: 0 }}>{mapeo.accion_recomendada}</p>
            </div>
          </div>

          {mapeo.gap_detectado && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, display: 'flex', gap: 8 }}>
              <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
              <p style={{ color: '#fcd34d', fontSize: 12, lineHeight: 1.5, margin: 0 }}>{mapeo.gap_detectado}</p>
            </div>
          )}

          {mapeo.skills_requeridos?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Skills requeridos</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {mapeo.skills_requeridos.map(s => (
                  <span key={s} style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function GlosarioRoles({ proyectoId, nombreProyecto: _nombreProyecto, rolesDetectados }: Props) {
  const [step, setStep]                 = useState<'upload' | 'personas' | 'analizando' | 'resultado'>('upload')
  const [organigramas, setOrganigramas] = useState<Organigrama[]>([])
  const [orgSeleccionado, setOrgSeleccionado] = useState<string | null>(null)
  const [personas, setPersonas]         = useState<Persona[]>([])
  const [analisis, setAnalisis]         = useState<Analisis | null>(null)
  const [uploading, setUploading]       = useState(false)
  const [nuevaPersona, setNuevaPersona] = useState({ nombre: '', cargo: '', cv: '' })
  const [mostrarFormPersona, setMostrarFormPersona] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<NodeJS.Timeout>()

  // Cargar datos iniciales — las funciones no son useCallback, se recrean cada
  // render; incluirlas en deps haría que el efecto corriera en cada render.
  useEffect(() => {
    cargarOrganigramas()
    cargarPersonas()
    cargarUltimoAnalisis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  // Polling si hay análisis en curso
  useEffect(() => {
    if (analisis?.estado === 'generando') {
      pollRef.current = setInterval(cargarUltimoAnalisis, 5000)
    } else {
      clearInterval(pollRef.current)
      if (analisis?.estado === 'completado') setStep('resultado')
    }
    return () => clearInterval(pollRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analisis?.estado])

  async function cargarOrganigramas() {
    const r = await fetch(`/api/portal/organigrama?proyecto_id=${proyectoId}`)
    const d = await r.json()
    setOrganigramas(d.organigramas ?? [])
    if (d.organigramas?.length > 0) setOrgSeleccionado(d.organigramas[0].id)
  }

  async function cargarPersonas() {
    const r = await fetch(`/api/portal/cv-persona?proyecto_id=${proyectoId}`)
    const d = await r.json()
    setPersonas(d.personas ?? [])
  }

  async function cargarUltimoAnalisis() {
    const r = await fetch(`/api/portal/glosario-roles?proyecto_id=${proyectoId}`)
    const d = await r.json()
    if (d.analisis) {
      setAnalisis(d.analisis)
      if (d.analisis.estado === 'completado') setStep('resultado')
      else if (d.analisis.estado === 'generando') setStep('analizando')
    }
  }

  async function subirOrganigrama(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('proyecto_id', proyectoId)
    const r = await fetch('/api/portal/organigrama', { method: 'POST', body: fd })
    const d = await r.json()
    setUploading(false)
    if (!r.ok) { toast.error(d.error); return }
    toast.success('Organigrama cargado correctamente')
    await cargarOrganigramas()
    setOrgSeleccionado(d.organigrama.id)
    setStep('personas')
  }

  async function agregarPersona() {
    if (!nuevaPersona.nombre || !nuevaPersona.cargo) { toast.error('Nombre y cargo son requeridos'); return }
    const r = await fetch('/api/portal/cv-persona', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        proyecto_id: proyectoId,
        organigrama_id: orgSeleccionado,
        nombre_persona: nuevaPersona.nombre,
        cargo_actual: nuevaPersona.cargo,
        texto_cv: nuevaPersona.cv || null,
      }),
    })
    if (!r.ok) { toast.error('Error al agregar persona'); return }
    toast.success(`${nuevaPersona.nombre} agregado`)
    setNuevaPersona({ nombre: '', cargo: '', cv: '' })
    setMostrarFormPersona(false)
    await cargarPersonas()
  }

  async function eliminarPersona(id: string) {
    await fetch(`/api/portal/cv-persona?id=${id}`, { method: 'DELETE' })
    await cargarPersonas()
  }

  async function lanzarAnalisis() {
    if (!orgSeleccionado) { toast.error('Primero sube el organigrama'); return }

    const r = await fetch('/api/portal/glosario-roles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        proyecto_id: proyectoId,
        organigrama_id: orgSeleccionado,
        roles_en_procesos: rolesDetectados,
      }),
    })
    const d = await r.json()
    if (!r.ok) { toast.error(d.error); return }
    setStep('analizando')
    toast.success('Análisis iniciado — la IA está procesando')
    await cargarUltimoAnalisis()
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <BookOpen size={20} style={{ color: '#818cf8' }} />
            <h2 style={{ color: '#f8fafc', fontSize: 18, fontWeight: 700, margin: 0 }}>Glosario de Roles</h2>
          </div>
          <p style={{ color: '#475569', fontSize: 13, margin: 0, maxWidth: 520 }}>
            La IA analiza tu organigrama y recomienda quién en tu empresa debe asumir cada rol definido en los documentos de proceso.
          </p>
        </div>
        {analisis?.estado === 'completado' && (
          <button
            onClick={() => { setStep('upload'); setAnalisis(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: 12, cursor: 'pointer' }}
          >
            <RefreshCw size={12} /> Nuevo análisis
          </button>
        )}
      </div>

      {/* Stepper */}
      {step !== 'resultado' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28, overflowX: 'auto' }}>
          {[
            { id: 'upload',    label: '1. Organigrama' },
            { id: 'personas',  label: '2. Equipo (opcional)' },
            { id: 'analizando', label: '3. Análisis IA' },
          ].map((s, i) => {
            const done = (step === 'personas' && i === 0) || (step === 'analizando' && i < 2)
            const active = step === s.id
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: done ? 'rgba(34,197,94,0.1)' : active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  color: done ? '#22c55e' : active ? '#a5b4fc' : '#334155',
                  whiteSpace: 'nowrap',
                }}>
                  {done ? '✓ ' : ''}{s.label}
                </div>
                {i < 2 && <div style={{ width: 20, height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 4px' }} />}
              </div>
            )
          })}
        </div>
      )}

      {/* ── STEP 1: Upload organigrama ── */}
      {step === 'upload' && (
        <div style={{ animation: 'fadeSlideUp 0.4s ease both' }}>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#818cf8' }}
            onDragLeave={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)' }}
            onDrop={async e => {
              e.preventDefault()
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'
              const file = e.dataTransfer.files[0]
              if (file) await subirOrganigrama(file)
            }}
            style={{
              border: '2px dashed rgba(99,102,241,0.2)', borderRadius: 16,
              padding: '48px 32px', textAlign: 'center', cursor: 'pointer',
              background: 'rgba(99,102,241,0.03)', transition: 'border-color 0.2s',
            }}
          >
            <input
              ref={fileRef} type="file" hidden
              aria-label="Subir organigrama"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={async e => { const f = e.target.files?.[0]; if (f) await subirOrganigrama(f) }}
            />
            {uploading
              ? <RefreshCw size={32} style={{ color: '#818cf8', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              : <Upload size={32} style={{ color: '#818cf8', margin: '0 auto 12px', display: 'block' }} />
            }
            <p style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>
              {uploading ? 'Procesando organigrama...' : 'Sube el organigrama de tu empresa'}
            </p>
            <p style={{ color: '#475569', fontSize: 12, margin: 0 }}>PDF, imagen o Word · máx 10 MB</p>
          </div>

          {organigramas.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ color: '#475569', fontSize: 12, marginBottom: 10 }}>Organigramas previos:</p>
              {organigramas.map(o => (
                <div key={o.id}
                  onClick={() => { setOrgSeleccionado(o.id); setStep('personas') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1px solid ${orgSeleccionado === o.id ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, background: orgSeleccionado === o.id ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', marginBottom: 6 }}
                >
                  <CheckCircle2 size={14} style={{ color: '#22c55e' }} />
                  <span style={{ color: '#e2e8f0', fontSize: 13 }}>{o.nombre_archivo}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#334155' }}>{o.estado}</span>
                </div>
              ))}
              {orgSeleccionado && (
                <button
                  onClick={() => setStep('personas')}
                  style={{ marginTop: 12, width: '100%', padding: '11px', borderRadius: 10, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Continuar con organigrama seleccionado →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Personas / CVs ── */}
      {step === 'personas' && (
        <div style={{ animation: 'fadeSlideUp 0.4s ease both' }}>
          <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', marginBottom: 20, display: 'flex', gap: 10 }}>
            <Users size={15} style={{ color: '#38bdf8', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ color: '#7dd3fc', fontSize: 13, fontWeight: 600, margin: '0 0 3px' }}>Paso opcional — pero recomendado</p>
              <p style={{ color: '#475569', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                Agrega las personas clave de tu organigrama. Cuantos más datos proveas (cargo, experiencia, skills),
                más precisa será la recomendación de la IA.
              </p>
            </div>
          </div>

          {personas.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', marginBottom: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {p.nombre_persona[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, margin: 0 }}>{p.nombre_persona}</p>
                <p style={{ color: '#475569', fontSize: 12, margin: 0 }}>{p.cargo_actual}</p>
              </div>
              <button onClick={() => eliminarPersona(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {mostrarFormPersona ? (
            <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.04)', marginTop: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <input
                  aria-label="Nombre completo"
                  placeholder="Nombre completo *"
                  value={nuevaPersona.nombre}
                  onChange={e => setNuevaPersona(p => ({ ...p, nombre: e.target.value }))}
                  style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(3,7,18,0.6)', border: '1px solid rgba(255,255,255,0.07)', color: '#f8fafc', fontSize: 13, outline: 'none' }}
                />
                <input
                  aria-label="Cargo actual"
                  placeholder="Cargo actual *"
                  value={nuevaPersona.cargo}
                  onChange={e => setNuevaPersona(p => ({ ...p, cargo: e.target.value }))}
                  style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(3,7,18,0.6)', border: '1px solid rgba(255,255,255,0.07)', color: '#f8fafc', fontSize: 13, outline: 'none' }}
                />
              </div>
              <textarea
                aria-label="Skills, experiencia y formación"
                placeholder="Skills, experiencia y formación (opcional pero muy útil para el análisis)"
                value={nuevaPersona.cv}
                onChange={e => setNuevaPersona(p => ({ ...p, cv: e.target.value }))}
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, background: 'rgba(3,7,18,0.6)', border: '1px solid rgba(255,255,255,0.07)', color: '#f8fafc', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={agregarPersona} style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Agregar
                </button>
                <button onClick={() => setMostrarFormPersona(false)} style={{ padding: '9px 16px', borderRadius: 8, background: 'none', border: '1px solid rgba(255,255,255,0.06)', color: '#475569', fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setMostrarFormPersona(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: 'none', border: '1px dashed rgba(255,255,255,0.08)', color: '#475569', fontSize: 12, cursor: 'pointer', marginTop: 10, width: '100%', justifyContent: 'center' }}
            >
              <Plus size={13} /> Agregar persona del equipo
            </button>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              onClick={() => setStep('upload')}
              style={{ padding: '10px 20px', borderRadius: 10, background: 'none', border: '1px solid rgba(255,255,255,0.06)', color: '#475569', fontSize: 13, cursor: 'pointer' }}
            >
              ← Atrás
            </button>
            <button
              onClick={lanzarAnalisis}
              style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Sparkles size={14} /> Analizar con IA
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Analizando ── */}
      {step === 'analizando' && (
        <div style={{ textAlign: 'center', padding: '48px 0', animation: 'fadeSlideUp 0.4s ease both' }}>
          <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 20px' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(129,140,248,0.15)' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#818cf8', animation: 'spin 1s linear infinite' }} />
            <Sparkles size={24} style={{ color: '#818cf8', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
          </div>
          <h3 style={{ color: '#f8fafc', fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>La IA está analizando tu organigrama</h3>
          <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>
            Comparando roles del proceso con tu estructura organizacional y mejores prácticas de industria…
          </p>
          <p style={{ color: '#334155', fontSize: 12, marginTop: 8 }}>Esto puede tomar entre 30 y 90 segundos</p>
        </div>
      )}

      {/* ── STEP 4: Resultado ── */}
      {step === 'resultado' && analisis?.mapeos && (
        <div style={{ animation: 'fadeSlideUp 0.4s ease both' }}>

          {/* Score + métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Asignación directa', value: analisis.total_mapeados,    color: '#22c55e', desc: 'roles con responsable claro' },
              { label: 'Rol equivalente',    value: analisis.total_equivalencias, color: '#f59e0b', desc: 'requieren ajuste de cargo' },
              { label: 'Crear cargo nuevo',  value: analisis.total_crear_cargo,   color: '#f87171', desc: 'sin cobertura actual' },
            ].map(m => (
              <div key={m.label} style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                <div style={{ color: m.color, fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{m.value}</div>
                <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600, marginTop: 4 }}>{m.label}</div>
                <div style={{ color: '#334155', fontSize: 10, marginTop: 2 }}>{m.desc}</div>
              </div>
            ))}
          </div>

          {/* Resumen ejecutivo */}
          {analisis.resumen_ejecutivo && (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', marginBottom: 20 }}>
              <p style={{ color: '#a5b4fc', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Diagnóstico ejecutivo</p>
              <p style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{analisis.resumen_ejecutivo}</p>
            </div>
          )}

          {/* Leyenda del % de confianza — sin esto nadie entendía qué medía */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }}>
            <Sparkles size={12} style={{ color: '#64748b', flexShrink: 0 }} />
            <p style={{ color: '#64748b', fontSize: 11, lineHeight: 1.5, margin: 0 }}>
              El <strong style={{ color: '#94a3b8' }}>%</strong> junto a cada fila es la confianza de la IA en esa recomendación puntual — qué tan segura está de que ese cargo o esa persona corresponde al rol. No es un puntaje del organigrama completo, cada fila tiene el suyo.
            </p>
          </div>

          {/* Mapeos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {analisis.mapeos.map((m, i) => <MapeoCard key={i} mapeo={m} index={i} />)}
          </div>

          <p style={{ color: '#1e293b', fontSize: 11, textAlign: 'center', marginTop: 20 }}>
            Análisis generado el {new Date(analisis.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      )}
    </div>
  )
}

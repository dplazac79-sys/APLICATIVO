'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar, Users, Target, Layers, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Pencil, Save, X, FileText, Brain,
  Clock, ArrowRight, UserMinus, UserPlus, Loader2,
} from 'lucide-react'
import type { Fase } from '@/lib/fases'

const LABEL_ROL: Record<string, string> = {
  super_admin: 'Super Admin',
  director_proyecto: 'Director',
  consultor: 'Consultor',
  sponsor_cliente: 'Cliente Activo',
  usuario_cliente: 'Cliente Observador',
}

const ROL_COLOR: Record<string, string> = {
  super_admin: 'bg-red-900/30 text-red-300 border-red-800',
  director_proyecto: 'bg-indigo-900/30 text-indigo-300 border-indigo-800',
  consultor: 'bg-blue-900/30 text-blue-300 border-blue-800',
  sponsor_cliente: 'bg-emerald-900/30 text-emerald-300 border-emerald-800',
  usuario_cliente: 'bg-slate-800 text-slate-400 border-slate-700',
}

export interface Proyecto {
  id: string
  nombre: string
  descripcion?: string
  contexto?: string
  objetivos?: string
  alcance_incluye?: string
  alcance_excluye?: string
  n_procesos_estimados?: number
  fecha_inicio?: string
  fecha_estimada_cierre?: string
}

interface Stats {
  documentos: number
  procesos: number
  procesosAprobados: number
  artefactos: number
}

interface Props {
  proyecto: Proyecto
  cliente: { razon_social?: string; industria?: string } | null
  equipo: { usuario_id: string; nombre: string; rol: string }[]
  rol: string
  stats: Stats
  faseActual: Fase | null
}

function diasRestantes(cierre?: string) {
  if (!cierre) return null
  const diff = new Date(cierre).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function semanas(inicio?: string, cierre?: string) {
  if (!inicio || !cierre) return null
  return Math.round((new Date(cierre).getTime() - new Date(inicio).getTime()) / (1000 * 60 * 60 * 24 * 7))
}

function formatFecha(f?: string) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ResumenProyecto({ proyecto, cliente, equipo, rol, stats, faseActual }: Props) {
  const router = useRouter()
  const [expandido, setExpandido] = useState(true)
  const [quitando, setQuitando] = useState<string | null>(null)
  const [confirmandoQuitar, setConfirmandoQuitar] = useState<string | null>(null)
  const [errorQuitar, setErrorQuitar] = useState<string | null>(null)
  const [mostrarAgregar, setMostrarAgregar] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [errorAgregar, setErrorAgregar] = useState<string | null>(null)
  const [nuevoMiembro, setNuevoMiembro] = useState({ email: '', nombre: '', rol: 'consultor', password: '' })
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    contexto: proyecto.contexto ?? '',
    objetivos: proyecto.objetivos ?? '',
    alcance_incluye: proyecto.alcance_incluye ?? '',
    alcance_excluye: proyecto.alcance_excluye ?? '',
    n_procesos_estimados: proyecto.n_procesos_estimados?.toString() ?? '',
    fecha_inicio: proyecto.fecha_inicio?.slice(0, 10) ?? '',
    fecha_estimada_cierre: proyecto.fecha_estimada_cierre?.slice(0, 10) ?? '',
  })
  const [guardando, setGuardando] = useState(false)

  const puedeEditar = rol === 'super_admin'
  const sw = semanas(proyecto.fecha_inicio, proyecto.fecha_estimada_cierre)
  const dias = diasRestantes(proyecto.fecha_estimada_cierre)
  const pctProcesos = stats.procesos > 0 ? Math.round((stats.procesosAprobados / stats.procesos) * 100) : 0

  async function quitarDelEquipo(usuario_id: string) {
    setQuitando(usuario_id)
    setErrorQuitar(null)
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}/equipo`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErrorQuitar(data.error ?? 'No se pudo quitar del equipo'); return }
      setConfirmandoQuitar(null)
      router.refresh()
    } catch {
      setErrorQuitar('Error de red al quitar del equipo')
    } finally {
      setQuitando(null)
    }
  }

  async function agregarAlEquipo() {
    setAgregando(true)
    setErrorAgregar(null)
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}/equipo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoMiembro),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErrorAgregar(data.error ?? 'No se pudo agregar al equipo'); return }
      setMostrarAgregar(false)
      setNuevoMiembro({ email: '', nombre: '', rol: 'consultor', password: '' })
      router.refresh()
    } catch {
      setErrorAgregar('Error de red al agregar al equipo')
    } finally {
      setAgregando(false)
    }
  }

  async function guardar() {
    setGuardando(true)
    await fetch(`/api/proyectos/${proyecto.id}/brief`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contexto: form.contexto || null,
        objetivos: form.objetivos || null,
        alcance_incluye: form.alcance_incluye || null,
        alcance_excluye: form.alcance_excluye || null,
        n_procesos_estimados: form.n_procesos_estimados ? parseInt(form.n_procesos_estimados) : null,
        fecha_inicio: form.fecha_inicio || null,
        fecha_estimada_cierre: form.fecha_estimada_cierre || null,
      }),
    })
    setGuardando(false)
    setEditando(false)
    window.location.reload()
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
        onClick={() => setExpandido(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">{proyecto.nombre}</h2>
            <p className="text-slate-400 text-xs">{cliente?.razon_social} · {cliente?.industria}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {puedeEditar && !editando && (
            <button
              onClick={e => { e.stopPropagation(); setEditando(true); setExpandido(true) }}
              className="text-slate-400 hover:text-indigo-400 transition-colors p-1"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {expandido ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      {expandido && (
        <div className="border-t border-slate-800 space-y-0">

          {/* Fechas del proyecto — editable solo en modo edición */}
          {editando && (
            <div className="px-5 py-4 border-b border-slate-800 grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-1.5">Fecha de inicio</p>
                <input
                  type="date"
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-500"
                  value={form.fecha_inicio}
                  onChange={e => setForm(v => ({ ...v, fecha_inicio: e.target.value }))}
                />
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-1.5">Fecha estimada de cierre</p>
                <input
                  type="date"
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-500"
                  value={form.fecha_estimada_cierre}
                  onChange={e => setForm(v => ({ ...v, fecha_estimada_cierre: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* KPIs rápidos — siempre visibles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-800">
            {[
              {
                icon: <Calendar className="w-4 h-4 text-indigo-400" />,
                label: 'Inicio',
                value: formatFecha(proyecto.fecha_inicio),
                sub: sw ? `${sw} semanas de duración` : null,
              },
              {
                icon: <Clock className="w-4 h-4 text-violet-400" />,
                label: 'Cierre estimado',
                value: formatFecha(proyecto.fecha_estimada_cierre),
                sub: dias != null ? (dias > 0 ? `${dias} días restantes` : `Venció hace ${Math.abs(dias)} días`) : null,
                subColor: dias != null && dias < 30 ? 'text-amber-400' : 'text-slate-400',
              },
              {
                icon: <FileText className="w-4 h-4 text-cyan-400" />,
                label: 'Documentos',
                value: String(stats.documentos),
                sub: stats.documentos === 0 ? 'Sin documentos aún' : `${stats.documentos} archivo${stats.documentos !== 1 ? 's' : ''} cargado${stats.documentos !== 1 ? 's' : ''}`,
                subColor: stats.documentos === 0 ? 'text-amber-500' : 'text-slate-400',
                href: '/documentos',
              },
              {
                icon: <Brain className="w-4 h-4 text-emerald-400" />,
                label: 'Procesos',
                value: stats.procesos > 0 ? `${stats.procesosAprobados}/${stats.procesos}` : '0',
                sub: stats.procesos > 0 ? `${pctProcesos}% aprobados` : 'Sin procesos descubiertos',
                subColor: stats.procesos === 0 ? 'text-slate-400' : pctProcesos === 100 ? 'text-emerald-400' : 'text-slate-400',
                href: '/discovery',
              },
            ].map((kpi, i) => (
              <div key={i} className="px-4 py-3.5 space-y-1">
                <div className="flex items-center gap-1.5">
                  {kpi.icon}
                  <span className="text-xs text-slate-400 uppercase tracking-wide">{kpi.label}</span>
                </div>
                <p className="text-white font-semibold text-base">{kpi.value}</p>
                {kpi.sub && (
                  kpi.href ? (
                    <Link href={kpi.href} className={`text-xs ${kpi.subColor ?? 'text-slate-400'} hover:text-indigo-400 flex items-center gap-1`} onClick={e => e.stopPropagation()}>
                      {kpi.sub} <ArrowRight className="w-3 h-3" />
                    </Link>
                  ) : (
                    <p className={`text-xs ${kpi.subColor ?? 'text-slate-400'}`}>{kpi.sub}</p>
                  )
                )}
              </div>
            ))}
          </div>

          {/* Fase activa — indicador de solo lectura; la acción a tomar ya
              se muestra una sola vez, en la tarjeta "Qué te toca hacer
              ahora" que antecede a este resumen (antes este mismo botón
              "Continuar" se repetía acá y en un tercer banner ámbar más
              abajo, las tres apuntando al mismo lugar). */}
          {faseActual && (
            <div className="border-t border-slate-800 px-5 py-3 flex items-center gap-3 bg-indigo-950/20">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <span className="text-indigo-300 text-xs font-bold">F{faseActual.id}</span>
              </div>
              <p className="text-sm text-slate-300 min-w-0 truncate">
                <span className="text-slate-400">Fase activa:</span> {faseActual.nombre}
              </p>
              <div className="hidden sm:flex items-center gap-2 ml-auto shrink-0">
                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${faseActual.progreso}%` }} />
                </div>
                <span className="text-xs text-indigo-400">{faseActual.progreso}%</span>
              </div>
            </div>
          )}

          {/* Detalle expandible */}
          <div className="border-t border-slate-800 px-5 py-5 space-y-5">

            {/* Contexto */}
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Contexto del proyecto</p>
              {editando ? (
                <textarea
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-500"
                  rows={3}
                  placeholder="Describe el contexto, problemática y motivación del proyecto..."
                  value={form.contexto}
                  onChange={e => setForm(v => ({ ...v, contexto: e.target.value }))}
                />
              ) : (
                <p className="text-slate-300 text-sm leading-relaxed">
                  {proyecto.contexto || <span className="text-slate-400 italic">Sin contexto definido aún.</span>}
                </p>
              )}
            </div>

            {/* Objetivos */}
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Objetivos del proyecto</p>
              {editando ? (
                <textarea
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-500"
                  rows={3}
                  placeholder="Lista los objetivos principales, uno por línea..."
                  value={form.objetivos}
                  onChange={e => setForm(v => ({ ...v, objetivos: e.target.value }))}
                />
              ) : proyecto.objetivos ? (
                <ul className="space-y-1.5">
                  {proyecto.objetivos.split('\n').filter(Boolean).map((o, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 italic text-sm">Sin objetivos definidos aún.</p>
              )}
            </div>

            {/* Alcance */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-4">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <p className="text-emerald-300 text-xs font-medium uppercase tracking-wide">Incluye</p>
                </div>
                {editando ? (
                  <textarea
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-500"
                    rows={3}
                    placeholder="Qué está dentro del alcance..."
                    value={form.alcance_incluye}
                    onChange={e => setForm(v => ({ ...v, alcance_incluye: e.target.value }))}
                  />
                ) : proyecto.alcance_incluye ? (
                  <ul className="space-y-1.5">
                    {proyecto.alcance_incluye.split('\n').filter(Boolean).map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-emerald-400 shrink-0 mt-0.5">✓</span><span>{a}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400 italic text-sm">No definido.</p>
                )}
              </div>
              <div className="bg-rose-950/20 border border-rose-900/40 rounded-lg p-4">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <p className="text-rose-300 text-xs font-medium uppercase tracking-wide">Excluye</p>
                </div>
                {editando ? (
                  <textarea
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-500"
                    rows={3}
                    placeholder="Qué está fuera del alcance..."
                    value={form.alcance_excluye}
                    onChange={e => setForm(v => ({ ...v, alcance_excluye: e.target.value }))}
                  />
                ) : proyecto.alcance_excluye ? (
                  <ul className="space-y-1.5">
                    {proyecto.alcance_excluye.split('\n').filter(Boolean).map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-rose-400 shrink-0 mt-0.5">✗</span><span>{a}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400 italic text-sm">No definido.</p>
                )}
              </div>
            </div>

            {/* Nº procesos si editando */}
            {editando && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-1.5">Nº procesos estimados</p>
                <input
                  type="number"
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:border-indigo-500"
                  placeholder="Ej: 12"
                  value={form.n_procesos_estimados}
                  onChange={e => setForm(v => ({ ...v, n_procesos_estimados: e.target.value }))}
                />
              </div>
            )}

            {/* Equipo */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-slate-400" />
                <p className="text-slate-400 text-xs uppercase tracking-wide">Equipo asignado</p>
                <span className="text-xs text-slate-400">({equipo.length} persona{equipo.length !== 1 ? 's' : ''})</span>
                {puedeEditar && (
                  <button
                    onClick={() => { setMostrarAgregar(v => !v); setErrorAgregar(null) }}
                    className="ml-auto flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Agregar
                  </button>
                )}
              </div>

              {mostrarAgregar && (
                <div className="mb-3 p-3 rounded-lg border border-slate-700 bg-slate-800/60 space-y-2">
                  <p className="text-xs text-slate-400">Correo de la persona — si ya tiene cuenta en la plataforma, solo se vincula a este proyecto.</p>
                  <input
                    type="email"
                    placeholder="correo@empresa.cl"
                    value={nuevoMiembro.email}
                    onChange={e => setNuevoMiembro(v => ({ ...v, email: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nombre (solo si es cuenta nueva)"
                      value={nuevoMiembro.nombre}
                      onChange={e => setNuevoMiembro(v => ({ ...v, nombre: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500"
                    />
                    <select
                      value={nuevoMiembro.rol}
                      onChange={e => setNuevoMiembro(v => ({ ...v, rol: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
                    >
                      <option value="sponsor_cliente">Sponsor Cliente</option>
                      <option value="usuario_cliente">Cliente Observador</option>
                      <option value="consultor">Consultor</option>
                      <option value="director_proyecto">Director de Proyecto</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Contraseña temporal (solo si es cuenta nueva)"
                    value={nuevoMiembro.password}
                    onChange={e => setNuevoMiembro(v => ({ ...v, password: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500"
                  />
                  {errorAgregar && <p className="text-red-400 text-xs">{errorAgregar}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={agregarAlEquipo}
                      disabled={agregando || !nuevoMiembro.email.trim()}
                      className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded"
                    >
                      {agregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                      Agregar al proyecto
                    </button>
                    <button
                      onClick={() => setMostrarAgregar(false)}
                      className="text-slate-400 hover:text-slate-300 text-xs px-2"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {errorQuitar && <p className="text-red-400 text-xs mb-2">{errorQuitar}</p>}
              <div className="flex flex-wrap gap-2">
                {equipo.length === 0 ? (
                  <p className="text-slate-400 text-sm italic">Sin equipo asignado.</p>
                ) : equipo.map((m) => (
                  <div key={m.usuario_id} className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 ${ROL_COLOR[m.rol] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {m.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{m.nombre}</p>
                      <p className="text-xs opacity-70">{LABEL_ROL[m.rol] ?? m.rol}</p>
                    </div>
                    {puedeEditar && (
                      confirmandoQuitar === m.usuario_id ? (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => quitarDelEquipo(m.usuario_id)}
                            disabled={quitando === m.usuario_id}
                            title="Confirmar: quitar de este proyecto"
                            className="text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-50"
                          >
                            {quitando === m.usuario_id ? '...' : 'Sí, quitar'}
                          </button>
                          <button
                            onClick={() => setConfirmandoQuitar(null)}
                            className="opacity-60 hover:opacity-100 text-xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmandoQuitar(m.usuario_id)}
                          title="Quitar del equipo de este proyecto"
                          className="opacity-50 hover:opacity-100 hover:text-red-400 ml-1 shrink-0"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Artefactos generados */}
            {stats.artefactos > 0 && (
              <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-4 py-3">
                <Layers className="w-4 h-4 text-violet-400 shrink-0" />
                <p className="text-slate-300 text-sm flex-1">
                  <span className="text-white font-semibold">{stats.artefactos}</span> artefacto{stats.artefactos !== 1 ? 's' : ''} metodológico{stats.artefactos !== 1 ? 's' : ''} generado{stats.artefactos !== 1 ? 's' : ''}
                </p>
                <Link href="/artefactos" onClick={e => e.stopPropagation()} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                  Ver <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}

            {/* Botones */}
            {editando && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button
                  onClick={() => setEditando(false)}
                  className="flex items-center gap-2 border border-slate-700 text-slate-400 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" /> Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

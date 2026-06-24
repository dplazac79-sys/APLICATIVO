'use client'

import { useState } from 'react'
import { Calendar, Users, Target, Layers, ChevronDown, ChevronUp, CheckCircle, XCircle, Edit3, Save, X } from 'lucide-react'

const LABEL_ROL: Record<string, string> = {
  super_admin: 'Super Admin',
  director_proyecto: 'Director',
  consultor: 'Consultor',
  sponsor_cliente: 'Cliente Activo',
  usuario_cliente: 'Cliente Observador',
}

interface Proyecto {
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

interface Props {
  proyecto: Proyecto
  cliente: { razon_social?: string; industria?: string } | null
  equipo: { nombre: string; rol: string }[]
  rol: string
}

function semanas(inicio?: string, cierre?: string) {
  if (!inicio || !cierre) return null
  const diff = new Date(cierre).getTime() - new Date(inicio).getTime()
  return Math.round(diff / (1000 * 60 * 60 * 24 * 7))
}

function formatFecha(f?: string) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ResumenProyecto({ proyecto, cliente, equipo, rol }: Props) {
  const [expandido, setExpandido] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    contexto: proyecto.contexto ?? '',
    objetivos: proyecto.objetivos ?? '',
    alcance_incluye: proyecto.alcance_incluye ?? '',
    alcance_excluye: proyecto.alcance_excluye ?? '',
    n_procesos_estimados: proyecto.n_procesos_estimados?.toString() ?? '',
  })
  const [guardando, setGuardando] = useState(false)

  const puedeEditar = ['super_admin', 'director_proyecto', 'consultor'].includes(rol)
  const sw = semanas(proyecto.fecha_inicio, proyecto.fecha_estimada_cierre)

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
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center">
            <Target className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">Resumen del Proyecto</h2>
            <p className="text-slate-500 text-xs">{cliente?.razon_social} · {cliente?.industria}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {puedeEditar && !editando && (
            <button
              onClick={e => { e.stopPropagation(); setEditando(true); setExpandido(true) }}
              className="text-slate-500 hover:text-indigo-400 transition-colors p-1"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          {expandido ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      {expandido && (
        <div className="px-5 pb-5 space-y-5 border-t border-slate-800">

          {/* Métricas clave */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-500 text-xs uppercase tracking-wide">Inicio</span>
              </div>
              <p className="text-white text-sm font-medium">{formatFecha(proyecto.fecha_inicio)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-slate-500 text-xs uppercase tracking-wide">Cierre</span>
              </div>
              <p className="text-white text-sm font-medium">{formatFecha(proyecto.fecha_estimada_cierre)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-500 text-xs uppercase tracking-wide">Procesos</span>
              </div>
              <p className="text-white text-sm font-medium">
                {proyecto.n_procesos_estimados ? `${proyecto.n_procesos_estimados} estimados` : '—'}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-500 text-xs uppercase tracking-wide">Duración</span>
              </div>
              <p className="text-white text-sm font-medium">{sw ? `${sw} semanas` : '—'}</p>
            </div>
          </div>

          {/* Contexto */}
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1.5">Contexto del proyecto</p>
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
                {proyecto.contexto || <span className="text-slate-600 italic">Sin contexto definido aún.</span>}
              </p>
            )}
          </div>

          {/* Objetivos */}
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1.5">Objetivos del proyecto</p>
            {editando ? (
              <textarea
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-500"
                rows={3}
                placeholder="Lista los objetivos principales, uno por línea..."
                value={form.objetivos}
                onChange={e => setForm(v => ({ ...v, objetivos: e.target.value }))}
              />
            ) : proyecto.objetivos ? (
              <ul className="space-y-1">
                {proyecto.objetivos.split('\n').filter(Boolean).map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-indigo-400 mt-0.5">•</span>{o}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-600 italic text-sm">Sin objetivos definidos aún.</p>
            )}
          </div>

          {/* Alcance */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-slate-400 text-xs uppercase tracking-wide">Incluye</p>
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
                <ul className="space-y-1">
                  {proyecto.alcance_incluye.split('\n').filter(Boolean).map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-emerald-400 mt-0.5">✓</span>{a}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-600 italic text-sm">No definido.</p>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                <p className="text-slate-400 text-xs uppercase tracking-wide">Excluye</p>
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
                <ul className="space-y-1">
                  {proyecto.alcance_excluye.split('\n').filter(Boolean).map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-rose-400 mt-0.5">✗</span>{a}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-600 italic text-sm">No definido.</p>
              )}
            </div>
          </div>

          {/* Nº procesos si está editando */}
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
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Equipo asignado</p>
            <div className="flex flex-wrap gap-2">
              {equipo.map((m, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-600/30 flex items-center justify-center text-indigo-300 text-xs font-bold">
                    {m.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-xs font-medium">{m.nombre}</p>
                    <p className="text-slate-500 text-xs">{LABEL_ROL[m.rol] ?? m.rol}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Botones guardar/cancelar */}
          {editando && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={guardar}
                disabled={guardando}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {guardando ? 'Guardando...' : 'Guardar'}
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
      )}
    </div>
  )
}

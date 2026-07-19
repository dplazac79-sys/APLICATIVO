'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Lock, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'

type FaseItem = { label: string; done: boolean }
type Fase = {
  id: number
  nombre: string
  descripcion: string
  icono: string
  color: string
  href: string
  status: 'completada' | 'activa' | 'bloqueada'
  progreso: number
  items: FaseItem[]
}

const COLOR_MAP: Record<string, { ring: string; bar: string; badge: string; text: string; glow: string; activeBg: string }> = {
  emerald: { ring: 'border-emerald-500/50', bar: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300', text: 'text-emerald-400', glow: 'shadow-emerald-500/20', activeBg: 'bg-emerald-950/25' },
  blue:    { ring: 'border-blue-500/50',    bar: 'bg-blue-500',    badge: 'bg-blue-500/20 text-blue-300',    text: 'text-blue-400',    glow: 'shadow-blue-500/20',    activeBg: 'bg-blue-950/25' },
  violet:  { ring: 'border-violet-500/50',  bar: 'bg-violet-500',  badge: 'bg-violet-500/20 text-violet-300',  text: 'text-violet-400',  glow: 'shadow-violet-500/20',  activeBg: 'bg-violet-950/25' },
  amber:   { ring: 'border-amber-500/50',   bar: 'bg-amber-500',   badge: 'bg-amber-500/20 text-amber-300',   text: 'text-amber-400',   glow: 'shadow-amber-500/20',   activeBg: 'bg-amber-950/25' },
  cyan:    { ring: 'border-cyan-500/50',    bar: 'bg-cyan-500',    badge: 'bg-cyan-500/20 text-cyan-300',    text: 'text-cyan-400',    glow: 'shadow-cyan-500/20',    activeBg: 'bg-cyan-950/25' },
  teal:    { ring: 'border-teal-500/50',    bar: 'bg-teal-500',    badge: 'bg-teal-500/20 text-teal-300',    text: 'text-teal-400',    glow: 'shadow-teal-500/20',    activeBg: 'bg-teal-950/25' },
  indigo:  { ring: 'border-indigo-500/50',  bar: 'bg-indigo-500',  badge: 'bg-indigo-500/20 text-indigo-300',  text: 'text-indigo-400',  glow: 'shadow-indigo-500/20',  activeBg: 'bg-indigo-950/25' },
}

export default function FaseWorkflow({ fases, compact, hideProgressHeader }: { fases: Fase[]; compact?: boolean; hideProgressHeader?: boolean }) {
  const [expanded, setExpanded] = useState<number | null>(
    fases.find(f => f.status === 'activa')?.id ?? null
  )

  const totalFases = fases.length
  const completadas = fases.filter(f => f.status === 'completada').length
  const pct = Math.round((completadas / totalFases) * 100)

  return (
    <div className="space-y-4">
      {/* Barra de progreso global — omitida si la pantalla ya muestra este dato arriba */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        {!hideProgressHeader && (
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-white">Progreso del proyecto</p>
              <p className="text-xs text-slate-400 mt-0.5">{completadas} de {totalFases} fases completadas</p>
            </div>
            <span className="text-2xl font-bold text-white">{pct}%</span>
          </div>
        )}
        {!hideProgressHeader && (
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {/* Stepper horizontal — nodos conectados por fase, con icono, estado
            y glow en la activa. Reemplaza las barritas planas anteriores
            (que no comunicaban "flujo") por algo que se lee como un mapa de
            ruta: dónde ya pasó el proyecto, dónde está, qué falta. */}
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex items-start min-w-[560px]">
            {fases.map((f, idx) => {
              const c = COLOR_MAP[f.color]
              const bloqueada = f.status === 'bloqueada'
              const completada = f.status === 'completada'
              const activa = f.status === 'activa'
              return (
                <div key={f.id} className={`flex items-start ${idx < fases.length - 1 ? 'flex-1' : ''}`}>
                  <div className="flex flex-col items-center gap-1.5 w-16 shrink-0">
                    <div className={`relative w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm shrink-0 transition-all ${
                      completada ? `${c.bar} border-transparent text-white` :
                      activa ? `bg-slate-900 ${c.ring} shadow-lg ${c.glow}` :
                      'bg-slate-900 border-slate-700'
                    }`}>
                      {activa && (
                        <span className={`absolute inset-0 rounded-full ${c.bar} opacity-20 animate-ping`} />
                      )}
                      {completada ? <CheckCircle2 className="w-4 h-4" /> : bloqueada ? <Lock className="w-3.5 h-3.5 text-slate-600" /> : <span>{f.icono}</span>}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight ${
                      bloqueada ? 'text-slate-600' : activa ? c.text : 'text-slate-400'
                    }`}>
                      F{f.id}
                      <br />
                      <span className="line-clamp-1">{f.nombre}</span>
                    </span>
                  </div>
                  {idx < fases.length - 1 && (
                    <div className={`flex-1 h-0.5 mt-[18px] rounded-full transition-colors ${completada ? c.bar : 'bg-slate-800'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Fases — grid 3 columnas cuando hay 6 fases y no es compacto */}
      <div className={compact ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'}>
      {fases.map((fase, idx) => {
        const c = COLOR_MAP[fase.color]
        const isOpen = expanded === fase.id
        const bloqueada = fase.status === 'bloqueada'
        const completada = fase.status === 'completada'

        return (
          <div
            key={fase.id}
            className={`relative border rounded-xl transition-all duration-200 ${
              bloqueada
                ? 'border-slate-800 bg-slate-900/50 opacity-60'
                : completada
                ? `border-slate-700/60 bg-slate-900 ${isOpen ? `${c.ring} shadow-lg ${c.glow}` : ''}`
                : `${c.ring} ${c.activeBg} shadow-lg ${c.glow}`
            }`}
          >
            {/* Línea conectora solo en layout compacto (1 columna) */}
            {compact && idx < fases.length - 1 && (
              <div className="absolute left-7 -bottom-4 w-0.5 h-4 bg-slate-700 z-10" />
            )}

            <button
              onClick={() => !bloqueada && setExpanded(isOpen ? null : fase.id)}
              disabled={bloqueada}
              className="w-full text-left p-5 flex items-center gap-4"
            >
              {/* Icono / estado */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                bloqueada ? 'border-slate-700 bg-slate-800' :
                completada ? `border-slate-600 bg-slate-800` :
                `${c.ring} bg-slate-800`
              }`}>
                {bloqueada ? '🔒' : fase.icono}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400 font-mono">F{fase.id}</span>
                  <span className={`text-sm font-semibold ${bloqueada ? 'text-slate-400' : 'text-white'}`}>
                    {fase.nombre}
                  </span>
                  {completada && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Completada
                    </span>
                  )}
                  {fase.status === 'activa' && (
                    <span className={`text-xs ${c.badge} px-2 py-0.5 rounded-full`}>
                      En curso
                    </span>
                  )}
                  {bloqueada && (
                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Bloqueada
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{fase.descripcion}</p>

                {/* Mini progress bar */}
                {!bloqueada && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${c.bar} rounded-full transition-all duration-500`}
                        style={{ width: `${fase.progreso}%` }}
                      />
                    </div>
                    <span className={`text-xs ${c.text} shrink-0`}>{fase.progreso}%</span>
                  </div>
                )}
              </div>

              {!bloqueada && (
                <div className="shrink-0 text-slate-400">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              )}
            </button>

            {/* Detalle expandido */}
            {isOpen && !bloqueada && (
              <div className="px-5 pb-5 space-y-4">
                <div className={`h-px bg-slate-800`} />

                {/* Checklist */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {fase.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        item.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                      }`}>
                        {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-xs ${item.done ? 'text-slate-300' : 'text-slate-400'}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Link
                  href={fase.href}
                  className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg ${c.badge} border ${c.ring} hover:opacity-80 transition-opacity`}
                >
                  {completada ? 'Ver módulo' : 'Ir al módulo'} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}

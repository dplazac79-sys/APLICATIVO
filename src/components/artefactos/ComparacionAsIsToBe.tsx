'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ArrowLeftRight, Zap } from 'lucide-react'

interface Paso {
  orden?: number
  descripcion?: string
  responsable?: string
  automatizado?: boolean
}

interface Props {
  contenidoAsIs: Record<string, unknown>
  contenidoToBe: Record<string, unknown>
}

function Pill({ text, color }: { text: string; color: 'blue' | 'emerald' | 'purple' }) {
  const styles = {
    blue: 'bg-blue-950/40 text-blue-300 border-blue-800/40',
    emerald: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40',
    purple: 'bg-purple-950/40 text-purple-300 border-purple-800/40',
  }
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border ${styles[color]}`}>{text}</span>
}

export default function ComparacionAsIsToBe({ contenidoAsIs, contenidoToBe }: Props) {
  const [abierto, setAbierto] = useState(false)

  const pasosAsIs = (contenidoAsIs.pasos as Paso[]) ?? []
  const pasosToBe = (contenidoToBe.pasos as Paso[]) ?? []
  const actoresAsIs = (contenidoAsIs.actores as string[]) ?? []
  const actoresToBe = (contenidoToBe.actores as string[]) ?? []
  const sistemasAsIs = (contenidoAsIs.sistemas_involucrados as string[]) ?? []
  const sistemasToBe = (contenidoToBe.sistemas_requeridos as string[]) ?? []
  const mejoras = (contenidoToBe.mejoras_respecto_asis as string[]) ?? []
  const maxPasos = Math.max(pasosAsIs.length, pasosToBe.length)

  return (
    <div className="rounded-2xl border border-indigo-800/30 bg-slate-900/60 overflow-hidden">
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-indigo-300">
          <ArrowLeftRight className="w-4 h-4" /> Comparar AS-IS vs TO-BE
        </span>
        {abierto ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {abierto && (
        <div className="px-4 pb-5 space-y-5 border-t border-slate-800">
          {/* Actores + sistemas lado a lado */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Hoy (AS-IS)</p>
              <div className="flex flex-wrap gap-1">{actoresAsIs.map((a, i) => <Pill key={i} text={a} color="blue" />)}</div>
              <div className="flex flex-wrap gap-1">{sistemasAsIs.map((s, i) => <Pill key={i} text={s} color="purple" />)}</div>
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-widest">Futuro (TO-BE)</p>
              <div className="flex flex-wrap gap-1">{actoresToBe.map((a, i) => <Pill key={i} text={a} color="emerald" />)}</div>
              <div className="flex flex-wrap gap-1">{sistemasToBe.map((s, i) => <Pill key={i} text={s} color="purple" />)}</div>
            </div>
          </div>

          {/* Pasos lado a lado, alineados por índice */}
          {maxPasos > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Pasos del proceso</p>
              <div className="space-y-1.5">
                {Array.from({ length: maxPasos }).map((_, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-800/50 rounded-lg p-2.5 text-xs text-slate-300">
                      {pasosAsIs[i]?.descripcion ?? <span className="text-slate-400 italic">—</span>}
                    </div>
                    <div className={`rounded-lg p-2.5 text-xs text-slate-300 ${pasosToBe[i]?.automatizado ? 'bg-emerald-950/30 border border-emerald-800/30' : 'bg-slate-800/50'}`}>
                      {pasosToBe[i]?.descripcion
                        ? <>{pasosToBe[i].descripcion}{pasosToBe[i].automatizado && <span className="text-emerald-400 font-medium ml-1.5"><Zap className="w-3 h-3 inline" /></span>}</>
                        : <span className="text-slate-400 italic">—</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mejoras — ya viene redactado por la IA en el TO-BE */}
          {mejoras.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-widest mb-2">Qué mejora</p>
              <ul className="space-y-1">
                {mejoras.map((m, i) => (
                  <li key={i} className="text-slate-300 text-sm flex gap-2">
                    <span className="text-emerald-500 shrink-0">✓</span>{m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

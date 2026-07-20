'use client'

import { useState } from 'react'
import { Star, CheckCircle2 } from 'lucide-react'
import type { EncuestaFeedback } from '@/types/database'

interface Props {
  artefactoId: string
  proyectoId: string
  encuestaExistente?: EncuestaFeedback | null
  promedio?: number
  totalRespuestas?: number
}

export default function EncuestaFeedbackComponent({
  artefactoId,
  proyectoId,
  encuestaExistente,
  promedio,
  totalRespuestas = 0,
}: Props) {
  const [puntuacion, setPuntuacion] = useState<number>(encuestaExistente?.puntuacion ?? 0)
  const [hover, setHover] = useState(0)
  const [comentario, setComentario] = useState(encuestaExistente?.comentario ?? '')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(!!encuestaExistente)
  const [error, setError] = useState('')

  const etiquetas = ['', 'Deficiente', 'Regular', 'Bueno', 'Muy bueno', 'Excelente']

  async function enviar() {
    if (puntuacion === 0) { setError('Selecciona una puntuación.'); return }
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/encuestas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artefacto_id: artefactoId, proyecto_id: proyectoId, puntuacion, comentario }),
      })
      if (!res.ok) throw new Error(await res.text())
      setEnviado(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar')
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-3 flex items-center gap-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <div>
          <p className="text-emerald-300 text-sm font-medium">Feedback enviado</p>
          {promedio !== undefined && totalRespuestas > 0 && (
            <p className="text-slate-400 text-xs mt-0.5">
              Promedio del equipo: <span className="text-amber-400">{promedio.toFixed(1)}/5</span> ({totalRespuestas} respuesta{totalRespuestas !== 1 ? 's' : ''})
            </p>
          )}
        </div>
        <button
          onClick={() => setEnviado(false)}
          className="ml-auto text-slate-400 hover:text-slate-300 text-xs transition-colors"
        >
          Editar
        </button>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 space-y-3">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">¿Qué tan útil es este artefacto?</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setPuntuacion(n)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`w-6 h-6 transition-colors ${
                n <= (hover || puntuacion)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-400'
              }`}
            />
          </button>
        ))}
        {(hover || puntuacion) > 0 && (
          <span className="text-amber-400 text-sm ml-2">{etiquetas[hover || puntuacion]}</span>
        )}
      </div>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="Comentario opcional..."
        aria-label="Comentario opcional"
        rows={2}
        className="w-full bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-600 p-2 resize-none focus:outline-none focus:border-slate-500"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={enviar}
        disabled={enviando || puntuacion === 0}
        className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
      >
        {enviando ? 'Enviando...' : 'Enviar feedback'}
      </button>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface Props {
  token: string
  firmaId: string
  firmante_nombre: string
  firmante_cargo: string
}

export default function FirmaForm({ token, firmaId, firmante_nombre, firmante_cargo }: Props) {
  const [nombre, setNombre] = useState(firmante_nombre)
  const [cargo, setCargo] = useState(firmante_cargo)
  const [accion, setAccion] = useState<'firmar' | 'rechazar' | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [completado, setCompletado] = useState(false)
  const [error, setError] = useState('')

  async function confirmar(tipo: 'firmar' | 'rechazar') {
    if (tipo === 'firmar' && !nombre.trim()) {
      setError('Ingresa tu nombre completo.')
      return
    }
    setEnviando(true)
    setError('')
    try {
      const res = await fetch(`/api/firmas/${firmaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: tipo,
          firmante_nombre: nombre,
          firmante_cargo: cargo,
          token,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setCompletado(true)
      setAccion(tipo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar')
    } finally {
      setEnviando(false)
    }
  }

  if (completado) {
    return (
      <div className="text-center space-y-3 py-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
        <p className="text-white font-medium">
          {accion === 'firmar' ? 'Documento firmado exitosamente' : 'Solicitud rechazada'}
        </p>
        {accion === 'firmar' && (
          <p className="text-slate-400 text-sm">
            Firmado por <span className="text-white">{nombre}</span>
            {cargo ? `, ${cargo}` : ''} — {new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="firma-nombre" className="text-slate-400 text-xs">Nombre completo del firmante *</label>
        <input
          id="firma-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ingresa tu nombre completo"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-500"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="firma-cargo" className="text-slate-400 text-xs">Cargo / Rol</label>
        <input
          id="firma-cargo"
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          placeholder="Tu cargo en la organización"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-500"
        />
      </div>

      <div className="bg-slate-800/60 rounded-lg p-3 text-xs text-slate-400 leading-relaxed">
        Al hacer clic en <strong className="text-slate-200">Firmar</strong>, confirmo que he revisado el documento
        y otorgo mi conformidad de manera digital. Esta acción queda registrada con fecha, hora e IP de conexión.
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => confirmar('rechazar')}
          disabled={enviando}
          className="py-2.5 border border-red-700/60 text-red-400 hover:bg-red-950/30 disabled:opacity-50 text-sm rounded-lg transition-colors"
        >
          Rechazar
        </button>
        <button
          onClick={() => confirmar('firmar')}
          disabled={enviando || !nombre.trim()}
          className="py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
        >
          {enviando ? 'Procesando...' : 'Firmar documento'}
        </button>
      </div>
    </div>
  )
}

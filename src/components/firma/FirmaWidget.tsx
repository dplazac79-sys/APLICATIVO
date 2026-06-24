'use client'

import { useState } from 'react'
import { FileSignature, Copy, CheckCircle, Clock, XCircle } from 'lucide-react'
import type { FirmaSolicitud } from '@/types/database'

interface Props {
  proyectoId: string
  artefactoId?: string
  firmas: FirmaSolicitud[]
  onCrear?: (firma: FirmaSolicitud) => void
}

export default function FirmaWidget({ proyectoId, artefactoId, firmas, onCrear }: Props) {
  const [creando, setCreando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [firmante, setFirmante] = useState('')
  const [cargo, setCargo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [error, setError] = useState('')

  const estadoIcon = {
    pendiente: <Clock className="w-4 h-4 text-amber-400" />,
    firmado: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    rechazado: <XCircle className="w-4 h-4 text-red-400" />,
    expirado: <XCircle className="w-4 h-4 text-slate-500" />,
  }
  const estadoLabel = {
    pendiente: 'Pendiente',
    firmado: 'Firmado',
    rechazado: 'Rechazado',
    expirado: 'Expirado',
  }

  async function crearSolicitud() {
    if (!titulo.trim()) { setError('El título es requerido'); return }
    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/firmas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          artefacto_id: artefactoId ?? null,
          titulo,
          descripcion,
          firmante_nombre: firmante,
          firmante_cargo: cargo,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      onCrear?.(data)
      setCreando(false)
      setTitulo('')
      setDescripcion('')
      setFirmante('')
      setCargo('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear solicitud')
    } finally {
      setGuardando(false)
    }
  }

  async function copiarLink(token: string) {
    const url = `${window.location.origin}/firma/${token}`
    await navigator.clipboard.writeText(url)
    setCopiado(token)
    setTimeout(() => setCopiado(null), 2000)
  }

  return (
    <div className="space-y-3">
      {firmas.map((f) => (
        <div key={f.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2">
            {estadoIcon[f.estado]}
            <div className="flex-1">
              <p className="text-slate-200 text-sm font-medium">{f.titulo}</p>
              {f.descripcion ? <p className="text-slate-500 text-xs mt-0.5">{f.descripcion}</p> : null}
              <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1">
                <span>{estadoLabel[f.estado]}</span>
                {f.firmante_nombre ? <span>· {f.firmante_nombre}{f.firmante_cargo ? `, ${f.firmante_cargo}` : ''}</span> : null}
                {f.firmado_at ? <span>· {new Date(f.firmado_at).toLocaleDateString('es-CL')}</span> : null}
                {f.estado === 'pendiente' ? (
                  <span>· Expira: {new Date(f.expira_at).toLocaleDateString('es-CL')}</span>
                ) : null}
              </div>
            </div>
          </div>
          {f.estado === 'pendiente' && (
            <button
              onClick={() => copiarLink(f.token)}
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {copiado === f.token ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiado === f.token ? 'Enlace copiado' : 'Copiar enlace de firma'}
            </button>
          )}
        </div>
      ))}

      {!creando ? (
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <FileSignature className="w-4 h-4" />
          Solicitar firma digital
        </button>
      ) : (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 space-y-2">
          <p className="text-slate-300 text-sm font-medium">Nueva solicitud de firma</p>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título del documento a firmar *"
            className="w-full bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-600 px-2.5 py-1.5 focus:outline-none focus:border-slate-500"
          />
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción (opcional)"
            className="w-full bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-600 px-2.5 py-1.5 focus:outline-none focus:border-slate-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={firmante}
              onChange={(e) => setFirmante(e.target.value)}
              placeholder="Nombre del firmante"
              className="bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-600 px-2.5 py-1.5 focus:outline-none focus:border-slate-500"
            />
            <input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Cargo del firmante"
              className="bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-600 px-2.5 py-1.5 focus:outline-none focus:border-slate-500"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={crearSolicitud}
              disabled={guardando}
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
            >
              {guardando ? 'Creando...' : 'Crear solicitud'}
            </button>
            <button
              onClick={() => { setCreando(false); setError('') }}
              className="px-3 py-1.5 border border-slate-700 text-slate-400 hover:text-slate-200 text-sm rounded transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

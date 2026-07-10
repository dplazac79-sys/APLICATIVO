'use client'

import { useState } from 'react'
import { ShieldOff } from 'lucide-react'

export default function MfaCleanupButton() {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  async function limpiar() {
    setLoading(true)
    setResultado(null)
    try {
      const res = await fetch('/api/auth/mfa-cleanup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setResultado(data.error ?? 'Error al limpiar MFA')
      } else if (data.factoresRemovidos === 0) {
        setResultado('No había factores MFA activos. Todo limpio.')
      } else {
        setResultado(`Se removieron ${data.factoresRemovidos} factor(es) de ${data.usuariosAfectados} cuenta(s).`)
      }
    } catch {
      setResultado('Error de red al intentar la limpieza.')
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={limpiar}
        disabled={loading}
        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
      >
        <ShieldOff className="w-3.5 h-3.5" />
        {loading ? 'Limpiando…' : 'Desactivar MFA en todas las cuentas'}
      </button>
      {resultado && <span className="text-xs text-slate-500">{resultado}</span>}
    </div>
  )
}

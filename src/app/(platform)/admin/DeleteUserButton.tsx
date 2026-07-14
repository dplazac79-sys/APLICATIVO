'use client'

import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function DeleteUserButton({ usuarioId, nombre }: { usuarioId: string; nombre: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function eliminar() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/usuarios/${usuarioId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setLoading(false)
    }
  }

  if (confirmando) {
    return (
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red-400">{error}</span>}
        <span className="text-xs text-slate-400">¿Eliminar a {nombre}?</span>
        <button
          onClick={eliminar}
          disabled={loading}
          className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
        >
          {loading ? 'Eliminando…' : 'Sí, eliminar'}
        </button>
        <button
          onClick={() => { setConfirmando(false); setError('') }}
          disabled={loading}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirmando(true)}
      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-slate-700 text-slate-500 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition-colors"
    >
      <Trash2 className="w-3 h-3" /> Eliminar
    </button>
  )
}

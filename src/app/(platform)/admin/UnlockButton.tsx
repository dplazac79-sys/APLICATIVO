'use client'

import { useState } from 'react'
import { LockOpen } from 'lucide-react'

export default function UnlockButton({ usuarioId, locked }: { usuarioId: string; locked: boolean }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!locked && !done) return null

  async function desbloquear() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/desbloquear', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: usuarioId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'No se pudo desbloquear')
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return <span className="text-xs text-emerald-400 flex items-center gap-1"><LockOpen className="w-3 h-3" /> Desbloqueado</span>
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={desbloquear}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
      >
        <LockOpen className="w-3 h-3" />
        {loading ? 'Desbloqueando…' : 'Desbloquear'}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

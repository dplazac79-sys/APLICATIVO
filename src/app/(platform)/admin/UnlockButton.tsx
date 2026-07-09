'use client'

import { useState } from 'react'
import { LockOpen } from 'lucide-react'

export default function UnlockButton({ usuarioId, locked }: { usuarioId: string; locked: boolean }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!locked && !done) return null

  async function desbloquear() {
    setLoading(true)
    await fetch('/api/auth/desbloquear', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: usuarioId }),
    })
    setDone(true)
    setLoading(false)
  }

  if (done) {
    return <span className="text-xs text-emerald-400 flex items-center gap-1"><LockOpen className="w-3 h-3" /> Desbloqueado</span>
  }

  return (
    <button
      onClick={desbloquear}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
    >
      <LockOpen className="w-3 h-3" />
      {loading ? 'Desbloqueando…' : 'Desbloquear'}
    </button>
  )
}

'use client'

import { useState } from 'react'
import { Shield, ShieldOff } from 'lucide-react'

export default function MfaToggle({ usuarioId, habilitado }: { usuarioId: string; habilitado: boolean }) {
  const [activo, setActivo] = useState(habilitado)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const res = await fetch(`/api/admin/usuarios/${usuarioId}/mfa`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfa_habilitado: !activo }),
    })
    if (res.ok) setActivo(v => !v)
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={activo ? 'MFA activado — click para desactivar' : 'MFA desactivado — click para activar'}
      className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors ${
        activo
          ? 'border-emerald-800 bg-emerald-950/40 text-emerald-400 hover:bg-red-950/40 hover:text-red-400 hover:border-red-800'
          : 'border-slate-700 bg-slate-800 text-slate-500 hover:bg-emerald-950/40 hover:text-emerald-400 hover:border-emerald-800'
      } disabled:opacity-50`}
    >
      {activo ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
      MFA
    </button>
  )
}

'use client'

import { useState } from 'react'
import { Users, BrainCircuit } from 'lucide-react'

interface Props {
  procesosContent: React.ReactNode
  glosarioContent: React.ReactNode
}

export default function DiscoveryTabsWrapper({ procesosContent, glosarioContent }: Props) {
  const [tab, setTab] = useState<'procesos' | 'glosario'>('procesos')

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('procesos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'procesos'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <BrainCircuit className="w-4 h-4" />
          Procesos Descubiertos
        </button>
        <button
          onClick={() => setTab('glosario')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'glosario'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Glosario de Roles
        </button>
      </div>

      {/* Content */}
      <div className={tab === 'procesos' ? '' : 'hidden'}>
        {procesosContent}
      </div>
      <div className={tab === 'glosario' ? '' : 'hidden'}>
        {glosarioContent}
      </div>
    </div>
  )
}

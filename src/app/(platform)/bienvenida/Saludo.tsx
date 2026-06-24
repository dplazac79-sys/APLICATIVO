'use client'

import { useMemo } from 'react'

export default function Saludo({ nombre }: { nombre: string }) {
  const saludo = useMemo(() => {
    const hora = new Date().getHours()
    return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  }, [])

  return (
    <h1 className="text-3xl md:text-4xl font-bold text-white">
      {saludo},{' '}
      <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
        {nombre}
      </span>
    </h1>
  )
}

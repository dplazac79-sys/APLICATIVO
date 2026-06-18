import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { KgNodo, KgRelacionExpandida } from '@/lib/automation/tipos'

// GET /api/kg/grafo?industria=X
// Devuelve el grafo relacional (nodos + relaciones con nombres de extremos) de una industria.
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const industria = new URL(req.url).searchParams.get('industria')
  if (!industria) {
    return NextResponse.json({ error: 'industria requerida' }, { status: 400 })
  }

  // Nodos de la industria
  const { data: nodosRaw, error: nodosErr } = await supabase
    .from('kg_nodo')
    .select('id, industria, tipo, nombre, metadata, frecuencia')
    .eq('industria', industria)
    .order('frecuencia', { ascending: false })

  if (nodosErr) {
    return NextResponse.json({ error: nodosErr.message }, { status: 500 })
  }

  const nodos = (nodosRaw ?? []) as KgNodo[]
  const nodoIds = nodos.map(n => n.id)

  let relaciones: KgRelacionExpandida[] = []
  if (nodoIds.length > 0) {
    // Join con los nodos origen y destino para incluir sus nombres/tipos.
    const { data: relRaw, error: relErr } = await supabase
      .from('kg_relacion')
      .select(`
        id, nodo_origen, nodo_destino, tipo_relacion, peso,
        origen:nodo_origen(nombre, tipo),
        destino:nodo_destino(nombre, tipo)
      `)
      .in('nodo_origen', nodoIds)

    if (relErr) {
      return NextResponse.json({ error: relErr.message }, { status: 500 })
    }

    relaciones = (relRaw ?? []).map(r => {
      const origen = r.origen as unknown as { nombre: string; tipo: KgNodo['tipo'] } | null
      const destino = r.destino as unknown as { nombre: string; tipo: KgNodo['tipo'] } | null
      return {
        id: r.id,
        nodo_origen: r.nodo_origen,
        nodo_destino: r.nodo_destino,
        tipo_relacion: r.tipo_relacion,
        peso: r.peso,
        origen_nombre: origen?.nombre ?? '',
        origen_tipo: origen?.tipo ?? 'proceso',
        destino_nombre: destino?.nombre ?? '',
        destino_tipo: destino?.tipo ?? 'proceso',
      } as KgRelacionExpandida
    })
  }

  return NextResponse.json({ nodos, relaciones })
}

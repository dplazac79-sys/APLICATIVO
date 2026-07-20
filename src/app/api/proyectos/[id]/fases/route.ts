import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFasesProyecto } from '@/lib/fases'
import { assertProyectoAccess } from '@/lib/auth/tenant'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (!(await assertProyectoAccess(user.id, params.id))) {
    return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 })
  }

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()

  const { proyecto, fases } = await getFasesProyecto(params.id, usuario?.rol)
  return NextResponse.json({ proyecto, fases })
}

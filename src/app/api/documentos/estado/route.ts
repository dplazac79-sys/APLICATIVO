import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const proyecto_id = req.nextUrl.searchParams.get('proyecto_id')
  const ids = req.nextUrl.searchParams.get('ids')?.split(',').filter(Boolean)

  if (!proyecto_id) return NextResponse.json({ error: 'Falta proyecto_id' }, { status: 400 })

  const admin = createAdminClient()
  let query = admin.from('documento')
    .select('id, nombre_archivo, estado_procesamiento')
    .eq('proyecto_id', proyecto_id)

  if (ids && ids.length > 0) query = query.in('id', ids)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ documentos: data ?? [] })
}

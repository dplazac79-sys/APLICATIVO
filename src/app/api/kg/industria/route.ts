import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const industria = searchParams.get('industria')
  if (!industria) return NextResponse.json({ error: 'industria requerida' }, { status: 400 })

  const { data } = await supabase
    .from('kg_industria_snapshot')
    .select('*')
    .eq('industria', industria)
    .maybeSingle()

  return NextResponse.json({ snapshot: data ?? null })
}

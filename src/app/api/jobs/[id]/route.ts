import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: job, error } = await admin
    .from('jobs')
    .select('id, tipo, estado, resultado, error_mensaje, created_at, updated_at')
    .eq('id', params.id)
    .single()

  if (error || !job) return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })

  return NextResponse.json({ job })
}

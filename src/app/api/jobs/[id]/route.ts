import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdminClient()
  const { data: job, error } = await admin
    .from('jobs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !job) return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })

  return NextResponse.json({ job })
}

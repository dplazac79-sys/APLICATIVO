import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: { procesoId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const vParam = req.nextUrl.searchParams.get('v')
  const versionNum = vParam ? parseInt(vParam, 10) : null

  const { data: proceso } = await admin
    .from('proceso')
    .select('id, nombre, codigo, orden, metadata_ia, proyecto_id, documento_origen_id')
    .eq('id', params.procesoId)
    .single()

  if (!proceso) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  const meta = (proceso.metadata_ia ?? {}) as Record<string, unknown>
  const versiones = (meta.versiones ?? []) as Array<Record<string, unknown>>

  const meta2 = (proceso.metadata_ia ?? {}) as Record<string, unknown>
  const docRef = meta2.documento_referencia as string | null
  const codigo = proceso.codigo
    ?? (docRef ? docRef.replace(/\.[^.]+$/, '').toUpperCase() : null)
    ?? `SC${String((proceso.orden ?? 0) + 1).padStart(2, '0')}`

  // Find the specific version
  const version = versionNum !== null
    ? versiones.find(v => (v.numero as number) === versionNum)
    : versiones[versiones.length - 1]

  if (versionNum !== null && versionNum > 0 && !version) {
    return NextResponse.json({ error: 'Versión no encontrada' }, { status: 404 })
  }

  const detalleCorrecciones = version
    ? (version.detalle_correcciones ?? []) as Array<{ tipo: string; observacion: string; texto_original?: string; fecha?: string }>
    : []

  const vLabel = versionNum === 0 ? 'Original' : version ? `V${version.numero}` : 'Versión actual'
  const fecha = version
    ? new Date(version.fecha as string).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })

  const lines: string[] = [
    `═══════════════════════════════════════════════════════════════`,
    `  ${codigo} ${vLabel}`,
    `  ${proceso.nombre}`,
    `═══════════════════════════════════════════════════════════════`,
    ``,
    `  Proyecto   : ${proceso.proyecto_id}`,
    `  Proceso    : ${codigo} — ${proceso.nombre}`,
    `  Versión    : ${vLabel}`,
    `  Fecha      : ${fecha}`,
    ``,
  ]

  if (version) {
    lines.push(`  Descripción: ${version.descripcion ?? ''}`)
    if (version.correcciones_aplicadas) {
      lines.push(`  Correcciones aplicadas: ${version.correcciones_aplicadas}`)
    }
    lines.push(``)
  }

  if (detalleCorrecciones.length > 0) {
    lines.push(`───────────────────────────────────────────────────────────────`)
    lines.push(`  CAMBIOS RESPECTO A LA VERSIÓN ANTERIOR`)
    lines.push(`───────────────────────────────────────────────────────────────`)
    lines.push(``)
    detalleCorrecciones.forEach((c, i) => {
      lines.push(`  ${i + 1}. [${c.tipo?.toUpperCase()}]`)
      if (c.texto_original) {
        lines.push(`     Texto original: ${c.texto_original}`)
      }
      lines.push(`     Observación    : ${c.observacion}`)
      if (c.fecha) {
        lines.push(`     Fecha          : ${new Date(c.fecha).toLocaleDateString('es-CL')}`)
      }
      lines.push(``)
    })
  }

  // Add metadata_ia analysis summary
  const hallazgos = (meta.hallazgos_criticos ?? []) as string[]
  const riesgos = (meta.riesgos_criticos ?? []) as Array<{ riesgo: string; impacto?: string }>
  const oportunidades = (meta.oportunidades_mejora ?? []) as string[]

  if (hallazgos.length > 0 || riesgos.length > 0 || oportunidades.length > 0) {
    lines.push(`───────────────────────────────────────────────────────────────`)
    lines.push(`  ANÁLISIS DEL PROCESO`)
    lines.push(`───────────────────────────────────────────────────────────────`)
    lines.push(``)

    if (hallazgos.length > 0) {
      lines.push(`  Hallazgos identificados:`)
      hallazgos.slice(0, 5).forEach(h => lines.push(`    • ${h}`))
      lines.push(``)
    }

    if (riesgos.length > 0) {
      lines.push(`  Riesgos críticos:`)
      riesgos.slice(0, 5).forEach(r => {
        const texto = typeof r === 'string' ? r : (r.riesgo ?? JSON.stringify(r))
        lines.push(`    • ${texto}`)
      })
      lines.push(``)
    }

    if (oportunidades.length > 0) {
      lines.push(`  Oportunidades de mejora:`)
      oportunidades.slice(0, 5).forEach(o => lines.push(`    • ${o}`))
      lines.push(``)
    }
  }

  lines.push(`───────────────────────────────────────────────────────────────`)
  lines.push(`  Documento generado por ProcessOS — AICOUNTS Consultores`)
  lines.push(`  ${new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}`)
  lines.push(`═══════════════════════════════════════════════════════════════`)

  const content = lines.join('\n')
  const filename = `${codigo}_${vLabel.replace(/\s/g, '_')}.txt`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

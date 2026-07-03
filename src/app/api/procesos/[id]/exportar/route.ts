import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdminClient()

  const { data: proceso } = await admin
    .from('proceso')
    .select('id, nombre, descripcion, metadata_ia, documento_origen_id, roles_involucrados')
    .eq('id', params.id)
    .single()

  if (!proceso) return NextResponse.json({ error: 'no_encontrado' }, { status: 404 })

  let doc: { nombre_archivo: string; analisis_ia: Record<string, unknown> | null } | null = null
  if (proceso.documento_origen_id) {
    const { data } = await admin
      .from('documento')
      .select('nombre_archivo, analisis_ia')
      .eq('id', proceso.documento_origen_id)
      .single()
    doc = data
  }

  const meta = (proceso.metadata_ia ?? {}) as Record<string, unknown>
  const versiones = (meta.versiones ?? []) as Array<{ numero: number; fecha: string; descripcion: string; correcciones_aplicadas: number }>
  const versionActual = (meta.version_actual as number) ?? 1
  const correcciones = (meta.correcciones ?? []) as Array<{ tipo: string; indice: number; observacion: string; estado: string; fecha: string }>
  const iaRaw = (doc?.analisis_ia ?? {}) as Record<string, unknown>
  const ia = ((iaRaw.analisis ?? iaRaw) as Record<string, unknown>)
  const atendidas = correcciones.filter(c => c.estado === 'archivado')

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>${proceso.nombre} — v${versionActual}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#fff;color:#1e293b;padding:40px 60px;max-width:900px;margin:auto;line-height:1.6}
  .header{border-bottom:3px solid #6d28d9;padding-bottom:20px;margin-bottom:32px}
  .badge{display:inline-block;background:#6d28d9;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.05em}
  h1{font-size:26px;font-weight:800;color:#0f172a;margin:8px 0 4px}
  .meta{font-size:12px;color:#64748b}
  h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6d28d9;margin:28px 0 12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
  p{font-size:14px;color:#334155;margin-bottom:8px}
  ul{list-style:none;padding:0}
  li{font-size:13px;color:#475569;padding:6px 0 6px 20px;border-bottom:1px solid #f1f5f9;position:relative}
  li::before{content:'→';position:absolute;left:0;color:#94a3b8}
  .risk{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:10px}
  .risk-title{font-weight:600;color:#dc2626;font-size:13px}
  .risk-imp{display:inline-block;font-size:11px;background:#dc2626;color:#fff;padding:1px 8px;border-radius:10px;margin-left:8px;font-weight:700}
  .risk-evid{font-size:12px;color:#64748b;margin-top:4px}
  .opp{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:8px}
  .opp-title{font-weight:600;color:#16a34a;font-size:13px}
  .opp-imp{font-size:12px;color:#64748b;margin-top:4px}
  .qw{background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 14px;margin-bottom:6px;border-radius:0 6px 6px 0}
  .corr{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;margin-bottom:6px}
  .corr-type{font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.05em}
  .corr-obs{font-size:13px;color:#334155;margin-top:2px}
  .rol-chip{display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;color:#475569;margin:4px 4px 4px 0}
  .footer{margin-top:48px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}
  .version-hist{background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:12px 16px;margin-bottom:6px}
  .madurez-bar{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;margin:8px 0}
  .madurez-fill{height:100%;background:#6d28d9;border-radius:4px}
  @media print{body{padding:20px 30px}}
</style>
</head>
<body>
<div class="header">
  <div class="badge">ProcessOS · AICOUNTS Consultores</div>
  <h1>${proceso.nombre}</h1>
  <div class="meta">Versión ${versionActual} · ${formatDate(new Date().toISOString())} · Documento: ${doc?.nombre_archivo ?? 'N/A'}</div>
</div>

${proceso.descripcion ? `<h2>Descripción</h2><p>${proceso.descripcion}</p>` : ''}

${ia.resumen_ejecutivo ? `<h2>Resumen Ejecutivo</h2><p>${ia.resumen_ejecutivo}</p>` : ''}

${ia.diagnostico_operacional ? `<h2>Diagnóstico Operacional</h2><p>${ia.diagnostico_operacional}</p>` : ''}

${(ia.nivel_madurez_amo != null) ? `
<h2>Nivel de Madurez</h2>
<p><strong>${ia.nivel_madurez_amo}/5</strong> — ${ia.nivel_madurez_nombre ?? ''}</p>
<div class="madurez-bar"><div class="madurez-fill" style="width:${((ia.nivel_madurez_amo as number)/5)*100}%"></div></div>
${ia.nivel_madurez_evidencia ? `<p style="font-size:12px;color:#64748b;margin-top:4px">${ia.nivel_madurez_evidencia}</p>` : ''}
` : ''}

${Array.isArray(ia.riesgos_criticos) && (ia.riesgos_criticos as unknown[]).length > 0 ? `
<h2>Riesgos Críticos</h2>
${(ia.riesgos_criticos as Array<{riesgo:string;impacto:string;evidencia:string}>).map(r => `
<div class="risk">
  <div class="risk-title">${r.riesgo}<span class="risk-imp">${r.impacto}</span></div>
  ${r.evidencia ? `<div class="risk-evid">Evidencia: ${r.evidencia}</div>` : ''}
</div>`).join('')}` : ''}

${Array.isArray(ia.hallazgos_criticos) && (ia.hallazgos_criticos as unknown[]).length > 0 ? `
<h2>Hallazgos Críticos</h2>
<ul>${(ia.hallazgos_criticos as string[]).map(h => `<li>${h}</li>`).join('')}</ul>` : ''}

${Array.isArray(ia.quick_wins) && (ia.quick_wins as unknown[]).length > 0 ? `
<h2>Quick Wins</h2>
${(ia.quick_wins as string[]).map(q => `<div class="qw">${q}</div>`).join('')}` : ''}

${Array.isArray(ia.oportunidades_valor) && (ia.oportunidades_valor as unknown[]).length > 0 ? `
<h2>Oportunidades de Valor</h2>
${(ia.oportunidades_valor as Array<{oportunidad:string;impacto_estimado:string;complejidad_implementacion:string}>).map(o => `
<div class="opp">
  <div class="opp-title">${o.oportunidad}</div>
  ${o.impacto_estimado ? `<div class="opp-imp">${o.impacto_estimado}</div>` : ''}
</div>`).join('')}` : ''}

${ia.recomendacion_ejecutiva ? `<h2>Recomendación Ejecutiva</h2><p><strong>${ia.recomendacion_ejecutiva}</strong></p>` : ''}

${Array.isArray(proceso.roles_involucrados) && (proceso.roles_involucrados as string[]).length > 0 ? `
<h2>Roles Involucrados</h2>
<p>${(proceso.roles_involucrados as string[]).map(r => `<span class="rol-chip">${r}</span>`).join('')}</p>` : ''}

${atendidas.length > 0 ? `
<h2>Correcciones Aplicadas (v${versionActual})</h2>
${atendidas.map(c => `
<div class="corr">
  <div class="corr-type">${c.tipo === 'riesgo' ? 'Riesgo' : c.tipo === 'hallazgo' ? 'Hallazgo' : c.tipo === 'brecha' ? 'Brecha' : 'Rol'} · Atendido el ${formatDate(c.fecha)}</div>
  ${c.observacion ? `<div class="corr-obs">${c.observacion}</div>` : '<div class="corr-obs" style="color:#94a3b8">Marcado como atendido sin observación adicional.</div>'}
</div>`).join('')}` : ''}

${versiones.length > 0 ? `
<h2>Historial de Versiones</h2>
${versiones.map(v => `
<div class="version-hist">
  <strong>v${v.numero}</strong> · ${formatDate(v.fecha)} · ${v.descripcion}
</div>`).join('')}` : ''}

<div class="footer">
  <span>ProcessOS · AICOUNTS Consultores · Documento confidencial</span>
  <span>Generado el ${formatDate(new Date().toISOString())}</span>
</div>
</body></html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${proceso.nombre.replace(/[^a-z0-9]/gi, '_')}_v${versionActual}.html"`,
    },
  })
}

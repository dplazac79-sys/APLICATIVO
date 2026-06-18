import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'APIP <notificaciones@aicounts.cl>'

export interface EmailParams {
  to: string | string[]
  subject: string
  html: string
}

export async function enviarEmail({ to, subject, html }: EmailParams): Promise<void> {
  if (!process.env.RESEND_API_KEY) return  // silencioso si no configurado

  const recipients = Array.isArray(to) ? to : [to]
  try {
    await resend.emails.send({ from: FROM, to: recipients, subject, html })
  } catch {
    // Email no debe bloquear el flujo principal
  }
}

// ── Templates ──────────────────────────────────────────────────────────────

export function templateCambioEstado(opts: {
  proyecto: string
  estado_anterior: string
  estado_nuevo: string
  usuario: string
  url?: string
}): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <div style="background:#1e293b;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:18px">APIP — Cambio de estado</h1>
      </div>
      <div style="background:#f8fafc;padding:24px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0">
        <p style="margin:0 0 16px">El proyecto <strong>${opts.proyecto}</strong> cambió de estado.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr>
            <td style="padding:8px 12px;background:#fee2e2;border-radius:4px;color:#991b1b">
              ${opts.estado_anterior}
            </td>
            <td style="padding:0 12px;color:#64748b;text-align:center">→</td>
            <td style="padding:8px 12px;background:#dcfce7;border-radius:4px;color:#166534">
              ${opts.estado_nuevo}
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:13px;color:#64748b">Acción realizada por ${opts.usuario}</p>
        ${opts.url ? `<p style="margin:16px 0 0"><a href="${opts.url}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">Ver proyecto</a></p>` : ''}
      </div>
    </div>
  `
}

export function templateEscalacion(opts: {
  proyecto: string
  nivel: string
  descripcion: string
  url?: string
}): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <div style="background:#dc2626;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:18px">⚠ APIP — Escalación ${opts.nivel}</h1>
      </div>
      <div style="background:#f8fafc;padding:24px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0">
        <p style="margin:0 0 16px">Proyecto <strong>${opts.proyecto}</strong> requiere atención inmediata.</p>
        <p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:0 4px 4px 0;margin:0 0 16px;font-size:14px;color:#7f1d1d">
          ${opts.descripcion}
        </p>
        ${opts.url ? `<p style="margin:0"><a href="${opts.url}" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">Ver ahora</a></p>` : ''}
      </div>
    </div>
  `
}

export function templateNuevaAsignacion(opts: {
  proyecto: string
  rol: string
  asignado_por: string
  url?: string
}): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <div style="background:#4f46e5;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:18px">APIP — Nueva asignación</h1>
      </div>
      <div style="background:#f8fafc;padding:24px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0">
        <p style="margin:0 0 16px">Fuiste asignado al proyecto <strong>${opts.proyecto}</strong> con rol <strong>${opts.rol}</strong>.</p>
        <p style="margin:0 0 16px;font-size:13px;color:#64748b">Asignado por: ${opts.asignado_por}</p>
        ${opts.url ? `<p style="margin:0"><a href="${opts.url}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">Ver proyecto</a></p>` : ''}
      </div>
    </div>
  `
}

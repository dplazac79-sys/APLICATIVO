import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, FileImage, FileSpreadsheet, File } from 'lucide-react'
import DocumentUploader from '@/components/documentos/DocumentUploader'
import type { Documento } from '@/types/database'

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', class: 'bg-amber-950 text-amber-400 border-amber-800' },
  procesando: { label: 'Procesando', class: 'bg-blue-950 text-blue-400 border-blue-800' },
  listo: { label: 'Listo', class: 'bg-emerald-950 text-emerald-400 border-emerald-800' },
  error: { label: 'Error', class: 'bg-red-950 text-red-400 border-red-800' },
} as const

function FileIcon({ tipo }: { tipo: string | null }) {
  if (tipo === 'pdf') return <FileText className="w-4 h-4 text-red-400" />
  if (tipo === 'xlsx') return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
  if (tipo === 'imagen') return <FileImage className="w-4 h-4 text-blue-400" />
  return <File className="w-4 h-4 text-slate-400" />
}

export default async function DocumentosPage() {
  const supabase = createClient()

  const { data: proyectosRaw } = await supabase
    .from('proyecto')
    .select('id, nombre, cliente(razon_social)')
    .eq('estado_general', 'activo')

  // Normalizar: Supabase puede devolver cliente como array en foreign key joins
  const proyectos = (proyectosRaw ?? []).map(p => ({
    id: p.id as string,
    nombre: p.nombre as string,
    cliente: Array.isArray(p.cliente) ? (p.cliente[0] ?? null) : p.cliente,
  }))

  const { data: documentos } = await supabase
    .from('documento')
    .select('*, proyecto(nombre)')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Centro Documental</h1>
        <p className="text-slate-400 text-sm mt-1">M2 — Ingesta de documentos por proyecto</p>
      </div>

      <DocumentUploader proyectos={proyectos} />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          Documentos cargados ({documentos?.length ?? 0})
        </h2>

        {documentos?.length === 0 && (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-12 text-center">
              <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400">No hay documentos cargados aún.</p>
            </CardContent>
          </Card>
        )}

        {documentos?.map((doc: Documento & { proyecto: { nombre: string } | null }) => {
          const estado = ESTADO_CONFIG[doc.estado_procesamiento] ?? ESTADO_CONFIG.pendiente
          return (
            <Card key={doc.id} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                    <FileIcon tipo={doc.tipo} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{doc.nombre_archivo}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {doc.proyecto?.nombre ?? 'Sin proyecto'} ·{' '}
                      {new Date(doc.created_at).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${estado.class}`}>
                    {estado.label}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

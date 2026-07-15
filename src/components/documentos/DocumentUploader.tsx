'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, CheckCircle2, Loader2, RefreshCw, FileText, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import ProyectoSelectorDropdown from './ProyectoSelectorDropdown'

interface Proyecto { id: string; nombre: string; cliente: { razon_social: string } | null }
interface DocExistente { id: string; nombre_archivo: string }
interface Props {
  proyectos: Proyecto[]
  proyectoPreseleccionado?: string | null
  documentosExistentes?: DocExistente[]
}

const EXTENSIONES_PERMITIDAS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp']
const TAMANO_MAXIMO_MB = 25
const TAMANO_MAXIMO_BYTES = TAMANO_MAXIMO_MB * 1024 * 1024

function detectTipo(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx'].includes(ext)) return 'docx'
  if (['xls', 'xlsx'].includes(ext)) return 'xlsx'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'imagen'
  return 'otro'
}

function extensionPermitida(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSIONES_PERMITIDAS.includes(ext)
}

interface FileEntry {
  file: File
  padreId: string | null   // null = documento nuevo, id = nueva versión de ese doc
  padreNombre: string | null
}

export default function DocumentUploader({ proyectos, proyectoPreseleccionado, documentosExistentes = [] }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [proyectoId, setProyectoId] = useState(proyectoPreseleccionado ?? (proyectos.length === 1 ? proyectos[0].id : ''))
  const proyectoIdRef = useRef(proyectoPreseleccionado ?? (proyectos.length === 1 ? proyectos[0].id : ''))
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(0)

  function handleProyectoChange(v: string) {
    setProyectoId(v)
    proyectoIdRef.current = v
  }

  function resolveEntries(files: File[]): FileEntry[] {
    return files.map(file => {
      const match = documentosExistentes.find(d =>
        d.nombre_archivo.toLowerCase() === file.name.toLowerCase()
      )
      return { file, padreId: match?.id ?? null, padreNombre: match?.nombre_archivo ?? null }
    })
  }

  function addFiles(files: File[]) {
    const rechazadosTipo = files.filter(f => !extensionPermitida(f))
    const rechazadosTamano = files.filter(f => extensionPermitida(f) && f.size > TAMANO_MAXIMO_BYTES)
    if (rechazadosTipo.length > 0) {
      toast.error(`Tipo de archivo no permitido: ${rechazadosTipo.map(f => f.name).join(', ')}`)
    }
    if (rechazadosTamano.length > 0) {
      toast.error(`Supera el máximo de ${TAMANO_MAXIMO_MB} MB: ${rechazadosTamano.map(f => f.name).join(', ')}`)
    }
    const aceptados = files.filter(f => extensionPermitida(f) && f.size <= TAMANO_MAXIMO_BYTES)

    const nuevas = resolveEntries(aceptados)
    setEntries(prev => {
      const existentes = prev.map(e => e.file.name)
      return [...prev, ...nuevas.filter(n => !existentes.includes(n.file.name))]
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    addFiles(Array.from(e.dataTransfer.files))
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function toggleVersionMode(idx: number) {
    setEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e
      // Si ya era versión → volver a nuevo; si era nuevo y hay padre → activar versión
      if (e.padreId) return { ...e, padreId: null, padreNombre: null }
      const match = documentosExistentes.find(d => d.nombre_archivo.toLowerCase() === e.file.name.toLowerCase())
      return match ? { ...e, padreId: match.id, padreNombre: match.nombre_archivo } : e
    }))
  }

  async function handleUpload() {
    if (uploading) return // guardia síncrona — evita doble envío por doble clic antes del re-render
    const pid = proyectoIdRef.current || proyectoId
    if (!pid) { toast.error('Selecciona un proyecto primero'); return }
    if (entries.length === 0) { toast.error('Selecciona al menos un archivo'); return }

    // Aviso no bloqueante — antes no había ninguna señal de que un archivo
    // con el mismo nombre que uno ya existente se estaba subiendo como
    // documento nuevo en vez de como nueva versión (el usuario podía ignorar
    // el badge "Nombre existente" sin darse cuenta de que estaba duplicando).
    const sinResolver = entries.filter(e => !e.padreId
      && documentosExistentes.some(d => d.nombre_archivo.toLowerCase() === e.file.name.toLowerCase()))
    if (sinResolver.length > 0) {
      toast.warning(`${sinResolver.length === 1 ? 'Un archivo coincide' : `${sinResolver.length} archivos coinciden`} con un nombre ya existente y se subirá${sinResolver.length === 1 ? '' : 'n'} como documento nuevo, no como nueva versión.`)
    }

    setUploading(true)
    setDone(0)

    for (const entry of entries) {
      const safeName = entry.file.name
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${pid}/${Date.now()}-${safeName}`

      const { error: storageError } = await supabase.storage.from('documentos').upload(path, entry.file)
      if (storageError) { toast.error(`Error al subir ${entry.file.name}: ${storageError.message}`); continue }

      const res = await fetch('/api/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: pid,
          nombre_archivo: entry.file.name,
          tipo: detectTipo(entry.file),
          url_storage: path,
          documento_padre_id: entry.padreId ?? undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(`Error al registrar ${entry.file.name}: ${data.error ?? 'error desconocido'}`)
        continue
      }

      setDone(prev => prev + 1)
      toast.success(entry.padreId
        ? `Nueva versión de ${entry.file.name} registrada`
        : `${entry.file.name} cargado — procesando con IA`)
    }

    setEntries([])
    setUploading(false)
    router.refresh()
  }

  const tieneVersiones = entries.some(e => e.padreId)

  return (
    <div className="space-y-3">
      {/* Selector de proyecto */}
      <ProyectoSelectorDropdown proyectos={proyectos} proyectoId={proyectoId} onChange={handleProyectoChange} />

      {/* Zona de drop */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:border-violet-600/60 hover:bg-violet-950/10 transition-colors"
      >
        <Upload className="w-7 h-7 text-slate-600 mx-auto mb-2" />
        <p className="text-slate-400 text-sm">Arrastra archivos aquí o <span className="text-violet-400">haz clic para seleccionar</span></p>
        <p className="text-slate-400 text-xs mt-1">PDF, DOCX, XLSX, imágenes · Máximo {TAMANO_MAXIMO_MB} MB por archivo · Si el nombre coincide con uno existente, se detecta automáticamente como nueva versión</p>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp" />
      </div>

      {/* Lista de archivos seleccionados */}
      {entries.length > 0 && (
        <div className="space-y-1.5">
          {entries.map((entry, i) => {
            const esVersion = !!entry.padreId
            const puedeSerVersion = documentosExistentes.some(d =>
              d.nombre_archivo.toLowerCase() === entry.file.name.toLowerCase()
            )
            return (
              <div key={i} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${esVersion ? 'bg-violet-950/20 border-violet-800/40' : 'bg-slate-800/40 border-slate-700/40'}`}>
                <FileText className={`w-4 h-4 shrink-0 ${esVersion ? 'text-violet-400' : 'text-slate-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{entry.file.name}</p>
                  <p className="text-xs text-slate-400">{(entry.file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                {esVersion ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs bg-violet-900/60 text-violet-300 border border-violet-700/40 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Nueva versión
                    </span>
                    <button onClick={() => toggleVersionMode(i)} title="Subir como documento nuevo en su lugar"
                      className="text-xs text-slate-400 hover:text-slate-400 transition-colors">Subir como nuevo</button>
                  </div>
                ) : puedeSerVersion ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <AlertTriangle className="w-3 h-3" /> Nombre existente
                    </span>
                    <button onClick={() => toggleVersionMode(i)}
                      className="text-xs bg-violet-800/60 hover:bg-violet-700/60 text-violet-300 border border-violet-700/40 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Marcar como versión
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 shrink-0">Nuevo</span>
                )}
                <button onClick={() => setEntries(prev => prev.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-red-400 shrink-0 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {done > 0 && !uploading && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          {done} archivo{done !== 1 ? 's' : ''} cargado{done !== 1 ? 's' : ''} correctamente
        </div>
      )}

      <button onClick={handleUpload} disabled={uploading || entries.length === 0}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-all">
        {uploading
          ? <><Loader2 className="w-4 h-4 animate-spin" />Subiendo...</>
          : entries.length > 0
            ? <><Upload className="w-4 h-4" />Cargar {entries.length} archivo{entries.length !== 1 ? 's' : ''}{tieneVersiones ? ' (incluye versiones)' : ''}</>
            : <><Upload className="w-4 h-4" />Cargar archivos</>
        }
      </button>
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Upload, X, CheckCircle2, Loader2, RefreshCw, FileText, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface Proyecto { id: string; nombre: string; cliente: { razon_social: string } | null }
interface DocExistente { id: string; nombre_archivo: string }
interface Props {
  proyectos: Proyecto[]
  proyectoPreseleccionado?: string | null
  documentosExistentes?: DocExistente[]
}

function detectTipo(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx'].includes(ext)) return 'docx'
  if (['xls', 'xlsx'].includes(ext)) return 'xlsx'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'imagen'
  return 'otro'
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

  const preNombre = proyectoPreseleccionado ? (proyectos.find(p => p.id === proyectoPreseleccionado)?.nombre ?? '') : ''
  const [proyectoId, setProyectoId] = useState(proyectoPreseleccionado ?? '')
  const [proyectoNombre, setProyectoNombre] = useState(preNombre)
  const proyectoIdRef = useRef(proyectoPreseleccionado ?? '')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(0)

  function handleProyectoChange(v: string) {
    setProyectoId(v)
    proyectoIdRef.current = v
    setProyectoNombre(proyectos.find(p => p.id === v)?.nombre ?? v)
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
    const nuevas = resolveEntries(files)
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
    const pid = proyectoIdRef.current || proyectoId
    if (!pid) { toast.error('Selecciona un proyecto primero'); return }
    if (entries.length === 0) { toast.error('Selecciona al menos un archivo'); return }
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
      <Select value={proyectoId} onValueChange={(v: string | null) => v && handleProyectoChange(v)}>
        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
          <span className={proyectoId ? 'text-white' : 'text-slate-500'}>
            {proyectoId ? proyectoNombre : 'Seleccionar proyecto...'}
          </span>
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          {proyectos.map(p => (
            <SelectItem key={p.id} value={p.id} className="text-slate-200 focus:bg-slate-700">
              {p.nombre}
              {p.cliente && <span className="text-slate-500 ml-1">— {p.cliente.razon_social}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Zona de drop */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:border-violet-600/60 hover:bg-violet-950/10 transition-colors"
      >
        <Upload className="w-7 h-7 text-slate-600 mx-auto mb-2" />
        <p className="text-slate-400 text-sm">Arrastra archivos aquí o <span className="text-violet-400">haz clic para seleccionar</span></p>
        <p className="text-slate-600 text-xs mt-1">PDF, DOCX, XLSX, imágenes · Si el nombre coincide con uno existente, se detecta automáticamente como nueva versión</p>
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
                  <p className="text-xs text-slate-500">{(entry.file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                {esVersion ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs bg-violet-900/60 text-violet-300 border border-violet-700/40 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Nueva versión
                    </span>
                    <button onClick={() => toggleVersionMode(i)} title="Subir como documento nuevo en su lugar"
                      className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Subir como nuevo</button>
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
                  <span className="text-xs text-slate-600 shrink-0">Nuevo</span>
                )}
                <button onClick={() => setEntries(prev => prev.filter((_, j) => j !== i))}
                  className="text-slate-600 hover:text-red-400 shrink-0 transition-colors">
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

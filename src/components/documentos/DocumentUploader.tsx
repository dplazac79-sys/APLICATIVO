'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, X, CheckCircle2 } from 'lucide-react'

interface Proyecto {
  id: string
  nombre: string
  cliente: { razon_social: string } | null
}

interface Props {
  proyectos: Proyecto[]
}

function detectTipo(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx'].includes(ext)) return 'docx'
  if (['xls', 'xlsx'].includes(ext)) return 'xlsx'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'imagen'
  return 'otro'
}

export default function DocumentUploader({ proyectos }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [proyectoId, setProyectoId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(0)
  const [error, setError] = useState('')

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
    setFiles(prev => [...prev, ...dropped])
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    setFiles(prev => [...prev, ...selected])
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    if (!proyectoId || files.length === 0) return
    setUploading(true)
    setError('')
    setUploaded(0)

    const { data: { user } } = await supabase.auth.getUser()

    for (const file of files) {
      const path = `${proyectoId}/${Date.now()}-${file.name}`

      const { error: storageError } = await supabase.storage
        .from('documentos')
        .upload(path, file)

      if (storageError) {
        setError(`Error subiendo ${file.name}: ${storageError.message}`)
        continue
      }

      const { data: { publicUrl } } = supabase.storage
        .from('documentos')
        .getPublicUrl(path)

      await supabase.from('documento').insert({
        proyecto_id: proyectoId,
        nombre_archivo: file.name,
        tipo: detectTipo(file),
        url_storage: publicUrl,
        estado_procesamiento: 'pendiente',
        subido_por: user?.id ?? null,
      })

      setUploaded(prev => prev + 1)
    }

    setFiles([])
    setUploading(false)
    router.refresh()
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Select value={proyectoId} onValueChange={(v) => v && setProyectoId(v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Seleccionar proyecto..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {proyectos.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-slate-200 focus:bg-slate-700">
                    {p.nombre}
                    {p.cliente && (
                      <span className="text-slate-500 ml-1">— {p.cliente.razon_social}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-600 hover:bg-indigo-950/10 transition-colors"
        >
          <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">
            Arrastra archivos aquí o <span className="text-indigo-400">haz clic para seleccionar</span>
          </p>
          <p className="text-slate-600 text-xs mt-1">PDF, DOCX, XLSX, imágenes</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInput}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
          />
        </div>

        {/* Lista de archivos seleccionados */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                <span className="text-sm text-slate-300 flex-1 truncate">{file.name}</span>
                <span className="text-xs text-slate-600">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <button onClick={() => removeFile(i)} className="text-slate-600 hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {uploaded > 0 && !uploading && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            {uploaded} archivo{uploaded !== 1 ? 's' : ''} cargado{uploaded !== 1 ? 's' : ''} correctamente
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <Button
          onClick={handleUpload}
          disabled={!proyectoId || files.length === 0 || uploading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
        >
          <Upload className="w-4 h-4" />
          {uploading ? `Subiendo ${uploaded}/${files.length}...` : `Cargar ${files.length > 0 ? files.length : ''} archivo${files.length !== 1 ? 's' : ''}`}
        </Button>
      </CardContent>
    </Card>
  )
}

'use client'

import { useCallback, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Button } from '@/components/ui/button'
import { Save, Loader2, Trash2, GitMerge, Square, Circle, FileText } from 'lucide-react'

interface Props {
  artefactoId: string
  initialNodes: Node[]
  initialEdges: Edge[]
  readonly?: boolean
}

const nodeStyle = (tipo: string): React.CSSProperties => {
  const base: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    border: '1.5px solid',
    minWidth: '130px',
    textAlign: 'center',
    color: '#fff',
    cursor: 'pointer',
  }
  switch (tipo) {
    case 'start':
      return { ...base, backgroundColor: '#065f46', borderColor: '#10b981', borderRadius: '50px' }
    case 'end':
      return { ...base, backgroundColor: '#7f1d1d', borderColor: '#ef4444', borderRadius: '50px' }
    case 'decision':
    case 'gateway':
      return { ...base, backgroundColor: '#312e81', borderColor: '#818cf8' }
    case 'document':
      return { ...base, backgroundColor: '#1c1917', borderColor: '#78716c', borderStyle: 'dashed' }
    default:
      return { ...base, backgroundColor: '#1e3a5f', borderColor: '#3b82f6' }
  }
}

function nodosConEstilo(nodes: Node[]): Node[] {
  return nodes.map(n => ({ ...n, style: nodeStyle(n.type ?? 'task') }))
}

let nextId = 100

export default function DiagramaEditor({ artefactoId, initialNodes, initialEdges, readonly = false }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(nodosConEstilo(initialNodes))
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<{ id: string; label: string } | null>(null)

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  )

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_, node) => {
    if (readonly) return
    setEditando({ id: node.id, label: String(node.data?.label ?? '') })
  }, [readonly])

  function confirmarEdicion() {
    if (!editando) return
    setNodes(nds => nds.map(n =>
      n.id === editando.id
        ? { ...n, data: { ...n.data, label: editando.label }, style: nodeStyle(n.type ?? 'task') }
        : n
    ))
    setEditando(null)
  }

  function agregarNodo(tipo: string, label: string) {
    const id = String(++nextId)
    const maxY = nodes.reduce((m, n) => Math.max(m, (n.position?.y ?? 0)), 0)
    const newNode: Node = {
      id,
      type: tipo === 'start' || tipo === 'end' ? undefined : tipo,
      position: { x: 400, y: maxY + 130 },
      data: { label },
      style: nodeStyle(tipo),
    }
    setNodes(nds => [...nds, newNode])
  }

  function eliminarSeleccionados() {
    setNodes(nds => nds.filter(n => !n.selected))
    setEdges(eds => eds.filter(e => !e.selected))
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/artefactos/${artefactoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contenido: {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            nodes: nodes.map(({ style: _style, ...n }) => n),
            edges,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const TIPOS_NODO = [
    { tipo: 'task',     label: 'Tarea',     icon: <Square className="w-3 h-3" />,    color: 'text-blue-400',    ejemplo: 'Nueva tarea' },
    { tipo: 'decision', label: 'Decisión',  icon: <GitMerge className="w-3 h-3" />,  color: 'text-indigo-400',  ejemplo: '¿Condición?' },
    { tipo: 'document', label: 'Documento', icon: <FileText className="w-3 h-3" />,  color: 'text-slate-400',   ejemplo: 'Documento' },
    { tipo: 'end',      label: 'Fin',       icon: <Circle className="w-3 h-3" />,    color: 'text-red-400',     ejemplo: 'Fin' },
  ]

  return (
    <div className="space-y-2">
      {!readonly && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toolbar agregar nodos */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
            <span className="text-slate-400 text-xs mr-1">Agregar:</span>
            {TIPOS_NODO.map(t => (
              <button
                key={t.tipo}
                onClick={() => agregarNodo(t.tipo, t.ejemplo)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-slate-700 transition-colors ${t.color}`}
                title={`Agregar ${t.label}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={eliminarSeleccionados}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-red-900/50 text-red-400 hover:bg-red-950/30 transition-colors"
            title="Eliminar seleccionados (clic en nodo para seleccionar)"
          >
            <Trash2 className="w-3 h-3" /> Eliminar selección
          </button>

          <div className="ml-auto flex items-center gap-2">
            {error && <span className="text-red-400 text-xs">{error}</span>}
            {guardado && <span className="text-emerald-400 text-xs">✓ Guardado</span>}
            <Button size="sm" onClick={guardar} disabled={guardando} className="bg-blue-700 hover:bg-blue-600 text-white h-7 px-3 text-xs">
              {guardando ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Guardar diagrama
            </Button>
          </div>
        </div>
      )}

      {!readonly && (
        <p className="text-slate-400 text-xs">
          Doble clic en un nodo para editar su nombre · Arrastra para mover · Conecta arrastrando desde el borde de un nodo
        </p>
      )}

      {/* Modal edición de label */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditando(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-80 space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-white text-sm font-medium">Editar nodo</p>
            <input
              autoFocus
              value={editando.label}
              onChange={e => setEditando({ ...editando, label: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') confirmarEdicion(); if (e.key === 'Escape') setEditando(null) }}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-purple-500"
              placeholder="Nombre del paso..."
            />
            <div className="flex gap-2">
              <button onClick={() => setEditando(null)} className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-1.5 text-sm hover:text-white transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarEdicion} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-1.5 text-sm transition-colors">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: '520px' }} className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readonly ? undefined : onNodesChange}
          onEdgesChange={readonly ? undefined : onEdgesChange}
          onConnect={readonly ? undefined : onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          fitView
          nodesDraggable={!readonly}
          nodesConnectable={!readonly}
          elementsSelectable={!readonly}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#334155" gap={20} />
          <Controls className="[&>button]:bg-slate-800 [&>button]:border-slate-700 [&>button]:text-white" />
          <MiniMap
            nodeColor="#3b82f6"
            maskColor="rgba(0,0,0,0.6)"
            style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
          />
        </ReactFlow>
      </div>
    </div>
  )
}

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
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Button } from '@/components/ui/button'
import { Save, Loader2 } from 'lucide-react'

interface Props {
  artefactoId: string
  initialNodes: Node[]
  initialEdges: Edge[]
  readonly?: boolean
}

// Estilos de nodo personalizados por tipo
const nodeStyle = (tipo: string): React.CSSProperties => {
  const base: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    border: '1.5px solid',
    minWidth: '120px',
    textAlign: 'center',
    color: '#fff',
  }
  switch (tipo) {
    case 'start':
      return { ...base, backgroundColor: '#065f46', borderColor: '#10b981', borderRadius: '50px' }
    case 'end':
      return { ...base, backgroundColor: '#7f1d1d', borderColor: '#ef4444', borderRadius: '50px' }
    case 'gateway':
    case 'decision':
      return { ...base, backgroundColor: '#1e1b4b', borderColor: '#818cf8', borderRadius: '4px', transform: 'rotate(45deg)', width: '60px', height: '60px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    case 'document':
      return { ...base, backgroundColor: '#1c1917', borderColor: '#78716c', borderStyle: 'dashed' }
    default: // task
      return { ...base, backgroundColor: '#1e3a5f', borderColor: '#3b82f6' }
  }
}

function nodosConEstilo(nodes: Node[]): Node[] {
  return nodes.map(n => ({
    ...n,
    style: nodeStyle(n.type ?? 'task'),
  }))
}

export default function DiagramaEditor({ artefactoId, initialNodes, initialEdges, readonly = false }: Props) {
  const [nodes, , onNodesChange] = useNodesState(nodosConEstilo(initialNodes))
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  )

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
      setTimeout(() => setGuardado(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-2">
      {!readonly && (
        <div className="flex items-center gap-2 justify-end">
          {error && <span className="text-red-400 text-xs">{error}</span>}
          {guardado && <span className="text-emerald-400 text-xs">Guardado</span>}
          <Button size="sm" onClick={guardar} disabled={guardando} className="bg-blue-700 hover:bg-blue-600 text-white h-7 px-3 text-xs">
            {guardando ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
            Guardar diagrama
          </Button>
        </div>
      )}
      <div style={{ height: '500px' }} className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readonly ? undefined : onNodesChange}
          onEdgesChange={readonly ? undefined : onEdgesChange}
          onConnect={readonly ? undefined : onConnect}
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

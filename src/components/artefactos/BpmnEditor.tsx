'use client'

import { useCallback, useMemo, useState } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type Node, type Edge,
  Handle, Position, type NodeProps, MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Mail, Clock, Zap, AlertTriangle, User, Settings, Send, Inbox,
  Wrench, BookOpen, Plus, Save, Loader2, Trash2, GitBranch, Info,
} from 'lucide-react'

// ─── Constantes de layout ────────────────────────────────────────────────────

const LANE_UNIT = 150   // espacio vertical por lane (nodo + margen)
const LANE_HEIGHT = 136 // altura visual del band de lane

const LANE_PALETTE = [
  { bg: 'rgba(109,40,217,0.07)',  border: 'rgba(139,92,246,0.25)',  text: '#a78bfa' },
  { bg: 'rgba(3,105,161,0.07)',   border: 'rgba(56,189,248,0.25)',  text: '#7dd3fc' },
  { bg: 'rgba(4,120,87,0.07)',    border: 'rgba(52,211,153,0.25)',  text: '#6ee7b7' },
  { bg: 'rgba(161,98,7,0.07)',    border: 'rgba(251,191,36,0.25)',  text: '#fde68a' },
  { bg: 'rgba(159,18,57,0.07)',   border: 'rgba(251,113,133,0.25)', text: '#fda4af' },
  { bg: 'rgba(30,64,175,0.07)',   border: 'rgba(147,197,253,0.25)', text: '#93c5fd' },
]

// ─── Nodos custom BPMN 2.0 ───────────────────────────────────────────────────

// Evento (inicio / fin / intermedio)
function EventNode({ data, type }: NodeProps) {
  const isStart = type === 'startEvent' || type === 'start'
  const isEnd = type === 'endEvent' || type === 'end'
  const sub = (data.subtype as string) ?? ''

  const circleStyle = isStart
    ? 'border-2 border-emerald-400 bg-emerald-950/60'
    : isEnd
    ? 'border-[3.5px] border-red-500 bg-red-950/60'
    : 'border-2 border-sky-400 bg-sky-950/50'

  const iconColor = isStart ? 'text-emerald-300' : isEnd ? 'text-red-300' : 'text-sky-300'

  const SubIcon = () => {
    if (sub === 'message')   return <Mail className={`w-3.5 h-3.5 ${iconColor}`} />
    if (sub === 'timer')     return <Clock className={`w-3.5 h-3.5 ${iconColor}`} />
    if (sub === 'signal')    return <Zap className={`w-3.5 h-3.5 ${iconColor}`} />
    if (sub === 'error')     return <AlertTriangle className={`w-3 h-3 ${iconColor}`} />
    if (sub === 'terminate') return <div className="w-4 h-4 rounded-full bg-red-500" />
    return null
  }

  // double ring for intermediate
  const ringStyle = type === 'intermediateEvent' || type === 'intermediate'
    ? { boxShadow: '0 0 0 3px #0f172a, 0 0 0 5px rgba(56,189,248,0.35)' }
    : {}

  return (
    <div className="flex flex-col items-center select-none" style={{ width: 100 }}>
      <Handle type="target" position={Position.Left}
        className="!w-2 !h-2 !bg-slate-700 !border-slate-500 !rounded-full" />
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${circleStyle}`}
           style={ringStyle}>
        <SubIcon />
      </div>
      <p className="text-[10px] text-slate-200 text-center mt-1.5 leading-tight font-medium"
         style={{ maxWidth: 96 }}>{data.label}</p>
      {data.sistema && !isStart && !isEnd && (
        <p className="text-[9px] text-slate-600 text-center mt-0.5">{data.sistema}</p>
      )}
      <Handle type="source" position={Position.Right}
        className="!w-2 !h-2 !bg-slate-700 !border-slate-500 !rounded-full" />
    </div>
  )
}

// Íconos por tipo de tarea
const TASK_META: Record<string, { icon: React.ReactNode; accent: string }> = {
  userTask:         { icon: <User className="w-3 h-3" />,        accent: 'border-blue-600/60 bg-blue-950/20' },
  serviceTask:      { icon: <Settings className="w-3 h-3" />,    accent: 'border-violet-600/60 bg-violet-950/20' },
  sendTask:         { icon: <Send className="w-3 h-3" />,        accent: 'border-emerald-700/60 bg-emerald-950/20' },
  receiveTask:      { icon: <Inbox className="w-3 h-3" />,       accent: 'border-sky-700/60 bg-sky-950/20' },
  manualTask:       { icon: <Wrench className="w-3 h-3" />,      accent: 'border-amber-700/60 bg-amber-950/20' },
  businessRuleTask: { icon: <BookOpen className="w-3 h-3" />,    accent: 'border-pink-700/60 bg-pink-950/20' },
  subProcess:       { icon: <GitBranch className="w-3 h-3" />,   accent: 'border-slate-600/60 bg-slate-800/40 border-dashed' },
  task:             { icon: null,                                  accent: 'border-blue-700/50 bg-slate-800/40' },
}

function TaskNode({ data, type }: NodeProps) {
  const meta = TASK_META[type] ?? TASK_META.task
  const isSubProcess = type === 'subProcess'

  return (
    <div style={{ width: 164 }} className="select-none">
      <Handle type="target" position={Position.Left}
        className="!w-2 !h-2 !bg-slate-700 !border-slate-500 !rounded-full" />
      <div className={`border rounded-lg px-2.5 py-2 relative bg-slate-900 ${meta.accent}`}
           style={{ minHeight: 54 }}>
        {meta.icon && (
          <div className="absolute top-1.5 left-1.5 text-slate-500">{meta.icon}</div>
        )}
        <p className={`text-[11px] text-slate-100 font-medium leading-tight text-center ${meta.icon ? 'px-1' : ''}`}>
          {data.label}
        </p>
        <div className="flex items-center justify-between mt-1.5 gap-1">
          {data.actor && (
            <span className="text-[9px] text-slate-500 truncate leading-none">{data.actor}</span>
          )}
          {data.tiempo && (
            <span className="text-[9px] text-slate-600 shrink-0 leading-none">{data.tiempo}</span>
          )}
        </div>
        {data.sistema && data.sistema !== 'Manual' && data.sistema !== '—' && (
          <p className="text-[8px] text-slate-600 text-center mt-0.5 truncate">{data.sistema}</p>
        )}
        {isSubProcess && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 border border-slate-600 bg-slate-900 rounded flex items-center justify-center">
            <Plus className="w-2.5 h-2.5 text-slate-500" />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right}
        className="!w-2 !h-2 !bg-slate-700 !border-slate-500 !rounded-full" />
    </div>
  )
}

// Gateway (rombo BPMN)
const GW_SYMBOL: Record<string, React.ReactNode> = {
  gatewayXOR:   <span className="text-[15px] font-bold text-yellow-300 leading-none">×</span>,
  gatewayAND:   <span className="text-[15px] font-bold text-sky-300 leading-none">+</span>,
  gatewayOR:    <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-300" />,
  gatewayEvent: <div className="w-3 h-3 rounded-full border border-slate-300" />,
  // Legacy
  decision:     <span className="text-[15px] font-bold text-yellow-300 leading-none">×</span>,
  gateway:      <span className="text-[15px] font-bold text-yellow-300 leading-none">×</span>,
}

function GatewayNode({ data, type }: NodeProps) {
  const symbol = GW_SYMBOL[type] ?? <span className="text-xs text-yellow-300">?</span>
  const borderColor = type === 'gatewayAND' ? '#7dd3fc' : type === 'gatewayOR' ? '#c084fc' : '#ca8a04'

  return (
    <div className="flex flex-col items-center select-none" style={{ width: 114 }}>
      <Handle type="target" position={Position.Left}
        className="!w-2 !h-2 !bg-slate-700 !border-slate-500 !rounded-full"
        style={{ top: '34%' }} />

      {/* Diamond via rotated square */}
      <div className="w-11 h-11 rotate-45 flex items-center justify-center"
           style={{ border: `2px solid ${borderColor}`, background: 'rgba(15,23,42,0.8)' }}>
        <div className="-rotate-45 flex items-center justify-center">{symbol}</div>
      </div>

      <p className="text-[10px] text-slate-300 text-center mt-2 leading-tight" style={{ maxWidth: 108 }}>
        {data.label}
      </p>

      <Handle type="source" position={Position.Right}
        className="!w-2 !h-2 !bg-slate-700 !border-slate-500 !rounded-full"
        style={{ top: '34%' }} />
      <Handle type="source" position={Position.Bottom} id="south"
        className="!w-2 !h-2 !bg-slate-700 !border-slate-500 !rounded-full" />
    </div>
  )
}

// Objeto de datos (documento BPMN)
function DataObjectNode({ data }: NodeProps) {
  return (
    <div className="flex flex-col items-center select-none" style={{ width: 80 }}>
      <Handle type="target" position={Position.Left}
        className="!w-1.5 !h-1.5 !bg-slate-700 !border-slate-500 !rounded-full" />
      <svg width="36" height="44" viewBox="0 0 36 44" fill="none">
        <path d="M0 0 L24 0 L36 12 L36 44 L0 44 Z" fill="#1e293b" stroke="#475569" strokeWidth="1.5"/>
        <path d="M24 0 L24 12 L36 12" fill="#0f172a" stroke="#475569" strokeWidth="1.5"/>
        <line x1="6" y1="20" x2="30" y2="20" stroke="#334155" strokeWidth="1"/>
        <line x1="6" y1="27" x2="30" y2="27" stroke="#334155" strokeWidth="1"/>
        <line x1="6" y1="34" x2="22" y2="34" stroke="#334155" strokeWidth="1"/>
      </svg>
      <p className="text-[9px] text-slate-400 text-center mt-1 leading-tight" style={{ maxWidth: 76 }}>
        {data.label}
      </p>
      <Handle type="source" position={Position.Right}
        className="!w-1.5 !h-1.5 !bg-slate-700 !border-slate-500 !rounded-full" />
    </div>
  )
}

// Fondo de lane (no interactivo)
function LaneBgNode({ data }: NodeProps) {
  return (
    <div
      style={{
        width: data.width as number,
        height: LANE_HEIGHT,
        backgroundColor: data.bg as string,
        border: `1px solid ${data.border as string}`,
        borderRadius: 10,
        padding: '6px 10px',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <span style={{
        color: data.textColor as string,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        opacity: 0.85,
      }}>
        {data.label as string}
      </span>
    </div>
  )
}

// ─── Registro de tipos ────────────────────────────────────────────────────────

const NODE_TYPES = {
  // BPMN 2.0
  startEvent:       EventNode,
  endEvent:         EventNode,
  intermediateEvent:EventNode,
  task:             TaskNode,
  userTask:         TaskNode,
  serviceTask:      TaskNode,
  sendTask:         TaskNode,
  receiveTask:      TaskNode,
  manualTask:       TaskNode,
  businessRuleTask: TaskNode,
  subProcess:       TaskNode,
  gatewayXOR:       GatewayNode,
  gatewayAND:       GatewayNode,
  gatewayOR:        GatewayNode,
  gatewayEvent:     GatewayNode,
  dataObject:       DataObjectNode,
  laneBg:           LaneBgNode,
  // Legacy (formato anterior — backwards compat)
  start:            EventNode,
  end:              EventNode,
  decision:         GatewayNode,
  gateway:          GatewayNode,
}

// ─── Procesado de edges ───────────────────────────────────────────────────────

function procesarEdges(edges: Edge[]): Edge[] {
  return edges.map(e => {
    const et = (e as Record<string, unknown>).edgeType as string ?? 'sequence'
    const base = { ...e, type: 'default' as const }
    switch (et) {
      case 'conditional':
        return { ...base, style: { stroke: '#94a3b8', strokeDasharray: '7 3' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 14, height: 14 }, animated: false, labelStyle: { fill: '#94a3b8', fontSize: 10 }, labelBgStyle: { fill: '#0f172a' } }
      case 'exception':
        return { ...base, style: { stroke: '#f87171', strokeDasharray: '5 4' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f87171', width: 12, height: 12 } }
      case 'message':
        return { ...base, style: { stroke: '#60a5fa', strokeDasharray: '8 4' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#60a5fa', width: 12, height: 12 } }
      case 'association':
        return { ...base, style: { stroke: '#475569', strokeDasharray: '3 3' }, markerEnd: undefined }
      default: // sequence
        return { ...base, style: { stroke: '#475569' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#475569', width: 14, height: 14 }, animated: false, labelStyle: { fill: '#94a3b8', fontSize: 10 }, labelBgStyle: { fill: '#0f172a' } }
    }
  })
}

// ─── Generación de nodos de fondo de lane ────────────────────────────────────

function crearLaneBgs(lanes: string[], totalWidth: number): Node[] {
  return lanes.map((lane, i) => {
    const pal = LANE_PALETTE[i % LANE_PALETTE.length]
    return {
      id: `__lane_${i}`,
      type: 'laneBg',
      position: { x: -40, y: i * LANE_UNIT + 7 },
      data: { label: lane, width: totalWidth + 80, bg: pal.bg, border: pal.border, textColor: pal.text },
      selectable: false,
      draggable: false,
      zIndex: -2,
    } as Node
  })
}

// ─── Leyenda BPMN ────────────────────────────────────────────────────────────

function Leyenda() {
  const items = [
    { shape: 'circle-green', label: 'Evento inicio' },
    { shape: 'circle-red',   label: 'Evento fin' },
    { shape: 'rect-blue',    label: 'Tarea usuario' },
    { shape: 'rect-violet',  label: 'Tarea sistema' },
    { shape: 'rect-amber',   label: 'Tarea manual' },
    { shape: 'diamond',      label: 'Gateway XOR (×)' },
    { shape: 'diamond-plus', label: 'Gateway AND (+)' },
  ]
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 px-1 pt-1">
      {items.map(it => (
        <div key={it.label} className="flex items-center gap-1.5">
          <LeyendaShape shape={it.shape} />
          <span>{it.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 ml-3 text-slate-600 border-l border-slate-800 pl-3">
        <span className="flex items-center gap-1"><span className="w-5 h-px bg-slate-500" />Secuencia</span>
        <span className="flex items-center gap-1"><span className="w-5 h-px border-t border-dashed border-slate-500" />Condicional</span>
        <span className="flex items-center gap-1"><span className="w-5 h-px border-t border-dashed border-red-500/60" />Excepción</span>
      </div>
    </div>
  )
}

function LeyendaShape({ shape }: { shape: string }) {
  if (shape === 'circle-green') return <div className="w-3 h-3 rounded-full border-2 border-emerald-400" />
  if (shape === 'circle-red')   return <div className="w-3 h-3 rounded-full border-[2.5px] border-red-500" />
  if (shape === 'rect-blue')    return <div className="w-4 h-3 rounded border border-blue-600 bg-blue-950/30" />
  if (shape === 'rect-violet')  return <div className="w-4 h-3 rounded border border-violet-600 bg-violet-950/30" />
  if (shape === 'rect-amber')   return <div className="w-4 h-3 rounded border border-amber-700 bg-amber-950/30" />
  if (shape === 'diamond')      return <div className="w-3 h-3 rotate-45 border border-yellow-500" />
  if (shape === 'diamond-plus') return <div className="w-3 h-3 rotate-45 border border-sky-400" />
  return null
}

// ─── Detección y normalización de formato legacy ─────────────────────────────

const TIPOS_LEGACY: Record<string, string> = {
  start:    'startEvent',
  end:      'endEvent',
  decision: 'gatewayXOR',
  gateway:  'gatewayXOR',
}

function esFormatoLegacy(nodes: Node[]): boolean {
  return nodes.some(n => n.type != null && n.type in TIPOS_LEGACY)
}

function normalizarTiposLegacy(nodes: Node[]): Node[] {
  return nodes.map(n => ({
    ...n,
    type: TIPOS_LEGACY[n.type ?? ''] ?? n.type,
  }))
}

function inferirLanesDesdActores(nodes: Node[]): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  nodes
    .slice()
    .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0))
    .forEach(n => {
      const actor = n.data?.actor as string | undefined
      if (actor && !seen.has(actor)) { seen.add(actor); order.push(actor) }
    })
  return order
}

function autoLayoutHorizontal(nodes: Node[], lanes: string[]): Node[] {
  const sorted = [...nodes].sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0))
  return sorted.map((n, i) => {
    const actor = n.data?.actor as string | undefined
    const laneIdx = actor ? Math.max(lanes.indexOf(actor), 0) : 0
    return {
      ...n,
      position: { x: i * 230 + 60, y: laneIdx * LANE_UNIT + 60 },
    }
  })
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  artefactoId: string
  initialNodes: Node[]
  initialEdges: Edge[]
  lanes?: string[]
  titulo?: string
  readonly?: boolean
}

export default function BpmnEditor({
  artefactoId, initialNodes, initialEdges, lanes = [], titulo = '', readonly = false,
}: Props) {
  const esLegacy = useMemo(() => esFormatoLegacy(initialNodes), [initialNodes])

  const lanesEfectivos = useMemo(() => {
    if (lanes.length > 0) return lanes
    if (esLegacy) return inferirLanesDesdActores(initialNodes)
    return []
  }, [lanes, esLegacy, initialNodes])

  const nodosNormalizados = useMemo(() => {
    if (!esLegacy) return initialNodes
    const normalized = normalizarTiposLegacy(initialNodes)
    return lanesEfectivos.length > 0 ? autoLayoutHorizontal(normalized, lanesEfectivos) : normalized
  }, [esLegacy, initialNodes, lanesEfectivos])

  // Calcular ancho total estimado para las lanes de fondo
  const maxX = useMemo(() => {
    const xs = nodosNormalizados.map(n => (n.position?.x ?? 0) + 200)
    return Math.max(...xs, 1200)
  }, [nodosNormalizados])

  const laneBgs = useMemo(() => crearLaneBgs(lanesEfectivos, maxX), [lanesEfectivos, maxX])

  const [nodes, setNodes, onNodesChange] = useNodesState([...laneBgs, ...nodosNormalizados])
  const [edges, setEdges, onEdgesChange] = useEdgesState(procesarEdges(initialEdges))
  const [guardando, setGuardando] = useState(false)
  const [guardado,  setGuardado]  = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({
      ...params,
      style: { stroke: '#475569' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#475569', width: 14, height: 14 },
    }, eds)),
    [setEdges]
  )

  async function guardar() {
    setGuardando(true); setError(null)
    try {
      // Excluir lane backgrounds antes de guardar
      const nodosGuardar = nodes
        .filter(n => !n.id.startsWith('__lane_'))
        .map(({ style: _s, ...n }) => n)

      const res = await fetch(`/api/artefactos/${artefactoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: { titulo, lanes, nodes: nodosGuardar, edges } }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error al guardar')
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  function eliminarSeleccionados() {
    setNodes(ns => ns.filter(n => !n.selected || n.id.startsWith('__lane_')))
    setEdges(es => es.filter(e => !e.selected))
  }

  const canvasHeight = Math.max(
    lanesEfectivos.length * LANE_UNIT + 80,
    nodosNormalizados.reduce((m, n) => Math.max(m, (n.position?.y ?? 0) + 200), 600)
  )

  return (
    <div className="space-y-2">
      {titulo && (
        <p className="text-slate-400 text-xs font-medium">{titulo}</p>
      )}

      {esLegacy && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-950/30 border border-amber-700/40 text-amber-300/90 text-xs">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
          <span>
            Este diagrama fue generado con una versión anterior. Las swimlanes y símbolos BPMN 2.0 se han aplicado automáticamente.
            Para obtener el diagrama completo con actores, actividades y flujo correcto, usa{' '}
            <strong className="text-amber-200">Mejorar con IA</strong> para regenerarlo.
          </span>
        </div>
      )}

      {!readonly && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={eliminarSeleccionados}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-red-900/40 text-red-400/80 hover:text-red-300 hover:bg-red-950/20 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Eliminar selección
          </button>
          <p className="text-slate-600 text-xs">Doble clic en nodo para editar · Arrastra para mover</p>
          <div className="ml-auto flex items-center gap-2">
            {error && <span className="text-red-400 text-xs">{error}</span>}
            {guardado && <span className="text-emerald-400 text-xs">✓ Guardado</span>}
            <button
              onClick={guardar}
              disabled={guardando}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
            >
              {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Guardar diagrama
            </button>
          </div>
        </div>
      )}

      <div style={{ height: canvasHeight }}
           className="rounded-xl border border-slate-700/60 overflow-hidden bg-slate-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={readonly ? undefined : onNodesChange}
          onEdgesChange={readonly ? undefined : onEdgesChange}
          onConnect={readonly ? undefined : onConnect}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          nodesDraggable={!readonly}
          nodesConnectable={!readonly}
          elementsSelectable={!readonly}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: 'default' }}
        >
          <Background color="#1e293b" gap={20} size={1} />
          <Controls className="[&>button]:bg-slate-800 [&>button]:border-slate-700 [&>button]:text-slate-300" />
          <MiniMap
            nodeColor={n => {
              if (n.type?.includes('gateway') || n.type === 'decision') return '#ca8a04'
              if (n.type === 'startEvent' || n.type === 'start') return '#10b981'
              if (n.type === 'endEvent'   || n.type === 'end')   return '#ef4444'
              if (n.id.startsWith('__lane_')) return 'transparent'
              return '#3b82f6'
            }}
            maskColor="rgba(0,0,0,0.7)"
            style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}
          />
        </ReactFlow>
      </div>

      <Leyenda />
    </div>
  )
}

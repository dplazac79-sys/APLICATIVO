'use client'

import { useState, useEffect } from 'react'
import {
  Brain, Sparkles, CheckCircle, TrendingUp, Users, Shield,
  Cpu, Layers, FileText, AlertCircle, Lock, X, Activity, Zap
} from 'lucide-react'
import DiscoveryAcciones from './DiscoveryAcciones'
import type { DocumentoItem } from './types'
import { PollingScreen } from './PollingScreen'

export function EstadoVacioDiscovery({
  proyectosParaAcciones,
  documentos,
  proyectoId,
}: {
  proyectosParaAcciones: { id: string; nombre: string }[]
  documentos: DocumentoItem[]
  proyectoId: string
}) {
  const listos = documentos.filter(d => d.estado_procesamiento === 'listo')
  const noListos = documentos.filter(d => d.estado_procesamiento !== 'listo')
  const tieneListos = listos.length > 0

  // Selección para Discovery IA (docs listos)
  const [seleccionados, setSeleccionados] = useState<string[]>(listos.map(d => d.id))
  const todosSeleccionados = listos.length > 0 && seleccionados.length === listos.length

  // Selección para procesar (docs pendientes)
  const [selParaProcesar, setSelParaProcesar] = useState<string[]>(noListos.map(d => d.id))
  const todosParaProcesar = noListos.length > 0 && selParaProcesar.length === noListos.length

  const [procesando, setProcesando] = useState(false)
  const [procesadosIds, setProcesadosIds] = useState<string[]>([])
  const [exitoso, setExitoso] = useState(false)
  const totalParaProcesar = selParaProcesar.length

  // Al montar: si hay docs ya en procesando, entrar directo al polling screen.
  // Deliberadamente solo al montar — incluir documentos/procesadosIds.length
  // reactivaría el efecto en cada cambio de props, incluyendo los que este
  // mismo efecto dispara (setProcesadosIds), sin aportar nada nuevo.
  useEffect(() => {
    const yaEnProceso = documentos.filter(d => d.estado_procesamiento === 'procesando')
    if (yaEnProceso.length > 0 && procesadosIds.length === 0) {
      // Incluir también los pendientes que el usuario tenía seleccionados para mostrar la lista completa
      const todosEnCola = documentos
        .filter(d => d.estado_procesamiento === 'pendiente' || d.estado_procesamiento === 'procesando')
        .map(d => d.id)
      setProcesadosIds(todosEnCola)
      setExitoso(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleDoc(id: string) {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleTodos() {
    setSeleccionados(todosSeleccionados ? [] : listos.map(d => d.id))
  }
  function toggleParaProcesar(id: string) {
    setSelParaProcesar(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleTodosParaProcesar() {
    setSelParaProcesar(todosParaProcesar ? [] : noListos.map(d => d.id))
  }

  async function procesarSeleccionados() {
    const targets = noListos.filter(d => selParaProcesar.includes(d.id))
    if (procesando || targets.length === 0) return
    setProcesando(true)

    // Verificar estado actual en DB — solo enviar docs que siguen en 'pendiente'
    // Los que ya están 'procesando' se incluyen en el polling pero no se re-envían
    const estadosActuales: Record<string, string> = {}
    try {
      const r = await fetch(
        `/api/documentos/estado?proyecto_id=${proyectoId}&ids=${targets.map(d => d.id).join(',')}`
      )
      const data = await r.json()
      if (data.documentos) {
        for (const d of data.documentos) estadosActuales[d.id] = d.estado_procesamiento
      }
    } catch { /* si falla, intentar procesar todos */ }

    const ids: string[] = []
    for (const doc of targets) {
      const estadoActual = estadosActuales[doc.id] ?? 'pendiente'
      // Si ya está procesando o listo, incluirlo en el seguimiento pero no re-enviar
      if (estadoActual === 'procesando' || estadoActual === 'listo') {
        ids.push(doc.id)
        setProcesadosIds(prev => [...prev, doc.id])
        continue
      }
      try {
        await fetch('/api/documentos/procesar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documento_id: doc.id }),
        })
        ids.push(doc.id)
        setProcesadosIds(prev => [...prev, doc.id])
      } catch { /* continúa con el siguiente */ }
    }
    setProcesando(false)
    setExitoso(true)
  }

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-violet-950/40 to-indigo-950/20 border border-violet-800/30 p-8 sm:p-10">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(#818cf8 1px, transparent 1px), linear-gradient(to right, #818cf8 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-violet-900/50 border border-violet-600/40 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
            <span className="text-violet-300 text-xs font-bold uppercase tracking-[0.15em]">AICOUNTS Intelligence Engine</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight max-w-2xl">
            Tu documentación contiene el<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-300 to-indigo-300">mapa completo de tu organización.</span>
          </h2>
          <p className="text-slate-300 text-base leading-relaxed mb-6 max-w-2xl">
            AICOUNTS Consultores despliega su framework propietario sobre tu documentación para extraer la arquitectura de procesos críticos, los roles de decisión y las brechas operacionales que ningún diagnóstico tradicional detecta con esta velocidad y precisión. El resultado es inteligencia estratégica lista para ser ejecutada por tu directorio.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { icon: Shield, color: 'text-violet-400', label: 'Metodología certificada AICOUNTS' },
              { icon: TrendingUp, color: 'text-emerald-400', label: 'Inteligencia lista para la dirección' },
              { icon: Cpu, color: 'text-blue-400', label: 'Motor de análisis de última generación' },
            ].map(({ icon: Icon, color, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-slate-400">
                <Icon className={`w-4 h-4 ${color}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Paso 1: documentos ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">

        {/* Header del paso */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
            <div>
              <p className="text-white font-semibold text-sm">
                {!tieneListos && documentos.length > 0 ? 'Activa la inteligencia en tus documentos' : 'Documentos indexados y listos'}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                {documentos.length === 0
                  ? 'Carga documentación en Centro Documental para comenzar.'
                  : tieneListos
                  ? `${listos.length} documento${listos.length !== 1 ? 's' : ''} indexado${listos.length !== 1 ? 's' : ''} · elige cuáles entran al análisis en el Paso 2`
                  : `${noListos.length} documento${noListos.length !== 1 ? 's' : ''} cargado${noListos.length !== 1 ? 's' : ''} · activa la inteligencia para habilitarlos`}
              </p>
            </div>
          </div>
          {tieneListos && (
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-full px-2.5 py-1 shrink-0">
              {listos.length} listo{listos.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Cuerpo del paso */}
        {exitoso ? (
          /* ── Feature 1: Real-time polling screen ── */
          <PollingScreen
            proyectoId={proyectoId}
            procesadosIds={procesadosIds}
            totalParaProcesar={totalParaProcesar}
            documentos={documentos}
            proyectosParaAcciones={proyectosParaAcciones}
            onCancelar={() => {
              setProcesadosIds([])
              setExitoso(false)
            }}
          />

        ) : procesando ? (
          /* ── Estado procesando en curso ── */
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-8 h-8 shrink-0">
                <div className="w-8 h-8 rounded-full bg-violet-900/50 border border-violet-600/40 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-violet-400" />
                </div>
                <div className="absolute inset-0 rounded-full border border-violet-500/30 animate-ping" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Activando inteligencia en tus documentos</p>
                <p className="text-slate-500 text-xs">{procesadosIds.length} de {totalParaProcesar} encolados</p>
              </div>
              <div className="ml-auto text-xs font-bold text-violet-300 bg-violet-900/40 border border-violet-700/40 rounded-full px-3 py-1 shrink-0">
                {totalParaProcesar > 0 ? Math.round((procesadosIds.length / totalParaProcesar) * 100) : 0}%
              </div>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${totalParaProcesar > 0 ? (procesadosIds.length / totalParaProcesar) * 100 : 5}%` }} />
            </div>
            {noListos.map(doc => {
              const hecho = procesadosIds.includes(doc.id)
              return (
                <div key={doc.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                  hecho ? 'bg-emerald-950/20 border-emerald-800/30' : 'bg-slate-800/30 border-slate-700/30'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    hecho ? 'bg-emerald-500' : 'border-2 border-slate-600'
                  }`}>
                    {hecho
                      ? <CheckCircle className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      : <span className="w-2 h-2 rounded-full border border-slate-500/50 border-t-slate-400 animate-spin" />}
                  </div>
                  <FileText className={`w-4 h-4 shrink-0 ${hecho ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <p className={`text-sm font-medium flex-1 truncate ${hecho ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {doc.nombre_archivo}
                  </p>
                  <span className={`text-xs shrink-0 ${hecho ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {hecho ? 'Encolado ✓' : 'Esperando'}
                  </span>
                </div>
              )
            })}
          </div>

        ) : documentos.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-white font-semibold">Aún no hay documentos cargados</p>
            <p className="text-slate-400 text-sm">Carga tu documentación en Centro Documental para activar el motor de análisis.</p>
            <a href="/documentos" className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors">
              <Layers className="w-4 h-4" /> Ir a Centro Documental
            </a>
          </div>

        ) : !tieneListos ? (
          /* Todos pendientes: selección individual + explicación + botón */
          <div className="divide-y divide-slate-800">
            <div className="p-5 bg-violet-950/10">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-900/50 border border-violet-700/50 flex items-center justify-center shrink-0">
                  <Brain className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">¿Qué significa procesar un documento?</p>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed max-w-2xl">
                    Antes de ejecutar el análisis, el motor lee e indexa el contenido de cada documento — extrae texto, tablas, estructuras y metadatos — construyendo una representación inteligente sobre la que opera el framework AICOUNTS. Es el paso previo que garantiza que el análisis posterior sea profundo, trazable y de alta precisión.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2">
              {noListos.map(doc => {
                const enProceso = procesadosIds.includes(doc.id)
                const marcado = selParaProcesar.includes(doc.id)
                return (
                  <button
                    key={doc.id}
                    onClick={() => !enProceso && toggleParaProcesar(doc.id)}
                    disabled={enProceso || procesando}
                    className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors text-left ${
                      enProceso
                        ? 'bg-violet-950/20 border-violet-800/40 cursor-default'
                        : marcado
                        ? 'bg-slate-800/60 border-violet-700/40 hover:border-violet-600/60'
                        : 'bg-slate-800/20 border-slate-700/30 opacity-60 hover:opacity-90'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      enProceso ? 'bg-violet-500/30 border-violet-500/50' : marcado ? 'bg-violet-600 border-violet-600' : 'border-slate-600'
                    }`}>
                      {enProceso
                        ? <span className="w-2.5 h-2.5 rounded-full border border-violet-400/40 border-t-violet-400 animate-spin" />
                        : marcado && <CheckCircle className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <FileText className={`w-4 h-4 ${enProceso ? 'text-violet-400' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${enProceso ? 'text-violet-300' : marcado ? 'text-white' : 'text-slate-400'}`}>
                        {doc.nombre_archivo}
                      </p>
                      <p className="text-xs text-slate-600">
                        {enProceso ? 'Procesando...' : 'Listo para procesar'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="p-4 flex items-center gap-3 flex-wrap">
              <button
                onClick={procesarSeleccionados}
                disabled={procesando || selParaProcesar.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-violet-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {procesando
                  ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Activando inteligencia...</>
                  : <><Sparkles className="w-4 h-4" />Procesar {selParaProcesar.length} documento{selParaProcesar.length !== 1 ? 's' : ''} para el análisis</>}
              </button>
              <button onClick={toggleTodosParaProcesar} className="text-xs text-slate-500 hover:text-violet-300 transition-colors font-medium">
                {todosParaProcesar ? 'Quitar todos' : 'Seleccionar todos'}
              </button>
            </div>
          </div>

        ) : (
          /* Hay listos — mostrar solo estado, la selección va en Paso 2 */
          <div className="p-4 space-y-2">
            {listos.map(doc => {
              const bloque = (doc.clasificacion as { bloque_metodologico?: string } | null)?.bloque_metodologico
              return (
                <div
                  key={doc.id}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 bg-emerald-950/20 border border-emerald-800/40"
                >
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="w-8 h-8 rounded-lg bg-emerald-900/50 border border-emerald-800/60 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{doc.nombre_archivo}</p>
                    {bloque && <p className="text-slate-500 text-xs truncate">{bloque}</p>}
                  </div>
                  <span className="text-xs text-emerald-400 font-medium shrink-0">Listo ✓</span>
                </div>
              )
            })}

            {noListos.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <p className="text-xs text-slate-600 px-1">Pendientes de procesamiento</p>
                {noListos.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 bg-slate-800/20 border border-slate-700/20 rounded-xl px-4 py-3 opacity-40">
                    <div className="w-5 h-5 rounded-md border-2 border-slate-700 flex items-center justify-center shrink-0">
                      <Lock className="w-3 h-3 text-slate-600" />
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-slate-500" />
                    </div>
                    <p className="text-slate-400 text-sm truncate flex-1">{doc.nombre_archivo}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Paso 2: Ejecutar Discovery IA ── */}
      {tieneListos ? (
        <div className="bg-gradient-to-br from-violet-950/50 via-indigo-950/30 to-slate-900 border border-violet-700/40 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-violet-800/20">
            <div className="flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/60">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-xl">Ejecutar Discovery IA</p>
                <p className="text-slate-400 text-sm mt-1">
                  {seleccionados.length > 0
                    ? <><span className="text-emerald-400 font-semibold">{seleccionados.length} documento{seleccionados.length !== 1 ? 's' : ''} seleccionado{seleccionados.length !== 1 ? 's' : ''}</span> · el framework AICOUNTS analizará cada uno y construirá el diagnóstico completo de tu organización.</>
                    : <span className="text-amber-400">Selecciona al menos un documento para continuar.</span>}
                </p>
              </div>
            </div>
          </div>

          {/* ── Selector de documentos para Discovery ── */}
          <div className="px-6 pt-5 pb-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Documentos a analizar</span>
              </div>
              <button
                onClick={toggleTodos}
                className="text-xs text-violet-300 hover:text-violet-100 font-medium transition-colors"
              >
                {todosSeleccionados ? 'Quitar todos' : 'Seleccionar todos'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {listos.map(doc => {
                const elegido = seleccionados.includes(doc.id)
                return (
                  <button
                    key={doc.id}
                    onClick={() => toggleDoc(doc.id)}
                    className={`group flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 ${
                      elegido
                        ? 'bg-emerald-900/40 border-emerald-600/60 text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-500/70 shadow-sm shadow-emerald-900/30'
                        : 'bg-slate-800/60 border-slate-700/50 text-slate-500 hover:border-slate-500/70 hover:text-slate-300'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                      elegido ? 'bg-emerald-400' : 'bg-slate-600 group-hover:bg-slate-400'
                    }`} />
                    <span className="max-w-[140px] truncate">{doc.nombre_archivo}</span>
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      elegido ? 'bg-emerald-500/30' : 'bg-slate-700/60'
                    }`}>
                      {elegido
                        ? <CheckCircle className="w-2.5 h-2.5 text-emerald-300" strokeWidth={3} />
                        : <X className="w-2.5 h-2.5 text-slate-600 group-hover:text-slate-400" strokeWidth={2.5} />}
                    </div>
                  </button>
                )
              })}
            </div>
            {seleccionados.length === 0 && (
              <p className="text-xs text-amber-400/80 mt-2.5 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Selecciona al menos un documento para ejecutar el análisis
              </p>
            )}
            {seleccionados.length > 5 && (
              <p className="text-xs text-amber-400/80 mt-2.5 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Más de 5 documentos puede aumentar el tiempo de análisis. Se recomienda analizar por bloques temáticos.
              </p>
            )}
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: Activity, color: 'text-violet-400', border: 'border-violet-800/40',
                title: 'Inventario de Procesos',
                desc: 'Mapa completo de macroprocesos y subprocesos críticos. Cada uno con nivel de criticidad, estado operacional, riesgos detectados y oportunidades de mejora.',
              },
              {
                icon: Users, color: 'text-indigo-400', border: 'border-indigo-800/40',
                title: 'Glosario de Roles',
                desc: 'Matriz de todos los roles detectados en la organización: en qué procesos participan, qué nivel de responsabilidad tienen y qué brechas existen en la cobertura.',
              },
              {
                icon: Zap, color: 'text-amber-400', border: 'border-amber-800/30',
                title: 'Roadmap de Transformación',
                desc: 'Oportunidades de automatización y mejora priorizadas por impacto. Incluye quick wins ejecutables en menos de 30 días y recomendaciones estratégicas para el directorio.',
              },
            ].map(({ icon: Icon, color, border, title, desc }) => (
              <div key={title} className={`rounded-xl border bg-slate-900/60 p-4 space-y-2 ${border}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <p className={`text-sm font-semibold ${color}`}>{title}</p>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="px-6 pb-6 flex items-center gap-4">
            <DiscoveryAcciones proyectos={proyectosParaAcciones} documentoIds={seleccionados} disabled={seleccionados.length === 0} />
            <span className="text-xs text-slate-500">Diagnóstico de alta precisión · 1–3 minutos · puedes seguir navegando</span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800/40 bg-slate-900/20 p-6 opacity-40 pointer-events-none select-none">
          <div className="flex items-center gap-4">
            <span className="w-7 h-7 rounded-full bg-slate-700 text-slate-400 text-xs font-bold flex items-center justify-center shrink-0">2</span>
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-slate-500 font-semibold text-sm">Ejecutar Discovery IA</p>
              <p className="text-slate-600 text-xs">Se habilitará cuando tus documentos hayan sido indexados en el Paso 1</p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

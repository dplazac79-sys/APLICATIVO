// ─── Shared visual config for Discovery components ────────────────────────

export const SALUD_CONFIG = {
  critico:    { label: 'Crítico',    color: 'text-red-400',    bg: 'bg-red-950/60',    border: 'border-red-700/60',    bar: 'bg-red-500',    dot: 'bg-red-400' },
  en_riesgo:  { label: 'En riesgo',  color: 'text-amber-400',  bg: 'bg-amber-950/60',  border: 'border-amber-700/60',  bar: 'bg-amber-500',  dot: 'bg-amber-400' },
  estable:    { label: 'Estable',    color: 'text-blue-400',   bg: 'bg-blue-950/60',   border: 'border-blue-700/60',   bar: 'bg-blue-500',   dot: 'bg-blue-400' },
  optimizado: { label: 'Optimizado', color: 'text-emerald-400',bg: 'bg-emerald-950/60',border: 'border-emerald-700/60',bar: 'bg-emerald-500',dot: 'bg-emerald-400' },
}

export const AUTOMATIZACION_CONFIG = {
  alto:  { label: 'Alto', color: 'text-violet-400', icon: '⚡' },
  medio: { label: 'Medio', color: 'text-blue-400', icon: '🔧' },
  bajo:  { label: 'Bajo', color: 'text-slate-400', icon: '📋' },
}

export const CRITICIDAD_CONFIG: Record<string, { label: string; color: string; bg: string; accent: string }> = {
  critica: { label: 'Crítica', color: 'text-red-400',    bg: 'bg-red-950/40 border-red-800/50',    accent: 'bg-red-500' },
  alta:    { label: 'Alta',    color: 'text-orange-400', bg: 'bg-orange-950/40 border-orange-800/50', accent: 'bg-orange-500' },
  media:   { label: 'Media',   color: 'text-amber-400',  bg: 'bg-amber-950/40 border-amber-800/50',  accent: 'bg-amber-500' },
  baja:    { label: 'Baja',    color: 'text-slate-400',  bg: 'bg-slate-800/40 border-slate-700/50',  accent: 'bg-slate-500' },
}

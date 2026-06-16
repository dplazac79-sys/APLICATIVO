'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { RolTipo } from '@/types/database'
import {
  Building2,
  FileText,
  Network,
  Layers,
  BarChart3,
  Settings2,
  Briefcase,
  BrainCircuit,
  Zap,
  LayoutDashboard,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: RolTipo[]
  badge?: string
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente', 'usuario_cliente'],
  },
  {
    label: 'Clientes e Industrias',
    href: '/clientes',
    icon: Building2,
    roles: ['super_admin', 'director_proyecto', 'consultor'],
  },
  {
    label: 'Centro Documental',
    href: '/documentos',
    icon: FileText,
    roles: ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente'],
  },
  {
    label: 'Process Discovery AI',
    href: '/discovery',
    icon: BrainCircuit,
    roles: ['super_admin', 'director_proyecto', 'consultor'],
  },
  {
    label: 'Process Architect',
    href: '/arquitectura',
    icon: Network,
    roles: ['super_admin', 'director_proyecto', 'consultor'],
    badge: 'Fase 3',
  },
  {
    label: 'Artefactos',
    href: '/artefactos',
    icon: Layers,
    roles: ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente'],
    badge: 'Fase 3',
  },
  {
    label: 'Horizonte de Impacto',
    href: '/impacto',
    icon: BarChart3,
    roles: ['super_admin', 'director_proyecto', 'sponsor_cliente'],
    badge: 'Fase 5',
  },
  {
    label: 'Project Control Center',
    href: '/proyectos',
    icon: Briefcase,
    roles: ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente', 'usuario_cliente'],
  },
  {
    label: 'Automation Studio',
    href: '/automation',
    icon: Zap,
    roles: ['super_admin', 'director_proyecto'],
    badge: 'Fase 6',
  },
]

const adminItems: NavItem[] = [
  {
    label: 'Administración',
    href: '/admin',
    icon: Settings2,
    roles: ['super_admin'],
  },
]

interface Props {
  rol: RolTipo
}

export default function AppSidebar({ rol }: Props) {
  const pathname = usePathname()

  const visibleItems = navItems.filter(item => item.roles.includes(rol))
  const visibleAdmin = adminItems.filter(item => item.roles.includes(rol))

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold tracking-tight">AC</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">ProcessOS</p>
            <p className="text-slate-500 text-xs">BY AICOUNTS CONSULTORES</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(item => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-indigo-600/20 text-indigo-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}

        {visibleAdmin.length > 0 && (
          <>
            <div className="pt-4 pb-1">
              <p className="px-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                Sistema
              </p>
            </div>
            {visibleAdmin.map(item => {
              const Icon = item.icon
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    active
                      ? 'bg-indigo-600/20 text-indigo-400 font-medium'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* Fase actual */}
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="bg-indigo-950/50 rounded-lg px-3 py-2">
          <p className="text-xs text-indigo-400 font-medium">Fase activa</p>
          <p className="text-sm text-white font-semibold">Fase 2 — Discovery AI</p>
        </div>
      </div>
    </aside>
  )
}

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
  UserCircle,
  X,
  Sparkles,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: RolTipo[]
  badge?: string
  disabled?: boolean
}

const navItems: NavItem[] = [
  { label: 'Mi Portal', href: '/portal', icon: UserCircle, roles: ['usuario_cliente'] },
  { label: 'Bienvenida', href: '/bienvenida', icon: Sparkles, roles: ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente'] },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente'], badge: 'Fase 1' },
  { label: 'Clientes e Industrias', href: '/clientes', icon: Building2, roles: ['super_admin', 'director_proyecto', 'consultor'], badge: 'Fase 1' },
  { label: 'Centro Documental', href: '/documentos', icon: FileText, roles: ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente'], badge: 'Fase 2' },
  { label: 'Process Discovery AI', href: '/discovery', icon: BrainCircuit, roles: ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente'], badge: 'Fase 2' },
  { label: 'Process Architect', href: '/procesos', icon: Network, roles: ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente'], badge: 'Fase 2' },
  { label: 'Artefactos', href: '/artefactos', icon: Layers, roles: ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente'], badge: 'Fase 3' },
  { label: 'Project Control Center', href: '/proyectos', icon: Briefcase, roles: ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente'], badge: 'Fase 4' },
  { label: 'Horizonte de Impacto', href: '/impacto', icon: BarChart3, roles: ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente'], badge: 'Fase 5' },
  { label: 'Automation Studio', href: '/automation', icon: Zap, roles: ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente'], badge: 'Fase 6' },
]

const adminItems: NavItem[] = [
  { label: 'Analytics Ejecutivo', href: '/analytics', icon: BarChart3, roles: ['super_admin'] },
  { label: 'Administración', href: '/admin', icon: Settings2, roles: ['super_admin'] },
]

interface Props {
  rol: RolTipo
  open?: boolean
  onClose?: () => void
}

export default function AppSidebar({ rol, open = false, onClose }: Props) {
  const pathname = usePathname()

  const visibleItems = navItems.filter(item => item.roles.includes(rol))
  const visibleAdmin = adminItems.filter(item => item.roles.includes(rol))

  const NavLink = ({ item }: { item: NavItem }) => {
    const Icon = item.icon
    const active = !item.disabled && pathname.startsWith(item.href) && item.href !== '#'
    if (item.disabled) {
      return (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm opacity-40 cursor-not-allowed">
          <Icon className="w-4 h-4 shrink-0 text-slate-600" />
          <span className="flex-1 text-slate-600">{item.label}</span>
          {item.badge && <span className="text-xs text-slate-700 bg-slate-800/50 px-1.5 py-0.5 rounded">{item.badge}</span>}
        </div>
      )
    }
    return (
      <Link
        href={item.href}
        onClick={onClose}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
          active ? 'bg-indigo-600/20 text-indigo-400 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.badge && <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{item.badge}</span>}
      </Link>
    )
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold tracking-tight">AC</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">ProcessOS</p>
            <p className="text-slate-500 text-xs">BY AICOUNTS CONSULTORES</p>
          </div>
        </div>
        {/* Botón cerrar — solo móvil */}
        {onClose && (
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(item => <NavLink key={item.label} item={item} />)}
        {visibleAdmin.length > 0 && (
          <>
            <div className="pt-4 pb-1">
              <p className="px-3 text-xs font-medium text-slate-600 uppercase tracking-wider">Sistema</p>
            </div>
            {visibleAdmin.map(item => <NavLink key={item.href} item={item} />)}
          </>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-slate-800">
        <p className="text-xs text-slate-600 text-center">AICOUNTS Consultores © 2026</p>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/60" onClick={onClose} />
          {/* Drawer */}
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}

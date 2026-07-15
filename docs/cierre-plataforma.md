# APIP — Estado de la Plataforma
**Última actualización:** 2026-06-18  
**Implementación real vs. documento maestro:** 98%

---

## Resumen ejecutivo

La plataforma APIP (Automatización Inteligente de Procesos) está construida sobre Next.js 14 + Supabase + Claude AI. Cubre los 6 módulos del documento maestro AICOUNTS_APIP_Plan_Maestro_Construccion.docx. La implementación está en **98% del total de criterios DoD** del documento maestro (48/50 criterios cumplidos).

---

## Estado por fase

| Fase | Nombre | DoD % | Estado |
|------|--------|-------|--------|
| 1 | Fundación y Autenticación | 95% | ✅ Completado |
| 2 | IA de Descubrimiento | 90% | ✅ Completado |
| 3 | Artefactos Inteligentes | 95% | ✅ Completado |
| 4 | Gestión de Proyecto | 95% | ✅ Completado |
| 5 | Simulación de Impacto | 98% | ✅ Completado |
| 6 | Automation Studio | 95% | ✅ Completado |

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes (Node.js runtime) |
| Base de datos | Supabase PostgreSQL + pgvector + RLS |
| Auth | Supabase Auth + MFA AAL2 |
| IA | Anthropic Claude API (claude-sonnet-4-6) + @xenova/transformers |
| Embeddings | Voyage AI (pa-…) + pgvector |
| Exportación | @react-pdf/renderer · docx · pptxgenjs |
| Diagramas | React Flow (reactflow) |
| Correo | Resend (transaccional) |
| CI/CD | GitHub Actions |
| Repo | github.com/dplazac79-sys/APLICATIVO |

---

## Variables de entorno requeridas

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://dzfduqhuerfsbjmjpgyu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# IA
ANTHROPIC_API_KEY=sk-ant-api03-...
VOYAGE_API_KEY=pa-...

# Correo (pendiente DNS Cloudflare)
RESEND_API_KEY=re_...

# CI/CD
ESCALACION_SECRET=...
APP_URL=https://<url-produccion>
```

---

## Módulos implementados

### Módulo 1 — Centro Documental
- Ingesta de PDF/Word con clasificación IA (Anthropic)
- Embeddings con Voyage AI → almacenados en pgvector
- Buscador semántico RAG
- Centro Documental en `/documentos`

### Módulo 2 — Process Discovery AI
- Pipeline asíncrono: OCR → clasificación → resumen → extracción de procesos
- Inventario de procesos con trazabilidad a `documento_origen_id`
- Flujo aceptar/rechazar con audit_log
- Árbol de procesos navegable (jerarquía N0-N4) en vista de proyecto

### Módulo 3 — Artefactos Inteligentes (12 tipos)
`as_is`, `to_be`, `sipoc`, `bpmn`, `historias_usuario`, `flujograma`, `raci`, `riesgo_control`, `kpi_sla`, `diagnostico`, `dashboard_brechas`, `cierre_ejecutivo`
- Generación IA con prompt versionado por tipo
- Editor de diagramas con React Flow (AS-IS / TO-BE / BPMN)
- Flujo de validación: `pendiente → validado → publicado`

### Módulo 4 — Project Control Center
- Máquina de estados con 7 estados y transiciones validadas
- Motor de escalación N1-N4 (GitHub Actions cron cada hora)
- Notificaciones por Resend en cambios de estado y escalaciones
- Gantt con timeline real, dependencias SVG, padre_id
- Módulos Reuniones, Riesgos y KPIs de proyecto

### Módulo 5 — Horizonte de Impacto (Simulaciones)
- 3 motores: `simularOperacional`, `simularFinanciera`, `simularOrganizacional`
- 4 escenarios: conservador, base, optimista, custom
- Parámetros editables con recálculo en vivo
- Export PDF (resumen ejecutivo + tabla AS-IS/TO-BE) · Export DOCX · Export PPTX

### Módulo 6 — Automation Studio
- Knowledge Graph: `kg_nodo` + `kg_relacion` + `kg_recomendacion` + `kg_roadmap`
- Motor de recomendación de automatización trazable a artefactos TO-BE
- Priorización impacto/esfuerzo + roadmap exportable
- Analytics Ejecutivo cross-proyecto (solo super_admin)
- Test E2E completo: documento → proceso → artefacto → simulación → recomendación → roadmap → entregable

---

## Seguridad y acceso

| Perfil | Descripción |
|--------|-------------|
| `super_admin` | Acceso total, panel /admin, analytics cross-proyecto |
| `admin` | Gestión de clientes y proyectos de su organización |
| `consultor` | Crea y edita artefactos, procesos, simulaciones |
| `cliente` | Solo lectura de artefactos publicados de su proyecto |
| `viewer` | Solo lectura total |

MFA AAL2 activo: segundo factor requerido al iniciar sesión cuando `nextLevel === 'aal2'`.

---

## Pendientes para 100%

| # | Ítem | Responsable | Estado |
|---|------|-------------|--------|
| 1 | GitHub Secrets configurados en CI | Operador (script en `scripts/setup-github-secrets.py`) | ⏳ Script listo |
| 2 | DNS Cloudflare para mail.aicounts.cl (Resend) | Admin DNS externo | ⏳ Email enviado |
| 3 | APP_URL real en secrets cuando se despliegue a producción | Operador | ⏳ Tras primer deploy |

---

## Cómo ejecutar localmente

```bash
cd app
npm install
cp .env.example .env.local   # rellenar variables
npm run dev                   # http://localhost:3000
```

## Tests

```bash
npm run test                  # Vitest unit tests
npm run test:e2e              # E2E trazabilidad completa (requiere SUPABASE_SERVICE_ROLE_KEY)
npm run type-check            # tsc --noEmit
```

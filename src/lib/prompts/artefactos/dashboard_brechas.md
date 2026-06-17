# Prompt: Dashboard de Brechas AS-IS vs TO-BE — v1.0

Eres un consultor de gestión del cambio y transformación de procesos. Tu tarea es construir un análisis comparativo de brechas entre el estado actual (AS-IS) y el estado futuro (TO-BE) del proceso, priorizando las iniciativas de cierre por impacto de negocio.

## Contexto del proceso
{{CONTEXTO_PROCESO}}

## Estado AS-IS
{{ASIS}}

## Estado TO-BE
{{TOBE}}

## Instrucciones
Identifica las brechas más significativas. Clasifica cada iniciativa de cierre por impacto (alto/medio/bajo). El roadmap debe tener 3 fases (corto/mediano/largo plazo).

## Formato de salida (JSON estricto)
```json
{
  "comparativo": [
    {
      "dimension": "<dimensión: tiempo, costo, calidad, satisfacción, etc.>",
      "valor_asis": "<valor o descripción actual>",
      "valor_tobe": "<valor o descripción objetivo>",
      "brecha": "<descripción de la diferencia>",
      "impacto": "alto",
      "iniciativa": "<acción concreta para cerrar la brecha>"
    }
  ],
  "resumen_ejecutivo": "<párrafo ejecutivo con el diagnóstico de brechas y el potencial de transformación>",
  "quick_wins": ["<mejora que puede implementarse en menos de 90 días con bajo costo>"],
  "roadmap": [
    {
      "fase": "Corto plazo (0-3 meses)",
      "acciones": ["<acción concreta>"],
      "plazo": "Q1 2025"
    },
    {
      "fase": "Mediano plazo (3-6 meses)",
      "acciones": ["<acción concreta>"],
      "plazo": "Q2-Q3 2025"
    },
    {
      "fase": "Largo plazo (6-12 meses)",
      "acciones": ["<acción concreta>"],
      "plazo": "Q4 2025"
    }
  ]
}
```

Responde ÚNICAMENTE con el JSON, sin texto adicional.

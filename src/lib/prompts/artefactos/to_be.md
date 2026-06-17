# Prompt: Estado TO-BE — v1.0

Eres un consultor de transformación de procesos con experiencia en diseño de procesos optimizados, automatización y gestión del cambio. Tu tarea es diseñar el estado futuro (TO-BE) del proceso, incorporando las mejoras identificadas en el diagnóstico AS-IS y las oportunidades de automatización.

## Contexto del proceso
{{CONTEXTO_PROCESO}}

## Estado AS-IS del proceso
{{ASIS}}

## Diagnóstico del proceso
{{DIAGNOSTICO}}

## Documentos de origen
{{DOCUMENTOS}}

## Instrucciones
El TO-BE debe ser ambicioso pero alcanzable. Elimina los puntos de dolor identificados en el AS-IS. Incorpora automatización donde sea justificable. Los pasos deben ser menos que en el AS-IS (consolidación de actividades).

## Formato de salida (JSON estricto)
```json
{
  "descripcion_estado_futuro": "<párrafo ejecutivo de cómo se ejecutará el proceso transformado>",
  "actores": ["<rol o área que participará en el proceso TO-BE>"],
  "pasos": [
    {
      "orden": 1,
      "descripcion": "<qué se hace>",
      "responsable": "<quién lo hace>",
      "automatizado": false,
      "herramienta": "<sistema o herramienta que soporta este paso>"
    }
  ],
  "mejoras_respecto_asis": ["<mejora específica y cuantificable respecto al AS-IS>"],
  "sistemas_requeridos": ["<sistema nuevo o a integrar para el TO-BE>"],
  "metricas_objetivo": [
    {
      "nombre": "<nombre del KPI>",
      "valor_actual": "<valor AS-IS>",
      "valor_objetivo": "<valor TO-BE target>"
    }
  ]
}
```

Responde ÚNICAMENTE con el JSON, sin texto adicional.

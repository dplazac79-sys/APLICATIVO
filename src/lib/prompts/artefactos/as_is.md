# Prompt: Diagnóstico AS-IS — v1.0

Eres un consultor senior de transformación de procesos. Tu tarea es documentar el estado actual (AS-IS) de un proceso de negocio con nivel de detalle suficiente para identificar brechas, ineficiencias y riesgos operacionales.

## Contexto del proceso
{{CONTEXTO_PROCESO}}

## Documentos de origen
{{DOCUMENTOS}}

## Instrucciones
Documenta el estado actual con base en la evidencia de los documentos. Si hay información faltante, infiere con base en patrones de la industria y señálalo explícitamente. Usa nombres reales de roles, sistemas y áreas.

## Formato de salida (JSON estricto)
```json
{
  "descripcion_estado_actual": "<párrafo ejecutivo de cómo se ejecuta el proceso hoy>",
  "actores": ["<rol o área que participa en el proceso>"],
  "pasos": [
    {
      "orden": 1,
      "descripcion": "<qué se hace>",
      "responsable": "<quién lo hace>",
      "duracion_estimada": "<tiempo típico>"
    }
  ],
  "sistemas_involucrados": ["<sistema, herramienta o plataforma utilizada>"],
  "puntos_dolor": ["<ineficiencia, cuello de botella o problema identificado>"],
  "metricas_actuales": [
    { "nombre": "<KPI o métrica>", "valor": "<valor actual o estimado>" }
  ]
}
```

Responde ÚNICAMENTE con el JSON, sin texto adicional.

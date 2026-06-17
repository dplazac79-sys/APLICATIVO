# Prompt: Matriz Riesgo-Control — v1.0

Eres un consultor de gestión de riesgos operacionales con metodología COSO y estándares ISO 31000. Tu tarea es identificar los riesgos críticos del proceso y proponer controles específicos y accionables.

## Contexto del proceso
{{CONTEXTO_PROCESO}}

## Documentos de origen
{{DOCUMENTOS}}

## Instrucciones
Identifica entre 5 y 10 riesgos. Para cada riesgo, propone un control concreto (no genérico). El nivel de riesgo se calcula combinando probabilidad e impacto:
- crítico: probabilidad alta + impacto alto
- alto: una de las dos dimensiones alta
- medio: ambas medias
- bajo: ambas bajas

## Formato de salida (JSON estricto)
```json
{
  "riesgos": [
    {
      "id": "R-001",
      "descripcion": "<descripción específica del riesgo>",
      "categoria": "<operacional | tecnológico | regulatorio | financiero | reputacional>",
      "probabilidad": "alta",
      "impacto": "alto",
      "nivel_riesgo": "critico",
      "control": "<acción de control concreta y asignable>",
      "responsable": "<rol o área responsable del control>",
      "estado": "activo"
    }
  ]
}
```

Responde ÚNICAMENTE con el JSON, sin texto adicional.

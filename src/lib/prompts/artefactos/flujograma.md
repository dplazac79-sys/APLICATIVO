# Prompt: Flujograma de Proceso — v1.0

Eres un consultor de procesos experto en diagramación operacional. Tu tarea es generar un flujograma simplificado del proceso en formato React Flow, con carriles por responsable (swimlanes simulados mediante posición vertical).

## Contexto del proceso
{{CONTEXTO_PROCESO}}

## Documentos de origen
{{DOCUMENTOS}}

## Instrucciones
Genera un flujograma operacional. Agrupa los nodos verticalmente por responsable (cada carril ocupa 150px de alto). Usa tipos:
- `start`: inicio
- `task`: actividad
- `decision`: bifurcación (sí/no)
- `end`: fin
- `document`: generación de documento o registro

Máximo 12 nodos. Posiciona el inicio en x=50, avanza en x=220 por paso.

## Formato de salida (JSON estricto)
```json
{
  "nodes": [
    {
      "id": "1",
      "type": "start",
      "position": { "x": 50, "y": 100 },
      "data": { "label": "<trigger>", "carril": "<responsable>" }
    }
  ],
  "edges": [
    {
      "id": "e1-2",
      "source": "1",
      "target": "2",
      "label": ""
    }
  ]
}
```

Responde ÚNICAMENTE con el JSON, sin texto adicional.

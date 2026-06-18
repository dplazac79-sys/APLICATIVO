# Prompt: Indicadores KPI-SLA — v1.0

Eres un consultor de performance management con experiencia en diseño de tableros de control y acuerdos de nivel de servicio. Tu tarea es definir los KPIs y SLAs del proceso con fórmulas precisas, metas realistas y fuentes de dato identificadas.

## Contexto del proceso
{{CONTEXTO_PROCESO}}

## Documentos de origen
{{DOCUMENTOS}}

## Instrucciones
Define entre 4 y 8 indicadores. Incluye tanto KPIs de resultado (lagging) como de proceso (leading). Las metas deben ser alcanzables en 12 meses desde el estado actual. Los SLAs deben ser compromisos de servicio verificables.

## Formato de salida (JSON estricto)
```json
{
  "indicadores": [
    {
      "nombre": "<nombre del KPI>",
      "descripcion": "<qué mide y por qué importa>",
      "formula": "<fórmula de cálculo>",
      "linea_base": "<valor actual o estimado>",
      "meta": "<valor objetivo a 12 meses>",
      "sla": "<compromiso de nivel de servicio, ej: 'respuesta en < 24h'>",
      "frecuencia": "<diaria | semanal | mensual | trimestral>",
      "dueno": "<rol responsable del KPI>",
      "fuente_dato": "<sistema o proceso que genera el dato>"
    }
  ],
  "financiero": {
    "costo_hora_fte_clp": 0,
    "costo_mensual_proceso_clp": 0,
    "inversion_estimada_clp": 0
  }
}
```

Sobre el objeto `financiero` (úsalo para alimentar el motor de ROI/payback):
- `costo_hora_fte_clp`: costo por hora de un FTE involucrado en el proceso. **Estimado del consultor** a partir de los roles y remuneraciones descritos en los documentos. Si no hay información suficiente, usa la mejor estimación de mercado para el rol predominante.
- `costo_mensual_proceso_clp`: costo operacional mensual total del proceso (FTEs + sistemas). **Estimado del consultor** según el volumen y dotación descrita en los documentos.
- `inversion_estimada_clp`: inversión estimada para implementar el TO-BE / automatización. **Estimado del consultor** basado en el alcance de las mejoras propuestas.

Todos los valores deben ir en pesos chilenos (CLP) como números enteros sin separadores de miles. Si careces de antecedentes para estimar alguno, devuelve ese campo en `0` (el sistema lo tratará como "sin dato" y pedirá el valor real al usuario).

Responde ÚNICAMENTE con el JSON, sin texto adicional.

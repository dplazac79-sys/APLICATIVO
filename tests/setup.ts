import WebSocket from 'ws'

if (!globalThis.WebSocket) {
  // @ts-expect-error: el SDK de Supabase espera el WebSocket global del navegador, Node 20 no lo trae nativo
  globalThis.WebSocket = WebSocket
}

// Fallback para que el módulo claude.ts pueda instanciarse en tests unitarios
// que no llaman a la API real (solo prueban extractJson)
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? 'test-key-placeholder'

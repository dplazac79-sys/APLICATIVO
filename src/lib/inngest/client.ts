import { Inngest } from 'inngest'

export const inngest = new Inngest({ id: 'apac' })

export type ProcesarDocumentoEvent = {
  name: 'documento/procesar'
  data: { documento_id: string; usuario_id: string }
}

export type DiscoveryEvent = {
  name: 'proyecto/discovery'
  data: { proyecto_id: string; usuario_id: string; documento_ids?: string[] }
}

export type Events = ProcesarDocumentoEvent | DiscoveryEvent

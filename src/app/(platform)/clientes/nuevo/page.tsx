import ClienteForm from '@/components/clientes/ClienteForm'

export default function NuevoClientePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Nuevo cliente</h1>
        <p className="text-slate-400 text-sm mt-1">Solo la razón social es obligatoria — puedes completar el resto o editarlo después.</p>
      </div>
      <ClienteForm />
    </div>
  )
}

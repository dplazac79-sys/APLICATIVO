import ClienteForm from '@/components/clientes/ClienteForm'

export default function NuevoClientePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Nuevo cliente</h1>
        <p className="text-slate-400 text-sm mt-1">Ficha 360° — M1 Clientes e Industrias</p>
      </div>
      <ClienteForm />
    </div>
  )
}

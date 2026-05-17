import { Link } from 'react-router-dom'
import { Stethoscope, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-8">
        <Stethoscope className="w-8 h-8 text-white" aria-hidden="true" />
      </div>

      <p className="text-blue-400 text-sm font-black uppercase tracking-widest mb-3">Error 404</p>
      <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
        Página no encontrada
      </h1>
      <p className="text-slate-400 text-lg max-w-md mb-10">
        La ruta que estás buscando no existe o fue movida.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Volver al inicio
        </Link>
        <Link
          to="/acceso"
          className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-xl transition-colors border border-white/20"
        >
          Ir al sistema
        </Link>
      </div>
    </div>
  )
}

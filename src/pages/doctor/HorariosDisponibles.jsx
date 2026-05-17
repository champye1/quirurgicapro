import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import CalendarioPabellonesGrid from '../../components/CalendarioPabellonesGrid'
import { useTheme } from '../../contexts/ThemeContext'
import { CalendarSearch, Info } from 'lucide-react'

export default function HorariosDisponibles() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const isDark = theme === 'dark'

  useEffect(() => {
    if (location.state?.fecha) {
      navigate(location.pathname, { state: {}, replace: true })
    }
  }, [location.state?.fecha, location.pathname, navigate])

  const handleConfirm = (payload) => {
    navigate('/doctor/paciente', {
      state: {
        desdeDisponibilidad: true,
        fechaPreferida: payload.fechaPreferida,
        fechaPreferida2: payload.fechaPreferida2,
        slot1: payload.slot1,
        slot2: payload.slot2,
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
            <CalendarSearch className="w-5 h-5 text-blue-600" aria-hidden="true" />
          </div>
          <h1 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Horarios Disponibles
          </h1>
        </div>
        <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Selecciona un slot libre en el calendario para pre-llenar tu solicitud de cirugía.
        </p>
      </div>

      {/* Info banner */}
      <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
        isDark
          ? 'bg-blue-900/20 border-blue-800 text-blue-300'
          : 'bg-blue-50 border-blue-100 text-blue-700'
      }`}>
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          Los slots en <strong>verde</strong> están libres. Haz clic en uno para reservarlo y
          continuar con el formulario de solicitud. Los slots <strong>grises</strong> ya están
          ocupados o bloqueados.
        </span>
      </div>

      <CalendarioPabellonesGrid
        theme={theme}
        inlineMode={false}
        onConfirm={handleConfirm}
        initialFecha={location.state?.fecha}
      />
    </div>
  )
}

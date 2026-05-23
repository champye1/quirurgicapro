import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../config/supabase'
import { logger } from '../utils/logger'
import { Calendar, CheckCircle, XCircle, Lock, FileCheck } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import LoadingSpinner from './common/LoadingSpinner'

const HORAS = []
for (let i = 8; i <= 17; i++) {
  HORAS.push(`${i.toString().padStart(2, '0')}:00`)
}

function isValidFecha(str) {
  if (!str || typeof str !== 'string') return false
  const trimmed = str.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false
  const d = new Date(trimmed + 'T12:00:00')
  return !Number.isNaN(d.getTime())
}

function formatFechaSafe(fechaStr, formatStr, fallback = '') {
  if (!isValidFecha(fechaStr)) return fallback || fechaStr || '—'
  try {
    return format(new Date(fechaStr + 'T12:00:00'), formatStr, { locale: es })
  } catch {
    return fallback || fechaStr
  }
}

/**
 * Vista de horarios disponibles por pabellón: día, tabla HORA x Pabellón, leyenda y selección.
 * @param {Object} props
 * @param {'dark'|'light'} props.theme
 * @param {boolean} props.inlineMode - Si true, botón "Usar estos horarios"; si false, "Crear solicitud..."
 * @param {(payload: { fechaPreferida, slot1, fechaPreferida2?, slot2? }) => void} props.onConfirm
 * @param {() => void} [props.onCerrar] - Solo en inlineMode: cerrar sin aplicar
 * @param {string} [props.initialFecha] - Fecha inicial (YYYY-MM-DD) cuando se redirige desde otra vista
 */
export default function CalendarioPabellonesGrid({ theme, inlineMode = false, onConfirm, onCerrar, initialFecha }) {
  const hoy = new Date().toISOString().split('T')[0]
  const [fecha, setFecha] = useState(initialFecha && initialFecha >= hoy ? initialFecha : hoy)
  const [selectedSlots, setSelectedSlots] = useState([])
  const [primerHorario, setPrimerHorario] = useState(null)
  // Filtro de pabellón: vacío = todos; si se elige uno, solo se muestra ese (mejor en móvil)
  const [pabellonFiltroId, setPabellonFiltroId] = useState('')

  const { data: pabellonesList = [], isLoading: loadingPabellones } = useQuery({
    queryKey: ['operating-rooms-horarios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operating_rooms')
        .select('id, nombre')
        .eq('activo', true)
        .is('deleted_at', null)
        .order('nombre')
      if (error) throw error
      return data || []
    },
  })

  const { data: slots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ['estado-slots-pabellon', fecha],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_estado_slots_pabellon', { p_fecha: fecha })
      if (error) {
        // Si la función RPC no existe (404) o falla, no bloquear: mostrar slots vacíos y permitir crear reserva
        logger.warn('get_estado_slots_pabellon:', error.message)
        return []
      }
      return data || []
    },
    enabled: isValidFecha(fecha) && fecha >= hoy,
  })

  const grid = useMemo(() => {
    const byRoom = {}
    slots.forEach(s => {
      const key = s.operating_room_id
      if (!byRoom[key]) byRoom[key] = { nombre: s.nombre_pabellon, slots: {} }
      const hi = typeof s.hora_inicio === 'string' ? s.hora_inicio.slice(0, 5) : s.hora_inicio
      byRoom[key].slots[hi] = s.estado
    })
    return byRoom
  }, [slots])

  const toggleSlot = (roomId, nombrePabellon, horaInicio) => {
    const horaFin = (parseInt(horaInicio.slice(0, 2), 10) + 1).toString().padStart(2, '0') + ':00'
    setSelectedSlots(prev => {
      const exists = prev.some(s => s.roomId === roomId && s.horaInicio === horaInicio)
      if (exists) return prev.filter(s => !(s.roomId === roomId && s.horaInicio === horaInicio))
      return [...prev, { roomId, nombre: nombrePabellon, horaInicio, horaFin }]
    })
  }

  const horariosAgrupados = useMemo(() => {
    if (selectedSlots.length === 0) return []
    const byRoom = {}
    selectedSlots.forEach(s => {
      if (!byRoom[s.roomId]) byRoom[s.roomId] = { nombre: s.nombre, slots: [] }
      byRoom[s.roomId].slots.push(s)
    })
    const horarios = []
    Object.entries(byRoom).forEach(([roomId, { nombre, slots }]) => {
      slots.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
      let start = slots[0].horaInicio
      let end = slots[0].horaFin
      for (let i = 1; i < slots.length; i++) {
        if (slots[i].horaInicio === end) {
          end = slots[i].horaFin
        } else {
          horarios.push({ roomId, nombre, horaInicio: start, horaFin: end })
          start = slots[i].horaInicio
          end = slots[i].horaFin
        }
      }
      horarios.push({ roomId, nombre, horaInicio: start, horaFin: end })
    })
    horarios.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.roomId.localeCompare(b.roomId))
    return horarios
  }, [selectedSlots])

  const handleConfirm = () => {
    if (primerHorario) {
      const h2 = horariosAgrupados[0]
      if (!h2) return
      const h1 = primerHorario.horarios[0]
      onConfirm({
        fechaPreferida: primerHorario.fecha,
        slot1: { horaInicio: h1.horaInicio, horaFin: h1.horaFin, nombrePabellon: h1.nombre, operating_room_id: h1.roomId },
        fechaPreferida2: fecha,
        slot2: { horaInicio: h2.horaInicio, horaFin: h2.horaFin, nombrePabellon: h2.nombre, operating_room_id: h2.roomId },
      })
      return
    }
    const horario1 = horariosAgrupados[0]
    if (!horario1) return
    const horario2 = horariosAgrupados[1] || null
    onConfirm({
      fechaPreferida: fecha,
      slot1: { horaInicio: horario1.horaInicio, horaFin: horario1.horaFin, nombrePabellon: horario1.nombre, operating_room_id: horario1.roomId },
      fechaPreferida2: horario2 ? fecha : undefined,
      slot2: horario2 ? { horaInicio: horario2.horaInicio, horaFin: horario2.horaFin, nombrePabellon: horario2.nombre, operating_room_id: horario2.roomId } : null,
    })
  }

  const fijarPrimerHorarioYElegirSegundo = () => {
    const h = horariosAgrupados[0]
    if (!h) return
    setPrimerHorario({ fecha, horarios: horariosAgrupados })
    setSelectedSlots([])
  }

  const isSlotSelected = (roomId, horaInicio) => selectedSlots.some(s => s.roomId === roomId && s.horaInicio === horaInicio)
  const isDark = theme === 'dark'
  const isLoading = loadingPabellones || (!!fecha && fecha >= hoy && loadingSlots)
  const hayPabellones = pabellonesList.length > 0
  // Si hay filtro de pabellón, mostrar solo ese; si no, todos (para móvil conviene elegir uno)
  const pabellonesMostrar = useMemo(() => {
    if (!pabellonFiltroId) return pabellonesList
    const p = pabellonesList.find(x => x.id === pabellonFiltroId)
    return p ? [p] : pabellonesList
  }, [pabellonesList, pabellonFiltroId])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Horarios disponibles por pabellón
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
            <label className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
              {primerHorario ? 'Día del 2º horario:' : 'Día:'}
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => { setFecha(e.target.value); setSelectedSlots([]) }}
              min={hoy}
              className={`input-field w-auto ${isDark ? 'bg-slate-800 border-slate-600 text-white' : ''}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className={`text-sm whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
              Pabellón:
            </label>
            <select
              value={pabellonFiltroId}
              onChange={(e) => { setPabellonFiltroId(e.target.value); setSelectedSlots([]) }}
              className={`input-field w-auto min-w-[140px] ${isDark ? 'bg-slate-800 border-slate-600 text-white' : ''}`}
              aria-label="Seleccionar pabellón a ver"
            >
              <option value="">Todos</option>
              {pabellonesList.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {primerHorario && (
        <div className={`flex flex-wrap items-center gap-3 p-3 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-slate-100 border-slate-200'}`}>
          <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
            1º horario: {formatFechaSafe(primerHorario.fecha, 'd/M/yyyy')} — {primerHorario.horarios[0].nombre} {primerHorario.horarios[0].horaInicio}–{primerHorario.horarios[0].horaFin}
          </span>
          <button
            type="button"
            onClick={() => { setPrimerHorario(null); setSelectedSlots([]) }}
            className={`text-sm underline ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-600 hover:text-gray-800'}`}
          >
            Cambiar 1º horario
          </button>
        </div>
      )}

      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
        Seleccione día y pabellón. Vista detallada del día: vea a qué hora está disponible cada slot. Puede elegir un horario y luego otro día para el segundo.
      </p>

      <div className={`flex flex-wrap gap-4 text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
        <span className="flex items-center gap-2"><span className="w-6 h-6 rounded bg-green-500/80" /> Disponible</span>
        <span className="flex items-center gap-2"><span className="w-6 h-6 rounded bg-blue-500/80" /> Solicitud guardada</span>
        <span className="flex items-center gap-2"><span className="w-6 h-6 rounded bg-slate-400/80" /> Ocupado</span>
        <span className="flex items-center gap-2"><span className="w-6 h-6 rounded bg-amber-500/80" /> Bloqueado</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : !hayPabellones ? (
        <div className={`rounded-xl border p-8 text-center ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-gray-600'}`}>
          No hay pabellones activos.
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className={`w-full border-collapse ${pabellonesMostrar.length === 1 ? 'min-w-0' : 'min-w-[500px]'}`} role="grid" aria-label="Vista detallada del día por pabellón">
              <thead>
                <tr className={isDark ? 'border-b border-slate-600 bg-slate-800' : 'border-b border-slate-200 bg-slate-50'}>
                  <th className={`w-16 py-3 px-2 text-left text-xs font-bold uppercase ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Hora</th>
                  {pabellonesMostrar.map(p => (
                    <th key={p.id} className={`py-3 px-2 text-center font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                      <div>{p.nombre}</div>
                      <div className={`text-xs font-normal ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                        {slots.filter(s => s.operating_room_id === p.id && s.estado === 'ocupado').length} cirugías
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HORAS.map(hora => (
                  <tr key={hora} className={isDark ? 'border-b border-slate-700/50' : 'border-b border-slate-100'}>
                    <td className={`py-2 px-2 text-sm font-medium sticky left-0 ${isDark ? 'bg-slate-800/80 text-slate-300' : 'bg-slate-50/90 text-gray-700'}`}>{hora}</td>
                    {pabellonesMostrar.map(p => {
                      const roomData = grid[p.id]
                      const nombre = roomData?.nombre ?? p.nombre
                      const estado = roomData?.slots[hora] ?? 'libre'
                      const isLibre = estado === 'libre'
                      const isSolicitado = estado === 'solicitado'
                      return (
                        <td key={p.id} className="p-1">
                          {isLibre ? (
                            <button
                              type="button"
                              onClick={() => toggleSlot(p.id, nombre, hora)}
                              className={`w-full min-h-[48px] py-2 rounded-xl text-xs font-medium transition-all border-2 border-dashed ${
                                isSlotSelected(p.id, hora)
                                  ? 'bg-blue-600 text-white border-blue-400 ring-2 ring-blue-400/50'
                                  : isDark ? 'bg-slate-700/50 border-slate-600 text-slate-200 hover:border-green-500 hover:bg-green-500/20' : 'bg-slate-50 border-slate-200 text-gray-700 hover:border-green-500 hover:bg-green-50'
                              }`}
                            >
                              {isSlotSelected(p.id, hora) ? <span className="flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4" /> ✓</span> : <span className="opacity-80">Disponible</span>}
                            </button>
                          ) : isSolicitado ? (
                            <div className="w-full min-h-[48px] py-2 rounded-xl text-xs flex items-center justify-center gap-1 bg-blue-500/80 text-white border-2 border-blue-400/50">
                              <FileCheck className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Solicitado</span>
                            </div>
                          ) : (
                            <div className={`w-full min-h-[48px] py-2 rounded-xl text-xs flex items-center justify-center gap-1 ${estado === 'bloqueado' ? 'bg-amber-500/80 text-white border-2 border-amber-400/50' : 'bg-slate-400/80 text-white border-2 border-slate-500/50'}`}>
                              {estado === 'bloqueado' ? <Lock className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                              <span className="hidden sm:inline">{estado === 'bloqueado' ? 'Bloqueado' : 'Ocupado'}</span>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedSlots.length > 0 && (
        <div className={`flex flex-wrap items-center gap-3 p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-slate-100 border-slate-200'}`}>
          <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
            {primerHorario ? `2º horario: ${horariosAgrupados[0]?.nombre} ${horariosAgrupados[0]?.horaInicio}–${horariosAgrupados[0]?.horaFin} (${formatFechaSafe(fecha, 'd/M/yyyy')})` : horariosAgrupados.length >= 2 ? `2 horarios: ${horariosAgrupados[0].nombre} ${horariosAgrupados[0].horaInicio}–${horariosAgrupados[0].horaFin} y ${horariosAgrupados[1].nombre} ${horariosAgrupados[1].horaInicio}–${horariosAgrupados[1].horaFin}` : '1 horario seleccionado'}
          </span>
          <button type="button" onClick={handleConfirm} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
            {inlineMode ? (primerHorario || horariosAgrupados.length >= 2 ? 'Usar estos 2 horarios' : 'Usar este horario') : (primerHorario || horariosAgrupados.length >= 2 ? 'Crear solicitud con estos 2 horarios' : 'Crear solicitud con este horario')}
          </button>
          {!primerHorario && horariosAgrupados.length >= 1 && (
            <button type="button" onClick={fijarPrimerHorarioYElegirSegundo} className="px-4 py-2 rounded-lg border border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-900/30 text-sm font-semibold">
              Usar como 1º y elegir 2º (otro día)
            </button>
          )}
          <button type="button" onClick={() => setSelectedSlots([])} className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-slate-200'}`}>
            Limpiar selección
          </button>
        </div>
      )}

      {inlineMode && onCerrar && (
        <div className="flex justify-end">
          <button type="button" onClick={onCerrar} className={`text-sm underline ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-600 hover:text-gray-800'}`}>
            Cerrar y volver al formulario
          </button>
        </div>
      )}

      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
        {isValidFecha(fecha) ? `${formatFechaSafe(fecha, "EEEE d 'de' MMMM")}. Seleccione día y hora(s) en la tabla.` : 'Seleccione día y hora(s) en la tabla.'}
      </p>
    </div>
  )
}

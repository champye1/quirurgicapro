import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { Users, Search, ChevronDown, ChevronUp, Calendar, FileText, Clock, Pencil, Check, X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTheme } from '../../contexts/ThemeContext'
import { useDebounce } from '../../hooks/useDebounce'
import { useNotifications } from '../../hooks/useNotifications'
import EmptyState from '../../components/common/EmptyState'
import Pagination from '../../components/common/Pagination'
import { PREVISION_OPTIONS, PREVISION_LABELS, PREVISION_COLORS } from '../../utils/previsionConfig'

const ITEMS_PER_PAGE = 15

const ESTADO_COLORS = {
  pendiente: 'bg-amber-100 text-amber-700',
  aceptada: 'bg-blue-100 text-blue-700',
  rechazada: 'bg-red-100 text-red-700',
  cancelada: 'bg-slate-100 text-slate-500',
}
const CIRUGIA_COLORS = {
  programada: 'bg-green-100 text-green-700',
  en_proceso: 'bg-yellow-100 text-yellow-700',
  completada: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-slate-100 text-slate-500',
}

export default function Pacientes() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { showSuccess, showError } = useNotifications()
  const queryClient = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [editandoPrevisionId, setEditandoPrevisionId] = useState(null)
  const [previsionEdit, setPrevisionEdit] = useState('')
  const debouncedBusqueda = useDebounce(busqueda, 300)

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ['doctor-pacientes'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data: doctor, error: doctorError } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (doctorError) throw doctorError
      if (!doctor) return []
      const { data, error } = await supabase
        .from('patients')
        .select('id, nombre, apellido, rut, prevision, created_at')
        .eq('doctor_id', doctor.id)
        .is('deleted_at', null)
        .order('apellido', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  const { data: historialPaciente = [] } = useQuery({
    queryKey: ['paciente-historial', expandedId],
    queryFn: async () => {
      const [{ data: solicitudes }, { data: cirugias }] = await Promise.all([
        supabase
          .from('surgery_requests')
          .select('id, codigo_operacion, estado, fecha_preferida, created_at')
          .eq('patient_id', expandedId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('surgeries')
          .select('id, fecha, hora_inicio, hora_fin, estado, surgery_request_id, operating_rooms:operating_room_id(nombre)')
          .eq('patient_id', expandedId)
          .is('deleted_at', null)
          .order('fecha', { ascending: false }),
      ])
      return { solicitudes: solicitudes || [], cirugias: cirugias || [] }
    },
    enabled: !!expandedId,
  })

  const actualizarPrevision = useMutation({
    mutationFn: async ({ pacienteId, prevision }) => {
      const { error } = await supabase
        .from('patients')
        .update({ prevision: prevision || null, updated_at: new Date().toISOString() })
        .eq('id', pacienteId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-pacientes'] })
      showSuccess('Previsión actualizada')
      setEditandoPrevisionId(null)
    },
    onError: () => showError('Error al actualizar la previsión'),
  })

  const iniciarEdicionPrevision = (e, paciente) => {
    e.stopPropagation()
    setEditandoPrevisionId(paciente.id)
    setPrevisionEdit(paciente.prevision || '')
  }

  const confirmarEdicionPrevision = (e, pacienteId) => {
    e.stopPropagation()
    actualizarPrevision.mutate({ pacienteId, prevision: previsionEdit })
  }

  const cancelarEdicionPrevision = (e) => {
    e.stopPropagation()
    setEditandoPrevisionId(null)
  }

  const pacientesFiltrados = useMemo(() => {
    if (!debouncedBusqueda.trim()) return pacientes
    const q = debouncedBusqueda.toLowerCase()
    return pacientes.filter(p =>
      `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) ||
      (p.rut || '').toLowerCase().includes(q)
    )
  }, [pacientes, debouncedBusqueda])

  const totalPages = Math.ceil(pacientesFiltrados.length / ITEMS_PER_PAGE)
  const pacientesPaginados = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return pacientesFiltrados.slice(start, start + ITEMS_PER_PAGE)
  }, [pacientesFiltrados, currentPage])

  const cardBase = isDark
    ? 'bg-slate-800 border-slate-700'
    : 'bg-white border-slate-200'

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className={`text-2xl lg:text-3xl font-black tracking-tighter uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Mis Pacientes
        </h2>
        <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
          {pacientes.length} paciente{pacientes.length !== 1 ? 's' : ''} registrado{pacientes.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Búsqueda */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Buscar por nombre o RUT…"
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setCurrentPage(1) }}
          className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
            isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
          }`}
          aria-label="Buscar paciente"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`h-16 rounded-2xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
          ))}
        </div>
      ) : pacientesFiltrados.length === 0 ? (
        <EmptyState icon={Users} title="Sin pacientes" description={debouncedBusqueda ? 'Sin resultados para tu búsqueda.' : 'Aún no tienes pacientes registrados.'} />
      ) : (
        <div className="space-y-2">
          {pacientesPaginados.map(p => {
            const isOpen = expandedId === p.id
            return (
              <div key={p.id} className={`rounded-2xl border transition-all ${cardBase} ${isOpen ? 'shadow-lg' : ''}`}>
                <button
                  onClick={() => setExpandedId(isOpen ? null : p.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-base shrink-0">
                      {p.nombre?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {p.nombre} {p.apellido}
                        </p>
                        {p.prevision && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${PREVISION_COLORS[p.prevision] || 'bg-slate-100 text-slate-600'}`}>
                            {PREVISION_LABELS[p.prevision] || p.prevision}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {p.rut || 'Sin RUT'} • Registrado {format(new Date(p.created_at), 'd MMM yyyy', { locale: es })}
                      </p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={18} className="text-slate-400 shrink-0" /> : <ChevronDown size={18} className="text-slate-400 shrink-0" />}
                </button>

                {isOpen && (
                  <div className={`px-5 pb-5 space-y-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>

                    {/* Previsión editable */}
                    <div className="pt-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Previsión de Salud</span>
                        {editandoPrevisionId !== p.id && (
                          <button
                            onClick={(e) => iniciarEdicionPrevision(e, p)}
                            className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}
                            aria-label="Editar previsión"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>

                      {editandoPrevisionId === p.id ? (
                        <div className="flex items-center gap-2 mt-1.5" onClick={e => e.stopPropagation()}>
                          <select
                            value={previsionEdit}
                            onChange={e => setPrevisionEdit(e.target.value)}
                            className={`text-xs font-bold px-2 py-1.5 rounded-lg border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-700'}`}
                            autoFocus
                          >
                            <option value="">Sin previsión</option>
                            {PREVISION_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={(e) => confirmarEdicionPrevision(e, p.id)}
                            disabled={actualizarPrevision.isPending}
                            className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                            aria-label="Confirmar"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={cancelarEdicionPrevision}
                            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                            aria-label="Cancelar"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1">
                          {p.prevision ? (
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${PREVISION_COLORS[p.prevision] || 'bg-slate-100 text-slate-600'}`}>
                              {PREVISION_LABELS[p.prevision] || p.prevision}
                            </span>
                          ) : (
                            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No especificada</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cirugías */}
                    <div className="pt-4">
                      <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <Calendar size={10} /> Cirugías realizadas
                      </h4>
                      {historialPaciente.cirugias?.length === 0 ? (
                        <p className="text-xs text-slate-400">Sin cirugías registradas.</p>
                      ) : (
                        <ul className="space-y-2">
                          {historialPaciente.cirugias?.map(c => {
                            const solicitudOrigen = c.surgery_request_id
                              ? historialPaciente.solicitudes?.find(s => s.id === c.surgery_request_id)
                              : null
                            return (
                              <li key={c.id} className={`rounded-xl px-4 py-2.5 ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                      {c.fecha ? format(new Date(c.fecha), 'd MMM yyyy', { locale: es }) : '—'} • {c.hora_inicio?.slice(0, 5) || '—'}–{c.hora_fin?.slice(0, 5) || '—'}
                                    </p>
                                    <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{c.operating_rooms?.nombre || 'Pabellón'}</p>
                                  </div>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${CIRUGIA_COLORS[c.estado] || 'bg-slate-100 text-slate-500'}`}>
                                    {c.estado}
                                  </span>
                                </div>
                                {solicitudOrigen && (
                                  <p className={`text-[10px] mt-1 flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    <FileText size={9} />
                                    Solicitud: {solicitudOrigen.codigo_operacion || 'Sin código'} · {format(new Date(solicitudOrigen.created_at), 'd MMM yyyy', { locale: es })}
                                  </p>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>

                    {/* Solicitudes */}
                    <div>
                      <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <FileText size={10} /> Historial de solicitudes
                      </h4>
                      {historialPaciente.solicitudes?.length === 0 ? (
                        <p className="text-xs text-slate-400">Sin solicitudes previas.</p>
                      ) : (
                        <ul className="space-y-2">
                          {historialPaciente.solicitudes?.map(s => (
                            <li key={s.id} className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                              <div>
                                <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                  {s.codigo_operacion || 'Sin código'}
                                </p>
                                <p className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  <Clock size={9} /> {format(new Date(s.created_at), 'd MMM yyyy', { locale: es })}
                                </p>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${ESTADO_COLORS[s.estado] || 'bg-slate-100 text-slate-500'}`}>
                                {s.estado}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={ITEMS_PER_PAGE}
        totalItems={pacientesFiltrados.length}
      />
    </div>
  )
}

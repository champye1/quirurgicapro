import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, CheckCircle, XCircle, Clock, Activity, Package, Users } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

const COLORES_ESTADO = {
  completada: '#22c55e',
  programada: '#3b82f6',
  cancelada:  '#ef4444',
  en_proceso: '#f59e0b',
}

export default function Estadisticas() {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  const hoy = new Date()
  const [fechaDesde, setFechaDesde] = useState(format(startOfMonth(subMonths(hoy, 5)), 'yyyy-MM-dd'))
  const [fechaHasta, setFechaHasta] = useState(format(endOfMonth(hoy), 'yyyy-MM-dd'))

  // Cirugías en el rango
  const { data: cirugias = [], isLoading: loadingCirugias } = useQuery({
    queryKey: ['estadisticas-cirugias', fechaDesde, fechaHasta],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgeries')
        .select(`
          id, estado, fecha, hora_inicio, hora_fin,
          doctors:doctor_id(nombre, apellido, especialidad),
          operating_rooms:operating_room_id(nombre),
          surgery_requests:surgery_request_id(codigo_operacion)
        `)
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta)
        .is('deleted_at', null)
        .order('fecha', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  // Solicitudes en el rango
  const { data: solicitudes = [], isLoading: loadingSolicitudes } = useQuery({
    queryKey: ['estadisticas-solicitudes', fechaDesde, fechaHasta],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgery_requests')
        .select('id, estado, created_at')
        .gte('created_at', fechaDesde + 'T00:00:00')
        .lte('created_at', fechaHasta + 'T23:59:59')
        .is('deleted_at', null)
      if (error) throw error
      return data || []
    },
  })

  // Insumos con stock bajo
  const { data: insumosAlerta = [] } = useQuery({
    queryKey: ['estadisticas-insumos-alerta'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplies')
        .select('nombre, codigo, stock_actual, stock_minimo')
        .is('deleted_at', null)
        .filter('stock_actual', 'lte', 'stock_minimo')
      if (error) throw error
      return (data || []).filter(i => i.stock_minimo > 0 && i.stock_actual <= i.stock_minimo)
    },
  })

  const loading = loadingCirugias || loadingSolicitudes

  // KPIs
  const kpis = useMemo(() => {
    const total = cirugias.length
    const completadas = cirugias.filter(c => c.estado === 'completada').length
    const programadas = cirugias.filter(c => c.estado === 'programada').length
    const canceladas = cirugias.filter(c => c.estado === 'cancelada').length
    const tasaCompletacion = total > 0 ? Math.round((completadas / total) * 100) : 0
    return { total, completadas, programadas, canceladas, tasaCompletacion }
  }, [cirugias])

  // Cirugías por mes
  const porMes = useMemo(() => {
    const meses = {}
    cirugias.forEach(c => {
      if (!c.fecha) return
      const mes = c.fecha.slice(0, 7) // 'YYYY-MM'
      if (!meses[mes]) meses[mes] = { mes, completada: 0, programada: 0, cancelada: 0, en_proceso: 0 }
      meses[mes][c.estado] = (meses[mes][c.estado] || 0) + 1
    })
    return Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes)).map(m => ({
      ...m,
      label: format(new Date(m.mes + '-15'), 'MMM yy', { locale: es }),
    }))
  }, [cirugias])

  // Top doctores por número de cirugías
  const topDoctores = useMemo(() => {
    const mapa = {}
    cirugias.forEach(c => {
      if (!c.doctors) return
      const key = `${c.doctors.nombre} ${c.doctors.apellido}`
      mapa[key] = (mapa[key] || 0) + 1
    })
    return Object.entries(mapa)
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [cirugias])

  // Top pabellones
  const topPabellones = useMemo(() => {
    const mapa = {}
    cirugias.forEach(c => {
      if (!c.operating_rooms) return
      const key = c.operating_rooms.nombre
      mapa[key] = (mapa[key] || 0) + 1
    })
    return Object.entries(mapa)
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
  }, [cirugias])

  // Distribución por estado (pie)
  const pieData = useMemo(() => {
    return [
      { name: 'Completadas', value: kpis.completadas, color: COLORES_ESTADO.completada },
      { name: 'Programadas', value: kpis.programadas, color: COLORES_ESTADO.programada },
      { name: 'Canceladas',  value: kpis.canceladas,  color: COLORES_ESTADO.cancelada },
    ].filter(d => d.value > 0)
  }, [kpis])

  const cardClass = `rounded-2xl p-5 shadow-sm border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`
  const textPrimary = dark ? 'text-white' : 'text-slate-900'
  const textSecondary = dark ? 'text-slate-300' : 'text-slate-600'
  const axisColor = dark ? '#94a3b8' : '#64748b'
  const gridColor = dark ? '#334155' : '#e2e8f0'
  const tooltipBg = dark ? '#1e293b' : '#ffffff'
  const tooltipBorder = dark ? '#475569' : '#e2e8f0'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className={`text-2xl sm:text-3xl font-bold ${textPrimary}`}>Estadísticas y Reportes</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2">
            <label className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              className="input-field text-sm py-1.5 px-3"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              className="input-field text-sm py-1.5 px-3"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={`${cardClass} flex items-center gap-3`}>
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Total</p>
                <p className={`text-2xl font-black ${textPrimary}`}>{kpis.total}</p>
              </div>
            </div>
            <div className={`${cardClass} flex items-center gap-3`}>
              <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Completadas</p>
                <p className={`text-2xl font-black text-green-600`}>{kpis.completadas}</p>
              </div>
            </div>
            <div className={`${cardClass} flex items-center gap-3`}>
              <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Canceladas</p>
                <p className={`text-2xl font-black text-red-500`}>{kpis.canceladas}</p>
              </div>
            </div>
            <div className={`${cardClass} flex items-center gap-3`}>
              <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Tasa completación</p>
                <p className={`text-2xl font-black text-purple-600`}>{kpis.tasaCompletacion}%</p>
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cirugías por mes */}
            <div className={`${cardClass} lg:col-span-2`}>
              <h2 className={`text-base font-bold mb-4 ${textPrimary}`}>Cirugías por mes</h2>
              {porMes.length === 0 ? (
                <p className={`text-sm text-center py-8 ${textSecondary}`}>Sin datos en el rango seleccionado</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={porMes} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 12 }} />
                    <YAxis tick={{ fill: axisColor, fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 10, fontSize: 12 }}
                      labelStyle={{ color: dark ? '#f1f5f9' : '#0f172a', fontWeight: 700 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="completada" name="Completadas" stackId="a" fill={COLORES_ESTADO.completada} radius={[0,0,0,0]} />
                    <Bar dataKey="programada" name="Programadas" stackId="a" fill={COLORES_ESTADO.programada} />
                    <Bar dataKey="cancelada"  name="Canceladas"  stackId="a" fill={COLORES_ESTADO.cancelada} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Pie distribución */}
            <div className={cardClass}>
              <h2 className={`text-base font-bold mb-4 ${textPrimary}`}>Distribución por estado</h2>
              {pieData.length === 0 ? (
                <p className={`text-sm text-center py-8 ${textSecondary}`}>Sin datos</p>
              ) : (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={2}>
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 10, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1.5 w-full mt-2">
                    {pieData.map(d => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className={textSecondary}>{d.name}</span>
                        </div>
                        <span className={`font-bold ${textPrimary}`}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top doctores */}
            <div className={`${cardClass} lg:col-span-2`}>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-500" />
                <h2 className={`text-base font-bold ${textPrimary}`}>Top médicos por cirugías</h2>
              </div>
              {topDoctores.length === 0 ? (
                <p className={`text-sm text-center py-8 ${textSecondary}`}>Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topDoctores} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                    <XAxis type="number" tick={{ fill: axisColor, fontSize: 12 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="nombre" tick={{ fill: axisColor, fontSize: 11 }} width={120} />
                    <Tooltip
                      contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 10, fontSize: 12 }}
                    />
                    <Bar dataKey="total" name="Cirugías" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Pabellones + Alertas */}
            <div className="space-y-4">
              <div className={cardClass}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <h2 className={`text-sm font-bold ${textPrimary}`}>Uso por pabellón</h2>
                </div>
                {topPabellones.length === 0 ? (
                  <p className={`text-xs ${textSecondary}`}>Sin datos</p>
                ) : (
                  <div className="space-y-2">
                    {topPabellones.map(p => (
                      <div key={p.nombre} className="flex items-center justify-between">
                        <span className={`text-sm ${textSecondary} truncate max-w-[140px]`}>{p.nombre}</span>
                        <span className={`text-sm font-bold ${textPrimary}`}>{p.total}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={cardClass}>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-red-500" />
                  <h2 className={`text-sm font-bold ${textPrimary}`}>Insumos bajo stock mínimo</h2>
                </div>
                {insumosAlerta.length === 0 ? (
                  <p className={`text-xs text-green-600`}>Sin alertas de stock</p>
                ) : (
                  <div className="space-y-2">
                    {insumosAlerta.slice(0, 5).map(i => (
                      <div key={i.codigo} className="flex items-center justify-between">
                        <span className={`text-xs ${textSecondary} truncate max-w-[130px]`}>{i.nombre}</span>
                        <span className="text-xs font-bold text-red-500">{i.stock_actual}/{i.stock_minimo}</span>
                      </div>
                    ))}
                    {insumosAlerta.length > 5 && (
                      <p className={`text-xs ${textSecondary}`}>+{insumosAlerta.length - 5} más</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

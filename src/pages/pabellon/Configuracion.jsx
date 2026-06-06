import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { MessageSquare, Save, CheckCircle2, AlertTriangle, Phone, Wifi, WifiOff, Building2, Bell, Play, Download, Database, FileSignature, BookOpen, Receipt, Eye, EyeOff, DoorOpen, Plus, Pencil, Check, X, ToggleLeft, ToggleRight } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useNotifications } from '../../hooks/useNotifications'
import { sanitizeString } from '../../utils/sanitizeInput'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useClinicInfo, useSaveClinicInfo, CLINIC_INFO_DEFAULTS } from '../../hooks/useClinicInfo'
import { logger } from '../../utils/logger'
import { exportContratoPDF, exportManualPDF } from '../../utils/exportData'

const WHATSAPP_KEY      = 'whatsapp_config'
const FACTURACION_KEY   = 'facturacion_config'

export default function Configuracion() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useNotifications()

  const [form, setForm] = useState({
    numero: '',
    token: '',
    instancia: '',
    activo: false,
  })
  const [cargadoInicial, setCargadoInicial] = useState(false)
  const [testResult, setTestResult] = useState(null) // null | 'ok' | 'error'

  // Información de la clínica
  const { data: clinicInfo } = useClinicInfo()
  const [clinicForm, setClinicForm] = useState(CLINIC_INFO_DEFAULTS)
  const [clinicCargado, setClinicCargado] = useState(false)
  const saveClinicInfo = useSaveClinicInfo()

  useEffect(() => {
    if (clinicInfo && !clinicCargado) {
      setClinicForm(clinicInfo)
      setClinicCargado(true)
    }
  }, [clinicInfo, clinicCargado])

  // Recordatorios
  const [diasRecordatorio, setDiasRecordatorio] = useState(1)
  const [enviandoRecordatorios, setEnviandoRecordatorios] = useState(false)
  const [resultadoRecordatorio, setResultadoRecordatorio] = useState(null)

  // Facturación electrónica
  const [factForm, setFactForm] = useState({
    api_key: '', rut_emisor: '', razon_social: '', giro: '', direccion: '', comuna: '', sandbox: true,
  })
  const [factCargado, setFactCargado]     = useState(false)
  const [factGuardando, setFactGuardando] = useState(false)
  const [factResult, setFactResult]       = useState(null)
  const [showApiKey, setShowApiKey]       = useState(false)

  useEffect(() => {
    if (factCargado) return
    supabase.from('clinic_settings').select('value').eq('key', FACTURACION_KEY).maybeSingle()
      .then(({ data }) => {
        if (data?.value) setFactForm(v => ({ ...v, ...data.value }))
        setFactCargado(true)
      })
  }, [factCargado])

  const handleSaveFacturacion = async () => {
    if (!factForm.api_key || !factForm.rut_emisor || !factForm.razon_social) {
      showError('Completa API Key, RUT y Razón Social.')
      return
    }
    setFactGuardando(true)
    setFactResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('save-clinic-secret', {
        body: { key: FACTURACION_KEY, value: factForm },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (error || data?.error) throw new Error(data?.error || error?.message)
      setFactResult('ok')
      showSuccess('Configuración de facturación guardada.')
    } catch (e) {
      setFactResult('error')
      showError(e.message || 'Error al guardar.')
    } finally {
      setFactGuardando(false)
    }
  }

  // Exportar datos completos
  const [exportando, setExportando] = useState(false)
  const [exportandoContrato, setExportandoContrato] = useState(false)
  const [exportandoManual, setExportandoManual] = useState(false)

  // Campos permitidos por tabla (evita exponer columnas sensibles o internas)
  const TABLA_CAMPOS = {
    doctors:          'id, nombre, apellido, rut, email, especialidad, estado, telefono, acceso_web_enabled, created_at',
    patients:         'id, nombre, apellido, rut, telefono, prevision, doctor_id, created_at',
    surgery_requests: 'id, codigo_operacion, estado, fecha_preferida, observaciones, doctor_id, patient_id, created_at',
    surgeries:        'id, fecha, hora_inicio, hora_fin, estado, operating_room_id, surgery_request_id, created_at',
    supplies:         'id, nombre, codigo, grupo_prestacion, proveedor, stock_actual, stock_minimo, activo, created_at',
    supply_movements: 'id, supply_id, tipo, cantidad, motivo, created_by, created_at',
    operating_rooms:  'id, nombre, activo, created_at',
  }
  const TABLAS_SIN_SOFT_DELETE = ['operating_rooms', 'supply_movements']

  const exportarTodosCsv = async (tabla) => {
    const campos = TABLA_CAMPOS[tabla] || 'id, created_at'
    const query = supabase.from(tabla).select(campos)
    const { data } = TABLAS_SIN_SOFT_DELETE.includes(tabla)
      ? await query
      : await query.is('deleted_at', null)
    if (!data?.length) return ''
    const keys = Object.keys(data[0])
    const header = keys.join(',')
    const rows = data.map(row =>
      keys.map(k => {
        const val = row[k]
        if (val === null || val === undefined) return ''
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`
        return `"${String(val).replace(/"/g, '""')}"`
      }).join(',')
    )
    return [header, ...rows].join('\n')
  }

  const handleExportarDatos = async () => {
    setExportando(true)
    try {
      const tablas = [
        { tabla: 'doctors', nombre: 'medicos' },
        { tabla: 'patients', nombre: 'pacientes' },
        { tabla: 'surgery_requests', nombre: 'solicitudes' },
        { tabla: 'surgeries', nombre: 'cirugias' },
        { tabla: 'supplies', nombre: 'insumos' },
        { tabla: 'supply_movements', nombre: 'movimientos_stock' },
        { tabla: 'operating_rooms', nombre: 'pabellones' },
      ]
      const fecha = new Date().toISOString().slice(0, 10)
      const archivos = {}
      for (const { tabla, nombre } of tablas) {
        archivos[nombre] = await exportarTodosCsv(tabla)
      }
      const contenidoTotal = Object.entries(archivos)
        .filter(([, csv]) => csv)
        .map(([nombre, csv]) => `=== ${nombre.toUpperCase()} ===\n${csv}`)
        .join('\n\n')
      const blob = new Blob([contenidoTotal], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup-clinica-${fecha}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showSuccess('Backup descargado correctamente')
    } catch (e) {
      showError('Error al exportar: ' + (e.message || 'Error desconocido'))
    } finally {
      setExportando(false)
    }
  }

  const enviarRecordatorios = async () => {
    setEnviandoRecordatorios(true)
    setResultadoRecordatorio(null)
    try {
      const fecha = new Date()
      fecha.setDate(fecha.getDate() + parseInt(diasRecordatorio))
      const fechaStr = fecha.toISOString().slice(0, 10)

      const { data: cirugias } = await supabase
        .from('surgeries')
        .select(`
          id, fecha, hora_inicio,
          doctors:doctor_id(nombre, apellido, user_id),
          patients:patient_id(nombre, apellido),
          surgery_requests:surgery_request_id(codigo_operacion),
          operating_rooms:operating_room_id(nombre)
        `)
        .eq('fecha', fechaStr)
        .eq('estado', 'programada')
        .is('deleted_at', null)

      if (!cirugias?.length) {
        setResultadoRecordatorio({ ok: 0, msg: `No hay cirugías programadas para el ${fechaStr}.` })
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      let enviados = 0
      for (const c of cirugias) {
        if (!c.doctors?.user_id) continue
        const { error } = await supabase.from('notifications').insert({
          user_id: c.doctors.user_id,
          tipo: 'recordatorio',
          titulo: `Recordatorio: cirugía mañana`,
          mensaje: `Tienes una cirugía programada el ${fechaStr} a las ${c.hora_inicio?.slice(0, 5)} en ${c.operating_rooms?.nombre || 'pabellón'}. Paciente: ${c.patients?.nombre} ${c.patients?.apellido}.`,
          relacionado_con: c.id,
        })
        if (!error) enviados++
        else logger.warn('Error notificando recordatorio:', error)
      }

      await supabase.from('notifications').insert({
        user_id: user.id,
        tipo: 'recordatorio_cirugia',
        titulo: `Recordatorios enviados`,
        mensaje: `Se enviaron ${enviados} recordatorio(s) para cirugías del ${fechaStr}.`,
        relacionado_con: null,
      })

      setResultadoRecordatorio({ ok: enviados, total: cirugias.length, fecha: fechaStr })
    } catch (e) {
      logger.error('Error enviando recordatorios:', e)
      setResultadoRecordatorio({ error: e.message || 'Error desconocido' })
    } finally {
      setEnviandoRecordatorios(false)
    }
  }

  const handleSaveClinic = () => {
    saveClinicInfo.mutate(
      {
        nombre: sanitizeString(clinicForm.nombre) || CLINIC_INFO_DEFAULTS.nombre,
        tagline: sanitizeString(clinicForm.tagline),
        rut: sanitizeString(clinicForm.rut),
        telefono: sanitizeString(clinicForm.telefono),
        email: sanitizeString(clinicForm.email || ''),
        direccion: sanitizeString(clinicForm.direccion),
        logo_url: sanitizeString(clinicForm.logo_url),
      },
      {
        onSuccess: () => showSuccess('Información de la clínica guardada.'),
        onError: (e) => showError('Error al guardar: ' + (e.message || e)),
      }
    )
  }

  const { isLoading } = useQuery({
    queryKey: ['clinic-settings-whatsapp'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_settings')
        .select('value')
        .eq('key', WHATSAPP_KEY)
        .single()
      return data?.value || {}
    },
    onSuccess: (value) => {
      if (!cargadoInicial) {
        setForm({
          numero: value.numero || '',
          token: value.token || '',
          instancia: value.instancia || '',
          activo: value.activo || false,
        })
        setCargadoInicial(true)
      }
    },
  })

  const guardar = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('clinic_settings')
        .upsert({
          key: WHATSAPP_KEY,
          value: {
            numero: sanitizeString(form.numero),
            token: sanitizeString(form.token),
            instancia: sanitizeString(form.instancia),
            activo: form.activo,
          },
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        }, { onConflict: 'key' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-settings-whatsapp'] })
      showSuccess('Configuración de WhatsApp guardada.')
    },
    onError: (e) => showError('Error al guardar: ' + (e.message || e)),
  })

  const probarConexion = useMutation({
    mutationFn: async () => {
      if (!form.instancia || !form.token) {
        throw new Error('Complete el ID de instancia y el token para probar la conexión')
      }
      const baseUrl = /^https?:\/\//.test(form.instancia)
        ? form.instancia.replace(/\/$/, '')
        : `https://${form.instancia.replace(/\/$/, '')}`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)
      try {
        const res = await fetch(`${baseUrl}/instance/fetchInstances`, {
          method: 'GET',
          headers: { apikey: form.token, 'Content-Type': 'application/json' },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`)
        return true
      } catch (err) {
        clearTimeout(timeout)
        if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado (6 s)')
        throw err
      }
    },
    onSuccess: () => {
      setTestResult('ok')
      showSuccess('Conexión con WhatsApp API exitosa')
    },
    onError: (e) => {
      setTestResult('error')
      showError('No se pudo conectar: ' + (e.message || e))
    },
  })

  // ── Pabellones ──
  const [nuevoPabellon, setNuevoPabellon] = useState('')
  const [editandoPabellon, setEditandoPabellon] = useState(null)
  const [pabellonNombreEdit, setPabellonNombreEdit] = useState('')

  const { data: pabellones = [], isLoading: loadingPabellones } = useQuery({
    queryKey: ['operating-rooms-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operating_rooms')
        .select('id, nombre, activo')
        .order('nombre')
      if (error) throw error
      return data || []
    },
  })

  const agregarPabellon = useMutation({
    mutationFn: async (nombre) => {
      const { error } = await supabase
        .from('operating_rooms')
        .insert({ nombre: sanitizeString(nombre), activo: true })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operating-rooms-config'] })
      queryClient.invalidateQueries({ queryKey: ['check-pabellones-count'] })
      setNuevoPabellon('')
      showSuccess('Pabellón agregado.')
    },
    onError: (e) => showError(e.message || 'Error al agregar'),
  })

  const actualizarNombrePabellon = useMutation({
    mutationFn: async ({ id, nombre }) => {
      const { error } = await supabase
        .from('operating_rooms')
        .update({ nombre: sanitizeString(nombre) })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operating-rooms-config'] })
      setEditandoPabellon(null)
      showSuccess('Nombre actualizado.')
    },
    onError: (e) => showError(e.message || 'Error al actualizar'),
  })

  const toggleActivoPabellon = useMutation({
    mutationFn: async ({ id, activo }) => {
      const { error } = await supabase
        .from('operating_rooms')
        .update({ activo: !activo })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operating-rooms-config'] })
      queryClient.invalidateQueries({ queryKey: ['check-pabellones-count'] })
    },
    onError: (e) => showError(e.message || 'Error al cambiar estado'),
  })

  const fieldClass = `w-full px-4 py-2.5 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
    isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
  }`
  const labelClass = `block text-[10px] font-black uppercase tracking-widest mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`

  return (
    <div id="tour-cfg-container" className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-xl mx-auto space-y-6">
      <div id="tour-cfg-header" className="mb-8">
        <h2 className={`text-2xl lg:text-3xl font-black tracking-tighter uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Configuración
        </h2>
        <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
          Integraciones y ajustes del sistema
        </p>
      </div>

      {/* ── Información de la Clínica ── */}
      <Card id="tour-cfg-clinica" hover={false} className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Building2 size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className={`font-black text-sm uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Información de la Clínica
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Nombre, datos de contacto y logo que aparece en el sistema
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelClass}>Nombre de la clínica *</label>
            <input
              type="text"
              value={clinicForm.nombre}
              onChange={e => setClinicForm(f => ({ ...f, nombre: e.target.value }))}
              className={fieldClass}
              placeholder="Ej: Clínica Quirúrgica Viña del Mar"
              maxLength={80}
            />
          </div>
          <div>
            <label className={labelClass}>Eslogan / Portal</label>
            <input
              type="text"
              value={clinicForm.tagline}
              onChange={e => setClinicForm(f => ({ ...f, tagline: e.target.value }))}
              className={fieldClass}
              placeholder="Ej: Sistema de Gestión Quirúrgica"
              maxLength={60}
            />
          </div>
          <div>
            <label className={labelClass}>RUT de la clínica</label>
            <input
              type="text"
              value={clinicForm.rut}
              onChange={e => setClinicForm(f => ({ ...f, rut: e.target.value }))}
              className={fieldClass}
              placeholder="Ej: 76.123.456-7"
              maxLength={20}
            />
          </div>
          <div>
            <label className={labelClass}>Teléfono de contacto</label>
            <input
              type="tel"
              value={clinicForm.telefono}
              onChange={e => setClinicForm(f => ({ ...f, telefono: e.target.value }))}
              className={fieldClass}
              placeholder="+56 32 234 5678"
              maxLength={30}
            />
          </div>
          <div>
            <label className={labelClass}>Email de contacto público</label>
            <input
              type="email"
              value={clinicForm.email || ''}
              onChange={e => setClinicForm(f => ({ ...f, email: e.target.value }))}
              className={fieldClass}
              placeholder="contacto@clinica.cl"
              maxLength={150}
            />
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Aparece en el formulario de contacto público
            </p>
          </div>
          <div>
            <label className={labelClass}>Dirección</label>
            <input
              type="text"
              value={clinicForm.direccion}
              onChange={e => setClinicForm(f => ({ ...f, direccion: e.target.value }))}
              className={fieldClass}
              placeholder="Ej: Av. Libertad 1234, Viña del Mar"
              maxLength={120}
            />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>URL del logo (imagen)</label>
            <input
              type="url"
              value={clinicForm.logo_url}
              onChange={e => setClinicForm(f => ({ ...f, logo_url: e.target.value }))}
              className={fieldClass}
              placeholder="https://..."
            />
            {clinicForm.logo_url && (
              <img
                src={clinicForm.logo_url}
                alt="Logo de la clínica"
                className="mt-2 h-12 object-contain rounded-lg border border-slate-200"
                onError={e => { e.target.style.display = 'none' }}
              />
            )}
          </div>
        </div>

        <Button
          onClick={handleSaveClinic}
          loading={saveClinicInfo.isPending}
          className="w-full sm:w-auto"
        >
          <Save size={16} className="mr-2" />
          Guardar información
        </Button>
      </Card>

      {/* ── Pabellones ── */}
      <Card hover={false} className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-emerald-50'}`}>
            <DoorOpen size={20} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
          </div>
          <div>
            <h3 className={`font-black text-sm uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Pabellones quirúrgicos
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Salas de operaciones disponibles en la clínica
            </p>
          </div>
        </div>

        {/* Lista de pabellones */}
        {loadingPabellones ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-12 rounded-xl animate-pulse ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`} />
            ))}
          </div>
        ) : pabellones.length === 0 ? (
          <p className={`text-sm text-center py-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
            No hay pabellones configurados aún.
          </p>
        ) : (
          <ul className="space-y-2">
            {pabellones.map(pb => (
              <li
                key={pb.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  isDark ? 'bg-slate-700/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                } ${!pb.activo ? 'opacity-50' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${pb.activo ? 'bg-emerald-500' : 'bg-slate-400'}`} />

                {editandoPabellon === pb.id ? (
                  <input
                    value={pabellonNombreEdit}
                    onChange={e => setPabellonNombreEdit(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') actualizarNombrePabellon.mutate({ id: pb.id, nombre: pabellonNombreEdit })
                      if (e.key === 'Escape') setEditandoPabellon(null)
                    }}
                    className={`flex-1 text-sm font-medium px-2 py-1 border rounded-lg ${
                      isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                    autoFocus
                  />
                ) : (
                  <span className={`flex-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {pb.nombre}
                  </span>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  {editandoPabellon === pb.id ? (
                    <>
                      <button
                        onClick={() => actualizarNombrePabellon.mutate({ id: pb.id, nombre: pabellonNombreEdit })}
                        disabled={actualizarNombrePabellon.isPending}
                        className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        aria-label="Confirmar"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => setEditandoPabellon(null)}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
                        aria-label="Cancelar"
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setEditandoPabellon(pb.id); setPabellonNombreEdit(pb.nombre) }}
                      className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
                      aria-label="Editar nombre"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => toggleActivoPabellon.mutate({ id: pb.id, activo: pb.activo })}
                    disabled={toggleActivoPabellon.isPending}
                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-200'}`}
                    aria-label={pb.activo ? 'Desactivar' : 'Activar'}
                    title={pb.activo ? 'Desactivar pabellón' : 'Activar pabellón'}
                  >
                    {pb.activo
                      ? <ToggleRight size={16} className="text-emerald-500" />
                      : <ToggleLeft size={16} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                    }
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Agregar nuevo pabellón */}
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={nuevoPabellon}
            onChange={e => setNuevoPabellon(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && nuevoPabellon.trim() && agregarPabellon.mutate(nuevoPabellon.trim())}
            placeholder="Nombre del nuevo pabellón…"
            maxLength={80}
            className={`flex-1 px-4 py-2.5 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none ${
              isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
            }`}
          />
          <Button
            onClick={() => agregarPabellon.mutate(nuevoPabellon.trim())}
            loading={agregarPabellon.isPending}
            disabled={!nuevoPabellon.trim()}
            className="shrink-0"
          >
            <Plus size={15} className="mr-1" />
            Agregar
          </Button>
        </div>
      </Card>

      {/* ── WhatsApp Business — Módulo adicional ── */}
      <Card id="tour-cfg-whatsapp" hover={false} className={`p-5 opacity-60 ${isDark ? '' : ''}`}>
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
            <MessageSquare size={20} className={isDark ? 'text-slate-400' : 'text-slate-400'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-black text-sm uppercase tracking-tight ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                WhatsApp Business
              </h3>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                Módulo adicional
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Notificaciones automáticas a pacientes y médicos vía WhatsApp API. Disponible bajo solicitud.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Exportar datos ── */}
      <Card hover={false} className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <Database size={20} className="text-slate-600" />
          </div>
          <div>
            <h3 className={`font-black text-sm uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Exportar datos completos
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Descarga un backup de toda la información de la clínica
            </p>
          </div>
        </div>

        <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Exporta médicos, pacientes, solicitudes, cirugías, insumos, movimientos de stock y pabellones en un solo archivo CSV. Recomendado antes de actualizaciones o como respaldo mensual.
        </p>

        <Button
          onClick={handleExportarDatos}
          loading={exportando}
          className="w-full sm:w-auto"
        >
          <Download size={15} className="mr-2" />
          Descargar backup completo
        </Button>
      </Card>

      {/* ── Recordatorios de cirugía ── */}
      <Card hover={false} className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <Bell size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className={`font-black text-sm uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Recordatorios de cirugía
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Notifica a los médicos sobre sus cirugías próximas
            </p>
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className={labelClass}>Enviar recordatorio para cirugías en</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={30}
                value={diasRecordatorio}
                onChange={e => setDiasRecordatorio(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                className={`${fieldClass} w-24`}
              />
              <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                día(s) más
              </span>
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Se enviará una notificación en el sistema a cada médico con cirugía ese día.
            </p>
          </div>
          <Button
            onClick={enviarRecordatorios}
            loading={enviandoRecordatorios}
            className="flex-shrink-0"
          >
            <Play size={14} className="mr-2" />
            Enviar ahora
          </Button>
        </div>

        {resultadoRecordatorio && (
          <div className={`rounded-xl p-3 text-sm font-medium flex items-center gap-2 ${
            resultadoRecordatorio.error
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {resultadoRecordatorio.error ? (
              <AlertTriangle size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            {resultadoRecordatorio.error
              ? `Error: ${resultadoRecordatorio.error}`
              : resultadoRecordatorio.ok === 0
              ? resultadoRecordatorio.msg
              : `✓ ${resultadoRecordatorio.ok} de ${resultadoRecordatorio.total} recordatorio(s) enviados para el ${resultadoRecordatorio.fecha}`
            }
          </div>
        )}
      </Card>

      {/* ── Facturación Electrónica — Módulo adicional ── */}
      <Card id="tour-cfg-facturacion" hover={false} className="p-5 opacity-60">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
            <Receipt size={20} className={isDark ? 'text-slate-400' : 'text-slate-400'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-black text-sm uppercase tracking-tight ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                Facturación Electrónica
              </h3>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                Módulo adicional
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Emisión de boletas y facturas electrónicas (DTE) vía OpenFactura. Disponible bajo solicitud.
            </p>
          </div>
        </div>
      </Card>

      {/* Documentos */}
      <Card hover={false}>
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-indigo-50'}`}>
            <FileSignature size={20} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
          </div>
          <div>
            <h3 className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>Documentos Descargables</h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Genera documentos PDF con los datos actuales de la clínica</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={async () => {
              setExportandoContrato(true)
              try { await exportContratoPDF(clinicForm) }
              finally { setExportandoContrato(false) }
            }}
            disabled={exportandoContrato}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              isDark
                ? 'border-slate-700 hover:border-indigo-500 bg-slate-700/50 hover:bg-slate-700'
                : 'border-slate-200 hover:border-indigo-300 bg-slate-50 hover:bg-indigo-50'
            } disabled:opacity-50`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-indigo-900/50' : 'bg-indigo-100'}`}>
              <FileSignature size={18} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
            </div>
            <div>
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {exportandoContrato ? 'Generando...' : 'Contrato Tipo'}
              </p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Contrato de prestación de servicios quirúrgicos</p>
            </div>
            <Download size={14} className={`ml-auto shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
          </button>

          <button
            onClick={async () => {
              setExportandoManual(true)
              try { await exportManualPDF() }
              finally { setExportandoManual(false) }
            }}
            disabled={exportandoManual}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              isDark
                ? 'border-slate-700 hover:border-blue-500 bg-slate-700/50 hover:bg-slate-700'
                : 'border-slate-200 hover:border-blue-300 bg-slate-50 hover:bg-blue-50'
            } disabled:opacity-50`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-blue-900/50' : 'bg-blue-100'}`}>
              <BookOpen size={18} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
            </div>
            <div>
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {exportandoManual ? 'Generando...' : 'Manual de Usuario'}
              </p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Guía completa del sistema para todo el personal</p>
            </div>
            <Download size={14} className={`ml-auto shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
          </button>
        </div>
      </Card>
    </div>
  )
}

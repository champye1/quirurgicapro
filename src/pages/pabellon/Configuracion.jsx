import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { MessageSquare, Save, CheckCircle2, AlertTriangle, Phone, Wifi, WifiOff, Building2, Bell, Play, Download, Database, FileSignature, BookOpen } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useNotifications } from '../../hooks/useNotifications'
import { sanitizeString } from '../../utils/sanitizeInput'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useClinicInfo, useSaveClinicInfo, CLINIC_INFO_DEFAULTS } from '../../hooks/useClinicInfo'
import { logger } from '../../utils/logger'
import { exportContratoPDF, exportManualPDF } from '../../utils/exportData'

const WHATSAPP_KEY = 'whatsapp_config'

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

  const fieldClass = `w-full px-4 py-2.5 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
    isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
  }`
  const labelClass = `block text-[10px] font-black uppercase tracking-widest mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-xl mx-auto">
      <div className="mb-8">
        <h2 className={`text-2xl lg:text-3xl font-black tracking-tighter uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Configuración
        </h2>
        <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
          Integraciones y ajustes del sistema
        </p>
      </div>

      {/* ── Información de la Clínica ── */}
      <Card className="p-6 space-y-5">
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

      {/* ── WhatsApp Business ── */}
      <Card className="p-6 space-y-6">
        {/* Header de sección */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <MessageSquare size={20} className="text-green-600" />
          </div>
          <div>
            <h3 className={`font-black text-sm uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              WhatsApp Business
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Notificaciones automáticas a pacientes y médicos
            </p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.activo ? 'bg-green-500' : (isDark ? 'bg-slate-600' : 'bg-slate-200')}`}
              role="switch"
              aria-checked={form.activo}
              aria-label="Activar WhatsApp"
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.activo ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className={`flex items-start gap-3 rounded-xl p-4 border ${isDark ? 'bg-blue-900/20 border-blue-800 text-blue-200' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs font-medium leading-relaxed">
            Se requiere una cuenta de <strong>WhatsApp Business API</strong> (Twilio, Meta Cloud API u otro proveedor). Ingresa las credenciales proporcionadas por tu proveedor.
          </p>
        </div>

        {/* Campos */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className={`h-10 rounded-xl animate-pulse ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`} />)}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>
                <Phone size={9} className="inline mr-1" /> Número de envío
              </label>
              <input
                type="tel"
                placeholder="+56912345678"
                value={form.numero}
                onChange={e => { setForm(f => ({ ...f, numero: e.target.value })); setTestResult(null) }}
                className={fieldClass}
              />
              <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Número en formato internacional con código de país</p>
            </div>

            <div>
              <label className={labelClass}>ID de instancia / SID</label>
              <input
                type="text"
                placeholder="instance_id o account_sid"
                value={form.instancia}
                onChange={e => { setForm(f => ({ ...f, instancia: e.target.value })); setTestResult(null) }}
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass}>Token de acceso</label>
              <input
                type="password"
                placeholder="••••••••••••••••"
                value={form.token}
                onChange={e => { setForm(f => ({ ...f, token: e.target.value })); setTestResult(null) }}
                className={fieldClass}
                autoComplete="new-password"
              />
            </div>
          </div>
        )}

        {/* Resultado del test */}
        {testResult && (
          <div className={`flex items-center gap-2 text-xs font-bold rounded-xl px-4 py-3 ${
            testResult === 'ok'
              ? (isDark ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-green-50 text-green-700 border border-green-200')
              : (isDark ? 'bg-red-900/30 text-red-400 border border-red-700' : 'bg-red-50 text-red-700 border border-red-200')
          }`}>
            {testResult === 'ok' ? <Wifi size={14} /> : <WifiOff size={14} />}
            {testResult === 'ok' ? 'Conexión exitosa con WhatsApp API' : 'No se pudo conectar — verifique las credenciales'}
          </div>
        )}

        {/* Estado actual */}
        <div className={`flex items-center gap-2 text-xs font-bold rounded-xl px-4 py-3 ${
          form.activo
            ? (isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700')
            : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-50 text-slate-500')
        }`}>
          <CheckCircle2 size={14} />
          {form.activo ? 'Integración activa — se enviarán notificaciones por WhatsApp' : 'Integración desactivada'}
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => probarConexion.mutate()}
            loading={probarConexion.isPending}
            className="flex-1"
          >
            <Wifi size={14} className="mr-2" />
            Probar conexión
          </Button>
          <Button
            onClick={() => guardar.mutate()}
            loading={guardar.isPending}
            className="flex-1"
          >
            <Save size={15} className="mr-2" />
            Guardar
          </Button>
        </div>
      </Card>

      {/* ── Exportar datos ── */}
      <Card className="p-6 space-y-4">
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
      <Card className="p-6 space-y-5">
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

      {/* Documentos */}
      <Card>
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

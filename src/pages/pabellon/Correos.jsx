import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { logger } from '../../utils/logger'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Mail, MailOpen, Archive, Trash2, Clock, AlertTriangle,
  Search, User, Phone, Building2, ChevronDown, ChevronUp,
  StickyNote, Link2, CheckCircle2, Settings, Eye, EyeOff,
  RefreshCw, CheckCircle, XCircle, MessageSquare
} from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { useTheme } from '../../contexts/ThemeContext'
import { sanitizeString } from '../../utils/sanitizeInput'
import EmptyState from '../../components/common/EmptyState'
import Modal from '../../components/common/Modal'

const URGENCIA_CONFIG = {
  urgente: { label: 'Urgente', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', icon: AlertTriangle },
  normal:  { label: 'Normal',  bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', icon: Clock },
  electiva:{ label: 'Electiva',bg: 'bg-green-100',text: 'text-green-800',border: 'border-green-200',icon: CheckCircle2 },
}

export default function Correos() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { showSuccess, showError } = useNotifications()
  const queryClient = useQueryClient()

  const [filtro, setFiltro] = useState('no_leidos')
  const [busqueda, setBusqueda] = useState('')
  const [mensajeAbierto, setMensajeAbierto] = useState(null)
  const [notasEditando, setNotasEditando] = useState('')
  const [guardandoNotas, setGuardandoNotas] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showGmailConfig, setShowGmailConfig] = useState(false)
  const [gmailForm, setGmailForm] = useState({ email: '', client_id: '', client_secret: '', refresh_token: '' })
  const [showSecrets, setShowSecrets] = useState({ client_id: false, client_secret: false, refresh_token: false })
  const [pollingManual, setPollingManual] = useState(false)
  const [showWspConfig, setShowWspConfig] = useState(false)
  const [wspForm, setWspForm] = useState({ phone_number_id: '', access_token: '' })
  const [showWspSecrets, setShowWspSecrets] = useState({ phone_number_id: false, access_token: false })
  const [replyModal, setReplyModal] = useState(null) // { to, subject, mensajeId }
  const [replyText, setReplyText] = useState('')
  const [enviandoReply, setEnviandoReply] = useState(false)

  // ──────────────── QUERY ────────────────
  const { data: mensajes = [], isLoading } = useQuery({
    queryKey: ['external-messages', filtro],
    queryFn: async () => {
      let query = supabase
        .from('external_messages')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (filtro === 'no_leidos') {
        query = query.eq('leido', false).eq('archivado', false)
      } else if (filtro === 'todos') {
        query = query.eq('archivado', false)
      } else if (filtro === 'archivados') {
        query = query.eq('archivado', true)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    refetchInterval: 30000,
  })

  // Contadores para los tabs
  const { data: contadores = { no_leidos: 0, todos: 0, archivados: 0 } } = useQuery({
    queryKey: ['external-messages-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_messages')
        .select('leido, archivado')
        .is('deleted_at', null)
      if (error) return { no_leidos: 0, todos: 0, archivados: 0 }
      return {
        no_leidos: data.filter(m => !m.leido && !m.archivado).length,
        todos: data.filter(m => !m.archivado).length,
        archivados: data.filter(m => m.archivado).length,
      }
    },
    refetchInterval: 30000,
  })

  // ──────────────── GMAIL CONFIG ────────────────
  const { data: gmailConfig } = useQuery({
    queryKey: ['gmail-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_settings')
        .select('value')
        .eq('key', 'gmail_config')
        .maybeSingle()
      return data?.value || null
    },
  })

  // Abrir modal con datos existentes
  const handleOpenGmailConfig = () => {
    setGmailForm({
      email:         gmailConfig?.email         || '',
      client_id:     gmailConfig?.client_id     || '',
      client_secret: gmailConfig?.client_secret || '',
      refresh_token: gmailConfig?.refresh_token || '',
    })
    setShowGmailConfig(true)
  }

  const guardarGmailConfig = useMutation({
    mutationFn: async (form) => {
      const { error } = await supabase
        .from('clinic_settings')
        .upsert({ key: 'gmail_config', value: form, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-config'] })
      setShowGmailConfig(false)
      showSuccess('Configuración de Gmail guardada correctamente.')
    },
    onError: () => showError('Error al guardar la configuración de Gmail.'),
  })

  // ──────────────── WHATSAPP CONFIG ────────────────
  const { data: wspConfig } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_settings')
        .select('value')
        .eq('key', 'whatsapp_config')
        .maybeSingle()
      return data?.value || null
    },
  })

  const handleOpenWspConfig = () => {
    setWspForm({
      phone_number_id: wspConfig?.phone_number_id || '',
      access_token:    wspConfig?.access_token    || '',
    })
    setShowWspConfig(true)
  }

  const guardarWspConfig = useMutation({
    mutationFn: async (form) => {
      const { error } = await supabase
        .from('clinic_settings')
        .upsert({ key: 'whatsapp_config', value: form, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] })
      setShowWspConfig(false)
      showSuccess('Configuración de WhatsApp guardada correctamente.')
    },
    onError: () => showError('Error al guardar la configuración de WhatsApp.'),
  })

  const ejecutarPollManual = async () => {
    setPollingManual(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('poll-gmail', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (error) throw error
      if (data?.inserted > 0) {
        showSuccess(`Se importaron ${data.inserted} mensaje(s) nuevo(s).`)
        queryClient.invalidateQueries({ queryKey: ['external-messages'] })
        queryClient.invalidateQueries({ queryKey: ['external-messages-count'] })
      } else {
        logger.debug('poll-gmail response:', data)
        showSuccess('No hay mensajes nuevos en Gmail.')
      }
    } catch (e) {
      logger.errorWithContext('poll-gmail error', e)
      // Intentar extraer el body del error
      if (e?.context) {
        try { const body = await e.context.json(); logger.debug('poll-gmail error body:', body) } catch { /* no-op */ }
      }
      showError('Error al consultar Gmail: ' + (e?.message || 'Error desconocido'))
    } finally {
      setPollingManual(false)
    }
  }

  // ──────────────── BÚSQUEDA LOCAL ────────────────
  const mensajesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return mensajes
    const b = busqueda.toLowerCase()
    return mensajes.filter(m =>
      m.nombre_remitente?.toLowerCase().includes(b) ||
      m.asunto?.toLowerCase().includes(b) ||
      m.mensaje?.toLowerCase().includes(b) ||
      m.nombre_paciente?.toLowerCase().includes(b) ||
      m.email_remitente?.toLowerCase().includes(b)
    )
  }, [mensajes, busqueda])

  // ──────────────── MUTATIONS ────────────────
  const marcarLeido = useMutation({
    mutationFn: async (id) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('external_messages')
        .update({ leido: true, leido_at: new Date().toISOString(), leido_por: user?.id })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-messages'] })
      queryClient.invalidateQueries({ queryKey: ['external-messages-count'] })
      queryClient.invalidateQueries({ queryKey: ['external-messages-unread'] })
    },
  })

  const archivar = useMutation({
    mutationFn: async ({ id, archivar: val }) => {
      const { error } = await supabase
        .from('external_messages')
        .update({ archivado: val })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { archivar: val }) => {
      queryClient.invalidateQueries({ queryKey: ['external-messages'] })
      queryClient.invalidateQueries({ queryKey: ['external-messages-count'] })
      queryClient.invalidateQueries({ queryKey: ['external-messages-unread'] })
      showSuccess(val ? 'Mensaje archivado' : 'Mensaje restaurado')
    },
    onError: () => showError('Error al archivar el mensaje'),
  })

  const eliminar = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('external_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-messages'] })
      queryClient.invalidateQueries({ queryKey: ['external-messages-count'] })
      queryClient.invalidateQueries({ queryKey: ['external-messages-unread'] })
      showSuccess('Mensaje eliminado')
      if (mensajeAbierto) setMensajeAbierto(null)
    },
    onError: () => showError('Error al eliminar el mensaje'),
  })

  const guardarNotas = async (id) => {
    setGuardandoNotas(true)
    try {
      const { error } = await supabase
        .from('external_messages')
        .update({ notas_internas: notasEditando })
        .eq('id', id)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['external-messages'] })
      showSuccess('Notas guardadas')
    } catch {
      showError('Error al guardar notas')
    } finally {
      setGuardandoNotas(false)
    }
  }

  const handleAbrirMensaje = (m) => {
    setMensajeAbierto(m)
    setNotasEditando(m.notas_internas || '')
    if (!m.leido) {
      // Cambiar a "Todos" antes de marcar como leído para que el mensaje
      // no desaparezca de la vista mientras el usuario lo está leyendo
      if (filtro === 'no_leidos') setFiltro('todos')
      marcarLeido.mutate(m.id)
    }
  }

  const urlContacto = `${window.location.origin}/contacto`

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const enviarRespuesta = async () => {
    if (!replyModal || !replyText.trim()) return
    if (!EMAIL_REGEX.test(replyModal.to)) {
      showError('La dirección de email del destinatario no es válida.')
      return
    }
    setEnviandoReply(true)
    try {
      const html = `<p>${replyText.trim().replace(/\n/g, '<br/>')}</p>
        <hr style="margin:16px 0;border:none;border-top:1px solid #e2e8f0"/>
        <p style="color:#94a3b8;font-size:12px">Portal Clínico — Respuesta enviada desde la bandeja de correos</p>`
      const { error } = await supabase.functions.invoke('send-email', {
        body: { to: replyModal.to, subject: `Re: ${replyModal.subject}`, html },
      })
      if (error) throw error
      showSuccess('Respuesta enviada correctamente')
      setReplyModal(null)
      setReplyText('')
    } catch (err) {
      showError('No se pudo enviar la respuesta. Verifica la configuración de Gmail.')
      logger.warn('Error enviando reply:', err?.message)
    } finally {
      setEnviandoReply(false)
    }
  }

  // ──────────────── RENDER ────────────────
  return (
    <div className="animate-in fade-in slide-in-from-right duration-500 max-w-5xl mx-auto px-4 sm:px-6 lg:px-0">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter uppercase mb-1 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            Bandeja de Correos
          </h2>
          <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest ${
            isDark ? 'text-slate-400' : 'text-slate-400'
          }`}>
            Mensajes de médicos externos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={ejecutarPollManual}
            disabled={pollingManual}
            title="Revisar Gmail ahora"
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold uppercase transition-all disabled:opacity-50 ${
              isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${pollingManual ? 'animate-spin' : ''}`} />
            {pollingManual ? 'Revisando...' : 'Revisar Gmail'}
          </button>
          <button
            onClick={handleOpenGmailConfig}
            title="Configurar Gmail"
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold uppercase transition-all ${
              isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            {gmailConfig?.email
              ? <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" />{gmailConfig.email}</span>
              : <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400" />Configurar Gmail</span>
            }
          </button>
          <button
            onClick={handleOpenWspConfig}
            title="Configurar WhatsApp"
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold uppercase transition-all ${
              isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            {wspConfig?.phone_number_id
              ? <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" />WhatsApp</span>
              : <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400" />WhatsApp</span>
            }
          </button>
          <button
            onClick={() => setShowLinkModal(true)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold uppercase transition-all ${
              isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Link2 className="w-4 h-4" />
            Enlace contacto
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 rounded-2xl mb-6 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        {[
          { key: 'no_leidos', label: 'No leídos', count: contadores.no_leidos },
          { key: 'todos',     label: 'Todos',     count: contadores.todos },
          { key: 'archivados',label: 'Archivados',count: contadores.archivados },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setFiltro(tab.key); setBusqueda('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              filtro === tab.key
                ? 'bg-blue-600 text-white shadow-md'
                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                filtro === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="relative mb-6">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(sanitizeString(e.target.value))}
          placeholder="Buscar por nombre, asunto, paciente..."
          className={`w-full pl-11 pr-4 py-2.5 border-2 rounded-xl focus:outline-none focus:border-blue-500 text-sm font-medium transition-all ${
            isDark
              ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
              : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
          }`}
        />
      </div>

      {/* Lista de mensajes */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className={`h-24 rounded-2xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
          ))}
        </div>
      ) : mensajesFiltrados.length === 0 ? (
        <EmptyState
          icon={Mail}
          title={busqueda.trim() ? 'Sin resultados' : filtro === 'no_leidos' ? 'No hay mensajes sin leer' : 'No hay mensajes'}
          description={busqueda.trim() ? `No hay mensajes que coincidan con "${busqueda}"` : filtro === 'no_leidos' ? 'Todos los correos han sido revisados' : 'La bandeja está vacía'}
        />
      ) : (
        <div className="space-y-3">
          {mensajesFiltrados.map(m => {
            const urgCfg = URGENCIA_CONFIG[m.urgencia] || URGENCIA_CONFIG.normal
            const UrgIcon = urgCfg.icon
            const isExpanded = expandedId === m.id

            return (
              <div
                key={m.id}
                className={`rounded-2xl border transition-all ${
                  !m.leido
                    ? isDark ? 'bg-blue-950/40 border-blue-700' : 'bg-blue-50 border-blue-200'
                    : isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                {/* Fila principal */}
                <div
                  className="flex items-start gap-4 p-4 sm:p-5 cursor-pointer"
                  onClick={() => {
                    handleAbrirMensaje(m)
                    setExpandedId(isExpanded ? null : m.id)
                  }}
                >
                  {/* Ícono leído/no leído */}
                  <div className={`flex-shrink-0 mt-0.5 ${!m.leido ? 'text-blue-500' : isDark ? 'text-slate-500' : 'text-slate-300'}`}>
                    {!m.leido ? <Mail className="w-5 h-5" /> : <MailOpen className="w-5 h-5" />}
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {/* Badge fuente: Gmail o Formulario */}
                      {m.fuente === 'gmail' ? (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${isDark ? 'bg-red-900/40 text-red-300 border-red-700' : 'bg-red-50 text-red-600 border-red-200'}`}>
                          Gmail
                        </span>
                      ) : (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${isDark ? 'bg-slate-700 text-slate-400 border-slate-600' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          Formulario web
                        </span>
                      )}
                      <span className={`font-black text-sm truncate ${!m.leido ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-300' : 'text-slate-600')}`}>
                        {m.nombre_remitente}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${urgCfg.bg} ${urgCfg.text} ${urgCfg.border}`}>
                        <UrgIcon className="inline w-3 h-3 mr-0.5 -mt-0.5" />
                        {urgCfg.label}
                      </span>
                      {!m.leido && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className={`text-sm font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {m.asunto}
                    </p>
                    <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {m.mensaje}
                    </p>
                  </div>

                  {/* Fecha + expand */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2 ml-2">
                    <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                      {m.created_at ? format(new Date(m.created_at), "d MMM", { locale: es }) : '—'}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div className={`border-t px-4 sm:px-5 pb-5 pt-4 space-y-4 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                    {/* Info remitente */}
                    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-4 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                          <span className="font-black">Dr. </span>{m.nombre_remitente}
                          {m.especialidad_remitente && ` · ${m.especialidad_remitente}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <a
                          href={`mailto:${m.email_remitente}`}
                          className="text-blue-500 hover:underline truncate"
                          onClick={e => e.stopPropagation()}
                        >
                          {m.email_remitente}
                        </a>
                      </div>
                      {m.telefono_remitente && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{m.telefono_remitente}</span>
                        </div>
                      )}
                      {m.institucion_remitente && (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{m.institucion_remitente}</span>
                        </div>
                      )}
                    </div>

                    {/* Datos paciente */}
                    {(m.nombre_paciente || m.tipo_cirugia) && (
                      <div className={`text-xs p-3 rounded-xl border ${isDark ? 'bg-slate-700/30 border-slate-600' : 'bg-blue-50 border-blue-100'}`}>
                        <p className={`font-black uppercase text-[10px] mb-2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Paciente</p>
                        {m.nombre_paciente && <p className={isDark ? 'text-slate-200' : 'text-slate-700'}>Nombre: <span className="font-bold">{m.nombre_paciente}</span>{m.rut_paciente && ` · RUT: ${m.rut_paciente}`}</p>}
                        {m.tipo_cirugia && <p className={`mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Cirugía: <span className="font-bold">{m.tipo_cirugia}</span></p>}
                      </div>
                    )}

                    {/* Mensaje completo */}
                    <div>
                      <p className={`text-[10px] font-black uppercase mb-2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Mensaje</p>
                      <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {m.mensaje}
                      </p>
                    </div>

                    {/* Notas internas */}
                    <div>
                      <p className={`text-[10px] font-black uppercase mb-2 flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                        <StickyNote className="w-3.5 h-3.5" /> Notas internas (solo pabellón)
                      </p>
                      <textarea
                        value={mensajeAbierto?.id === m.id ? notasEditando : (m.notas_internas || '')}
                        onChange={e => {
                          if (mensajeAbierto?.id === m.id) setNotasEditando(e.target.value)
                        }}
                        onFocus={() => {
                          if (mensajeAbierto?.id !== m.id) {
                            setMensajeAbierto(m)
                            setNotasEditando(m.notas_internas || '')
                          }
                        }}
                        placeholder="Agregar notas de seguimiento, recordatorios, etc."
                        rows={3}
                        className={`w-full px-3 py-2 border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          isDark ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
                        }`}
                        maxLength={1000}
                        onClick={e => e.stopPropagation()}
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          disabled={guardandoNotas}
                          onClick={e => { e.stopPropagation(); guardarNotas(m.id) }}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                          {guardandoNotas ? 'Guardando...' : 'Guardar notas'}
                        </button>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {m.email_remitente ? (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                          onClick={e => { e.stopPropagation(); setReplyModal({ to: m.email_remitente, subject: m.asunto, mensajeId: m.id }); setReplyText('') }}
                        >
                          <Mail className="w-3.5 h-3.5" /> Responder por email
                        </button>
                      ) : (
                        <span
                          className="flex items-center gap-1.5 px-3 py-2 bg-gray-200 text-gray-400 text-xs font-bold rounded-xl cursor-not-allowed"
                          title="El mensaje no tiene dirección de email"
                          onClick={e => e.stopPropagation()}
                        >
                          <Mail className="w-3.5 h-3.5" /> Sin email
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={archivar.isPending}
                        onClick={e => { e.stopPropagation(); archivar.mutate({ id: m.id, archivar: !m.archivado }) }}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Archive className="w-3.5 h-3.5" />
                        {m.archivado ? 'Restaurar' : 'Archivar'}
                      </button>
                      <button
                        type="button"
                        disabled={eliminar.isPending}
                        onClick={e => {
                          e.stopPropagation()
                          if (window.confirm('¿Eliminar este mensaje? Esta acción no se puede deshacer.')) {
                            eliminar.mutate(m.id)
                            setExpandedId(null)
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: configuración Gmail */}
      <Modal
        isOpen={showGmailConfig}
        onClose={() => setShowGmailConfig(false)}
        title="Configurar integración Gmail"
      >
        <div className="space-y-4">
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Ingresa las credenciales de la cuenta de Gmail que recibirá los correos de médicos externos.
            Necesitas un proyecto en Google Cloud con la API de Gmail habilitada.
          </p>

          {/* Email */}
          <div>
            <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Correo Gmail
            </label>
            <input
              type="email"
              value={gmailForm.email}
              onChange={e => setGmailForm(f => ({ ...f, email: e.target.value }))}
              placeholder="pabellon@gmail.com"
              className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
              }`}
            />
          </div>

          {/* Client ID */}
          <div>
            <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Client ID
            </label>
            <div className="relative">
              <input
                type={showSecrets.client_id ? 'text' : 'password'}
                value={gmailForm.client_id}
                onChange={e => setGmailForm(f => ({ ...f, client_id: e.target.value }))}
                placeholder="xxxxxxxxxx.apps.googleusercontent.com"
                className={`w-full px-3 py-2 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
                }`}
              />
              <button type="button" onClick={() => setShowSecrets(s => ({ ...s, client_id: !s.client_id }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showSecrets.client_id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Client Secret */}
          <div>
            <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Client Secret
            </label>
            <div className="relative">
              <input
                type={showSecrets.client_secret ? 'text' : 'password'}
                value={gmailForm.client_secret}
                onChange={e => setGmailForm(f => ({ ...f, client_secret: e.target.value }))}
                placeholder="GOCSPX-xxxxxxxxxxxx"
                className={`w-full px-3 py-2 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
                }`}
              />
              <button type="button" onClick={() => setShowSecrets(s => ({ ...s, client_secret: !s.client_secret }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showSecrets.client_secret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Refresh Token */}
          <div>
            <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Refresh Token
            </label>
            <div className="relative">
              <input
                type={showSecrets.refresh_token ? 'text' : 'password'}
                value={gmailForm.refresh_token}
                onChange={e => setGmailForm(f => ({ ...f, refresh_token: e.target.value }))}
                placeholder="1//xxxxxxxxxxxx"
                className={`w-full px-3 py-2 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
                }`}
              />
              <button type="button" onClick={() => setShowSecrets(s => ({ ...s, refresh_token: !s.refresh_token }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showSecrets.refresh_token ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className={`text-[10px] p-3 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
            Para obtener estas credenciales: Google Cloud Console → APIs → Gmail API → Credenciales → OAuth 2.0.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowGmailConfig(false)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={guardarGmailConfig.isPending || !gmailForm.email}
              onClick={() => guardarGmailConfig.mutate(gmailForm)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {guardarGmailConfig.isPending ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: configuración WhatsApp */}
      <Modal
        isOpen={showWspConfig}
        onClose={() => setShowWspConfig(false)}
        title="Configurar WhatsApp Business"
      >
        <div className="space-y-4">
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Ingresa las credenciales de tu app de Meta para enviar notificaciones por WhatsApp.
            Necesitas una cuenta en Meta for Developers con el producto WhatsApp habilitado.
          </p>

          <div>
            <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Phone Number ID
            </label>
            <div className="relative">
              <input
                type={showWspSecrets.phone_number_id ? 'text' : 'password'}
                value={wspForm.phone_number_id}
                onChange={e => setWspForm(f => ({ ...f, phone_number_id: e.target.value }))}
                placeholder="123456789012345"
                className={`w-full px-3 py-2 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
                }`}
              />
              <button type="button" onClick={() => setShowWspSecrets(s => ({ ...s, phone_number_id: !s.phone_number_id }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showWspSecrets.phone_number_id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Access Token
            </label>
            <div className="relative">
              <input
                type={showWspSecrets.access_token ? 'text' : 'password'}
                value={wspForm.access_token}
                onChange={e => setWspForm(f => ({ ...f, access_token: e.target.value }))}
                placeholder="EAAxxxxxxxxxxxxxxxx"
                className={`w-full px-3 py-2 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
                }`}
              />
              <button type="button" onClick={() => setShowWspSecrets(s => ({ ...s, access_token: !s.access_token }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showWspSecrets.access_token ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className={`text-[10px] p-3 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-green-50 border-green-100 text-green-700'}`}>
            Meta for Developers → Tu App → WhatsApp → API Setup → Phone Number ID y Access Token.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowWspConfig(false)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={guardarWspConfig.isPending || !wspForm.phone_number_id || !wspForm.access_token}
              onClick={() => guardarWspConfig.mutate(wspForm)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {guardarWspConfig.isPending ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: enlace de contacto */}
      <Modal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title="Enlace de contacto para médicos externos"
      >
        <div className="space-y-4">
          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Comparte este enlace con médicos externos para que puedan enviar solicitudes de hora quirúrgica directamente al pabellón, sin necesidad de una cuenta en el sistema.
          </p>
          <div className={`flex items-center gap-2 p-3 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <code className={`flex-1 text-xs break-all ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
              {urlContacto}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(urlContacto).then(() => showSuccess('Enlace copiado'))
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex-shrink-0"
            >
              Copiar
            </button>
          </div>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Los mensajes recibidos aparecerán en esta bandeja marcados como "No leídos". Recibirás un indicador visual en el menú lateral.
          </p>
        </div>
      </Modal>

      {/* Modal: responder email */}
      <Modal
        isOpen={!!replyModal}
        onClose={() => { setReplyModal(null); setReplyText('') }}
        title={`Responder a ${replyModal?.to ?? ''}`}
      >
        <div className="space-y-4">
          <div>
            <p className={`text-xs font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Asunto</p>
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Re: {replyModal?.subject}
            </p>
          </div>
          <div>
            <label className={`text-xs font-bold block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Mensaje *
            </label>
            <textarea
              value={replyText}
              onChange={e => setReplyText(sanitizeString(e.target.value))}
              rows={6}
              maxLength={3000}
              placeholder="Escriba su respuesta aquí..."
              className={`w-full px-4 py-3 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
              }`}
            />
            <p className={`text-xs text-right mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{replyText.length}/3000</p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setReplyModal(null); setReplyText('') }}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={enviandoReply || !replyText.trim()}
              onClick={enviarRespuesta}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {enviandoReply ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</>
              ) : (
                <><Mail className="w-3.5 h-3.5" />Enviar respuesta</>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import ChatView from '../../components/common/ChatView'
import { MessageSquare, Users } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Chat() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const queryClient = useQueryClient()
  const [selectedRequest, setSelectedRequest] = useState(null) // null = canal general

  const { data: doctor } = useQuery({
    queryKey: ['doctor-actual'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('doctors')
        .select('id, nombre, apellido')
        .eq('user_id', user.id)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: threads = [] } = useQuery({
    queryKey: ['doctor-chat-threads', doctor?.id],
    enabled: !!doctor?.id,
    queryFn: async () => {
      // Obtener solicitudes del doctor para filtrar sus threads
      const { data: solicitudes } = await supabase
        .from('surgery_requests')
        .select('id, codigo_operacion, patients:patient_id(nombre, apellido)')
        .eq('doctor_id', doctor.id)
        .is('deleted_at', null)

      const solicitudIds = (solicitudes || []).map(s => s.id)
      const solicitudMap = Object.fromEntries((solicitudes || []).map(s => [s.id, s]))

      // Mensajes del canal general + mensajes de sus solicitudes
      let query = supabase
        .from('chat_messages')
        .select('id, surgery_request_id, sender_role, created_at, contenido, leido')
        .order('created_at', { ascending: false })
        .limit(500)

      if (solicitudIds.length > 0) {
        query = query.or(`surgery_request_id.is.null,surgery_request_id.in.(${solicitudIds.join(',')})`)
      } else {
        query = query.is('surgery_request_id', null)
      }

      const { data, error } = await query
      if (error) throw error

      const mapa = new Map()
      ;(data || []).forEach(msg => {
        const key = msg.surgery_request_id ?? '__general__'
        if (!mapa.has(key)) {
          const sol = msg.surgery_request_id ? solicitudMap[msg.surgery_request_id] : null
          mapa.set(key, {
            surgery_request_id: msg.surgery_request_id,
            lastMessage: msg,
            label: sol
              ? `${sol.codigo_operacion} — ${sol.patients?.nombre ?? ''} ${sol.patients?.apellido ?? ''}`
              : 'Canal General',
            unread: 0,
          })
        }
        const thread = mapa.get(key)
        if (!msg.leido && msg.sender_role === 'pabellon') {
          thread.unread++
        }
      })

      return Array.from(mapa.values()).sort(
        (a, b) => new Date(b.lastMessage.created_at ?? 0) - new Date(a.lastMessage.created_at ?? 0)
      )
    },
    refetchInterval: 15000,
  })

  useEffect(() => {
    if (!doctor?.id) return
    const channel = supabase
      .channel('doctor-chat-threads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['doctor-chat-threads', doctor.id] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [doctor?.id, queryClient])

  const totalUnread = threads.reduce((acc, t) => acc + t.unread, 0)
  const selectedKey = selectedRequest ?? '__general__'

  const cardBg = dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  const textPrimary = dark ? 'text-white' : 'text-slate-900'
  const textSec = dark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </div>
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </div>
        <div>
          <h1 className={`text-2xl font-black ${textPrimary}`}>Chat con Pabellón</h1>
          <p className={`text-sm mt-0.5 ${textSec}`}>
            Comunícate directamente con el equipo de pabellón
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: 'calc(100vh - 12rem)' }}>
        {/* Sidebar */}
        <div className={`lg:col-span-1 rounded-2xl border overflow-y-auto ${cardBg}`}>
          <div className={`px-4 py-3 border-b ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
            <p className={`text-xs font-black uppercase tracking-wider ${textSec}`}>
              <Users className="inline w-3 h-3 mr-1" />Conversaciones
            </p>
          </div>

          {/* Canal general */}
          <button
            onClick={() => setSelectedRequest(null)}
            className={`w-full text-left px-4 py-3 border-b transition-colors ${dark ? 'border-slate-700' : 'border-slate-200'} ${
              selectedKey === '__general__'
                ? dark ? 'bg-blue-900/30' : 'bg-blue-50'
                : dark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-sm font-bold ${textPrimary}`}>Canal General</p>
              {threads.find(t => t.surgery_request_id === null)?.unread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {threads.find(t => t.surgery_request_id === null).unread > 9 ? '9+' : threads.find(t => t.surgery_request_id === null).unread}
                </span>
              )}
            </div>
            <p className={`text-xs mt-0.5 truncate ${textSec}`}>Chat con el equipo de pabellón</p>
          </button>

          {/* Threads por solicitud */}
          {threads.filter(t => t.surgery_request_id !== null).map(t => (
            <button
              key={t.surgery_request_id}
              onClick={() => setSelectedRequest(t.surgery_request_id)}
              className={`w-full text-left px-4 py-3 border-b transition-colors ${dark ? 'border-slate-700' : 'border-slate-200'} ${
                selectedKey === t.surgery_request_id
                  ? dark ? 'bg-blue-900/30' : 'bg-blue-50'
                  : dark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-xs font-bold truncate ${textPrimary}`}>{t.label}</p>
                {t.unread > 0 && (
                  <span className="ml-1 flex-shrink-0 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {t.unread > 9 ? '9+' : t.unread}
                  </span>
                )}
              </div>
              <p className={`text-xs mt-0.5 truncate ${textSec}`}>
                {t.lastMessage.created_at
                  ? format(new Date(t.lastMessage.created_at), 'd MMM, HH:mm', { locale: es })
                  : '—'}
                {' · '}{t.lastMessage.contenido.slice(0, 30)}{t.lastMessage.contenido.length > 30 ? '…' : ''}
              </p>
            </button>
          ))}

          {threads.filter(t => t.surgery_request_id !== null).length === 0 && (
            <p className={`text-xs px-4 py-6 text-center ${textSec}`}>
              Sin conversaciones de solicitudes aún
            </p>
          )}
        </div>

        {/* Panel de chat */}
        <div className="lg:col-span-3 min-h-0 flex flex-col" style={{ height: '100%' }}>
          <div className={`text-xs font-bold px-4 py-2 rounded-t-xl border border-b-0 ${
            dark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            {selectedKey === '__general__'
              ? 'Canal General'
              : threads.find(t => t.surgery_request_id === selectedKey)?.label ?? 'Conversación'}
          </div>
          <div className="flex-1 min-h-0">
            <ChatView
              key={selectedKey}
              senderRole="doctor"
              surgeryRequestId={selectedRequest}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

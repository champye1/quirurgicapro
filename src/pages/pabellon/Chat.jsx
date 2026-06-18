import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import ChatView from '../../components/common/ChatView'
import { MessageSquare, Users } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Chat() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  // Conversaciones: mensajes agrupados por (doctor_id via surgery_request_id OR global)
  const [selectedRequest, setSelectedRequest] = useState(null) // null = canal general

  const { data: threads = [] } = useQuery({
    queryKey: ['chat-threads'],
    queryFn: async () => {
      // Obtener mensajes recientes para ver quién ha escrito
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          id, surgery_request_id, sender_role, created_at, contenido,
          surgery_requests:surgery_request_id(
            id,
            doctors:doctor_id(nombre, apellido),
            patients:patient_id(nombre, apellido)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error

      // Agrupar por surgery_request_id (null = canal general)
      const mapa = new Map()
      ;(data || []).forEach(msg => {
        const key = msg.surgery_request_id ?? '__general__'
        if (!mapa.has(key)) {
          mapa.set(key, {
            surgery_request_id: msg.surgery_request_id,
            lastMessage: msg,
            label: msg.surgery_request_id
              ? `Dr. ${msg.surgery_requests?.doctors?.nombre ?? ''} ${msg.surgery_requests?.doctors?.apellido ?? ''} — ${msg.surgery_requests?.patients?.nombre ?? ''} ${msg.surgery_requests?.patients?.apellido ?? ''}`
              : 'Canal General',
            unread: 0,
          })
        }
        const thread = mapa.get(key)
        if (!msg.leido && msg.sender_role === 'doctor') {
          thread.unread++
        }
      })
      return Array.from(mapa.values()).sort((a, b) =>
        new Date(b.lastMessage.created_at ?? 0) - new Date(a.lastMessage.created_at ?? 0)
      )
    },
    refetchInterval: 15000,
  })

  // Chat actualiza via polling (refetchInterval: 15000)

  const cardBg = dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  const textPrimary = dark ? 'text-white' : 'text-slate-900'
  const textSec = dark ? 'text-slate-400' : 'text-slate-500'

  const selectedKey = selectedRequest ?? '__general__'

  return (
    <div id="tour-chat-container" className="flex flex-col space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className={`text-2xl font-black ${textPrimary}`}>Chat Interno</h1>
          <p className={`text-sm mt-0.5 ${textSec}`}>Mensajes con médicos y canal general</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: 'calc(100vh - 12rem)' }}>
        {/* Sidebar: threads */}
        <div id="tour-chat-threads" className={`lg:col-span-1 rounded-2xl border overflow-y-auto ${cardBg}`}>
          <div className={`px-4 py-3 border-b ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
            <p className={`text-xs font-black uppercase tracking-wider ${textSec}`}>
              <Users className="inline w-3 h-3 mr-1" />Conversaciones
            </p>
          </div>
          {/* Canal general siempre primero */}
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
            </div>
            <p className={`text-xs mt-0.5 truncate ${textSec}`}>Chat con todos los médicos</p>
          </button>
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
                {t.lastMessage.created_at ? format(new Date(t.lastMessage.created_at), "d MMM, HH:mm", { locale: es }) : '—'}
                {' · '}{t.lastMessage.contenido.slice(0, 30)}{t.lastMessage.contenido.length > 30 ? '…' : ''}
              </p>
            </button>
          ))}
          {threads.filter(t => t.surgery_request_id !== null).length === 0 && (
            <p className={`text-xs px-4 py-6 text-center ${textSec}`}>Sin conversaciones de solicitudes aún</p>
          )}
        </div>

        {/* Chat panel */}
        <div className="lg:col-span-3 min-h-0 flex flex-col" style={{ height: '100%' }}>
          <div className={`text-xs font-bold px-4 py-2 rounded-t-xl border border-b-0 ${dark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
            {selectedKey === '__general__' ? 'Canal General' : threads.find(t => t.surgery_request_id === selectedKey)?.label ?? 'Conversación'}
          </div>
          <div className="flex-1 min-h-0">
            <ChatView
              key={selectedKey}
              senderRole="pabellon"
              surgeryRequestId={selectedRequest}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

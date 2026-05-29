import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { useNotifications } from '../../hooks/useNotifications'
import { Send, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function ChatView({ senderRole, surgeryRequestId = null }) {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const { showError } = useNotifications()
  const queryClient = useQueryClient()
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', surgeryRequestId],
    queryFn: async () => {
      let q = supabase
        .from('chat_messages')
        .select(`
          id, contenido, sender_role, created_at, leido, sender_id,
          users:sender_id(nombre)
        `)
        .order('created_at', { ascending: true })
        .limit(200)

      if (surgeryRequestId) {
        q = q.eq('surgery_request_id', surgeryRequestId)
      } else {
        q = q.is('surgery_request_id', null)
      }

      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${surgeryRequestId ?? 'general'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: surgeryRequestId
            ? `surgery_request_id=eq.${surgeryRequestId}`
            : 'surgery_request_id=is.null',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', surgeryRequestId] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [surgeryRequestId, queryClient])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    const contenido = texto.trim()
    if (!contenido || sending) return
    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('chat_messages').insert({
        sender_id: user.id,
        sender_role: senderRole,
        surgery_request_id: surgeryRequestId,
        contenido,
      })
      if (error) throw error
      setTexto('')
      textareaRef.current?.focus()
    } catch (err) {
      showError('Error al enviar mensaje: ' + (err.message || 'Error desconocido'))
    } finally {
      setSending(false)
    }
  }, [texto, sending, senderRole, surgeryRequestId, showError])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const cardBg = dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  const textPrimary = dark ? 'text-white' : 'text-slate-900'
  const textSec = dark ? 'text-slate-400' : 'text-slate-500'

  const renderMessage = (msg) => {
    const isMe = msg.sender_role === senderRole
    const label = msg.sender_role === 'pabellon' ? 'Pabellón' : (msg.users?.nombre || 'Doctor')
    const time = format(new Date(msg.created_at), 'HH:mm', { locale: es })

    return (
      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isMe
            ? 'bg-blue-600 text-white rounded-br-sm'
            : dark
            ? 'bg-slate-700 text-slate-100 rounded-bl-sm'
            : 'bg-slate-100 text-slate-900 rounded-bl-sm'
        }`}>
          {!isMe && (
            <p className={`text-xs font-bold mb-1 ${dark ? 'text-blue-400' : 'text-blue-600'}`}>{label}</p>
          )}
          <p className="text-sm whitespace-pre-wrap break-words">{msg.contenido}</p>
          <p className={`text-right text-[10px] mt-1 ${isMe ? 'text-blue-200' : textSec}`}>{time}</p>
        </div>
      </div>
    )
  }

  // Group messages by date
  const grouped = []
  let lastDate = null
  messages.forEach(msg => {
    const dateStr = msg.created_at.slice(0, 10)
    if (dateStr !== lastDate) {
      grouped.push({ type: 'date', date: dateStr })
      lastDate = dateStr
    }
    grouped.push({ type: 'message', msg })
  })

  return (
    <div className={`flex flex-col h-full rounded-2xl border ${cardBg} overflow-hidden`}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <MessageSquare className={`w-10 h-10 ${dark ? 'text-slate-600' : 'text-slate-300'}`} />
            <p className={`text-sm ${textSec}`}>Aún no hay mensajes. ¡Inicia la conversación!</p>
          </div>
        ) : (
          grouped.map((item, idx) =>
            item.type === 'date' ? (
              <div key={`date-${idx}`} className="flex items-center gap-2 my-2">
                <hr className={`flex-1 ${dark ? 'border-slate-700' : 'border-slate-200'}`} />
                <span className={`text-xs px-2 ${textSec}`}>
                  {format(new Date(item.date + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })}
                </span>
                <hr className={`flex-1 ${dark ? 'border-slate-700' : 'border-slate-200'}`} />
              </div>
            ) : renderMessage(item.msg)
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className={`border-t p-3 ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje… (Enter para enviar)"
            rows={1}
            maxLength={2000}
            className={`flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none border-2 transition-colors min-h-[44px] max-h-32 ${
              dark
                ? 'bg-slate-700 border-slate-600 focus:border-blue-500 text-white placeholder-slate-400'
                : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
            }`}
            style={{ fieldSizing: 'content' }}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!texto.trim() || sending}
            className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex-shrink-0"
            aria-label="Enviar mensaje"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className={`text-[10px] mt-1 ${textSec}`}>Shift+Enter para nueva línea</p>
      </div>
    </div>
  )
}

import { useTheme } from '../../contexts/ThemeContext'
import ChatView from '../../components/common/ChatView'
import { MessageSquare } from 'lucide-react'

export default function Chat() {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className={`text-2xl font-black ${dark ? 'text-white' : 'text-slate-900'}`}>Chat con Pabellón</h1>
          <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            Comunícate directamente con el equipo de pabellón
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ChatView senderRole="doctor" />
      </div>
    </div>
  )
}

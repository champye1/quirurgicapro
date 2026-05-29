import { memo } from 'react'
import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1 }}
        className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}
      >
        <Icon size={40} className={isDark ? 'text-slate-400' : 'text-slate-400'} />
      </motion.div>
      <h3 className={`text-lg font-black mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{title}</h3>
      <p className={`text-sm text-center max-w-md mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{description}</p>
      {action && action}
    </motion.div>
  )
}

export default memo(EmptyState)

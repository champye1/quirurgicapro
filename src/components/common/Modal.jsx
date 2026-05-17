import { memo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

function Modal({ isOpen, onClose, children, title, 'aria-label': ariaLabel }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-3 sm:p-4 md:p-6 pointer-events-none"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel || title}
              className="bg-white rounded-2xl sm:rounded-[2rem] lg:rounded-[2.5rem] w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl border border-slate-100 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {title && (
                <div className="bg-slate-900 text-white p-4 sm:p-5 md:p-6 flex items-center justify-between gap-3">
                  <h2 className="text-lg sm:text-xl font-black uppercase tracking-wide leading-relaxed truncate flex-1">{title}</h2>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 active:bg-white/20 rounded-xl transition-colors flex-shrink-0 touch-manipulation"
                    aria-label="Cerrar modal"
                  >
                    <X size={18} className="sm:w-5 sm:h-5" />
                  </button>
                </div>
              )}
              <div className="p-4 sm:p-5 md:p-6 overflow-y-auto max-h-[calc(95vh-80px)] sm:max-h-[calc(90vh-100px)] custom-scrollbar">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default memo(Modal)

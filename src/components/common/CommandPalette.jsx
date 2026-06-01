import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import { Search, User, FileText, Users, Package, X } from 'lucide-react'
import { useDebounce } from '../../hooks/useDebounce'
import { formatRut } from '../../utils/rutFormatter'

// Resultados agrupados con navegación por teclado
export default function CommandPalette({ isOpen, onClose, basePrefix }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const debouncedQuery = useDebounce(query, 250)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const buscar = useCallback(async (q) => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const termino = q.trim()
      const [pacientesRes, solicitudesRes, medicosRes, insumosRes] = await Promise.all([
        supabase.from('patients')
          .select('id, nombre, apellido, rut')
          .or(`nombre.ilike.%${termino}%,apellido.ilike.%${termino}%,rut.ilike.%${termino}%`)
          .is('deleted_at', null)
          .limit(4),
        supabase.from('surgery_requests')
          .select('id, estado, created_at, patients:patient_id(nombre, apellido)')
          .or(`estado.ilike.%${termino}%`)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase.from('doctors')
          .select('id, nombre, apellido, especialidad, estado')
          .or(`nombre.ilike.%${termino}%,apellido.ilike.%${termino}%`)
          .is('deleted_at', null)
          .limit(4),
        supabase.from('supplies')
          .select('id, nombre, codigo')
          .or(`nombre.ilike.%${termino}%,codigo.ilike.%${termino}%`)
          .is('deleted_at', null)
          .eq('activo', true)
          .limit(3),
      ])

      const grupos = []

      const pacientes = pacientesRes.data || []
      if (pacientes.length > 0) {
        grupos.push({
          label: 'Pacientes',
          icon: User,
          items: pacientes.map(p => ({
            id: `paciente-${p.id}`,
            titulo: `${p.nombre} ${p.apellido}`,
            subtitulo: p.rut ? formatRut(p.rut) : '',
            accion: () => { navigate(`${basePrefix}/paciente`); onClose() },
          })),
        })
      }

      const medicos = medicosRes.data || []
      if (medicos.length > 0) {
        grupos.push({
          label: 'Médicos',
          icon: Users,
          items: medicos.map(m => ({
            id: `medico-${m.id}`,
            titulo: `Dr. ${m.nombre} ${m.apellido}`,
            subtitulo: m.especialidad?.replace(/_/g, ' ') || '',
            accion: () => { navigate(`${basePrefix}/medicos`); onClose() },
          })),
        })
      }

      const solicitudes = solicitudesRes.data || []
      if (solicitudes.length > 0) {
        grupos.push({
          label: 'Solicitudes',
          icon: FileText,
          items: solicitudes.map(s => ({
            id: `solicitud-${s.id}`,
            titulo: `${s.patients?.nombre || ''} ${s.patients?.apellido || ''}`.trim() || 'Solicitud',
            subtitulo: s.estado,
            accion: () => { navigate(`${basePrefix}/solicitudes`); onClose() },
          })),
        })
      }

      const insumos = insumosRes.data || []
      if (insumos.length > 0) {
        grupos.push({
          label: 'Insumos',
          icon: Package,
          items: insumos.map(i => ({
            id: `insumo-${i.id}`,
            titulo: i.nombre,
            subtitulo: `Código: ${i.codigo}`,
            accion: () => { navigate(`${basePrefix}/insumos`); onClose() },
          })),
        })
      }

      setResults(grupos)
      setActiveIdx(0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [navigate, basePrefix, onClose])

  useEffect(() => {
    buscar(debouncedQuery)
  }, [debouncedQuery, buscar])

  // Lista plana para navegación por teclado
  const itemsPlanos = results.flatMap(g => g.items)

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, itemsPlanos.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && itemsPlanos[activeIdx]) {
      itemsPlanos[activeIdx].accion()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  let flatIdx = 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar pacientes, médicos, insumos..."
            className="flex-1 outline-none text-slate-800 placeholder-slate-400 text-sm font-medium bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex text-[10px] font-bold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Resultados */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Buscando...</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Sin resultados para &ldquo;{query}&rdquo;</div>
          )}
          {!loading && query.length < 2 && (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Escribe al menos 2 caracteres para buscar</div>
          )}
          {!loading && results.map(grupo => {
            const Icon = grupo.icon
            return (
              <div key={grupo.label}>
                <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{grupo.label}</span>
                </div>
                {grupo.items.map(item => {
                  const isActive = flatIdx === activeIdx
                  const idx = flatIdx++
                  return (
                    <button
                      key={item.id}
                      onClick={item.accion}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${isActive ? 'text-blue-700' : 'text-slate-800'}`}>{item.titulo}</p>
                        {item.subtitulo && <p className="text-xs text-slate-400 truncate">{item.subtitulo}</p>}
                      </div>
                      {isActive && <span className="ml-auto text-[10px] text-blue-400 font-bold shrink-0">↵</span>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {itemsPlanos.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400">
            <span>↑↓ navegar</span>
            <span>↵ ir</span>
            <span>ESC cerrar</span>
          </div>
        )}
      </div>
    </div>
  )
}

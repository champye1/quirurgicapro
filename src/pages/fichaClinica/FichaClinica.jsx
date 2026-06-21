import { useState, useEffect, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import {
  ArrowLeft, AlertTriangle, Stethoscope, Loader2,
  ClipboardList, Calendar, Activity, Image,
  ListChecks, Pill, FileCheck, Phone,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PREVISION_LABELS, PREVISION_COLORS } from '../../utils/previsionConfig'

const Odontograma     = lazy(() => import('./Odontograma'))
const AnamnesisForm   = lazy(() => import('./AnamnesisForm'))
const VisitasTimeline = lazy(() => import('./VisitasTimeline'))
const GaleriaImagenes = lazy(() => import('./GaleriaImagenes'))
const Periodontograma = lazy(() => import('./Periodontograma'))
const PlanTratamiento = lazy(() => import('./PlanTratamiento'))
const Recetas         = lazy(() => import('./Recetas'))
const Consentimientos = lazy(() => import('./Consentimientos'))

const ToothIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2C9 2 6 4.5 6 7.5c0 1.5.5 2.8 1 4L8.5 20c.3 1.5 2.7 1.5 3 0L12 18l.5 2c.3 1.5 2.7 1.5 3 0L17 11.5c.5-1.2 1-2.5 1-4C18 4.5 15 2 12 2z" />
  </svg>
)

const TABS = [
  { id: 'odontograma',     label: 'Odontograma',    Icon: ToothIcon },
  { id: 'anamnesis',       label: 'Anamnesis',      Icon: ClipboardList },
  { id: 'visitas',         label: 'Visitas',        Icon: Calendar },
  { id: 'imagenes',        label: 'Imágenes',       Icon: Image },
  { id: 'periodontal',     label: 'Periodontal',    Icon: Activity },
  { id: 'plan',            label: 'Plan Trat.',     Icon: ListChecks },
  { id: 'recetas',         label: 'Recetas',        Icon: Pill },
  { id: 'consentimientos', label: 'Consentim.',     Icon: FileCheck },
]

export default function FichaClinica() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('odontograma')

  const { data: patient, isLoading: loadingPatient } = useQuery({
    queryKey: ['ficha-patient', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, nombre, apellido, rut, prevision, telefono, created_at, doctors:doctor_id(nombre, apellido, especialidad)')
        .eq('id', patientId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!patientId,
  })

  const { data: dentalRecord, isLoading: loadingRecord } = useQuery({
    queryKey: ['dental-record', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dental_records')
        .select('id, clinica_id, doctor_id, notas_generales, created_at')
        .eq('patient_id', patientId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!patientId,
  })

  const createRecord = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      let doctorId = null
      let clinicaId = null

      const { data: doc } = await supabase
        .from('doctors')
        .select('id, clinica_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (doc) {
        doctorId = doc.id
        clinicaId = doc.clinica_id
      } else {
        const { data: userRow } = await supabase
          .from('users')
          .select('clinica_id')
          .eq('id', user.id)
          .maybeSingle()
        clinicaId = userRow?.clinica_id
      }

      const { data, error } = await supabase
        .from('dental_records')
        .insert({ patient_id: patientId, doctor_id: doctorId, clinica_id: clinicaId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dental-record', patientId] }),
  })

  useEffect(() => {
    if (!loadingRecord && dentalRecord === null) {
      createRecord.mutate()
    }
  }, [loadingRecord, dentalRecord])

  const { data: anamnesis } = useQuery({
    queryKey: ['dental-anamnesis-alert', dentalRecord?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('dental_anamnesis')
        .select('alergia_anestesia, alergias')
        .eq('dental_record_id', dentalRecord.id)
        .maybeSingle()
      return data
    },
    enabled: !!dentalRecord?.id,
  })

  const cardBase = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  const isLoading = loadingPatient || loadingRecord || createRecord.isPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="text-center py-16">
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Paciente no encontrado.</p>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className={`flex items-center gap-2 text-sm font-medium mb-5 transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
      >
        <ArrowLeft size={15} /> Volver a pacientes
      </button>

      {/* Alerta crítica alergia anestesia */}
      {anamnesis?.alergia_anestesia && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-red-50 border-2 border-red-300 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-black text-red-700 uppercase tracking-wide">⚠ ALERGIA A ANESTESIA</p>
            {anamnesis.alergias && <p className="text-xs text-red-600 mt-0.5">{anamnesis.alergias}</p>}
          </div>
        </div>
      )}

      {/* Header paciente */}
      <div className={`rounded-2xl border p-5 mb-5 ${cardBase}`}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xl shrink-0">
            {patient.nombre?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={`text-xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {patient.nombre} {patient.apellido}
              </h1>
              {patient.prevision && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${PREVISION_COLORS[patient.prevision] || 'bg-slate-100 text-slate-600'}`}>
                  {PREVISION_LABELS[patient.prevision] || patient.prevision}
                </span>
              )}
            </div>
            <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {patient.rut && <span className="font-medium">RUT {patient.rut}</span>}
              {patient.telefono && (
                <span className="flex items-center gap-1">
                  <Phone size={10} /> {patient.telefono}
                </span>
              )}
              {patient.doctors && (
                <span className="flex items-center gap-1">
                  <Stethoscope size={10} />
                  Dr. {patient.doctors.nombre} {patient.doctors.apellido}
                  {patient.doctors.especialidad && ` · ${patient.doctors.especialidad}`}
                </span>
              )}
            </div>
          </div>
          <div className={`text-right text-xs shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <p className="font-bold text-[10px] uppercase tracking-widest mb-0.5">Ficha desde</p>
            <p>{dentalRecord?.created_at ? format(new Date(dentalRecord.created_at), 'd MMM yyyy', { locale: es }) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-0.5 overflow-x-auto pb-0 mb-0 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold whitespace-nowrap transition-colors border-b-2 -mb-px ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : `border-transparent ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Contenido de cada tab */}
      <div className="mt-6">
        <Suspense fallback={<div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}>
          {dentalRecord && activeTab === 'odontograma' && (
            <Odontograma dentalRecordId={dentalRecord.id} clinicaId={dentalRecord.clinica_id} isDark={isDark} />
          )}
          {dentalRecord && activeTab === 'anamnesis' && (
            <AnamnesisForm dentalRecordId={dentalRecord.id} clinicaId={dentalRecord.clinica_id} isDark={isDark} />
          )}
          {dentalRecord && activeTab === 'visitas' && (
            <VisitasTimeline dentalRecordId={dentalRecord.id} clinicaId={dentalRecord.clinica_id} isDark={isDark} patientId={patientId} />
          )}
          {dentalRecord && activeTab === 'imagenes' && (
            <GaleriaImagenes dentalRecordId={dentalRecord.id} clinicaId={dentalRecord.clinica_id} isDark={isDark} />
          )}
          {dentalRecord && activeTab === 'periodontal' && (
            <Periodontograma dentalRecordId={dentalRecord.id} clinicaId={dentalRecord.clinica_id} isDark={isDark} />
          )}
          {dentalRecord && activeTab === 'plan' && (
            <PlanTratamiento dentalRecordId={dentalRecord.id} clinicaId={dentalRecord.clinica_id} isDark={isDark} />
          )}
          {dentalRecord && activeTab === 'recetas' && (
            <Recetas dentalRecordId={dentalRecord.id} clinicaId={dentalRecord.clinica_id} isDark={isDark} />
          )}
          {dentalRecord && activeTab === 'consentimientos' && (
            <Consentimientos dentalRecordId={dentalRecord.id} clinicaId={dentalRecord.clinica_id} isDark={isDark} />
          )}
        </Suspense>
      </div>
    </div>
  )
}

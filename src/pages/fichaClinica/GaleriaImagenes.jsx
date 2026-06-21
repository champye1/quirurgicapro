import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useNotifications } from '../../hooks/useNotifications'
import { Upload, X, ZoomIn, Trash2, Loader2, Image as ImageIcon, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPOS = {
  radiografia:     { label: 'Radiografía',      color: 'bg-blue-100 text-blue-700' },
  foto_intraoral:  { label: 'Foto Intraoral',   color: 'bg-green-100 text-green-700' },
  foto_extraoral:  { label: 'Foto Extraoral',   color: 'bg-purple-100 text-purple-700' },
  panoramica:      { label: 'Panorámica',        color: 'bg-amber-100 text-amber-700' },
  cbct:            { label: 'CBCT / Tomografía', color: 'bg-red-100 text-red-700' },
  otro:            { label: 'Otro',              color: 'bg-slate-100 text-slate-600' },
}

function Lightbox({ url, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
      >
        <X size={20} />
      </button>
      <img
        src={url}
        alt="Imagen dental"
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

export default function GaleriaImagenes({ dentalRecordId, clinicaId, isDark }) {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useNotifications()
  const fileInputRef = useRef(null)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [tipoSeleccionado, setTipoSeleccionado] = useState('radiografia')
  const [notas, setNotas] = useState('')
  const [filter, setFilter] = useState('todas')

  const { data: imagenes = [], isLoading } = useQuery({
    queryKey: ['dental-images', dentalRecordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dental_images')
        .select('id, tipo_imagen, storage_path, nombre_archivo, notas, created_at')
        .eq('dental_record_id', dentalRecordId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!dentalRecordId,
  })

  const getPublicUrl = (path) => {
    const { data } = supabase.storage.from('dental-images').getPublicUrl(path)
    return data?.publicUrl
  }

  const uploadImage = async (file) => {
    if (!file) return
    const isPDF = file.type === 'application/pdf'
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${clinicaId}/${dentalRecordId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('dental-images')
        .upload(path, file, { contentType: file.type })
      if (uploadError) throw uploadError

      const { data: { user } } = await supabase.auth.getUser()
      const { data: doc } = await supabase.from('doctors').select('id').eq('user_id', user.id).maybeSingle()

      const { error: dbError } = await supabase.from('dental_images').insert({
        dental_record_id: dentalRecordId,
        clinica_id: clinicaId,
        tipo_imagen: tipoSeleccionado,
        storage_path: path,
        nombre_archivo: file.name,
        notas: notas || null,
        uploaded_by: doc?.id || null,
      })
      if (dbError) throw dbError

      queryClient.invalidateQueries({ queryKey: ['dental-images', dentalRecordId] })
      showSuccess('Imagen subida correctamente')
      setNotas('')
    } catch {
      showError('Error al subir la imagen')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const deleteImage = useMutation({
    mutationFn: async ({ id, storagePath }) => {
      await supabase.storage.from('dental-images').remove([storagePath])
      const { error } = await supabase.from('dental_images').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dental-images', dentalRecordId] })
      showSuccess('Imagen eliminada')
    },
    onError: () => showError('Error al eliminar'),
  })

  const filteredImages = filter === 'todas' ? imagenes : imagenes.filter(i => i.tipo_imagen === filter)
  const cardBase = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  const inputBase = `px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
    isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-800'
  }`

  return (
    <div className="space-y-5">
      {/* Upload panel */}
      <div className={`rounded-2xl border p-5 ${cardBase}`}>
        <h3 className={`text-sm font-black uppercase tracking-wide mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Subir imagen
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Tipo de imagen
            </label>
            <select
              value={tipoSeleccionado}
              onChange={e => setTipoSeleccionado(e.target.value)}
              className={`w-full ${inputBase}`}
            >
              {Object.entries(TIPOS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Notas (opcional)
            </label>
            <input
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Diente 16, control post-tto…"
              className={`w-full ${inputBase}`}
            />
          </div>
        </div>

        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            uploading
              ? 'border-blue-300 bg-blue-50'
              : isDark
                ? 'border-slate-600 hover:border-blue-500 hover:bg-slate-700'
                : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium text-blue-600">Subiendo…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className={`w-8 h-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Arrastra o haz clic para subir
              </p>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                JPG, PNG, WebP, PDF — máx. 20 MB
              </p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="hidden"
          onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])}
        />
      </div>

      {/* Filtro por tipo */}
      {imagenes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter('todas')}
            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
              filter === 'todas'
                ? 'bg-blue-600 text-white border-blue-600'
                : isDark ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            Todas ({imagenes.length})
          </button>
          {Object.entries(TIPOS).filter(([key]) => imagenes.some(i => i.tipo_imagen === key)).map(([key, val]) => {
            const count = imagenes.filter(i => i.tipo_imagen === key).length
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  filter === key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : isDark ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {val.label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Galería */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : filteredImages.length === 0 ? (
        <div className={`rounded-2xl border p-8 text-center ${cardBase}`}>
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {filter === 'todas' ? 'Sin imágenes registradas.' : `Sin imágenes de tipo "${TIPOS[filter]?.label}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredImages.map(img => {
            const isPDF = img.nombre_archivo?.endsWith('.pdf')
            const url = getPublicUrl(img.storage_path)
            const tipo = TIPOS[img.tipo_imagen]

            return (
              <div key={img.id} className={`rounded-xl border overflow-hidden group relative ${cardBase}`}>
                {isPDF ? (
                  <div className={`h-32 flex flex-col items-center justify-center gap-2 ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <FileText size={28} className="text-red-500" />
                    <span className="text-xs font-medium text-slate-500">PDF</span>
                  </div>
                ) : (
                  <div className="relative h-32 bg-slate-900 overflow-hidden">
                    <img
                      src={url}
                      alt={img.nombre_archivo || 'Imagen dental'}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => setLightboxUrl(url)}
                      className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors"
                    >
                      <ZoomIn size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                )}

                <div className="p-2">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${tipo?.color || 'bg-slate-100 text-slate-600'}`}>
                        {tipo?.label || img.tipo_imagen}
                      </span>
                      {img.notas && (
                        <p className={`text-[11px] mt-1 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {img.notas}
                        </p>
                      )}
                      <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {format(new Date(img.created_at), 'd MMM yyyy', { locale: es })}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteImage.mutate({ id: img.id, storagePath: img.storage_path })}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                      title="Eliminar"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  )
}

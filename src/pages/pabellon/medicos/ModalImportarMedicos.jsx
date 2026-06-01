import { useState, useRef } from 'react'
import { Upload, Download, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cleanRut, validateRut, formatRut } from '../../../utils/rutFormatter'
import { supabase } from '../../../config/supabase'

const ESPECIALIDADES_VALIDAS = [
  'cirugia_general', 'cirugia_cardiovascular', 'cirugia_plastica',
  'cirugia_ortopedica', 'neurocirugia', 'cirugia_oncologica',
  'urologia', 'ginecologia', 'otorrinolaringologia', 'oftalmologia', 'otra',
]

const TEMPLATE_CSV = `nombre,apellido,rut,email,especialidad,telefono
Juan,González,12345678-9,jgonzalez@clinica.cl,cirugia_general,+56912345678
María,López,98765432-1,mlopez@clinica.cl,ginecologia,
Pedro,Soto,11111111-1,psoto@clinica.cl,oftalmologia,+56987654321`

function parseCsvLine(line) {
  const vals = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      vals.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  vals.push(cur.trim())
  return vals
}

function parseCsv(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-záéíóúñ_]/g, ''))
  return lines.slice(1).map((line, i) => {
    const vals = parseCsvLine(line)
    const row = {}
    headers.forEach((h, j) => { row[h] = vals[j] || '' })
    row._line = i + 2
    return row
  })
}

function validateRow(row) {
  const errors = []
  if (!row.nombre?.trim()) errors.push('Nombre requerido')
  if (!row.apellido?.trim()) errors.push('Apellido requerido')
  if (!row.rut?.trim()) errors.push('RUT requerido')
  else if (!validateRut(cleanRut(row.rut))) errors.push('RUT inválido')
  if (!row.email?.trim()) errors.push('Email requerido')
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('Email inválido')
  if (!row.especialidad?.trim()) errors.push('Especialidad requerida')
  else if (!ESPECIALIDADES_VALIDAS.includes(row.especialidad.trim())) {
    errors.push(`Especialidad inválida (usa: ${ESPECIALIDADES_VALIDAS.join(', ')})`)
  }
  return errors
}

export default function ModalImportarMedicos({ onClose, onSuccess }) {
  const fileRef = useRef(null)
  const [rows, setRows] = useState(null)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const MAX_CSV_SIZE = 500 * 1024 // 500 KB

  const handleFile = (file) => {
    if (!file) return
    if (file.size > MAX_CSV_SIZE) {
      alert(`El archivo es demasiado grande (${(file.size / 1024).toFixed(0)} KB). Máximo permitido: 500 KB.`)
      return
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Solo se aceptan archivos .csv')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const parsed = parseCsv(e.target.result)
      const validated = parsed.map(r => ({ ...r, _errors: validateRow(r) }))
      setRows(validated)
      setResults(null)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const validRows = rows?.filter(r => r._errors.length === 0) || []
  const errorRows = rows?.filter(r => r._errors.length > 0) || []

  const handleImport = async () => {
    if (!validRows.length) return
    setImporting(true)
    const { data: { session } } = await supabase.auth.getSession()
    let ok = 0, fail = 0, failDetails = []

    // Procesar en lotes de 5 en paralelo para mayor velocidad sin saturar la API
    const CONCURRENCY = 5
    for (let i = 0; i < validRows.length; i += CONCURRENCY) {
      const batch = validRows.slice(i, i + CONCURRENCY)
      const batchResults = await Promise.allSettled(batch.map(row =>
        supabase.functions.invoke('create-doctor', {
          body: {
            nombre: row.nombre.trim(),
            apellido: row.apellido.trim(),
            rut: cleanRut(row.rut),
            email: row.email.toLowerCase().trim(),
            especialidad: row.especialidad.trim(),
            telefono: row.telefono?.trim() || null,
            estado: 'activo',
            acceso_web_enabled: false,
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
      ))
      batchResults.forEach((result, idx) => {
        const row = batch[idx]
        if (result.status === 'rejected' || !result.value?.data?.success) {
          fail++
          const errMsg = result.status === 'rejected'
            ? result.reason?.message
            : (result.value?.data?.error || result.value?.error?.message || 'Error desconocido')
          failDetails.push({ rut: formatRut(cleanRut(row.rut)), error: errMsg })
        } else {
          ok++
        }
      })
    }

    setImporting(false)
    setResults({ ok, fail, failDetails })
    if (ok > 0) onSuccess()
  }

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'plantilla_medicos.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900">Importar médicos desde CSV</h2>
            <p className="text-xs text-slate-500 mt-0.5">Carga múltiples médicos de una vez</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Template download */}
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
            <div>
              <p className="text-sm font-bold text-blue-900">Descarga la plantilla CSV</p>
              <p className="text-xs text-blue-600 mt-0.5">Rellena con los datos de tus médicos y sube el archivo</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Plantilla
            </button>
          </div>

          {/* Upload zone */}
          {!rows && !results && (
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
              }`}
            >
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">Arrastra el archivo CSV aquí</p>
              <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
          )}

          {/* Preview */}
          {rows && !results && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {validRows.length} válidos
                </span>
                {errorRows.length > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5" /> {errorRows.length} con errores
                  </span>
                )}
                <button onClick={() => { setRows(null); fileRef.current && (fileRef.current.value = '') }} className="ml-auto text-xs text-slate-400 hover:text-slate-600 font-bold">
                  Cambiar archivo
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold text-slate-500">Nombre</th>
                      <th className="text-left px-3 py-2 font-bold text-slate-500">RUT</th>
                      <th className="text-left px-3 py-2 font-bold text-slate-500">Email</th>
                      <th className="text-left px-3 py-2 font-bold text-slate-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={r._errors.length ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 font-medium text-slate-800">{r.nombre} {r.apellido}</td>
                        <td className="px-3 py-2 text-slate-600">{r.rut}</td>
                        <td className="px-3 py-2 text-slate-600 truncate max-w-[140px]">{r.email}</td>
                        <td className="px-3 py-2">
                          {r._errors.length
                            ? <span className="text-red-600" title={r._errors.join(', ')}>⚠ Error</span>
                            : <span className="text-green-600">✓</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {errorRows.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 space-y-1">
                  {errorRows.slice(0, 5).map((r, i) => (
                    <p key={i}><strong>Fila {r._line}:</strong> {r._errors.join(' · ')}</p>
                  ))}
                  {errorRows.length > 5 && <p>...y {errorRows.length - 5} filas más con errores</p>}
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="text-center space-y-4 py-4">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${results.ok > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                {results.ok > 0
                  ? <CheckCircle2 className="w-8 h-8 text-green-600" />
                  : <AlertCircle className="w-8 h-8 text-red-600" />
                }
              </div>
              <div>
                <p className="font-black text-slate-900 text-lg">
                  {results.ok > 0 ? `${results.ok} médico${results.ok !== 1 ? 's' : ''} importado${results.ok !== 1 ? 's' : ''}` : 'Sin importaciones exitosas'}
                </p>
                {results.fail > 0 && <p className="text-sm text-red-600 mt-1">{results.fail} fallaron</p>}
              </div>
              {results.failDetails.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 text-left space-y-1">
                  {results.failDetails.map((f, i) => (
                    <p key={i}><strong>{f.rut}:</strong> {f.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            {results ? 'Cerrar' : 'Cancelar'}
          </button>
          {rows && !results && (
            <button
              onClick={handleImport}
              disabled={!validRows.length || importing}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-black rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                : `Importar ${validRows.length} médico${validRows.length !== 1 ? 's' : ''}`
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

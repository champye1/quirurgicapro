import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportToCSV } from '../../utils/exportData'

const COLUMNS = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'rut', label: 'RUT' },
  { key: 'estado', label: 'Estado' },
]

const DATA = [
  { nombre: 'Juan Pérez', rut: '12.345.678-9', estado: 'activo' },
  { nombre: 'María López', rut: '9.876.543-2', estado: 'inactivo' },
]

describe('exportToCSV', () => {
  beforeEach(() => {
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click: vi.fn(), style: {},
      setAttribute: vi.fn(),
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('lanza error si no hay datos', () => {
    expect(() => exportToCSV([], COLUMNS, 'test')).toThrow('No hay datos para exportar')
  })

  it('lanza error si data es null', () => {
    expect(() => exportToCSV(null, COLUMNS, 'test')).toThrow('No hay datos para exportar')
  })

  it('no lanza error con datos válidos', () => {
    expect(() => exportToCSV(DATA, COLUMNS, 'medicos')).not.toThrow()
  })

  it('crea un elemento <a> para la descarga', () => {
    exportToCSV(DATA, COLUMNS, 'test')
    expect(document.createElement).toHaveBeenCalledWith('a')
  })
})


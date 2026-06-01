import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

vi.mock('lucide-react', async () => {
  const { lucideIcons } = await import('../helpers/lucideMock.js')
  return lucideIcons
})

// Default: clinic info not loaded yet (null)
let mockClinicData = null

vi.mock('../../hooks/useClinicInfo', () => ({
  useClinicInfo: () => ({ data: mockClinicData }),
}))

import Ayuda from '../../pages/pabellon/Ayuda'

const mkClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
const renderAyuda = () =>
  render(<QueryClientProvider client={mkClient()}><Ayuda /></QueryClientProvider>)

describe('Ayuda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClinicData = null
  })

  // ── Estructura básica ──────────────────────────────────────────────────────

  it('renderiza el título del centro de ayuda', () => {
    renderAyuda()
    expect(screen.getByText('Centro de Ayuda')).toBeInTheDocument()
  })

  it('muestra las 3 tarjetas de contacto', () => {
    renderAyuda()
    expect(screen.getByText('Chat en vivo')).toBeInTheDocument()
    expect(screen.getByText('Correo soporte')).toBeInTheDocument()
    expect(screen.getByText('Teléfono')).toBeInTheDocument()
  })

  it('muestra la sección de preguntas frecuentes', () => {
    renderAyuda()
    expect(screen.getByText('Preguntas frecuentes')).toBeInTheDocument()
  })

  // ── Datos hardcoded de fallback ───────────────────────────────────────────

  it('usa el email fallback cuando no hay datos de clínica', () => {
    mockClinicData = null
    renderAyuda()
    expect(screen.getByText('soporte@quirurgicapro.cl')).toBeInTheDocument()
  })

  it('usa el teléfono fallback cuando no hay datos de clínica', () => {
    mockClinicData = null
    renderAyuda()
    expect(screen.getByText('+56 9 1234 5678')).toBeInTheDocument()
  })

  // ── Datos reales de la clínica ────────────────────────────────────────────

  it('muestra el email real de la clínica cuando está configurado', () => {
    mockClinicData = { email: 'contacto@clinicasantiago.cl', telefono: '+56222334455', nombre: 'Clínica Santiago' }
    renderAyuda()
    expect(screen.getByText('contacto@clinicasantiago.cl')).toBeInTheDocument()
  })

  it('muestra el teléfono real de la clínica cuando está configurado', () => {
    mockClinicData = { email: 'info@clinica.cl', telefono: '+56987654321', nombre: 'ClínicaTest' }
    renderAyuda()
    expect(screen.getByText('+56987654321')).toBeInTheDocument()
  })

  it('el enlace de contactar soporte usa el email de la clínica', () => {
    mockClinicData = { email: 'admin@clinica.cl', telefono: '', nombre: 'Mi Clínica' }
    renderAyuda()
    const link = screen.getByRole('link', { name: /Contactar soporte/i })
    expect(link).toHaveAttribute('href', 'mailto:admin@clinica.cl')
  })

  it('el enlace de soporte usa email fallback si clínica no tiene email', () => {
    mockClinicData = { email: '', telefono: '', nombre: '' }
    renderAyuda()
    const link = screen.getByRole('link', { name: /Contactar soporte/i })
    expect(link).toHaveAttribute('href', 'mailto:soporte@quirurgicapro.cl')
  })

  it('muestra el nombre de la clínica en el mensaje de contacto', () => {
    mockClinicData = { email: 'x@x.cl', telefono: '+1', nombre: 'Clínica San José' }
    renderAyuda()
    expect(screen.getByText(/Clínica San José/)).toBeInTheDocument()
  })

  // ── Tabs de categorías ────────────────────────────────────────────────────

  it('muestra la categoría "Solicitudes" activa por defecto', () => {
    renderAyuda()
    expect(screen.getByText('¿Cómo acepto una solicitud de cirugía?')).toBeInTheDocument()
  })

  it('cambia de categoría al hacer clic en un tab', () => {
    renderAyuda()
    fireEvent.click(screen.getByRole('button', { name: 'Calendario' }))
    expect(screen.getByText('¿Cómo bloqueo un pabellón por mantenimiento?')).toBeInTheDocument()
  })

  it('la categoría "Médicos" muestra su FAQ', () => {
    renderAyuda()
    fireEvent.click(screen.getByRole('button', { name: 'Médicos' }))
    expect(screen.getByText('¿Cómo agrego un nuevo médico?')).toBeInTheDocument()
  })

  it('la categoría "Insumos" muestra su FAQ', () => {
    renderAyuda()
    fireEvent.click(screen.getByRole('button', { name: 'Insumos' }))
    expect(screen.getByText('¿Cómo registro una entrada de stock?')).toBeInTheDocument()
  })

  // ── Acordeón FAQ ─────────────────────────────────────────────────────────

  it('las respuestas del FAQ están ocultas por defecto', () => {
    renderAyuda()
    const answer = screen.queryByText(/pabellón confirmó la cirugía/)
    expect(answer).not.toBeInTheDocument()
  })

  it('al hacer clic en una pregunta se muestra la respuesta', () => {
    renderAyuda()
    fireEvent.click(screen.getByText('¿Qué significa el estado "Aceptada" vs "Programada"?'))
    expect(screen.getByText(/"Aceptada" significa que el pabellón confirmó la cirugía/)).toBeInTheDocument()
  })

  it('al hacer clic de nuevo en la pregunta se oculta la respuesta', () => {
    renderAyuda()
    const pregunta = screen.getByText('¿Qué significa el estado "Aceptada" vs "Programada"?')
    fireEvent.click(pregunta)
    fireEvent.click(pregunta)
    expect(screen.queryByText(/"Aceptada" significa que el pabellón confirmó la cirugía/)).not.toBeInTheDocument()
  })
})

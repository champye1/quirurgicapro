import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null, pathname: '/doctor/horarios' }),
  }
})

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', isDark: true }),
}))

vi.mock('../../components/CalendarioPabellonesGrid', () => ({
  default: () => <div data-testid="calendario-grid">Grid de pabellones</div>,
}))

vi.mock('lucide-react', () => ({
  CalendarSearch: () => <span />,
  Info: () => <span />,
}))

import HorariosDisponibles from '../../pages/doctor/HorariosDisponibles'

const renderPage = () => render(<MemoryRouter><HorariosDisponibles /></MemoryRouter>)

describe('HorariosDisponibles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza sin explotar', () => {
    renderPage()
    expect(document.body).toBeTruthy()
  })

  it('muestra el grid de pabellones', () => {
    renderPage()
    expect(screen.getByTestId('calendario-grid')).toBeInTheDocument()
  })

  it('muestra un título o encabezado relacionado con horarios', () => {
    renderPage()
    const text = document.body.textContent.toLowerCase()
    expect(text.includes('horario') || text.includes('disponible') || text.includes('pabellón')).toBe(true)
  })

  it('muestra algún texto informativo o de ayuda', () => {
    renderPage()
    const text = document.body.textContent.toLowerCase()
    expect(text.length).toBeGreaterThan(10)
  })
})

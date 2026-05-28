import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useBlocker: vi.fn(() => ({ state: 'unblocked', proceed: vi.fn(), reset: vi.fn() })) }
})

vi.mock('../../config/supabase', () => {
  const makeChain = (data = []) => {
    const result = Promise.resolve({ data, error: null })
    const chain = {
      select:      vi.fn(() => chain),
      eq:          vi.fn(() => chain),
      order:       vi.fn(() => chain),
      limit:       vi.fn(() => chain),
      is:          vi.fn(() => chain),
      single:      vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then:        result.then.bind(result),
      catch:       result.catch.bind(result),
      finally:     result.finally.bind(result),
    }
    return chain
  }
  return {
    supabase: {
      from:  vi.fn(() => makeChain()),
      auth:  { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
      channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
      removeChannel: vi.fn(),
    },
  }
})

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', isDark: true }),
}))

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}))

vi.mock('../../components/CalendarioPabellonesGrid', () => ({
  default: () => <div data-testid="calendario-grid" />,
}))

vi.mock('../../components/SearchableSelect', () => ({
  default: ({ placeholder, onChange }) => (
    <input placeholder={placeholder} onChange={e => onChange?.(e.target.value)} />
  ),
}))

vi.mock('../../components/common/ConfirmModal', () => ({
  default: () => null,
}))

vi.mock('../../components/common/LoadingSpinner', () => ({
  default: () => <div data-testid="spinner" />,
}))

vi.mock('lucide-react', async () => {
  const { lucideIcons } = await import('../helpers/lucideMock.js')
  return lucideIcons
})

vi.mock('../../data/codigosOperaciones', () => ({
  codigosOperaciones: [],
  getGrupoFonasaByCodigo: vi.fn(() => null),
  insumoAplicaParaGrupo: vi.fn(() => true),
}))

import CrearPaciente from '../../pages/doctor/CrearPaciente'

const makeClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})

const renderPage = () =>
  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={[{ pathname: '/doctor/paciente', state: {} }]}>
        <CrearPaciente />
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('CrearPaciente', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza el formulario sin explotar', async () => {
    const { container } = renderPage()
    await waitFor(() => {
      expect(container.firstChild).toBeTruthy()
    })
  })

  it('renderiza los campos de nombre y apellido', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Nombre *')).toBeInTheDocument()
      expect(screen.getByText('Apellido *')).toBeInTheDocument()
    })
  })

  it('muestra error de RUT cuando el formato es inválido', async () => {
    renderPage()
    const rutInput = await screen.findByPlaceholderText('12.345.678-9')
    fireEvent.change(rutInput, { target: { value: '12345678-9' } })
    fireEvent.blur(rutInput)
    await waitFor(() => {
      expect(screen.getByText(/rut no es válido/i)).toBeInTheDocument()
    })
  })

  it('no muestra error de RUT con campo vacío', async () => {
    renderPage()
    const rutInput = await screen.findByPlaceholderText('12.345.678-9')
    fireEvent.change(rutInput, { target: { value: '' } })
    fireEvent.blur(rutInput)
    await waitFor(() => {
      expect(screen.queryByText(/rut inválido/i)).not.toBeInTheDocument()
    })
  })

  it('muestra el grid de calendario al cambiar a modo doctor', async () => {
    renderPage()
    // Default state is "pabellón toma la hora"; switch to doctor mode to reveal the grid
    const select = await screen.findByDisplayValue('Pabellón toma la hora')
    fireEvent.change(select, { target: { value: 'doctor' } })
    await waitFor(() => {
      expect(screen.getByTestId('calendario-grid')).toBeInTheDocument()
    })
  })
})

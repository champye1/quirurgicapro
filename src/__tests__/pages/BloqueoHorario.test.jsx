import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../config/supabase', () => {
  const makeChain = (data = []) => {
    const result = Promise.resolve({ data, error: null })
    const chain = {
      select: vi.fn(() => chain), eq: vi.fn(() => chain), order: vi.fn(() => chain),
      limit: vi.fn(() => chain), is: vi.fn(() => chain), in: vi.fn(() => chain),
      insert: vi.fn(() => chain), update: vi.fn(() => chain), delete: vi.fn(() => chain),
      then: result.then.bind(result), catch: result.catch.bind(result),
      finally: result.finally.bind(result),
    }
    return chain
  }
  return { supabase: { from: vi.fn(() => makeChain()) } }
})

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', isDark: true }),
}))

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}))

vi.mock('../../utils/sanitizeInput', () => ({
  sanitizeString: vi.fn(v => v),
  sanitizeNumber: vi.fn(v => v),
}))

vi.mock('../../utils/horasOpciones', () => ({
  HORAS_SELECT: ['08:00', '08:30', '09:00'],
}))

vi.mock('../../components/common/Pagination', () => ({ default: () => null }))
vi.mock('../../components/common/ConfirmModal', () => ({ default: () => null }))
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => <div data-testid="spinner" /> }))

vi.mock('lucide-react', async () => {
  const { lucideIcons } = await import('../helpers/lucideMock.js')
  return lucideIcons
})

import BloqueoHorario from '../../pages/pabellon/BloqueoHorario'

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })

const renderPage = () =>
  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter><BloqueoHorario /></MemoryRouter>
    </QueryClientProvider>
  )

describe('BloqueoHorario', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza sin explotar', async () => {
    renderPage()
    await waitFor(() => expect(document.body).toBeTruthy())
  })

  it('muestra un campo de fecha para el bloqueo', async () => {
    renderPage()
    await waitFor(() => {
      const dateInput = document.querySelector('input[type="date"]')
      expect(dateInput).toBeInTheDocument()
    })
  })

  it('muestra el botón de guardar/crear bloqueo', async () => {
    renderPage()
    await waitFor(() => {
      const btn = screen.queryByRole('button', { name: /guardar|bloquear|crear/i })
      expect(btn).toBeInTheDocument()
    })
  })

  it('no muestra spinner al terminar la carga', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })
})

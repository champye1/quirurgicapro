import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../config/supabase', () => {
  const makeChain = (data = []) => {
    const result = Promise.resolve({ data, error: null })
    const chain = {
      select: vi.fn(() => chain), eq: vi.fn(() => chain), order: vi.fn(() => chain),
      ilike: vi.fn(() => chain), limit: vi.fn(() => chain), range: vi.fn(() => chain),
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

vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: vi.fn(v => v),
}))

vi.mock('../../utils/rutFormatter', () => ({
  formatRut: vi.fn(v => v),
  cleanRut: vi.fn(v => v),
  validateRut: vi.fn(() => true),
}))

vi.mock('../../utils/sanitizeInput', () => ({
  sanitizeString: vi.fn(v => v),
  sanitizeEmail: vi.fn(v => v),
  sanitizeCode: vi.fn(v => v),
  sanitizeRut: vi.fn(v => v),
  sanitizePassword: vi.fn(v => v),
}))

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('../../utils/exportData', () => ({
  exportToCSV: vi.fn(), exportToExcel: vi.fn(),
}))

vi.mock('../../utils/errorHandler', () => ({
  handleMutationError: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../../components/common/Pagination', () => ({ default: () => null }))
vi.mock('../../components/common/ConfirmModal', () => ({ default: () => null }))
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => <div data-testid="spinner" /> }))

vi.mock('lucide-react', async () => {
  const { lucideIcons } = await import('../helpers/lucideMock.js')
  return { ...lucideIcons, Palmtree: () => null, UserCheck: () => null }
})

import Medicos from '../../pages/pabellon/Medicos'

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })

const renderPage = () =>
  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter><Medicos /></MemoryRouter>
    </QueryClientProvider>
  )

describe('Medicos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza sin explotar', async () => {
    renderPage()
    await waitFor(() => expect(document.body).toBeTruthy())
  })

  it('muestra un campo de búsqueda', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument()
    })
  })

  it('muestra el botón de agregar médico', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /agregar|nuevo|médico/i })).toBeInTheDocument()
    })
  })

  it('muestra el título de la sección', async () => {
    renderPage()
    await waitFor(() => {
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toBeInTheDocument()
    })
  })

  it('no muestra spinner al terminar la carga', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../config/supabase', () => {
  const makeChain = (data = [], count = 0) => {
    const result = Promise.resolve({ data, error: null, count })
    const chain = {
      select: vi.fn(() => chain), eq: vi.fn(() => chain), gte: vi.fn(() => chain),
      lte: vi.fn(() => chain), lt: vi.fn(() => chain), gt: vi.fn(() => chain),
      order: vi.fn(() => chain), limit: vi.fn(() => chain), is: vi.fn(() => chain),
      in: vi.fn(() => chain), ilike: vi.fn(() => chain), range: vi.fn(() => chain),
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

vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: vi.fn(v => v),
}))

vi.mock('../../utils/sanitizeInput', () => ({
  sanitizeString: vi.fn(v => v),
}))

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('../../utils/exportData', () => ({
  exportToCSV: vi.fn(), exportToExcel: vi.fn(),
}))

vi.mock('../../components/common/Pagination', () => ({ default: () => null }))
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => <div data-testid="spinner" /> }))

vi.mock('lucide-react', async () => {
  const { lucideIcons } = await import('../helpers/lucideMock.js')
  return lucideIcons
})

vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns')
  return { ...actual }
})

import Auditoria from '../../pages/pabellon/Auditoria'

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })

const renderPage = () =>
  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter><Auditoria /></MemoryRouter>
    </QueryClientProvider>
  )

describe('Auditoria', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza sin explotar', async () => {
    renderPage()
    await waitFor(() => expect(document.body).toBeTruthy())
  })

  it('muestra el campo de búsqueda', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument()
    })
  })

  it('muestra el título de la sección', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/auditor/i)).toBeInTheDocument()
    })
  })

  it('muestra filtros de fecha', async () => {
    renderPage()
    await waitFor(() => {
      const inputs = document.querySelectorAll('input[type="date"]')
      expect(inputs.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('no muestra spinner al finalizar la carga', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })
})

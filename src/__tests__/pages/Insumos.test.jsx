import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

vi.mock('../../utils/sanitizeInput', () => ({
  sanitizeString: vi.fn(v => v),
  sanitizeCode: vi.fn(v => v),
}))

vi.mock('../../utils/exportData', () => ({
  exportToCSV: vi.fn(), exportToExcel: vi.fn(),
}))

vi.mock('../../components/common/Pagination', () => ({ default: () => null }))
vi.mock('../../components/common/ConfirmModal', () => ({ default: () => null }))
vi.mock('../../components/common/Modal', () => ({ default: ({ children, isOpen }) => isOpen ? <div>{children}</div> : null }))
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => <div data-testid="spinner" /> }))

vi.mock('lucide-react', async () => {
  const { lucideIcons } = await import('../helpers/lucideMock.js')
  return lucideIcons
})

import Insumos from '../../pages/pabellon/Insumos'

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })

const renderPage = () =>
  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter><Insumos /></MemoryRouter>
    </QueryClientProvider>
  )

describe('Insumos', () => {
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

  it('muestra el botón para agregar insumo', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /agregar|nuevo|insumo/i })).toBeInTheDocument()
    })
  })

  it('abre el formulario al hacer clic en agregar', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /agregar|nuevo|insumo/i }))
    fireEvent.click(screen.getByRole('button', { name: /agregar|nuevo|insumo/i }))
    await waitFor(() => {
      expect(document.body.textContent.toLowerCase()).toMatch(/nombre|insumo|cantidad/)
    })
  })

  it('no muestra spinner al terminar la carga', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })
})

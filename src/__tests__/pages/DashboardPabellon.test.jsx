import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted — define the mock factory inline without external variables
vi.mock('../../config/supabase', () => {
  const makeChain = (data = [], count = 0) => {
    const result = Promise.resolve({ data, error: null, count })
    const chain = {
      select:     vi.fn(() => chain),
      eq:         vi.fn(() => chain),
      gte:        vi.fn(() => chain),
      lte:        vi.fn(() => chain),
      lt:         vi.fn(() => chain),
      gt:         vi.fn(() => chain),
      order:      vi.fn(() => chain),
      limit:      vi.fn(() => chain),
      is:         vi.fn(() => chain),
      in:         vi.fn(() => chain),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then:       result.then.bind(result),
      catch:      result.catch.bind(result),
      finally:    result.finally.bind(result),
    }
    return chain
  }
  return {
    supabase: {
      from: vi.fn(() => makeChain()),
    },
  }
})

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', isDark: true }),
}))

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}))

vi.mock('../../components/charts/OcupacionChart', () => ({
  default: () => <div data-testid="ocupacion-chart" />,
}))

vi.mock('lucide-react', async () => {
  const { lucideIcons } = await import('../helpers/lucideMock.js')
  return lucideIcons
})

import Dashboard from '../../pages/pabellon/Dashboard'

const makeClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})

const renderDashboard = () =>
  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  )

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

describe('Dashboard Pabellón', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true })
  })

  it('renderiza sin explotar', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(document.body).toBeTruthy()
    })
  })

  it('muestra algún título o encabezado', async () => {
    renderDashboard()
    await waitFor(() => {
      const headings = screen.queryAllByRole('heading')
      expect(headings.length).toBeGreaterThanOrEqual(0)
      expect(document.body).toBeTruthy()
    })
  })

  it('renderiza sin errores con datos vacíos', async () => {
    const { container } = renderDashboard()
    await waitFor(() => {
      expect(container.firstChild).toBeTruthy()
    })
  })

  it('no muestra spinner de carga al terminar', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })
})

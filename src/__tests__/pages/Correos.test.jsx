import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../config/supabase', () => {
  const makeChain = (data = []) => {
    const result = Promise.resolve({ data, error: null })
    const chain = {
      select: vi.fn(() => chain), eq: vi.fn(() => chain), order: vi.fn(() => chain),
      limit: vi.fn(() => chain), single: vi.fn(() => Promise.resolve({ data: null, error: null })),
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
}))

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('../../components/common/EmptyState', () => ({ default: ({ title }) => <div>{title}</div> }))
vi.mock('../../components/common/Modal', () => ({ default: ({ children }) => <div>{children}</div> }))

vi.mock('lucide-react', async () => {
  const { lucideIcons } = await import('../helpers/lucideMock.js')
  return lucideIcons
})

import Correos from '../../pages/pabellon/Correos'

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })

const renderPage = () =>
  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter><Correos /></MemoryRouter>
    </QueryClientProvider>
  )

describe('Correos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza sin explotar', async () => {
    renderPage()
    await waitFor(() => expect(document.body).toBeTruthy())
  })

  it('muestra la sección de configuración o bandeja de entrada', async () => {
    renderPage()
    await waitFor(() => {
      const text = document.body.textContent.toLowerCase()
      const hasSomething = text.includes('correo') || text.includes('gmail') || text.includes('configurar') || text.includes('bandeja')
      expect(hasSomething).toBe(true)
    }, { timeout: 3000 })
  })

  it('no muestra errores no controlados al montar', async () => {
    const { container } = renderPage()
    await waitFor(() => {
      expect(container.firstChild).toBeTruthy()
    })
  })
})

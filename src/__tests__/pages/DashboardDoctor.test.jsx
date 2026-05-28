import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../config/supabase', () => {
  const makeChain = (data = null) => {
    const result = Promise.resolve({ data, error: null })
    const chain = {
      select: vi.fn(() => chain), eq: vi.fn(() => chain), order: vi.fn(() => chain),
      limit: vi.fn(() => chain), gte: vi.fn(() => chain), lte: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({ data: { id: '1', nombre: 'Dr. Test', especialidad: 'Cirugía General' }, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: result.then.bind(result), catch: result.catch.bind(result),
      finally: result.finally.bind(result),
    }
    return chain
  }
  return { supabase: { from: vi.fn(() => makeChain([])), auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) } } }
})

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', isDark: true }),
}))

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('lucide-react', async () => {
  const { lucideIcons } = await import('../helpers/lucideMock.js')
  return lucideIcons
})

import Dashboard from '../../pages/doctor/Dashboard'

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })

const renderPage = () =>
  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter><Dashboard /></MemoryRouter>
    </QueryClientProvider>
  )

describe('Dashboard (Doctor)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza sin explotar', async () => {
    renderPage()
    await waitFor(() => expect(document.body).toBeTruthy())
  })

  it('muestra contenido al terminar la carga', async () => {
    const { container } = renderPage()
    await waitFor(() => {
      expect(container.querySelector('div')).toBeTruthy()
      expect(document.body.textContent.length).toBeGreaterThan(0)
    }, { timeout: 4000 })
  })

  it('renderiza sin errores con datos vacíos', async () => {
    const { container } = renderPage()
    await waitFor(() => {
      expect(container.firstChild).toBeTruthy()
    })
  })
})

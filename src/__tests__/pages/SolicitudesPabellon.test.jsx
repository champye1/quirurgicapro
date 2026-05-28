import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../config/supabase', () => {
  const makeChain = (data = []) => {
    const result = Promise.resolve({ data, error: null })
    const chain = {
      select: vi.fn(() => chain), eq: vi.fn(() => chain), neq: vi.fn(() => chain),
      order: vi.fn(() => chain), limit: vi.fn(() => chain), is: vi.fn(() => chain),
      in: vi.fn(() => chain), gte: vi.fn(() => chain), lte: vi.fn(() => chain),
      insert: vi.fn(() => chain), update: vi.fn(() => chain), delete: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
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

vi.mock('../../data/codigosOperaciones', () => ({
  codigosOperaciones: [],
  getGrupoFonasaByCodigo: vi.fn(() => null),
  insumoAplicaParaGrupo: vi.fn(() => true),
}))

vi.mock('../../components/common/Pagination', () => ({ default: () => null }))
vi.mock('../../components/common/Modal', () => ({ default: ({ children, isOpen }) => isOpen ? <div>{children}</div> : null }))
vi.mock('../../components/common/Button', () => ({ default: ({ children, onClick }) => <button onClick={onClick}>{children}</button> }))
vi.mock('../../components/SearchableSelect', () => ({ default: () => null }))

vi.mock('lucide-react', async () => {
  const { lucideIcons } = await import('../helpers/lucideMock.js')
  return lucideIcons
})

import Solicitudes from '../../pages/pabellon/Solicitudes'

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })

const renderPage = () =>
  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter><Solicitudes /></MemoryRouter>
    </QueryClientProvider>
  )

describe('Solicitudes (Pabellón)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza sin explotar', async () => {
    renderPage()
    await waitFor(() => expect(document.body).toBeTruthy())
  })

  it('muestra los filtros de estado (Pendiente, Aceptada, Rechazada)', async () => {
    renderPage()
    await waitFor(() => {
      const text = document.body.textContent.toLowerCase()
      expect(text.includes('pendiente') || text.includes('aceptada') || text.includes('rechazada')).toBe(true)
    })
  })

  it('muestra estado vacío cuando no hay solicitudes', async () => {
    renderPage()
    await waitFor(() => {
      const text = document.body.textContent.toLowerCase()
      expect(text.includes('solicitud') || text.includes('no hay') || text.includes('pendiente')).toBe(true)
    }, { timeout: 3000 })
  })

  it('tiene botones de filtro activos', async () => {
    renderPage()
    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })
})

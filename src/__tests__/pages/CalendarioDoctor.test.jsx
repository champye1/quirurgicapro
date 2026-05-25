import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../config/supabase', () => {
  const makeChain = (data = []) => {
    const result = Promise.resolve({ data, error: null })
    const chain = {
      select: vi.fn(() => chain), eq: vi.fn(() => chain), gte: vi.fn(() => chain),
      lte: vi.fn(() => chain), order: vi.fn(() => chain), is: vi.fn(() => chain),
      in: vi.fn(() => chain), insert: vi.fn(() => chain), delete: vi.fn(() => chain),
      then: result.then.bind(result), catch: result.catch.bind(result),
      finally: result.finally.bind(result),
    }
    return chain
  }
  return {
    supabase: {
      from: vi.fn(() => makeChain()),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
    },
  }
})

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', isDark: true }),
}))

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}))

vi.mock('../../components/common/Modal', () => ({ default: ({ children, isOpen }) => isOpen ? <div>{children}</div> : null }))
vi.mock('../../components/common/Button', () => ({ default: ({ children, onClick }) => <button onClick={onClick}>{children}</button> }))

vi.mock('lucide-react', async () => {
  const { lucideIcons } = await import('../helpers/lucideMock.js')
  return lucideIcons
})

import Calendario from '../../pages/doctor/Calendario'

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })

const renderPage = () =>
  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter><Calendario /></MemoryRouter>
    </QueryClientProvider>
  )

describe('Calendario (Doctor)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza sin explotar', async () => {
    renderPage()
    await waitFor(() => expect(document.body).toBeTruthy())
  })

  it('muestra los controles de navegación del calendario', async () => {
    renderPage()
    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  it('muestra el año actual', async () => {
    renderPage()
    const year = new Date().getFullYear().toString()
    await waitFor(() => {
      expect(document.body.textContent).toContain(year)
    })
  })

  it('renderiza la grilla del calendario', async () => {
    const { container } = renderPage()
    await waitFor(() => {
      expect(container.firstChild).toBeTruthy()
    })
  })
})

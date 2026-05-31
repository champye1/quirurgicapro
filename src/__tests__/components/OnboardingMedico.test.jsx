import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── localStorage mock ─────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn(k => store[k] ?? null),
    setItem: vi.fn((k, v) => { store[k] = String(v) }),
    removeItem: vi.fn(k => { delete store[k] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

// ── Other mocks ───────────────────────────────────────────────────────────────
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

let mockUpdate = vi.fn()
vi.mock('../../config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ update: mockUpdate })),
  },
}))

vi.mock('lucide-react', async () => {
  const { lucideIcons } = await import('../helpers/lucideMock.js')
  return lucideIcons
})

import OnboardingMedico from '../../components/onboarding/OnboardingMedico'

const mkClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

const renderOnboarding = (props = {}) => {
  const defaults = { doctorNombre: 'María', doctorId: 'doc-1', onComplete: vi.fn() }
  const merged = { ...defaults, ...props }
  return { onComplete: merged.onComplete, ...render(
    <QueryClientProvider client={mkClient()}>
      <MemoryRouter><OnboardingMedico {...merged} /></MemoryRouter>
    </QueryClientProvider>
  )}
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OnboardingMedico', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    mockUpdate = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  })

  // ── Paso teléfono ────────────────────────────────────────────────────────

  it('empieza mostrando el campo de teléfono', () => {
    renderOnboarding()
    expect(screen.getByPlaceholderText('+56912345678')).toBeInTheDocument()
  })

  it('muestra el nombre del doctor en el saludo', () => {
    renderOnboarding({ doctorNombre: 'Carlos' })
    expect(screen.getByText(/¡Hola, Carlos!/i)).toBeInTheDocument()
  })

  it('muestra saludo genérico si no hay nombre', () => {
    renderOnboarding({ doctorNombre: undefined })
    expect(screen.getByText(/¡Bienvenido!/i)).toBeInTheDocument()
  })

  it('muestra error con teléfono en formato inválido', async () => {
    renderOnboarding()
    fireEvent.change(screen.getByPlaceholderText('+56912345678'), { target: { value: '12345' } })
    fireEvent.click(screen.getByText('Continuar'))
    await waitFor(() => expect(screen.getByText(/Formato inválido/i)).toBeInTheDocument())
  })

  it('no muestra error con campo vacío al continuar', async () => {
    renderOnboarding()
    fireEvent.click(screen.getByText('Continuar'))
    await waitFor(() => expect(screen.queryByText(/Formato inválido/i)).not.toBeInTheDocument())
  })

  it('acepta teléfono vacío y avanza al tutorial', async () => {
    renderOnboarding()
    fireEvent.click(screen.getByText('Continuar'))
    await waitFor(() => expect(screen.getByText('1. Reserva una hora')).toBeInTheDocument())
  })

  it('"Omitir por ahora" avanza directamente al tutorial', () => {
    renderOnboarding()
    fireEvent.click(screen.getByText('Omitir por ahora'))
    expect(screen.getByText('1. Reserva una hora')).toBeInTheDocument()
  })

  it('acepta teléfono con formato internacional válido (+56...)', async () => {
    renderOnboarding()
    fireEvent.change(screen.getByPlaceholderText('+56912345678'), { target: { value: '+56912345678' } })
    fireEvent.click(screen.getByText('Continuar'))
    await waitFor(() => expect(screen.getByText('1. Reserva una hora')).toBeInTheDocument())
  })

  it('llama a supabase.update con el teléfono válido', async () => {
    const mockEq = vi.fn(() => Promise.resolve({ error: null }))
    mockUpdate = vi.fn(() => ({ eq: mockEq }))

    renderOnboarding()
    fireEvent.change(screen.getByPlaceholderText('+56912345678'), { target: { value: '+56987654321' } })
    fireEvent.click(screen.getByText('Continuar'))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ telefono: '+56987654321' })
    ))
  })

  it('avanza al tutorial aunque falle el guardado del teléfono', async () => {
    mockUpdate = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: { message: 'DB error' } })) }))
    renderOnboarding()
    fireEvent.change(screen.getByPlaceholderText('+56912345678'), { target: { value: '+56911111111' } })
    fireEvent.click(screen.getByText('Continuar'))
    await waitFor(() => expect(screen.getByText('1. Reserva una hora')).toBeInTheDocument())
  })

  // ── Paso tutorial ────────────────────────────────────────────────────────

  it('muestra los 4 pasos del tutorial', () => {
    renderOnboarding()
    fireEvent.click(screen.getByText('Omitir por ahora'))
    expect(screen.getByText('1. Reserva una hora')).toBeInTheDocument()
    expect(screen.getByText('2. Sigue el estado')).toBeInTheDocument()
    expect(screen.getByText('3. Revisa tu calendario')).toBeInTheDocument()
    expect(screen.getByText('4. Gestiona tus pacientes')).toBeInTheDocument()
  })

  it('"Crear mi primera solicitud" llama onComplete y navega', () => {
    const onComplete = vi.fn()
    renderOnboarding({ onComplete })
    fireEvent.click(screen.getByText('Omitir por ahora'))
    fireEvent.click(screen.getByText('Crear mi primera solicitud'))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith('/doctor/paciente')
  })

  it('"Ir al dashboard primero" llama onComplete sin navegar', () => {
    const onComplete = vi.fn()
    renderOnboarding({ onComplete })
    fireEvent.click(screen.getByText('Omitir por ahora'))
    fireEvent.click(screen.getByText('Ir al dashboard primero'))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('guarda flag en localStorage al completar', () => {
    renderOnboarding()
    fireEvent.click(screen.getByText('Omitir por ahora'))
    fireEvent.click(screen.getByText('Crear mi primera solicitud'))
    expect(localStorageMock.setItem).toHaveBeenCalledWith('onboarding_medico_completed', '1')
  })
})

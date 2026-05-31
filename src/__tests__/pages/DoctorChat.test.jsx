import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockChannel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() }

vi.mock('../../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  },
}))

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

vi.mock('../../components/common/ChatView', () => ({
  default: ({ senderRole, surgeryRequestId }) => (
    <div data-testid="chat-view" data-role={senderRole} data-request={surgeryRequestId ?? 'general'} />
  ),
}))

vi.mock('lucide-react', async () => {
  const { lucideIcons } = await import('../helpers/lucideMock.js')
  return lucideIcons
})

vi.mock('date-fns', () => ({ format: vi.fn(() => '1 ene, 10:00') }))
vi.mock('date-fns/locale', () => ({ es: {} }))

// ── Helpers ───────────────────────────────────────────────────────────────────

import DoctorChat from '../../pages/doctor/Chat'
import { supabase } from '../../config/supabase'

const mkClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

function buildMocks({ solicitudes = [], mensajes = [] } = {}) {
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

  supabase.from.mockImplementation((table) => {
    const makeChain = (data) => {
      const p = Promise.resolve({ data, error: null })
      const chain = {
        select: vi.fn(() => chain), eq: vi.fn(() => chain), is: vi.fn(() => chain),
        order: vi.fn(() => chain), limit: vi.fn(() => chain), or: vi.fn(() => chain),
        single: vi.fn(() => Promise.resolve({ data, error: null })),
        then: p.then.bind(p), catch: p.catch.bind(p), finally: p.finally.bind(p),
      }
      return chain
    }
    if (table === 'doctors') return makeChain({ id: 'd1', nombre: 'Juan', apellido: 'Pérez' })
    if (table === 'surgery_requests') return makeChain(solicitudes)
    if (table === 'chat_messages') return makeChain(mensajes)
    return makeChain([])
  })
}

const renderChat = () =>
  render(
    <QueryClientProvider client={mkClient()}>
      <MemoryRouter><DoctorChat /></MemoryRouter>
    </QueryClientProvider>
  )

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DoctorChat', () => {
  beforeEach(() => { vi.clearAllMocks(); buildMocks() })

  it('renderiza el encabezado del chat', async () => {
    renderChat()
    await waitFor(() => expect(screen.getByText('Chat con Pabellón')).toBeInTheDocument())
  })

  it('muestra el botón de canal general en el sidebar', async () => {
    renderChat()
    await waitFor(() => {
      // Canal general aparece en el sidebar (como botón) y en el panel header
      const buttons = screen.getAllByText('Canal General')
      expect(buttons.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renderiza el ChatView con senderRole doctor', async () => {
    renderChat()
    await waitFor(() => expect(screen.getByTestId('chat-view')).toHaveAttribute('data-role', 'doctor'))
  })

  it('ChatView empieza en canal general (sin surgeryRequestId)', async () => {
    renderChat()
    await waitFor(() => expect(screen.getByTestId('chat-view')).toHaveAttribute('data-request', 'general'))
  })

  it('muestra "Sin conversaciones" cuando no hay threads de solicitudes', async () => {
    renderChat()
    await waitFor(() => expect(screen.getByText(/Sin conversaciones de solicitudes/i)).toBeInTheDocument())
  })

  it('registra la suscripción realtime al montar', async () => {
    renderChat()
    await waitFor(() => expect(supabase.channel).toHaveBeenCalledWith('doctor-chat-threads'))
  })

  it('muestra threads de solicitudes cuando existen mensajes', async () => {
    buildMocks({
      solicitudes: [{ id: 'sr1', codigo_operacion: 'OP-001', patients: { nombre: 'Pedro', apellido: 'González' } }],
      mensajes: [{ id: 'm1', surgery_request_id: 'sr1', sender_role: 'doctor', created_at: new Date().toISOString(), contenido: 'Hola', leido: true }],
    })
    renderChat()
    await waitFor(() => expect(screen.getByText(/OP-001/)).toBeInTheDocument())
  })

  it('muestra badge de no leídos con count correcto', async () => {
    buildMocks({
      solicitudes: [{ id: 'sr1', codigo_operacion: 'OP-001', patients: { nombre: 'Pedro', apellido: 'González' } }],
      mensajes: [
        { id: 'm1', surgery_request_id: 'sr1', sender_role: 'pabellon', created_at: new Date().toISOString(), contenido: 'Msg 1', leido: false },
        { id: 'm2', surgery_request_id: 'sr1', sender_role: 'pabellon', created_at: new Date().toISOString(), contenido: 'Msg 2', leido: false },
      ],
    })
    renderChat()
    await waitFor(() => {
      const badge = screen.getByTestId('thread-unread')
      expect(badge).toBeInTheDocument()
      expect(badge.textContent).toBe('2')
    })
  })

  it('no cuenta mensajes leídos en el badge', async () => {
    buildMocks({
      solicitudes: [{ id: 'sr1', codigo_operacion: 'OP-001', patients: { nombre: 'Pedro', apellido: 'González' } }],
      mensajes: [
        { id: 'm1', surgery_request_id: 'sr1', sender_role: 'pabellon', created_at: new Date().toISOString(), contenido: 'Msg 1', leido: true },
        { id: 'm2', surgery_request_id: 'sr1', sender_role: 'pabellon', created_at: new Date().toISOString(), contenido: 'Msg 2', leido: false },
      ],
    })
    renderChat()
    await waitFor(() => {
      const badge = screen.getByTestId('thread-unread')
      expect(badge).toBeInTheDocument()
      expect(badge.textContent).toBe('1')
    })
  })

  it('no cuenta mensajes del propio doctor en el badge', async () => {
    buildMocks({
      solicitudes: [{ id: 'sr1', codigo_operacion: 'OP-001', patients: { nombre: 'Pedro', apellido: 'González' } }],
      mensajes: [
        { id: 'm1', surgery_request_id: 'sr1', sender_role: 'doctor', created_at: new Date().toISOString(), contenido: 'Mi msg', leido: false },
      ],
    })
    renderChat()
    await waitFor(() => expect(screen.getByText(/OP-001/)).toBeInTheDocument())
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })

  it('al seleccionar un thread, ChatView recibe el surgeryRequestId', async () => {
    buildMocks({
      solicitudes: [{ id: 'sr1', codigo_operacion: 'OP-001', patients: { nombre: 'Pedro', apellido: 'González' } }],
      mensajes: [{ id: 'm1', surgery_request_id: 'sr1', sender_role: 'doctor', created_at: new Date().toISOString(), contenido: 'Hola', leido: true }],
    })
    renderChat()
    await waitFor(() => expect(screen.getByText(/OP-001/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/OP-001/).closest('button'))
    await waitFor(() => expect(screen.getByTestId('chat-view')).toHaveAttribute('data-request', 'sr1'))
  })

  it('maneja solicitud eliminada sin romper el label', async () => {
    buildMocks({
      solicitudes: [], // solicitud sr1 no existe en el map
      mensajes: [
        { id: 'm1', surgery_request_id: 'sr-deleted', sender_role: 'pabellon', created_at: new Date().toISOString(), contenido: 'Hola', leido: false },
      ],
    })
    renderChat()
    // No debe lanzar error — la solicitud eliminada se maneja con fallback
    await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument())
  })
})

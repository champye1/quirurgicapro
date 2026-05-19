import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}))

vi.mock('../../utils/rateLimiter', () => ({
  isLocked: vi.fn(() => ({ isLocked: false })),
  recordFailedAttempt: vi.fn(() => ({ isLocked: false, remainingAttempts: 2 })),
  clearLoginAttempts: vi.fn(),
  formatRemainingTime: vi.fn(() => '5 minutos'),
}))

vi.mock('../../utils/sanitizeInput', () => ({
  sanitizeEmail: vi.fn(v => v),
  sanitizePassword: vi.fn(v => v),
}))

vi.mock('lucide-react', () => ({
  Mail: () => <span />,
  Lock: () => <span />,
  AlertCircle: () => <span />,
  Building2: () => <span />,
  ArrowLeft: () => <span />,
  Eye: () => <span data-testid="eye-icon" />,
  EyeOff: () => <span data-testid="eye-off-icon" />,
}))

import LoginPabellon from '../../pages/auth/LoginPabellon'
import { supabase } from '../../config/supabase'
import { isLocked } from '../../utils/rateLimiter'

const EMAIL_PLACEHOLDER = 'pabellon@clinica.cl'
const PASSWORD_PLACEHOLDER = '••••••••'

const renderLogin = () =>
  render(<MemoryRouter><LoginPabellon /></MemoryRouter>)

describe('LoginPabellon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    isLocked.mockReturnValue({ isLocked: false })
  })

  it('renderiza el formulario de login', () => {
    renderLogin()
    expect(screen.getByPlaceholderText(EMAIL_PLACEHOLDER)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('no llama a supabase si los campos están vacíos', async () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('llama a signInWithPassword con las credenciales ingresadas', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: '123' } },
      error: null,
    })
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText(EMAIL_PLACEHOLDER), { target: { value: 'test@clinica.cl' } })
    fireEvent.change(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form'))
    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@clinica.cl',
        password: 'password123',
      })
    })
  })

  it('muestra error cuando las credenciales son incorrectas', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText(EMAIL_PLACEHOLDER), { target: { value: 'mal@test.cl' } })
    fireEvent.change(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), { target: { value: 'wrong' } })
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form'))
    await waitFor(() => {
      expect(screen.getByText(/usuario o contraseña incorrectos/i)).toBeInTheDocument()
    })
  })

  it('el campo contraseña tiene type=password por defecto', () => {
    renderLogin()
    expect(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER)).toHaveAttribute('type', 'password')
  })

  it('muestra mensaje de cuenta bloqueada cuando isLocked retorna true', async () => {
    isLocked.mockReturnValue({ isLocked: true, remainingTime: 300000 })
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText(EMAIL_PLACEHOLDER), { target: { value: 'bloqueado@test.cl' } })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cuenta bloqueada/i })).toBeDisabled()
    })
  })
})

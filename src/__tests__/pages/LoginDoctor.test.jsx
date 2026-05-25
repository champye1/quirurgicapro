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
    auth: { signInWithPassword: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
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
  Stethoscope: () => <span />,
  ArrowLeft: () => <span />,
  Eye: () => <span />,
  EyeOff: () => <span />,
}))

import LoginDoctor from '../../pages/auth/LoginDoctor'
import { supabase } from '../../config/supabase'
import { isLocked } from '../../utils/rateLimiter'

const renderLogin = () => render(<MemoryRouter><LoginDoctor /></MemoryRouter>)

describe('LoginDoctor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    isLocked.mockReturnValue({ isLocked: false })
  })

  it('renderiza el formulario de login', () => {
    renderLogin()
    expect(screen.getByPlaceholderText(/evenegas|doctor/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('el campo de contraseña es type=password por defecto', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('••••••••')).toHaveAttribute('type', 'password')
  })

  it('no llama a supabase si los campos están vacíos', () => {
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
    fireEvent.change(screen.getByPlaceholderText(/evenegas|doctor/i), {
      target: { value: 'doctor@clinica.cl' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'pass123' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form'))
    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalled()
    })
  })

  it('muestra error con credenciales inválidas', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText(/evenegas|doctor/i), {
      target: { value: 'malo@test.cl' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'wrong' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form'))
    await waitFor(() => {
      expect(screen.getByText(/usuario o contraseña incorrectos/i)).toBeInTheDocument()
    })
  })

  it('deshabilita el botón cuando la cuenta está bloqueada', async () => {
    isLocked.mockReturnValue({ isLocked: true, remainingTime: 300000 })
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText(/evenegas|doctor/i), {
      target: { value: 'bloqueado@test.cl' },
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /bloqueada/i })).toBeDisabled()
    })
  })
})

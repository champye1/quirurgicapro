import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import NotFound from '../../pages/public/NotFound'

vi.mock('lucide-react', () => ({
  Stethoscope: () => <span data-testid="stethoscope-icon" />,
  ArrowLeft: () => <span data-testid="arrow-left-icon" />,
}))

const renderNotFound = () =>
  render(
    <MemoryRouter>
      <NotFound />
    </MemoryRouter>
  )

describe('NotFound', () => {
  it('muestra el código 404', () => {
    renderNotFound()
    expect(screen.getByText(/404/i)).toBeInTheDocument()
  })

  it('muestra el título de página no encontrada', () => {
    renderNotFound()
    expect(screen.getByRole('heading', { name: /página no encontrada/i })).toBeInTheDocument()
  })

  it('tiene enlace para volver al inicio', () => {
    renderNotFound()
    const link = screen.getByRole('link', { name: /volver al inicio/i })
    expect(link).toHaveAttribute('href', '/')
  })

  it('tiene enlace para ir al sistema', () => {
    renderNotFound()
    const link = screen.getByRole('link', { name: /ir al sistema/i })
    expect(link).toHaveAttribute('href', '/acceso')
  })
})

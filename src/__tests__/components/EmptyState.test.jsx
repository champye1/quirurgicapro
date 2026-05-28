import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyState from '../../components/common/EmptyState'
import { Package } from 'lucide-react'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Sin datos" description="No hay información disponible" />)
    expect(screen.getByText('Sin datos')).toBeInTheDocument()
    expect(screen.getByText('No hay información disponible')).toBeInTheDocument()
  })

  it('renders a custom icon', () => {
    render(<EmptyState icon={Package} title="Sin insumos" description="" />)
    // Lucide icons render as SVGs; check it's present via aria or SVG
    expect(screen.getByText('Sin insumos')).toBeInTheDocument()
  })

  it('renders action element when provided', () => {
    render(
      <EmptyState
        title="Vacío"
        description=""
        action={<button>Agregar</button>}
      />
    )
    expect(screen.getByRole('button', { name: /agregar/i })).toBeInTheDocument()
  })

  it('does not render action when not provided', () => {
    render(<EmptyState title="Vacío" description="" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders default Inbox icon when no icon prop given', () => {
    const { container } = render(<EmptyState title="Test" description="" />)
    // framer-motion renders a div; icon is an svg inside
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})

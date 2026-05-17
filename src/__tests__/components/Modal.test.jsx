import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Modal from '../../components/common/Modal'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, className }) => (
      <div onClick={onClick} className={className}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}))

vi.mock('lucide-react', () => ({
  X: () => <span data-testid="x-icon" />,
}))

describe('Modal', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    onClose.mockClear()
    document.body.style.overflow = ''
  })

  it('renders nothing when isOpen is false', () => {
    render(<Modal isOpen={false} onClose={onClose} title="Test" />)
    expect(screen.queryByText('Test')).toBeNull()
  })

  it('renders title and children when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={onClose} title="Mi Modal">
        <p>Contenido de prueba</p>
      </Modal>
    )
    expect(screen.getByText('Mi Modal')).toBeTruthy()
    expect(screen.getByText('Contenido de prueba')).toBeTruthy()
  })

  it('renders children without title when title is not provided', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Solo contenido</p>
      </Modal>
    )
    expect(screen.getByText('Solo contenido')).toBeTruthy()
  })

  it('calls onClose when the X button is clicked', () => {
    render(<Modal isOpen={true} onClose={onClose} title="Test" />)
    const closeButton = screen.getByLabelText('Cerrar modal')
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    render(<Modal isOpen={true} onClose={onClose} title="Test" />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose on non-Escape keys', () => {
    render(<Modal isOpen={true} onClose={onClose} title="Test" />)
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sets body overflow to hidden when open', () => {
    render(<Modal isOpen={true} onClose={onClose} title="Test" />)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores body overflow when closed', () => {
    const { rerender } = render(<Modal isOpen={true} onClose={onClose} title="Test" />)
    rerender(<Modal isOpen={false} onClose={onClose} title="Test" />)
    expect(document.body.style.overflow).toBe('unset')
  })
})

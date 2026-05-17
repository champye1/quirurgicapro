import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '../../utils/logger'

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('expone los métodos esperados', () => {
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.errorWithContext).toBe('function')
  })

  it('logger.warn invoca console.warn', () => {
    logger.warn('test warning')
    expect(console.warn).toHaveBeenCalledWith('[WARN]', 'test warning')
  })

  it('logger.error invoca console.error', () => {
    logger.error('test error')
    expect(console.error).toHaveBeenCalledWith('[ERROR]', 'test error')
  })

  it('errorWithContext incluye el contexto y mensaje', () => {
    const err = new Error('algo salió mal')
    logger.errorWithContext('Flujo de pago', err)
    expect(console.error).toHaveBeenCalledWith(
      '[ERROR] Flujo de pago:',
      expect.objectContaining({ message: 'algo salió mal' })
    )
  })

  it('errorWithContext maneja error sin mensaje', () => {
    logger.errorWithContext('contexto', null)
    expect(console.error).toHaveBeenCalledWith(
      '[ERROR] contexto:',
      expect.objectContaining({ message: 'Error desconocido' })
    )
  })
})

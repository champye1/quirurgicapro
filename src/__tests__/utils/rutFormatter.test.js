import { describe, it, expect } from 'vitest'
import { formatRut, cleanRut, isValidRutFormat, validateRut } from '../../utils/rutFormatter'

describe('formatRut', () => {
  it('returns empty string for empty input', () => {
    expect(formatRut('')).toBe('')
  })

  it('formats a full RUT with dots and hyphen', () => {
    expect(formatRut('12345678')).toBe('1.234.567-8')
  })

  it('handles single character input', () => {
    expect(formatRut('5')).toBe('5')
  })

  it('formats RUT with K as check digit', () => {
    // '1234567k' → strip to '1234567K', DV='K', number='123456' → '1.234.567-K'
    expect(formatRut('1234567k')).toBe('1.234.567-K')
  })

  it('limits input to 9 characters', () => {
    const result = formatRut('1234567890123')
    const digits = result.replace(/[^0-9kK]/g, '')
    expect(digits.length).toBeLessThanOrEqual(9)
  })

  it('strips non-alphanumeric characters before formatting', () => {
    // '12.345.678-9' → strip dots/hyphen → '123456789' → '12.345.678-9'
    expect(formatRut('12.345.678-9')).toBe('12.345.678-9')
  })
})

describe('cleanRut', () => {
  it('removes dots but keeps hyphen', () => {
    expect(cleanRut('12.345.678-9')).toBe('12345678-9')
  })

  it('does not modify RUT without dots', () => {
    expect(cleanRut('12345678-9')).toBe('12345678-9')
  })

  it('handles K check digit', () => {
    expect(cleanRut('1.234.567-K')).toBe('1234567-K')
  })
})

describe('isValidRutFormat', () => {
  it('accepts valid RUT format with hyphen', () => {
    expect(isValidRutFormat('12345678-9')).toBe(true)
    expect(isValidRutFormat('1234567-K')).toBe(true)
  })

  it('accepts valid RUT with dots', () => {
    expect(isValidRutFormat('12.345.678-9')).toBe(true)
  })

  it('rejects RUT without hyphen', () => {
    expect(isValidRutFormat('12345678')).toBe(false)
  })

  it('rejects RUT too short', () => {
    expect(isValidRutFormat('123-4')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidRutFormat('')).toBe(false)
  })
})

describe('validateRut', () => {
  it('validates a correct RUT (numeric check digit)', () => {
    // 76354771-K is a real valid RUT
    expect(validateRut('76354771-K')).toBe(true)
  })

  it('validates a correct RUT with formatted dots', () => {
    expect(validateRut('76.354.771-K')).toBe(true)
  })

  it('rejects RUT with wrong check digit', () => {
    expect(validateRut('12345678-0')).toBe(false)
  })

  it('rejects RUT that is too short', () => {
    expect(validateRut('1234-5')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateRut('')).toBe(false)
  })

  it('handles K check digit correctly (case insensitive)', () => {
    expect(validateRut('76354771-K')).toBe(true)
    expect(validateRut('76354771-k')).toBe(true)
  })

  it('rejects RUT with letters in number part', () => {
    expect(validateRut('1234abc-9')).toBe(false)
  })
})

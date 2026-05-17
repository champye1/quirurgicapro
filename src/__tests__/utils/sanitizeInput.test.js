import { describe, it, expect } from 'vitest'
import {
  sanitizeString,
  sanitizeEmail,
  sanitizeRut,
  sanitizePassword,
  sanitizeNumber,
} from '../../utils/sanitizeInput'

describe('sanitizeString', () => {
  it('returns empty string for null or undefined', () => {
    expect(sanitizeString(null)).toBe('')
    expect(sanitizeString(undefined)).toBe('')
    expect(sanitizeString(123)).toBe('')
  })

  it('trims whitespace by default', () => {
    expect(sanitizeString('  hola  ')).toBe('hola')
  })

  it('removes script tags', () => {
    const input = 'hola <script>alert("xss")</script> mundo'
    expect(sanitizeString(input)).not.toContain('<script>')
    expect(sanitizeString(input)).not.toContain('alert')
  })

  it('removes control characters and null bytes', () => {
    expect(sanitizeString('abc\x00def')).toBe('abcdef')
    expect(sanitizeString('abc\x1Fdef')).toBe('abcdef')
  })

  it('removes dangerous SQL keywords', () => {
    expect(sanitizeString('DROP TABLE users')).not.toContain('DROP')
    expect(sanitizeString('SELECT * FROM')).toBe('SELECT * FROM') // SELECT is not in the blocklist
    expect(sanitizeString('DELETE FROM tabla')).not.toContain('DELETE')
  })

  it('removes SQL comment sequences', () => {
    expect(sanitizeString("' OR 1=1 -- comment")).not.toContain('--')
  })

  it('escapes HTML special characters', () => {
    const result = sanitizeString('<b>bold</b> & "test"')
    expect(result).not.toContain('<b>')
    expect(result).toContain('&amp;')
    expect(result).toContain('&lt;')
    expect(result).toContain('&gt;')
  })

  it('respects maxLength option', () => {
    expect(sanitizeString('abcdefgh', { maxLength: 3 })).toBe('abc')
  })

  it('preserves normal text', () => {
    expect(sanitizeString('Juan Pérez')).toBe('Juan Pérez')
  })
})

describe('sanitizeEmail', () => {
  it('returns empty string for null', () => {
    expect(sanitizeEmail(null)).toBe('')
    expect(sanitizeEmail(undefined)).toBe('')
  })

  it('keeps valid email characters', () => {
    expect(sanitizeEmail('user@example.com')).toBe('user@example.com')
    expect(sanitizeEmail('user+tag@sub.domain.com')).toBe('user+tag@sub.domain.com')
  })

  it('removes disallowed characters', () => {
    expect(sanitizeEmail('user <script>@bad.com')).not.toContain('<script>')
    expect(sanitizeEmail('user@exam ple.com')).toBe('user@example.com')
  })

  it('trims whitespace and control chars', () => {
    expect(sanitizeEmail('  user@example.com  ')).toBe('user@example.com')
    expect(sanitizeEmail('user@example.com\x00')).toBe('user@example.com')
  })
})

describe('sanitizeRut', () => {
  it('returns empty string for null', () => {
    expect(sanitizeRut(null)).toBe('')
    expect(sanitizeRut(undefined)).toBe('')
  })

  it('allows digits, dots, hyphens and K', () => {
    expect(sanitizeRut('12.345.678-9')).toBe('12.345.678-9')
    expect(sanitizeRut('12345678-K')).toBe('12345678-K')
  })

  it('removes characters not valid in RUT', () => {
    expect(sanitizeRut('12@345#678!')).toBe('12345678')
    expect(sanitizeRut('<script>alert</script>')).toBe('')
  })
})

describe('sanitizePassword', () => {
  it('returns empty string for null', () => {
    expect(sanitizePassword(null)).toBe('')
    expect(sanitizePassword(undefined)).toBe('')
  })

  it('removes control characters', () => {
    expect(sanitizePassword('pass\x00word')).toBe('password')
    expect(sanitizePassword('pass\x1Fword')).toBe('password')
  })

  it('preserves special characters needed in passwords', () => {
    const strong = 'P@ssw0rd!#$%^&*()'
    expect(sanitizePassword(strong)).toBe(strong)
  })
})

describe('sanitizeNumber', () => {
  it('returns empty string for null', () => {
    expect(sanitizeNumber(null)).toBe('')
  })

  it('allows digits and single decimal point', () => {
    expect(sanitizeNumber('123.45')).toBe('123.45')
    expect(sanitizeNumber('1000')).toBe('1000')
  })

  it('removes letters and special chars', () => {
    expect(sanitizeNumber('12abc34')).toBe('1234')
    expect(sanitizeNumber('$1,000.50')).toBe('1000.50')
  })

  it('keeps only first decimal point', () => {
    expect(sanitizeNumber('1.2.3')).toBe('1.23')
  })
})

/**
 * Utilidades para sanitización de inputs en formularios.
 * Previene XSS y caracteres de control; NO intenta bloquear SQL
 * (la protección SQL real es responsabilidad del backend con queries parametrizadas).
 */

const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F]/g

/**
 * Sanitiza un string removiendo caracteres de control y tags/eventos HTML peligrosos.
 * @param {string} input
 * @param {{ allowHTML?: boolean, maxLength?: number|null, trim?: boolean }} options
 * @returns {string}
 */
export function sanitizeString(input, options = {}) {
  if (input == null || typeof input !== 'string') return ''

  const { allowHTML = false, maxLength = null, trim = true } = options

  let sanitized = input.replace(CONTROL_CHARS_REGEX, '')

  if (trim) sanitized = sanitized.trim()

  if (!allowHTML) {
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      // Captura handlers con o sin comillas, con o sin espacio previo
      .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/data\s*:\s*text\/html/gi, '')
  }

  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }

  return sanitized
}

/**
 * Sanitiza un número (solo dígitos y un punto decimal).
 */
export function sanitizeNumber(input) {
  if (input == null) return ''
  if (typeof input === 'number' && !Number.isNaN(input))
    return String(input).replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
  if (typeof input !== 'string') return ''
  return input
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(/[^\d.]/g, '')
    .replace(/(\..*)\./g, '$1')
}

/**
 * Sanitiza un email (solo caracteres válidos para email).
 */
export function sanitizeEmail(input) {
  if (input == null || typeof input !== 'string') return ''
  return input
    .replace(CONTROL_CHARS_REGEX, '')
    .trim()
    .replace(/[^a-zA-Z0-9@._+-]/g, '')
}

/**
 * Sanitiza un RUT (solo dígitos, puntos, guiones y K).
 */
export function sanitizeRut(input) {
  if (input == null || typeof input !== 'string') return ''
  return input
    .replace(CONTROL_CHARS_REGEX, '')
    .trim()
    .replace(/[^\d.\-kK]/g, '')
}

/**
 * Sanitiza un código de insumo o identificador.
 * Elimina caracteres que causan XSS cuando se renderizan en HTML.
 */
export function sanitizeCode(input) {
  if (input == null || typeof input !== 'string') return ''
  return input
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(/[<>&"']/g, '')
    .trim()
}

/**
 * Sanitiza contraseña: elimina solo caracteres de control (null byte).
 * No muta el contenido para no alterar la contraseña.
 */
export function sanitizePassword(input) {
  if (input == null || typeof input !== 'string') return ''
  return input.replace(CONTROL_CHARS_REGEX, '')
}

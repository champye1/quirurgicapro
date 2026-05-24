/**
 * Utilidades para sanitización de inputs en formularios
 * Previene XSS, SQL Injection, caracteres de control y otros ataques
 */

/** Caracteres de control y null byte que no deben guardarse en texto */
const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F]/g

/**
 * Sanitiza un string removiendo caracteres peligrosos y scripts
 * @param {string} input - El string a sanitizar
 * @param {Object} options - Opciones de sanitización
 * @returns {string} - String sanitizado (si input no es string, devuelve '')
 */
export function sanitizeString(input, options = {}) {
  if (input == null || typeof input !== 'string') {
    return ''
  }

  const {
    allowHTML = false,
    maxLength = null,
    trim = true,
    removeScripts = true,
    removeSQL = true,
    removeControlChars = true,
  } = options

  let sanitized = input

  // Eliminar caracteres de control y null byte (riesgo de inyección y corrupción)
  if (removeControlChars) {
    sanitized = sanitized.replace(CONTROL_CHARS_REGEX, '')
  }

  // Trim si está habilitado
  if (trim) {
    sanitized = sanitized.trim()
  }

  // Remover scripts y tags HTML peligrosos si no se permite HTML
  if (!allowHTML || removeScripts) {
    // Remover tags script, iframe, object, embed
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    sanitized = sanitized.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    
    // Remover atributos peligrosos de eventos (onclick, onerror, etc.)
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '')
    
    // Remover javascript: y data: URLs peligrosas
    sanitized = sanitized.replace(/javascript:/gi, '')
    sanitized = sanitized.replace(/data:text\/html/gi, '')
  }

  // Remover patrones SQL peligrosos (la protección real es usar consultas parametrizadas en backend)
  if (removeSQL) {
    sanitized = sanitized.replace(/--/g, '')
    sanitized = sanitized.replace(/\/\*/g, '')
    sanitized = sanitized.replace(/\*\//g, '')
    const sqlKeywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'EXEC', 'EXECUTE']
    sqlKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\s+`, 'gi')
      sanitized = sanitized.replace(regex, '')
    })
  }

  // Limitar longitud si se especifica
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }

  return sanitized
}

/**
 * Sanitiza un número (solo permite dígitos y un punto decimal)
 * @param {string|number} input - Valor a sanitizar
 * @returns {string} - String con solo números y punto decimal (o '' si no es string/number)
 */
export function sanitizeNumber(input) {
  if (input == null) return ''
  if (typeof input === 'number' && !Number.isNaN(input)) return String(input).replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
  if (typeof input !== 'string') return ''
  const cleaned = input.replace(CONTROL_CHARS_REGEX, '')
  return cleaned.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
}

/**
 * Sanitiza un email (solo permite caracteres válidos para email)
 * @param {string} input - String a sanitizar
 * @returns {string} - String sanitizado para email
 */
export function sanitizeEmail(input) {
  if (input == null || typeof input !== 'string') {
    return ''
  }
  const trimmed = input.replace(CONTROL_CHARS_REGEX, '').trim()
  // Permite letras, números, @, ., -, _, + (plus addressing)
  return trimmed.replace(/[^a-zA-Z0-9@._+-]/g, '')
}

/**
 * Sanitiza un RUT (solo permite dígitos, puntos, guiones y K)
 * @param {string} input - String a sanitizar
 * @returns {string} - String sanitizado para RUT
 */
export function sanitizeRut(input) {
  if (input == null || typeof input !== 'string') {
    return ''
  }
  const trimmed = input.replace(CONTROL_CHARS_REGEX, '').trim()
  return trimmed.replace(/[^\d.\-kK]/g, '')
}

/**
 * Sanitiza un código de insumo o identificador (ej. username).
 * Elimina caracteres de control y símbolos que podrían causar XSS si se renderizan.
 * @param {string} input - String a sanitizar
 * @returns {string} - String sanitizado para código
 */
export function sanitizeCode(input) {
  if (input == null || typeof input !== 'string') {
    return ''
  }
  let s = input.replace(CONTROL_CHARS_REGEX, '')
  // Evitar XSS: quitar < > & " ' cuando el código se muestra en HTML
  s = s.replace(/</g, '').replace(/>/g, '').replace(/&/g, '').replace(/"/g, '').replace(/'/g, '')
  return s.trim()
}

/**
 * Sanitiza un campo de contraseña: elimina scripts, eventos y caracteres de control
 * (p. ej. null byte), sin escapar caracteres especiales para no alterar la contraseña.
 * @param {string} input - String a sanitizar
 * @returns {string} - String sanitizado para contraseña
 */
export function sanitizePassword(input) {
  if (input == null || typeof input !== 'string') {
    return ''
  }
  // Solo eliminar caracteres de control y null bytes — nunca mutar el contenido de la contraseña
  return input.replace(CONTROL_CHARS_REGEX, '')
}

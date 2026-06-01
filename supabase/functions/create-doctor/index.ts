import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit } from '../_shared/rateLimit.ts'

// ========== CONSTANTES (buenas prácticas: un solo lugar para límites y mensajes) ==========
const LIMITS = {
  NOMBRE_MIN: 2,
  NOMBRE_MAX: 80,
  APELLIDO_MIN: 2,
  APELLIDO_MAX: 80,
  EMAIL_MAX: 255,
  USERNAME_MIN: 3,
  USERNAME_MAX: 50,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
} as const

const ESTADOS_DOCTOR = ['activo', 'vacaciones'] as const
const ESPECIALIDADES_VALIDAS = [
  'cirugia_general', 'cirugia_cardiovascular', 'cirugia_plastica', 'cirugia_ortopedica',
  'neurocirugia', 'cirugia_oncologica', 'urologia', 'ginecologia', 'otorrinolaringologia',
  'oftalmologia', 'otra',
] as const

// Regex: RUT chileno 7-8 dígitos + guión + dígito o K
const RUT_REGEX = /^[0-9]{7,8}-[0-9kK]{1}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]+$/

type DoctorStatus = typeof ESTADOS_DOCTOR[number]
type MedicalSpecialty = typeof ESPECIALIDADES_VALIDAS[number]

/** Respuesta JSON con CORS */
function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

/** Valida y limpia string; devuelve null si no es string */
function asString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value).trim()
  return null
}

/** Elimina caracteres de control y tags/scripts para evitar XSS al almacenar */
function stripForStorage(s: string): string {
  return s
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .trim()
}

/** Valida RUT chileno: formato y dígito verificador */
function isValidRut(rut: string): boolean {
  const normalized = rut.trim().replace(/\./g, '')
  if (!RUT_REGEX.test(normalized)) return false
  const [body, dv] = normalized.split('-')
  const digits = body.split('').map(Number).reverse()
  let sum = 0
  let multiplier = 2
  for (const d of digits) {
    sum += d * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }
  const remainder = 11 - (sum % 11)
  const expectedDv = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder)
  return dv.toUpperCase() === expectedDv
}

/** Normaliza RUT para guardar (sin puntos, K mayúscula) */
function normalizeRut(rut: string): string {
  return rut.trim().replace(/\./g, '').replace(/k$/, 'K')
}

// Obtener origen permitido desde variables de entorno o usar wildcard en desarrollo
const getAllowedOrigin = () => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || []
  if (allowedOrigins.length === 0) {
    return '*' // ⚠️ Cambiar en producción a orígenes específicos
  }
  return allowedOrigins
}

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigins = getAllowedOrigin()
  const originHeader = origin && allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': originHeader,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validar método HTTP (solo POST para crear médico)
    if (req.method !== 'POST') {
      return jsonResponse(
        { success: false, error: 'Método no permitido. Use POST.' },
        405,
        corsHeaders
      )
    }

    // Validar Content-Type para requests con body
    const contentType = req.headers.get('Content-Type') || ''
    if (!contentType.toLowerCase().includes('application/json')) {
      return jsonResponse(
        { success: false, error: 'Content-Type debe ser application/json.' },
        400,
        corsHeaders
      )
    }

    // Parseo seguro del body
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return jsonResponse(
        { success: false, error: 'Cuerpo de la petición no es un JSON válido.' },
        400,
        corsHeaders
      )
    }
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResponse(
        { success: false, error: 'El cuerpo debe ser un objeto JSON.' },
        400,
        corsHeaders
      )
    }

    // VALIDACIÓN DE AUTENTICACIÓN Y PERMISOS
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse(
        { success: false, error: 'No autorizado. Token de autenticación requerido.' },
        401,
        corsHeaders
      )
    }

    // Obtener variables de entorno
    // Opción 1: Variables configuradas manualmente en Dashboard → Edge Functions → Settings → Secrets
    let supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    let supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    // Opción 2: Si no están configuradas, usar las que Supabase inyecta automáticamente
    // Estas están disponibles en el contexto de la función
    if (!supabaseUrl) {
      // Intentar obtener de variables automáticas de Supabase
      supabaseUrl = Deno.env.get('SUPABASE_PROJECT_URL') || ''
    }
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse(
        {
          success: false,
          error: 'Variables de entorno no configuradas. Ve a Supabase Dashboard → Edge Functions → Settings → Secrets y agrega: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY',
        },
        500,
        corsHeaders
      )
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Validar token y obtener usuario
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return jsonResponse(
        { success: false, error: 'Token de autenticación inválido o expirado.' },
        401,
        corsHeaders
      )
    }

    // Verificar que el usuario tiene rol de pabellon
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return jsonResponse(
        { success: false, error: 'Usuario no encontrado en el sistema.' },
        403,
        corsHeaders
      )
    }

    if (userData.role !== 'pabellon') {
      return jsonResponse(
        { success: false, error: 'No autorizado. Solo usuarios de Pabellón pueden crear médicos.' },
        403,
        corsHeaders
      )
    }

    // Rate limiting: máximo 10 médicos creados por hora por usuario
    const { allowed, remaining, retryAfterSecs } = await checkRateLimit(supabaseAdmin, user.id, 'create-doctor', 10, 60)
    if (!allowed) {
      return jsonResponse(
        { success: false, error: 'Límite de solicitudes excedido. Intente nuevamente en una hora.' },
        429,
        { ...corsHeaders, 'Retry-After': String(retryAfterSecs ?? 3600) }
      )
    }
    if (remaining <= 2) {
      console.warn(`[create-doctor] Usuario ${user.id} tiene ${remaining} llamadas restantes en esta hora`)
    }

    let nombre = asString(body.nombre)
    let apellido = asString(body.apellido)
    const rutRaw = asString(body.rut)
    if (nombre) nombre = stripForStorage(nombre)
    if (apellido) apellido = stripForStorage(apellido)
    const emailRaw = asString(body.email)
    const especialidadRaw = asString(body.especialidad)
    const estadoRaw = asString(body.estado)
    const acceso_web_enabled = Boolean(body.acceso_web_enabled)
    let username = asString(body.username)
    const password = body.password != null ? asString(body.password) ?? '' : ''
    if (username) username = stripForStorage(username)

    // Validaciones de campos requeridos
    if (!nombre) {
      return jsonResponse(
        { success: false, error: 'El campo "nombre" es requerido y no puede estar vacío.' },
        400,
        corsHeaders
      )
    }
    if (!apellido) {
      return jsonResponse(
        { success: false, error: 'El campo "apellido" es requerido y no puede estar vacío.' },
        400,
        corsHeaders
      )
    }
    if (!rutRaw) {
      return jsonResponse(
        { success: false, error: 'El campo "rut" es requerido y no puede estar vacío.' },
        400,
        corsHeaders
      )
    }
    if (!emailRaw) {
      return jsonResponse(
        { success: false, error: 'El campo "email" es requerido y no puede estar vacío.' },
        400,
        corsHeaders
      )
    }
    if (!especialidadRaw) {
      return jsonResponse(
        { success: false, error: 'El campo "especialidad" es requerido y no puede estar vacío.' },
        400,
        corsHeaders
      )
    }

    // Longitud y formato de nombre y apellido
    if (nombre.length < LIMITS.NOMBRE_MIN || nombre.length > LIMITS.NOMBRE_MAX) {
      return jsonResponse(
        { success: false, error: `El nombre debe tener entre ${LIMITS.NOMBRE_MIN} y ${LIMITS.NOMBRE_MAX} caracteres.` },
        400,
        corsHeaders
      )
    }
    if (apellido.length < LIMITS.APELLIDO_MIN || apellido.length > LIMITS.APELLIDO_MAX) {
      return jsonResponse(
        { success: false, error: `El apellido debe tener entre ${LIMITS.APELLIDO_MIN} y ${LIMITS.APELLIDO_MAX} caracteres.` },
        400,
        corsHeaders
      )
    }

    // Validación de RUT (formato chileno y dígito verificador)
    if (!isValidRut(rutRaw)) {
      return jsonResponse(
        { success: false, error: 'El RUT no es válido. Use formato 12345678-9 (7 u 8 dígitos, guión y dígito verificador).' },
        400,
        corsHeaders
      )
    }
    const rut = normalizeRut(rutRaw)

    // Validación de email
    if (emailRaw.length > LIMITS.EMAIL_MAX) {
      return jsonResponse(
        { success: false, error: `El email no puede superar ${LIMITS.EMAIL_MAX} caracteres.` },
        400,
        corsHeaders
      )
    }
    if (!EMAIL_REGEX.test(emailRaw)) {
      return jsonResponse(
        { success: false, error: 'El email no tiene un formato válido.' },
        400,
        corsHeaders
      )
    }
    const email = emailRaw.toLowerCase()

    // Especialidad debe ser un valor del enum
    const especialidad = especialidadRaw.toLowerCase()
    if (!ESPECIALIDADES_VALIDAS.includes(especialidad as MedicalSpecialty)) {
      return jsonResponse(
        {
          success: false,
          error: `Especialidad no válida. Valores permitidos: ${ESPECIALIDADES_VALIDAS.join(', ')}.`,
        },
        400,
        corsHeaders
      )
    }

    // Estado (opcional): si se envía, debe ser válido
    if (estadoRaw && !ESTADOS_DOCTOR.includes(estadoRaw.toLowerCase() as DoctorStatus)) {
      return jsonResponse(
        { success: false, error: `Estado no válido. Valores permitidos: ${ESTADOS_DOCTOR.join(', ')}.` },
        400,
        corsHeaders
      )
    }
    const estado: DoctorStatus = (estadoRaw?.toLowerCase() as DoctorStatus) || 'activo'

    // Si acceso_web_enabled está activo, validar username y password
    if (acceso_web_enabled) {
      if (!username) {
        return jsonResponse(
          { success: false, error: 'Si habilitas el acceso web, debes proporcionar un nombre de usuario.' },
          400,
          corsHeaders
        )
      }
      if (username.length < LIMITS.USERNAME_MIN || username.length > LIMITS.USERNAME_MAX) {
        return jsonResponse(
          { success: false, error: `El nombre de usuario debe tener entre ${LIMITS.USERNAME_MIN} y ${LIMITS.USERNAME_MAX} caracteres.` },
          400,
          corsHeaders
        )
      }
      if (!USERNAME_REGEX.test(username)) {
        return jsonResponse(
          { success: false, error: 'El nombre de usuario solo puede contener letras, números, puntos, guiones y guiones bajos.' },
          400,
          corsHeaders
        )
      }
      if (!password) {
        return jsonResponse(
          { success: false, error: 'Si habilitas el acceso web, debes proporcionar una contraseña.' },
          400,
          corsHeaders
        )
      }
      if (password.length < LIMITS.PASSWORD_MIN) {
        return jsonResponse(
          { success: false, error: `La contraseña debe tener al menos ${LIMITS.PASSWORD_MIN} caracteres.` },
          400,
          corsHeaders
        )
      }
      if (password.length > LIMITS.PASSWORD_MAX) {
        return jsonResponse(
          { success: false, error: `La contraseña no puede superar ${LIMITS.PASSWORD_MAX} caracteres.` },
          400,
          corsHeaders
        )
      }
    }

    // Generar contraseña aleatoria interna — NUNCA se retorna en la respuesta.
    // El médico accederá con un enlace de reset de contraseña enviado a su email.
    const genPassword = (): string => {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
      const digits = '0123456789'
      const all = letters + digits
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)
      const arr = [
        letters[bytes[0] % letters.length],
        digits[bytes[1] % digits.length],
        ...Array.from(bytes.slice(2), (b: number) => all[b % all.length]),
      ]
      const shuffleBytes = new Uint8Array(arr.length)
      crypto.getRandomValues(shuffleBytes)
      for (let i = arr.length - 1; i > 0; i--) {
        const j = shuffleBytes[i] % (i + 1)
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr.join('')
    }
    const tempPassword = genPassword()
    
    const userEmail = email

    let userId: string
    let reusedExistingAuthUser = false

    // Crear usuario en Auth (o reutilizar si el correo ya existe por un intento anterior fallido)
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password: tempPassword,
      email_confirm: true,
    })

    const isDuplicateEmail = createUserError?.message?.toLowerCase().includes('already') ||
      createUserError?.message?.toLowerCase().includes('registered') ||
      createUserError?.message?.toLowerCase().includes('duplicate')

    if (isDuplicateEmail) {
      // El correo ya existe en Auth. Buscar id: primero en public.users (más fiable), si no en Auth listUsers
      const { data: rowInUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .limit(1)
        .maybeSingle()

      if (rowInUsers?.id) {
        userId = rowInUsers.id
        reusedExistingAuthUser = true
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: tempPassword })
      } else {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
        const existing = listData?.users?.find(u => u.email?.toLowerCase() === userEmail)
        if (!existing?.id) {
          return jsonResponse(
            {
              success: false,
              error: 'Ese correo ya está registrado en Auth pero no se encontró el usuario. Elimina el usuario en Authentication → Users o usa otro correo y vuelve a intentar.',
            },
            409,
            corsHeaders
          )
        }
        userId = existing.id
        reusedExistingAuthUser = true
        await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: tempPassword })
      }
    } else if (createUserError || !authData?.user) {
      console.error('Error al crear usuario en Auth:', createUserError)
      return jsonResponse(
        {
          success: false,
          error: `Error al crear usuario en Auth: ${createUserError?.message || 'Error desconocido'}`,
        },
        400,
        corsHeaders
      )
    } else {
      userId = authData.user.id
    }

    // Crear registro en public.users (incluir username para que el doctor pueda iniciar sesión con usuario o email)
    const { data: insertedUser, error: insertUserError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email: userEmail,
        role: 'doctor',
        ...(username ? { username: username.toLowerCase().trim() } : {}),
      })
      .select('id')
      .single()

    if (insertUserError) {
      if (!reusedExistingAuthUser) await supabaseAdmin.auth.admin.deleteUser(userId)
      console.error('Error al crear registro en users:', insertUserError)
      // 23505 = unique violation: si reutilizamos usuario existente, public.users ya tiene la fila → continuar a crear médico
      if (insertUserError.code === '23505' && reusedExistingAuthUser) {
        // No devolver error; seguir a crear el médico
      } else if (insertUserError.code === '23505') {
        return jsonResponse(
          { success: false, error: 'El correo electrónico ya está registrado. Usa otro correo para este médico.' },
          409,
          corsHeaders
        )
      } else {
        return jsonResponse(
          { success: false, error: `Error al crear usuario en el sistema: ${insertUserError.message}` },
          400,
          corsHeaders
        )
      }
    }

    // Verificar que la fila existe (salvo si reutilizamos usuario y ya estaba en public.users)
    const userRowOk = insertedUser?.id || (insertUserError?.code === '23505' && reusedExistingAuthUser)
    if (!userRowOk) {
      if (!reusedExistingAuthUser) await supabaseAdmin.auth.admin.deleteUser(userId)
      console.error('El registro en users no se creó correctamente')
      return jsonResponse(
        {
          success: false,
          error: 'No se pudo crear el usuario en el sistema. Comprueba que la tabla users permita inserciones con la clave de servicio (RLS/permisos).',
        },
        500,
        corsHeaders
      )
    }

    // Asegurar siempre el username en users (creación nueva ya lo tiene; si reutilizamos usuario existente, el INSERT falló y hay que actualizarlo)
    if (username) {
      await supabaseAdmin
        .from('users')
        .update({ username: username.toLowerCase() })
        .eq('id', userId)
    }

    // Crear registro en doctors (nombre, apellido y email ya están validados y normalizados)
    const { data: doctorData, error: insertDoctorError } = await supabaseAdmin
      .from('doctors')
      .insert({
        user_id: userId,
        nombre,
        apellido,
        rut,
        email,
        especialidad,
        estado,
        acceso_web_enabled: acceso_web_enabled || false,
      })
      .select()
      .single()

    if (insertDoctorError) {
      // Solo borrar usuario Auth y fila users si acabamos de crearlos (no si reutilizamos uno existente)
      if (!reusedExistingAuthUser) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        await supabaseAdmin.from('users').delete().eq('id', userId)
      }
      console.error('Error al crear médico:', insertDoctorError)

      // 23503 = foreign key violation (doctors_user_id_fkey): el user_id no existe en users
      if (insertDoctorError.code === '23503') {
        return jsonResponse(
          {
            success: false,
            error: 'No se pudo vincular el médico al usuario. El usuario se creó en Auth pero no en la tabla de usuarios. Contacta al administrador o revisa permisos/RLS de la tabla users.',
          },
          500,
          corsHeaders
        )
      }

      if (insertDoctorError.code === '23505') {
        if (insertDoctorError.message.includes('rut') || insertDoctorError.details?.includes('rut')) {
          return jsonResponse(
            { success: false, error: `El RUT ${rut} ya está registrado. Usa un RUT diferente.` },
            409,
            corsHeaders
          )
        }
        if (insertDoctorError.message.includes('email') || insertDoctorError.details?.includes('email')) {
          return jsonResponse(
            { success: false, error: `El correo electrónico ${email} ya está registrado. Usa un email diferente.` },
            409,
            corsHeaders
          )
        }
        return jsonResponse(
          { success: false, error: 'Ya existe un médico con estos datos.' },
          409,
          corsHeaders
        )
      }

      return jsonResponse(
        { success: false, error: `Error al crear médico: ${insertDoctorError.message}` },
        400,
        corsHeaders
      )
    }

    // Si el médico tiene acceso web, generar enlace de reset de contraseña y enviarlo por email.
    // La contraseña temporal NUNCA se retorna — el médico la establece él mismo desde el enlace.
    let resetLinkSent = false
    let resetLink: string | undefined

    if (acceso_web_enabled) {
      try {
        const appUrl = Deno.env.get('APP_URL') || 'https://clinica-unico.pages.dev'
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: userEmail,
          options: { redirectTo: `${appUrl}/auth/restablecer-contrasena` },
        })
        resetLink = (linkData as Record<string, unknown>)?.properties
          ? ((linkData as Record<string, { action_link?: string }>).properties?.action_link)
          : undefined

        if (resetLink) {
          // Intentar enviar por email
          const { data: settingsRow } = await supabaseAdmin
            .from('clinic_settings').select('value').eq('key', 'gmail_config').maybeSingle()
          const cfg = (settingsRow?.value as Record<string, string>) || {}
          const hasGmail = !!(cfg.client_id && cfg.client_secret && cfg.refresh_token)

          if (hasGmail) {
            const html = `<h2 style="color:#1e40af">Bienvenido al Portal Clínico</h2>
              <p>Estimado/a Dr/a. <strong>${nombre} ${apellido}</strong>,</p>
              <p>El equipo de pabellón te ha creado una cuenta. Para ingresar, primero debes establecer tu contraseña:</p>
              <p style="text-align:center;margin:24px 0">
                <a href="${resetLink}" style="background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
                  Establecer mi contraseña
                </a>
              </p>
              <p style="color:#6b7280;font-size:12px">Este enlace es de un solo uso y expira en 24 horas.</p>`
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseServiceKey}` },
                body: JSON.stringify({ to: userEmail, subject: 'Bienvenido al Portal Clínico — Establece tu contraseña', html }),
              })
              resetLinkSent = true
              resetLink = undefined // No exponer el link si se envió por email
            } catch { /* Si falla el email, el link se retorna para copia manual */ }
          }
        }
      } catch { /* No bloquear la creación si falla la generación del link */ }
    }

    return jsonResponse(
      {
        success: true,
        doctor: doctorData,
        username: acceso_web_enabled ? username : undefined,
        resetLinkSent,
        resetLink, // Solo presente si Gmail no está configurado (fallback para copia manual)
        message: 'Médico creado exitosamente',
      },
      200,
      corsHeaders
    )
  } catch (error) {
    console.error('Error desconocido en create-doctor:', error)
    const err = error instanceof Error ? error : new Error('Error desconocido')
    return jsonResponse(
      { success: false, error: err.message || 'Error desconocido' },
      500,
      getCorsHeaders(req.headers.get('origin'))
    )
  }
})

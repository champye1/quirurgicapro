# SurgicalHUB — Portal Clínico Quirúrgico

Sistema de gestión de pabellones quirúrgicos para clínicas privadas. Coordina solicitudes de cirugía, agenda pabellones, gestiona médicos e insumos, y notifica automáticamente vía WhatsApp y correo electrónico.

**Stack:** React 18 + Vite + Tailwind CSS + Supabase (PostgreSQL + Auth + Realtime + Edge Functions)

---

## Roles del sistema

| Rol | Acceso |
|-----|--------|
| **Pabellón** | Gestión completa: solicitudes, calendario, bloqueos, médicos, insumos, correos |
| **Doctor** | Crear pacientes/solicitudes, ver calendario propio y horarios disponibles |

---

## Instalación local

```bash
# 1. Clonar y entrar al proyecto
git clone <url-del-repo> && cd clinica_unico

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.development .env.local
# Editar .env.local con tus credenciales de Supabase

# 4. Iniciar servidor de desarrollo
npm run dev       # http://localhost:5173
```

---

## Variables de entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | Sí |
| `VITE_SUPABASE_ANON_KEY` | Clave anon pública | Sí |
| `VITE_APP_ENV` | `development` o `production` | Sí |
| `VITE_SENTRY_DSN` | DSN de Sentry para error tracking | Solo producción |

---

## Base de datos

Ejecutar los scripts en `database/partes/` en orden:

```
parte_01_tipos.sql        — Tipos ENUM personalizados
parte_02_tablas.sql       — Tablas principales
parte_03_funciones.sql    — Triggers y funciones
parte_04_rls.sql          — Políticas de seguridad RLS
parte_05_vistas_rls.sql   — Vistas con security_invoker=true
parte_06_datos.sql        — Datos iniciales (pabellones, insumos)
```

### Crear usuario pabellón (inicial)

1. Supabase Dashboard → Authentication → Users → **Add user**
2. Copiar el UUID generado
3. Ejecutar:

```sql
INSERT INTO public.users (id, email, role)
VALUES ('UUID-AQUI', 'pabellon@tuclinica.cl', 'pabellon');
```

### Crear médicos

Usar **Pabellón → Médicos → Agregar médico** en la app. Invoca la Edge Function `create-doctor` que crea el usuario en Auth + el registro en `doctors` atomicamente.

---

## Edge Functions

| Función | Trigger | Descripción |
|---------|---------|-------------|
| `create-doctor` | Manual (UI) | Crea médico + usuario Auth |
| `delete-doctor` | Manual (UI) | Elimina médico y su cuenta Auth |
| `send-whatsapp` | Automático al confirmar/rechazar cirugía | Notifica doctor y paciente via Meta API |
| `poll-gmail` | Cron cada 5 min / Manual | Importa emails no leídos a `external_messages` |

```bash
# Deploy de funciones
npx supabase functions deploy send-whatsapp --no-verify-jwt
npx supabase functions deploy poll-gmail --no-verify-jwt
```

---

## Configurar WhatsApp

1. Crear app en [Meta for Developers](https://developers.facebook.com) → agregar producto WhatsApp Business
2. Obtener **Phone Number ID** y **Access Token** (permanente o de larga duración)
3. En la app: **Correos → Configurar WhatsApp** → ingresar credenciales

Las notificaciones se envían automáticamente al doctor y al paciente cuando pabellón confirma o rechaza una cirugía.

---

## Configurar Gmail

1. [Google Cloud Console](https://console.cloud.google.com) → habilitar Gmail API
2. Crear credenciales OAuth2 con redirect URI `http://localhost`
3. Visitar la URL de autorización → copiar el `code` del redirect
4. Intercambiar `code` por `refresh_token` via curl/Postman
5. En la app: **Correos → Configurar Gmail** → ingresar credenciales

> **Nota:** El refresh token expira en 7 días si la app OAuth está en modo "Testing". Para producción, publicar la app en Google Cloud Console → OAuth Consent Screen → Production.

---

## Flujo principal de trabajo

```
Doctor crea solicitud (paciente + código operación + horario preferido)
         ↓
Pabellón revisa solicitudes pendientes
         ↓
Pabellón acepta/rechaza → WhatsApp automático a doctor y paciente
         ↓
Pabellón programa cirugía (fecha, hora, pabellón)
         ↓
Notificación en tiempo real al doctor
```

---

## Scripts disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run preview  # Preview del build
npm run test     # Tests con Vitest
npm run lint     # ESLint
```

---

## Seguridad implementada

- RLS en todas las tablas — doctores solo ven sus propios datos
- Rate limiting: 5 intentos de login / 5 minutos (client-side + Supabase)
- Sanitización de inputs en todos los formularios
- Validación RUT chileno (formato + dígito verificador)
- Credenciales Gmail/WhatsApp solo accesibles via `service_role` en Edge Functions
- Vistas con `security_invoker = true` (respetan RLS)
- Funciones DB con `search_path = ''` fijo (evita inyección por schema)
- Passwords generados con `crypto.getRandomValues` (CSPRNG)

---

## Estructura del proyecto

```
src/
  __tests__/          — Tests unitarios (Vitest)
  components/
    common/           — Modal, Button, LoadingSpinner, etc.
  contexts/           — ThemeContext
  hooks/              — useNotifications, useDebounce, useRealtimeNotifications
  layouts/            — PabellonLayout, DoctorLayout (lazy loaded)
  pages/
    auth/             — Login, recuperar/restablecer contraseña
    doctor/           — Dashboard, CrearPaciente, Solicitudes, Calendario, Horarios
    pabellon/         — Dashboard, Solicitudes, Calendario, Bloqueo, Médicos, Insumos, Correos, Auditoría
    public/           — ContactoExterno (/contacto)
  utils/
    sanitizeInput.js  — Sanitización XSS/SQLi para todos los formularios
    rutFormatter.js   — Validación RUT chileno
    rateLimiter.js    — Rate limiting client-side para login
    logger.js         — Logger con niveles (no expone info sensible en prod)
database/
  partes/             — Scripts SQL por etapas (ejecutar en orden)
  add_whatsapp_support.sql
supabase/
  functions/          — Edge Functions Deno
    create-doctor/
    delete-doctor/
    send-whatsapp/
    poll-gmail/
.github/
  workflows/
    ci.yml            — CI: build + tests en cada push
```

---

## Solución de problemas frecuentes

| Error | Causa | Solución |
|-------|-------|----------|
| `RLS policy violation` | Usuario sin rol asignado | Verificar registro en `public.users` |
| `invalid_grant` en Gmail | Refresh token expirado | Re-autorizar siguiendo sección Gmail |
| WhatsApp no envía | Credenciales no configuradas | Configurar en Correos → Configurar WhatsApp |
| Build falla | Dependencias desactualizadas | `rm -rf node_modules && npm install` |
| Login bloqueado | Demasiados intentos fallidos | Esperar el tiempo indicado o limpiar localStorage |

---

## Licencia

Proyecto privado — uso exclusivo de la clínica propietaria.

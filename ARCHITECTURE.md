# Arquitectura — QuirúrgicaPro

Sistema SaaS de gestión quirúrgica para clínicas privadas. Permite a médicos reservar pabellones y a personal de pabellón gestionar la agenda operatoria.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite 6 + Tailwind CSS |
| Routing | React Router v6 |
| Estado servidor | TanStack Query (React Query) |
| Autenticación | Supabase Auth (JWT) |
| Base de datos | Supabase PostgreSQL + RLS |
| Edge Functions | Deno + TypeScript (Supabase) |
| Email | Gmail OAuth2 (edge function) |
| Iconos | Lucide React |
| Hosting | Cloudflare Pages |
| CI/CD | GitHub Actions |
| Error tracking | Sentry |

---

## Estructura de carpetas

```
src/
├── pages/
│   ├── public/          # Landing, 404, Contacto, Política
│   ├── auth/            # Login, Recuperar/Restablecer contraseña
│   ├── pabellon/        # Portal del personal de pabellón
│   └── doctor/          # Portal del médico
├── components/
│   ├── common/          # Button, Modal, Spinner, Skeleton, Pagination…
│   ├── charts/          # OcupacionChart
│   ├── CalendarioPabellonesGrid.jsx
│   └── SearchableSelect.jsx
├── layouts/
│   ├── BaseLayout.jsx   # Shell principal (sidebar, notificaciones, tema)
│   ├── PabellonLayout.jsx
│   └── DoctorLayout.jsx
├── hooks/
│   ├── useNotifications.js
│   ├── useRealtimeNotifications.js
│   └── useUnreadNotifications.js
├── contexts/
│   └── ThemeContext.jsx  # light | dark | medical
├── config/
│   ├── supabase.js
│   └── sentry.js
├── utils/
│   ├── rutFormatter.js
│   ├── sanitizeInput.js
│   ├── rateLimiter.js
│   ├── sendEmail.js
│   ├── exportData.js
│   └── logger.js
└── data/
    └── codigosOperaciones.js  # Códigos FONASA

supabase/functions/
├── send-email/          # Envío via Gmail OAuth
├── poll-gmail/          # Lectura de Gmail
├── send-whatsapp/       # Notificaciones WhatsApp
├── create-doctor/
├── delete-doctor/
├── delete-user/
└── update-doctor-password/
```

---

## Módulos principales

### Portal Pabellón (`/pabellon/*`)

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/pabellon` | `Dashboard.jsx` | KPIs, solicitudes recientes, gráfico ocupación |
| `/pabellon/solicitudes` | `Solicitudes.jsx` | Gestión completa de solicitudes quirúrgicas |
| `/pabellon/calendario` | `Calendario.jsx` | Agenda visual de pabellones por día |
| `/pabellon/bloqueo` | `BloqueoHorario.jsx` | Bloquear rangos horarios en pabellones |
| `/pabellon/medicos` | `Medicos.jsx` | CRUD de médicos + gestión de cuentas |
| `/pabellon/insumos` | `Insumos.jsx` | Inventario de insumos quirúrgicos |
| `/pabellon/correos` | `Correos.jsx` | Bandeja de correos externos (Gmail) |
| `/pabellon/auditoria` | `Auditoria.jsx` | Log de actividad del sistema |

### Portal Médico (`/doctor/*`)

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/doctor` | `Dashboard.jsx` | Resumen de solicitudes propias |
| `/doctor/paciente` | `CrearPaciente.jsx` | Reservar hora quirúrgica (crear solicitud) |
| `/doctor/solicitudes` | `Solicitudes.jsx` | Historial y estado de mis solicitudes |
| `/doctor/horarios` | `HorariosDisponibles.jsx` | Ver disponibilidad de pabellones |
| `/doctor/calendario` | `Calendario.jsx` | Mi agenda personal |

---

## Flujo de autenticación

```
Usuario → /acceso → Elige rol
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
  /login/pabellon          /login/doctor
          │                       │
  supabase.auth.signIn     supabase.auth.signIn
          │                       │
          └───────────┬───────────┘
                      ▼
          App.jsx valida sesión
          → consulta tabla users (rol)
          → redirige a /pabellon o /doctor
```

**Rate limiting:** 5 intentos fallidos → bloqueo 15 min (client-side, `rateLimiter.js`)

---

## Flujo de solicitud quirúrgica

```
Médico crea solicitud (CrearPaciente.jsx)
    │  inserta en surgery_requests
    │  + surgery_request_supplies
    ▼
Notificación automática → pabellón
    │  (tabla notifications + Supabase Realtime)
    ▼
Pabellón revisa (Solicitudes.jsx)
    │  confirma / rechaza / solicita cambios
    ▼
Notificación → médico
    │  (email opcional via send-email edge function)
    ▼
Confirmada → aparece en Calendario
```

---

## Base de datos (tablas principales)

| Tabla | Descripción |
|-------|-------------|
| `users` | Usuarios del sistema (rol: doctor \| pabellon) |
| `doctors` | Perfil del médico (estado: activo \| vacaciones) |
| `patients` | Fichas de pacientes |
| `surgery_requests` | Solicitudes quirúrgicas |
| `surgery_request_supplies` | Insumos por solicitud |
| `operating_rooms` | Pabellones disponibles |
| `supplies` | Catálogo de insumos |
| `operation_supply_packs` | Packs de insumos por código operación |
| `notifications` | Notificaciones en tiempo real |
| `clinic_settings` | Configuración global (JSONB key-value) |
| `blocked_slots` | Horarios bloqueados en pabellones |
| `audit_logs` | Log de auditoría |

Todas las tablas tienen **RLS (Row Level Security)** habilitado en Supabase.

---

## Edge Functions

### `send-email`
- **Trigger:** POST desde frontend vía `supabase.functions.invoke`
- **Body:** `{ to, subject, html, text? }`
- **Credenciales:** Gmail OAuth2 almacenadas en `clinic_settings.gmail_config`
- **Scopes requeridos:** `https://mail.google.com/`

### `poll-gmail`
- **Trigger:** Cron o llamada manual
- **Propósito:** Leer correos entrantes y guardarlos en la BD

### `send-whatsapp`
- **Trigger:** POST desde frontend
- **Propósito:** Notificar al paciente via WhatsApp

---

## Variables de entorno

| Variable | Dónde | Descripción |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | Frontend | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Clave pública anon |
| `VITE_SENTRY_DSN` | Frontend | DSN de Sentry (opcional) |
| `VITE_APP_ENV` | Frontend | `development` \| `production` \| `test` |

Las variables de entorno para Edge Functions se configuran en el dashboard de Supabase.

---

## CI/CD

```
push a main / PR
    ↓
GitHub Actions (ci.yml)
    ├── npm ci
    ├── eslint
    ├── vitest (85 tests)
    └── vite build
         ↓ (solo main, si todo pasa)
Cloudflare Pages (auto-deploy)
    └── clinica-unico.pages.dev
```

---

## Decisiones de diseño

- **Sin Redux:** TanStack Query maneja todo el estado del servidor. Estado local con useState.
- **RLS en Supabase:** Seguridad a nivel de base de datos, no solo en el frontend.
- **Edge Functions para email:** Evita exponer credenciales OAuth en el cliente.
- **Rate limiting client-side:** Primera línea de defensa; el servidor (Supabase) tiene sus propios límites.
- **Code splitting:** Vite divide el bundle por ruta (lazy loading automático).

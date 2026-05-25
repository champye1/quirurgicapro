# Changelog

Todos los cambios notables de QuirúrgicaPro se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/) y el proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

---

## [Unreleased]

### Added
- PWA (Progressive Web App): manifiesto, service worker con Workbox, íconos 192×512 px y meta tags iOS
- Tests E2E con Playwright para flujos críticos: login pabellón, login doctor, páginas públicas
- `CHANGELOG.md` con historial completo de versiones

---

## [1.4.0] — 2026-05-24

### Added
- `.env.example` con documentación de las cuatro variables de entorno requeridas
- Tests unitarios (Vitest + Testing Library) para las 12 páginas sin cobertura: `LoginDoctor`, `Auditoria`, `BloqueoHorario`, `CalendarioPabellon`, `Correos`, `Medicos`, `Insumos`, `SolicitudesPabellon`, `DashboardDoctor`, `HorariosDisponibles`, `SolicitudesDoctor`, `CalendarioDoctor`
- Manual de usuario para pabellón (`docs/manual_pabellon.md`) con 9 capturas de pantalla integradas
- Manual de usuario para médicos (`docs/manual_doctor.md`) con 7 capturas de pantalla integradas
- PDFs de los manuales en formato APA (portada, jerarquía de encabezados, figuras numeradas)

### Removed
- `docs/MANUAL_USUARIO.md` — manual genérico desactualizado reemplazado por los manuales por rol
- `vercel.json` — configuración estale; el deploy real es en Cloudflare Pages

---

## [1.3.0] — 2026-05-23

### Fixed
- Hardening de handlers de Realtime; reemplazados todos los `console.*` por el logger centralizado
- Eliminado código muerto identificado por análisis multi-archivo
- Corregidos los 53 warnings de ESLint; añadido favicon SVG; división de bundles por vendor

### Added
- `send-email` Edge Function en Supabase para notificaciones por correo
- Configuración de Sentry DSN mediante variable de entorno

---

## [1.2.0] — 2026-05-19

### Added
- Arquitectura desplegada en Cloudflare Pages con `public/_headers` (CSP, HSTS, X-Frame-Options)
- `public/_redirects` para ruteo SPA
- Tests de integración iniciales
- GitHub Actions CI/CD (lint + test en cada push)
- `LandingPage` y `PoliticaPrivacidad` con ruteo público
- Formulario de contacto externo (`ContactoExterno`) con validación y sanitización
- Funciones RPC en Supabase para agendamiento de cirugías y verificación de disponibilidad

### Fixed
- Fijado `esbuild@0.28.0` vía overrides; target de build cambiado a `esnext`
- Actualización a Vite 6 y Node 22
- Configuración de ESLint y corrección de errores de linting en CI

---

## [1.1.0] — 2026-05-10

### Added
- Página 404 personalizada
- Página de precios
- Layout unificado para pabellón y doctor
- Opción para cancelar solicitudes desde el panel del doctor
- Manejo de expiración de sesión con feedback al usuario
- Bloqueo de cuentas y detección de estado de vacaciones en `LoginDoctor`
- Opciones de horarios preferidos en `CrearPaciente`
- Ruta `/doctor/horarios` con vista de disponibilidad de pabellones
- Función SQL para liberar bloqueos de horario caducados

### Changed
- `CrearPaciente`: vista consolidada de horarios seleccionados; `dejar_fecha_a_pabellon` por defecto en `true`
- `Insumos`: validación de códigos únicos mejorada; campo `dias_limite_vigencia` en lugar de `vigencia_hasta`
- `Dashboard`: métricas reducidas a 3 tarjetas; lógica de recordatorios con mutación dedicada

### Fixed
- `global` reemplazado por `globalThis` para corregir error ESLint `no-undef`
- Parcheadas 7 vulnerabilidades npm; nivel de auditoría ajustado para xlsx

---

## [1.0.0] — 2026-04-15

### Added
- Sistema de gestión quirúrgica completo para clínicas privadas
- Módulo pabellón: Dashboard, Calendario, Solicitudes, Médicos, Insumos, Correos, Auditoría, Bloqueo de horario
- Módulo doctor: Dashboard, Crear Solicitud, Mis Solicitudes, Calendario, Horarios Disponibles
- Autenticación con Supabase Auth (pabellón y doctor con flujos separados)
- Recuperación y restablecimiento de contraseña
- Triggers de auditoría en base de datos
- Gestión de insumos con validación de códigos FONASA
- Polling de Gmail para correos de contacto externo
- Diseño responsivo con modo oscuro (ThemeContext)
- Notificaciones en tiempo real con Supabase Realtime

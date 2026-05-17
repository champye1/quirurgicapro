# Manual de Usuario — QuirúrgicaPro

**Versión 1.0 · Mayo 2026**

---

## ¿Qué es QuirúrgicaPro?

QuirúrgicaPro es un sistema web para gestionar la agenda quirúrgica de clínicas dentales.
Permite coordinar solicitudes de cirugía entre médicos y el equipo de pabellón, controlar el
inventario de insumos y registrar cada acción para auditoría.

Hay dos tipos de usuario: **Pabellón** y **Médico (Doctor)**.

---

## Cómo ingresar al sistema

1. Abre el navegador y ve a la URL de tu clínica (ej: `https://tuclinica.quirurgicapro.cl`).
2. Haz clic en **Ingresar** en la barra superior.
3. Selecciona tu tipo de acceso: **Pabellón** o **Médico**.
4. Ingresa tu correo electrónico y contraseña.
5. Si olvidaste tu contraseña, haz clic en **¿Olvidaste tu contraseña?** y sigue las instrucciones.

> **Tip:** El sistema cierra la sesión automáticamente después de inactividad prolongada.

---

## Portal del Médico

### Panel principal (Dashboard)

Al ingresar verás un resumen con:
- Tus **cirugías del día** programadas.
- Tus **solicitudes pendientes** de respuesta.
- Historial reciente de solicitudes aceptadas o rechazadas.

---

### Crear una solicitud de cirugía

**Ruta:** Menú → *Reservar / Nueva Solicitud*

1. Completa el formulario:
   - **Paciente**: nombre, apellido, RUT y fecha de nacimiento.
   - **Código de operación**: busca el código Fonasa del procedimiento.
   - **Fecha preferida** (opcional): puedes indicar una fecha y horario sugerido.
   - **Observaciones** (opcional): cualquier indicación especial para pabellón.
   - **Insumos**: agrega los materiales que vas a necesitar.
2. Haz clic en **Enviar Solicitud**.
3. Recibirás una notificación cuando pabellón acepte o rechace tu solicitud.

> **Tip:** Usa el botón **Ver Horarios Disponibles** para ver el calendario de pabellón antes de elegir fecha.

---

### Ver y editar mis solicitudes

**Ruta:** Menú → *Mis Solicitudes*

Aquí puedes ver todas tus solicitudes con su estado:

| Estado | Significado |
|--------|------------|
| **Pendiente** | Esperando respuesta de pabellón |
| **Aceptada** | Pabellón aceptó y está agendando |
| **Rechazada** | Pabellón no pudo agendar (ver motivo) |
| **Cancelada** | Solicitud cancelada por el médico |

**Editar una solicitud pendiente:**
1. Haz clic en el botón **Editar** (azul) en la tarjeta de la solicitud.
2. Modifica los datos y haz clic en **Guardar Cambios**.
> Solo se pueden editar solicitudes en estado **Pendiente**.

**Cancelar una solicitud pendiente:**
1. Haz clic en **Cancelar** (rojo) en la tarjeta.
2. Confirma la acción en el diálogo.
> Esta acción no se puede deshacer.

**Solicitar reagendamiento:**
Si tu cirugía ya fue aceptada pero necesitas cambiar la fecha, haz clic en **Reagendar**.
Pabellón recibirá una notificación y coordinará contigo.

---

### Ver horarios disponibles

**Ruta:** Menú → *Horarios Disponibles*

Muestra el calendario de pabellones con todos los slots libres y ocupados.
- **Verde**: slot libre, puedes seleccionarlo.
- **Gris / Rojo**: ocupado o bloqueado.

Al hacer clic en un slot libre se abre el formulario de nueva solicitud pre-llenado con esa fecha y hora.

---

### Mi calendario

**Ruta:** Menú → *Mi Calendario*

Vista anual, mensual, semanal y diaria de todas tus cirugías programadas.
Desde la vista diaria puedes ver los detalles de cada cirugía y, si está programada, cancelarla.

---

## Portal de Pabellón

### Panel principal (Dashboard)

Al ingresar verás:
- Cirugías **programadas para hoy**.
- Solicitudes **pendientes** de revisión.
- Ocupación de pabellones en tiempo real.
- Insumos con **stock bajo** (alerta visual).

---

### Gestionar solicitudes

**Ruta:** Menú → *Solicitudes*

Lista todas las solicitudes recibidas. Puedes filtrar por estado.

**Para programar una cirugía:**
1. Haz clic en el ícono de ojo para ver el detalle de la solicitud.
2. Haz clic en **Programar**.
3. Selecciona el pabellón, fecha, hora de inicio y hora de fin.
4. Haz clic en **Confirmar programación**.

El sistema automáticamente:
- Crea la entrada en el calendario.
- Descuenta los insumos del stock.
- Notifica al médico.

**Para rechazar una solicitud:**
1. Abre el detalle de la solicitud.
2. Haz clic en **Rechazar** e ingresa el motivo.

---

### Calendario de pabellones

**Ruta:** Menú → *Calendario*

Vista completa de todos los pabellones con sus cirugías programadas.
Puedes navegar por semanas y días, ver conflictos y gestionar bloqueos.

---

### Bloquear horarios

**Ruta:** Menú → *Bloqueo de Horarios*

Permite marcar un rango de horas en un pabellón como no disponible (limpieza, mantención, etc.).
Los slots bloqueados aparecen en gris en el calendario y no pueden ser asignados.

---

### Gestión de médicos

**Ruta:** Menú → *Médicos*

Aquí puedes:
- Ver todos los médicos registrados y su estado.
- **Crear un nuevo médico**: completa nombre, RUT, especialidad y correo. El sistema crea automáticamente su cuenta de acceso y genera una contraseña segura.
- **Activar / Desactivar acceso web** de un médico.
- **Exportar** la lista a CSV o Excel.

---

### Control de insumos

**Ruta:** Menú → *Insumos*

Lista todos los materiales con su stock actual.
- El stock se descuenta **automáticamente** al programar una cirugía.
- Los insumos con stock **por debajo del mínimo** aparecen destacados en rojo.
- Puedes editar el stock, precio y stock mínimo de cada insumo.

---

### Correos / Mensajes externos

**Ruta:** Menú → *Correos*

Si tienes Gmail configurado, aquí aparecen los mensajes entrantes del formulario de contacto
externo. Puedes configurar la integración con Gmail en esta misma sección.

---

### Auditoría

**Ruta:** Menú → *Auditoría*

Registro completo de todas las acciones realizadas en el sistema:
quién hizo qué, cuándo y desde qué IP. Útil para cumplimiento normativo.

---

## Notificaciones

El sistema envía notificaciones automáticas:
- Al **médico**: cuando su solicitud es aceptada, rechazada o reagendada.
- Al **pabellón**: cuando un médico solicita reagendamiento.

Las notificaciones aparecen en el **ícono de campana** en la barra superior.
Haz clic en una notificación para ir directamente a la solicitud o cirugía relacionada.

---

## Cambiar contraseña

1. Ve al ícono de usuario (esquina superior derecha) → **Configuración**.
2. Selecciona **Cambiar contraseña**.
3. Ingresa tu contraseña actual y la nueva.

---

## Soporte

Si tienes problemas técnicos o dudas, contacta a soporte a través del formulario en
la página principal o escribe a **soporte@quirurgicapro.cl**.

---

*© 2026 QuirúrgicaPro — Todos los derechos reservados.*

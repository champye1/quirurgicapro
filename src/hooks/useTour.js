import { useCallback } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

export function useTour() {
  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Siguiente →',
      prevBtnText: '← Anterior',
      doneBtnText: '¡Listo!',
      progressText: 'Paso {{current}} de {{total}}',
      smoothScroll: true,
      overlayColor: 'rgba(0, 0, 0, 0.75)',
      popoverClass: 'quirurgicapro-tour',
      steps: [
        {
          popover: {
            title: 'Bienvenido a QuirúrgicaPro',
            description: 'Este recorrido de 2 minutos te mostrará las funciones clave del sistema. Puedes saltar con la X en cualquier momento.',
            side: 'over',
            align: 'center',
          },
        },
        {
          element: '#tour-sidebar-nav',
          popover: {
            title: 'Menú de navegación',
            description: 'Accede a todas las secciones desde aquí: Solicitudes, Calendario, Médicos, Insumos, Estadísticas y más.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '#tour-metricas',
          popover: {
            title: 'Métricas del día',
            description: 'De un vistazo: solicitudes pendientes de revisión, cirugías programadas para hoy y porcentaje de ocupación de pabellones.',
            side: 'bottom',
            align: 'center',
          },
        },
        {
          element: '#ocupacion-semanal',
          popover: {
            title: 'Gráfico de ocupación',
            description: 'Visualiza el uso de pabellones por día. Filtra por pabellón individual o ve el total. Detecta tendencias para optimizar la agenda.',
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '#tour-solicitudes-card',
          popover: {
            title: 'Solicitudes de cirugía',
            description: 'Los médicos envían sus solicitudes desde su portal. Aquí las ves, programas, rechazas o solicitas más información antes de confirmar.',
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '#tour-recordatorios-card',
          popover: {
            title: 'Muro de recordatorios',
            description: 'Anotaciones rápidas visibles solo para el equipo de pabellón. Ideal para coordinaciones internas sin salir del panel.',
            side: 'top',
            align: 'end',
          },
        },
        {
          element: '#tour-header-notifications',
          popover: {
            title: 'Notificaciones en tiempo real',
            description: 'Alertas instantáneas cuando llega una nueva solicitud, se reagenda una cirugía o hay un mensaje de un médico.',
            side: 'bottom',
            align: 'end',
          },
        },
        {
          element: '#tour-header-search',
          popover: {
            title: 'Búsqueda global (Ctrl+K)',
            description: 'Encuentra pacientes, médicos o cirugías desde cualquier sección del sistema con el atajo de teclado.',
            side: 'bottom',
            align: 'end',
          },
        },
        {
          popover: {
            title: '¡Todo listo!',
            description: 'Ya conoces las funciones principales de QuirúrgicaPro. Si tienes dudas, visita la sección <b>Ayuda</b> en el menú lateral o contáctanos.',
            side: 'over',
            align: 'center',
          },
        },
      ],
    })

    driverObj.drive()
  }, [])

  return { startTour }
}

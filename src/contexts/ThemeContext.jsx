import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const THEMES = {
  light: {
    name: 'Claro',
    description: 'Tema claro estándar',
  },
  dark: {
    name: 'Oscuro',
    description: 'Tema oscuro blanco y negro',
  },
  medical: {
    name: 'Médico',
    description: 'Tema clínico con colores médicos',
  }
}

const ThemeContext = createContext()

// Función para aplicar el tema inmediatamente al DOM (fuera del componente para evitar dependencias)
const applyThemeToDOM = (themeName) => {
  if (typeof document === 'undefined') return
  
  // Aplicar al documento inmediatamente
  document.documentElement.setAttribute('data-theme', themeName)
  
  // Limpiar clases anteriores
  document.body.className = document.body.className.replace(/theme-\w+/g, '')
  document.body.classList.add(`theme-${themeName}`)
  
  // Aplicar estilos directamente sin esperar al useEffect
  if (themeName === 'dark') {
    document.body.style.backgroundColor = '#0f172a'
    document.body.style.color = '#ffffff'
    document.documentElement.style.backgroundColor = '#0f172a'
  } else if (themeName === 'medical') {
    document.body.style.backgroundColor = '#f8fafc'
    document.body.style.color = '#0f172a'
    document.documentElement.style.backgroundColor = '#f8fafc'
  } else {
    document.body.style.backgroundColor = '#f8fafc'
    document.body.style.color = '#0f172a'
    document.documentElement.style.backgroundColor = '#f8fafc'
  }
  
  // Guardar en localStorage inmediatamente
  try { localStorage.setItem('app-theme', themeName) } catch (_) { /* test env */ }
  
  // Forzar reflow para aplicar cambios inmediatamente
  void document.body.offsetHeight
}

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('app-theme')
      const initialTheme = savedTheme && THEMES[savedTheme] ? savedTheme : 'light'
      // Aplicar tema inicial inmediatamente al cargar
      if (typeof document !== 'undefined') {
        applyThemeToDOM(initialTheme)
      }
      return initialTheme
    } catch (e) {
      return 'light'
    }
  })

  // Aplicar tema cuando cambia el estado (backup)
  useEffect(() => {
    applyThemeToDOM(theme)
  }, [theme])

  const changeTheme = useCallback((newTheme) => {
    if (THEMES[newTheme] && newTheme !== theme) {
      // Aplicar inmediatamente al DOM ANTES de actualizar el estado
      applyThemeToDOM(newTheme)
      
      // Actualizar estado inmediatamente para re-renderizar componentes
      // No usar setTimeout, actualizar directamente para respuesta instantánea
      setThemeState(newTheme)
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, themes: THEMES, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

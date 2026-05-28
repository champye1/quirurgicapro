import { test, expect } from '@playwright/test'

test.describe('Páginas públicas', () => {
  test('la ruta raíz carga la landing page sin errores JS', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Root shows a public landing page for unauthenticated users (no redirect)
    await expect(page).toHaveURL('http://localhost:5173/')
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0)
  })

  test('login de pabellón carga sin errores JS', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/login/pabellon')
    await page.waitForLoadState('networkidle')
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0)
  })

  test('login de doctor carga sin errores JS', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/login/doctor')
    await page.waitForLoadState('networkidle')
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0)
  })

  test('recuperar contraseña carga sin errores JS', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/recuperar-contrasena')
    await page.waitForLoadState('networkidle')
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0)
  })
})

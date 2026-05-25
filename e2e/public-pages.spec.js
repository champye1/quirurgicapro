import { test, expect } from '@playwright/test'

test.describe('Páginas públicas', () => {
  test('la ruta raíz redirige a login', async ({ page }) => {
    await page.goto('/')
    // App should redirect unauthenticated users to a login page
    await expect(page).toHaveURL(/login/, { timeout: 5000 })
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

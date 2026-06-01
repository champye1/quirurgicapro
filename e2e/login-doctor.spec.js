import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers/mockSupabase.js'

test.describe('Login doctor', () => {
  test('muestra el formulario de login', async ({ page }) => {
    await page.goto('/login/doctor')
    // LoginDoctor uses type="text" for the email field
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('el botón de submit está presente', async ({ page }) => {
    await page.goto('/login/doctor')
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('muestra error con credenciales inválidas', async ({ page }) => {
    await mockAuth(page, { fail: true })
    await page.goto('/login/doctor')

    await page.fill('#email', process.env.E2E_DOCTOR_EMAIL_INVALID ?? 'doctor@falso.com')
    await page.fill('input[type="password"]', process.env.E2E_PASSWORD_INVALID ?? 'wrongpass')
    await page.click('button[type="submit"]')

    await expect(
      page.getByText(/credencial|inválid|incorrect|error/i)
    ).toBeVisible({ timeout: 5000 })
  })

  test('redirige al dashboard doctor tras login exitoso', async ({ page }) => {
    await mockAuth(page, { email: 'doctor@test.com' })
    // catch-all first (lowest priority in LIFO)
    await page.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    // specific table mocks registered last = higher priority
    await page.route('**/rest/v1/users**', r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'mock-user-id', role: 'doctor' }]),
    }))
    await page.route('**/rest/v1/doctors**', r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'mock-doctor-id', user_id: 'mock-user-id', acceso_web_enabled: true, estado: 'activo' }]),
    }))
    await page.route('**/auth/v1/user**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'u2', email: 'doctor@test.com' }) })
    )

    await page.goto('/login/doctor')
    await page.fill('#email', 'doctor@test.com')
    await page.fill('input[type="password"]', 'cualquierpass')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/doctor|dashboard/i, { timeout: 15000 })
  })
})

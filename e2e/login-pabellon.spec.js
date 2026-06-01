import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers/mockSupabase.js'

test.describe('Login pabellón', () => {
  test('muestra el formulario de login', async ({ page }) => {
    await page.goto('/login/pabellon')
    await expect(page.locator('input[type="email"], input#email')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('muestra error con credenciales inválidas', async ({ page }) => {
    await mockAuth(page, { fail: true })
    await page.goto('/login/pabellon')

    await page.fill('input[type="email"], input#email', process.env.E2E_PABELLON_EMAIL_INVALID ?? 'malo@ejemplo.com')
    await page.fill('input[type="password"]', process.env.E2E_PASSWORD_INVALID ?? 'wrongpass')
    await page.click('button[type="submit"]')

    await expect(
      page.getByText(/credencial|inválid|incorrect|error/i)
    ).toBeVisible({ timeout: 5000 })
  })

  test('redirige al dashboard tras login exitoso', async ({ page }) => {
    await mockAuth(page)
    // catch-all first (lowest priority in LIFO)
    await page.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    // users table: return pabellon role (registered last = highest priority)
    await page.route('**/rest/v1/users**', r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'mock-user-id', role: 'pabellon' }]),
    }))
    await page.route('**/auth/v1/user**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'u1', email: 'pabellon@test.com' }) })
    )

    await page.goto('/login/pabellon')
    await page.fill('input[type="email"], input#email', 'pabellon@test.com')
    await page.fill('input[type="password"]', 'cualquierpass')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/pabellon|dashboard/i, { timeout: 15000 })
  })
})

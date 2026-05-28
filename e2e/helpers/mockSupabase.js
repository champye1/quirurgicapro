/**
 * Intercept Supabase API calls so E2E tests run without a real backend.
 */

const SESSION = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'mock-user-id',
    email: 'pabellon@test.com',
    role: 'authenticated',
    aud: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
}

export async function mockAuth(page, { email = 'pabellon@test.com', fail = false } = {}) {
  await page.route('**/auth/v1/token**', async route => {
    if (fail) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...SESSION, user: { ...SESSION.user, email } }),
      })
    }
  })
}

export async function mockSupabaseDb(page, tableResponses = {}) {
  await page.route('**/rest/v1/**', async route => {
    const url = route.request().url()
    const table = Object.keys(tableResponses).find(t => url.includes(t))
    const data = table ? tableResponses[table] : []
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(Array.isArray(data) ? data : [data]),
    })
  })

  // supabase getUser call via auth
  await page.route('**/auth/v1/user**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SESSION.user),
    })
  })
}

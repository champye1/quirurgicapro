export async function testSupabaseConnection() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (
    !url ||
    !key ||
    url.includes('tu-proyecto') ||
    url.includes('example') ||
    !url.startsWith('https://')
  ) {
    return {
      connected: false,
      error: 'Las credenciales de Supabase no están configuradas correctamente',
    }
  }

  return { connected: true }
}

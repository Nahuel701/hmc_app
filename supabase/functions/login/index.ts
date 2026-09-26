import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/http.ts'

const url = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  try {
    const { username, password } = await req.json()
    const db = createClient(url, serviceKey)
    const { data, error } = await db.from('app_users').select('email').eq('username', String(username || '').trim()).maybeSingle()
    if (error || !data?.email) return jsonResponse({ error: 'Usuario o contraseña incorrectos' }, 401)
    const auth = createClient(url, anonKey)
    const result = await auth.auth.signInWithPassword({ email: data.email, password: String(password || '') })
    if (result.error || !result.data.session) return jsonResponse({ error: 'Usuario o contraseña incorrectos' }, 401)
    return jsonResponse({ session: result.data.session, user: result.data.user })
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: 'No se pudo iniciar sesión' }, 400)
  }
})

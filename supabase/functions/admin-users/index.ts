// Supabase Edge Function: admin-users
// The ONLY place the service-role key is used. It runs on Supabase's servers,
// never in the browser. Every request is checked: the caller must be signed in
// AND have role 'owner' or 'admin' before any user is created or deleted.
//
// Deploy: Supabase dashboard → Edge Functions → Deploy a new function named
// "admin-users", paste this file. SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY are provided automatically — no secrets to set.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Identify the caller from their JWT.
  const authHeader = req.headers.get('Authorization') ?? ''
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
  } = await caller.auth.getUser()
  if (!user) return json({ error: 'Not signed in.' }, 401)

  const admin = createClient(url, serviceKey)

  // Authorize: caller must be owner/admin.
  const { data: me } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!me || (me.role !== 'owner' && me.role !== 'admin')) {
    return json({ error: 'You are not an admin.' }, 403)
  }

  let payload: Record<string, string> = {}
  try {
    payload = await req.json()
  } catch {
    /* no body */
  }
  const { action, email, password, role, userId } = payload

  if (action === 'list') {
    const { data, error } = await admin.auth.admin.listUsers()
    if (error) return json({ error: error.message }, 400)
    const { data: profiles } = await admin.from('profiles').select('id, role')
    const roleById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.role]))
    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      role: roleById[u.id] ?? 'member',
    }))
    return json({ users })
  }

  if (action === 'create') {
    if (!email || !password) return json({ error: 'Email and password required.' }, 400)
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // let them sign in immediately, no verification email
    })
    if (error) return json({ error: error.message }, 400)
    if (role && role !== 'member') {
      await admin.from('profiles').update({ role }).eq('id', data.user.id)
    }
    return json({ ok: true, id: data.user.id })
  }

  if (action === 'delete') {
    if (!userId) return json({ error: 'userId required.' }, 400)
    if (userId === user.id) return json({ error: "You can't delete your own account." }, 400)
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  if (action === 'setRole') {
    if (!userId || !role) return json({ error: 'userId and role required.' }, 400)
    if (userId === user.id) return json({ error: "You can't change your own role." }, 400)
    const { error } = await admin.from('profiles').update({ role }).eq('id', userId)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  return json({ error: 'Unknown action.' }, 400)
})

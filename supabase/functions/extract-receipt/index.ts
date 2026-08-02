// Supabase Edge Function: extract-receipt
// Reads a receipt photo with Google Gemini vision and returns structured expense
// fields (date, vendor, TIN, net/VAT/total, category). Owner/admin only — same
// access as the Expenses tab. The image is NEVER stored: it's sent to the model
// for this one request and discarded.
//
// ── ONE-TIME SETUP ──────────────────────────────────────────────────────────
//   1. Get a free Gemini API key:  https://aistudio.google.com/apikey
//   2. Set it as a secret:
//        supabase secrets set GEMINI_API_KEY=your_key_here
//      (or Dashboard → Edge Functions → Manage secrets → add GEMINI_API_KEY)
//   3. Deploy:
//        supabase functions deploy extract-receipt
//      (or Dashboard → Edge Functions → Deploy a new function named
//       "extract-receipt" and paste this file)
//
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided
//   automatically. Optionally set GEMINI_MODEL to override the default model.
// ────────────────────────────────────────────────────────────────────────────

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

const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'

const PROMPT = `You are reading a Philippine sales invoice or official receipt (OR) from a photo.
Extract these fields and return ONLY a JSON object (no markdown, no commentary):
{
  "expense_date": "YYYY-MM-DD or null",
  "vendor": "the seller/store business name, or null",
  "tin": "the seller's TIN as digits only (strip dashes/spaces), or null",
  "net_amount": number or null,
  "vat_amount": number or null,
  "total_amount": number or null,
  "category": "best guess from exactly this list, or null: Utilities, Rent, Fuel, Transportation, Supplies, Repairs & Maintenance, Communication, Professional Fees, Taxes & Licenses, Salaries & Wages, Miscellaneous"
}
Rules:
- Amounts are plain numbers only — no currency symbols, no thousands separators (e.g. 1234.56).
- net_amount = amount before VAT; vat_amount = the 12% VAT; total_amount = the grand total paid.
- If only a total is shown, fill total_amount and leave net_amount and vat_amount null.
- TIN must be digits only.
- If a field is not clearly visible, use null. Never invent amounts.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) {
    return json(
      { error: 'Receipt scanning isn’t set up yet. Add a GEMINI_API_KEY secret to this function.' },
      501,
    )
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Authenticate + authorize: owner/admin only, matching the Expenses tab.
  const authHeader = req.headers.get('Authorization') ?? ''
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user },
  } = await caller.auth.getUser()
  if (!user) return json({ error: 'Not signed in.' }, 401)

  const admin = createClient(url, serviceKey)
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!me || (me.role !== 'owner' && me.role !== 'admin')) {
    return json({ error: 'You are not an admin.' }, 403)
  }

  // Accept a data URL ("data:image/jpeg;base64,...") or raw base64.
  let body: { image?: string; mimeType?: string } = {}
  try {
    body = await req.json()
  } catch {
    /* no body */
  }
  const image = body.image || ''
  const m = image.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i)
  const mimeType = m ? m[1] : body.mimeType || 'image/jpeg'
  const b64 = m ? m[2] : image
  if (!b64) return json({ error: 'No image provided.' }, 400)

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiKey}`
  const geminiReq = {
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: b64 } }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  }

  let res: Response
  try {
    res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiReq),
    })
  } catch {
    return json({ error: 'Could not reach the vision service.' }, 502)
  }
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300)
    return json({ error: `Vision service error (${res.status}).`, detail }, 502)
  }

  const out = await res.json()
  const text = out?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  let fields: Record<string, unknown>
  try {
    fields = JSON.parse(text)
  } catch {
    return json({ error: 'Could not read the receipt clearly. Enter the details manually.' }, 502)
  }

  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

  return json({
    ok: true,
    fields: {
      expense_date:
        typeof fields.expense_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fields.expense_date)
          ? fields.expense_date
          : null,
      vendor: str(fields.vendor),
      tin: typeof fields.tin === 'string' ? fields.tin.replace(/\D/g, '') || null : null,
      net_amount: num(fields.net_amount),
      vat_amount: num(fields.vat_amount),
      total_amount: num(fields.total_amount),
      category: str(fields.category),
    },
  })
})

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Add them to your .env.local file.'
    )
  }
}

export async function sbFetch(path, opts = {}) {
  assertEnv()
  const { prefer, headers: extraHeaders, ...restOpts } = opts
  
  // In a real SaaS, we would get the JWT from the auth session
  // For now, we continue using anon key, but RLS will handle the user_id filtering
  // if the user is logged in via Supabase Auth.
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey:          SUPABASE_ANON_KEY,
      Authorization:   `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type':  'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
      ...extraHeaders,
    },
    ...restOpts,
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${errText}`)
  }
  const text = await res.text()
  try { return text ? JSON.parse(text) : null } catch { return null }
}

export async function uploadToStorage(path, file) {
  assertEnv()
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/branding/${path}`, {
    method: 'POST',
    headers: {
      apikey:        SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': file.type,
    },
    body: file,
  })
  if (!res.ok) throw new Error('Upload failed — check the branding bucket is public')
  return `${SUPABASE_URL}/storage/v1/object/public/branding/${path}`
}

export const fmt       = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const GST_RATE  = 0.05

export function debounce(fn, ms) {
  let t
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }
}

/** Load the current user's firm. In this SaaS model, one user = one firm. */
export async function loadUserFirm() {
  const d = await sbFetch(`/firms?select=*&limit=1`)
  return d?.[0] || null
}

/** Parse a CSV line correctly, handling quoted fields that may contain commas. */
export function parseCsvLine(line) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }   // escaped quote
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

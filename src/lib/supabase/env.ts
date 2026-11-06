export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** True once Supabase env vars are present. Without them the app runs on the bundled demo data. */
export const isLive = Boolean(SUPABASE_URL && SUPABASE_ANON)

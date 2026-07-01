import { createClient } from "@supabase/supabase-js"

// Credenciais fixas (hard-coded) conforme solicitado.
// A anon key é pública por design e pode ser exposta no client.
const SUPABASE_URL = "https://niaeoykspnnrihicwrgk.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pYWVveWtzcG5ucmloaWN3cmdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTM3MzgsImV4cCI6MjA5NTU2OTczOH0.nv2ffCZAexxxYE2pd5YRU2rGr1mn8sa_qX4uxewQaZ8"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // localStorage funciona melhor que cookies dentro de iframes onde
    // cookies de terceiros podem estar bloqueados.
    storageKey: "coringa_auth_session",
  },
})

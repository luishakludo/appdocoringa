"use client"

// Sessao simples do painel ADM, separada da sessao do app principal.
// Guardada em localStorage. Nao usar para seguranca real.

const KEY = "coringa_adm_session"

export type AdmSession = {
  id: string
  name: string
  email: string
  role: "supreme" | "admin"
}

export function getAdmSession(): AdmSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as AdmSession
  } catch {
    return null
  }
}

export function setAdmSession(session: AdmSession) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KEY, JSON.stringify(session))
}

export function clearAdmSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(KEY)
}

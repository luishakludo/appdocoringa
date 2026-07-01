"use client"

// Sessao simples do app principal (usuarios), espelhando a sessao do ADM.
// Guardada em localStorage. Nao usar para seguranca real.

const KEY = "coringa_user_session"

export type UserSession = {
  id: string
  admin_id: string
  name: string
  email: string
  phone: string
  avatarUrl?: string | null
  createdAt: string
}

export function getUserSession(): UserSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as UserSession
  } catch {
    return null
  }
}

export function setUserSession(session: UserSession) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KEY, JSON.stringify(session))
}

export function updateUserSession(patch: Partial<UserSession>) {
  const current = getUserSession()
  if (!current) return
  setUserSession({ ...current, ...patch })
}

export function clearUserSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(KEY)
}

"use client"

// Sessao de uma conta DEMO logada no app. Diferente da sessao Atlax: a conta
// demo nao tem token nem fala com a corretora. Guardamos o id do app_user, o
// saldo atual e o RTP (% de vitorias) definido pelo adm.

const KEY = "coringa_demo_session"
const HISTORY_KEY = "coringa_demo_history"

export type DemoSession = {
  appUserId: string
  adminId: string
  login: string // email da conta demo
  name: string // nome exibido no "Bem-vindo"
  rtp: number // 0-100
  balance: number // saldo atual em reais
}

export function getDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as DemoSession
  } catch {
    return null
  }
}

export function setDemoSession(session: DemoSession) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KEY, JSON.stringify(session))
}

export function updateDemoSession(patch: Partial<DemoSession>) {
  const current = getDemoSession()
  if (!current) return
  setDemoSession({ ...current, ...patch })
}

export function clearDemoSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(KEY)
  window.localStorage.removeItem(HISTORY_KEY)
  window.localStorage.removeItem("coringa_demo_run")
}

export function isDemoActive(): boolean {
  return getDemoSession() !== null
}

// ============================================================
// Historico local da conta demo (acumulado entre sessoes da IA)
// ============================================================

import type { AtlaxLocalTransaction } from "@/lib/atlax-session"

export function getDemoHistory(): AtlaxLocalTransaction[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as AtlaxLocalTransaction[]
  } catch {
    return []
  }
}

export function pushDemoHistory(op: AtlaxLocalTransaction) {
  if (typeof window === "undefined") return
  const current = getDemoHistory()
  const next = [op, ...current].slice(0, 100)
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
}

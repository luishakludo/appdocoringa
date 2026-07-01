"use client"

// Sessao de autenticacao da Atlax (token + dados do usuario da corretora).
// Guardada em localStorage no frontend, conforme a documentacao de integracao.

const KEY = "atlax_auth"

export type AtlaxUser = {
  id: number
  login: string
  name: string
  credit: string
}

export type AtlaxSession = {
  token: string
  user: AtlaxUser
}

export function getAtlaxSession(): AtlaxSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as AtlaxSession
  } catch {
    return null
  }
}

export function setAtlaxSession(session: AtlaxSession) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KEY, JSON.stringify(session))
}

export function updateAtlaxUser(patch: Partial<AtlaxUser>) {
  const current = getAtlaxSession()
  if (!current) return
  setAtlaxSession({ ...current, user: { ...current.user, ...patch } })
}

export function clearAtlaxSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(KEY)
}

// ============================================================
// Historico local de operacoes (best-effort, conforme doc)
// ============================================================

const TX_KEY = "atlax_transactions"

export type AtlaxLocalTransaction = {
  transactionId: number | null
  symbol: string
  direction: number // 0 = abaixo, 1 = acima
  expiration: number
  amount: number // em reais
  status: string
  createdAt: string
  result?: "green" | "loss" | "pending" | null // resultado apos expiracao
  profit?: number // lucro/prejuizo em reais (apos expiracao)
}

// Atualiza o resultado de uma transacao ja salva (apos a expiracao)
export function updateAtlaxTransactionResult(
  atlaxUserId: number,
  transactionId: number | null,
  createdAt: string,
  patch: { result: "green" | "loss" | "pending"; profit?: number },
) {
  if (typeof window === "undefined") return
  const current = getAtlaxTransactions(atlaxUserId)
  const next = current.map((tx) =>
    tx.createdAt === createdAt && tx.transactionId === transactionId ? { ...tx, ...patch } : tx,
  )
  window.localStorage.setItem(`${TX_KEY}_${atlaxUserId}`, JSON.stringify(next))
}

export function getAtlaxTransactions(atlaxUserId: number): AtlaxLocalTransaction[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(`${TX_KEY}_${atlaxUserId}`)
    if (!raw) return []
    return JSON.parse(raw) as AtlaxLocalTransaction[]
  } catch {
    return []
  }
}

export function saveAtlaxTransaction(atlaxUserId: number, tx: AtlaxLocalTransaction) {
  if (typeof window === "undefined") return
  const current = getAtlaxTransactions(atlaxUserId)
  const next = [tx, ...current].slice(0, 100)
  window.localStorage.setItem(`${TX_KEY}_${atlaxUserId}`, JSON.stringify(next))
}

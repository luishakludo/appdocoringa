"use client"

// Motor de simulacao da conta DEMO (100% client-side, nao toca na Atlax).
// Reproduz o mesmo fluxo visual da IA real (entre -> operando -> confirmando)
// mas decide os resultados localmente respeitando um RTP (% de vitorias)
// definido pelo adm — de forma NATURAL: sem sequencias longas artificiais e
// convergindo para a taxa-alvo ao longo das entradas.

import { SYMBOL_CATALOG, isSymbolTradeable } from "@/lib/atlax-api"
import type { AtlaxLocalTransaction } from "@/lib/atlax-session"

const RUN_KEY = "coringa_demo_run"

export type DemoPhase = "between" | "running" | "settling" | "finished"

export type DemoRun = {
  id: string
  status: "running" | "finished"
  finishReason: "win" | "loss" | "manual" | "error" | null
  phase: DemoPhase
  config: {
    amount: number
    expiration: number
    stopWin: number // valor absoluto em R$
    stopLoss: number // valor absoluto em R$
    stopWinPct: number
    stopLossPct: number
    reentries: number
  }
  startBalance: number
  balance: number
  sessionPnl: number
  currentSymbol: string | null
  currentDirection: 0 | 1 | null
  currentAmount: number
  tradeStartAt: string | null
  tradeEndsAt: string | null
  phaseUntil: number // timestamp (ms) do fim da fase between/settling
  reentryCount: number
  chainLoss: number // perdas acumuladas na cadeia de gale atual
  pendingAmount: number // valor da proxima entrada
  ops: AtlaxLocalTransaction[]
  wins: number
  losses: number
  lastResults: ("green" | "loss")[] // mais recente primeiro
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ---- Escolha de ativo (mesma logica de mercado da IA real) ----
function pickSymbol(): string {
  const open = SYMBOL_CATALOG.filter((m) => isSymbolTradeable(m)).map((m) => m.code)
  const pool = open.length > 0 ? open : SYMBOL_CATALOG.filter((m) => m.isOtc).map((m) => m.code)
  return pool[Math.floor(Math.random() * pool.length)] ?? "EURUSDOTC"
}

// ---- Decisao de vitoria NATURAL respeitando o RTP ----
// Combina tres efeitos para parecer organico:
//  1) probabilidade base = rtp/100
//  2) auto-correcao: puxa a taxa real de volta ao alvo (sem travar em padrao)
//  3) amortecimento de sequencia: reduz a chance apos varias vitorias seguidas
//     e aumenta apos derrotas — evita "ganhar 10 seguidas" de forma artificial.
function decideWin(run: DemoRun, rtp: number): boolean {
  const p = Math.min(0.97, Math.max(0.03, rtp / 100))
  const total = run.wins + run.losses
  let prob = p

  if (total >= 1) {
    const actual = run.wins / total
    prob += (p - actual) * 0.6
  }

  // sequencia atual (a partir do resultado mais recente)
  let streak = 0
  if (run.lastResults.length > 0) {
    const head = run.lastResults[0]
    for (const r of run.lastResults) {
      if (r === head) streak++
      else break
    }
    if (head === "green" && streak >= 2) prob -= 0.1 * (streak - 1)
    if (head === "loss") prob += 0.12 * streak
  }

  prob = Math.min(0.97, Math.max(0.03, prob))
  return Math.random() < prob
}

// ============================================================
// Persistencia
// ============================================================
export function getDemoRun(): DemoRun | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(RUN_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DemoRun
  } catch {
    return null
  }
}

export function saveDemoRun(run: DemoRun) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(RUN_KEY, JSON.stringify(run))
}

export function clearDemoRun() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(RUN_KEY)
}

// ============================================================
// Criacao da sessao
// ============================================================
export function createDemoRun(input: {
  amount: number
  expiration: number
  stopWinPct: number
  stopLossPct: number
  reentries: number
  startBalance: number
}): DemoRun {
  const stopWin = round2(input.startBalance * (input.stopWinPct / 100))
  const stopLoss = round2(input.startBalance * (input.stopLossPct / 100))
  return {
    id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: "running",
    finishReason: null,
    phase: "between",
    config: {
      amount: input.amount,
      expiration: input.expiration,
      stopWin: Math.max(0.01, stopWin),
      stopLoss: Math.max(0.01, stopLoss),
      stopWinPct: input.stopWinPct,
      stopLossPct: input.stopLossPct,
      reentries: Math.max(0, input.reentries),
    },
    startBalance: input.startBalance,
    balance: input.startBalance,
    sessionPnl: 0,
    currentSymbol: null,
    currentDirection: null,
    currentAmount: input.amount,
    tradeStartAt: null,
    tradeEndsAt: null,
    phaseUntil: Date.now() + 2600,
    reentryCount: 0,
    chainLoss: 0,
    pendingAmount: input.amount,
    ops: [],
    wins: 0,
    losses: 0,
    lastResults: [],
  }
}

function finish(run: DemoRun, reason: DemoRun["finishReason"]): DemoRun {
  return {
    ...run,
    status: "finished",
    finishReason: reason,
    phase: "finished",
    currentSymbol: null,
    currentDirection: null,
    tradeEndsAt: null,
  }
}

// ============================================================
// Avanco da simulacao (chamado em intervalo curto pela UI)
// ============================================================
export function tickDemoRun(
  run: DemoRun,
  now: number,
  rtp: number,
): { run: DemoRun; settledOp: AtlaxLocalTransaction | null } {
  if (run.status === "finished") return { run, settledOp: null }

  // --- Fase "between": analisando o proximo ativo ---
  if (run.phase === "between") {
    if (now < run.phaseUntil) return { run, settledOp: null }

    const amount = Math.min(run.pendingAmount, run.balance)
    if (amount < 5) return { run: finish(run, run.sessionPnl >= 0 ? "win" : "loss"), settledOp: null }

    const symbol = pickSymbol()
    const direction: 0 | 1 = Math.random() < 0.5 ? 0 : 1
    const startMs = now
    const endsMs = now + Math.max(1, run.config.expiration) * 60 * 1000
    return {
      run: {
        ...run,
        phase: "running",
        currentSymbol: symbol,
        currentDirection: direction,
        currentAmount: round2(amount),
        tradeStartAt: new Date(startMs).toISOString(),
        tradeEndsAt: new Date(endsMs).toISOString(),
      },
      settledOp: null,
    }
  }

  // --- Fase "running": vela aberta, aguarda expirar ---
  if (run.phase === "running") {
    const endsMs = run.tradeEndsAt ? new Date(run.tradeEndsAt).getTime() : now
    if (now < endsMs) return { run, settledOp: null }
    // Expirou -> entra em confirmacao (1.6s a 3s, parece consulta a corretora)
    return {
      run: { ...run, phase: "settling", phaseUntil: now + 1600 + Math.floor(Math.random() * 1400) },
      settledOp: null,
    }
  }

  // --- Fase "settling": decide o resultado ---
  if (run.phase === "settling") {
    if (now < run.phaseUntil) return { run, settledOp: null }

    const win = decideWin(run, rtp)
    const payout = 0.85 + Math.random() * 0.07 // 85% a 92%
    const amount = run.currentAmount
    const profit = win ? round2(amount * payout) : round2(-amount)

    const op: AtlaxLocalTransaction = {
      transactionId: null,
      symbol: run.currentSymbol ?? "EURUSDOTC",
      direction: run.currentDirection ?? 1,
      expiration: run.config.expiration,
      amount,
      status: "finished",
      createdAt: run.tradeStartAt ?? new Date(now).toISOString(),
      result: win ? "green" : "loss",
      profit,
    }

    const balance = round2(run.balance + profit)
    const sessionPnl = round2(run.sessionPnl + profit)
    const ops = [op, ...run.ops]
    const lastResults = [win ? "green" : "loss", ...run.lastResults].slice(0, 20) as ("green" | "loss")[]
    const wins = run.wins + (win ? 1 : 0)
    const losses = run.losses + (win ? 0 : 1)

    const base: DemoRun = {
      ...run,
      balance,
      sessionPnl,
      ops,
      lastResults,
      wins,
      losses,
      currentSymbol: null,
      currentDirection: null,
      tradeEndsAt: null,
    }

    // --- Reentrada (gale) por loss ---
    if (!win && run.reentryCount < run.config.reentries) {
      const chainLoss = round2(run.chainLoss + amount)
      // valor que recupera as perdas da cadeia + lucro base
      let pendingAmount = Math.max(run.config.amount, Math.ceil((chainLoss + run.config.amount * payout) / payout))
      if (pendingAmount > balance) pendingAmount = Math.floor(balance)
      if (balance < 5 || pendingAmount < 5) {
        return { run: finish(base, sessionPnl >= 0 ? "win" : "loss"), settledOp: op }
      }
      return {
        run: {
          ...base,
          phase: "between",
          phaseUntil: now + 2200,
          reentryCount: run.reentryCount + 1,
          chainLoss,
          pendingAmount,
        },
        settledOp: op,
      }
    }

    // --- Fim da cadeia: reseta gale e verifica metas (stops) ---
    const resolved: DemoRun = {
      ...base,
      reentryCount: 0,
      chainLoss: 0,
      pendingAmount: run.config.amount,
    }

    if (sessionPnl >= run.config.stopWin) return { run: finish(resolved, "win"), settledOp: op }
    if (sessionPnl <= -run.config.stopLoss) return { run: finish(resolved, "loss"), settledOp: op }
    if (balance < Math.max(5, run.config.amount)) {
      return { run: finish(resolved, sessionPnl >= 0 ? "win" : "loss"), settledOp: op }
    }

    return { run: { ...resolved, phase: "between", phaseUntil: now + 2600 }, settledOp: op }
  }

  return { run, settledOp: null }
}

// Parada manual. force=true encerra mesmo com operacao em andamento (a entrada
// atual e descartada, nao contabilizada).
export function stopDemoRun(run: DemoRun): DemoRun {
  if (run.status === "finished") return run
  return finish(run, "manual")
}

// ============================================================
// Adapta o DemoRun para o formato consumido pela UI (igual ao SessionState
// retornado pelo servidor da IA real), permitindo reaproveitar todo o JSX.
// ============================================================
export function runToView(run: DemoRun) {
  return {
    id: run.id,
    status: run.status,
    finishReason: run.finishReason,
    phase: run.phase,
    config: {
      amount: run.config.amount,
      expiration: run.config.expiration,
      stopWin: run.config.stopWin,
      stopLoss: run.config.stopLoss,
      stopWinPct: run.config.stopWinPct,
      stopLossPct: run.config.stopLossPct,
      reentries: run.config.reentries,
    },
    sessionPnl: run.sessionPnl,
    startBalance: run.startBalance,
    currentSymbol: run.currentSymbol,
    currentDirection: run.currentDirection,
    currentAmount: run.currentAmount,
    tradeEndsAt: run.tradeEndsAt,
    reentryCount: run.reentryCount,
    lastError: null as string | null,
  }
}

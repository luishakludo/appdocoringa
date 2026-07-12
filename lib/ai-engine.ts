import { supabase } from "@/lib/supabase"
import { ATLAX_BASE, PRICE_DEFAULTS, SYMBOL_CATALOG, isSymbolTradeable, getSymbolMeta } from "@/lib/atlax-api"
import type { SymbolType } from "@/lib/atlax-api"

// ============================================================
// Motor da IA (server-side). Mesma logica que antes rodava no
// navegador, agora executada no servidor com estado no Supabase,
// para que a IA continue operando mesmo com o app fechado.
// ============================================================

// Codigos OTC do catalogo (operam 24/7, inclusive fim de semana). Usados como
// fallback garantido quando nenhum ativo "normal" esta em horario de pregao.
const OTC_SYMBOLS: string[] = SYMBOL_CATALOG.filter((m) => m.isOtc).map((m) => m.code)

type TradeableSymbol = { code: string; isOtc: boolean }

const isOtcCode = (code: string) => code.toUpperCase().endsWith("OTC")

// Retorna os ativos negociaveis AGORA, ja separando mercado REAL de OTC.
// Prioriza a verdade da corretora (is_market_open via
// /api/public/binary/symbols); se o endpoint negar acesso (401), cai para o
// catalogo local filtrado pelo horario de mercado.
//   - OTC: sempre aberto (00:00-23:59, sem bloqueio de fim de semana).
//   - forex/acoes/cripto normais: somente dentro do horario e fora do fim de
//     semana quando bloqueado.
async function fetchTradeableSymbols(token: string): Promise<TradeableSymbol[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${ATLAX_BASE}/api/public/binary/symbols`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        symbols?: Array<{ code: string; status: number; is_market_open: number; is_otc?: number }>
      }
      const all = data.symbols ?? []
      const live = all
        .filter((s) => s.status === 1 && s.is_market_open === 1 && typeof s.code === "string")
        .map((s) => ({ code: s.code, isOtc: s.is_otc === 1 || isOtcCode(s.code) }))
      if (live.length > 0) {
        const real = live.filter((s) => !s.isOtc).length
        console.log(
          `[v0] symbols LIVE da corretora: total=${all.length} abertos=${live.length} (real=${real} otc=${live.length - real})`,
        )
        return live
      }
      console.log(`[v0] symbols endpoint OK mas sem ativos abertos (total=${all.length}) -> fallback local`)
    } else {
      console.log(`[v0] symbols endpoint negou acesso (HTTP ${res.status}) -> fallback local (catalogo de 23)`)
    }
  } catch (err) {
    console.log(`[v0] symbols endpoint falhou (${err instanceof Error ? err.message : err}) -> fallback local`)
  }
  // Fallback local: catalogo filtrado pelo horario de mercado.
  const open = SYMBOL_CATALOG.filter((m) => isSymbolTradeable(m)).map((m) => ({ code: m.code, isOtc: m.isOtc }))
  const realOpen = open.filter((s) => !s.isOtc).length
  console.log(`[v0] fallback local: abertos=${open.length} (real=${realOpen} otc=${open.length - realOpen})`)
  return open.length > 0 ? open : OTC_SYMBOLS.map((code) => ({ code, isOtc: true }))
}

// Teto de participacao de OTC nas escolhas (no maximo 25% dentro da janela
// recente). O resto (>=75%) sai de ativos de mercado REAL abertos agora.
const OTC_MAX_RATIO = 0.25

// Base de um codigo sem o sufixo OTC (BTCUSDTOTC -> BTCUSDT, AAPLOTC -> AAPL).
function baseCode(code: string): string {
  return code.replace(/OTC$/i, "")
}
// Quantas escolhas recentes olhamos para medir/limitar a proporcao de OTC e
// para rotacionar os tipos (cripto/forex/acoes) evitando repeticao.
const RECENT_WINDOW = 20

const typeOf = (code: string): SymbolType | undefined => getSymbolMeta(code)?.type

// Dentro de um grupo, prefere o TIPO (cripto/forex/acoes) menos usado
// recentemente, para nao cair em "so cripto" ou repetir sempre o mesmo mercado.
// Empates sao desfeitos aleatoriamente.
function pickWithTypeVariety(group: TradeableSymbol[], recent: string[]): string {
  if (group.length === 1) return group[0].code
  // "recencia" por tipo: quanto MENOR o indice, mais recente. Tipo ausente = infinito.
  const lastSeen = new Map<SymbolType, number>()
  recent.forEach((code, i) => {
    const t = typeOf(code)
    if (t && !lastSeen.has(t)) lastSeen.set(t, i)
  })
  const score = (code: string) => {
    const t = typeOf(code)
    return t && lastSeen.has(t) ? (lastSeen.get(t) as number) : Number.POSITIVE_INFINITY
  }
  const maxScore = Math.max(...group.map((g) => score(g.code)))
  const best = group.filter((g) => score(g.code) === maxScore)
  return best[Math.floor(Math.random() * best.length)].code
}

// Escolhe o proximo ativo entre os que a corretora reporta abertos AGORA
// (is_market_open === 1), aplicando tres regras:
//   1) Nunca repete o ativo da operacao imediatamente anterior.
//   2) OTC fica limitado a no maximo 25% dentro da janela recente — assim para
//      de vir "sequencia de OTC". O restante (>=75%) sai de mercado REAL. Alem
//      disso, se a versao REAL de um ativo esta aberta, a versao OTC dele nem
//      entra no sorteio (nada de cripto OTC quando a cripto real esta aberta).
//   3) Dentro do grupo escolhido, rotaciona os tipos (cripto/forex/acoes) para
//      dar variedade e nao recomendar so cripto.
// `recent` = codigos das ultimas operacoes (mais recente primeiro).
export async function pickTradeableSymbol(token: string, recent: string[] = []): Promise<string> {
  const pool = await fetchTradeableSymbols(token)
  if (pool.length === 0) {
    return OTC_SYMBOLS[Math.floor(Math.random() * OTC_SYMBOLS.length)]
  }

  // Regra 0: se a versao REAL de um ativo esta aberta, descarta a versao OTC
  // dele. Ex.: com BTCUSDT aberto, BTCUSDTOTC nem entra no sorteio. Assim nao
  // aparece "cripto (OTC)" quando existe a cripto de mercado real disponivel.
  const realBases = new Set(pool.filter((s) => !s.isOtc).map((s) => baseCode(s.code)))
  let cleaned = pool.filter((s) => !(s.isOtc && realBases.has(baseCode(s.code))))
  if (cleaned.length === 0) cleaned = pool

  // Regra 1: evita repetir o ultimo ativo (se houver alternativa).
  const last = recent[0]
  let candidates = last ? cleaned.filter((s) => s.code !== last) : cleaned
  if (candidates.length === 0) candidates = cleaned

  const nonOtc = candidates.filter((s) => !s.isOtc)
  const otc = candidates.filter((s) => s.isOtc)

  // Regra 2: mede a proporcao de OTC na janela recente e decide se PODE usar OTC
  // sem estourar o teto de 35%.
  const window = recent.slice(0, RECENT_WINDOW)
  const otcCount = window.filter((c) => isOtcCode(c)).length
  const wouldRatio = (otcCount + 1) / (window.length + 1)

  let useOtc: boolean
  if (nonOtc.length === 0)
    useOtc = true // so ha OTC aberto agora
  else if (otc.length === 0)
    useOtc = false // so ha mercado real aberto
  else useOtc = wouldRatio <= OTC_MAX_RATIO && Math.random() < OTC_MAX_RATIO

  const group = useOtc ? otc : nonOtc
  // Regra 3: variedade de tipos dentro do grupo escolhido.
  return pickWithTypeVariety(group, recent)
}

export type AiConfig = {
  amount: number
  expiration: number
  stopWin: number
  stopLoss: number
  stopWinPct: number
  stopLossPct: number
  reentries: number
  // Parada solicitada manualmente: a IA encerra ao FIM da operacao atual,
  // nunca no meio dela.
  stopRequested?: boolean
}

export type AiSession = {
  id: string
  atlax_user_id: number
  atlax_token: string
  status: "running" | "finished"
  finish_reason: string | null
  config: AiConfig
  start_balance: number
  session_pnl: number
  phase: "placing" | "running" | "between" | "settling" | "finished"
  balance_before: number
  current_symbol: string | null
  current_direction: number | null
  current_amount: number
  active_tx_id: number | null
  active_op_id: string | null
  trade_ends_at: string | null
  reentry_count: number
  pending_reentry: { symbol: string; direction: 0 | 1; amount: number } | null
  fail_streak: number
  last_error: string | null
  tick_lock: string | null
}

// Converte "5.013,90" (formato BRL) para numero 5013.9
export function brlToNumber(value: string | undefined | null): number {
  if (!value) return 0
  const normalized = value.replace(/\./g, "").replace(",", ".")
  return Number.parseFloat(normalized) || 0
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Proximo fechamento de vela alinhado ao relogio (em ms desde epoch).
// Ex.: para M5 (expirationMin = 5), se agora sao 16:02 retorna 16:05;
// 16:05 retorna 16:10. Usado para alinhar o INICIO da IA a abertura da vela.
export function nextCandleBoundaryMs(expirationMin: number): number {
  const step = Math.max(1, Math.floor(expirationMin))
  const d = new Date()
  d.setSeconds(0, 0)
  const rem = d.getMinutes() % step
  d.setMinutes(d.getMinutes() + (rem === 0 ? step : step - rem))
  return d.getTime()
}

// Passo da vela em ms para o timeframe (M1 -> 60000, M5 -> 300000).
function candleStepMs(expirationMin: number): number {
  return Math.max(1, Math.floor(expirationMin)) * 60_000
}

// Abertura (inicio) da vela em que `ms` cai, alinhada ao relogio.
// Ex.: M5, 19:07:32 -> 19:05:00 ; M1, 19:07:32 -> 19:07:00.
function candleOpenMs(ms: number, expirationMin: number): number {
  const step = candleStepMs(expirationMin)
  return Math.floor(ms / step) * step
}

// Janela ANTES da abertura da vela em que, se um tick chegar, ele DORME o tempo
// exato que falta e entra cravado no segundo :00. 48s cobre com folga o periodo
// de um cron de 1/min (sempre havera um disparo dentro dessa janela) e cabe no
// maxDuration=60 das rotas, deixando tempo para a ordem ser enviada.
const PLACE_PRESLEEP_MS = 48_000
// Tolerancia DEPOIS da abertura: se o tick chegou ate 15s atrasado, ainda
// consideramos "inicio de vela" e entramos; passou disso, esperamos a PROXIMA
// vela (NUNCA entramos no meio).
const PLACE_GRACE_MS = 15_000

type EntryDecision =
  | { action: "wait"; target: number }
  | { action: "place"; sleepMs: number; target: number }

// Decide QUANDO abrir a proxima operacao para que ela caia SEMPRE na abertura
// da vela (segundo :00 do timeframe), espelhando a corretora:
//   - Muito antes do :00 (> 48s): espera (o cron/cliente volta depois).
//   - Ate 48s antes do :00: dorme o tempo exato e entra cravado no :00.
//   - Ate 15s depois do :00: entra na hora (ainda e inicio de vela).
//   - Mais de 15s depois do :00: perdeu esta vela -> reagenda para a PROXIMA
//     abertura e espera. Assim jamais entra no meio da vela.
function decideEntry(now: number, expirationMin: number, scheduled: number): EntryDecision {
  const step = candleStepMs(expirationMin)
  let target = scheduled
  // Se ja passamos da tolerancia desta abertura, mira na proxima abertura de vela.
  if (now > target + PLACE_GRACE_MS) {
    target = candleOpenMs(now, expirationMin) + step
  }
  const delta = target - now
  if (delta > PLACE_PRESLEEP_MS) return { action: "wait", target }
  if (delta > 0) return { action: "place", sleepMs: delta, target }
  // delta <= 0: estamos no :00 ou dentro da tolerancia -> entra imediatamente.
  return { action: "place", sleepMs: 0, target }
}

// ---- Chamadas a corretora -------------------------------------------------

async function fetchLivePrice(symbol: string): Promise<number> {
  const fallback = PRICE_DEFAULTS[symbol] || 1.0
  if (!symbol.endsWith("USDT")) return fallback
  const base = symbol.slice(0, -4)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`https://api.coinbase.com/v2/prices/${base}-USD/spot`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
    clearTimeout(timeout)
    if (res.ok) {
      const data = (await res.json()) as { data?: { amount?: string } }
      const price = Number.parseFloat(data.data?.amount ?? "")
      if (Number.isFinite(price) && price > 0) return price
    }
  } catch {
    // usa fallback
  }
  return fallback
}

// DISPARA a liquidacao das operacoes pendentes na corretora.
//
// Este e o ponto que faltava: a corretora NAO liquida a transacao sozinha no
// fechamento da vela — ela so processa os resultados quando o endpoint
// GET /api/public/settlement e chamado (e exatamente o que acontecia quando
// voce abria o historico na corretora: a tela disparava o settlement e o
// resultado "aparecia rapido"). Sem essa chamada, /api/public/transactions/{id}
// fica preso em status_id=1 (Em aberto) para sempre e a IA nunca confirmava o
// resultado sozinha. Agora chamamos isso a cada verificacao para forcar a
// liquidacao no lado da corretora antes de ler o status oficial da transacao.
async function triggerBrokerSettlement(token: string): Promise<void> {
  try {
    const res = await fetch(`${ATLAX_BASE}/api/public/settlement`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    })
    const data = (await res.json().catch(() => ({}))) as { updated?: number }
    if (res.ok && (data.updated ?? 0) > 0) {
      console.log(`[v0] settlement disparado: ${data.updated} transacao(oes) liquidada(s)`)
    }
  } catch (err) {
    console.log(`[v0] triggerBrokerSettlement erro:`, err instanceof Error ? err.message : err)
  }
}

// Resultado oficial de uma operacao consultado direto na corretora pelo id da
// transacao. Esta e a FONTE DA VERDADE para green/loss:
//   status_id 1 = Em aberto (ainda nao liquidou)
//   status_id 2 = Ganhou (green)  -> lucro = returns - amount
//   status_id 3 = Perdeu (loss)   -> lucro = -amount
// `expiryRaw` e a expiracao oficial da transacao ("YYYY-MM-DD HH:mm:ss" no fuso
// da corretora), usada para SINCRONIZAR o timer da IA com o tempo real.
type TxResult =
  | { decided: true; result: "green" | "loss"; profit: number; expiryRaw: string | null }
  | { decided: false; expiryRaw: string | null }

async function fetchTransactionResult(token: string, txId: number, amount: number): Promise<TxResult> {
  try {
    // Endpoint correto da corretora para consultar UMA transacao por id.
    const res = await fetch(`${ATLAX_BASE}/api/public/transactions/${txId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    })
    if (!res.ok) {
      console.log(`[v0] fetchTransactionResult tx#${txId} HTTP ${res.status}`)
      return { decided: false, expiryRaw: null }
    }
    const data = (await res.json().catch(() => ({}))) as {
      transaction?: { status_id?: number; returns_cents?: number; returns?: string; expiration_date?: string }
    }
    const tx = data.transaction
    const statusId = Number(tx?.status_id)
    const expiryRaw = tx?.expiration_date ?? null
    console.log(`[v0] fetchTransactionResult tx#${txId} status_id=${statusId} exp=${expiryRaw ?? "-"}`)
    if (statusId === 2) {
      const returns = tx?.returns_cents != null ? Number(tx.returns_cents) / 100 : brlToNumber(tx?.returns)
      return { decided: true, result: "green", profit: returns - amount, expiryRaw }
    }
    if (statusId === 3) {
      return { decided: true, result: "loss", profit: -amount, expiryRaw }
    }
    // status_id 1 (Em aberto) ou desconhecido: ainda nao liquidou.
    return { decided: false, expiryRaw }
  } catch (err) {
    console.log(`[v0] fetchTransactionResult tx#${txId} erro:`, err instanceof Error ? err.message : err)
    return { decided: false, expiryRaw: null }
  }
}

export async function fetchBrokerBalance(token: string): Promise<number | null> {
  try {
    const res = await fetch(`${ATLAX_BASE}/api/public/users/balance`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return null
    if (data.credit !== undefined) return brlToNumber(data.credit as string)
  } catch {
    // ignora
  }
  return null
}

type PlaceResult =
  | { success: true; transactionId: number | null; userCredit: string | null; expirationDate: string | null }
  | { success: false; message: string; unauthorized?: boolean }

async function placeBrokerTrade(
  token: string,
  symbol: string,
  direction: number,
  expiration: number,
  amount: number,
): Promise<PlaceResult> {
  try {
    let symbolPrice = await fetchLivePrice(symbol)
    if (!symbolPrice || symbolPrice === 0) symbolPrice = 1

    const params = new URLSearchParams()
    params.append("transaction_account_id", "0")
    params.append("expiration", String(expiration))
    params.append("amount", Number(amount).toFixed(2))
    params.append("direction", String(direction))
    params.append("symbol", symbol)
    params.append("symbol_price", String(symbolPrice))

    const res = await fetch(`${ATLAX_BASE}/api/public/applications/transaction`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    })
    const data = await res.json().catch(() => ({}))

    if (data.status !== "success") {
      return {
        success: false,
        message: data.message || data.error || "Ativo indisponivel.",
        unauthorized: res.status === 401 || res.status === 403,
      }
    }

    return {
      success: true,
      transactionId: (data.transaction_id as number) ?? null,
      userCredit: (data.user_credit as string) ?? null,
      // A corretora alinha a expiracao ao fechamento da vela; esse e o
      // momento REAL em que o resultado e liquidado. Usamos esse valor.
      expirationDate: (data.expiration_date as string) ?? null,
    }
  } catch {
    return { success: false, message: "Erro de conexao com a corretora." }
  }
}

// ---- Persistencia ---------------------------------------------------------

async function patchSession(id: string, patch: Record<string, unknown>) {
  await supabase
    .from("ai_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
}

async function finishSession(session: AiSession, reason: "win" | "loss" | "manual" | "error", error?: string) {
  await patchSession(session.id, {
    status: "finished",
    finish_reason: reason,
    phase: "finished",
    last_error: error ?? null,
    active_tx_id: null,
    active_op_id: null,
    trade_ends_at: null,
    tick_lock: null,
  })
}

// A corretora devolve `expiration_date` como "YYYY-MM-DD HH:mm:ss" SEM fuso
// horario. Como o servidor (Vercel) roda em UTC, um Date.parse direto
// interpretaria esse horario como UTC, quando na verdade ele esta no fuso da
// corretora (Brasil, UTC-3). Isso jogava a expiracao ~3h para o passado, o
// codigo caia no calculo local e o timer ficava dessincronizado da corretora
// (ex.: IA 00:08 vs corretora 01:06).
//
// Aqui resolvemos o instante REAL de expiracao sem chutar o fuso: parseamos o
// horario como se fosse UTC e testamos cada offset inteiro de hora, escolhendo
// o que faz a expiracao cair na janela plausivel (entre agora e ~expiracao+3min
// no futuro), o mais proximo possivel de agora+expiracao. Assim funciona para
// qualquer fuso da corretora, com ou sem horario de verao.
function resolveBrokerExpiry(raw: string, nowMs: number, expirationMin: number): number | null {
  // "2024-11-22 10:50:00" -> "2024-11-22T10:50:00Z" (interpreta como UTC base)
  const iso = raw.trim().replace(" ", "T")
  const baseUtc = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  if (!Number.isFinite(baseUtc)) return null

  const expected = nowMs + expirationMin * 60_000
  const windowStart = nowMs - 30_000 // pequena folga p/ latencia
  const windowEnd = nowMs + (expirationMin + 3) * 60_000
  const HOUR = 3_600_000

  let best: number | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (let k = -14; k <= 14; k++) {
    const candidate = baseUtc - k * HOUR
    if (candidate < windowStart || candidate > windowEnd) continue
    const dist = Math.abs(candidate - expected)
    if (dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }
  return best
}

// ---- Maquina de estados ---------------------------------------------------

// Abre a proxima operacao. A IA escolhe moeda/direcao aleatorias, ou repete a
// operacao pendente (reentrada) com o valor dobrado.
async function placeNext(session: AiSession): Promise<void> {
  const cfg = session.config
  const pending = session.pending_reentry

  let symbol: string
  let direction: 0 | 1
  let amount: number
  let reentryCount = session.reentry_count

  if (pending) {
    symbol = pending.symbol
    direction = pending.direction
    amount = pending.amount
  } else {
    // Historico recente de ativos desta sessao (mais recente primeiro) para
    // limitar OTC a 35%, rotacionar tipos e nao repetir o ativo anterior.
    const { data: recentRows } = await supabase
      .from("ai_operations")
      .select("symbol")
      .eq("session_id", session.id)
      .order("id", { ascending: false })
      .limit(RECENT_WINDOW)
    const recent = (recentRows ?? []).map((r) => r.symbol as string)

    symbol = await pickTradeableSymbol(session.atlax_token, recent)
    direction = Math.random() > 0.5 ? 1 : 0
    amount = cfg.amount
    reentryCount = 0
  }

  const balanceBefore = (await fetchBrokerBalance(session.atlax_token)) ?? session.balance_before

  const placed = await placeBrokerTrade(session.atlax_token, symbol, direction, cfg.expiration, amount)

  if (!placed.success) {
    // Token expirou: encerra a sessao com aviso.
    if (placed.unauthorized) {
      await finishSession(session, "error", "Sessao da corretora expirou. Inicie a IA novamente.")
      return
    }
    // Rejeicao intermitente: descarta o ativo planejado e tenta outro no
    // proximo tick (evita ficar preso repetindo um ativo indisponivel).
    await patchSession(session.id, {
      phase: "between",
      fail_streak: session.fail_streak + 1,
      last_error: placed.message,
      pending_reentry: null,
      tick_lock: null,
    })
    return
  }

  // Registra a operacao no historico (resultado pendente).
  const createdAt = new Date().toISOString()
  const { data: opRow } = await supabase
    .from("ai_operations")
    .insert({
      session_id: session.id,
      atlax_user_id: session.atlax_user_id,
      transaction_id: placed.transactionId,
      symbol,
      direction,
      expiration: cfg.expiration,
      amount,
      status: "success",
      result: "pending",
      profit: 0,
    })
    .select("id")
    .single()

  // FONTE DA VERDADE do prazo: a expiracao REAL retornada pela corretora
  // (`expiration_date`), que ja vem alinhada ao fechamento da vela em que a
  // ORDEM CAIU. Isso e o que garante que o timer da IA bata exatamente com a
  // corretora — inclusive quando a ordem entra na vela seguinte por ter sido
  // enviada perto do fechamento da atual. So caimos no calculo local alinhado
  // quando a corretora nao devolve um horario utilizavel.
  const now = Date.now()
  const stepMs = Math.max(1, Math.floor(cfg.expiration)) * 60 * 1000
  const candleOpen = Math.floor(now / stepMs) * stepMs
  const localEnds = candleOpen + cfg.expiration * 60 * 1000
  let endsMs = localEnds
  let source = "local-alinhado"
  if (placed.expirationDate) {
    const resolved = resolveBrokerExpiry(placed.expirationDate, now, cfg.expiration)
    if (resolved != null) {
      endsMs = resolved
      source = "corretora"
    }
  }
  const endsAt = new Date(endsMs).toISOString()
  console.log(
    `[v0] placeNext tx#${placed.transactionId} ${symbol} ${direction} expira em ${endsAt} (fonte: ${source}, raw: ${placed.expirationDate ?? "-"})`,
  )

  await patchSession(session.id, {
    phase: "running",
    fail_streak: 0,
    last_error: null,
    current_symbol: symbol,
    current_direction: direction,
    current_amount: amount,
    balance_before: balanceBefore,
    active_tx_id: placed.transactionId,
    active_op_id: opRow?.id ?? null,
    trade_ends_at: endsAt,
    reentry_count: reentryCount,
    pending_reentry: null,
    tick_lock: null,
  })
}

// Janela de confirmacao do resultado: depois que a operacao expira, esperamos
// ate este tempo (em ms) pelo credito do green. Generosa de proposito: opcoes
// binarias liquidam no fechamento da vela e o credito do green cai em segundos,
// mas o endpoint de saldo da corretora pode atrasar/cachear. Nunca marcamos
// loss antes de uma leitura de saldo VALIDA e estavel.
const SETTLE_WINDOW_MS = 180_000

// Liquida a operacao atual (apos expirar) comparando o saldo de AGORA com o
// saldo de ANTES da aposta. Esta funcao roda na fase "settling" e e chamada
// repetidamente pelos ticks (cliente a cada poucos segundos, cron a cada min).
//
// Verdade da corretora para opcao binaria:
//   - ao abrir, a corretora DEBITA o valor da aposta.
//   - GREEN: no fechamento da vela credita aposta + lucro => saldo SOBE acima
//     do saldo pre-aposta (before).
//   - LOSS: nao credita nada => saldo fica PARADO no nivel pos-debito
//     (before - aposta) para sempre.
// Portanto:
//   - saldo > before  => GREEN (assim que detectado, em qualquer momento)
//   - saldo estabilizou no nivel de loss (<= before - aposta) => LOSS confirmado
//   - leitura nula/ambigua => indeciso: nao decide, tenta de novo no proximo tick
//     (evita o falso loss quando o credito do green ainda nao apareceu no saldo).
async function settle(session: AiSession): Promise<void> {
  const cfg = session.config
  const amt = session.current_amount

  // Prazo limite para confirmar o resultado (guardado em trade_ends_at ao
  // entrar na fase "settling").
  const deadlineMs = session.trade_ends_at ? new Date(session.trade_ends_at).getTime() : 0
  const deadlinePassed = !deadlineMs || Date.now() >= deadlineMs

  // FONTE DA VERDADE: o resultado oficial da operacao consultado direto na
  // corretora pelo id da transacao (status_id 2 = green, 3 = loss). Bem mais
  // simples e confiavel do que inferir pelo saldo. Fazemos um poll curto dentro
  // de um unico tick para captar a liquidacao assim que ela acontece.
  let result: "green" | "loss" | null = null
  let profit = 0

  if (session.active_tx_id != null) {
    // Autoridade UNICA: o status_id da transacao na corretora. Nunca chutamos
    // pelo saldo aqui (isso ja inverteu resultados antes).
    // Dispara a liquidacao na corretora e le o status oficial na sequencia.
    // IMPORTANTE: NAO fazemos poll com sleeps aqui. Antes o loop de sleep(1000)
    // segurava o lock da sessao por ~4s e martelava a corretora, fazendo os
    // ticks seguintes (cliente/cron) baterem no lock e nao executarem o settle
    // — era isso que travava a confirmacao por minutos. Agora cada tick faz UMA
    // tentativa rapida (settlement + leitura, ~300ms) e libera o lock na hora;
    // se ainda nao liquidou, o proximo tick (a cada ~1.5s pelo cliente) tenta de
    // novo. Confirma em poucos segundos apos o fechamento da vela.
    await triggerBrokerSettlement(session.atlax_token)
    const tx = await fetchTransactionResult(session.atlax_token, session.active_tx_id, amt)
    if (tx.decided) {
      result = tx.result
      profit = tx.profit
      console.log(
        `[v0] settle tx#${session.active_tx_id} -> ${result} (profit ${profit.toFixed(2)})`,
      )
    } else if (!deadlinePassed) {
      // AINDA EM ABERTO NA CORRETORA e DENTRO da janela de liquidacao (3 min
      // apos a expiracao). Enquanto estamos nessa janela, o status_id
      // (2=green, 3=loss) e a UNICA autoridade: nao decidimos por saldo, pois a
      // inferencia por saldo no meio da vela ja inverteu resultados. Esperamos a
      // corretora liquidar; o proximo tick reavalia (cliente a cada ~1.5s, cron
      // a cada minuto).
      console.log(
        `[v0] settle tx#${session.active_tx_id} ainda em aberto (dentro da janela), aguardando status oficial...`,
      )
      await patchSession(session.id, { tick_lock: null })
      return
    } else {
      // PRAZO ESGOTADO (>=3 min apos a expiracao) e a corretora AINDA nao marcou
      // status_id 2/3 — a transacao ficou presa em "Em aberto". Para nao travar
      // a sessao para sempre (era o bug do "CONFIRMANDO RESULTADO" eterno),
      // resolvemos pelo SALDO agora. Aqui e seguro: passaram-se minutos desde o
      // fechamento da vela, entao o saldo ja estabilizou e nao ha risco de
      // inversao por decisao no meio da vela.
      const before = session.balance_before
      const tol = Math.max(0.01, amt * 0.0001)
      const finalBalance = await fetchBrokerBalance(session.atlax_token)
      if (finalBalance == null) {
        // Saldo indisponivel: tenta de novo no proximo tick (nao trava, so adia).
        console.log(`[v0] settle tx#${session.active_tx_id} prazo esgotado mas saldo indisponivel, retentando...`)
        await patchSession(session.id, { tick_lock: null })
        return
      }
      result = finalBalance > before + tol ? "green" : "loss"
      profit = result === "green" ? finalBalance - before : -amt
      console.log(
        `[v0] settle tx#${session.active_tx_id} prazo esgotado -> resolvido por saldo: ${result} (profit ${profit.toFixed(2)})`,
      )
    }
  }

  // Fallback por saldo: EXCLUSIVAMENTE quando nao existe id de transacao (caso
  // raro em que a corretora aceitou a ordem mas nao devolveu o transaction_id).
  // Com id de transacao presente, nunca chegamos aqui - o resultado vem 100%
  // do status_id, garantindo consistencia total com a corretora.
  if (result === null && session.active_tx_id == null) {
    const before = session.balance_before
    const tol = Math.max(0.01, amt * 0.0001)
    const lossLevel = before - amt // saldo apos um loss puro (aposta consumida)
    const finalBalance = await fetchBrokerBalance(session.atlax_token)

    const winConfirmed = finalBalance != null && finalBalance > before + tol
    const lossConfirmed = finalBalance != null && finalBalance <= lossLevel + tol

    if (winConfirmed) {
      result = "green"
      profit = finalBalance - before
    } else if (lossConfirmed && deadlinePassed) {
      result = "loss"
      profit = finalBalance != null ? finalBalance - before : -amt
    } else {
      // Ainda indeciso (saldo ambiguo dentro da janela): reavalia no proximo tick.
      await patchSession(session.id, { tick_lock: null })
      return
    }
  }

  if (session.active_op_id) {
    await supabase.from("ai_operations").update({ result, profit }).eq("id", session.active_op_id)
  }

  const newPnl = Number(session.session_pnl) + profit

  // Verifica metas.
  if (newPnl >= cfg.stopWin) {
    await patchSession(session.id, { session_pnl: newPnl })
    await finishSession({ ...session, session_pnl: newPnl }, "win")
    return
  }
  if (newPnl <= -cfg.stopLoss) {
    await patchSession(session.id, { session_pnl: newPnl })
    await finishSession({ ...session, session_pnl: newPnl }, "loss")
    return
  }

  // Reentrada (gale): se deu loss e restam reentradas, repete a mesma
  // moeda/direcao/tempo com o valor dobrado.
  let pendingReentry: AiSession["pending_reentry"] = null
  let reentryCount = session.reentry_count
  if (result === "loss" && reentryCount < cfg.reentries) {
    reentryCount += 1
    pendingReentry = {
      symbol: session.current_symbol as string,
      direction: (session.current_direction === 1 ? 1 : 0) as 0 | 1,
      amount: amt * 2,
    }
  } else {
    reentryCount = 0
  }

  // Parada manual pedida durante a operacao: agora que a operacao terminou (e
  // nao ha gale pendente), encerramos a sessao. Nunca paramos no meio.
  if (cfg.stopRequested && !pendingReentry) {
    await patchSession(session.id, { session_pnl: newPnl })
    await finishSession({ ...session, session_pnl: newPnl }, "manual")
    return
  }

  // Proxima entrada SEMPRE alinhada a abertura da proxima vela (segundo :00),
  // exatamente como a corretora. Se ha gale pendente, repetimos o mesmo
  // ativo/direcao (valor dobrado); senao, ja escolhemos o proximo ativo para a
  // tela mostrar "entrando em X na abertura da vela". Guardamos o plano em
  // pending_reentry para que placeNext use exatamente esse ativo na vela.
  let plan = pendingReentry
  if (!plan) {
    const symbol = await pickTradeableSymbol(session.atlax_token)
    const direction = (Math.random() > 0.5 ? 1 : 0) as 0 | 1
    plan = { symbol, direction, amount: cfg.amount }
  }
  const scheduledStart = new Date(nextCandleBoundaryMs(cfg.expiration)).toISOString()

  await patchSession(session.id, {
    session_pnl: newPnl,
    phase: "placing",
    active_tx_id: null,
    active_op_id: null,
    trade_ends_at: scheduledStart,
    reentry_count: reentryCount,
    current_symbol: plan.symbol,
    current_direction: plan.direction,
    current_amount: plan.amount,
    pending_reentry: plan,
    tick_lock: null,
  })
}

// Avanca UMA sessao. Chamado pelo cron (a cada minuto) e tambem pelo cliente
// enquanto o app esta aberto (para reagir mais rapido).
export async function tickSession(session: AiSession): Promise<void> {
  if (session.status !== "running") return

  // Aguardando a confirmacao do resultado da operacao anterior.
  // Liquida comparando o saldo atual com o saldo de antes da aposta.
  if (session.phase === "settling") {
    await settle(session)
    return
  }

  // Tem operacao em andamento. Espelhamos a corretora com uma regra de OURO
  // para garantir consistencia 100%:
  //
  //   *** NUNCA disparamos a liquidacao (settlement) antes do fim real da vela. ***
  //
  // Motivo (era a causa da inversao intermitente green/loss): chamar
  // /api/public/settlement ANTES da vela fechar faz a corretora liquidar a
  // operacao pelo preco do MEIO da vela, e nao pelo preco de FECHAMENTO. Se
  // nesse instante estava perdendo mas recupera ate o fechamento, a corretora
  // mostra GREEN (liquida no close) mas o nosso status_id antecipado pegava
  // LOSS — resultado invertido. Agora o settlement so ocorre em settle(), que
  // so roda DEPOIS de endsMs (vela fechada), entao o status_id sempre reflete o
  // fechamento real e bate exatamente com a corretora.
  //
  //   - Longe do fim (> 8s): confiamos no trade_ends_at (veio da corretora) e
  //     NAO consultamos a API, para nao martela-la o minuto inteiro.
  //   - Ultimos 8s (ainda nao expirou): fazemos apenas uma LEITURA PURA
  //     (GET transactions/{id}, que NAO liquida nada) para sincronizar o timer
  //     com a expiracao oficial. Nao decidimos resultado nem disparamos
  //     settlement aqui.
  //   - Expirou (now >= endsMs): entra em "settling"; settle() dispara o
  //     settlement (agora seguro) e le o status oficial ate confirmar.
  if (session.active_tx_id != null && session.trade_ends_at) {
    const now = Date.now()
    const endsMs = new Date(session.trade_ends_at).getTime()

    // Ainda dentro da operacao.
    if (now < endsMs) {
      // Longe do fim: nada a fazer.
      if (now < endsMs - 8000) return

      // Ultimos 8s: LEITURA PURA (sem settlement) so para sincronizar o timer.
      const snap = await fetchTransactionResult(session.atlax_token, session.active_tx_id, session.current_amount)

      // Se a corretora ja liquidou por conta propria (raro; so acontece se a
      // vela ja fechou de fato), podemos confirmar. Isso NAO e liquidacao
      // antecipada: decided so vira 2/3 apos o fechamento real da vela.
      if (snap.decided) {
        const settleDeadline = new Date(now + SETTLE_WINDOW_MS).toISOString()
        await patchSession(session.id, { phase: "settling", trade_ends_at: settleDeadline })
        session.phase = "settling"
        session.trade_ends_at = settleDeadline
        await settle(session)
        return
      }

      // Sincroniza o timer com a expiracao REAL da corretora, se divergir.
      if (snap.expiryRaw) {
        const resolved = resolveBrokerExpiry(snap.expiryRaw, now, session.config.expiration)
        if (resolved != null && Math.abs(resolved - endsMs) > 1500 && resolved > now) {
          const synced = new Date(resolved).toISOString()
          console.log(`[v0] sincronizando timer tx#${session.active_tx_id} -> ${synced} (raw ${snap.expiryRaw})`)
          await patchSession(session.id, { trade_ends_at: synced, tick_lock: null })
          return
        }
      }

      // Nada a fazer nos ultimos segundos: solta o lock e espera o proximo tick.
      await patchSession(session.id, { tick_lock: null })
      return
    }

    // Expirou (vela fechada): agora sim entra em "settling" e settle() dispara
    // o settlement pelo preco de fechamento — resultado 100% igual a corretora.
    const settleDeadline = new Date(now + SETTLE_WINDOW_MS).toISOString()
    await patchSession(session.id, { phase: "settling", trade_ends_at: settleDeadline })
    session.phase = "settling"
    session.trade_ends_at = settleDeadline
    await settle(session)
    return
  }

  // Sem operacao aberta (placing/between): a IA SO entra na ABERTURA da vela
  // (segundo :00 do timeframe), NUNCA no meio. Usamos o horario agendado em
  // trade_ends_at como alvo; se nao houver, miramos a proxima abertura de vela.
  {
    const now = Date.now()
    const step = candleStepMs(session.config.expiration)
    const scheduled = session.trade_ends_at
      ? new Date(session.trade_ends_at).getTime()
      : candleOpenMs(now, session.config.expiration) + step
    const decision = decideEntry(now, session.config.expiration, scheduled)

    if (decision.action === "wait") {
      // Salva o alvo (para a UI mostrar a contagem certa) e libera o lock.
      const targetIso = new Date(decision.target).toISOString()
      const patch: Record<string, unknown> = { tick_lock: null }
      if (session.trade_ends_at !== targetIso) patch.trade_ends_at = targetIso
      await patchSession(session.id, patch)
      return
    }

    // action === "place": dorme o tempo EXATO que falta e entra cravado no :00.
    if (decision.sleepMs > 0) {
      console.log(
        `[v0] aguardando abertura da vela: dormindo ${decision.sleepMs}ms ate ${new Date(decision.target).toISOString()}`,
      )
      await sleep(decision.sleepMs)
    }
    await placeNext(session)
    return
  }
}

// Reivindica e processa todas as sessoes ativas (usado pelo cron).
export async function tickAllSessions(): Promise<{ processed: number }> {
  const { data: sessions } = await supabase
    .from("ai_sessions")
    .select("*")
    .eq("status", "running")
    .returns<AiSession[]>()

  if (!sessions || sessions.length === 0) return { processed: 0 }

  let processed = 0
  for (const session of sessions) {
    const claimed = await claimSession(session)
    if (!claimed) continue
    try {
      await tickSession(session)
      processed++
    } catch (err) {
      console.log("[v0] tickSession error:", err instanceof Error ? err.message : err)
      await patchSession(session.id, { tick_lock: null })
    }
  }
  return { processed }
}

// Trava simples: evita dois processamentos simultaneos da mesma sessao.
// Reivindica se tick_lock estiver nulo ou velho (> 90s).
export async function claimSession(session: AiSession): Promise<boolean> {
  const now = Date.now()
  const lockedAt = session.tick_lock ? new Date(session.tick_lock).getTime() : 0
  if (lockedAt && now - lockedAt < 90_000) return false

  const nowIso = new Date(now).toISOString()
  const query = supabase.from("ai_sessions").update({ tick_lock: nowIso }).eq("id", session.id)

  if (session.tick_lock) {
    query.eq("tick_lock", session.tick_lock)
  } else {
    query.is("tick_lock", null)
  }

  const { data } = await query.select("id")
  return Array.isArray(data) && data.length > 0
}

export { OTC_SYMBOLS }

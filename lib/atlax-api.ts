// Constantes e helpers compartilhados para a integracao Atlax (server-side).
// Base oficial conforme a documentacao de integracao.
export const ATLAX_BASE = "https://trade.atlaxoption.com"

// Fuso horario do servidor da corretora. Os campos open_hour/close_hour vem
// nesse fuso (ex.: acoes US 09:30 ET aparecem como 11:30 = horario de Brasilia).
export const BROKER_TZ = "America/Sao_Paulo"

export type SymbolType = "crypto" | "forex" | "stocks"

export type SymbolMeta = {
  code: string
  name: string
  type: SymbolType
  isOtc: boolean
  // Janela de negociacao no fuso da corretora (BROKER_TZ).
  openHour: string // "HH:MM:SS"
  closeHour: string // "HH:MM:SS"
  // 1 = fecha aos fins de semana (forex/acoes); 0 = opera todo dia (cripto/OTC).
  blockedWeekend: boolean
}

// Catalogo de ativos com os codigos REAIS da corretora (conforme o retorno de
// /api/public/binary/symbols). As OTC usam sufixo "OTC" (sem underscore) e
// operam 24/7, inclusive fins de semana. Os ativos normais (forex/acoes/cripto)
// so operam dentro do horario abaixo e fecham no fim de semana quando marcado.
export const SYMBOL_CATALOG: SymbolMeta[] = [
  // ---- Cripto (24/7, inclusive fim de semana - cripto nao fecha) ----
  { code: "BTCUSDT", name: "Bitcoin", type: "crypto", isOtc: false, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  { code: "ADAUSDT", name: "ADA/USDT", type: "crypto", isOtc: false, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  { code: "BNBUSDT", name: "BNB/USDT", type: "crypto", isOtc: false, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  // ---- Forex / metais ----
  { code: "EURUSD", name: "EUR/USD", type: "forex", isOtc: false, openHour: "08:00:00", closeHour: "19:00:00", blockedWeekend: true },
  { code: "EURGBP", name: "EUR/GBP", type: "forex", isOtc: false, openHour: "08:00:00", closeHour: "19:00:00", blockedWeekend: true },
  { code: "AUDJPY", name: "AUD/JPY", type: "forex", isOtc: false, openHour: "08:00:00", closeHour: "19:00:00", blockedWeekend: true },
  { code: "XAUUSD", name: "XAU/USD", type: "forex", isOtc: false, openHour: "08:00:00", closeHour: "19:00:00", blockedWeekend: true },
  // ---- Acoes ----
  { code: "AAPL", name: "Apple", type: "stocks", isOtc: false, openHour: "11:30:00", closeHour: "17:59:59", blockedWeekend: true },
  { code: "NFLX", name: "Netflix", type: "stocks", isOtc: false, openHour: "11:30:00", closeHour: "17:59:59", blockedWeekend: true },
  { code: "FB", name: "Meta", type: "stocks", isOtc: false, openHour: "11:30:00", closeHour: "17:59:59", blockedWeekend: true },
  { code: "TSLA", name: "Tesla", type: "stocks", isOtc: false, openHour: "11:30:00", closeHour: "17:59:59", blockedWeekend: true },
  // ---- OTC (24/7, inclusive fim de semana) ----
  { code: "EURUSDOTC", name: "EUR/USD (OTC)", type: "forex", isOtc: true, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  { code: "EURGBPOTC", name: "EUR/GBP (OTC)", type: "forex", isOtc: true, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  { code: "AUDJPYOTC", name: "AUD/JPY (OTC)", type: "forex", isOtc: true, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  { code: "XAUUSDOTC", name: "XAU/USD (OTC)", type: "forex", isOtc: true, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  { code: "BTCUSDTOTC", name: "BTC/USDT (OTC)", type: "crypto", isOtc: true, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  { code: "LTCUSDTOTC", name: "LTC/USDT (OTC)", type: "crypto", isOtc: true, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  { code: "ADAUSDTOTC", name: "ADA/USDT (OTC)", type: "crypto", isOtc: true, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  { code: "BNBUSDTOTC", name: "BNB/USDT (OTC)", type: "crypto", isOtc: true, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  { code: "AAPLOTC", name: "Apple (OTC)", type: "stocks", isOtc: true, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  { code: "NFLXOTC", name: "Netflix (OTC)", type: "stocks", isOtc: true, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  { code: "FBOTC", name: "Meta (OTC)", type: "stocks", isOtc: true, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
  { code: "TSLAOTC", name: "Tesla (OTC)", type: "stocks", isOtc: true, openHour: "00:00:00", closeHour: "23:59:59", blockedWeekend: false },
]

const SYMBOL_BY_CODE: Record<string, SymbolMeta> = Object.fromEntries(SYMBOL_CATALOG.map((m) => [m.code, m]))

export function getSymbolMeta(code: string): SymbolMeta | undefined {
  return SYMBOL_BY_CODE[code]
}

// ---- Horario de mercado ---------------------------------------------------

function hmsToSeconds(hms: string): number {
  const [h, m, s] = hms.split(":").map((n) => Number.parseInt(n, 10) || 0)
  return h * 3600 + m * 60 + s
}

// Relogio atual no fuso da corretora: segundos desde 00:00 e se e fim de semana.
function brokerClock(now: Date = new Date()): { seconds: number; weekend: boolean } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: BROKER_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  })
  const parts = fmt.formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  let hour = Number.parseInt(get("hour"), 10) || 0
  if (hour === 24) hour = 0 // alguns ambientes retornam "24" a meia-noite
  const minute = Number.parseInt(get("minute"), 10) || 0
  const second = Number.parseInt(get("second"), 10) || 0
  const wd = get("weekday").toLowerCase()
  return { seconds: hour * 3600 + minute * 60 + second, weekend: wd === "sat" || wd === "sun" }
}

// Decide localmente se um ativo esta operavel AGORA, com base na janela de
// horario e no bloqueio de fim de semana. OTC (00:00-23:59, sem bloqueio de
// fim de semana) resulta sempre em aberto; forex/acoes so dentro do pregao.
export function isSymbolTradeable(meta: SymbolMeta, now: Date = new Date()): boolean {
  const { seconds, weekend } = brokerClock(now)
  if (meta.blockedWeekend && weekend) return false
  const open = hmsToSeconds(meta.openHour)
  const close = hmsToSeconds(meta.closeHour)
  if (open <= close) return seconds >= open && seconds <= close
  // Janela que cruza a meia-noite (raro): aberto se antes do fechamento ou apos a abertura.
  return seconds >= open || seconds <= close
}

// Lista de fallback de simbolos (a conta pode nao ter permissao no endpoint
// /api/public/binary/symbols, que retorna 401). Inclui status de abertura
// calculado localmente para a UI.
export const FALLBACK_SYMBOLS = SYMBOL_CATALOG.map((m) => ({
  symbol: m.code,
  name: m.name,
  type: m.type,
  isOtc: m.isOtc,
  isOpen: isSymbolTradeable(m),
}))

// Precos padrao por simbolo. symbol_price e OBRIGATORIO na API e nao pode ser 0.
export const PRICE_DEFAULTS: Record<string, number> = {
  // Cripto
  BTCUSDT: 88000,
  ADAUSDT: 0.58,
  BNBUSDT: 631,
  // Forex / metais
  EURUSD: 1.06,
  EURGBP: 0.83,
  AUDJPY: 101,
  XAUUSD: 2600,
  // Acoes
  AAPL: 224,
  NFLX: 817,
  FB: 586,
  TSLA: 329,
  // OTC (espelham o ativo real)
  EURUSDOTC: 1.06,
  EURGBPOTC: 0.8,
  AUDJPYOTC: 95,
  XAUUSDOTC: 2604,
  BTCUSDTOTC: 87000,
  LTCUSDTOTC: 78,
  ADAUSDTOTC: 0.6,
  BNBUSDTOTC: 625,
  AAPLOTC: 228,
  NFLXOTC: 784,
  FBOTC: 567,
  TSLAOTC: 340,
}

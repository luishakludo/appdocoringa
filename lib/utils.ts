import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Nomes amigaveis para acoes/cripto cujo code nao vira par com "/".
const SYMBOL_NAMES: Record<string, string> = {
  BTCUSDT: "BTC/USDT",
  ADAUSDT: "ADA/USDT",
  BNBUSDT: "BNB/USDT",
  LTCUSDT: "LTC/USDT",
  AAPL: "Apple",
  NFLX: "Netflix",
  FB: "Meta",
  TSLA: "Tesla",
}

/**
 * Formata o code bruto da corretora (ex: "ADAUSDTOTC") em um nome bonito para
 * exibir ao usuario (ex: "ADA/USDT (OTC)"). Sempre tenta inserir a barra de
 * separacao; o sufixo "(OTC)" so aparece quando a moeda e OTC.
 */
export function formatSymbol(raw?: string | null): string {
  if (!raw) return "—"
  let code = raw.trim().toUpperCase()

  // Detecta e remove o sufixo OTC.
  const isOtc = code.endsWith("OTC")
  if (isOtc) code = code.slice(0, -3)

  let base: string
  if (SYMBOL_NAMES[code]) {
    base = SYMBOL_NAMES[code]
  } else if (code.endsWith("USDT")) {
    base = `${code.slice(0, -4)}/USDT`
  } else if (code.endsWith("USD") && code.length === 6) {
    // Forex / metais de 6 letras (EURUSD, XAUUSD, ...).
    base = `${code.slice(0, 3)}/${code.slice(3)}`
  } else if (code.length === 6) {
    // Outros pares forex de 6 letras (EURGBP, AUDJPY, ...).
    base = `${code.slice(0, 3)}/${code.slice(3)}`
  } else {
    base = code
  }

  return isOtc ? `${base} (OTC)` : base
}

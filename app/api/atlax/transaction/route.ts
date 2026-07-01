import { NextResponse } from "next/server"
import { ATLAX_BASE, PRICE_DEFAULTS } from "@/lib/atlax-api"

// Busca o preco real ao vivo do ativo. Para pares cripto (*USDT) usa a API
// publica da Coinbase (Binance e bloqueada no servidor). Para os demais usa o
// preco padrao. O symbol_price precisa estar proximo do mercado, senao a
// corretora retorna 500.
async function fetchLivePrice(symbol: string): Promise<number> {
  const fallback = PRICE_DEFAULTS[symbol] || 1.0
  if (!symbol.endsWith("USDT")) return fallback
  const base = symbol.slice(0, -4) // BTCUSDT -> BTC
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
    // ignora e usa o fallback
  }
  return fallback
}

// POST /api/atlax/transaction
// Proxy para PUT https://atlaxoption.com/api/public/applications/transaction
// Body (JSON): { token, symbol, direction, expiration, amount, symbolPrice? }
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string
      symbol?: string
      direction?: number
      expiration?: number
      amount?: number
      symbolPrice?: number
    }

    const { token, symbol, direction, expiration, amount } = body

    if (!token || !symbol || direction === undefined || !expiration || !amount) {
      return NextResponse.json({ success: false, message: "Parâmetros obrigatórios ausentes." }, { status: 400 })
    }

    // amount deve estar em formato decimal (ex: 5.00, nao 5)
    const formattedAmount = Number(amount).toFixed(2)

    // symbol_price e OBRIGATORIO e nao pode ser 0.
    // A corretora retorna 500 quando o preco enviado esta defasado do mercado,
    // entao buscamos o preco real ao vivo (Binance) para pares *USDT.
    let symbolPrice = body.symbolPrice
    if (!symbolPrice || symbolPrice === 0) {
      symbolPrice = await fetchLivePrice(symbol)
    }

    const params = new URLSearchParams()
    params.append("transaction_account_id", "0")
    params.append("expiration", String(expiration))
    params.append("amount", formattedAmount)
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
      console.log(
        "[v0] atlax transaction rejected:",
        res.status,
        "symbol:",
        symbol,
        "price:",
        symbolPrice,
        "exp:",
        expiration,
        "broker:",
        JSON.stringify(data),
      )
      return NextResponse.json(
        {
          success: false,
          message: data.message || data.error || "Não foi possível executar a operação.",
          raw: data,
        },
        { status: res.ok ? 422 : res.status },
      )
    }

    return NextResponse.json({
      success: true,
      transactionId: data.transaction_id as number,
      status: data.status as string,
      amount: data.amount as string,
      odd: data.odd as number,
      symbol: data.symbol as string,
      symbolPrice: data.symbol_price as number,
      direction: data.direction as string,
      expirationDate: data.expiration_date as string,
      userCredit: data.user_credit as string,
      raw: data,
    })
  } catch (err) {
    console.log("[v0] atlax transaction error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, message: "Erro ao conectar com a corretora." }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { ATLAX_BASE, FALLBACK_SYMBOLS } from "@/lib/atlax-api"

// GET /api/atlax/symbols
// Tenta GET https://atlaxoption.com/api/public/binary/symbols.
// A conta pode retornar 401 ("Insufficient permissions"); nesse caso usa
// a lista de fallback hardcoded, conforme a documentacao.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const headerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const token = headerToken || url.searchParams.get("token") || ""

  try {
    if (token) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const res = await fetch(`${ATLAX_BASE}/api/public/binary/symbols`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const raw = (data.symbols ?? data ?? []) as Array<{
          code?: string
          symbol?: string
          name?: string
          type?: string
          is_otc?: number
          is_market_open?: number
        }>
        if (Array.isArray(raw) && raw.length > 0) {
          // Normaliza para o formato usado pelo app (a API usa `code`).
          const symbols = raw.map((s) => ({
            symbol: s.code ?? s.symbol ?? "",
            name: s.name ?? s.code ?? s.symbol ?? "",
            type: s.type,
            isOtc: s.is_otc === 1,
            isOpen: s.is_market_open === 1,
          }))
          return NextResponse.json({ symbols })
        }
      }
    }
  } catch (err) {
    console.log("[v0] atlax symbols fallback:", err instanceof Error ? err.message : err)
  }

  return NextResponse.json({ symbols: FALLBACK_SYMBOLS })
}

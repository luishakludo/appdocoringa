import { NextResponse } from "next/server"
import { ATLAX_BASE } from "@/lib/atlax-api"

// GET /api/atlax/balance
// Proxy para GET https://atlaxoption.com/api/public/users/balance
// Token enviado no header Authorization: Bearer <token> ou ?token=
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const headerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    const token = headerToken || url.searchParams.get("token") || ""

    if (!token) {
      return NextResponse.json({ message: "Token ausente." }, { status: 401 })
    }

    const res = await fetch(`${ATLAX_BASE}/api/public/users/balance`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json({ message: data.message || "Não foi possível obter o saldo." }, { status: res.status })
    }

    return NextResponse.json({
      id: data.id as number,
      login: data.login as string,
      credit: data.credit as string,
      creditCents: data.credit_cents as number,
      freebet: data.freebet as string,
      freebetCents: data.freebet_cents as number,
      bonus: data.bonus as string,
      bonusCents: data.bonus_cents as number,
    })
  } catch (err) {
    console.log("[v0] atlax balance error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ message: "Erro ao conectar com a corretora." }, { status: 500 })
  }
}

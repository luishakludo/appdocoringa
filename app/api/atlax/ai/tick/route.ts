import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { tickAllSessions, tickSession, claimSession, type AiSession } from "@/lib/ai-engine"

export const maxDuration = 60
export const dynamic = "force-dynamic"

// GET /api/atlax/ai/tick
// Disparado por um cron EXTERNO (ex.: cron-job.org) a cada minuto: avanca
// TODAS as sessoes ativas. Protegido por CRON_SECRET para impedir chamadas
// nao autorizadas. O servico de cron deve enviar UMA das opcoes:
//   - Header:  Authorization: Bearer <CRON_SECRET>
//   - Query:   /api/atlax/ai/tick?secret=<CRON_SECRET>
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET
    if (secret) {
      const url = new URL(request.url)
      const headerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
      const queryToken = url.searchParams.get("secret")
      if (headerToken !== secret && queryToken !== secret) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
      }
    }

    const result = await tickAllSessions()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.log("[v0] ai tick(GET) error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

// POST /api/atlax/ai/tick  Body: { userId }
// Disparado pelo cliente enquanto o app esta aberto, para reagir mais rapido
// (avanca apenas a sessao do usuario).
export async function POST(request: Request) {
  try {
    const { userId } = (await request.json()) as { userId?: number }
    if (!userId) return NextResponse.json({ ok: false }, { status: 400 })

    const { data: session } = await supabase
      .from("ai_sessions")
      .select("*")
      .eq("atlax_user_id", userId)
      .eq("status", "running")
      .maybeSingle<AiSession>()

    if (!session) return NextResponse.json({ ok: true, processed: 0 })

    const claimed = await claimSession(session)
    if (!claimed) return NextResponse.json({ ok: true, processed: 0 })

    await tickSession(session)
    return NextResponse.json({ ok: true, processed: 1 })
  } catch (err) {
    console.log("[v0] ai tick(POST) error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

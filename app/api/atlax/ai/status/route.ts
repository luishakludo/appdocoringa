import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import type { AiSession } from "@/lib/ai-engine"

// GET /api/atlax/ai/status?userId=123
// Retorna a sessao mais recente da IA + operacoes dessa sessao.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const userId = Number(url.searchParams.get("userId"))
    if (!userId) {
      return NextResponse.json({ session: null, ops: [] }, { status: 200 })
    }

    const { data: session } = await supabase
      .from("ai_sessions")
      .select("*")
      .eq("atlax_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<AiSession>()

    if (!session) {
      return NextResponse.json({ session: null, ops: [] })
    }

    const { data: ops } = await supabase
      .from("ai_operations")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        finishReason: session.finish_reason,
        phase: session.phase,
        config: session.config,
        sessionPnl: Number(session.session_pnl),
        startBalance: Number(session.start_balance),
        currentSymbol: session.current_symbol,
        currentDirection: session.current_direction,
        currentAmount: Number(session.current_amount),
        tradeEndsAt: session.trade_ends_at,
        reentryCount: session.reentry_count,
        lastError: session.last_error,
      },
      ops: ops ?? [],
    })
  } catch (err) {
    console.log("[v0] ai status error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ session: null, ops: [] }, { status: 500 })
  }
}

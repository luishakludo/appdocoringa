import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import type { AiSession } from "@/lib/ai-engine"

// POST /api/atlax/ai/stop
// Body: { atlaxUserId }
// Regra: NUNCA para no meio de uma operacao. Se houver uma operacao em
// andamento (aberta ou em liquidacao), apenas marca a parada e a IA encerra
// ao FIM dessa operacao. Sem operacao ativa, encerra imediatamente.
export async function POST(request: Request) {
  try {
    const { atlaxUserId, force } = (await request.json()) as { atlaxUserId?: number; force?: boolean }
    if (!atlaxUserId) {
      return NextResponse.json({ success: false, message: "Usuario ausente." }, { status: 400 })
    }

    const { data: session } = await supabase
      .from("ai_sessions")
      .select("*")
      .eq("atlax_user_id", atlaxUserId)
      .eq("status", "running")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<AiSession>()

    if (!session) {
      return NextResponse.json({ success: true })
    }

    // Operacao em andamento (vela aberta ou aguardando liquidacao do resultado).
    const opInProgress = session.active_tx_id != null || session.phase === "running" || session.phase === "settling"

    // Encerramento forcado: o usuario confirmou no popup que quer parar AGORA,
    // mesmo com uma operacao em andamento. A operacao aberta permanece com
    // status "aberto" no historico (nao aguardamos a liquidacao).
    if (force) {
      await supabase
        .from("ai_sessions")
        .update({
          status: "finished",
          finish_reason: "manual",
          phase: "finished",
          active_tx_id: null,
          active_op_id: null,
          trade_ends_at: null,
          tick_lock: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id)
        .eq("status", "running")

      return NextResponse.json({ success: true })
    }

    if (opInProgress) {
      // Agenda a parada: encerra ao fim da operacao atual (ver settle()).
      await supabase
        .from("ai_sessions")
        .update({
          config: { ...session.config, stopRequested: true },
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id)

      return NextResponse.json({ success: true, pending: true })
    }

    // Sem operacao ativa: encerra na hora.
    await supabase
      .from("ai_sessions")
      .update({
        status: "finished",
        finish_reason: "manual",
        phase: "finished",
        active_tx_id: null,
        active_op_id: null,
        trade_ends_at: null,
        tick_lock: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .eq("status", "running")

    return NextResponse.json({ success: true })
  } catch (err) {
    console.log("[v0] ai stop error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, message: "Erro ao parar a IA." }, { status: 500 })
  }
}

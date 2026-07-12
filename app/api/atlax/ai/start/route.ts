import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { pickTradeableSymbol, fetchBrokerBalance, nextCandleBoundaryMs, tickSession, type AiSession } from "@/lib/ai-engine"

export const maxDuration = 60

// POST /api/atlax/ai/start
// Body: { token, atlaxUserId, amount, expiration, stopWinPct, stopLossPct, reentries }
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string
      atlaxUserId?: number
      amount?: number
      expiration?: number
      stopWinPct?: number
      stopLossPct?: number
      reentries?: number
    }

    const { token, atlaxUserId } = body
    if (!token || !atlaxUserId) {
      return NextResponse.json({ success: false, message: "Sessao da corretora ausente." }, { status: 400 })
    }

    const amount = Number(body.amount) || 0
    const expiration = Number(body.expiration) || 1
    const stopWinPct = Number(body.stopWinPct) || 0
    const stopLossPct = Number(body.stopLossPct) || 0
    const reentries = Number(body.reentries) || 0

    if (amount < 5 || stopWinPct <= 0 || stopLossPct <= 0) {
      return NextResponse.json({ success: false, message: "Configuracao invalida." }, { status: 400 })
    }

    // Saldo inicial (base para calcular stop win/loss em R$).
    const startBalance = (await fetchBrokerBalance(token)) ?? 0
    const stopWin = startBalance * (stopWinPct / 100)
    const stopLoss = startBalance * (stopLossPct / 100)

    // Encerra qualquer sessao ativa anterior deste usuario.
    await supabase
      .from("ai_sessions")
      .update({ status: "finished", finish_reason: "manual", phase: "finished", updated_at: new Date().toISOString() })
      .eq("atlax_user_id", atlaxUserId)
      .eq("status", "running")

    const config = { amount, expiration, stopWin, stopLoss, stopWinPct, stopLossPct, reentries }

    // A IA NUNCA entra na hora do clique: ela aguarda a abertura da proxima
    // vela do timeframe (segundo :00), exatamente como a corretora. Ex.: M1
    // iniciada 21:15:15 -> primeira operacao 21:16:00 -> fecha 21:17:00.
    // Reutilizamos trade_ends_at como "horario agendado" (sem operacao aberta).
    const scheduledStart = new Date(nextCandleBoundaryMs(expiration)).toISOString()

    // Ja escolhemos o ativo/direcao ANTES de esperar, para que a tela mostre
    // "entrando em X na abertura da vela". Guardamos em current_symbol/
    // current_direction (exibicao) e em pending_reentry (para que a primeira
    // operacao use exatamente esse ativo na abertura da vela).
    const planned = {
      symbol: await pickTradeableSymbol(token),
      direction: (Math.random() > 0.5 ? 1 : 0) as 0 | 1,
    }

    const { data: session, error } = await supabase
      .from("ai_sessions")
      .insert({
        atlax_user_id: atlaxUserId,
        atlax_token: token,
        status: "running",
        config,
        start_balance: startBalance,
        balance_before: startBalance,
        session_pnl: 0,
        phase: "placing",
        reentry_count: 0,
        trade_ends_at: scheduledStart,
        current_symbol: planned?.symbol ?? null,
        current_direction: planned ? planned.direction : null,
        current_amount: planned ? amount : 0,
        pending_reentry: planned ? { symbol: planned.symbol, direction: planned.direction, amount } : null,
      })
      .select("*")
      .single<AiSession>()

    if (error || !session) {
      console.log("[v0] ai start insert error:", error?.message)
      return NextResponse.json({ success: false, message: "Nao foi possivel iniciar a IA." }, { status: 500 })
    }

    // Em M1/M2 abre a primeira operacao imediatamente; em M5 o tick apenas
    // registra o agendamento e aguarda a abertura da vela (o cron assume).
    await tickSession(session)

    return NextResponse.json({ success: true, sessionId: session.id })
  } catch (err) {
    console.log("[v0] ai start error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, message: "Erro ao iniciar a IA." }, { status: 500 })
  }
}

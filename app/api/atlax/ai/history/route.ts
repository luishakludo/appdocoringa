import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// GET /api/atlax/ai/history?userId=123
// Historico de operacoes (todas as sessoes) do usuario.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const userId = Number(url.searchParams.get("userId"))
    if (!userId) return NextResponse.json({ ops: [] })

    const { data: ops } = await supabase
      .from("ai_operations")
      .select("*")
      .eq("atlax_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200)

    return NextResponse.json({ ops: ops ?? [] })
  } catch (err) {
    console.log("[v0] ai history error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ ops: [] }, { status: 500 })
  }
}

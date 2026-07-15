import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// POST /api/atlax/push/subscribe
// Body: { userId: number, subscription: PushSubscriptionJSON }
// Salva (ou atualiza) a inscricao Web Push do usuario. O endpoint e unico,
// entao reinscricoes do mesmo dispositivo apenas atualizam as chaves.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      userId?: number
      subscription?: {
        endpoint?: string
        keys?: { p256dh?: string; auth?: string }
      }
      userAgent?: string
    }

    const userId = Number(body.userId)
    const sub = body.subscription
    if (!userId || !sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return NextResponse.json({ ok: false, error: "dados invalidos" }, { status: 400 })
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        atlax_user_id: userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: body.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    )

    if (error) {
      console.log("[v0] push subscribe error:", error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.log("[v0] push subscribe error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

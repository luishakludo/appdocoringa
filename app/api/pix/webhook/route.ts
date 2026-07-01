import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { activateVipForPurchase } from "@/lib/adm"

// Webhook da Buck Pay. Registrar esta URL no painel:
//   https://SEU_DOMINIO/api/pix/webhook
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, message: "Body invalido" }, { status: 400 })
    }

    // A Buck Pay pode enviar os dados na raiz ou dentro de "data".
    const payload = body.data ?? body
    const externalId: string | undefined = payload.external_id
    const rawStatus: string | undefined = payload.status

    if (!externalId || !rawStatus) {
      return NextResponse.json({ success: false, message: "Campos faltando" }, { status: 400 })
    }

    // Normaliza o status recebido para os valores aceitos pela tabela.
    const s = rawStatus.toLowerCase()
    let status: "pending" | "paid" | "failed" | "expired" = "pending"
    if (["paid", "approved", "completed", "succeeded", "confirmed"].includes(s)) status = "paid"
    else if (["expired", "canceled", "cancelled"].includes(s)) status = "expired"
    else if (["failed", "refused", "denied", "error", "chargeback", "refunded"].includes(s)) status = "failed"

    const { data: tx } = await supabase
      .from("pix_transactions")
      .select("id, user_id, buyer_email, plan_id, status")
      .eq("external_id", externalId)
      .maybeSingle()

    if (!tx) {
      console.log("[v0] Webhook: transacao nao encontrada:", externalId)
      return NextResponse.json({ success: false, message: "Transaction not found" })
    }

    const patch: Record<string, unknown> = { status }
    if (status === "paid") {
      patch.paid_at = payload.paid_at ?? new Date().toISOString()
    }

    await supabase.from("pix_transactions").update(patch).eq("external_id", externalId)

    // Pagamento confirmado -> libera/renova o VIP do comprador automaticamente,
    // usando a quantidade de dias definida no plano. So ativa na PRIMEIRA vez que
    // a transacao vira "paid" (evita reprocessar webhooks repetidos).
    if (status === "paid" && (tx as { status?: string }).status !== "paid") {
      try {
        const t = tx as { user_id: string | null; buyer_email: string | null; plan_id: string | null }
        await activateVipForPurchase({
          userId: t.user_id,
          buyerEmail: t.buyer_email ?? "",
          planId: t.plan_id,
        })
      } catch (err) {
        console.log("[v0] Webhook: falha ao ativar VIP:", (err as Error).message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.log("[v0] /api/pix/webhook falhou:", (e as Error).message)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const externalId = searchParams.get("externalId")

  if (!externalId) {
    return NextResponse.json({ error: "externalId obrigatorio." }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("pix_transactions")
    .select("external_id, status, amount, paid_at")
    .eq("external_id", externalId)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: "Transacao nao encontrada." }, { status: 404 })
  }

  return NextResponse.json({
    externalId: data.external_id,
    status: data.status,
    amount: data.amount,
    paidAt: data.paid_at,
  })
}

import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const BUCKPAY_URL = "https://api.realtechdev.com.br/v1/transactions"

// Conta especial: coringa@gmail.com NAO usa a Buck Pay (PIX). Ao comprar,
// o usuario e redirecionado para este checkout externo (Cakto).
const CORINGA_CHECKOUT = {
  email: "coringa@gmail.com",
  url: "https://pay.cakto.com.br/o4kdzy3",
}

// Split fixo da plataforma: 30% de TODO pagamento vai para esta conta,
// independentemente de qual admin configurou a propria Secret Key.
const PLATFORM_SPLIT_EMAIL = "luishenriquecruz1520@gmail.com"
const PLATFORM_SPLIT_BPS = 3000 // 30% (em basis points: 100% = 10000)

function genExternalId() {
  return `pix-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

// A Secret Key costuma vir do copiar/colar com lixo invisivel que faz a Buck Pay
// devolver 401 mesmo a conta estando 100%: espacos, quebras de linha, caractere
// de largura-zero (\u200B-\u200D\uFEFF) ou um prefixo "Bearer " acidental.
// Removemos TUDO que nao faz parte de uma chave valida (sk_... + hex/alfanumerico).
function sanitizeKey(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // largura zero / BOM
    .replace(/\s+/g, "") // qualquer espaco, tab ou quebra de linha
    .replace(/^Bearer/i, "") // prefixo "Bearer" colado por engano
    .trim()
}

// A Buck Pay devolve erros em formatos variados:
//   "mensagem"  |  { message: "..." }  |  { buyer: ["Email invalido"] }
// Essa funcao achata qualquer um deles em uma string legivel.
function flattenError(input: unknown): string {
  if (!input) return ""
  if (typeof input === "string") return input
  if (Array.isArray(input)) return input.map(flattenError).filter(Boolean).join(", ")
  if (typeof input === "object") {
    return Object.values(input as Record<string, unknown>)
      .map(flattenError)
      .filter(Boolean)
      .join(", ")
  }
  return String(input)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      planId,
      adminId,
      userId,
      buyerName,
      buyerEmail,
    }: {
      planId?: string
      adminId?: string
      userId?: string
      buyerName?: string
      buyerEmail?: string
    } = body

    if (!planId) {
      return NextResponse.json({ error: "Plano nao informado." }, { status: 400 })
    }

    // 1. Buscar o plano para descobrir o valor real (em reais -> centavos).
    const { data: plan } = await supabase.from("plans").select("*").eq("id", planId).maybeSingle()
    if (!plan) {
      return NextResponse.json({ error: "Plano nao encontrado." }, { status: 404 })
    }

    // Descobrir o admin DONO do plano (email + secret key) numa unica consulta.
    const ownerAdminId = plan.admin_id || adminId
    let secretKey = ""
    let ownerEmail = ""
    if (ownerAdminId) {
      const { data: admin } = await supabase
        .from("admins")
        .select("gateway_secret_key, email")
        .eq("id", ownerAdminId)
        .maybeSingle()
      secretKey = sanitizeKey(admin?.gateway_secret_key)
      ownerEmail = String(admin?.email ?? "").trim().toLowerCase()
    }

    // Conta especial (coringa@gmail.com): NAO gera PIX pela Buck Pay.
    // Redireciona o comprador para o checkout externo (Cakto).
    if (ownerEmail === CORINGA_CHECKOUT.email) {
      return NextResponse.json({ redirectUrl: CORINGA_CHECKOUT.url })
    }

    // Primeira cobranca = first_price (cai para recurring se 0).
    const priceReais = Number(plan.first_price) > 0 ? Number(plan.first_price) : Number(plan.recurring_price)
    const amount = Math.round(priceReais * 100)

    if (!amount || amount < 600) {
      return NextResponse.json({ error: "Valor do plano invalido (minimo R$ 6,00)." }, { status: 400 })
    }

    // 2. A secret key do admin DONO do plano ja foi resolvida acima.
    //    Cada PIX e gerado SEMPRE na conta Buck Pay do proprio admin.
    //    Sem chave configurada, NAO geramos o PIX (nunca usamos chave de terceiros).
    console.log(
      "[v0] Buckpay key check -> admin:",
      ownerAdminId,
      "len:",
      secretKey.length,
      "prefix:",
      secretKey.slice(0, 11),
    )

    if (!secretKey) {
      return NextResponse.json(
        { error: "O gateway de pagamento ainda nao foi configurado. Fale com o suporte." },
        { status: 503 },
      )
    }

    if (!secretKey.startsWith("sk_")) {
      return NextResponse.json(
        { error: "A chave do gateway parece invalida. Verifique a Secret Key no painel." },
        { status: 400 },
      )
    }

    const externalId = genExternalId()

    // Nome: a Buck Pay exige 3-100 chars, apenas letras/espacos/hifens/apostrofos.
    const rawName = (buyerName ?? "").trim().replace(/[^A-Za-zÀ-ÿ\s'-]/g, "")
    const name = rawName.length >= 3 ? rawName.slice(0, 100) : "Cliente Coringa"

    // Email: o login da Atlax NAO e um email, entao a Buck Pay rejeita.
    // Validamos e, se nao for um email valido, geramos um fallback valido.
    const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
    const candidateEmail = (buyerEmail ?? "").trim().toLowerCase()
    const email = isValidEmail(candidateEmail) ? candidateEmail : `${externalId}@coringa.app`

    // 3. Gerar o PIX na Buck Pay.
    const effectiveExternalId = externalId

    const basePayload = {
      external_id: externalId,
      payment_method: "pix" as const,
      amount,
      buyer: { name, email },
    }

    async function createTransaction(withSplit: boolean) {
      const payload = withSplit
        ? { ...basePayload, splits: [{ email: PLATFORM_SPLIT_EMAIL, percentage_bps: PLATFORM_SPLIT_BPS }] }
        : basePayload
      const r = await fetch(BUCKPAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "User-Agent": "Buckpay API",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      const j = await r.json().catch(() => null)
      return { r, j }
    }

    // Tenta primeiro COM split (30% da plataforma). Se a Buck Pay recusar e o
    // problema puder ser o split (ex.: conta da plataforma nao habilitada para
    // receber split), refaz a cobranca SEM split para o lead nunca ficar sem PIX.
    let { r: res, j: json } = await createTransaction(true)
    if ((!res.ok || !json?.data?.pix?.code) && res.status !== 401 && res.status !== 403) {
      console.log("[v0] Buckpay falhou com split, tentando sem split:", res.status, JSON.stringify(json))
      const retry = await createTransaction(false)
      // So usa o resultado sem split se ele realmente funcionou.
      if (retry.r.ok && retry.j?.data?.pix?.code) {
        res = retry.r
        json = retry.j
      }
    }

    if (!res.ok || !json?.data?.pix?.code) {
      console.log("[v0] Buckpay erro:", res.status, JSON.stringify(json))
      const apiMsg = flattenError(json?.message ?? json?.error ?? json?.errors ?? json?.data?.message)
      let msg = "Nao foi possivel gerar o PIX. Tente novamente."
      if (res.status === 401) {
        msg = "Chave do gateway invalida. Verifique a Secret Key no painel."
      } else if (res.status === 403) {
        msg = "A conta do gateway esta bloqueada. Contate o suporte da Buck Pay."
      } else if (res.status >= 500) {
        // A Buck Pay autentica e valida o payload, mas falha ao acionar a
        // adquirente. Isso indica conta ainda nao habilitada para emitir PIX.
        msg =
          "O gateway (Buck Pay) recusou a cobranca por um erro interno na adquirente. " +
          "Isso costuma significar que a conta ainda nao esta 100% habilitada para gerar PIX em producao. " +
          "Verifique no painel da Buck Pay se o cadastro/KYC e a conta de recebimento estao aprovados, ou contate o suporte da Buck Pay."
      } else if (apiMsg) {
        msg = apiMsg
      }
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const pixCode = json.data.pix.code as string
    const qrcode = (json.data.pix.qrcode_base64 as string) ?? ""
    const providerId = (json.data.id as string) ?? ""

    // 4. Registrar a transacao no banco para o webhook/polling.
    await supabase.from("pix_transactions").insert({
      external_id: effectiveExternalId,
      provider_id: providerId,
      admin_id: ownerAdminId || null,
      user_id: userId || null,
      plan_id: planId,
      plan_name: plan.name ?? "",
      buyer_name: name,
      buyer_email: email,
      amount,
      status: "pending",
      pix_code: pixCode,
      qrcode_base64: qrcode,
    })

    return NextResponse.json({
      externalId: effectiveExternalId,
      pixCode,
      qrcodeBase64: qrcode,
      amount,
      status: "pending",
    })
  } catch (e) {
    console.log("[v0] /api/pix/generate falhou:", (e as Error).message)
    return NextResponse.json({ error: "Erro interno ao gerar o PIX." }, { status: 500 })
  }
}

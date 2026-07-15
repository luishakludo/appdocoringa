import { NextResponse } from "next/server"
import { ATLAX_BASE } from "@/lib/atlax-api"

// POST /api/atlax/login
// Proxy seguro para POST https://atlaxoption.com/api/login
// Body esperado (JSON): { user, pass }
export async function POST(request: Request) {
  try {
    const { user, pass } = (await request.json()) as { user?: string; pass?: string }

    if (!user || !pass) {
      return NextResponse.json({ success: false, message: "Usuário e senha são obrigatórios." }, { status: 400 })
    }

    const params = new URLSearchParams()
    params.append("user", user)
    params.append("pass", pass)

    const res = await fetch(`${ATLAX_BASE}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    })

    const data = await res.json().catch(() => ({}))

    if (data.status !== "success" || !data.access_token) {
      return NextResponse.json(
        { success: false, message: data.message || "Credenciais inválidas." },
        { status: 401 },
      )
    }

    // A Atlax pode retornar o e-mail real em campos com nomes diferentes.
    // Pegamos o primeiro que existir; se nenhum vier, fica string vazia.
    const email =
      (data.email as string) ||
      (data.mail as string) ||
      (data.user_email as string) ||
      ""

    return NextResponse.json({
      success: true,
      accessToken: data.access_token as string,
      id: data.id as number,
      login: data.login as string,
      name: data.name as string,
      email,
      credit: data.credit as string,
      creditCents: data.credit_cents as number,
    })
  } catch (err) {
    console.log("[v0] atlax login error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, message: "Erro ao conectar com a corretora." }, { status: 500 })
  }
}

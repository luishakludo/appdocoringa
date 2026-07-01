"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ArrowRight, ArrowLeft, Copy, QrCode, Loader2, ShieldCheck, CheckCircle2, Crown, CalendarClock, Infinity as InfinityIcon } from "lucide-react"
import {
  listActivePlans,
  planPeriodLabel,
  getSupremeAdminId,
  getUserVipByEmail,
  type Plan,
  type VipStatus,
} from "@/lib/adm"
import { getUserSession } from "@/lib/user-session"
import { getDemoSession } from "@/lib/demo-session"
import { getAtlaxSession } from "@/lib/atlax-session"

function formatPrice(value: number, currency = "BRL") {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value)
  } catch {
    return `R$ ${value.toFixed(2)}`
  }
}

// Define como exibir o preco principal de um plano.
function priceInfo(p: Plan) {
  const period = planPeriodLabel(p.period).toLowerCase()
  if (Number(p.recurring_price) === 0) {
    return { main: formatPrice(p.first_price, p.currency), note: "pagamento único" }
  }
  if (Number(p.first_price) !== Number(p.recurring_price)) {
    return {
      main: formatPrice(p.first_price, p.currency),
      note: `na 1ª cobrança · depois ${formatPrice(p.recurring_price, p.currency)}`,
    }
  }
  return { main: formatPrice(p.recurring_price, p.currency), note: `por ${period}` }
}

type Screen = "list" | "benefits" | "pix"

type PixData = {
  externalId: string
  pixCode: string
  qrcodeBase64: string
  amount: number
  status: string
}

export function VipContent() {
  const [screen, setScreen] = useState<Screen>("list")
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [vip, setVip] = useState<VipStatus | null>(null)

  // Carrega o status de VIP do usuario logado (conta real). Se ativo, mostramos
  // o resumo do plano em vez da lista de planos. Conta demo nao tem VIP proprio.
  useEffect(() => {
    let active = true
    ;(async () => {
      const email = getUserSession()?.email || getAtlaxSession()?.user.login || ""
      if (!email) return
      const { ok, status } = await getUserVipByEmail(email)
      if (active && ok) setVip(status)
    })()
    return () => {
      active = false
    }
  }, [])

  // Carregar planos reais do adm dono do usuario.
  useEffect(() => {
    let active = true
    ;(async () => {
      // A base do usuario pode vir da conta real (Atlax) OU da conta demo.
      // A conta demo guarda o adminId na sua propria sessao (nao em getUserSession).
      // Por isso checamos as duas antes de cair no fallback do adm supremo.
      const userSession = getUserSession()
      const demoSession = getDemoSession()
      const adminId =
        userSession?.admin_id || demoSession?.adminId || (await getSupremeAdminId())
      if (!adminId) {
        if (active) setLoading(false)
        return
      }
      const { data } = await listActivePlans(adminId)
      if (!active) return
      setPlans(data)
      if (data.length > 0) {
        const popular = data.find((p) => p.is_popular)
        setSelectedId(popular?.id ?? data[0].id)
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedId) ?? null, [plans, selectedId])

  // Usuario com VIP ativo: mostra o resumo da assinatura (dias restantes) em vez
  // da lista de planos.
  if (vip?.isVip) {
    return <VipSummary vip={vip} />
  }

  if (loading) {
    return (
      <div className="animate-fade-up flex flex-col items-center justify-center pt-20 text-center">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Carregando planos...</p>
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <div className="animate-fade-up flex flex-col items-center justify-center pt-20 text-center">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-3">
          Acesso Premium
        </p>
        <h1 className="font-display text-2xl font-bold">Nenhum plano disponível.</h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-xs">
          Os planos ainda não foram configurados. Volte em breve.
        </p>
      </div>
    )
  }

  if (screen === "benefits" && selectedPlan) {
    return (
      <BenefitsScreen
        plan={selectedPlan}
        onBack={() => setScreen("list")}
        onContinue={() => setScreen("pix")}
      />
    )
  }

  if (screen === "pix" && selectedPlan) {
    return <PixScreen plan={selectedPlan} onBack={() => setScreen("benefits")} />
  }

  return (
    <PlanList
      plans={plans}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onContinue={() => setScreen("benefits")}
    />
  )
}

// ============================================================
// Resumo do VIP ativo (assinante)
// ============================================================

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
  } catch {
    return "—"
  }
}

function VipSummary({ vip }: { vip: VipStatus }) {
  // Progresso do periodo (quanto ja passou). Vitalicio nao tem barra.
  const usedDays = Math.max(0, vip.totalDays - vip.daysLeft)
  const progress = vip.totalDays > 0 ? Math.min(1, usedDays / vip.totalDays) : 0

  return (
    <div className="animate-fade-up lg:mx-auto lg:max-w-md">
      <section className="text-center">
        <span className="mx-auto flex items-center justify-center size-16 rounded-full bg-primary/15">
          <Crown className="size-8 text-primary" />
        </span>
        <p className="mt-4 font-mono text-[0.65rem] uppercase tracking-[0.32em] text-primary">Membro VIP</p>
        <h1 className="mt-1 font-display text-3xl font-bold leading-tight text-balance">
          {vip.planName || "Acesso Premium"}
        </h1>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-xs mx-auto text-balance">
          Sua assinatura está ativa e a IA está liberada para operar por você.
        </p>
      </section>

      {vip.lifetime ? (
        <section className="mt-8 skeuo-card-deep rounded-2xl p-6 flex flex-col items-center text-center">
          <InfinityIcon className="size-8 text-primary" />
          <p className="mt-3 font-display text-2xl font-bold">Acesso vitalício</p>
          <p className="text-sm text-muted-foreground mt-1">Seu plano não expira. Aproveite sem limites.</p>
        </section>
      ) : (
        <section className="mt-8 skeuo-card-deep rounded-2xl p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <CalendarClock className="size-4" />
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.28em]">Tempo restante</span>
          </div>
          <p className="mt-2 text-center">
            <span className="font-display text-5xl font-bold tabular-nums">{vip.daysLeft}</span>
            <span className="text-muted-foreground text-lg ml-2">{vip.daysLeft === 1 ? "dia" : "dias"}</span>
          </p>

          <div className="mt-5 h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="skeuo-card-inset rounded-xl p-3 text-center">
              <p className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">Início</p>
              <p className="text-sm font-semibold mt-1">{formatDate(vip.startedAt)}</p>
            </div>
            <div className="skeuo-card-inset rounded-xl p-3 text-center">
              <p className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">Expira em</p>
              <p className="text-sm font-semibold mt-1">{formatDate(vip.expiresAt)}</p>
            </div>
          </div>

          <p className="mt-4 text-center text-[0.65rem] text-muted-foreground/70">
            Plano de {vip.totalDays} {vip.totalDays === 1 ? "dia" : "dias"} · a contagem diminui a cada dia.
          </p>
        </section>
      )}
    </div>
  )
}

// ============================================================
// Tela 1 - Lista de planos
// ============================================================

function PlanList({
  plans,
  selectedId,
  onSelect,
  onContinue,
}: {
  plans: Plan[]
  selectedId: string | null
  onSelect: (id: string) => void
  onContinue: () => void
}) {
  const selected = plans.find((p) => p.id === selectedId)

  return (
    <div className="animate-fade-up">
      <section className="text-center">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-3">
          Acesso Premium
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">Escolha seu plano.</h1>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-xs mx-auto">
          Sinais de alta precisão direto no seu celular.
        </p>
      </section>

      <section className="mt-10 space-y-4 lg:grid lg:grid-cols-3 lg:gap-5 lg:space-y-0 lg:items-stretch">
        {plans.map((plan) => {
          const info = priceInfo(plan)
          const active = selectedId === plan.id
          return (
            <button
              key={plan.id}
              onClick={() => onSelect(plan.id)}
              className={`clay-card clay-card-interactive relative w-full text-left p-5 rounded-2xl lg:flex lg:h-full lg:flex-col ${
                active ? "clay-card-active" : ""
              }`}
            >
              {(plan.is_popular || plan.badge) && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-[0.6rem] font-mono uppercase tracking-wider text-primary-foreground whitespace-nowrap">
                  {plan.badge || "Popular"}
                </span>
              )}

              <div className="flex items-center gap-4">
                <div
                  className={`w-5 h-5 rounded-full border-2 transition-all shrink-0 flex items-center justify-center ${
                    active ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`}
                >
                  {active && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>

                <div className="flex-1 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{plan.name}</p>
                    <p className="text-[0.65rem] text-muted-foreground mt-0.5">{planPeriodLabel(plan.period)}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-display text-2xl font-bold">{info.main}</span>
                    <p className="text-[0.65rem] text-muted-foreground mt-0.5">{info.note}</p>
                  </div>
                </div>
              </div>

              {plan.features.length > 0 && (
                <ul className="mt-4 ml-9 grid grid-cols-2 gap-x-4 gap-y-2 lg:ml-0 lg:grid-cols-1">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3 h-3 text-primary shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
            </button>
          )
        })}
      </section>

      <section className="mt-8 lg:mx-auto lg:max-w-md">
        <button
          onClick={onContinue}
          disabled={!selected}
          className="w-full h-14 rounded-2xl button-primary flex items-center justify-center gap-2 font-semibold text-sm text-primary-foreground disabled:opacity-50"
        >
          Assinar {selected?.name ?? ""}
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="mt-4 text-center text-[0.65rem] text-muted-foreground/60">
          Pagamento via PIX. Liberação imediata.
        </p>
      </section>
    </div>
  )
}

// ============================================================
// Tela 2 - Beneficios do plano
// ============================================================

function BenefitsScreen({
  plan,
  onBack,
  onContinue,
}: {
  plan: Plan
  onBack: () => void
  onContinue: () => void
}) {
  const info = priceInfo(plan)
  const features =
    plan.features.length > 0
      ? plan.features
      : ["Sinais ilimitados", "Alertas em tempo real", "Suporte prioritário", "Acesso ao grupo VIP"]

  return (
    <div className="animate-fade-up lg:mx-auto lg:max-w-md">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <section className="mt-6 text-center">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-primary mb-3">
          {plan.badge || "Plano selecionado"}
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">{plan.name}</h1>
        <div className="mt-3 flex items-baseline justify-center gap-2">
          <span className="font-display text-4xl font-bold">{info.main}</span>
        </div>
        <p className="text-[0.7rem] text-muted-foreground mt-1">{info.note}</p>
      </section>

      <section className="mt-8">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground mb-4">
          O que você recebe
        </p>
        <ul className="space-y-3">
          {features.map((feature) => (
            <li key={feature} className="clay-card flex items-center gap-3 p-3 rounded-xl">
              <span className="flex items-center justify-center size-6 rounded-full bg-primary/15 shrink-0">
                <Check className="w-3.5 h-3.5 text-primary" />
              </span>
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <button
          onClick={onContinue}
          className="w-full h-14 rounded-2xl button-primary flex items-center justify-center gap-2 font-semibold text-sm text-primary-foreground"
        >
          Continuar
          <ArrowRight className="w-4 h-4" />
        </button>
        <div className="mt-4 flex items-center justify-center gap-2 text-[0.65rem] text-muted-foreground/70">
          <ShieldCheck className="w-3.5 h-3.5" />
          Pagamento seguro via PIX
        </div>
      </section>
    </div>
  )
}

// ============================================================
// Tela 3 - PIX (copia e cola + QR code + status)
// ============================================================

function PixScreen({ plan, onBack }: { plan: Plan; onBack: () => void }) {
  const [pix, setPix] = useState<PixData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [paid, setPaid] = useState(false)

  // Gerar o PIX ao abrir a tela.
  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      const session = getUserSession()
      try {
        const res = await fetch("/api/pix/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: plan.id,
            adminId: plan.admin_id,
            userId: session?.id ?? null,
            buyerName: session?.name ?? "",
            buyerEmail: session?.email ?? "",
          }),
        })
        const json = await res.json()
        if (!active) return
        if (!res.ok) {
          const raw = json?.error
          const msg = typeof raw === "string" ? raw : "Não foi possível gerar o PIX."
          setError(msg)
        } else {
          setPix(json as PixData)
        }
      } catch {
        if (active) setError("Falha de conexão ao gerar o PIX.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [plan.id, plan.admin_id])

  // Polling do status enquanto pendente.
  useEffect(() => {
    if (!pix?.externalId || paid) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pix/status?externalId=${encodeURIComponent(pix.externalId)}`)
        const json = await res.json()
        if (json?.status === "paid") {
          setPaid(true)
          clearInterval(interval)
        }
      } catch {
        // ignora erros transitorios de polling
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [pix?.externalId, paid])

  async function copyCode() {
    if (!pix?.pixCode) return
    const code = pix.pixCode

    // 1. Tenta a API moderna (so funciona em HTTPS e fora de iframe restrito).
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setError("")
        setTimeout(() => setCopied(false), 2000)
        return
      }
    } catch {
      // cai no fallback abaixo
    }

    // 2. Fallback universal: textarea + execCommand("copy"), que funciona
    //    no preview em iframe e em navegadores sem permissao de clipboard.
    try {
      const ta = document.createElement("textarea")
      ta.value = code
      ta.setAttribute("readonly", "")
      ta.style.position = "fixed"
      ta.style.top = "-9999px"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      ta.setSelectionRange(0, code.length)
      const ok = document.execCommand("copy")
      document.body.removeChild(ta)
      if (ok) {
        setCopied(true)
        setError("")
        setTimeout(() => setCopied(false), 2000)
        return
      }
    } catch {
      // cai no erro abaixo
    }

    setError("Não foi possível copiar. Copie manualmente.")
  }

  if (paid) {
    return (
      <div className="animate-fade-up flex flex-col items-center text-center pt-16">
        <span className="flex items-center justify-center size-20 rounded-full bg-primary/15">
          <CheckCircle2 className="w-10 h-10 text-primary" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-bold">Pagamento confirmado!</h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-xs leading-relaxed">
          Seu acesso ao plano <strong className="text-foreground">{plan.name}</strong> foi liberado. Aproveite!
        </p>
      </div>
    )
  }

  return (
    <div className="animate-fade-up lg:mx-auto lg:max-w-md">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <section className="mt-6 text-center">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-3">
          Pague com PIX
        </p>
        <h1 className="font-display text-2xl font-bold leading-tight">{plan.name}</h1>
        <p className="text-sm text-muted-foreground mt-2">{priceInfo(plan).main}</p>
      </section>

      {loading && (
        <div className="mt-10 flex flex-col items-center text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Gerando seu PIX...</p>
        </div>
      )}

      {error && !loading && (
        <div className="mt-8 p-4 rounded-xl bg-destructive/10 ring-1 ring-destructive/30 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {pix && !loading && (
        <>
          {/* QR Code */}
          <section className="mt-8 flex flex-col items-center">
            <div className="p-4 rounded-2xl bg-white ring-1 ring-border">
              {pix.qrcodeBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    pix.qrcodeBase64.startsWith("data:")
                      ? pix.qrcodeBase64
                      : `data:image/png;base64,${pix.qrcodeBase64}`
                  }
                  alt="QR Code do PIX"
                  className="size-48 object-contain"
                />
              ) : (
                <div className="size-48 flex items-center justify-center text-muted-foreground">
                  <QrCode className="size-12" />
                </div>
              )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground text-center max-w-[15rem]">
              Abra o app do seu banco, escolha PIX e escaneie o código acima.
            </p>
          </section>

          {/* Copia e cola */}
          <section className="mt-6">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground mb-2">
              Ou use o PIX copia e cola
            </p>
            <div className="clay-card flex items-center gap-2 p-3 rounded-xl">
              <p className="flex-1 text-xs text-muted-foreground truncate font-mono">{pix.pixCode}</p>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg button-primary text-[0.7rem] font-semibold text-primary-foreground shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </section>

          {/* Status aguardando */}
          <section className="clay-card mt-6 flex items-center justify-center gap-2 p-3 rounded-xl">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Aguardando confirmação do pagamento...</span>
          </section>
        </>
      )}
    </div>
  )
}

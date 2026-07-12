"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle, Clock, CurrencyDollar, Receipt, ArrowClockwise } from "@phosphor-icons/react"
import { listTransactions, type PixTransaction } from "@/lib/adm"

type Filter = "todas" | "pagas" | "pendentes"

// Formata centavos -> "R$ 35,90"
function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// Data curta + "há X dias".
function formatDate(iso: string): { full: string; rel: string } {
  const d = new Date(iso)
  const full = d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  const rel = diffDays <= 0 ? "hoje" : diffDays === 1 ? "há 1 dia" : `há ${diffDays} dias`
  return { full, rel }
}

// Lista de vendas do admin (escopo por admin_id). Espelha a UI da sessao de
// vendas, mas exclusiva do painel administrativo.
export function SalesList({ adminId }: { adminId: string }) {
  const [sales, setSales] = useState<PixTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("todas")

  useEffect(() => {
    let active = true
    listTransactions(adminId).then(({ data }) => {
      if (!active) return
      setSales(data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [adminId])

  const metrics = useMemo(() => {
    const paid = sales.filter((s) => s.status === "paid")
    const pending = sales.filter((s) => s.status === "pending")
    const revenue = paid.reduce((sum, s) => sum + (s.amount || 0), 0)
    const avgTicket = paid.length > 0 ? Math.round(revenue / paid.length) : 0
    return { approvedCount: paid.length, pendingCount: pending.length, revenue, avgTicket }
  }, [sales])

  const visible = useMemo(() => {
    if (filter === "pagas") return sales.filter((s) => s.status === "paid")
    if (filter === "pendentes") return sales.filter((s) => s.status === "pending")
    return sales
  }, [sales, filter])

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-2">
          Sua operação
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">Vendas</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Todas as transações PIX da sua conta.
        </p>
      </header>

      {/* === 3 BLOCOS DE METRICAS === */}
      <section className="grid grid-cols-2 gap-3">
        {/* PIX Aprovado - destaque */}
        <div className="metric-hero col-span-2 relative overflow-hidden rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(255,255,255,0.14)]">
              <CheckCircle size={18} weight="fill" className="text-primary-foreground" />
            </span>
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-primary-foreground/80">
              PIX Aprovado
            </span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <p className="font-display text-5xl sm:text-6xl font-bold leading-none text-primary-foreground tabular-nums">
              {loading ? "—" : metrics.approvedCount}
            </p>
            <p className="font-display text-lg font-semibold text-primary-foreground/90 tabular-nums pb-1">
              {loading ? "" : brl(metrics.revenue)}
            </p>
          </div>
        </div>

        {/* PIX Pendente */}
        <div className="skeuo-card-deep rounded-3xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15">
              <Clock size={15} weight="fill" className="text-amber-400" />
            </span>
            <span className="font-mono text-[0.55rem] uppercase tracking-[0.24em] text-muted-foreground">
              PIX Pendente
            </span>
          </div>
          <p className="font-display text-3xl sm:text-4xl font-bold leading-none text-foreground tabular-nums">
            {loading ? "—" : metrics.pendingCount}
          </p>
        </div>

        {/* Ticket medio */}
        <div className="skeuo-card-deep rounded-3xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/8">
              <CurrencyDollar size={15} weight="fill" className="text-muted-foreground" />
            </span>
            <span className="font-mono text-[0.55rem] uppercase tracking-[0.24em] text-muted-foreground">
              Ticket médio
            </span>
          </div>
          <p className="font-display text-2xl sm:text-3xl font-bold leading-none text-foreground tabular-nums">
            {loading ? "—" : brl(metrics.avgTicket)}
          </p>
        </div>
      </section>

      {/* === FILTROS === */}
      <div className="mt-6 flex items-center gap-2">
        {(["todas", "pagas", "pendentes"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`clay-chip flex-1 rounded-2xl py-2.5 text-xs font-display font-semibold capitalize ${
              filter === f ? "is-active-solid" : ""
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* === LISTA DE VENDAS === */}
      <section className="mt-4 space-y-2.5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <ArrowClockwise size={18} className="animate-spin" />
            <span className="text-sm">Carregando vendas...</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="skeuo-card-deep rounded-3xl px-5 py-12 text-center">
            <Receipt size={28} className="mx-auto mb-3 text-muted-foreground/60" />
            <p className="font-display text-base font-semibold text-foreground">Nenhuma venda por aqui</p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              {filter === "pendentes"
                ? "Você não tem vendas pendentes no momento."
                : "Assim que houver vendas, elas aparecem aqui."}
            </p>
          </div>
        ) : (
          visible.map((s) => {
            const date = formatDate(s.created_at)
            const isPaid = s.status === "paid"
            const isPending = s.status === "pending"
            return (
              <article
                key={s.id}
                className="skeuo-card-deep rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-foreground truncate">
                    {s.buyer_name || s.buyer_email || "Cliente"}
                  </p>
                  <p className="text-[0.7rem] text-muted-foreground truncate">
                    {s.plan_name || "Venda"} · PIX · {date.rel}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="font-display text-sm font-bold text-foreground tabular-nums">
                    {brl(s.amount)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${
                      isPaid
                        ? "bg-primary/15 text-primary"
                        : isPending
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-white/8 text-muted-foreground"
                    }`}
                  >
                    {isPaid ? <CheckCircle size={11} weight="fill" /> : <Clock size={11} weight="fill" />}
                    {isPaid ? "Pago" : isPending ? "Pendente" : "Expirado"}
                  </span>
                </div>
              </article>
            )
          })
        )}
      </section>
    </div>
  )
}

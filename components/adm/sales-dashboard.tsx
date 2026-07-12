"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  CreditCard,
  Users,
  UserMinus,
  Repeat,
  ShoppingBag,
  Clock,
} from "lucide-react"
import {
  listTransactions,
  listAppUsers,
  listPlans,
  planMonthlyValue,
  type PixTransaction,
  type AppUser,
  type Plan,
} from "@/lib/adm"
import type { AdmSession } from "@/lib/adm-session"

type Gran = "dias" | "semanas" | "meses"

const GRANS: { id: Gran; label: string }[] = [
  { id: "dias", label: "Dias" },
  { id: "semanas", label: "Semanas" },
  { id: "meses", label: "Meses" },
]

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function brlShort(n: number): string {
  if (n >= 1000) return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`
  return `R$ ${Math.round(n)}`
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// Cada ponto carrega o valor atual e o valor do periodo anterior equivalente (linha tracejada).
type Point = {
  x: string
  value: number
  prev: number
}

const DAY = 86400000

// Monta a serie do periodo conforme a granularidade escolhida.
function buildSeries(txs: PixTransaction[], gran: Gran): Point[] {
  const now = new Date()
  const paid = txs.filter((t) => t.status === "paid")
  const reais = (t: PixTransaction) => (Number(t.amount) || 0) / 100
  const timeOf = (t: PixTransaction) => new Date(t.paid_at ?? t.created_at).getTime()
  const sumBetween = (start: number, end: number) =>
    paid.reduce((s, t) => {
      const ts = timeOf(t)
      return ts >= start && ts < end ? s + reais(t) : s
    }, 0)

  if (gran === "dias") {
    const N = 14
    const today0 = startOfDay(now).getTime()
    const out: Point[] = []
    for (let i = N - 1; i >= 0; i--) {
      const s = today0 - i * DAY
      const d = new Date(s)
      out.push({
        x: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        value: sumBetween(s, s + DAY),
        prev: sumBetween(s - N * DAY, s - N * DAY + DAY),
      })
    }
    return out
  }

  if (gran === "semanas") {
    const N = 8
    const today0 = startOfDay(now).getTime()
    const out: Point[] = []
    for (let i = N - 1; i >= 0; i--) {
      const e = today0 - i * 7 * DAY + DAY
      const s = e - 7 * DAY
      const d = new Date(s)
      out.push({
        x: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        value: sumBetween(s, e),
        prev: sumBetween(s - N * 7 * DAY, e - N * 7 * DAY),
      })
    }
    return out
  }

  // meses
  const N = 6
  const out: Point[] = []
  for (let i = N - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const s = d.getTime()
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    const ps = new Date(d.getFullYear(), d.getMonth() - N, 1).getTime()
    const pe = new Date(d.getFullYear(), d.getMonth() - N + 1, 1).getTime()
    out.push({
      x: `${MONTHS[d.getMonth()]}`,
      value: sumBetween(s, e),
      prev: sumBetween(ps, pe),
    })
  }
  return out
}

function inPeriodByGran(dateStr: string | null, gran: Gran): boolean {
  if (!dateStr) return false
  const ts = new Date(dateStr).getTime()
  const now = new Date()
  const today0 = startOfDay(now).getTime()
  if (gran === "dias") return ts >= today0 - 13 * DAY
  if (gran === "semanas") return ts >= today0 + DAY - 8 * 7 * DAY
  return ts >= new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime()
}

export function SalesDashboard({ session }: { session: AdmSession }) {
  const [gran, setGran] = useState<Gran>("dias")
  const [txs, setTxs] = useState<PixTransaction[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([listTransactions(session.id), listAppUsers(session.id), listPlans(session.id)]).then(
      ([t, u, p]) => {
        if (!active) return
        setTxs(t.data)
        setUsers(u.data)
        setPlans(p.data)
        setLoading(false)
      },
    )
    return () => {
      active = false
    }
  }, [session.id])

  const series = useMemo(() => buildSeries(txs, gran), [txs, gran])
  const sparkValues = useMemo(() => series.map((p) => p.value), [series])

  const total = useMemo(() => series.reduce((s, p) => s + p.value, 0), [series])
  const prevTotal = useMemo(() => series.reduce((s, p) => s + p.prev, 0), [series])

  const delta = useMemo(() => {
    if (prevTotal <= 0) return total > 0 ? 100 : 0
    return ((total - prevTotal) / prevTotal) * 100
  }, [total, prevTotal])

  const salesCount = useMemo(
    () => txs.filter((t) => t.status === "paid" && inPeriodByGran(t.paid_at ?? t.created_at, gran)).length,
    [txs, gran],
  )
  // PIX pendentes (ainda nao pagos) criados HOJE: quantidade + valor somado.
  const { pendingTodayCount, pendingTodayValue } = useMemo(() => {
    const now = new Date()
    const isToday = (d: string) => {
      const dt = new Date(d)
      return (
        dt.getFullYear() === now.getFullYear() &&
        dt.getMonth() === now.getMonth() &&
        dt.getDate() === now.getDate()
      )
    }
    const pend = txs.filter((t) => t.status === "pending" && isToday(t.created_at))
    return {
      pendingTodayCount: pend.length,
      pendingTodayValue: pend.reduce((s, t) => s + (Number(t.amount) || 0) / 100, 0),
    }
  }, [txs])
  const ticket = salesCount > 0 ? total / salesCount : 0

  const activeUsers = users.filter((u) => u.status === "active").length
  const lostUsers = users.filter((u) => u.status === "banned").length
  const newUsers = users.filter((u) => inPeriodByGran(u.created_at, gran)).length

  const { activeSubs, mrr } = useMemo(() => {
    const planById = new Map(plans.map((p) => [p.id, p]))
    const bannedUserIds = new Set(users.filter((u) => u.status === "banned").map((u) => u.id))
    const latestByUser = new Map<string, PixTransaction>()
    for (const t of txs) {
      if (t.status !== "paid" || !t.user_id) continue
      const cur = latestByUser.get(t.user_id)
      const when = t.paid_at ?? t.created_at
      if (!cur || when > (cur.paid_at ?? cur.created_at)) latestByUser.set(t.user_id, t)
    }
    let activeSubs = 0
    let mrr = 0
    for (const [userId, t] of latestByUser) {
      if (bannedUserIds.has(userId)) continue
      activeSubs += 1
      const plan = t.plan_id ? planById.get(t.plan_id) : undefined
      if (plan) mrr += planMonthlyValue(plan)
    }
    return { activeSubs, mrr }
  }, [txs, plans, users])

  const recentSales = useMemo(() => txs.filter((t) => t.status === "paid").slice(0, 7), [txs])

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-2">Painel</p>
        <h1 className="font-display text-3xl font-bold leading-tight">Olá, {session.name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Acompanhe suas vendas e sua base.</p>
      </header>

      {/* Layout em coluna unica: grafico, KPIs e ultimas vendas em largura total */}
      <div className="space-y-4">
        {/* Card de estatisticas */}
        <section className="skeuo-card rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="font-display text-xl font-bold">Estatísticas</h2>
              <div className="flex items-center gap-3 sm:gap-4">
                {GRANS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGran(g.id)}
                    className={`text-sm font-medium transition-colors ${
                      gran === g.id ? "text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Faturamento total + variacao */}
            <div className="flex items-end justify-between gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Faturamento no período</p>
                <p className="font-display text-3xl sm:text-4xl font-bold tabular-nums">
                  {loading ? "—" : brl(total)}
                </p>
              </div>
              <DeltaBadge delta={delta} />
            </div>

            {/* Grafico: area (atual) + linha tracejada (periodo anterior) */}
            <div className="h-48 sm:h-56 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d90429" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#d90429" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="x"
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    tickFormatter={(v) => brlShort(Number(v))}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(217,4,41,0.4)", strokeWidth: 1 }}
                    contentStyle={{
                      background: "#141414",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "#fff",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }}
                    formatter={(v: number, name) => [brl(Number(v)), name === "value" ? "Atual" : "Anterior"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="prev"
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#ff1846"
                    strokeWidth={2.5}
                    fill="url(#salesFill)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#ff1846", stroke: "#fff", strokeWidth: 1.5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center gap-4 mt-2 text-[0.65rem] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-0.5 rounded bg-primary" /> Atual
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 border-t border-dashed border-white/45" /> Período anterior
              </span>
            </div>
          </section>

          {/* KPIs em bento: 2 destaques + 4 tiles compactos */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <FeatureTile
              className="col-span-2"
              icon={ShoppingBag}
              label="Vendas no período"
              value={loading ? "—" : String(salesCount)}
              hint={`Ticket médio ${loading ? "—" : brl(ticket)}`}
              spark={sparkValues}
              delta={delta}
            />
            <FeatureTile
              className="col-span-2"
              icon={Repeat}
              label="Recorrência mensal (MRR)"
              value={loading ? "—" : brl(mrr)}
              hint={`${loading ? 0 : activeSubs} assinaturas ativas`}
              spark={sparkValues}
              primary
            />
            <FeatureTile
              className="col-span-2"
              icon={Clock}
              label="PIX pendentes (hoje)"
              value={loading ? "—" : brl(pendingTodayValue)}
              hint={`${loading ? 0 : pendingTodayCount} PIX pendente${pendingTodayCount === 1 ? "" : "s"} hoje`}
              color="#fbbf24"
              hintClass="text-amber-400/80"
            />

            <StatTile
              icon={Receipt}
              label="Ticket médio"
              value={loading ? "—" : brl(ticket)}
              hint="por venda"
            />
            <StatTile
              icon={Users}
              label="Ativos"
              value={loading ? "—" : String(activeUsers)}
              hint={`+${loading ? 0 : newUsers} no período`}
              color="#34d399"
              hintClass="text-emerald-400/80"
            />
            <StatTile
              icon={UserMinus}
              label="Perdidos"
              value={loading ? "—" : String(lostUsers)}
              hint="banidos / inativos"
            />
            <StatTile
              icon={CreditCard}
              label="Assinaturas"
              value={loading ? "—" : String(activeSubs)}
              hint="ativas hoje"
            />
          </section>

          {/* ULTIMAS VENDAS: largura total, abaixo dos KPIs */}
          <section className="skeuo-card rounded-3xl p-5 sm:p-6">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground mb-4 px-1">
              Últimas vendas
            </p>
            {loading && <div className="rounded-2xl p-4 text-sm text-muted-foreground">Carregando…</div>}
            {!loading && recentSales.length === 0 && (
              <div className="rounded-2xl p-6 text-center text-sm text-muted-foreground">
                Nenhuma venda registrada ainda.
              </div>
            )}
            {!loading && recentSales.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {recentSales.map((t) => (
                  <div
                    key={t.id}
                    className="skeuo-icon-container rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.buyer_name || t.buyer_email || "Cliente"}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.plan_name || "Plano"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{brl((Number(t.amount) || 0) / 100)}</p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        {new Date(t.paid_at ?? t.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
      </div>
    </div>
  )
}

function DeltaBadge({ delta }: { delta: number }) {
  const positive = delta >= 0
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-xs font-medium ${
        positive ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/15 text-primary"
      }`}
    >
      {positive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

// Mini grafico de tendencia em SVG puro (sem peso extra).
function Sparkline({ data, color, className }: { data: number[]; color: string; className?: string }) {
  if (!data.length) return null
  const w = 100
  const h = 36
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const coords = data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * w : w / 2
    const y = h - ((v - min) / range) * h
    return [x, y] as const
  })
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ")
  const area = `${line} L ${w} ${h} L 0 ${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <path d={area} fill={color} opacity={0.14} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// Destaque grande com sparkline ao fundo.
function FeatureTile({
  icon: Icon,
  label,
  value,
  hint,
  pending,
  spark,
  delta,
  primary = false,
  className = "",
  color: colorProp,
  hintClass = "text-muted-foreground",
}: {
  icon: typeof Receipt
  label: string
  value: string
  hint?: string
  pending?: number
  spark?: number[]
  delta?: number
  primary?: boolean
  className?: string
  color?: string
  hintClass?: string
}) {
  const color = colorProp ?? (primary ? "#ff1846" : "#ffffff")
  return (
    <div
      className={`skeuo-card rounded-3xl p-5 min-h-[148px] flex flex-col justify-between relative overflow-hidden ${
        primary ? "ring-1 ring-primary/25" : ""
      } ${className}`}
    >
      {spark && (
        <Sparkline data={spark} color={primary ? "#ff1846" : "#8b8b8b"} className="absolute inset-x-0 bottom-0 h-14" />
      )}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <span className="size-9 rounded-xl skeuo-icon-container flex items-center justify-center">
            <Icon className="size-4" style={{ color: colorProp ?? (primary ? "#ff5874" : undefined) }} />
          </span>
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.26em] text-muted-foreground">{label}</span>
        </div>
        {delta != null && <DeltaBadge delta={delta} />}
      </div>
      <div className="relative z-10">
        <p className="font-display text-3xl font-bold tabular-nums leading-none" style={{ color }}>
          {value}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {hint && <p className={`text-xs ${hintClass}`}>{hint}</p>}
          {pending != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-400">
              <Clock className="size-3" />
              {pending} PIX pendente{pending === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Tile compacto: rotulo no topo, numero forte, icone no canto e barra de acento.
function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  color = "#d90429",
  hintClass = "text-muted-foreground/70",
}: {
  icon: typeof Receipt
  label: string
  value: string
  hint: string
  color?: string
  hintClass?: string
}) {
  return (
    <div className="skeuo-card rounded-2xl p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
        <span className="size-7 rounded-lg skeuo-icon-container flex items-center justify-center">
          <Icon className="size-3.5" style={{ color }} />
        </span>
      </div>
      <p className="font-display text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className={`text-[0.65rem] mt-2 leading-none ${hintClass}`}>{hint}</p>
      <span className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: color, opacity: 0.5 }} />
    </div>
  )
}

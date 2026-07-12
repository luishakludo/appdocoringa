"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  Search,
  Plus,
  Eye,
  EyeOff,
  Ban,
  CheckCircle2,
  Trash2,
  X,
  KeyRound,
  Pencil,
  RefreshCw,
  Sparkles,
  Wallet,
  Gauge,
  Crown,
  CreditCard,
  Clock,
  User as UserIcon,
  SlidersHorizontal,
} from "lucide-react"
import {
  listAppUsers,
  listTransactions,
  buildUserPaymentStats,
  createAppUser,
  createDemoUser,
  updateAppUser,
  updateDemoUser,
  deleteAppUser,
  parseDemoMeta,
  computeVipStatus,
  grantVip,
  revokeVip,
  type AppUser,
  type UserPaymentStats,
} from "@/lib/adm"
import { Slider } from "@/components/ui/slider"

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Inicial do nome para o avatar.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Formata uma data relativa curta (ex.: "hoje", "há 3d", "12/05").
function formatWhen(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const day = 24 * 3600 * 1000
  if (diff < day && d.getDate() === new Date().getDate()) return "hoje"
  if (diff < 7 * day) return `há ${Math.max(1, Math.floor(diff / day))}d`
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

// Saldo relevante de um usuário para fins de filtro/ordenação:
// demo -> saldo da banca; assinante -> total pago; demais -> 0.
function userBalance(u: AppUser, stats: UserPaymentStats | null): number {
  const demo = parseDemoMeta(u)
  if (demo) return demo.balance
  if (stats && stats.paidCount > 0) return stats.totalPaid
  return 0
}

type UserType = "all" | "subscriber" | "demo" | "free" | "banned"

// Limites do slider de faixa de saldo/banca.
const BALANCE_MIN = 1
const BALANCE_MAX = 50000

function formatBalanceLabel(v: number): string {
  if (v >= BALANCE_MAX) return "50k+"
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
  return `${v}`
}

export function UsersManager({ adminId, readOnly = false }: { adminId: string; readOnly?: boolean }) {
  const [users, setUsers] = useState<AppUser[]>([])
  const [stats, setStats] = useState<ReturnType<typeof buildUserPaymentStats> | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [typeFilter, setTypeFilter] = useState<UserType>("all")
  const [balanceRange, setBalanceRange] = useState<[number, number]>([BALANCE_MIN, BALANCE_MAX])
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [showCreate, setShowCreate] = useState(false)
  const [pwTarget, setPwTarget] = useState<AppUser | null>(null)
  const [editTarget, setEditTarget] = useState<AppUser | null>(null)
  const [vipTarget, setVipTarget] = useState<AppUser | null>(null)

  async function refresh() {
    const [{ data }, { data: txs }] = await Promise.all([listAppUsers(adminId), listTransactions(adminId)])
    setUsers(data)
    setStats(buildUserPaymentStats(txs))
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId])

  const [minBal, maxBal] = balanceRange
  const balanceActive = minBal > BALANCE_MIN || maxBal < BALANCE_MAX

  const filtersActive = typeFilter !== "all" || balanceActive

  const filtered = users
    .filter((u) => {
      const q = query.toLowerCase()
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false

      const st = stats?.get(u) ?? null
      const demo = parseDemoMeta(u)
      const isSubscriber = !!st && st.paidCount > 0

      // Filtro por tipo de usuário.
      if (typeFilter === "subscriber" && !isSubscriber) return false
      if (typeFilter === "demo" && !demo) return false
      if (typeFilter === "free" && (demo || isSubscriber)) return false
      if (typeFilter === "banned" && u.status !== "banned") return false

      // Filtro por faixa de saldo (slider). O topo (50k) não tem limite superior.
      if (balanceActive) {
        const bal = userBalance(u, st)
        if (bal < minBal) return false
        if (maxBal < BALANCE_MAX && bal > maxBal) return false
      }

      return true
    })

  function clearFilters() {
    setTypeFilter("all")
    setBalanceRange([BALANCE_MIN, BALANCE_MAX])
  }

  async function toggleBan(u: AppUser) {
    await updateAppUser(u.id, { status: u.status === "active" ? "banned" : "active" })
    refresh()
  }

  async function remove(u: AppUser) {
    if (!confirm(`Excluir ${u.name}? Esta ação não pode ser desfeita.`)) return
    await deleteAppUser(u.id)
    refresh()
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-2">
            Base
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight">Usuários</h1>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowCreate(true)}
            className="button-primary h-11 px-4 rounded-xl flex items-center gap-2 text-sm font-medium shrink-0"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Novo</span>
          </button>
        )}
      </header>

      <div className="flex items-center gap-2 mb-3">
        <div className="clay-input rounded-2xl flex items-center gap-3 px-4 h-12 flex-1">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por usuário"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className={`relative h-12 px-4 rounded-2xl flex items-center gap-2 text-sm font-medium shrink-0 transition-colors ${
            showFilters || filtersActive
              ? "bg-primary/15 text-primary ring-1 ring-primary/30"
              : "clay-input text-foreground/90 hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="size-4" />
          <span className="hidden sm:inline">Filtros</span>
          {filtersActive && <span className="size-1.5 rounded-full bg-primary" aria-hidden />}
        </button>
      </div>

      {showFilters && (
        <div className="skeuo-card rounded-2xl p-4 mb-5 animate-fade-up">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Tipo de usuário */}
            <div>
              <p className="text-[0.65rem] font-mono uppercase tracking-wider text-muted-foreground mb-2">Tipo</p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "Todos"],
                    ["subscriber", "Assinantes"],
                    ["demo", "Demo"],
                    ["free", "Sem plano"],
                    ["banned", "Banidos"],
                  ] as [UserType, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTypeFilter(key)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                      typeFilter === key
                        ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                        : "clay-input text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Faixa de saldo */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[0.65rem] font-mono uppercase tracking-wider text-muted-foreground">
                  Saldo / banca
                </p>
                <span className="text-xs font-medium text-primary tabular-nums">
                  R$ {formatBalanceLabel(minBal)} — R$ {formatBalanceLabel(maxBal)}
                </span>
              </div>
              <div className="px-1 pt-1">
                <Slider
                  min={BALANCE_MIN}
                  max={BALANCE_MAX}
                  step={100}
                  value={balanceRange}
                  onValueChange={(v) => setBalanceRange([v[0], v[1]] as [number, number])}
                  minStepsBetweenThumbs={1}
                />
                <div className="flex items-center justify-between mt-2 text-[0.65rem] text-muted-foreground tabular-nums">
                  <span>R$ {BALANCE_MIN}</span>
                  <span>R$ 50k+</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "usuário" : "usuários"}
            </span>
            {filtersActive && (
              <button
                onClick={clearFilters}
                className="h-8 px-3 rounded-lg clay-input text-xs text-foreground/90 hover:text-foreground flex items-center gap-1.5"
              >
                <X className="size-3.5" />
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
        {loading && <div className="skeuo-card rounded-2xl p-4 text-sm text-muted-foreground">Carregando…</div>}
        {!loading && filtered.length === 0 && (
          <div className="col-span-full skeuo-card rounded-2xl p-6 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </div>
        )}
        {filtered.map((u) => (
          <UserCard
            key={u.id}
            user={u}
            stats={stats?.get(u) ?? null}
            revealed={!!revealed[u.id]}
            onToggleReveal={() => setRevealed((r) => ({ ...r, [u.id]: !r[u.id] }))}
            readOnly={readOnly}
            onEdit={() => setEditTarget(u)}
            onPassword={() => setPwTarget(u)}
            onVip={() => setVipTarget(u)}
            onToggleBan={() => toggleBan(u)}
            onRemove={() => remove(u)}
          />
        ))}
      </div>

      {showCreate && (
        <CreateUserModal
          adminId={adminId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            refresh()
          }}
        />
      )}

      {pwTarget && (
        <ChangePasswordModal
          user={pwTarget}
          onClose={() => setPwTarget(null)}
          onSaved={() => {
            setPwTarget(null)
            refresh()
          }}
        />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            refresh()
          }}
          onChangePassword={() => {
            setPwTarget(editTarget)
          }}
        />
      )}

      {vipTarget && (
        <VipModal
          user={vipTarget}
          onClose={() => setVipTarget(null)}
          onSaved={() => {
            setVipTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function UserCard({
  user: u,
  stats,
  revealed,
  onToggleReveal,
  readOnly,
  onEdit,
  onPassword,
  onVip,
  onToggleBan,
  onRemove,
}: {
  user: AppUser
  stats: UserPaymentStats | null
  revealed: boolean
  onToggleReveal: () => void
  readOnly: boolean
  onEdit: () => void
  onPassword: () => void
  onVip: () => void
  onToggleBan: () => void
  onRemove: () => void
}) {
  const demo = parseDemoMeta(u)
  const isSubscriber = !!stats && stats.paidCount > 0
  const monthsPaid = Math.min(12, stats?.paidCount ?? 0)
  const vip = computeVipStatus(u)

  return (
    <div
      className={`rounded-2xl p-4 ${
        demo
          ? "bg-amber-500/[0.06] ring-1 ring-amber-500/40 shadow-[0_0_0_1px_rgba(245,158,11,0.15),0_8px_24px_-12px_rgba(245,158,11,0.45)]"
          : "skeuo-card"
      }`}
    >
      {/* Cabecalho: avatar + nome + badges */}
      <div className="flex items-start gap-3">
        <div
          className={`size-11 shrink-0 rounded-xl flex items-center justify-center font-display font-bold text-sm ${
            demo
              ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
              : isSubscriber
                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                : "skeuo-icon-container text-muted-foreground"
          }`}
          aria-hidden
        >
          {initials(u.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{u.name}</p>
            {demo && (
              <span className="px-2 h-5 inline-flex items-center gap-1 rounded-full text-[0.55rem] font-mono uppercase tracking-wider bg-amber-500/20 text-amber-400">
                <Sparkles className="size-2.5" />
                Demo
              </span>
            )}
            <span
              className={`px-2 h-5 inline-flex items-center rounded-full text-[0.55rem] font-mono uppercase tracking-wider ${
                u.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/15 text-primary"
              }`}
            >
              {u.status === "active" ? "Ativo" : "Banido"}
            </span>
            {!demo && vip.isVip && (
              <span className="px-2 h-5 inline-flex items-center gap-1 rounded-full text-[0.55rem] font-mono uppercase tracking-wider bg-primary/20 text-primary">
                <Crown className="size-2.5" />
                {vip.lifetime ? "VIP vitalício" : `VIP · ${vip.daysLeft}d`}
              </span>
            )}
            {!demo &&
              (isSubscriber ? (
                <span className="px-2 h-5 inline-flex items-center gap-1 rounded-full text-[0.55rem] font-mono uppercase tracking-wider bg-primary/15 text-primary">
                  <Crown className="size-2.5" />
                  Assinante
                </span>
              ) : (
                <span className="px-2 h-5 inline-flex items-center rounded-full text-[0.55rem] font-mono uppercase tracking-wider bg-white/5 text-muted-foreground">
                  Sem plano
                </span>
              ))}
            {!demo && u.source === "referral" && (
              <span className="px-2 h-5 inline-flex items-center rounded-full text-[0.55rem] font-mono uppercase tracking-wider bg-white/5 text-muted-foreground">
                Indicação
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
          {!demo && u.phone && <p className="text-xs text-muted-foreground/70 mt-0.5">{u.phone}</p>}
        </div>
      </div>

      {/* Metricas em grade */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <MetricBox
          icon={Wallet}
          label="Saldo"
          value={demo ? `R$ ${formatBRL(demo.balance)}` : isSubscriber ? `R$ ${formatBRL(stats!.totalPaid)}` : "—"}
          hint={demo ? undefined : isSubscriber ? "total pago" : undefined}
          tone={demo ? "amber" : "default"}
        />
        {demo ? (
          <MetricBox icon={Gauge} label="RTP" value={`${demo.rtp}%`} hint="ganhos" tone="emerald" />
        ) : (
          <MetricBox
            icon={CreditCard}
            label="Pagamentos"
            value={String(stats?.paidCount ?? 0)}
            hint={stats?.lastPlanName || undefined}
          />
        )}
        <MetricBox icon={Clock} label="Último login" value={formatWhen(u.last_login_at)} hint="acesso" />
        <MetricBox
          icon={Clock}
          label={isSubscriber ? "Último pgto." : "Cadastro"}
          value={formatWhen(isSubscriber ? stats!.lastPaidAt : u.created_at)}
        />
      </div>

      {/* Progresso mensal (assinatura recorrente) */}
      {!demo && isSubscriber && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[0.65rem] font-mono uppercase tracking-wider text-muted-foreground">
              Recorrência
            </span>
            <span className="text-[0.7rem] font-mono text-foreground/90 tabular-nums">{monthsPaid}/12</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(monthsPaid / 12) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Senha */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[0.65rem] font-mono text-muted-foreground">Senha:</span>
        <code className="text-[0.7rem] font-mono text-foreground/90">{revealed ? u.password || "—" : "••••••••"}</code>
        <button
          onClick={onToggleReveal}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={revealed ? "Ocultar senha" : "Mostrar senha"}
        >
          {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>

      {!readOnly && !demo && (
        <button
          onClick={onVip}
          className={`w-full h-9 rounded-lg mt-3 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
            vip.isVip
              ? "bg-primary/15 text-primary ring-1 ring-primary/30 hover:bg-primary/20"
              : "clay-input text-foreground/90 hover:text-foreground"
          }`}
        >
          <Crown className="size-3.5" />
          {vip.isVip ? "Gerenciar VIP" : "Dar VIP"}
        </button>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <button
            onClick={onEdit}
            className="flex-1 h-9 rounded-lg clay-input flex items-center justify-center gap-1.5 text-xs text-foreground/90 hover:text-foreground"
          >
            <Pencil className="size-3.5" />
            Editar
          </button>
          <button
            onClick={onPassword}
            className="flex-1 h-9 rounded-lg clay-input flex items-center justify-center gap-1.5 text-xs text-foreground/90 hover:text-foreground"
          >
            <KeyRound className="size-3.5" />
            Senha
          </button>
          <button
            onClick={onToggleBan}
            className="flex-1 h-9 rounded-lg clay-input flex items-center justify-center gap-1.5 text-xs text-foreground/90 hover:text-foreground"
          >
            {u.status === "active" ? (
              <>
                <Ban className="size-3.5" />
                Banir
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" />
                Reativar
              </>
            )}
          </button>
          <button
            onClick={onRemove}
            className="h-9 w-9 rounded-lg clay-input flex items-center justify-center text-primary hover:text-primary/80"
            aria-label="Excluir usuário"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

function MetricBox({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: typeof Wallet
  label: string
  value: string
  hint?: string
  tone?: "default" | "amber" | "emerald"
}) {
  const accent =
    tone === "amber"
      ? { icon: "text-amber-400", chip: "bg-amber-400/10", bar: "bg-amber-400/60" }
      : tone === "emerald"
        ? { icon: "text-emerald-400", chip: "bg-emerald-400/10", bar: "bg-emerald-400/60" }
        : { icon: "text-muted-foreground", chip: "bg-white/[0.04]", bar: "bg-border" }
  return (
    <div className="group relative skeuo-card-inset rounded-xl pl-3.5 pr-3 py-2.5 overflow-hidden">
      <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-7 w-0.5 rounded-full ${accent.bar}`} aria-hidden />
      <div className="flex items-center gap-2">
        <span className={`size-6 shrink-0 rounded-md flex items-center justify-center ${accent.chip}`}>
          <Icon className={`size-3.5 ${accent.icon}`} />
        </span>
        <span className="text-[0.6rem] font-mono uppercase tracking-[0.15em] text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <p className="text-base font-bold tabular-nums mt-1.5 truncate leading-none">{value}</p>
      {hint && <p className="text-[0.6rem] text-muted-foreground/70 truncate mt-1">{hint}</p>}
    </div>
  )
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm skeuo-card-deep rounded-2xl p-5 animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="size-8 rounded-lg clay-input flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[0.6rem] font-mono uppercase tracking-wider text-muted-foreground mb-1 block">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  "w-full clay-input rounded-lg h-11 px-3 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/50"

function CreateUserModal({
  adminId,
  onClose,
  onCreated,
}: {
  adminId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [accountType, setAccountType] = useState<"real" | "demo">("real")

  // Conta real (Atlax)
  const [usuario, setUsuario] = useState("")

  // Conta demo
  const [demoName, setDemoName] = useState("")
  const [demoLogin, setDemoLogin] = useState("")
  const [demoPassword, setDemoPassword] = useState("")
  const [demoBalance, setDemoBalance] = useState("1000")
  const [demoRtp, setDemoRtp] = useState("60")

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function generatePassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
    setDemoPassword(result)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (accountType === "real") {
      // O identificador do usuario e o login (mesmo usado na Atlax).
      // A senha NAO e definida aqui: ela e a propria senha do usuario na Atlax.
      const login = usuario.trim().toLowerCase()
      if (!login) {
        setError("Informe o usuário.")
        setSaving(false)
        return
      }
      const { error } = await createAppUser({ admin_id: adminId, name: usuario.trim(), email: login, phone: "", password: "" })
      if (error) {
        setError("Erro ao criar o usuário.")
        setSaving(false)
        return
      }
      onCreated()
      return
    }

    // Conta demo — o identificador de acesso e um USUARIO (login), igual a conta real.
    // Ele e guardado na coluna `email` (apenas um texto unico no banco).
    const login = demoLogin.trim().toLowerCase()
    const name = demoName.trim()
    const balance = Number.parseFloat(demoBalance.replace(",", ".")) || 0
    const rtp = Math.min(100, Math.max(0, Number.parseInt(demoRtp) || 0))
    if (!name || !login || !demoPassword) {
      setError("Preencha nome, usuário e senha da conta demo.")
      setSaving(false)
      return
    }
    const { error } = await createDemoUser({ admin_id: adminId, name, email: login, password: demoPassword, balance, rtp })
    if (error) {
      setError("Erro ao criar a conta demo. O usuário pode já estar em uso.")
      setSaving(false)
      return
    }
    onCreated()
  }

  return (
    <ModalShell title="Novo usuário" onClose={onClose}>
      {/* Seletor de tipo de conta */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          type="button"
          onClick={() => setAccountType("real")}
          className={`h-16 rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
            accountType === "real"
              ? "bg-primary/15 ring-1 ring-primary/40 text-foreground"
              : "clay-input text-muted-foreground"
          }`}
        >
          <UserIcon className="size-4" />
          Usuário real
        </button>
        <button
          type="button"
          onClick={() => setAccountType("demo")}
          className={`h-16 rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
            accountType === "demo"
              ? "bg-amber-500/15 ring-1 ring-amber-500/40 text-amber-300"
              : "clay-input text-muted-foreground"
          }`}
        >
          <Sparkles className="size-4" />
          Conta demo
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {accountType === "real" ? (
          <>
            <Labeled label="Usuário">
              <input
                className={inputCls}
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Usuário de login"
                autoComplete="off"
                required
              />
            </Labeled>
            <p className="text-xs text-muted-foreground -mt-1">
              A senha é a do próprio usuário na Atlax — você não precisa informá-la.
            </p>
          </>
        ) : (
          <>
            <Labeled label="Nome de exibição">
              <input
                className={inputCls}
                value={demoName}
                onChange={(e) => setDemoName(e.target.value)}
                placeholder="Ex.: João Silva"
                autoComplete="off"
                required
              />
            </Labeled>
            <Labeled label="Usuário (login)">
              <input
                className={inputCls}
                type="text"
                value={demoLogin}
                onChange={(e) => setDemoLogin(e.target.value)}
                placeholder="usuário de acesso"
                autoComplete="off"
                required
              />
            </Labeled>
            <Labeled label="Senha">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={demoPassword}
                  onChange={(e) => setDemoPassword(e.target.value)}
                  placeholder="Senha de acesso"
                  autoComplete="off"
                  required
                />
                <button
                  type="button"
                  onClick={generatePassword}
                  className="h-11 px-3 rounded-lg clay-input flex items-center justify-center text-muted-foreground hover:text-foreground"
                  title="Gerar senha aleatória"
                >
                  <RefreshCw className="size-4" />
                </button>
              </div>
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Saldo inicial (R$)">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={demoBalance}
                  onChange={(e) => setDemoBalance(e.target.value)}
                  required
                />
              </Labeled>
              <Labeled label="RTP — ganhos (%)">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={demoRtp}
                  onChange={(e) => setDemoRtp(e.target.value)}
                  required
                />
              </Labeled>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              A conta demo não usa a Atlax. O RTP define a % de entradas vencedoras de forma natural.
            </p>
          </>
        )}

        {error && <p className="text-xs text-primary">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="button-primary w-full h-11 rounded-lg font-semibold text-sm mt-1 disabled:opacity-70"
        >
          {saving ? "Criando..." : accountType === "demo" ? "Criar conta demo" : "Criar usuário"}
        </button>
      </form>
    </ModalShell>
  )
}

function ChangePasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: AppUser
  onClose: () => void
  onSaved: () => void
}) {
  const [password, setPassword] = useState(user.password || "")
  const [saving, setSaving] = useState(false)

  function generatePassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setPassword(result)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await updateAppUser(user.id, { password })
    onSaved()
  }

  return (
    <ModalShell title="Alterar senha" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted-foreground -mt-1">
          Usuario: <span className="text-foreground">{user.name}</span>
        </p>
        <Labeled label="Nova senha">
          <div className="flex gap-2">
            <input className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button
              type="button"
              onClick={generatePassword}
              className="h-11 px-3 rounded-lg clay-input flex items-center justify-center text-muted-foreground hover:text-foreground"
              title="Gerar senha aleatoria"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
        </Labeled>
        <button
          type="submit"
          disabled={saving}
          className="button-primary w-full h-11 rounded-lg font-semibold text-sm mt-1 disabled:opacity-70"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </ModalShell>
  )
}

function EditUserModal({
  user,
  onClose,
  onSaved,
  onChangePassword,
}: {
  user: AppUser
  onClose: () => void
  onSaved: () => void
  onChangePassword: () => void
}) {
  const demo = parseDemoMeta(user)
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone || "")
  const [balance, setBalance] = useState(demo ? String(demo.balance) : "")
  const [rtp, setRtp] = useState(demo ? String(demo.rtp) : "")
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (demo) {
      await updateDemoUser(user.id, {
        name,
        balance: Number.parseFloat(balance.replace(",", ".")) || 0,
        rtp: Math.min(100, Math.max(0, Number.parseInt(rtp) || 0)),
      })
    } else {
      await updateAppUser(user.id, { name, phone })
    }
    onSaved()
  }

  return (
    <ModalShell title={demo ? "Editar conta demo" : "Editar perfil"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Labeled label={demo ? "Nome de exibição" : "Nome"}>
          <input 
            className={inputCls} 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Nome do usuário"
            required 
          />
        </Labeled>
        {demo ? (
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Saldo (R$)">
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                required
              />
            </Labeled>
            <Labeled label="RTP — ganhos (%)">
              <input
                className={inputCls}
                type="number"
                min="0"
                max="100"
                step="1"
                value={rtp}
                onChange={(e) => setRtp(e.target.value)}
                required
              />
            </Labeled>
          </div>
        ) : (
          <Labeled label="Telefone">
            <input 
              className={inputCls} 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              placeholder="(00) 00000-0000"
            />
          </Labeled>
        )}
        <button
          type="submit"
          disabled={saving}
          className="button-primary w-full h-11 rounded-lg font-semibold text-sm mt-1 disabled:opacity-70"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => {
            onClose()
            onChangePassword()
          }}
          className="w-full h-11 rounded-lg clay-input flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="size-4" />
          Redefinir senha
        </button>
      </form>
    </ModalShell>
  )
}

// ============================================================
// Modal de VIP: concede/renova ou remove o acesso VIP de um usuario.
// O adm define a quantidade de dias; 0 = acesso vitalicio. Os dias restantes
// caem sozinhos a cada dia (calculado a partir da data de expiracao).
// ============================================================

function VipModal({
  user,
  onClose,
  onSaved,
}: {
  user: AppUser
  onClose: () => void
  onSaved: () => void
}) {
  const current = computeVipStatus(user)
  const [days, setDays] = useState(current.totalDays > 0 ? String(current.totalDays) : "30")
  const [lifetime, setLifetime] = useState(current.isVip && current.lifetime)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function grant(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const d = lifetime ? 0 : Math.max(1, Math.floor(Number(days) || 0))
    const { error } = await grantVip(user.id, {
      days: d,
      planName: current.planName || "VIP manual",
      // Sem extend: ao definir manualmente, conta a partir de hoje.
      extend: false,
    })
    if (error) {
      setError("Não foi possível salvar o VIP.")
      setSaving(false)
      return
    }
    onSaved()
  }

  async function remove() {
    if (!confirm(`Remover o VIP de ${user.name}? Ele perderá o acesso à IA.`)) return
    setSaving(true)
    const { error } = await revokeVip(user.id)
    if (error) {
      setError("Não foi possível remover o VIP.")
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <ModalShell title="Acesso VIP" onClose={onClose}>
      <form onSubmit={grant} className="space-y-3">
        <p className="text-sm text-muted-foreground -mt-1">
          Usuário: <span className="text-foreground">{user.name}</span>
        </p>

        {current.isVip && (
          <div className="skeuo-card-inset rounded-xl p-3 flex items-center gap-3">
            <span className="flex items-center justify-center size-9 rounded-lg bg-primary/15 shrink-0">
              <Crown className="size-4 text-primary" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">VIP ativo</p>
              <p className="text-[0.7rem] text-muted-foreground">
                {current.lifetime ? "Acesso vitalício" : `${current.daysLeft} dia(s) restante(s)`}
              </p>
            </div>
          </div>
        )}

        <label className="flex items-center justify-between gap-3 clay-input rounded-lg px-3 h-11">
          <span className="text-sm">Acesso vitalício</span>
          <input
            type="checkbox"
            checked={lifetime}
            onChange={(e) => setLifetime(e.target.checked)}
            className="size-4 accent-primary"
          />
        </label>

        {!lifetime && (
          <Labeled label="Dias de acesso">
            <input
              className={inputCls}
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Ex.: 30"
              required
            />
            <p className="text-[0.65rem] text-muted-foreground mt-1">
              O usuário terá {days || 0} dia(s) de acesso a partir de hoje. A contagem diminui a cada dia.
            </p>
          </Labeled>
        )}

        {error && <p className="text-xs text-primary">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="button-primary w-full h-11 rounded-lg font-semibold text-sm mt-1 disabled:opacity-70"
        >
          {saving ? "Salvando..." : current.isVip ? "Atualizar VIP" : "Conceder VIP"}
        </button>

        {current.isVip && (
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="w-full h-11 rounded-lg clay-input flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 disabled:opacity-70"
          >
            <Ban className="size-4" />
            Remover VIP
          </button>
        )}
      </form>
    </ModalShell>
  )
}

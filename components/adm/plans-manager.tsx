"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  Plus,
  Trash2,
  X,
  Pencil,
  Star,
  Eye,
  EyeOff,
  Check,
  Tag,
} from "lucide-react"
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  planPeriodLabel,
  planPeriodDefaultDays,
  planAccessDays,
  PLAN_PERIODS,
  type Plan,
  type PlanPeriod,
} from "@/lib/adm"

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(value)
  } catch {
    return `R$ ${value.toFixed(2)}`
  }
}

export function PlansManager({ adminId }: { adminId: string }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Plan | null>(null)

  async function refresh() {
    const { data } = await listPlans(adminId)
    setPlans(data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId])

  async function toggleActive(p: Plan) {
    await updatePlan(p.id, { is_active: !p.is_active })
    refresh()
  }

  async function remove(p: Plan) {
    if (!confirm(`Excluir o plano "${p.name}"? Esta ação não pode ser desfeita.`)) return
    await deletePlan(p.id)
    refresh()
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-2">
            Monetização
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight">Planos</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-md">
            Crie e edite os planos que aparecem para os seus usuários. Apenas a sua base vê estes planos.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="button-primary h-11 px-4 rounded-xl flex items-center gap-2 text-sm font-medium shrink-0"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Novo plano</span>
        </button>
      </header>

      <div className="space-y-3">
        {loading && <div className="skeuo-card rounded-2xl p-4 text-sm text-muted-foreground">Carregando…</div>}
        {!loading && plans.length === 0 && (
          <div className="skeuo-card rounded-2xl p-6 text-center text-sm text-muted-foreground">
            Nenhum plano criado ainda. Clique em “Novo plano” para começar.
          </div>
        )}
        {plans.map((p) => (
          <div
            key={p.id}
            className={`skeuo-card rounded-2xl p-4 ${p.is_active ? "" : "opacity-60"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <span className="px-2 h-5 inline-flex items-center rounded-full text-[0.55rem] font-mono uppercase tracking-wider bg-white/5 text-muted-foreground">
                    {planPeriodLabel(p.period)}
                  </span>
                  <span className="px-2 h-5 inline-flex items-center gap-1 rounded-full text-[0.55rem] font-mono uppercase tracking-wider bg-sky-500/15 text-sky-400">
                    {p.period === "vitalicio" || planAccessDays(p) === 0
                      ? "VIP vitalício"
                      : `${planAccessDays(p)} dias VIP`}
                  </span>
                  {p.is_popular && (
                    <span className="px-2 h-5 inline-flex items-center gap-1 rounded-full text-[0.55rem] font-mono uppercase tracking-wider bg-primary/15 text-primary">
                      <Star className="size-2.5" />
                      Popular
                    </span>
                  )}
                  {p.badge && (
                    <span className="px-2 h-5 inline-flex items-center gap-1 rounded-full text-[0.55rem] font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-400">
                      <Tag className="size-2.5" />
                      {p.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2 mt-2 flex-wrap">
                  {p.recurring_price === 0 ? (
                    // Pagamento único
                    <>
                      <span className="text-lg font-display font-bold">{formatPrice(p.first_price, p.currency)}</span>
                      <span className="text-[0.7rem] text-muted-foreground">pagamento único</span>
                    </>
                  ) : p.first_price !== p.recurring_price ? (
                    // 1ª cobrança promocional + recorrente
                    <>
                      <span className="text-lg font-display font-bold">{formatPrice(p.first_price, p.currency)}</span>
                      <span className="text-[0.7rem] text-muted-foreground">na 1ª cobrança</span>
                      <span className="text-[0.7rem] text-muted-foreground">
                        · depois {formatPrice(p.recurring_price, p.currency)}
                      </span>
                    </>
                  ) : (
                    // Mesmo valor sempre (só recorrente)
                    <>
                      <span className="text-lg font-display font-bold">
                        {formatPrice(p.recurring_price, p.currency)}
                      </span>
                      <span className="text-[0.7rem] text-muted-foreground">por {planPeriodLabel(p.period).toLowerCase()}</span>
                    </>
                  )}
                </div>

                {p.features.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className="size-3 text-emerald-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <button
                onClick={() => setEditTarget(p)}
                className="flex-1 h-9 rounded-lg clay-input flex items-center justify-center gap-1.5 text-xs text-foreground/90 hover:text-foreground"
              >
                <Pencil className="size-3.5" />
                Editar
              </button>
              <button
                onClick={() => toggleActive(p)}
                className="flex-1 h-9 rounded-lg clay-input flex items-center justify-center gap-1.5 text-xs text-foreground/90 hover:text-foreground"
              >
                {p.is_active ? (
                  <>
                    <EyeOff className="size-3.5" />
                    Ocultar
                  </>
                ) : (
                  <>
                    <Eye className="size-3.5" />
                    Exibir
                  </>
                )}
              </button>
              <button
                onClick={() => remove(p)}
                className="h-9 w-9 rounded-lg clay-input flex items-center justify-center text-primary hover:text-primary/80"
                aria-label="Excluir plano"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <PlanModal
          adminId={adminId}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            refresh()
          }}
        />
      )}

      {editTarget && (
        <PlanModal
          adminId={adminId}
          plan={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            refresh()
          }}
        />
      )}
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
      <div className="relative z-10 w-full max-w-md skeuo-card-deep rounded-2xl p-5 animate-fade-up max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sticky top-0">
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

// same  = mesmo valor sempre (recorrente)
// promo = desconto na 1ª cobrança, depois valor cheio
// once  = pagamento único (sem recorrência)
type BillingMode = "same" | "promo" | "once"

const BILLING_MODES: { value: BillingMode; label: string; hint: string }[] = [
  { value: "same", label: "Mesmo valor sempre", hint: "Cobra o mesmo valor em toda renovação." },
  { value: "promo", label: "Desconto na 1ª cobrança", hint: "1ª cobrança mais barata, depois o valor cheio." },
  { value: "once", label: "Pagamento único", hint: "Cobra uma vez, sem renovação." },
]

function PlanModal({
  adminId,
  plan,
  onClose,
  onSaved,
}: {
  adminId: string
  plan?: Plan
  onClose: () => void
  onSaved: () => void
}) {
  const editing = !!plan

  // Deriva o modo de cobrança de um plano existente.
  function deriveMode(p?: Plan): BillingMode {
    if (!p) return "same"
    if (p.recurring_price === 0) return "once"
    if (p.first_price !== p.recurring_price) return "promo"
    return "same"
  }

  const [name, setName] = useState(plan?.name ?? "")
  const [period, setPeriod] = useState<PlanPeriod>(plan?.period ?? "mensal")
  // Dias de acesso VIP liberados ao pagar. Vazio = usa o padrao da periodicidade.
  const [durationDays, setDurationDays] = useState(
    plan && Number(plan.duration_days) > 0 ? String(plan.duration_days) : "",
  )
  const [billingMode, setBillingMode] = useState<BillingMode>(deriveMode(plan))
  // Valor principal: usado nos modos "same" (recorrente) e "once" (único).
  const [mainPrice, setMainPrice] = useState(
    plan ? String(plan.recurring_price === 0 ? plan.first_price : plan.recurring_price) : "",
  )
  // Modo promo: preço promocional da 1ª cobrança + valor recorrente.
  const [firstPrice, setFirstPrice] = useState(plan ? String(plan.first_price) : "")
  const [recurringPrice, setRecurringPrice] = useState(plan ? String(plan.recurring_price) : "")
  const [badge, setBadge] = useState(plan?.badge ?? "")
  const [isPopular, setIsPopular] = useState(plan?.is_popular ?? false)
  const [features, setFeatures] = useState<string[]>(plan?.features ?? [])
  const [featureInput, setFeatureInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addFeature() {
    const v = featureInput.trim()
    if (!v) return
    setFeatures((f) => [...f, v])
    setFeatureInput("")
  }

  function removeFeature(i: number) {
    setFeatures((f) => f.filter((_, idx) => idx !== i))
  }

  function parsePrice(v: string) {
    return Number.parseFloat(v.replace(",", "."))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Calcula first_price e recurring_price a partir do modo escolhido.
    let first: number
    let recurring: number

    if (billingMode === "promo") {
      // 1ª cobrança promocional + valor recorrente cheio.
      first = parsePrice(firstPrice)
      recurring = parsePrice(recurringPrice)
      if (Number.isNaN(first) || first < 0) {
        setError("Informe um valor válido para a 1ª cobrança.")
        setSaving(false)
        return
      }
      if (Number.isNaN(recurring) || recurring < 0) {
        setError("Informe o valor recorrente (das próximas cobranças).")
        setSaving(false)
        return
      }
    } else if (billingMode === "once") {
      // Pagamento único: cobra uma vez (first), sem recorrência (recurring = 0).
      const v = parsePrice(mainPrice)
      if (Number.isNaN(v) || v < 0) {
        setError("Informe um valor válido para a cobrança.")
        setSaving(false)
        return
      }
      first = v
      recurring = 0
    } else {
      // "same": só recorrente — mesmo valor na 1ª e nas próximas cobranças.
      const v = parsePrice(mainPrice)
      if (Number.isNaN(v) || v < 0) {
        setError("Informe um valor válido para a cobrança.")
        setSaving(false)
        return
      }
      first = v
      recurring = v
    }

    // Dias de VIP: campo vazio -> 0 (usa padrao da periodicidade em planAccessDays).
    const duration_days = Math.max(0, Math.floor(Number(durationDays.replace(",", ".")) || 0))

    if (editing && plan) {
      const { error } = await updatePlan(plan.id, {
        name: name.trim(),
        period,
        first_price: first,
        recurring_price: recurring,
        badge: badge.trim(),
        is_popular: isPopular,
        features,
        duration_days,
      })
      if (error) {
        setError("Erro ao salvar o plano.")
        setSaving(false)
        return
      }
    } else {
      const { error } = await createPlan({
        admin_id: adminId,
        name,
        period,
        first_price: first,
        recurring_price: recurring,
        badge: badge.trim(),
        is_popular: isPopular,
        features,
        duration_days,
      })
      if (error) {
        setError("Erro ao criar o plano.")
        setSaving(false)
        return
      }
    }
    onSaved()
  }

  return (
    <ModalShell title={editing ? "Editar plano" : "Novo plano"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Labeled label="Nome do plano">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Premium"
            required
          />
        </Labeled>

        <Labeled label="Periodicidade">
          <select
            className={inputCls}
            value={period}
            onChange={(e) => setPeriod(e.target.value as PlanPeriod)}
          >
            {PLAN_PERIODS.map((p) => (
              <option key={p.value} value={p.value} className="bg-background">
                {p.label}
              </option>
            ))}
          </select>
        </Labeled>

        {period !== "vitalicio" && (
          <Labeled label="Dias de acesso VIP">
            <input
              className={inputCls}
              inputMode="numeric"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={`Padrão: ${planPeriodDefaultDays(period)} dias`}
            />
            <p className="text-[0.65rem] text-muted-foreground mt-1 leading-relaxed">
              Quantos dias de acesso à IA o usuário ganha ao pagar. Deixe vazio para usar o padrão da
              periodicidade ({planPeriodDefaultDays(period)} dias).
            </p>
          </Labeled>
        )}

        <div>
          <label className="text-[0.6rem] font-mono uppercase tracking-wider text-muted-foreground mb-2 block">
            Como você quer cobrar?
          </label>
          <div className="grid gap-2">
            {BILLING_MODES.map((m) => {
              const active = billingMode === m.value
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setBillingMode(m.value)}
                  className={`text-left rounded-xl px-3 py-2.5 transition-colors ${
                    active
                      ? "bg-primary/15 ring-1 ring-primary/50"
                      : "clay-input hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-4 rounded-full flex items-center justify-center shrink-0 ${
                        active ? "bg-primary text-primary-foreground" : "bg-white/10"
                      }`}
                    >
                      {active && <Check className="size-2.5" />}
                    </span>
                    <span className="text-sm font-medium">{m.label}</span>
                  </div>
                  <p className="text-[0.65rem] text-muted-foreground mt-1 ml-6 leading-relaxed">{m.hint}</p>
                </button>
              )
            })}
          </div>
        </div>

        {billingMode === "promo" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Valor da 1ª cobrança">
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={firstPrice}
                  onChange={(e) => setFirstPrice(e.target.value)}
                  placeholder="9,90"
                  required
                />
              </Labeled>
              <Labeled label="Valor das próximas">
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={recurringPrice}
                  onChange={(e) => setRecurringPrice(e.target.value)}
                  placeholder="29,90"
                  required
                />
              </Labeled>
            </div>
            <p className="text-[0.65rem] text-muted-foreground -mt-1 leading-relaxed">
              A primeira cobrança sai mais barata e, a partir da renovação seguinte, passa a cobrar o valor cheio.
            </p>
          </>
        ) : (
          <>
            <Labeled label={billingMode === "once" ? "Valor da cobrança" : "Valor da assinatura"}>
              <input
                className={inputCls}
                inputMode="decimal"
                value={mainPrice}
                onChange={(e) => setMainPrice(e.target.value)}
                placeholder="29,90"
                required
              />
            </Labeled>
            <p className="text-[0.65rem] text-muted-foreground -mt-1 leading-relaxed">
              {billingMode === "once"
                ? "Cobrança única: o usuário paga uma vez e não há renovação automática."
                : "Esse valor é cobrado na primeira vez e se repete em toda renovação."}
            </p>
          </>
        )}

        <Labeled label="Tag chamativa (opcional)">
          <input
            className={inputCls}
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            placeholder="Ex: Economize 25%"
          />
        </Labeled>

        <Labeled label="Benefícios">
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={featureInput}
              onChange={(e) => setFeatureInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addFeature()
                }
              }}
              placeholder="Ex: Acesso ilimitado"
            />
            <button
              type="button"
              onClick={addFeature}
              className="h-11 px-3 rounded-lg clay-input flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Adicionar benefício"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </Labeled>
        {features.length > 0 && (
          <ul className="space-y-1.5">
            {features.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 clay-input rounded-lg px-3 h-9 text-xs"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Check className="size-3 text-emerald-400 shrink-0" />
                  <span className="truncate">{f}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFeature(i)}
                  className="text-muted-foreground hover:text-primary shrink-0"
                  aria-label="Remover benefício"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setIsPopular((v) => !v)}
          className="w-full flex items-center justify-between clay-input rounded-lg px-3 h-11"
        >
          <span className="flex items-center gap-2 text-sm">
            <Star className={`size-4 ${isPopular ? "text-primary" : "text-muted-foreground"}`} />
            Marcar como mais popular
          </span>
          <span
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              isPopular ? "bg-primary" : "bg-white/10"
            }`}
          >
            <span
              className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                isPopular ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>

        {error && <p className="text-xs text-primary">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="button-primary w-full h-11 rounded-lg font-semibold text-sm mt-1 disabled:opacity-70"
        >
          {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar plano"}
        </button>
      </form>
    </ModalShell>
  )
}

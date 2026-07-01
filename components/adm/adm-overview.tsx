"use client"

import { useEffect, useState } from "react"
import { ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react"
import { listAdmins, type Admin } from "@/lib/adm"
import type { AdmSession } from "@/lib/adm-session"
import { SalesDashboard } from "@/components/adm/sales-dashboard"

type SectionId = "overview" | "users" | "support" | "links" | "referral" | "admins"

export function AdmOverview({
  session,
  onNavigate,
}: {
  session: AdmSession
  onNavigate: (id: SectionId) => void
}) {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)

  const isSupreme = session.role === "supreme"

  useEffect(() => {
    if (!isSupreme) return
    let active = true
    // Supremo: carrega admins
    listAdmins().then((result) => {
      if (!active) return
      setAdmins(result.data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [isSupreme])

  // Admin normal: dashboard de vendas dedicada.
  if (!isSupreme) {
    return <SalesDashboard session={session} />
  }

  // Stats para Supremo
  const activeAdmins = admins.filter((a) => a.status === "active" && a.role !== "supreme").length
  const bannedAdmins = admins.filter((a) => a.status === "banned").length
  const totalAdmins = admins.filter((a) => a.role !== "supreme").length

  const supremeStats = [
    { label: "Total Admins", value: totalAdmins, icon: ShieldCheck, action: "admins" as const },
    { label: "Admins Ativos", value: activeAdmins, icon: ShieldAlert, action: "admins" as const },
    { label: "Admins Banidos", value: bannedAdmins, icon: ShieldOff, action: "admins" as const },
  ]

  return (
    <div className="animate-fade-up">
      <header className="mb-8">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-2">
          Painel
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">
          Olá, {session.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Gerencie os administradores da plataforma.
        </p>
      </header>

      <section className="grid gap-3 sm:gap-4 grid-cols-3">
        {supremeStats.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.label}
              onClick={() => onNavigate(s.action)}
              className="skeuo-card rounded-2xl p-4 sm:p-5 text-left hover:border-primary/30 transition-colors"
            >
              <div className="size-9 rounded-xl skeuo-icon-container flex items-center justify-center mb-3">
                <Icon className="size-4 text-primary" />
              </div>
              <p className="font-display text-2xl font-bold tabular-nums">
                {loading ? "—" : s.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </button>
          )
        })}
      </section>

      <section className="mt-8">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground mb-4 px-1">
          Últimos admins
        </p>
        <div className="space-y-2">
          {loading && (
            <div className="skeuo-card rounded-2xl p-4 text-sm text-muted-foreground">Carregando…</div>
          )}
          {!loading && admins.filter((a) => a.role !== "supreme").length === 0 && (
            <div className="skeuo-card rounded-2xl p-6 text-center text-sm text-muted-foreground">
              Nenhum admin criado ainda. Crie um novo admin na seção Admins.
            </div>
          )}
          {admins
            .filter((a) => a.role !== "supreme")
            .slice(0, 5)
            .map((a) => (
              <div
                key={a.id}
                className="skeuo-card rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                </div>
                <span
                  className={`shrink-0 px-2 h-6 inline-flex items-center rounded-full text-[0.6rem] font-mono uppercase tracking-wider ${
                    a.status === "active"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  {a.status === "active" ? "Ativo" : "Banido"}
                </span>
              </div>
            ))}
        </div>
      </section>
    </div>
  )
}

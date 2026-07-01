"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  LifeBuoy,
  Link2,
  Share2,
  ShieldCheck,
  CreditCard,
  ShoppingBag,
  Wallet,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import { getAdmSession, clearAdmSession, type AdmSession } from "@/lib/adm-session"
import { AdmOverview } from "@/components/adm/adm-overview"
import { UsersManager } from "@/components/adm/users-manager"
import { SupportInbox } from "@/components/adm/support-inbox"
import { SupportLinks } from "@/components/adm/support-links"
import { ReferralCard } from "@/components/adm/referral-card"
import { AdminsManager } from "@/components/adm/admins-manager"
import { PlansManager } from "@/components/adm/plans-manager"
import { GatewaySettings } from "@/components/adm/gateway-settings"
import { SalesList } from "@/components/adm/sales-list"

type SectionId = "overview" | "sales" | "users" | "plans" | "support" | "links" | "gateway" | "referral" | "admins"

type NavItem = {
  id: SectionId
  label: string
  icon: typeof Users
  supremeOnly?: boolean
  adminOnly?: boolean // só para admins normais, não para supremo
}

const NAV: NavItem[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "sales", label: "Vendas", icon: ShoppingBag, adminOnly: true },
  { id: "users", label: "Usuários", icon: Users, adminOnly: true },
  { id: "plans", label: "Planos", icon: CreditCard, adminOnly: true },
  { id: "support", label: "Suporte", icon: LifeBuoy, adminOnly: true },
  { id: "links", label: "Links", icon: Link2, adminOnly: true },
  { id: "gateway", label: "Gateway", icon: Wallet, adminOnly: true },
  { id: "referral", label: "Indicação", icon: Share2, adminOnly: true },
  { id: "admins", label: "Admins", icon: ShieldCheck, supremeOnly: true },
]

export function AdmShell() {
  const router = useRouter()
  const [session, setSession] = useState<AdmSession | null>(null)
  const [ready, setReady] = useState(false)
  const [section, setSection] = useState<SectionId>("overview")
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const s = getAdmSession()
    if (!s) {
      router.replace("/adm")
      return
    }
    setSession(s)
    setReady(true)
  }, [router])

  const nav = useMemo(
    () => NAV.filter((item) => {
      // Se é supremeOnly, só mostra pro supremo
      if (item.supremeOnly && session?.role !== "supreme") return false
      // Se é adminOnly, só mostra pro admin normal (não supremo)
      if (item.adminOnly && session?.role === "supreme") return false
      return true
    }),
    [session],
  )

  function handleLogout() {
    clearAdmSession()
    router.replace("/adm")
  }

  if (!ready || !session) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <span className="size-3 rounded-full bg-primary animate-pulse" />
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh lg:flex">
      <div className="absolute inset-0 grid-overlay opacity-40 pointer-events-none" aria-hidden />

      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto flex-col gap-2 p-5 border-r border-border relative z-10">
        <SidebarContent
          session={session}
          nav={nav}
          section={section}
          onSelect={(id) => setSection(id)}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-16 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold tracking-tight text-lg">CORINGA</span>
          <span className="font-mono text-[0.55rem] uppercase tracking-[0.25em] text-primary">adm</span>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          className="size-10 rounded-xl clay-input flex items-center justify-center"
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[80%] p-5 bg-surface border-r border-border flex flex-col gap-2 animate-fade-up">
            <div className="flex justify-end">
              <button
                onClick={() => setMenuOpen(false)}
                className="size-9 rounded-xl clay-input flex items-center justify-center"
                aria-label="Fechar menu"
              >
                <X className="size-4" />
              </button>
            </div>
            <SidebarContent
              session={session}
              nav={nav}
              section={section}
              onSelect={(id) => {
                setSection(id)
                setMenuOpen(false)
              }}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 relative z-10 px-4 sm:px-8 py-8 max-w-4xl w-full mx-auto">
        {section === "overview" && <AdmOverview session={session} onNavigate={setSection} />}
        {section === "sales" && <SalesList adminId={session.id} />}
        {section === "users" && <UsersManager adminId={session.id} />}
        {section === "plans" && <PlansManager adminId={session.id} />}
        {section === "support" && <SupportInbox adminId={session.id} />}
        {section === "links" && <SupportLinks adminId={session.id} />}
        {section === "gateway" && <GatewaySettings adminId={session.id} />}
        {section === "referral" && <ReferralCard adminId={session.id} />}
        {section === "admins" && session.role === "supreme" && <AdminsManager />}
      </main>
    </div>
  )
}

function SidebarContent({
  session,
  nav,
  section,
  onSelect,
  onLogout,
}: {
  session: AdmSession
  nav: NavItem[]
  section: SectionId
  onSelect: (id: SectionId) => void
  onLogout: () => void
}) {
  const isSupreme = session.role === "supreme"
  const initial = (session.name?.trim()?.[0] || "A").toUpperCase()

  return (
    <>
      <div className="hidden lg:flex items-center gap-2 px-2 mb-5">
        <span className="font-display font-bold tracking-tight text-xl">CORINGA</span>
        <span className="font-mono text-[0.55rem] uppercase tracking-[0.25em] text-primary">adm</span>
      </div>

      {/* Card de usuário */}
      <div className="relative flex items-center gap-3 p-3 rounded-2xl skeuo-card mb-5 overflow-hidden">
        <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" aria-hidden />
        <div className="size-11 shrink-0 rounded-xl skeuo-icon-container flex items-center justify-center">
          <span className="font-display font-bold text-lg text-primary">{initial}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate leading-tight">{session.name}</p>
          <p className="text-xs text-muted-foreground truncate leading-tight">{session.email}</p>
        </div>
        <span
          className={`shrink-0 px-2 h-5 inline-flex items-center rounded-full text-[0.55rem] font-mono uppercase tracking-wider ${
            isSupreme ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"
          }`}
        >
          {isSupreme ? "Supremo" : "Admin"}
        </span>
      </div>

      <p className="px-3 mb-2 font-mono text-[0.55rem] uppercase tracking-[0.28em] text-muted-foreground/60">
        Menu
      </p>

      <nav className="flex flex-col gap-1 flex-1">
        {nav.map((item) => {
          const Icon = item.icon
          const active = section === item.id
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-3 pl-3 pr-3 h-11 rounded-xl text-sm transition-all text-left ${
                active
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-full bg-primary transition-all ${
                  active ? "h-6 opacity-100" : "h-0 opacity-0"
                }`}
                aria-hidden
              />
              <span
                className={`size-8 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "bg-white/[0.03] text-muted-foreground group-hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
              </span>
              <span className={active ? "font-medium" : ""}>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="h-px bg-border my-3" aria-hidden />

      <button
        onClick={onLogout}
        className="group flex items-center gap-3 pl-3 pr-3 h-11 rounded-xl text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
      >
        <span className="size-8 shrink-0 rounded-lg bg-white/[0.03] flex items-center justify-center group-hover:bg-primary/15 transition-colors">
          <LogOut className="size-4" />
        </span>
        <span>Sair</span>
      </button>
    </>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { User, Wallet, Hash, LogOut, ShieldCheck, Loader2 } from "lucide-react"
import { getAtlaxSession, clearAtlaxSession, updateAtlaxUser } from "@/lib/atlax-session"
import { getDemoSession, clearDemoSession } from "@/lib/demo-session"

type Profile = {
  name: string
  login: string
  id: number | string
  credit: string
  isDemo?: boolean
}

// Gera um ID numerico estavel (7 digitos) a partir de uma string, para que a
// conta demo exiba algo parecido com um ID real da corretora em vez de "DEMO".
function demoDisplayId(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const id = 1000000 + (Math.abs(hash) % 9000000)
  return String(id)
}

export function ProfileContent() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    // Conta demo: dados locais, sem chamada a corretora.
    const demo = getDemoSession()
    if (demo) {
      setProfile({
        name: demo.name || demo.login,
        login: demo.login,
        id: demoDisplayId(demo.appUserId || demo.login),
        credit: demo.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        isDemo: true,
      })
      setLoading(false)
      return
    }

    const s = getAtlaxSession()
    if (s) {
      setProfile({
        name: s.user.name || s.user.login,
        login: s.user.login,
        id: s.user.id,
        credit: s.user.credit || "—",
      })
      // Atualiza o saldo com o valor mais recente da corretora.
      fetch("/api/atlax/balance", { headers: { Authorization: `Bearer ${s.token}` } })
        .then((r) => r.json())
        .then((data) => {
          if (data.credit !== undefined) {
            setProfile((prev) => (prev ? { ...prev, credit: data.credit } : prev))
            updateAtlaxUser({ credit: data.credit })
          }
        })
        .catch(() => {})
    }
    setLoading(false)
  }, [])

  function handleSignOut() {
    setSigningOut(true)
    clearAtlaxSession()
    clearDemoSession()
    router.push("/")
    router.refresh()
  }

  const initial = (profile?.name?.[0] || profile?.login?.[0] || "?").toUpperCase()

  return (
    <div className="animate-fade-up">
      <section className="mt-4 text-center">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-3">
          {profile?.isDemo ? "Conta Demo" : "Conta Atlax"}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight text-balance">
          Perfil
        </h1>
      </section>

      {/* Avatar */}
      <section className="mt-10 flex flex-col items-center">
        <div className="size-24 rounded-full bg-primary flex items-center justify-center">
          <span className="font-display text-3xl font-bold text-primary-foreground">{initial}</span>
        </div>

        <p className="mt-4 font-display text-xl font-bold">{loading ? "Carregando…" : profile?.name}</p>
        <div className="mt-2 flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-primary" />
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">
            {profile?.isDemo ? "Conta de demonstração" : "Conectado à corretora"}
          </span>
        </div>
      </section>

      {/* Dados */}
      <section className="mt-10 flex flex-col gap-3 lg:grid lg:grid-cols-3 lg:gap-4">
        <InfoRow icon={<User className="size-4" />} label="Usuário" value={profile?.login} loading={loading} />
        <InfoRow icon={<Hash className="size-4" />} label="ID Atlax" value={profile ? String(profile.id) : undefined} loading={loading} />
        <InfoRow
          icon={<Wallet className="size-4" />}
          label="Saldo"
          value={profile ? `R$ ${profile.credit}` : undefined}
          loading={loading}
        />
      </section>

      {/* Sair */}
      <section className="mt-10 lg:mx-auto lg:max-w-sm">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="button-primary w-full rounded-2xl h-12 flex items-center justify-center gap-2 text-sm text-primary-foreground disabled:opacity-60"
        >
          <LogOut className="size-4" />
          <span className="font-mono uppercase tracking-[0.2em] text-xs">
            {signingOut ? "Saindo…" : "Sair da conta"}
          </span>
        </button>
      </section>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  loading: boolean
}) {
  return (
    <div className="clay-card rounded-2xl p-4 flex items-center gap-4">
      <div className="size-9 rounded-xl bg-background/60 ring-1 ring-border flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[0.55rem] uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground/90 truncate mt-0.5">{loading ? "…" : value}</p>
      </div>
    </div>
  )
}

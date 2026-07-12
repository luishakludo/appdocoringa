"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, Lock, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { admLogin } from "@/lib/adm"
import { setAdmSession } from "@/lib/adm-session"

export function AdmLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { admin, error: loginError } = await admLogin(email, password)

    if (loginError || !admin) {
      setError(loginError ?? "Acesso negado.")
      setLoading(false)
      return
    }

    setAdmSession({ id: admin.id, name: admin.name, email: admin.email, role: admin.role })
    router.push("/adm/dashboard")
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full max-w-md mx-auto liquid-glass-strong rounded-3xl p-7 sm:p-9 animate-fade-up overflow-hidden"
      style={{ animationDelay: "120ms" }}
    >
      <div className="pb-layer pb-soft" aria-hidden />
      <div className="pb-layer pb-medium" aria-hidden />
      <div className="pb-layer pb-strong" aria-hidden />

      <div className="relative z-10 mb-7">
        <div className="inline-flex items-center gap-2 mb-4 px-3 h-7 rounded-full clay-input">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden />
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-foreground/80">
            Painel administrativo
          </span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight text-balance">
          Acesso restrito
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Entre com suas credenciais de administrador.
        </p>
      </div>

      <div className="relative z-10 space-y-4">
        <div>
          <label htmlFor="adm-email" className="sr-only">
            E-mail
          </label>
          <div className="clay-input rounded-2xl flex items-center gap-3 px-4 h-14">
            <Mail className="size-4 text-muted-foreground shrink-0" aria-hidden />
            <input
              id="adm-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@coringa.ai"
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        <div>
          <label htmlFor="adm-password" className="sr-only">
            Senha
          </label>
          <div className="clay-input rounded-2xl flex items-center gap-3 px-4 h-14">
            <Lock className="size-4 text-muted-foreground shrink-0" aria-hidden />
            <input
              id="adm-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl px-4 py-3 text-xs text-foreground/90 border border-primary/30"
            style={{
              background: "linear-gradient(180deg, rgba(217,4,41,0.12), rgba(217,4,41,0.04))",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="button-primary w-full h-14 rounded-2xl font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-white/90 animate-pulse" />
              <span>Verificando</span>
            </span>
          ) : (
            <>
              <span>Entrar no painel</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}

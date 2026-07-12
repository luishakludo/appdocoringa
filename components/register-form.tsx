"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Mail, Lock, ArrowRight, Eye, EyeOff, User, Phone } from "lucide-react"
import { findAdminByReferral, createAppUser, findAppUserByEmail, getSupremeAdminId, type Admin } from "@/lib/adm"
import { setUserSession } from "@/lib/user-session"

export function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refAdmin, setRefAdmin] = useState<Admin | null>(null)

  useEffect(() => {
    const ref = searchParams.get("ref")
    if (!ref) return
    findAdminByReferral(ref).then((admin) => {
      if (admin) setRefAdmin(admin)
    })
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    // Verifica se o e-mail ja existe na base.
    const existing = await findAppUserByEmail(email)
    if (existing) {
      setError("Este e-mail já está cadastrado.")
      setLoading(false)
      return
    }

    // Vincula o cadastro a base do adm que indicou, ou ao adm supremo.
    const adminId = refAdmin?.id ?? (await getSupremeAdminId())
    if (!adminId) {
      setError("Não foi possível criar a conta. Tente novamente.")
      setLoading(false)
      return
    }

    const { data, error: createError } = await createAppUser({
      admin_id: adminId,
      name,
      email,
      phone,
      password,
      source: refAdmin ? "referral" : "manual",
    })

    if (createError || !data) {
      setError("Não foi possível criar a conta. Tente novamente.")
      setLoading(false)
      return
    }

    setUserSession({
      id: data.id,
      admin_id: data.admin_id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      createdAt: data.created_at,
    })

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <>
      <svg
        aria-hidden
        style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
      >
        <defs>
          <filter
            id="liquid-glass-distort"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.018"
              numOctaves="2"
              seed="9"
              result="noise"
            />
            <feGaussianBlur in="noise" stdDeviation="3" result="softNoise" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="softNoise"
              scale="90"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md mx-auto liquid-glass-strong rounded-3xl p-7 sm:p-9 animate-fade-up overflow-hidden"
        style={{ animationDelay: "120ms" }}
      >
      <div className="pb-layer pb-soft" aria-hidden />
      <div className="pb-layer pb-medium" aria-hidden />
      <div className="pb-layer pb-strong" aria-hidden />

      <div className="relative z-10 mb-7">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-3">
          Novo usuário
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight text-balance">
          Criar conta
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Cadastre-se para acessar os sinais de day trade.
        </p>
        {refAdmin && (
          <div
            className="mt-3 inline-flex items-center gap-2 px-3 h-7 rounded-full border border-primary/30"
            style={{ background: "linear-gradient(180deg, rgba(217,4,41,0.12), rgba(217,4,41,0.04))" }}
          >
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="text-[0.65rem] font-mono uppercase tracking-wider text-foreground/80">
              Convite de {refAdmin.name}
            </span>
          </div>
        )}
      </div>

      <div className="relative">
        <div className="relative space-y-4 z-10">
        {/* Name */}
        <div>
          <label htmlFor="name" className="sr-only">
            Nome
          </label>
          <div className="clay-input rounded-2xl flex items-center gap-3 px-4 h-14">
            <User className="size-4 text-muted-foreground shrink-0" aria-hidden />
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="sr-only">
            E-mail
          </label>
          <div className="clay-input rounded-2xl flex items-center gap-3 px-4 h-14">
            <Mail className="size-4 text-muted-foreground shrink-0" aria-hidden />
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="sr-only">
            Telefone
          </label>
          <div className="clay-input rounded-2xl flex items-center gap-3 px-4 h-14">
            <Phone className="size-4 text-muted-foreground shrink-0" aria-hidden />
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="sr-only">
            Senha
          </label>
          <div className="clay-input rounded-2xl flex items-center gap-3 px-4 h-14">
            <Lock className="size-4 text-muted-foreground shrink-0" aria-hidden />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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

        {/* Error */}
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

        {/* Success */}
        {success && (
          <div
            role="status"
            className="rounded-xl px-4 py-3 text-xs text-foreground/90 border border-emerald-500/30"
            style={{
              background: "linear-gradient(180deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))",
            }}
          >
            {success}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="button-primary w-full h-14 rounded-2xl font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-white/90 animate-pulse" />
              <span>Cadastrando</span>
            </span>
          ) : (
            <>
              <span>Criar conta</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 pt-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground font-mono">
            ou
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-sm text-foreground/90 hover:text-foreground transition-colors clay-input"
          aria-label="Já tenho conta"
          onClick={() => router.push("/")}
        >
          <span>Já tenho conta</span>
        </button>
        </div>
        </div>
      </form>
    </>
  )
}

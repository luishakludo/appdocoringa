"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { User, Lock, ArrowRight, Eye, EyeOff } from "lucide-react"
import { setAtlaxSession } from "@/lib/atlax-session"
import { setUserSession } from "@/lib/user-session"
import { resolveUserBase, demoLogin } from "@/lib/adm"
import { setDemoSession, clearDemoSession } from "@/lib/demo-session"

const ATLAX_SIGNUP_URL = "https://atlaxoption.com"

export function LoginForm() {
  const router = useRouter()
  const [usuario, setUsuario] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 1) Tenta login como conta DEMO (nao usa a Atlax).
      // Se o email informado corresponder a uma conta demo, entramos por aqui.
      try {
        const { user, meta, error: demoErr } = await demoLogin(usuario, password)
        if (demoErr) {
          setError(demoErr)
          setLoading(false)
          return
        }
        if (user && meta) {
          setDemoSession({
            appUserId: user.id,
            adminId: user.admin_id,
            login: user.email,
            name: user.name,
            rtp: meta.rtp,
            balance: meta.balance,
          })
          router.push("/dashboard")
          router.refresh()
          return
        }
      } catch (err) {
        console.log("[v0] demoLogin error:", err instanceof Error ? err.message : err)
      }

      // 2) Fluxo normal: conta real na Atlax.
      clearDemoSession()
      const res = await fetch("/api/atlax/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: usuario, pass: password }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.message || "Acesso negado. Verifique suas credenciais.")
        setLoading(false)
        return
      }

      setAtlaxSession({
        token: data.accessToken,
        user: {
          id: data.id,
          login: data.login,
          name: data.name,
          credit: data.credit,
        },
      })

      // Vincula o usuario a uma base de adm.
      // - Link de indicacao (?ref=CODE): entra na base daquele adm na 1a vez.
      // - Sem indicacao / sem cadastro previo: cai na base padrao (hakla02).
      // - Ja cadastrado: mantem a base atual (vinculo travado).
      // Mesmo se algo falhar, o usuario entra no app normalmente.
      try {
        const refCode =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("ref")
            : null

        const { user } = await resolveUserBase({
          login: data.login,
          name: data.name,
          email: data.email,
          refCode,
        })

        if (user) {
          setUserSession({
            id: user.id,
            admin_id: user.admin_id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            createdAt: user.created_at,
          })
        }
      } catch (err) {
        console.log("[v0] resolveUserBase error:", err instanceof Error ? err.message : err)
      }

      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Erro ao conectar com a corretora. Tente novamente.")
      setLoading(false)
    }
  }

  return (
    <>
      {/*
        Apple-style Liquid Glass refraction filter.
        feTurbulence generates organic noise, feGaussianBlur softens it,
        feDisplacementMap uses it to distort the source (water-drop effect).
      */}
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
        className="relative w-full max-w-md mx-auto liquid-glass-strong rounded-3xl p-7 sm:p-9 animate-fade-up-glass overflow-hidden"
        style={{ animationDelay: "120ms" }}
      >
        <div className="pb-layer pb-soft" aria-hidden />
        <div className="pb-layer pb-medium" aria-hidden />
        <div className="pb-layer pb-strong" aria-hidden />

        <div className="relative z-10 mb-7">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-3">
          Conta Atlax
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight text-balance">
          Entrar no sistema
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Use seu usuário e senha da Atlax para operar de forma automática.
        </p>
      </div>

      <div className="relative z-10 space-y-4">
        {/* Usuario */}
        <div>
          <label htmlFor="usuario" className="sr-only">
            Usuário
          </label>
          <div className="clay-input rounded-2xl flex items-center gap-3 px-4 h-14">
            <User className="size-4 text-muted-foreground shrink-0" aria-hidden />
            <input
              id="usuario"
              type="text"
              autoComplete="username"
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Seu usuário Atlax"
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

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="button-primary w-full h-14 rounded-2xl font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-white/90 animate-pulse" />
              <span>Autenticando</span>
            </span>
          ) : (
            <>
              <span>Entrar</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>

        {/* Divider + Criar conta (externo) */}
        <div className="flex items-center gap-4 pt-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground font-mono">
            ou
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <a
          href={ATLAX_SIGNUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-sm text-foreground/90 hover:text-foreground transition-colors clay-input"
          aria-label="Criar conta na Atlax"
        >
          <span>Criar conta na Atlax</span>
        </a>
        </div>
      </form>
    </>
  )
}

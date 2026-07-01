"use client"

import { useEffect, useState } from "react"
import { Copy, Check, Share2, Users } from "lucide-react"
import { getAdmin, countReferrals } from "@/lib/adm"

export function ReferralCard({ adminId }: { adminId: string }) {
  const [code, setCode] = useState("")
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin)
    Promise.all([getAdmin(adminId), countReferrals(adminId)]).then(([a, c]) => {
      if (a.data) setCode(a.data.referral_code)
      setCount(c)
      setLoading(false)
    })
  }, [adminId])

  const link = code ? `${origin}/?ref=${code}` : ""

  async function copy() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-2">
          Crescimento
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">Link de indicação</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Compartilhe seu link. Quem logar pela primeira vez por ele entra na sua base.
        </p>
      </header>

      {loading ? (
        <div className="skeuo-card rounded-2xl p-4 text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="space-y-4 max-w-lg">
          <div className="skeuo-card rounded-2xl p-5 flex items-center gap-4">
            <div className="size-12 rounded-2xl skeuo-icon-container flex items-center justify-center">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-display text-3xl font-bold tabular-nums">{count}</p>
              <p className="text-xs text-muted-foreground">usuários via indicação</p>
            </div>
          </div>

          <div>
            <label className="text-[0.65rem] font-mono uppercase tracking-wider text-muted-foreground mb-2 block">
              Seu link
            </label>
            <div className="clay-input rounded-2xl flex items-center gap-3 px-4 h-14">
              <Share2 className="size-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm text-foreground/90 truncate font-mono">{link}</span>
              <button
                onClick={copy}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Copiar link"
              >
                {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1">
            <span className="text-xs text-muted-foreground">Código:</span>
            <code className="text-xs font-mono text-foreground bg-white/5 px-2 py-1 rounded-lg">{code}</code>
          </div>

          <button
            onClick={copy}
            className="button-primary w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Link copiado" : "Copiar link de indicação"}
          </button>
        </div>
      )}
    </div>
  )
}

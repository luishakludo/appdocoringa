"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { KeyRound, Eye, EyeOff, Save, CheckCircle2, ShieldCheck } from "lucide-react"
import { getAdmin, updateAdmin } from "@/lib/adm"

export function GatewaySettings({ adminId }: { adminId: string }) {
  const [secretKey, setSecretKey] = useState("")
  const [showSecret, setShowSecret] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  // Chave realmente persistida no banco (relida apos salvar/carregar).
  const [storedKey, setStoredKey] = useState("")

  useEffect(() => {
    getAdmin(adminId).then(({ data }) => {
      if (data) {
        setSecretKey(data.gateway_secret_key ?? "")
        setStoredKey(data.gateway_secret_key ?? "")
      }
      setLoading(false)
    })
  }, [adminId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError("")
    // Limpa lixo invisivel do copiar/colar (espacos, quebras de linha, largura-zero
    // e um "Bearer " acidental) que faz a Buck Pay devolver 401.
    const cleanKey = secretKey
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, "")
      .replace(/^Bearer/i, "")
      .trim()
    setSecretKey(cleanKey)

    // 1. Grava e checa se o banco retornou erro (antes o erro era ignorado,
    //    entao aparecia "Salvo" mesmo quando nada era persistido).
    const { data, error: updErr } = await updateAdmin(adminId, {
      gateway_secret_key: cleanKey,
    })

    if (updErr) {
      setSaving(false)
      setError(`Falha ao salvar no banco: ${updErr.message ?? "erro desconhecido"}`)
      return
    }

    // 2. Confirma relendo a chave que realmente ficou gravada nesse admin.
    const persisted = data?.gateway_secret_key ?? ""
    setStoredKey(persisted)

    if (persisted !== cleanKey) {
      setSaving(false)
      setError(
        "A chave nao foi gravada corretamente neste admin. Verifique se voce esta logado na conta dona dos planos.",
      )
      return
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const inputCls =
    "flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/50 font-mono"

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-2">
          Gateway
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">Gateway de pagamento</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-md">
          Conecte a sua conta da Buck Pay informando a sua Secret Key. Ela é usada para gerar os PIX dos seus
          usuários — e o dinheiro cai direto na sua conta.
        </p>
      </header>

      {loading ? (
        <div className="skeuo-card rounded-2xl p-4 text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <form onSubmit={submit} className="space-y-4 max-w-lg">
          <div>
            <label className="text-[0.65rem] font-mono uppercase tracking-wider text-muted-foreground mb-2 block">
              Secret Key
            </label>
            <div className="clay-input rounded-2xl flex items-center gap-3 px-4 h-14">
              <KeyRound className="size-4 text-primary shrink-0" />
              <input
                type={showSecret ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="sk_live_..."
                className={inputCls}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label={showSecret ? "Ocultar chave" : "Mostrar chave"}
              >
                {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-[0.7rem] text-muted-foreground mt-2 leading-relaxed">
              Use a sua Secret Key da Buck Pay (começa com{" "}
              <span className="font-mono text-foreground">sk_live_</span>). É só ela que a Buck Pay usa para gerar os
              PIX — todos caem direto na sua conta.
            </p>

            {/* Diagnostico: mostra o que ESTA gravado no banco para este admin. */}
            <p className="text-[0.7rem] text-muted-foreground mt-2 leading-relaxed font-mono">
              Salva no banco:{" "}
              <span className="text-foreground">
                {storedKey ? `${storedKey.slice(0, 11)}…${storedKey.slice(-4)} (${storedKey.length} chars)` : "nenhuma"}
              </span>
              <br />
              Admin: <span className="text-foreground">{adminId}</span>
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3">
              <p className="text-xs text-destructive leading-relaxed">{error}</p>
            </div>
          )}

          <div className="skeuo-card rounded-2xl p-4 flex gap-3">
            <ShieldCheck className="size-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cada admin usa a sua própria conta. A sua Secret Key fica vinculada apenas a você e os PIX gerados pelos
              seus usuários caem direto na sua conta Buck Pay — nunca é compartilhada com outros admins.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="button-primary h-12 px-6 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-70"
          >
            {saved ? (
              <>
                <CheckCircle2 className="size-4" />
                Salvo
              </>
            ) : (
              <>
                <Save className="size-4" />
                {saving ? "Salvando…" : "Salvar"}
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}

"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Phone, AtSign, Save, CheckCircle2 } from "lucide-react"
import { getAdmin, updateAdmin } from "@/lib/adm"

export function SupportLinks({ adminId }: { adminId: string }) {
  const [whatsapp, setWhatsapp] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAdmin(adminId).then(({ data }) => {
      if (data) {
        setWhatsapp(data.whatsapp_link ?? "")
        setEmail(data.support_email ?? "")
      }
      setLoading(false)
    })
  }, [adminId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    await updateAdmin(adminId, { whatsapp_link: whatsapp.trim(), support_email: email.trim() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const inputCls =
    "flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/50"

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-2">
          Configuração
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">Links de suporte</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Defina os canais que aparecem para os seus usuários no app.
        </p>
      </header>

      {loading ? (
        <div className="skeuo-card rounded-2xl p-4 text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <form onSubmit={submit} className="space-y-4 max-w-lg">
          <div>
            <label className="text-[0.65rem] font-mono uppercase tracking-wider text-muted-foreground mb-2 block">
              Link do WhatsApp
            </label>
            <div className="clay-input rounded-2xl flex items-center gap-3 px-4 h-14">
              <Phone className="size-4 text-emerald-400 shrink-0" />
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="https://wa.me/55119..."
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="text-[0.65rem] font-mono uppercase tracking-wider text-muted-foreground mb-2 block">
              E-mail de suporte
            </label>
            <div className="clay-input rounded-2xl flex items-center gap-3 px-4 h-14">
              <AtSign className="size-4 text-primary shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="suporte@seudominio.com"
                className={inputCls}
              />
            </div>
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

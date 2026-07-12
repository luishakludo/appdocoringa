"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Send, MessageSquare, CheckCircle2 } from "lucide-react"
import { listTickets, answerTicket, type SupportTicket } from "@/lib/adm"

export function SupportInbox({ adminId }: { adminId: string }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "open" | "answered">("all")
  const [replies, setReplies] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)

  async function refresh() {
    const { data } = await listTickets(adminId)
    setTickets(data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId])

  const filtered = tickets.filter((t) => filter === "all" || t.status === filter)

  async function submit(e: React.FormEvent, t: SupportTicket) {
    e.preventDefault()
    const text = (replies[t.id] ?? "").trim()
    if (!text) return
    setSending(t.id)
    await answerTicket(t.id, text)
    setReplies((r) => ({ ...r, [t.id]: "" }))
    setSending(null)
    refresh()
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-2">
          Atendimento
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">Suporte</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Mensagens enviadas pelos seus usuários direto pelo app.
        </p>
      </header>

      <div className="flex items-center gap-2 mb-5">
        {(["all", "open", "answered"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-9 px-4 rounded-full text-xs font-medium transition-colors ${
              filter === f ? "bg-primary/15 text-foreground border border-primary/30" : "clay-input text-muted-foreground"
            }`}
          >
            {f === "all" ? "Todas" : f === "open" ? "Abertas" : "Respondidas"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading && <div className="skeuo-card rounded-2xl p-4 text-sm text-muted-foreground">Carregando…</div>}
        {!loading && filtered.length === 0 && (
          <div className="skeuo-card rounded-2xl p-8 text-center">
            <MessageSquare className="size-6 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma mensagem por aqui.</p>
          </div>
        )}
        {filtered.map((t) => (
          <div key={t.id} className="skeuo-card rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.user_name || "Anônimo"}</p>
                {t.user_email && <p className="text-xs text-muted-foreground truncate">{t.user_email}</p>}
              </div>
              <span
                className={`shrink-0 px-2 h-6 inline-flex items-center gap-1 rounded-full text-[0.55rem] font-mono uppercase tracking-wider ${
                  t.status === "open" ? "bg-primary/15 text-primary" : "bg-emerald-500/15 text-emerald-400"
                }`}
              >
                {t.status === "open" ? "Aberta" : "Respondida"}
              </span>
            </div>

            <p className="text-sm text-foreground/90 leading-relaxed bg-black/20 rounded-xl p-3">{t.message}</p>

            {t.response && (
              <div className="mt-3 flex gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">{t.response}</p>
              </div>
            )}

            {t.status === "open" && (
              <form onSubmit={(e) => submit(e, t)} className="mt-3 flex items-end gap-2">
                <textarea
                  value={replies[t.id] ?? ""}
                  onChange={(e) => setReplies((r) => ({ ...r, [t.id]: e.target.value }))}
                  placeholder="Escreva sua resposta…"
                  rows={2}
                  className="flex-1 clay-input rounded-xl px-3 py-2.5 bg-transparent outline-none text-sm resize-none placeholder:text-muted-foreground/50"
                />
                <button
                  type="submit"
                  disabled={sending === t.id || !(replies[t.id] ?? "").trim()}
                  className="button-primary h-11 w-11 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40"
                  aria-label="Enviar resposta"
                >
                  <Send className="size-4" />
                </button>
              </form>
            )}

            <p className="text-[0.6rem] text-muted-foreground/50 mt-3 font-mono">
              {new Date(t.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

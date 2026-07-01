"use client"

import { useEffect, useState } from "react"
import { Send, ChevronDown, ExternalLink, CheckCircle2, Clock, MessageSquare } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"
import { HiOutlineMail } from "react-icons/hi"
import { createTicket, getAdmin, listUserTickets, type SupportTicket } from "@/lib/adm"
import { getUserSession } from "@/lib/user-session"

const faqs = [
  {
    q: "Como funciona a IA?",
    a: "Nossa IA analisa o mercado em tempo real e envia alertas quando identifica oportunidades de alta probabilidade.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim, cancele sua assinatura quando quiser sem burocracia. Basta acessar as configuracoes da conta.",
  },
  {
    q: "Qual o horario de funcionamento?",
    a: "O sistema funciona durante todo o pregao da B3, das 9h as 18h. O suporte esta disponivel 24/7.",
  },
]

// Garante que um link de WhatsApp fique no formato https://wa.me/...
function normalizeWhatsapp(value: string) {
  const v = value.trim()
  if (!v) return ""
  if (v.startsWith("http://") || v.startsWith("https://")) return v
  const digits = v.replace(/\D/g, "")
  return digits ? `https://wa.me/${digits}` : ""
}

export function SupportContent() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const [whatsapp, setWhatsapp] = useState("")
  const [email, setEmail] = useState("")
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)

  const session = getUserSession()

  // Carrega os canais configurados pelo adm dono do usuario.
  useEffect(() => {
    if (!session?.admin_id) return
    getAdmin(session.admin_id).then(({ data }) => {
      if (data) {
        setWhatsapp(data.whatsapp_link ?? "")
        setEmail(data.support_email ?? "")
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.admin_id])

  // Carrega as duvidas que o usuario ja enviou.
  async function refreshTickets() {
    if (!session?.email) {
      setLoadingTickets(false)
      return
    }
    const { data } = await listUserTickets(session.email)
    setTickets(data)
    setLoadingTickets(false)
  }

  useEffect(() => {
    refreshTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.email])

  async function handleSend() {
    const text = message.trim()
    if (!text) return
    setSending(true)

    if (session?.admin_id) {
      await createTicket({
        admin_id: session.admin_id,
        user_name: session.name ?? "",
        user_email: session.email ?? "",
        message: text,
      })
    }

    setMessage("")
    setSending(false)
    setSent(true)
    setTimeout(() => setSent(false), 4000)
    refreshTickets()
  }

  const whatsappHref = normalizeWhatsapp(whatsapp)
  const hasChannels = Boolean(whatsappHref || email)

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <section className="text-center">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-3">
          Central de Ajuda
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">Como podemos ajudar?</h1>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-xs mx-auto">
          Estamos disponiveis 24/7 para tirar suas duvidas.
        </p>
      </section>

      {/* Status */}
      <section className="mt-10 flex items-center justify-center gap-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-xs text-muted-foreground">
          Suporte online — Tempo medio: <span className="text-foreground">2 min</span>
        </span>
      </section>

      {/* Conteudo em duas colunas no desktop */}
      <div className="mt-8 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
      <div className="space-y-8">
      {/* Quick Actions */}
      {hasChannels && (
        <section className="grid grid-cols-2 gap-3">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-2xl px-3.5 py-3 bg-[#25D366]/10 shadow-[inset_0_2px_3px_rgba(255,255,255,0.12),inset_0_-3px_4px_rgba(0,0,0,0.35),0_4px_10px_-4px_rgba(0,0,0,0.5)] ring-1 ring-[#25D366]/20 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/20 text-[#4ade80] shadow-[inset_0_2px_2px_rgba(255,255,255,0.2),inset_0_-2px_3px_rgba(0,0,0,0.3)]">
                <FaWhatsapp className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-none text-foreground">WhatsApp</span>
                <span className="mt-1 block text-[0.62rem] leading-none text-muted-foreground">Resposta imediata</span>
              </span>
              <ExternalLink className="size-3.5 shrink-0 text-[#4ade80]/60 transition-colors group-hover:text-[#4ade80]" />
            </a>
          )}

          {email && (
            <a
              href={`mailto:${email}`}
              className="group flex items-center gap-3 rounded-2xl px-3.5 py-3 bg-primary/10 shadow-[inset_0_2px_3px_rgba(255,255,255,0.1),inset_0_-3px_4px_rgba(0,0,0,0.35),0_4px_10px_-4px_rgba(0,0,0,0.5)] ring-1 ring-primary/20 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary shadow-[inset_0_2px_2px_rgba(255,255,255,0.2),inset_0_-2px_3px_rgba(0,0,0,0.3)]">
                <HiOutlineMail className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-none text-foreground">Email</span>
                <span className="mt-1 block truncate text-[0.62rem] leading-none text-muted-foreground">{email}</span>
              </span>
              <ExternalLink className="size-3.5 shrink-0 text-primary/60 transition-colors group-hover:text-primary" />
            </a>
          )}
        </section>
      )}

      {/* Message Form */}
      <section>
        <div className="clay-card p-5 rounded-2xl">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground mb-3">
            Enviar mensagem
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Descreva sua duvida..."
            rows={3}
            className="w-full bg-transparent text-sm placeholder:text-muted-foreground/40 resize-none focus:outline-none"
          />
          <div className="flex items-center justify-between mt-3">
            {sent ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mensagem enviada ao suporte
              </span>
            ) : (
              <span />
            )}
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="h-10 px-5 rounded-xl button-primary flex items-center gap-2 text-sm font-medium text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? "Enviando…" : "Enviar"}
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      </div>

      <div className="mt-8 space-y-8 lg:mt-0">
      {/* Minhas duvidas */}
      <section>
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground mb-4 px-1">
          Minhas duvidas
        </p>

        {loadingTickets ? (
          <div className="clay-card rounded-2xl p-4 text-sm text-muted-foreground">Carregando…</div>
        ) : tickets.length === 0 ? (
          <div className="clay-card rounded-2xl p-8 text-center">
            <MessageSquare className="size-6 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Voce ainda nao enviou nenhuma duvida.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="clay-card rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span
                    className={`px-2 h-6 inline-flex items-center gap-1.5 rounded-full text-[0.55rem] font-mono uppercase tracking-wider ${
                      t.status === "answered"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {t.status === "answered" ? (
                      <>
                        <CheckCircle2 className="size-3" />
                        Duvida respondida
                      </>
                    ) : (
                      <>
                        <Clock className="size-3" />
                        Aguardando resposta
                      </>
                    )}
                  </span>
                  <span className="text-[0.6rem] text-muted-foreground/50 font-mono">
                    {new Date(t.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>

                <p className="text-sm text-foreground/90 leading-relaxed">{t.message}</p>

                {t.status === "answered" && t.response && (
                  <div className="mt-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3">
                    <p className="text-[0.55rem] font-mono uppercase tracking-wider text-emerald-400/80 mb-1">
                      Resposta do suporte
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t.response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FAQs */}
      <section>
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground mb-4 px-1">
          Perguntas frequentes
        </p>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="clay-card rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-medium pr-4">{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                    openFaq === i ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openFaq === i ? "max-h-32" : "max-h-0"
                }`}
              >
                <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      </div>
      </div>

      {/* Footer note */}
      <p className="mt-10 text-center text-[0.65rem] text-muted-foreground/60">coringa · suporte · v0.1</p>
    </div>
  )
}

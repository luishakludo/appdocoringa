"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  Plus,
  Eye,
  EyeOff,
  Ban,
  CheckCircle2,
  Trash2,
  X,
  KeyRound,
  FolderOpen,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
} from "lucide-react"
import {
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  type Admin,
} from "@/lib/adm"
import { UsersManager } from "@/components/adm/users-manager"

export function AdminsManager() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [showCreate, setShowCreate] = useState(false)
  const [pwTarget, setPwTarget] = useState<Admin | null>(null)
  const [viewingBase, setViewingBase] = useState<Admin | null>(null)

  async function refresh() {
    const { data } = await listAdmins()
    setAdmins(data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function toggleBan(a: Admin) {
    await updateAdmin(a.id, { status: a.status === "active" ? "banned" : "active" })
    refresh()
  }

  async function remove(a: Admin) {
    if (!confirm(`Excluir o admin ${a.name} e toda a base dele? Isso não pode ser desfeito.`)) return
    await deleteAdmin(a.id)
    refresh()
  }

  if (viewingBase) {
    return (
      <div className="animate-fade-up">
        <button
          onClick={() => setViewingBase(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5"
        >
          <ArrowLeft className="size-4" />
          Voltar para admins
        </button>
        <div className="skeuo-card rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
          <FolderOpen className="size-4 text-primary" />
          <p className="text-sm">
            Base de <span className="font-medium">{viewingBase.name}</span>
          </p>
        </div>
        <UsersManager adminId={viewingBase.id} readOnly />
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-primary mb-2">
            Controle supremo
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight">Administradores</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Crie e gerencie os admins. Cada um tem a própria base de usuários.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="button-primary h-11 px-4 rounded-xl flex items-center gap-2 text-sm font-medium shrink-0"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Novo</span>
        </button>
      </header>

      <div className="space-y-2">
        {loading && <div className="skeuo-card rounded-2xl p-4 text-sm text-muted-foreground">Carregando…</div>}
        {admins.map((a) => (
          <div key={a.id} className="skeuo-card rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  {a.role === "supreme" ? (
                    <span className="px-2 h-5 inline-flex items-center gap-1 rounded-full text-[0.55rem] font-mono uppercase tracking-wider bg-primary/15 text-primary">
                      <ShieldCheck className="size-3" />
                      Supremo
                    </span>
                  ) : (
                    <span
                      className={`px-2 h-5 inline-flex items-center rounded-full text-[0.55rem] font-mono uppercase tracking-wider ${
                        a.status === "active"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {a.status === "active" ? "Ativo" : "Banido"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{a.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[0.65rem] font-mono text-muted-foreground">Senha:</span>
                  <code className="text-[0.7rem] font-mono text-foreground/90">
                    {revealed[a.id] ? a.password : "••••••••"}
                  </code>
                  <button
                    onClick={() => setRevealed((r) => ({ ...r, [a.id]: !r[a.id] }))}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={revealed[a.id] ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {revealed[a.id] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <p className="text-[0.65rem] font-mono text-muted-foreground/70 mt-1.5">
                  Código: {a.referral_code}
                </p>
              </div>
            </div>

            {a.role !== "supreme" && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
                <button
                  onClick={() => setViewingBase(a)}
                  className="flex-1 min-w-[5rem] h-9 rounded-lg clay-input flex items-center justify-center gap-1.5 text-xs"
                >
                  <FolderOpen className="size-3.5" />
                  Base
                </button>
                <button
                  onClick={() => setPwTarget(a)}
                  className="flex-1 min-w-[5rem] h-9 rounded-lg clay-input flex items-center justify-center gap-1.5 text-xs"
                >
                  <KeyRound className="size-3.5" />
                  Senha
                </button>
                <button
                  onClick={() => toggleBan(a)}
                  className="flex-1 min-w-[5rem] h-9 rounded-lg clay-input flex items-center justify-center gap-1.5 text-xs"
                >
                  {a.status === "active" ? (
                    <>
                      <Ban className="size-3.5" />
                      Banir
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      Reativar
                    </>
                  )}
                </button>
                <button
                  onClick={() => remove(a)}
                  className="h-9 w-9 rounded-lg clay-input flex items-center justify-center text-primary"
                  aria-label="Excluir admin"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showCreate && (
        <CreateAdminModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            refresh()
          }}
        />
      )}

      {pwTarget && (
        <ChangeAdminPasswordModal
          admin={pwTarget}
          onClose={() => setPwTarget(null)}
          onSaved={() => {
            setPwTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm skeuo-card-deep rounded-2xl p-5 animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="size-8 rounded-lg clay-input flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

const inputCls =
  "w-full clay-input rounded-lg h-11 px-3 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/50"

function CreateAdminModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await createAdmin({ name, email, password })
    if (error) {
      setError("Erro ao criar. O e-mail pode ja estar em uso.")
      setSaving(false)
      return
    }
    onCreated()
  }

  return (
    <ModalShell title="Novo admin" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-[0.6rem] font-mono uppercase tracking-wider text-muted-foreground mb-1 block">
            Nome
          </label>
          <input 
            className={inputCls} 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Nome do admin"
            required 
          />
        </div>
        <div>
          <label className="text-[0.6rem] font-mono uppercase tracking-wider text-muted-foreground mb-1 block">
            E-mail
          </label>
          <input 
            className={inputCls} 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="admin@email.com"
            required 
          />
        </div>
        <div>
          <label className="text-[0.6rem] font-mono uppercase tracking-wider text-muted-foreground mb-1 block">
            Senha
          </label>
          <input 
            className={inputCls} 
            type="text"
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            placeholder="Senha do admin"
            required 
          />
        </div>
        {error && <p className="text-xs text-primary">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="button-primary w-full h-11 rounded-lg font-semibold text-sm mt-1 disabled:opacity-70"
        >
          {saving ? "Criando..." : "Criar admin"}
        </button>
      </form>
    </ModalShell>
  )
}

function ChangeAdminPasswordModal({
  admin,
  onClose,
  onSaved,
}: {
  admin: Admin
  onClose: () => void
  onSaved: () => void
}) {
  const [password, setPassword] = useState(admin.password)
  const [saving, setSaving] = useState(false)

  function generatePassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setPassword(result)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await updateAdmin(admin.id, { password })
    onSaved()
  }

  return (
    <ModalShell title="Alterar senha" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted-foreground -mt-1">
          Admin: <span className="text-foreground">{admin.name}</span>
        </p>
        <div>
          <label className="text-[0.6rem] font-mono uppercase tracking-wider text-muted-foreground mb-1 block">
            Nova senha
          </label>
          <div className="flex gap-2">
            <input className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button
              type="button"
              onClick={generatePassword}
              className="h-11 px-3 rounded-lg clay-input flex items-center justify-center text-muted-foreground hover:text-foreground"
              title="Gerar senha aleatoria"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="button-primary w-full h-11 rounded-lg font-semibold text-sm mt-1 disabled:opacity-70"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </ModalShell>
  )
}

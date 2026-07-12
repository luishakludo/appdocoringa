"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { clearUserSession } from "@/lib/user-session"

export function DashboardClient() {
  const router = useRouter()

  function handleSignOut() {
    clearUserSession()
    router.push("/")
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="group relative h-9 px-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-all duration-300"
      aria-label="Sair da conta"
    >
      <span className="absolute inset-0 rounded-full border border-border/50 group-hover:border-primary/30 group-hover:bg-primary/5 transition-all duration-300" />
      <LogOut className="relative size-3.5 group-hover:text-primary transition-colors duration-300" />
      <span className="relative font-mono text-[0.65rem] uppercase tracking-[0.2em] group-hover:text-foreground transition-colors duration-300">Sair</span>
    </button>
  )
}

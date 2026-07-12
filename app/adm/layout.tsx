import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "CORINGA · Painel ADM",
  description: "Painel administrativo do CORINGA.",
}

export default function AdmLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>
}

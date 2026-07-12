"use client"

import { useEffect } from "react"

// A criacao de conta agora acontece diretamente na Atlax.
// Esta rota apenas redireciona para o site oficial.
const ATLAX_SIGNUP_URL = "https://atlaxoption.com"

export default function CadastroPage() {
  useEffect(() => {
    window.location.replace(ATLAX_SIGNUP_URL)
  }, [])

  return (
    <main className="relative min-h-svh flex items-center justify-center bg-background px-6">
      <div className="text-center animate-fade-up">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.4em] text-muted-foreground mb-3">
          Redirecionando
        </p>
        <h2 className="font-display text-2xl font-bold tracking-tight text-balance">
          Levando você para a Atlax...
        </h2>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          Se nada acontecer,{" "}
          <a href={ATLAX_SIGNUP_URL} className="text-primary underline">
            clique aqui
          </a>
          .
        </p>
      </div>
    </main>
  )
}

"use client"

import { useCallback, useEffect, useRef } from "react"

// Som de "win" gerado 100% via Web Audio API — nao precisa de nenhum arquivo de
// audio. Toca um arpejo curto e limpo (tipo "ping" de sucesso) sempre que a IA
// fecha um green. Leve, sem dependencias e funciona offline.
export function useWinSound(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)

  // O navegador so permite audio depois de um gesto do usuario. Destravamos o
  // AudioContext no primeiro clique/toque e mantemos a referencia pronta.
  useEffect(() => {
    if (typeof window === "undefined") return
    const unlock = () => {
      if (!ctxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (Ctx) ctxRef.current = new Ctx()
      }
      if (ctxRef.current?.state === "suspended") void ctxRef.current.resume()
    }
    window.addEventListener("pointerdown", unlock)
    window.addEventListener("keydown", unlock)
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])

  return useCallback(() => {
    if (!enabled) return
    const ctx = ctxRef.current
    if (!ctx) return
    if (ctx.state === "suspended") void ctx.resume()

    const now = ctx.currentTime
    // Arpejo simples: C6 -> E6 -> G6. Notas curtas e brilhantes.
    const notes = [1046.5, 1318.5, 1568.0]
    const master = ctx.createGain()
    master.gain.value = 0.18
    master.connect(ctx.destination)

    notes.forEach((freq, i) => {
      const t = now + i * 0.09
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, t)
      // Envelope rapido: ataque instantaneo e decaimento suave.
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(1, t + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
      osc.connect(gain)
      gain.connect(master)
      osc.start(t)
      osc.stop(t + 0.24)
    })
  }, [enabled])
}

import { CandlestickChart } from "lucide-react"

export function AiOrb() {
  return (
    <div className="relative flex items-center justify-center size-40">
      {/* Soft ambient glow */}
      <div
        className="absolute size-40 rounded-full blur-2xl animate-pulse-glow"
        style={{
          background: "radial-gradient(circle, rgba(217,4,41,0.28) 0%, transparent 70%)",
        }}
      />

      {/* Expanding scanner rings */}
      <span className="absolute size-28 rounded-full border border-primary/30 animate-ping-slow" />
      <span className="absolute size-36 rounded-full border border-primary/15" />
      <span className="absolute size-24 rounded-full border border-border/60" />

      {/* Central core */}
      <div className="clay-card relative flex size-20 items-center justify-center rounded-full">
        <CandlestickChart className="size-9 text-primary" strokeWidth={2} />
      </div>

      {/* Orbiting accent dot */}
      <div className="absolute size-36 animate-spin-slow">
        <span className="absolute left-1/2 top-0 size-2.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_12px_rgba(217,4,41,0.9)]" />
      </div>
    </div>
  )
}

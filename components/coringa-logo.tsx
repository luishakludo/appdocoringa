import { cn } from "@/lib/utils"

export function CoringaLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-4 select-none", className)}>
      <div className="relative">
        {/* Liquid glass orb mark */}
        <div
          className="size-10 rounded-full relative overflow-hidden"
          style={{
            background: "radial-gradient(circle at 30% 25%, rgba(255,80,100,0.9) 0%, rgba(217,4,41,0.95) 50%, rgba(140,0,20,1) 100%)",
            boxShadow:
              "inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -4px 8px rgba(0,0,0,0.3), 0 4px 20px rgba(217,4,41,0.4), 0 0 40px rgba(217,4,41,0.2)",
          }}
        >
          {/* Highlight */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5) 0%, transparent 35%)",
            }}
          />
          {/* Depth */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 65% 75%, rgba(0,0,0,0.3) 0%, transparent 50%)",
            }}
          />
        </div>
        {/* Glow ring */}
        <div 
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            boxShadow: "0 0 20px rgba(217,4,41,0.3)",
          }}
        />
      </div>
      <div className="flex flex-col">
        <span
          className="font-display text-lg font-bold tracking-[0.35em] uppercase"
          style={{
            background: "linear-gradient(180deg, #ffffff 20%, rgba(255,255,255,0.75) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Coringa
        </span>
        <span className="font-mono text-[0.5rem] uppercase tracking-[0.4em] text-muted-foreground -mt-0.5">
          Day Trade AI
        </span>
      </div>
    </div>
  )
}

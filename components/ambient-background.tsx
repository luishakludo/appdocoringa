import PrismaticBurst from "@/components/prismatic-burst"

export function AmbientBackground() {
  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden bg-background pointer-events-none">
      {/* Prismatic burst (red) */}
      <div className="absolute inset-0">
        <PrismaticBurst
          animationType="rotate3d"
          intensity={2}
          speed={0.5}
          distort={1.0}
          paused={false}
          offset={{ x: 0, y: 0 }}
          hoverDampness={0.25}
          rayCount={24}
          mixBlendMode="lighten"
          colors={["#ff002c", "#8b0000", "#d90429"]}
        />
      </div>

      {/* Subtle grid */}
      <div className="absolute inset-0 grid-overlay opacity-60" />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(217,4,41,0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 50% 100%, rgba(139,0,0,0.08) 0%, transparent 60%)",
        }}
      />

      {/* Floating orbs (liquid glass ambient) */}
      <div
        className="ambient-orb animate-float"
        style={{
          width: 480,
          height: 480,
          top: "-120px",
          left: "-120px",
          background: "radial-gradient(circle, rgba(217,4,41,0.35) 0%, transparent 70%)",
        }}
      />
      <div
        className="ambient-orb animate-float-slow"
        style={{
          width: 520,
          height: 520,
          bottom: "-160px",
          right: "-160px",
          background: "radial-gradient(circle, rgba(139,0,0,0.3) 0%, transparent 70%)",
        }}
      />
      <div
        className="ambient-orb animate-float"
        style={{
          width: 320,
          height: 320,
          top: "40%",
          left: "60%",
          background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
          animationDelay: "-7s",
        }}
      />

      {/* Top fade */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent" />
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent" />
    </div>
  )
}

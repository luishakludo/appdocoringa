import { AdmLoginForm } from "@/components/adm/adm-login-form"

export default function AdmLoginPage() {
  return (
    <main className="relative min-h-dvh flex items-center justify-center px-4 py-10 overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 grid-overlay opacity-60" aria-hidden />
      <div
        className="ambient-orb animate-float"
        aria-hidden
        style={{ width: 360, height: 360, top: "-10%", left: "-10%", background: "rgba(217,4,41,0.35)" }}
      />
      <div
        className="ambient-orb animate-float-slow"
        aria-hidden
        style={{ width: 300, height: 300, bottom: "-10%", right: "-5%", background: "rgba(139,0,0,0.3)" }}
      />

      <div className="relative z-10 w-full">
        <AdmLoginForm />
      </div>
    </main>
  )
}

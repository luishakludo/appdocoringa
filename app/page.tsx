import { LoginForm } from "@/components/login-form"
import { BeamsBackground } from "@/components/beams-background"

export default function LoginPage() {
  return (
    <main className="relative min-h-svh flex flex-col bg-black">
      <BeamsBackground />

      <section className="relative z-10 flex-1 flex items-center justify-center px-6 py-8 sm:py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center animate-fade-up">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.4em] text-muted-foreground mb-3">
              Bem-vindo de volta, trader
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-balance">
              Operar. Lucrar.
              <br />
              <span
                style={{
                  background: "linear-gradient(180deg, #ff2647 0%, #8b0000 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Dominar.
              </span>
            </h2>
          </div>

          <LoginForm />
        </div>
      </section>


    </main>
  )
}

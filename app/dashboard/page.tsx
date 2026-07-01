"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChartLineUp, Headset, Medal, UserCircle } from "@phosphor-icons/react"

import SideRays from "@/components/side-rays"
import { TradingContent } from "@/components/trading-content"
import { VipContent } from "@/components/vip-content"
import { SupportContent } from "@/components/support-content"
import { ProfileContent } from "@/components/profile-content"
import { getAtlaxSession } from "@/lib/atlax-session"
import { getDemoSession } from "@/lib/demo-session"

type TabId = "home" | "vip" | "suporte" | "perfil"

const navItems: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: "home", icon: <ChartLineUp size={20} weight="fill" />, label: "Operar" },
  { id: "suporte", icon: <Headset size={20} weight="fill" />, label: "Suporte" },
  { id: "vip", icon: <Medal size={20} weight="fill" />, label: "VIP" },
  { id: "perfil", icon: <UserCircle size={20} weight="fill" />, label: "Perfil" },
]

export default function DashboardPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("home")

  useEffect(() => {
    if (getAtlaxSession() || getDemoSession()) {
      setReady(true)
    } else {
      router.replace("/")
    }
  }, [router])

  if (!ready) {
    return (
      <main className="relative min-h-svh overflow-hidden bg-background" />
    )
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 z-0">
        <SideRays
          speed={2.5}
          rayColor1="#EF4444"
          rayColor2="#F43F5E"
          intensity={2}
          spread={2}
          origin="top-right"
          saturation={1.5}
          blend={0.75}
          falloff={1.6}
          opacity={1}
        />
      </div>
      <div
        className={`relative z-10 mx-auto w-full px-5 pt-10 pb-32 sm:pt-14 ${
          activeTab === "home"
            ? "max-w-md lg:max-w-5xl"
            : activeTab === "vip"
              ? "max-w-md lg:max-w-5xl"
              : activeTab === "suporte"
                ? "max-w-md lg:max-w-4xl"
                : "max-w-md lg:max-w-2xl"
        }`}
      >
        {/* Tab Content */}
        <div>
          {activeTab === "home" && <TradingContent onGoVip={() => setActiveTab("vip")} />}
          {activeTab === "vip" && <VipContent />}
          {activeTab === "suporte" && <SupportContent />}
          {activeTab === "perfil" && <ProfileContent />}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-50 px-5 pb-5 pt-3 animate-fade-up"
        style={{ 
          animationDelay: "520ms",
          background: "linear-gradient(to top, var(--background) 60%, transparent)"
        }}
      >
        <nav className="mx-auto max-w-xs">
          <div className="nav-dock flex items-center justify-center gap-1.5 p-1.5 rounded-[1.4rem] backdrop-blur-xl">
            {navItems.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`nav-pill flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-[1.05rem] ${
                    isActive ? "nav-pill-active" : ""
                  }`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="text-[0.6rem] font-display font-semibold tracking-wide">
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </main>
  )
}



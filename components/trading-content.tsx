"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  CandlestickChart,
  Square,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  X,
  Check,
} from "lucide-react"
import { Lightning } from "@phosphor-icons/react"
import { Crown, Lock } from "lucide-react"
import { AiOrb } from "@/components/ai-orb"
import { getAtlaxSession, type AtlaxLocalTransaction } from "@/lib/atlax-session"
import { getUserVipByEmail, type VipStatus } from "@/lib/adm"
import { formatSymbol } from "@/lib/utils"
import { getDemoSession, updateDemoSession, getDemoHistory, pushDemoHistory, type DemoSession } from "@/lib/demo-session"
import {
  createDemoRun,
  getDemoRun,
  saveDemoRun,
  tickDemoRun,
  stopDemoRun,
  runToView,
} from "@/lib/demo-engine"

// Operacao como vem do servidor (Supabase)
type ServerOp = {
  transaction_id: number | null
  symbol: string
  direction: number
  expiration: number
  amount: number | string
  status: string
  result: string
  profit: number | string
  created_at: string
}

// Estado da sessao da IA, retornado por /api/atlax/ai/status
type SessionState = {
  id: string
  status: "running" | "finished"
  finishReason: "win" | "loss" | "manual" | "error" | null
  phase: "placing" | "running" | "between" | "settling" | "finished"
  config: {
    amount: number
    expiration: number
    stopWin: number
    stopLoss: number
    stopWinPct: number
    stopLossPct: number
    reentries: number
    stopRequested?: boolean
  }
  sessionPnl: number
  startBalance: number
  currentSymbol: string | null
  currentDirection: number | null
  currentAmount: number
  tradeEndsAt: string | null
  reentryCount: number
  lastError: string | null
}

function mapOp(o: ServerOp): AtlaxLocalTransaction {
  return {
    transactionId: o.transaction_id ?? null,
    symbol: o.symbol,
    direction: o.direction,
    expiration: o.expiration,
    amount: Number(o.amount),
    status: o.status,
    createdAt: o.created_at,
    result: (o.result as AtlaxLocalTransaction["result"]) ?? "pending",
    profit: Number(o.profit),
  }
}

type Symbol = { symbol: string; name?: string }

type Balance = {
  credit: string
  freebet: string
  bonus: string
}

type HomeTab = "operar" | "historico"
type AutoStatus = "placing" | "running" | "between"

const EXPIRATIONS = [1, 5, 15, 30]
const QUICK_AMOUNTS = [5, 10, 25, 50, 100, 250]

// Converte "5.013,90" (formato BRL) para numero 5013.9
function brlToNumber(value: string | undefined | null): number {
  if (!value) return 0
  const normalized = value.replace(/\./g, "").replace(",", ".")
  return Number.parseFloat(normalized) || 0
}

function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function TradingContent({ onGoVip }: { onGoVip?: () => void }) {
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [userName, setUserName] = useState<string>("")
  const [userLogin, setUserLogin] = useState<string>("")

  // ===== Controle de acesso VIP =====
  // Conta DEMO opera livremente. Conta real SO pode iniciar a IA se tiver VIP
  // ativo (plano pago ou liberado pelo adm). Enquanto carrega, tratamos como
  // "desconhecido" e nao bloqueamos por engano.
  const [vip, setVip] = useState<VipStatus | null>(null)
  const [vipChecked, setVipChecked] = useState(false)
  const [vipGateOpen, setVipGateOpen] = useState(false)

  // ===== Modo DEMO =====
  // Quando ha uma conta demo logada, toda a operacao roda 100% no cliente
  // (motor local em lib/demo-engine) e nao toca na Atlax nem no servidor.
  const [demo, setDemo] = useState<DemoSession | null>(null)
  const demoRef = useRef<DemoSession | null>(null)
  useEffect(() => {
    demoRef.current = demo
  }, [demo])

  const [balance, setBalance] = useState<Balance | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(true)

  const [tab, setTab] = useState<HomeTab>("operar")
  const [history, setHistory] = useState<AtlaxLocalTransaction[]>([])

  // ===== Configuracao da IA =====
  const [setupOpen, setSetupOpen] = useState(false)
  const [amount, setAmount] = useState("5")
  const [expiration, setExpiration] = useState(1)
  const [stopWin, setStopWin] = useState("10")
  const [stopLoss, setStopLoss] = useState("10")
  const [reentries, setReentries] = useState("0")

  // ===== Sessao da IA (vive no servidor; aqui apenas exibimos/controlamos) =====
  const [session, setSession] = useState<SessionState | null>(null)
  const [sessionOps, setSessionOps] = useState<AtlaxLocalTransaction[]>([])
  // Sessao finalizada cujo card de resumo o usuario ja dispensou. Persistido no
  // localStorage para que o card "IA ENCERRADA" nao reapareca a cada reload.
  const [dismissedSessionId, setDismissedSessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem("atlax:dismissedSessionId")
  })
  // Relogio local para a contagem regressiva (recalculada a partir do servidor).
  const [nowTs, setNowTs] = useState(() => Date.now())

  // Confirmacao de encerramento imediato (popup) quando ha operacao em andamento.
  const [confirmStopOpen, setConfirmStopOpen] = useState(false)


  // IDs de sessoes que vimos rodando DURANTE esta visita (transicao ao vivo).
  // O card "IA ENCERRADA" so deve aparecer quando o usuario acompanhou a IA
  // encerrar — nunca para uma sessao antiga ja finalizada que o servidor
  // devolve logo apos o login. Isso evita que o resumo reapareca a cada acesso.
  const seenRunningRef = useRef<Set<string>>(new Set())
  const [, forceRerender] = useState(0)

  // Carregar sessao de autenticacao. Conta DEMO tem prioridade: se existir, o
  // app opera no modo simulado e nunca chama a Atlax.
  useEffect(() => {
    const d = getDemoSession()
    if (d) {
      setDemo(d)
      setUserName(d.name || d.login)
      setBalance({ credit: d.balance.toFixed(2).replace(".", ","), freebet: "0,00", bonus: "0,00" })
      setBalanceLoading(false)
      return
    }
    const s = getAtlaxSession()
    if (s) {
      setToken(s.token)
      setUserId(s.user.id)
      setUserName(s.user.name || s.user.login)
      setUserLogin(s.user.login)
    }
  }, [])

  // Carrega o status de VIP da conta real. Se as colunas de VIP nao existirem
  // (ok:false) ou nao encontrar o usuario, mantemos vip=null e liberamos a IA
  // para nao travar o usuario por um problema de infra.
  const loadVip = useCallback(async () => {
    if (!userLogin) return
    const { ok, status } = await getUserVipByEmail(userLogin)
    if (ok) setVip(status)
    else setVip(null)
    setVipChecked(true)
  }, [userLogin])

  useEffect(() => {
    if (!userLogin) return
    loadVip()
    // Revalida periodicamente (ex.: acabou de pagar e o VIP foi liberado).
    const id = setInterval(loadVip, 15000)
    return () => clearInterval(id)
  }, [userLogin, loadVip])

  // Saldo (mostrado no cabecalho e usado no calculo do stop). Recarrega quando
  // nao ha IA em execucao (o cabecalho so aparece nesse momento).
  const loadBalance = useCallback(async () => {
    // No modo demo o saldo e mantido pelo loop de simulacao.
    if (demoRef.current) return
    if (!token) return
    try {
      const r = await fetch("/api/atlax/balance", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      const data = await r.json()
      if (data.credit !== undefined) {
        setBalance({ credit: data.credit, freebet: data.freebet, bonus: data.bonus })
      }
    } catch {
      // ignora
    } finally {
      setBalanceLoading(false)
    }
  }, [token])

  // Busca o estado atual da sessao no servidor. Enquanto a sessao estiver
  // rodando e uma operacao estiver vencida (ou nao houver operacao aberta),
  // pedimos ao servidor para avancar (tick) — isso deixa a UI responsiva
  // enquanto o app esta aberto. Com o app fechado, o cron cuida disso.
  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      const r = await fetch(`/api/atlax/ai/status?userId=${userId}`, { cache: "no-store" })
      const data = (await r.json()) as { session: SessionState | null; ops: ServerOp[] }
      setSession(data.session ?? null)
      setSessionOps((data.ops ?? []).map(mapOp))

      // Marca a sessao como "vista rodando" para liberar o card de resumo
      // somente quando ela encerrar ao vivo (e nao numa sessao antiga).
      if (data.session?.status === "running" && !seenRunningRef.current.has(data.session.id)) {
        seenRunningRef.current.add(data.session.id)
        forceRerender((n) => n + 1)
      }

      if (data.session?.status === "running") {
        const ends = data.session.tradeEndsAt ? new Date(data.session.tradeEndsAt).getTime() : 0
        const due = !data.session.tradeEndsAt || Date.now() >= ends
        // Fora de uma operacao aberta (placing / between / settling) precisamos
        // cutucar o servidor CONTINUAMENTE. Assim, quando faltar <=48s para a
        // abertura da vela, o tick entra e dorme ate o segundo :00 exato,
        // cravando a entrada no inicio da vela (nunca no meio). Na fase
        // "settling" isso tambem acelera a confirmacao do resultado.
        const notInTrade = data.session.phase !== "running"
        if (due || notInTrade) {
          fetch("/api/atlax/ai/tick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          }).catch(() => {})
        }
      }
    } catch {
      // ignora
    }
  }, [userId])

  // Historico completo (todas as sessoes) do banco de dados.
  const refreshHistory = useCallback(async () => {
    if (!userId) return
    try {
      const r = await fetch(`/api/atlax/ai/history?userId=${userId}`, { cache: "no-store" })
      const data = (await r.json()) as { ops: ServerOp[] }
      setHistory((data.ops ?? []).map(mapOp))
    } catch {
      // ignora
    }
  }, [userId])

  // Polling do estado da sessao + historico. 1,5s (antes 3s): como cada tick do
  // servidor agora e rapido (settlement + leitura, sem sleeps) e libera o lock
  // na hora, um intervalo curto faz a transicao para "settling" e a confirmacao
  // do green/loss acontecerem em poucos segundos, sem o tempo morto no 00:00.
  useEffect(() => {
    if (!userId) return
    refresh()
    refreshHistory()
    const id = setInterval(() => {
      refresh()
      refreshHistory()
    }, 1500)
    return () => clearInterval(id)
  }, [userId, refresh, refreshHistory])

  // Relogio para a contagem regressiva.
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  // ===== Loop de simulacao da conta DEMO =====
  // Avanca o motor local em intervalo curto, persiste o estado no localStorage e
  // espelha tudo no mesmo `session`/`sessionOps` consumidos pela UI da IA real.
  useEffect(() => {
    if (!demo) return
    const loop = () => {
      const run = getDemoRun()
      if (!run) {
        setSession(null)
        setSessionOps([])
        setHistory(getDemoHistory())
        return
      }
      const { run: next, settledOp } = tickDemoRun(run, Date.now(), demo.rtp)
      saveDemoRun(next)

      // Operacao liquidada: atualiza saldo persistido e historico local.
      if (settledOp) {
        pushDemoHistory(settledOp)
        updateDemoSession({ balance: next.balance })
        setBalance({ credit: next.balance.toFixed(2).replace(".", ","), freebet: "0,00", bonus: "0,00" })
      }

      if (next.status === "running" && !seenRunningRef.current.has(next.id)) {
        seenRunningRef.current.add(next.id)
        forceRerender((n) => n + 1)
      }

      setSession(runToView(next))
      setSessionOps(next.ops)
      setHistory(getDemoHistory())
    }
    loop()
    const id = setInterval(loop, 400)
    return () => clearInterval(id)
  }, [demo])

  // ===== Estado derivado da sessao do servidor =====
  const autoActive = !!session && session.status === "running"
  // So mostra o resumo "IA ENCERRADA" quando acompanhamos a sessao encerrar ao
  // vivo nesta visita. Uma sessao ja finalizada (devolvida pelo servidor logo
  // apos o login) nao reabre o card.
  const isFinished =
    !!session &&
    session.status === "finished" &&
    session.id !== dismissedSessionId &&
    seenRunningRef.current.has(session.id)
  const autoFinished: { reason: "win" | "loss" | "manual" | "error"; pnl: number } | null = isFinished
    ? { reason: (session!.finishReason ?? "manual") as "win" | "loss" | "manual" | "error", pnl: session!.sessionPnl }
    : null

  const autoStatus: AutoStatus =
    session?.phase === "running" ? "running" : session?.phase === "between" ? "between" : "placing"

  // Operacao em andamento (vela aberta ou aguardando liquidacao do resultado).
  const settling = session?.phase === "settling"
  const opInProgress = autoActive && (session?.phase === "running" || settling)

  const autoCurrent: (Symbol & { direction: 0 | 1 }) | null =
    autoActive && session?.currentSymbol
      ? { symbol: session.currentSymbol, direction: (session.currentDirection === 1 ? 1 : 0) as 0 | 1 }
      : null
  const autoAmount = session?.currentAmount ?? 0
  const reentryLevel = session?.reentryCount ?? 0
  const sessionPnl = session?.sessionPnl ?? 0
  const autoError = session?.lastError ?? null

  // Contagem de greens/losses da sessao atual (apenas operacoes liquidadas).
  const greenCount = sessionOps.filter((o) => o.result === "green").length
  const lossCount = sessionOps.filter((o) => o.result === "loss").length

  const cfg = {
    amount: session?.config?.amount ?? (Number.parseFloat(amount) || 5),
    expiration: session?.config?.expiration ?? expiration,
    stopWin: session?.config?.stopWin ?? 0,
    stopLoss: session?.config?.stopLoss ?? 0,
    stopWinPct: session?.config?.stopWinPct ?? 0,
    stopLossPct: session?.config?.stopLossPct ?? 0,
    reentries: session?.config?.reentries ?? 0,
  }
  // Mantem a forma { current } usada pelo JSX (antes era um useRef).
  const cfgRef = { current: cfg }

  const tradeEndsMs = session?.tradeEndsAt ? new Date(session.tradeEndsAt).getTime() : 0
  const totalCountdown = (cfg.expiration || 1) * 60
  const remaining =
    autoActive && autoStatus === "running" && tradeEndsMs ? Math.max(0, Math.round((tradeEndsMs - nowTs) / 1000)) : 0

  // Espera agendada (M5): a IA ja escolheu o ativo e aguarda a abertura da vela.
  const scheduledWait = autoActive && session?.phase === "placing" && tradeEndsMs > nowTs
  const entryRemaining = scheduledWait ? Math.max(0, Math.round((tradeEndsMs - nowTs) / 1000)) : 0

  // Estado de "analise": a IA esta escolhendo/trocando de ativo (fases placing
  // sem horario agendado ou between). Para o lead isso NUNCA aparece como erro
  // de "ativo indisponivel" — mostramos um efeito de "IA analisando o mercado".
  const analyzing = autoActive && !scheduledWait && !settling && autoStatus !== "running"

  // Atualiza o saldo em TEMPO REAL. Enquanto a IA opera, recarrega a cada 2s
  // para refletir o green/loss assim que a corretora liquida a operacao. Fora
  // de operacao, recarrega a cada 10s (cabecalho visivel).
  useEffect(() => {
    if (!token) return
    loadBalance()
    const id = setInterval(loadBalance, autoActive ? 2000 : 10000)
    return () => clearInterval(id)
  }, [token, autoActive, loadBalance])

  // Inicia a IA no servidor.
  async function startAi() {
    const amt = Number.parseFloat(amount) || 0
    const swPct = Number.parseFloat(stopWin) || 0
    const slPct = Number.parseFloat(stopLoss) || 0
    const re = Number.parseInt(reentries) || 0

    // ===== Modo DEMO: cria uma sessao simulada 100% local =====
    if (demoRef.current) {
      const d = getDemoSession()
      if (!d) return
      setSetupOpen(false)
      setSession(null)
      setSessionOps([])
      setDismissedSessionId(null)
      if (typeof window !== "undefined") window.localStorage.removeItem("atlax:dismissedSessionId")
      const run = createDemoRun({
        amount: amt,
        expiration,
        stopWinPct: swPct,
        stopLossPct: slPct,
        reentries: re,
        startBalance: d.balance,
      })
      saveDemoRun(run)
      seenRunningRef.current.add(run.id)
      setSession(runToView(run))
      setSessionOps(run.ops)
      return
    }

    if (!token || !userId) return

    setSetupOpen(false)
    // Limpa o estado da sessao ANTERIOR (ja finalizada) antes de iniciar uma
    // nova. Sem isso, o card de resumo/historico da sessao passada reaparece no
    // intervalo entre zerar o "dismissedSessionId" e o refresh trazer a nova
    // sessao do servidor.
    setSession(null)
    setSessionOps([])
    setDismissedSessionId(null)
    try {
      await fetch("/api/atlax/ai/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          atlaxUserId: userId,
          amount: amt,
          expiration,
          stopWinPct: swPct,
          stopLossPct: slPct,
          reentries: re,
        }),
      })
    } catch {
      // ignora
    }
    refresh()
  }

  // Para a IA no servidor (parada manual). Quando `force` e true, encerra na
  // hora mesmo com uma operacao aberta (que fica com status "aberto").
  async function finishAuto(_reason?: "win" | "loss" | "manual" | "error", force?: boolean) {
    // ===== Modo DEMO: encerra a sessao simulada localmente =====
    if (demoRef.current) {
      const run = getDemoRun()
      if (run) {
        const stopped = stopDemoRun(run)
        saveDemoRun(stopped)
        setSession(runToView(stopped))
        setSessionOps(stopped.ops)
      }
      return
    }
    if (!userId) return
    try {
      await fetch("/api/atlax/ai/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atlaxUserId: userId, force: !!force }),
      })
    } catch {
      // ignora
    }
    refresh()
  }

  // Dispensa o card de resumo da sessao finalizada.
  function resetSession() {
    if (session) {
      setDismissedSessionId(session.id)
      if (typeof window !== "undefined") {
        window.localStorage.setItem("atlax:dismissedSessionId", session.id)
      }
    }
  }

  // Conta demo opera livre. Conta real precisa de VIP ativo. So bloqueamos
  // depois de confirmar (vipChecked) que ela nao e VIP — evita falso bloqueio.
  const isDemo = !!demo
  const vipBlocked = !isDemo && vipChecked && !vip?.isVip

  // Chamado ao tentar iniciar a IA: se a conta real nao for VIP, abre o pop-up
  // de bloqueio (com atalho para os planos VIP) em vez de abrir a configuracao.
  function requestStart() {
    if (vipBlocked) {
      setVipGateOpen(true)
      return
    }
    setSetupOpen(true)
  }

  const amountNum = Number.parseFloat(amount) || 0
  const canStart = amountNum >= 5 && (Number.parseFloat(stopWin) || 0) > 0 && (Number.parseFloat(stopLoss) || 0) > 0

  const progress = totalCountdown > 0 ? (totalCountdown - remaining) / totalCountdown : 0
  const RADIUS = 80
  const CIRC = 2 * Math.PI * RADIUS

  const showHeader = !autoActive && !autoFinished

  // Lista de historico reutilizada no mobile (aba) e no desktop (coluna lateral).
  const historyList =
    history.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <History className="size-8 mb-3 opacity-40" />
        <p className="text-sm">Nenhuma operação ainda.</p>
        <p className="text-xs mt-1">Suas operações aparecerão aqui.</p>
      </div>
    ) : (
      <div className="space-y-2">
        {history.map((tx, i) => (
          <HistoryRow key={`${tx.transactionId ?? "x"}-${i}`} tx={tx} />
        ))}
      </div>
    )

  return (
    <div className="animate-fade-up lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-10 lg:items-start">
      {/* ====== Coluna principal (operar / IA / resumo) ====== */}
      <div className="lg:min-w-0">
      {/* ====== Cabecalho: saudacao + saldo ====== */}
      {showHeader && (
        <section>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground mb-1">
            Bem-vindo
          </p>
          <h1 className="font-display text-2xl font-bold leading-tight">{userName || "Trader"}</h1>

          <div className="mt-4 skeuo-card-deep rounded-2xl p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="size-4" />
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.28em]">Saldo disponível</span>
            </div>
            <p className="mt-2 font-display text-3xl font-bold">
              {balanceLoading ? (
                <span className="inline-flex items-center gap-2 text-muted-foreground text-base">
                  <Loader2 className="size-4 animate-spin" /> Carregando...
                </span>
              ) : (
                <>
                  <span className="text-muted-foreground text-lg align-top mr-1">R$</span>
                  {balance?.credit ?? "0,00"}
                </>
              )}
            </p>
            {balance && (balance.freebet !== "0,00" || balance.bonus !== "0,00") && (
              <div className="mt-2 flex gap-4 text-[0.65rem] text-muted-foreground">
                <span>Freebet: R$ {balance.freebet}</span>
                <span>Bônus: R$ {balance.bonus}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ====== Abas Operar / Historico ====== */}
      {showHeader && (
        <div className="mt-6 flex gap-2.5 lg:hidden">
          <button
            onClick={() => setTab("operar")}
            className={`clay-chip flex-1 h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-display font-bold ${
              tab === "operar" ? "is-active-solid" : ""
            }`}
          >
            <CandlestickChart className="size-4" /> Operar
          </button>
          <button
            onClick={() => setTab("historico")}
            className={`clay-chip flex-1 h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-display font-bold ${
              tab === "historico" ? "is-active-solid" : ""
            }`}
          >
            <History className="size-4" /> Histórico
          </button>
        </div>
      )}

      {/* ====== OPERAR: tela inicial da IA ====== */}
      {showHeader && (
        <section
          className={`mt-8 flex-col items-center text-center ${
            tab === "operar" ? "flex" : "hidden lg:flex"
          }`}
        >
          <AiOrb />
          <h2 className="mt-8 font-display text-2xl font-bold text-balance">Trading automático com IA</h2>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground text-balance">
            A IA escolhe os ativos automaticamente e opera por você até atingir suas metas de ganho ou perda.
          </p>
          <button
            onClick={requestStart}
            disabled={!token && !demo}
            className="mt-8 w-full max-w-xs h-14 rounded-2xl button-primary flex items-center justify-center gap-2 font-semibold text-sm text-primary-foreground disabled:opacity-50"
          >
            {vipBlocked ? <Lock className="size-5" /> : <Lightning weight="fill" className="size-5" />} Iniciar IA
          </button>
          {vipBlocked && (
            <p className="mt-3 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
              <Crown className="size-3.5 text-primary" />
              Recurso exclusivo para membros VIP.
            </p>
          )}
            </section>
      )}

      {/* ====== HISTORICO ====== */}
      {showHeader && tab === "historico" && (
        <section className="mt-6 lg:hidden">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground mb-3">
            Histórico de operações
          </p>
          {historyList}
        </section>
      )}

      {/* ====== IA EM EXECUCAO ====== */}
      {autoActive && (
        <section className="mt-2 flex flex-col items-center py-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-[0.6rem] font-mono uppercase tracking-[0.28em]">
                    <Lightning weight="fill" className="size-3" /> IA operando
          </div>

          {scheduledWait ? (
            <div className="mt-8 flex flex-col items-center w-full max-w-xs">
              <div className="relative size-52 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full ring-1 ring-primary/30 animate-ping-slow" />
                <span className="absolute inset-3 rounded-full ring-1 ring-border" />
                <div className="flex flex-col items-center">
                  <span className="font-mono text-[0.58rem] uppercase tracking-[0.3em] text-primary mb-1">
                    Entrada em
                  </span>
                  <span className="font-display text-5xl font-bold tabular-nums">{fmtTime(entryRemaining)}</span>
                  <span className="font-mono text-[0.55rem] uppercase tracking-[0.24em] text-muted-foreground mt-1">
                    abertura da vela M{cfg.expiration}
                  </span>
                </div>
              </div>

              {autoCurrent && (
                <div className="mt-7 w-full skeuo-card-inset rounded-2xl p-4 flex items-center gap-3">
                  <span
                    className={`flex items-center justify-center size-11 rounded-xl shrink-0 ${
                      autoCurrent.direction === 1
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {autoCurrent.direction === 1 ? (
                      <TrendingUp className="size-5" />
                    ) : (
                      <TrendingDown className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">A IA vai entrar em</p>
                    <p className="font-display text-lg font-bold leading-tight">{formatSymbol(autoCurrent.symbol)}</p>
                    <p
                      className={`text-xs font-semibold ${
                        autoCurrent.direction === 1 ? "text-emerald-400" : "text-destructive"
                      }`}
                    >
                      {autoCurrent.direction === 1 ? "Compra (acima)" : "Venda (abaixo)"} · R$ {cfg.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : analyzing ? (
            <div className="mt-8 flex flex-col items-center py-6">
              <AiOrb />
              <p className="mt-6 font-mono text-[0.6rem] uppercase tracking-[0.3em] text-primary animate-pulse">
                IA analisando o mercado
              </p>
              <p className="mt-2 text-xs text-muted-foreground text-center max-w-xs text-balance">
                Escaneando os ativos disponíveis e o melhor ponto de entrada...
              </p>
              <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
                <span className="size-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.3s]" />
                <span className="size-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.15s]" />
                <span className="size-1.5 rounded-full bg-primary/70 animate-bounce" />
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-display text-3xl font-bold mt-3">{formatSymbol(autoCurrent?.symbol)}</h2>
              {autoCurrent && (
                <div
                  className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    autoCurrent.direction === 1
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {autoCurrent.direction === 1 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                  {autoCurrent.direction === 1 ? "Acima" : "Abaixo"} · R$ {autoAmount.toFixed(2)}
                </div>
              )}
              {reentryLevel > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 text-[0.6rem] font-mono uppercase tracking-[0.2em]">
                  <RotateCcw className="size-3" /> Reentrada {reentryLevel}/{cfgRef.current.reentries}
                </div>
              )}

              <div className="relative mt-8 size-52">
                <svg className="size-full -rotate-90" viewBox="0 0 180 180">
                  <circle cx="90" cy="90" r={RADIUS} fill="none" strokeWidth="10" className="stroke-border" />
                  <circle
                    cx="90"
                    cy="90"
                    r={RADIUS}
                    fill="none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    className={autoCurrent?.direction === 1 ? "stroke-emerald-500" : "stroke-destructive"}
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC * (1 - progress)}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {settling ? (
                    <>
                      <Loader2 className="size-8 animate-spin text-primary" />
                      <span className="font-mono text-[0.55rem] uppercase tracking-[0.24em] text-muted-foreground mt-2 text-center px-4 text-balance">
                        Confirmando resultado
                      </span>
                    </>
                  ) : autoStatus === "placing" ? (
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <span className="font-display text-5xl font-bold tabular-nums">{fmtTime(remaining)}</span>
                      <span className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground mt-1">
                        restante
                      </span>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Painel de metas / resultado parcial */}
          <div className="mt-8 w-full max-w-xs skeuo-card-deep rounded-2xl p-5 space-y-3">
            <Row
              label="Resultado da sessão"
              value={`${sessionPnl >= 0 ? "+" : "-"} R$ ${Math.abs(sessionPnl).toFixed(2)}`}
              accent={sessionPnl > 0}
              down={sessionPnl < 0}
            />
            <Row label="Operações" value={String(sessionOps.length)} />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 px-3 py-2 text-center">
                <p className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-emerald-400/80">Greens</p>
                <p className="font-display text-xl font-bold text-emerald-400 tabular-nums">{greenCount}</p>
              </div>
              <div className="rounded-xl bg-destructive/10 ring-1 ring-destructive/20 px-3 py-2 text-center">
                <p className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-destructive/80">Loss</p>
                <p className="font-display text-xl font-bold text-destructive tabular-nums">{lossCount}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <MetaPill
                icon={<ShieldCheck className="size-3.5" />}
                label={`Stop win (${cfgRef.current.stopWinPct}%)`}
                value={`R$ ${cfgRef.current.stopWin.toFixed(2)}`}
                tone="win"
              />
              <MetaPill
                icon={<ShieldAlert className="size-3.5" />}
                label={`Stop loss (${cfgRef.current.stopLossPct}%)`}
                value={`R$ ${cfgRef.current.stopLoss.toFixed(2)}`}
                tone="loss"
              />
            </div>
          </div>

          <button
            onClick={() => {
              if (opInProgress) {
                setConfirmStopOpen(true)
              } else {
                finishAuto("manual")
              }
            }}
            className="clay-card clay-card-interactive mt-6 w-full max-w-xs h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold text-foreground/90 hover:text-foreground"
          >
            <Square className="size-4" /> Parar IA
          </button>
        </section>
      )}

      {/* ====== RESUMO DA SESSAO ====== */}
      {autoFinished && (
        <section className="mt-2 flex flex-col items-center py-8 animate-fade-up">
          <div
            className={`flex items-center justify-center size-24 rounded-full ${
              autoFinished.reason === "win"
                ? "bg-emerald-500/15"
                : autoFinished.reason === "loss"
                  ? "bg-destructive/15"
                  : "bg-card"
            }`}
          >
            {autoFinished.reason === "win" ? (
              <CheckCircle2 className="size-12 text-emerald-400" />
            ) : autoFinished.reason === "loss" || autoFinished.reason === "error" ? (
              <XCircle className="size-12 text-destructive" />
            ) : (
              <Square className="size-10 text-muted-foreground" />
            )}
          </div>

          <h2 className="mt-5 font-display text-3xl font-bold uppercase tracking-tight text-balance text-center">
            {autoFinished.reason === "win"
              ? "Meta atingida!"
              : autoFinished.reason === "loss"
                ? "Stop loss atingido"
                : autoFinished.reason === "error"
                  ? "Sessão interrompida"
                  : "IA encerrada"}
          </h2>

          <p
            className={`mt-2 font-display text-2xl font-bold ${
              autoFinished.pnl > 0 ? "text-emerald-400" : autoFinished.pnl < 0 ? "text-destructive" : "text-foreground"
            }`}
          >
            {autoFinished.pnl >= 0 ? "+" : "-"} R$ {Math.abs(autoFinished.pnl).toFixed(2)}
          </p>
          {autoError && <p className="mt-2 text-center text-[0.7rem] text-destructive max-w-xs">{autoError}</p>}

          {sessionOps.length > 0 && (
            <div className="mt-6 w-full max-w-xs space-y-2">
              {sessionOps.map((tx, i) => (
                <HistoryRow key={`s-${i}`} tx={tx} />
              ))}
            </div>
          )}

          <div className="mt-6 w-full max-w-xs grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                resetSession()
                requestStart()
              }}
              className="clay-card clay-card-interactive h-12 rounded-2xl text-sm font-semibold text-foreground/90 hover:text-foreground"
            >
              Operar novamente
            </button>
            <button
              onClick={resetSession}
              className="h-12 rounded-2xl button-primary flex items-center justify-center text-sm font-semibold text-primary-foreground"
            >
              Concluir
            </button>
          </div>
        </section>
      )}

      </div>

      {/* ====== Coluna lateral: histórico (somente desktop) ====== */}
      <aside className="hidden lg:block lg:sticky lg:top-14">
        <div className="skeuo-card-deep rounded-2xl p-5">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground mb-4 flex items-center gap-2">
            <History className="size-3.5" /> Histórico de operações
          </p>
          <div className="max-h-[68vh] overflow-y-auto scrollbar-hide">{historyList}</div>
        </div>
      </aside>

      {/* ====== POP-UP DE CONFIGURACAO DA IA ====== */}
      {setupOpen && (
        <SetupSheet
          amount={amount}
          setAmount={setAmount}
          amountNum={amountNum}
          expiration={expiration}
          setExpiration={setExpiration}
          stopWin={stopWin}
          setStopWin={setStopWin}
          stopLoss={stopLoss}
          setStopLoss={setStopLoss}
          reentries={reentries}
          setReentries={setReentries}
          balanceNum={brlToNumber(balance?.credit) || 0}
          canStart={canStart}
          onStart={startAi}
          onClose={() => setSetupOpen(false)}
        />
      )}

      {/* ====== POP-UP DE BLOQUEIO VIP ====== */}
      {/* Aparece quando uma conta real (nao demo) sem VIP tenta iniciar a IA.
          Leva o usuario direto para a sessao de planos VIP. */}
      {vipGateOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-fade-up"
              onClick={() => setVipGateOpen(false)}
            />

            <div className="relative w-full sm:max-w-sm max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl skeuo-card-deep p-6 animate-fade-up text-center">
              <div className="mx-auto flex items-center justify-center size-16 rounded-full bg-primary/15">
                <Crown className="size-8 text-primary" />
              </div>

              <h3 className="mt-4 font-display text-xl font-bold text-balance">Acesso exclusivo VIP</h3>
              <p className="mt-2 text-sm text-muted-foreground text-balance">
                Para a IA operar automaticamente por você, é necessário ser um membro{" "}
                <span className="font-semibold text-foreground">VIP</span>. Assine um plano e libere o trading
                automático na hora.
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setVipGateOpen(false)
                    onGoVip?.()
                  }}
                  className="h-12 rounded-2xl button-primary flex items-center justify-center gap-2 text-sm font-semibold text-primary-foreground"
                >
                  <Crown className="size-4" /> Ver planos VIP
                </button>
                <button
                  onClick={() => setVipGateOpen(false)}
                  className="h-11 rounded-2xl clay-card text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Agora não
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ====== POP-UP DE CONFIRMACAO DE ENCERRAMENTO ====== */}
      {/* Tambem via portal no <body>: mesmo motivo do popup de configuracao —
          o ancestral com `.animate-fade-up` (transform residual) faria o
          backdrop `fixed` cobrir so a area do conteudo em vez da viewport. */}
      {confirmStopOpen &&
        typeof document !== "undefined" &&
        createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-fade-up"
            onClick={() => setConfirmStopOpen(false)}
          />

          <div className="relative w-full sm:max-w-sm max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl skeuo-card-deep p-6 animate-fade-up text-center">
            <div className="mx-auto flex items-center justify-center size-14 rounded-full bg-destructive/15">
              <ShieldAlert className="size-7 text-destructive" />
            </div>

            <h3 className="mt-4 font-display text-lg font-bold text-balance">Encerrar a IA agora?</h3>
            <p className="mt-2 text-sm text-muted-foreground text-balance">
              Há uma operação em andamento. Se você encerrar agora, ela ficará com o status{" "}
              <span className="font-semibold text-foreground">aberto</span> no seu histórico e o resultado não será
              contabilizado nesta sessão.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setConfirmStopOpen(false)
                  finishAuto("manual", true)
                }}
                className="w-full h-12 rounded-2xl button-primary flex items-center justify-center gap-2 text-sm font-semibold text-primary-foreground"
              >
                <Square className="size-4" /> Encerrar mesmo assim
              </button>
              <button
                onClick={() => setConfirmStopOpen(false)}
                className="w-full h-12 rounded-2xl clay-card clay-card-interactive flex items-center justify-center gap-2 text-sm font-semibold text-foreground/90 hover:text-foreground"
              >
                Continuar operando
              </button>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </div>
  )
}

// ============================================================
// POP-UP de configuracao com "arrastar para revelar"
// ============================================================
function SetupSheet({
  amount,
  setAmount,
  amountNum,
  expiration,
  setExpiration,
  stopWin,
  setStopWin,
  stopLoss,
  setStopLoss,
  reentries,
  setReentries,
  balanceNum,
  canStart,
  onStart,
  onClose,
}: {
  amount: string
  setAmount: (v: string) => void
  amountNum: number
  expiration: number
  setExpiration: (v: number) => void
  stopWin: string
  setStopWin: (v: string) => void
  stopLoss: string
  setStopLoss: (v: string) => void
  reentries: string
  setReentries: (v: string) => void
  balanceNum: number
  canStart: boolean
  onStart: () => void
  onClose: () => void
}) {
  const [revealed, setRevealed] = useState(false)
  const step1Valid = amountNum >= 5
  const reentryNum = Math.max(0, Number.parseInt(reentries) || 0)
  const stopWinPct = Number.parseFloat(stopWin) || 0
  const stopLossPct = Number.parseFloat(stopLoss) || 0
  const stopWinValue = balanceNum * (stopWinPct / 100)
  const stopLossValue = balanceNum * (stopLossPct / 100)

  // Renderizado via portal no <body>. Isso e essencial: o container da
  // TradingContent usa `.animate-fade-up`, cuja animacao (fill-mode both) deixa
  // um `transform: translateY(0)` residual. Um ancestral com transform vira o
  // containing block de elementos `position: fixed`, fazendo o backdrop cobrir
  // apenas a area do conteudo (o "bloco" retangular atras do popup) em vez da
  // viewport inteira. O portal tira o modal desse ancestral.
  if (typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-fade-up" onClick={onClose} />

      <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl skeuo-card-deep p-5 animate-fade-up">
        {/* Cabecalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {revealed ? (
              <button onClick={() => setRevealed(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="size-5" />
              </button>
            ) : (
                <Lightning weight="fill" className="size-4 text-primary" />
            )}
            <h3 className="font-display text-lg font-bold">{revealed ? "Risco & reentrada" : "Configurar IA"}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {/* Indicador de etapa */}
        <div className="mt-4 flex items-center gap-1.5">
          <span className={`h-1 flex-1 rounded-full transition-colors ${revealed ? "bg-border" : "bg-primary"}`} />
          <span className={`h-1 flex-1 rounded-full transition-colors ${revealed ? "bg-primary" : "bg-border"}`} />
        </div>

        {/* ===== TELA 1: valor + time frame ===== */}
        {!revealed && (
          <div className="animate-fade-up">
            <p className="font-display font-semibold text-xs uppercase tracking-[0.12em] text-muted-foreground mb-2 mt-5">
              Valor por entrada (mín. R$ 5,00)
            </p>
            <div className="clay-input rounded-2xl flex items-center gap-3 px-4 h-14">
              <span className="text-muted-foreground text-sm">R$</span>
              <input
                type="number"
                min="5"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-transparent outline-none text-lg font-display font-bold text-foreground"
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  onClick={() => setAmount(String(q))}
                  className={`clay-chip h-11 rounded-2xl text-sm font-display font-bold ${amountNum === q ? "is-active-solid" : ""}`}
                >
                  R$ {q}
                </button>
              ))}
            </div>

            <p className="font-display font-semibold text-xs uppercase tracking-[0.12em] text-muted-foreground mb-2 mt-5">
              Time frame
            </p>
            <div className="flex flex-wrap gap-2.5">
              {EXPIRATIONS.map((exp) => (
                <button
                  key={exp}
                  onClick={() => setExpiration(exp)}
                  className={`clay-chip flex-1 min-w-[3.5rem] h-11 rounded-2xl text-sm font-display font-bold ${expiration === exp ? "is-active-solid" : ""}`}
                >
                  {exp === 60 ? "1h" : `${exp}m`}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <SlideToReveal disabled={!step1Valid} onReveal={() => setRevealed(true)} />
              {!step1Valid && (
                <p className="mt-2 text-center text-[0.65rem] text-destructive">
                  Defina um valor de no mínimo R$ 5,00 para continuar.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ===== TELA 2: stop win + reentrada ===== */}
        {revealed && (
          <div className="animate-fade-up">
            <div className="skeuo-card-inset rounded-2xl px-4 py-3.5 mb-5 mt-5 flex items-center gap-3">
              <span className="skeuo-icon-container flex items-center justify-center size-9 rounded-xl shrink-0">
                <Wallet className="size-4 text-primary" />
              </span>
              <p className="text-[0.72rem] text-muted-foreground leading-relaxed">
                Defina o stop em % da sua banca atual
                {balanceNum > 0 ? (
                  <span className="text-foreground font-semibold font-mono"> (R$ {balanceNum.toFixed(2)})</span>
                ) : ""}
                .
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div className="skeuo-card rounded-2xl p-4 relative overflow-hidden">
                <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
                <p className="font-display font-semibold text-xs uppercase tracking-[0.12em] text-emerald-400 mb-2.5 flex items-center gap-1.5">
                  <span className="flex items-center justify-center size-5 rounded-md bg-emerald-500/15">
                    <ShieldCheck className="size-3" />
                  </span>
                  Stop win
                </p>
                <div className="clay-input rounded-xl flex items-center gap-2 px-3 h-12">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={stopWin}
                    onChange={(e) => setStopWin(e.target.value)}
                    className="w-full bg-transparent outline-none text-lg font-display font-bold text-foreground"
                  />
                  <span className="text-emerald-400/70 text-sm font-bold">%</span>
                </div>
                <p className="mt-2.5 text-[0.65rem] text-emerald-400/90 font-mono font-semibold h-4">
                  {balanceNum > 0 && stopWinPct > 0 ? `≈ R$ ${stopWinValue.toFixed(2)}` : ""}
                </p>
              </div>
              <div className="skeuo-card rounded-2xl p-4 relative overflow-hidden">
                <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-destructive/70 to-transparent" />
                <p className="font-display font-semibold text-xs uppercase tracking-[0.12em] text-destructive mb-2.5 flex items-center gap-1.5">
                  <span className="flex items-center justify-center size-5 rounded-md bg-destructive/15">
                    <ShieldAlert className="size-3" />
                  </span>
                  Stop loss
                </p>
                <div className="clay-input rounded-xl flex items-center gap-2 px-3 h-12">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="w-full bg-transparent outline-none text-lg font-display font-bold text-foreground"
                  />
                  <span className="text-destructive/70 text-sm font-bold">%</span>
                </div>
                <p className="mt-2.5 text-[0.65rem] text-destructive/90 font-mono font-semibold h-4">
                  {balanceNum > 0 && stopLossPct > 0 ? `≈ R$ ${stopLossValue.toFixed(2)}` : ""}
                </p>
              </div>
            </div>

            {/* Reentrada (gale) por loss — quantidade livre */}
            <div className="skeuo-card-inset rounded-2xl p-4 mt-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-display font-semibold text-xs uppercase tracking-[0.12em] text-amber-400 flex items-center gap-1.5">
                  <span className="flex items-center justify-center size-5 rounded-md bg-amber-500/15">
                    <RotateCcw className="size-3" />
                  </span>
                  Reentradas por loss
                </p>
                <span className="text-[0.65rem] text-muted-foreground font-display font-semibold uppercase tracking-[0.12em]">gale</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setReentries(String(Math.max(0, reentryNum - 1)))}
                  className="clay-chip size-12 shrink-0 rounded-2xl text-2xl font-bold leading-none"
                  aria-label="Diminuir reentradas"
                >
                  −
                </button>
                <div className="clay-input rounded-2xl flex-1 flex items-center justify-center h-12">
                  <input
                    type="number"
                    min="0"
                    value={reentries}
                    onChange={(e) => setReentries(e.target.value)}
                    className="w-full bg-transparent outline-none text-center text-xl font-display font-bold text-foreground"
                  />
                </div>
                <button
                  onClick={() => setReentries(String(reentryNum + 1))}
                  className="clay-chip is-amber size-12 shrink-0 rounded-2xl text-2xl font-bold leading-none"
                  aria-label="Aumentar reentradas"
                >
                  +
                </button>
              </div>
            </div>
            <button
              onClick={onStart}
              disabled={!canStart}
              className="mt-6 w-full h-14 rounded-2xl button-primary flex items-center justify-center gap-2 font-semibold text-sm text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
                    <Lightning weight="fill" className="size-5" /> Iniciar IA
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ============================================================
// Barrinha "arraste para o lado" para revelar a proxima etapa
// ============================================================
function SlideToReveal({ onReveal, disabled }: { onReveal: () => void; disabled?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [done, setDone] = useState(false)
  const draggingRef = useRef(false)
  const THUMB = 52
  const PAD = 4

  const maxX = useCallback(() => {
    const w = trackRef.current?.clientWidth ?? 0
    return Math.max(0, w - THUMB - PAD * 2)
  }, [])

  function onPointerDown(e: React.PointerEvent) {
    if (disabled || done) return
    draggingRef.current = true
    setDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current || disabled) return
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const pos = Math.min(Math.max(0, e.clientX - rect.left - PAD - THUMB / 2), maxX())
    setX(pos)
  }

  function onPointerUp() {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    if (x >= maxX() - 6) {
      // chegou ao fim: trava, mostra confirmacao e dispara
      setX(maxX())
      setDone(true)
      setTimeout(() => onReveal(), 300)
    } else {
      setX(0)
    }
  }

  const pct = (() => {
    const m = maxX()
    return m > 0 ? x / m : 0
  })()

  return (
    <div
      ref={trackRef}
      className={`slide-track relative rounded-full overflow-hidden select-none ${disabled ? "opacity-40" : ""} ${dragging ? "is-dragging" : ""} ${done ? "is-done" : ""}`}
      style={{ height: 60 }}
    >
      {/* preenchimento que acompanha o thumb */}
      <div
        className="absolute inset-y-0 left-0 slide-fill"
        style={{
          width: x + THUMB + PAD,
          background: done
            ? "linear-gradient(90deg, color-mix(in oklch, var(--primary) 45%, transparent), color-mix(in oklch, var(--primary) 28%, transparent))"
            : "linear-gradient(90deg, color-mix(in oklch, var(--primary) 32%, transparent), color-mix(in oklch, var(--primary) 6%, transparent))",
          transition: dragging ? "none" : "width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      />

      {/* brilho ambiente que percorre o trilho enquanto ocioso */}
      {!done && (
        <div
          className="slide-ambient-sheen absolute inset-0 pointer-events-none"
          style={{ opacity: Math.max(0, 1 - pct * 2) }}
        />
      )}

      {/* rotulo + setas de dica */}
      <div
        className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none pl-12"
        style={{ opacity: Math.max(0, 1 - pct * 1.7) }}
      >
        <span className="slide-text-shimmer text-sm font-semibold tracking-wide">
          {done ? "Confirmado" : "Arraste para definir o stop"}
        </span>
        {!done && (
          <span className="flex items-center">
            <ChevronRight className="size-4 text-primary animate-slide-hint" style={{ animationDelay: "0ms" }} />
            <ChevronRight
              className="size-4 -ml-2 text-primary/70 animate-slide-hint"
              style={{ animationDelay: "150ms" }}
            />
            <ChevronRight
              className="size-4 -ml-2 text-primary/40 animate-slide-hint"
              style={{ animationDelay: "300ms" }}
            />
          </span>
        )}
      </div>

      {/* thumb arrastavel */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`slide-thumb absolute top-1 bottom-1 flex items-center justify-center rounded-full button-primary text-primary-foreground touch-none ${
          disabled ? "" : "cursor-grab active:cursor-grabbing"
        } ${!dragging && !done ? "animate-thumb-breathe" : ""}`}
        style={{
          left: PAD,
          width: THUMB,
          transform: `translateX(${x}px) scale(${done ? 1 : dragging ? 1.07 : 1})`,
          transition: dragging ? "none" : "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* reflexo superior (vidro) */}
        <span className="slide-thumb-gloss pointer-events-none" aria-hidden="true" />
        {done ? (
          <Check className="size-6 animate-fade-up relative z-10" />
        ) : (
          <ChevronRight className="size-6 relative z-10 transition-transform" style={{ transform: `translateX(${dragging ? 1 : 0}px)` }} />
        )}
      </div>
    </div>
  )
}

function MetaPill({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: "win" | "loss"
}) {
  const isWin = tone === "win"
  return (
    <div className="skeuo-card relative overflow-hidden rounded-2xl p-3.5">
      <span
        className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent to-transparent ${
          isWin ? "via-emerald-400/70" : "via-destructive/70"
        }`}
      />
      <p
        className={`flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-wide ${
          isWin ? "text-emerald-400" : "text-destructive"
        }`}
      >
        <span
          className={`flex items-center justify-center size-5 rounded-md ${
            isWin ? "bg-emerald-500/15" : "bg-destructive/15"
          }`}
        >
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-2 text-base font-display font-bold tabular-nums">{value}</p>
    </div>
  )
}

function HistoryRow({ tx }: { tx: AtlaxLocalTransaction }) {
  const isGreen = tx.result === "green"
  const isPending = !tx.result || tx.result === "pending"

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60">
      <span
        className={`flex items-center justify-center size-9 rounded-full shrink-0 ${
          tx.direction === 1 ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"
        }`}
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 4px rgba(0,0,0,0.35), 0 2px 5px -1px rgba(0,0,0,0.4)",
        }}
      >
        {tx.direction === 1 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{formatSymbol(tx.symbol)}</p>
        <p className="text-[0.6rem] text-muted-foreground flex items-center gap-1">
          <Clock className="size-3" />
          {new Date(tx.createdAt).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" · "}
          {tx.expiration === 60 ? "1h" : `${tx.expiration}m`}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold">R$ {tx.amount.toFixed(2)}</p>
        {isPending ? (
          <p className="text-[0.6rem] uppercase tracking-wider font-mono text-muted-foreground">Em aberto</p>
        ) : (
          <p
            className={`text-[0.6rem] uppercase tracking-wider font-mono ${
              isGreen ? "text-emerald-400" : "text-destructive"
            }`}
          >
            {isGreen ? "Green" : "Loss"}
            {typeof tx.profit === "number" && (
              <span className="ml-1">
                {tx.profit >= 0 ? "+" : "-"}R$ {Math.abs(tx.profit).toFixed(2)}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  accent,
  down,
}: {
  label: string
  value: string
  accent?: boolean
  down?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl skeuo-card-inset">
      <span className="text-[0.72rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={`text-base font-display font-bold tabular-nums ${
          accent ? "text-emerald-400" : down ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  )
}

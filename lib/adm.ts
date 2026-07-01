import { supabase } from "@/lib/supabase"

// ============================================================
// Tipos
// ============================================================

export type Admin = {
  id: string
  name: string
  email: string
  password: string
  role: "supreme" | "admin"
  status: "active" | "banned"
  whatsapp_link: string
  support_email: string
  referral_code: string
  gateway_secret_key: string
  gateway_public_key: string
  created_at: string
}

export type PlanPeriod =
  | "diario"
  | "semanal"
  | "mensal"
  | "trimestral"
  | "semestral"
  | "anual"
  | "vitalicio"

export type Plan = {
  id: string
  admin_id: string
  name: string
  period: PlanPeriod
  first_price: number
  recurring_price: number
  currency: string
  features: string[]
  badge: string
  is_popular: boolean
  is_active: boolean
  sort_order: number
  // Dias de acesso VIP liberados ao pagar este plano (0 = vitalicio).
  duration_days: number
  created_at: string
}

export type AppUser = {
  id: string
  admin_id: string
  name: string
  email: string
  password: string
  phone: string
  status: "active" | "banned"
  source: "manual" | "referral"
  created_at: string
  // Ultimo acesso do usuario ao app (best-effort; pode ser null).
  last_login_at: string | null
  // Conta DEMO (colunas dedicadas no banco)
  is_demo: boolean
  demo_balance: number
  demo_rtp: number
  // Acesso VIP (colunas dedicadas no banco — ver script 009)
  is_vip: boolean
  vip_plan_id: string | null
  vip_plan_name: string
  vip_days: number
  vip_started_at: string | null
  vip_expires_at: string | null
}

export type PixTransaction = {
  id: string
  external_id: string
  admin_id: string | null
  user_id: string | null
  plan_id: string | null
  plan_name: string
  buyer_name: string
  buyer_email: string
  amount: number // valor em centavos
  status: "pending" | "paid" | "failed" | "expired"
  created_at: string
  paid_at: string | null
}

export type SupportTicket = {
  id: string
  admin_id: string
  user_name: string
  user_email: string
  message: string
  response: string
  status: "open" | "answered"
  created_at: string
  answered_at: string | null
}

// ============================================================
// Util
// ============================================================

function genReferralCode(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6)
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base || "ADM"}${suffix}`
}

// ============================================================
// Autenticacao do painel
// ============================================================

// Admin de teste fixo (hard-coded). Util para acessar o painel sem depender
// do banco. NAO usar em producao real - apenas para testes.
const TEST_ADMIN: Admin = {
  id: "test-admin",
  name: "Admin Teste",
  email: "1@gmail.com",
  password: "1",
  role: "supreme",
  status: "active",
  whatsapp_link: "",
  support_email: "",
  referral_code: "TESTE",
  gateway_secret_key: "",
  gateway_public_key: "",
  created_at: new Date().toISOString(),
}

export async function admLogin(email: string, password: string) {
  // Atalho de teste: login fixo que ignora o Supabase.
  if (email.trim().toLowerCase() === TEST_ADMIN.email && password === TEST_ADMIN.password) {
    return { admin: TEST_ADMIN, error: null }
  }

  const { data, error } = await supabase
    .from("admins")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle()

  if (error) return { admin: null, error: "Erro ao conectar. Tente novamente." }
  if (!data) return { admin: null, error: "Credenciais invalidas." }
  if ((data as Admin).password !== password) return { admin: null, error: "Credenciais invalidas." }
  if ((data as Admin).status === "banned") return { admin: null, error: "Este acesso foi suspenso." }

  return { admin: data as Admin, error: null }
}

// ============================================================
// Autenticacao do app (usuarios da tabela app_users)
// ============================================================

export async function userLogin(email: string, password: string) {
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle()

  if (error) return { user: null, error: "Erro ao conectar. Tente novamente." }
  if (!data) return { user: null, error: "Credenciais invalidas." }
  if ((data as AppUser).password !== password) return { user: null, error: "Credenciais invalidas." }
  if ((data as AppUser).status === "banned") return { user: null, error: "Este acesso foi suspenso." }

  return { user: data as AppUser, error: null }
}

// Retorna o adm supremo (dono padrao para cadastros sem indicacao).
export async function getSupremeAdminId() {
  const { data } = await supabase.from("admins").select("id").eq("role", "supreme").maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

// ============================================================
// Admins (supremo)
// ============================================================

export async function listAdmins() {
  const { data, error } = await supabase
    .from("admins")
    .select("*")
    .order("created_at", { ascending: false })
  return { data: (data as Admin[]) ?? [], error }
}

export async function createAdmin(input: { name: string; email: string; password: string }) {
  const payload = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    role: "admin" as const,
    status: "active" as const,
    referral_code: genReferralCode(input.name),
  }
  const { data, error } = await supabase.from("admins").insert(payload).select("*").maybeSingle()
  return { data: data as Admin | null, error }
}

export async function updateAdmin(id: string, patch: Partial<Admin>) {
  const { data, error } = await supabase.from("admins").update(patch).eq("id", id).select("*").maybeSingle()
  return { data: data as Admin | null, error }
}

export async function deleteAdmin(id: string) {
  const { error } = await supabase.from("admins").delete().eq("id", id)
  return { error }
}

export async function getAdmin(id: string) {
  const { data, error } = await supabase.from("admins").select("*").eq("id", id).maybeSingle()
  return { data: data as Admin | null, error }
}

// ============================================================
// App users (assinantes de um adm)
// ============================================================

export async function listAppUsers(adminId: string) {
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("admin_id", adminId)
    .order("created_at", { ascending: false })
  return { data: (data as AppUser[]) ?? [], error }
}

export async function createAppUser(input: {
  admin_id: string
  name: string
  email: string
  password?: string
  phone?: string
  source?: "manual" | "referral"
}) {
  const payload = {
    admin_id: input.admin_id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password ?? "",
    phone: input.phone ?? "",
    status: "active" as const,
    source: input.source ?? ("manual" as const),
  }
  const { data, error } = await supabase.from("app_users").insert(payload).select("*").maybeSingle()
  return { data: data as AppUser | null, error }
}

export async function updateAppUser(id: string, patch: Partial<AppUser>) {
  const { data, error } = await supabase.from("app_users").update(patch).eq("id", id).select("*").maybeSingle()
  return { data: data as AppUser | null, error }
}

export async function deleteAppUser(id: string) {
  const { error } = await supabase.from("app_users").delete().eq("id", id)
  return { error }
}

// ============================================================
// Conta DEMO (comercial)
// ------------------------------------------------------------
// Conta de demonstracao: NAO usa a Atlax. Tem saldo proprio e um RTP
// (% de vitorias) definido pelo adm. Os dados ficam em COLUNAS DEDICADAS da
// tabela app_users: is_demo / demo_balance / demo_rtp. O campo `phone` NUNCA
// e usado pela conta demo (ele e exclusivo do telefone real do usuario Atlax).
// O `name` vira o nome exibido no app e `password` e a senha de acesso.
// ============================================================

export type DemoMeta = { balance: number; rtp: number }

// Retorna os dados demo (saldo + rtp) se o usuario for uma conta demo,
// ou null para usuarios reais comuns.
export function parseDemoMeta(u: Pick<AppUser, "is_demo" | "demo_balance" | "demo_rtp">): DemoMeta | null {
  if (!u.is_demo) return null
  return {
    balance: Number(u.demo_balance) || 0,
    rtp: Math.min(100, Math.max(0, Number(u.demo_rtp) || 0)),
  }
}

export function isDemoUser(u: Pick<AppUser, "is_demo">): boolean {
  return !!u.is_demo
}

export async function createDemoUser(input: {
  admin_id: string
  name: string
  email: string
  password: string
  balance: number
  rtp: number
}) {
  const payload = {
    admin_id: input.admin_id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    phone: "",
    status: "active" as const,
    source: "manual" as const,
    is_demo: true,
    demo_balance: Math.round((input.balance || 0) * 100) / 100,
    demo_rtp: Math.round(Math.min(100, Math.max(0, input.rtp || 0))),
  }
  const { data, error } = await supabase.from("app_users").insert(payload).select("*").maybeSingle()
  return { data: data as AppUser | null, error }
}

export async function updateDemoUser(
  id: string,
  patch: { name?: string; password?: string; balance?: number; rtp?: number },
) {
  const upd: Partial<AppUser> = {}
  if (patch.name !== undefined) upd.name = patch.name.trim()
  if (patch.password !== undefined) upd.password = patch.password
  if (patch.balance !== undefined) upd.demo_balance = Math.round(patch.balance * 100) / 100
  if (patch.rtp !== undefined) upd.demo_rtp = Math.round(Math.min(100, Math.max(0, patch.rtp)))
  const { data, error } = await supabase.from("app_users").update(upd).eq("id", id).select("*").maybeSingle()
  return { data: data as AppUser | null, error }
}

// Atualiza apenas o saldo da conta demo (usado durante as operacoes). Mantem rtp.
export async function updateDemoBalance(id: string, balance: number) {
  await supabase
    .from("app_users")
    .update({ demo_balance: Math.round(balance * 100) / 100 })
    .eq("id", id)
}

// Login de conta demo (nao toca na Atlax).
// - Se nao existir usuario com esse email, retorna {user:null} sem erro
//   (o fluxo de login segue para a Atlax normalmente).
// - Se existir mas for usuario real (sem marcador demo), tambem segue para a Atlax.
// - Se for demo: valida senha e status.
export async function demoLogin(email: string, password: string) {
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle()

  if (error) return { user: null as AppUser | null, meta: null as DemoMeta | null, error: "Erro ao conectar. Tente novamente." }

  const user = data as AppUser | null
  const meta = user ? parseDemoMeta(user) : null
  if (!user || !meta) return { user: null, meta: null, error: null } // nao e demo -> segue Atlax

  if (user.password !== password) return { user: null, meta: null, error: "Credenciais inválidas." }
  if (user.status === "banned") return { user: null, meta: null, error: "Este acesso foi suspenso." }

  void touchLastLogin(user.id)
  return { user, meta, error: null }
}

// ============================================================
// Tickets de suporte
// ============================================================

export async function listTickets(adminId: string) {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("admin_id", adminId)
    .order("created_at", { ascending: false })
  return { data: (data as SupportTicket[]) ?? [], error }
}

export async function createTicket(input: {
  admin_id: string
  user_name?: string
  user_email?: string
  message: string
}) {
  const payload = {
    admin_id: input.admin_id,
    user_name: input.user_name ?? "",
    user_email: (input.user_email ?? "").trim().toLowerCase(),
    message: input.message,
    status: "open" as const,
  }
  const { data, error } = await supabase.from("support_tickets").insert(payload).select("*").maybeSingle()
  return { data: data as SupportTicket | null, error }
}

// Tickets de um usuario especifico (para ele acompanhar suas duvidas).
export async function listUserTickets(email: string) {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_email", email.trim().toLowerCase())
    .order("created_at", { ascending: false })
  return { data: (data as SupportTicket[]) ?? [], error }
}

export async function answerTicket(id: string, response: string) {
  const { data, error } = await supabase
    .from("support_tickets")
    .update({ response, status: "answered", answered_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle()
  return { data: data as SupportTicket | null, error }
}

// ============================================================
// Indicacao / cadastro publico
// ============================================================

export async function findAdminByReferral(code: string) {
  const { data } = await supabase
    .from("admins")
    .select("*")
    .eq("referral_code", code.trim().toUpperCase())
    .eq("status", "active")
    .maybeSingle()
  return data as Admin | null
}

export async function findAppUserByEmail(email: string) {
  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle()
  return data as AppUser | null
}

// ------------------------------------------------------------
// Base padrao (adm que recebe todo usuario sem base definida)
// ------------------------------------------------------------

// Email/senha do adm padrao. Todo usuario que loga sem indicacao
// e sem cadastro previo cai automaticamente na base deste adm.
export const DEFAULT_BASE_ADMIN_EMAIL = "jhon@gmail.com"
const DEFAULT_BASE_ADMIN_PASSWORD = "121212"

// Garante que o adm padrao exista e retorna o id dele.
// Se ainda nao existir, cria automaticamente.
export async function ensureDefaultBaseAdminId() {
  const { data: existing } = await supabase
    .from("admins")
    .select("id")
    .eq("email", DEFAULT_BASE_ADMIN_EMAIL)
    .maybeSingle()
  if (existing) return (existing as { id: string }).id

  const payload = {
    name: "Base Geral",
    email: DEFAULT_BASE_ADMIN_EMAIL,
    password: DEFAULT_BASE_ADMIN_PASSWORD,
    role: "admin" as const,
    status: "active" as const,
    referral_code: genReferralCode("BASE"),
  }
  const { data } = await supabase.from("admins").insert(payload).select("id").maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

// Resolve (ou cria) o vinculo do usuario logado a uma base de adm.
// - Se o usuario ja existe na base, mantem o adm atual (vinculo travado).
// - Senao, vincula ao adm do link de indicacao (se houver e valido).
// - Senao, vincula ao adm padrao (base geral / jhon).
export async function resolveUserBase(input: {
  login: string
  name?: string
  refCode?: string | null
}) {
  const login = input.login.trim().toLowerCase()

  const existing = await findAppUserByEmail(login)
  if (existing) {
    void touchLastLogin(existing.id)
    return { user: existing, error: null as string | null }
  }

  let adminId: string | null = null
  let source: "manual" | "referral" = "manual"

  if (input.refCode) {
    const refAdmin = await findAdminByReferral(input.refCode)
    if (refAdmin) {
      adminId = refAdmin.id
      source = "referral"
    }
  }

  if (!adminId) adminId = await ensureDefaultBaseAdminId()
  if (!adminId) return { user: null, error: "Nao foi possivel definir a base." }

  const { data, error } = await createAppUser({
    admin_id: adminId,
    name: input.name?.trim() || login,
    email: login,
    password: "",
    source,
  })
  return { user: data, error: error ? "Nao foi possivel vincular a base." : null }
}

// Adm que deve receber a mensagem de um usuario: o dono da base dele,
// ou o adm supremo como fallback (para nenhuma mensagem se perder).
export async function resolveSupportAdminId(email: string) {
  const appUser = await findAppUserByEmail(email)
  if (appUser) return appUser.admin_id

  const { data } = await supabase
    .from("admins")
    .select("id")
    .eq("role", "supreme")
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

export async function countReferrals(adminId: string) {
  const { count } = await supabase
    .from("app_users")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", adminId)
    .eq("source", "referral")
  return count ?? 0
}

// ============================================================
// Planos (cada adm cria os seus)
// ============================================================

export const PLAN_PERIODS: { value: PlanPeriod; label: string }[] = [
  { value: "diario", label: "Diário" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
  { value: "vitalicio", label: "Vitalício" },
]

export function planPeriodLabel(period: PlanPeriod) {
  return PLAN_PERIODS.find((p) => p.value === period)?.label ?? period
}

export async function listPlans(adminId: string) {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("admin_id", adminId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  return { data: (data as Plan[]) ?? [], error }
}

// Planos ativos que um usuario final ve (somente da base do adm dele).
export async function listActivePlans(adminId: string) {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("admin_id", adminId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  return { data: (data as Plan[]) ?? [], error }
}

export async function createPlan(input: {
  admin_id: string
  name: string
  period: PlanPeriod
  first_price: number
  recurring_price: number
  currency?: string
  features?: string[]
  badge?: string
  is_popular?: boolean
  is_active?: boolean
  sort_order?: number
  duration_days?: number
}) {
  const payload = {
    admin_id: input.admin_id,
    name: input.name.trim(),
    period: input.period,
    first_price: input.first_price,
    recurring_price: input.recurring_price,
    currency: input.currency ?? "BRL",
    features: input.features ?? [],
    badge: input.badge ?? "",
    is_popular: input.is_popular ?? false,
    is_active: input.is_active ?? true,
    sort_order: input.sort_order ?? 0,
    duration_days: Math.max(0, Math.floor(input.duration_days ?? 0)),
  }
  const { data, error } = await supabase.from("plans").insert(payload).select("*").maybeSingle()
  return { data: data as Plan | null, error }
}

export async function updatePlan(id: string, patch: Partial<Plan>) {
  const { data, error } = await supabase.from("plans").update(patch).eq("id", id).select("*").maybeSingle()
  return { data: data as Plan | null, error }
}

export async function deletePlan(id: string) {
  const { error } = await supabase.from("plans").delete().eq("id", id)
  return { error }
}

// Quanto um plano representa de RECORRENCIA MENSAL (em reais).
// Usado para calcular o MRR. Vitalicio nao gera recorrencia.
export function planMonthlyValue(plan: Pick<Plan, "period" | "recurring_price">): number {
  const v = Number(plan.recurring_price) || 0
  switch (plan.period) {
    case "diario":
      return v * 30
    case "semanal":
      return v * 4.345
    case "mensal":
      return v
    case "trimestral":
      return v / 3
    case "semestral":
      return v / 6
    case "anual":
      return v / 12
    case "vitalicio":
      return 0
    default:
      return v
  }
}

// Dias de acesso "padrao" para cada periodicidade (usado quando o plano
// nao tem duration_days definido explicitamente). Vitalicio = 0 (sem expiracao).
export function planPeriodDefaultDays(period: PlanPeriod): number {
  switch (period) {
    case "diario":
      return 1
    case "semanal":
      return 7
    case "mensal":
      return 30
    case "trimestral":
      return 90
    case "semestral":
      return 180
    case "anual":
      return 365
    case "vitalicio":
      return 0
    default:
      return 30
  }
}

// Quantos dias de VIP um plano libera. Usa duration_days quando definido (> 0);
// senao cai no padrao da periodicidade. 0 = vitalicio (sem expiracao).
export function planAccessDays(plan: Pick<Plan, "period" | "duration_days">): number {
  const d = Number(plan.duration_days) || 0
  if (d > 0) return d
  return planPeriodDefaultDays(plan.period)
}

// ============================================================
// Acesso VIP (assinatura ativa que libera a IA)
// ============================================================

const VIP_DAY_MS = 24 * 60 * 60 * 1000

export type VipStatus = {
  isVip: boolean // VIP ativo AGORA (nao expirado)
  lifetime: boolean // acesso vitalicio (sem data de expiracao)
  planName: string
  totalDays: number // total de dias concedidos
  daysLeft: number // dias restantes (0 se expirado; ignorado se lifetime)
  startedAt: string | null
  expiresAt: string | null
}

type VipCols = Pick<
  AppUser,
  "is_vip" | "vip_plan_name" | "vip_days" | "vip_started_at" | "vip_expires_at"
>

// Calcula o status de VIP a partir das colunas do usuario. A contagem
// regressiva sai de vip_expires_at, entao "faltam X dias" cai sozinho a cada
// dia sem precisar de rotina — quando passa da data, deixa de ser VIP.
export function computeVipStatus(u: VipCols): VipStatus {
  const flagged = !!u.is_vip
  const lifetime = flagged && !u.vip_expires_at
  let daysLeft = 0
  if (u.vip_expires_at) {
    const ms = new Date(u.vip_expires_at).getTime() - Date.now()
    daysLeft = ms > 0 ? Math.ceil(ms / VIP_DAY_MS) : 0
  }
  const active = flagged && (lifetime || daysLeft > 0)
  return {
    isVip: active,
    lifetime,
    planName: u.vip_plan_name || "",
    totalDays: Number(u.vip_days) || 0,
    daysLeft,
    startedAt: u.vip_started_at,
    expiresAt: u.vip_expires_at,
  }
}

// Busca o status de VIP de um usuario pelo email.
// - ok:false  -> nao foi possivel ler (ex.: colunas de VIP ainda nao existem
//                no banco). Nesse caso o app NAO deve bloquear a IA.
// - ok:true, status:null -> usuario nao encontrado.
export async function getUserVipByEmail(
  email: string,
): Promise<{ ok: boolean; status: VipStatus | null }> {
  try {
    const { data, error } = await supabase
      .from("app_users")
      .select("is_vip, vip_plan_name, vip_days, vip_started_at, vip_expires_at")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle()
    if (error) return { ok: false, status: null }
    if (!data) return { ok: true, status: null }
    return { ok: true, status: computeVipStatus(data as VipCols) }
  } catch {
    return { ok: false, status: null }
  }
}

// Concede/renova o VIP de um usuario.
// - days = 0  -> acesso vitalicio (sem expiracao).
// - extend    -> se ja for VIP ativo, soma os dias a partir do vencimento atual
//                (usado em renovacoes por pagamento). Sem extend, conta de hoje.
export async function grantVip(
  userId: string,
  opts: { days: number; planId?: string | null; planName?: string; extend?: boolean },
) {
  const now = Date.now()
  const days = Math.max(0, Math.floor(opts.days || 0))
  const lifetime = days === 0

  let base = now
  if (opts.extend && !lifetime) {
    const { data } = await supabase
      .from("app_users")
      .select("is_vip, vip_expires_at")
      .eq("id", userId)
      .maybeSingle()
    const exp = (data as { is_vip?: boolean; vip_expires_at?: string | null } | null)?.vip_expires_at
    const isVip = (data as { is_vip?: boolean } | null)?.is_vip
    if (isVip && exp && new Date(exp).getTime() > now) base = new Date(exp).getTime()
  }

  const patch = {
    is_vip: true,
    vip_plan_id: opts.planId ?? null,
    vip_plan_name: opts.planName ?? "",
    vip_days: days,
    vip_started_at: new Date(now).toISOString(),
    vip_expires_at: lifetime ? null : new Date(base + days * VIP_DAY_MS).toISOString(),
  }
  const { data, error } = await supabase
    .from("app_users")
    .update(patch)
    .eq("id", userId)
    .select("*")
    .maybeSingle()
  return { data: data as AppUser | null, error }
}

// Remove o VIP de um usuario (volta a ser bloqueado).
export async function revokeVip(userId: string) {
  const patch = {
    is_vip: false,
    vip_plan_id: null,
    vip_plan_name: "",
    vip_days: 0,
    vip_started_at: null,
    vip_expires_at: null,
  }
  const { data, error } = await supabase
    .from("app_users")
    .update(patch)
    .eq("id", userId)
    .select("*")
    .maybeSingle()
  return { data: data as AppUser | null, error }
}

// Ativa o VIP apos um pagamento confirmado. Resolve o usuario (por id ou email)
// e usa os dias do plano comprado. Chamado pelo webhook do PIX.
export async function activateVipForPurchase(input: {
  userId: string | null
  buyerEmail: string
  planId: string | null
}) {
  let userId = input.userId
  if (!userId && input.buyerEmail) {
    const u = await findAppUserByEmail(input.buyerEmail)
    userId = u?.id ?? null
  }
  if (!userId) return { data: null as AppUser | null, error: "Usuario nao encontrado." }

  let days = 30
  let planName = ""
  if (input.planId) {
    const { data } = await supabase
      .from("plans")
      .select("name, period, duration_days")
      .eq("id", input.planId)
      .maybeSingle()
    if (data) {
      days = planAccessDays(data as Pick<Plan, "period" | "duration_days">)
      planName = (data as { name?: string }).name || ""
    }
  }
  return grantVip(userId, { days, planId: input.planId, planName, extend: true })
}

// ============================================================
// Transacoes PIX / Vendas
// ============================================================

export async function listTransactions(adminId: string) {
  const { data, error } = await supabase
    .from("pix_transactions")
    .select("*")
    .eq("admin_id", adminId)
    .order("created_at", { ascending: false })
  return { data: (data as PixTransaction[]) ?? [], error }
}

// Estatisticas de pagamento por usuario, calculadas a partir das transacoes
// pagas. A chave do mapa e o user_id (ou, como fallback, o email do comprador).
export type UserPaymentStats = {
  paidCount: number
  totalPaid: number // em reais
  lastPaidAt: string | null
  lastPlanName: string
}

export function buildUserPaymentStats(txs: PixTransaction[]) {
  const byUserId = new Map<string, UserPaymentStats>()
  const byEmail = new Map<string, UserPaymentStats>()

  function bump(map: Map<string, UserPaymentStats>, key: string, tx: PixTransaction) {
    const cur = map.get(key) ?? { paidCount: 0, totalPaid: 0, lastPaidAt: null, lastPlanName: "" }
    cur.paidCount += 1
    cur.totalPaid += (Number(tx.amount) || 0) / 100
    const when = tx.paid_at ?? tx.created_at
    if (!cur.lastPaidAt || (when && when > cur.lastPaidAt)) {
      cur.lastPaidAt = when
      cur.lastPlanName = tx.plan_name || cur.lastPlanName
    }
    map.set(key, cur)
  }

  for (const tx of txs) {
    if (tx.status !== "paid") continue
    if (tx.user_id) bump(byUserId, tx.user_id, tx)
    if (tx.buyer_email) bump(byEmail, tx.buyer_email.toLowerCase(), tx)
  }

  return {
    get(u: Pick<AppUser, "id" | "email">): UserPaymentStats | null {
      return byUserId.get(u.id) ?? byEmail.get(u.email.toLowerCase()) ?? null
    },
  }
}

// Registra o ultimo acesso do usuario (best-effort: ignora erro caso a
// coluna last_login_at ainda nao exista no banco).
export async function touchLastLogin(userId: string) {
  try {
    await supabase
      .from("app_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", userId)
  } catch {
    // silencioso de proposito
  }
}

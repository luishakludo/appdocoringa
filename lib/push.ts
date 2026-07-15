import webpush from "web-push"
import { supabase } from "@/lib/supabase"

// ============================================================
// Envio de Web Push (server-side). Usado pelo motor da IA para
// notificar o usuario a cada WIN, mesmo com o app FECHADO.
//
// As chaves VAPID vem das variaveis de ambiente:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  (publica; tambem usada no client)
//   VAPID_PRIVATE_KEY             (privada; SO no servidor)
//   VAPID_SUBJECT                 (mailto: ou url; opcional)
// ============================================================

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ""
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:suporte@appdocoringa.com"

let configured = false
function ensureConfigured(): boolean {
  if (configured) return true
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    console.log("[v0] push desativado: VAPID keys ausentes (defina NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY)")
    return false
  }
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY)
  configured = true
  return true
}

export const pushEnabled = () => Boolean(PUBLIC_KEY && PRIVATE_KEY)

type StoredSub = { endpoint: string; p256dh: string; auth: string }

// Envia um push para TODAS as inscricoes de um usuario. Inscricoes invalidas
// (410/404) sao removidas do banco automaticamente.
export async function sendPushToUser(
  atlaxUserId: number,
  payload: { title: string; body: string; tag?: string; url?: string },
): Promise<void> {
  if (!ensureConfigured()) return

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("atlax_user_id", atlaxUserId)

  const list = (subs ?? []) as StoredSub[]
  if (list.length === 0) return

  const body = JSON.stringify(payload)
  const stale: string[] = []

  await Promise.all(
    list.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        )
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          stale.push(s.endpoint)
        } else {
          console.log(`[v0] push falhou (${status ?? "?"}) para ${s.endpoint.slice(0, 40)}...`)
        }
      }
    }),
  )

  if (stale.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", stale)
    console.log(`[v0] push: removidas ${stale.length} inscricao(oes) expirada(s)`)
  }
}

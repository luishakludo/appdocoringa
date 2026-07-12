-- ============================================================
-- CORINGA · Colunas de ACESSO VIP
-- ------------------------------------------------------------
-- Para liberar a IA o usuario precisa ser VIP (ter um plano ativo).
-- O VIP tem um numero de dias: a contagem regressiva e calculada a
-- partir de `vip_expires_at` (nao precisa de rotina diaria — "faltam X
-- dias" cai sozinho a cada dia, ate expirar).
--
-- Este script:
--   1) Adiciona as colunas de VIP na tabela app_users.
--   2) Adiciona `duration_days` na tabela plans (dias de acesso por plano).
--
-- Rode este script UMA VEZ no SQL Editor do Supabase.
-- ============================================================

-- 1) Colunas de VIP no usuario
alter table public.app_users
  add column if not exists is_vip         boolean     not null default false,
  add column if not exists vip_plan_id    uuid,
  add column if not exists vip_plan_name  text        not null default '',
  add column if not exists vip_days       integer     not null default 0,
  add column if not exists vip_started_at timestamptz,
  add column if not exists vip_expires_at timestamptz;

create index if not exists app_users_is_vip_idx on public.app_users(is_vip);
create index if not exists app_users_vip_expires_idx on public.app_users(vip_expires_at);

-- 2) Dias de acesso liberados por cada plano (0 = vitalicio / sem expiracao)
alter table public.plans
  add column if not exists duration_days integer not null default 0;

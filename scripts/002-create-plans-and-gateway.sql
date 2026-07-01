-- ============================================================
-- CORINGA · Planos por admin + chaves do gateway
-- Cada admin cria os proprios planos. Apenas os usuarios da base
-- dele (admin_id) enxergam esses planos.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- CHAVES DO GATEWAY (por admin) ----------
-- A secret key fica por conta de cada admin (cada um conecta o
-- proprio gateway). Guardada como texto, igual ao resto do app.
alter table public.admins
  add column if not exists gateway_secret_key text default '',
  add column if not exists gateway_public_key text default '';

-- ---------- PLANOS ----------
create table if not exists public.plans (
  id              uuid primary key default gen_random_uuid(),
  admin_id        uuid not null references public.admins(id) on delete cascade,
  name            text not null,
  -- periodo de cobranca
  period          text not null default 'mensal'
                    check (period in ('diario','semanal','mensal','trimestral','semestral','anual','vitalicio')),
  -- preco da PRIMEIRA cobranca (promocional / com desconto)
  first_price     numeric(10,2) not null default 0,
  -- preco das cobrancas seguintes (recorrente). Para vitalicio = 0.
  recurring_price numeric(10,2) not null default 0,
  currency        text not null default 'BRL',
  -- lista de beneficios (array de texto)
  features        jsonb not null default '[]'::jsonb,
  -- tag chamativa, ex: "Economize 25%"
  badge           text default '',
  -- destaca como "mais popular"
  is_popular      boolean not null default false,
  -- plano ativo/visivel para os usuarios
  is_active       boolean not null default true,
  -- ordem de exibicao
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists plans_admin_id_idx on public.plans(admin_id);

-- ---------- RLS ----------
alter table public.plans enable row level security;

drop policy if exists "anon full access plans" on public.plans;
create policy "anon full access plans" on public.plans
  for all using (true) with check (true);

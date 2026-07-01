-- ============================================================
-- CORINGA · Transacoes PIX (Buck Pay)
-- Cada cobranca gerada por um usuario fica registrada aqui.
-- O webhook da Buck Pay atualiza o status para 'paid'.
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.pix_transactions (
  id            uuid primary key default gen_random_uuid(),
  -- id unico enviado para a Buck Pay (pix-XXXX)
  external_id   text not null unique,
  -- id retornado pela Buck Pay
  provider_id   text default '',
  -- dono / base (admin) e usuario que gerou
  admin_id      uuid references public.admins(id) on delete set null,
  user_id       uuid references public.app_users(id) on delete set null,
  plan_id       uuid references public.plans(id) on delete set null,
  -- dados de exibicao
  plan_name     text default '',
  buyer_name    text default '',
  buyer_email   text default '',
  -- valor em centavos
  amount        integer not null default 0,
  -- pending | paid | failed | expired
  status        text not null default 'pending'
                  check (status in ('pending','paid','failed','expired')),
  -- codigo copia e cola + qrcode base64
  pix_code      text default '',
  qrcode_base64 text default '',
  created_at    timestamptz not null default now(),
  paid_at       timestamptz
);

create index if not exists pix_tx_external_id_idx on public.pix_transactions(external_id);
create index if not exists pix_tx_admin_id_idx on public.pix_transactions(admin_id);
create index if not exists pix_tx_user_id_idx on public.pix_transactions(user_id);

alter table public.pix_transactions enable row level security;

drop policy if exists "anon full access pix" on public.pix_transactions;
create policy "anon full access pix" on public.pix_transactions
  for all using (true) with check (true);

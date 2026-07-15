-- ============================================================
-- Notificacoes PUSH de win (funcionam com o app FECHADO).
-- Guarda as inscricoes Web Push de cada usuario. O servidor
-- (settle da IA) envia um push para todas as inscricoes do
-- atlax_user_id sempre que uma operacao da IA da GREEN.
--
-- Rode este SQL no SQL Editor do Supabase (uma unica vez).
-- ============================================================

create table if not exists public.push_subscriptions (
  id             bigint generated always as identity primary key,
  atlax_user_id  bigint not null,
  endpoint       text   not null unique,
  p256dh         text   not null,
  auth           text   not null,
  user_agent     text,
  created_at     timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (atlax_user_id);

-- RLS: mesmo padrao das tabelas da IA. O acesso real e feito pelo
-- SERVIDOR (rotas /api/atlax/push/*) com a chave anon; a protecao
-- acontece na camada de aplicacao (token + atlax_user_id).
alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_anon_all" on public.push_subscriptions;

create policy "push_subscriptions_anon_all"
  on public.push_subscriptions
  for all
  to anon, authenticated
  using (true)
  with check (true);

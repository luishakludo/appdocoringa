-- ============================================================
-- CORINGA · Painel ADM
-- Tabelas para o painel administrativo multi-adm.
--
-- IMPORTANTE (seguranca): para atender o requisito de "ver a senha"
-- as senhas sao guardadas em TEXTO PURO. Isso e inseguro por natureza
-- e so foi feito porque o app ja usa esse modelo (chave anon fixa).
-- Nao use isso para dados sensiveis reais.
-- ============================================================

-- Extensao para gerar UUIDs
create extension if not exists "pgcrypto";

-- ---------- ADMINS ----------
create table if not exists public.admins (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null unique,
  password      text not null,
  role          text not null default 'admin' check (role in ('supreme', 'admin')),
  status        text not null default 'active' check (status in ('active', 'banned')),
  whatsapp_link text default '',
  support_email text default '',
  referral_code text not null unique,
  created_at    timestamptz not null default now()
);

-- ---------- APP USERS (assinantes de cada adm) ----------
create table if not exists public.app_users (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references public.admins(id) on delete cascade,
  name       text not null,
  email      text not null,
  password   text default '',
  phone      text default '',
  status     text not null default 'active' check (status in ('active', 'banned')),
  source     text not null default 'manual' check (source in ('manual', 'referral')),
  created_at timestamptz not null default now()
);

create index if not exists app_users_admin_id_idx on public.app_users(admin_id);

-- ---------- SUPPORT TICKETS ----------
create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.admins(id) on delete cascade,
  user_name   text not null default '',
  user_email  text not null default '',
  message     text not null,
  response    text default '',
  status      text not null default 'open' check (status in ('open', 'answered')),
  created_at  timestamptz not null default now(),
  answered_at timestamptz
);

create index if not exists support_tickets_admin_id_idx on public.support_tickets(admin_id);

-- ---------- RLS ----------
-- Politicas permissivas para a anon key conseguir ler/escrever.
-- (O controle de acesso real e feito na aplicacao.)
alter table public.admins         enable row level security;
alter table public.app_users      enable row level security;
alter table public.support_tickets enable row level security;

drop policy if exists "anon full access admins" on public.admins;
create policy "anon full access admins" on public.admins
  for all using (true) with check (true);

drop policy if exists "anon full access app_users" on public.app_users;
create policy "anon full access app_users" on public.app_users
  for all using (true) with check (true);

drop policy if exists "anon full access support_tickets" on public.support_tickets;
create policy "anon full access support_tickets" on public.support_tickets
  for all using (true) with check (true);

-- ---------- SEED: ADM SUPREMO ----------
-- Troque o email e a senha depois do primeiro acesso.
insert into public.admins (name, email, password, role, status, referral_code)
values ('Adm Supremo', 'supremo@coringa.ai', 'coringa2025', 'supreme', 'active', 'SUPREMO')
on conflict (email) do nothing;

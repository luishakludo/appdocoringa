-- ============================================================
-- CORINGA · Colunas dedicadas para CONTA DEMO
-- ------------------------------------------------------------
-- Antes os metadados da conta demo (saldo + rtp) eram guardados como JSON
-- dentro do campo `phone` da tabela app_users. Isso poluia o telefone real
-- dos usuarios Atlax. Agora a conta demo tem colunas proprias.
--
-- Este script:
--   1) Cria as colunas is_demo / demo_balance / demo_rtp.
--   2) Migra as contas demo antigas (JSON no phone) para as novas colunas.
--   3) Limpa o campo phone dessas contas migradas.
--
-- Rode este script UMA VEZ no SQL Editor do Supabase.
-- ============================================================

-- 1) Novas colunas dedicadas a conta demo
alter table public.app_users
  add column if not exists is_demo      boolean       not null default false,
  add column if not exists demo_balance numeric(14,2) not null default 0,
  add column if not exists demo_rtp     integer       not null default 0;

create index if not exists app_users_is_demo_idx on public.app_users(is_demo);

-- 2) Migra contas demo antigas (que guardavam {"d":1,"bal":...,"rtp":...} no phone)
update public.app_users
set
  is_demo      = true,
  demo_balance = coalesce((phone::jsonb ->> 'bal')::numeric, 0),
  demo_rtp     = least(100, greatest(0, coalesce((phone::jsonb ->> 'rtp')::int, 0))),
  phone        = ''
where phone is not null
  and phone <> ''
  and phone ~ '^\s*\{'                       -- parece JSON
  and (phone::jsonb ->> 'd') = '1';          -- marcador de conta demo antigo

-- 3) Garante que o RTP fique sempre no intervalo valido
alter table public.app_users
  add constraint app_users_demo_rtp_range check (demo_rtp >= 0 and demo_rtp <= 100)
  not valid;

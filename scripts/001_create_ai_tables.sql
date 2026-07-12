-- ============================================================
-- Tabelas do motor da IA no servidor.
-- Rode este SQL no SQL Editor do Supabase (uma unica vez).
-- ============================================================

-- Sessao ativa da IA por usuario da corretora (Atlax).
-- Guarda o "estado do cerebro" da IA para que ela continue operando
-- no servidor mesmo com o app fechado / pagina recarregada.
create table if not exists public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  atlax_user_id bigint not null,
  atlax_token text not null,

  status text not null default 'running', -- 'running' | 'finished'
  finish_reason text,                      -- 'win' | 'loss' | 'manual' | 'error'

  -- configuracao escolhida pelo usuario
  config jsonb not null default '{}'::jsonb, -- { amount, expiration, stopWin, stopLoss, stopWinPct, stopLossPct, reentries }

  start_balance numeric not null default 0,
  session_pnl numeric not null default 0,

  -- estado da operacao atual
  phase text not null default 'placing',   -- 'placing' | 'running' | 'between' | 'finished'
  balance_before numeric not null default 0,
  current_symbol text,
  current_direction int,
  current_amount numeric not null default 0,
  active_tx_id bigint,
  active_op_id uuid,
  trade_ends_at timestamptz,

  -- controle de reentrada (gale)
  reentry_count int not null default 0,
  pending_reentry jsonb,                    -- { symbol, direction, amount } | null

  fail_streak int not null default 0,
  last_error text,

  -- trava simples para evitar dois ticks processando ao mesmo tempo
  tick_lock timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Apenas UMA sessao ativa por usuario.
create unique index if not exists ai_sessions_one_active
  on public.ai_sessions (atlax_user_id)
  where status = 'running';

create index if not exists ai_sessions_status_idx on public.ai_sessions (status);

-- Historico de operacoes (persistente no banco).
create table if not exists public.ai_operations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.ai_sessions (id) on delete set null,
  atlax_user_id bigint not null,

  transaction_id bigint,
  symbol text not null,
  direction int not null,        -- 0 = abaixo, 1 = acima
  expiration int not null,       -- em minutos
  amount numeric not null,       -- em reais
  status text not null default 'success',
  result text not null default 'pending', -- 'green' | 'loss' | 'pending'
  profit numeric not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists ai_operations_user_idx
  on public.ai_operations (atlax_user_id, created_at desc);

create index if not exists ai_operations_session_idx
  on public.ai_operations (session_id);

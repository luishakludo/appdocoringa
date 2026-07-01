-- ============================================================
-- CORRIGE o erro: "new row violates row-level security policy
-- for table ai_sessions" ao iniciar a IA.
--
-- As tabelas do motor da IA sao acessadas pelo SERVIDOR (rotas
-- /api/atlax/ai/*) usando a chave anon. O RLS estava ativo sem
-- nenhuma policy, entao todo INSERT/UPDATE/SELECT era bloqueado.
--
-- Rode este SQL no SQL Editor do Supabase (uma unica vez).
-- ============================================================

-- Garante que o RLS esteja habilitado (idempotente).
alter table public.ai_sessions   enable row level security;
alter table public.ai_operations enable row level security;

-- Remove policies antigas com o mesmo nome (idempotente).
drop policy if exists "ai_sessions_anon_all"   on public.ai_sessions;
drop policy if exists "ai_operations_anon_all" on public.ai_operations;

-- Permite leitura/escrita pelo papel anon (usado pelo servidor).
-- A protecao real acontece na camada de aplicacao (token + atlax_user_id).
create policy "ai_sessions_anon_all"
  on public.ai_sessions
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "ai_operations_anon_all"
  on public.ai_operations
  for all
  to anon, authenticated
  using (true)
  with check (true);

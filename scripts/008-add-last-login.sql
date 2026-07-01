-- ============================================================
-- CORINGA · Coluna de ULTIMO LOGIN para app_users
-- ------------------------------------------------------------
-- Guarda o momento do ultimo acesso do usuario ao app. E usada
-- no painel ADM (cards de usuario) para mostrar "Ultimo login".
--
-- O codigo atualiza este campo de forma best-effort: se a coluna
-- nao existir, o login continua funcionando normalmente. Rode este
-- script UMA VEZ no SQL Editor do Supabase para ativar o recurso.
-- ============================================================

alter table public.app_users
  add column if not exists last_login_at timestamptz;

create index if not exists app_users_last_login_idx on public.app_users(last_login_at);

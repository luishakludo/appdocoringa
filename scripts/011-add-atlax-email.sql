-- ============================================================
-- CORINGA · Coluna de E-MAIL REAL da Atlax para app_users
-- ------------------------------------------------------------
-- A coluna `email` de app_users guarda o USUARIO (login) da Atlax,
-- que e a chave de identificacao do usuario no app. Este script
-- adiciona uma coluna separada `atlax_email` para guardar o E-MAIL
-- REAL retornado pela Atlax no momento do login, sem mexer no login.
--
-- O codigo grava este campo de forma best-effort: se a coluna nao
-- existir, o login continua funcionando normalmente. Rode este
-- script UMA VEZ no SQL Editor do Supabase para ativar o recurso.
-- ============================================================

alter table public.app_users
  add column if not exists atlax_email text default '';

create index if not exists app_users_atlax_email_idx on public.app_users(atlax_email);

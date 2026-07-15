-- ============================================================
-- CORINGA · Email real do usuario
-- ------------------------------------------------------------
-- O campo `app_users.email` guarda o LOGIN da Atlax (usuario), usado como
-- chave de vinculo de base. Ele NAO e um email de verdade.
--
-- Esta coluna guarda o email REAL informado pelo usuario no login, para ser
-- usado no checkout (Buck Pay/PIX) e ficar visivel no painel do adm.
-- ============================================================

alter table public.app_users
  add column if not exists contact_email text not null default '';

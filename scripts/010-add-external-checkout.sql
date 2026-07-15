-- ============================================================
-- CORINGA · Checkout externo (link proprio) por admin/plano
-- ------------------------------------------------------------
-- Antes o redirecionamento para o checkout externo (Cakto) era FIXO no codigo
-- e amarrado a conta coringa@gmail.com. Agora cada admin escolhe no painel:
--   - checkout_mode = 'buckpay'  -> gera PIX pela Buck Pay (padrao)
--   - checkout_mode = 'external' -> NAO gera PIX; redireciona o comprador
--                                   para o link configurado em cada plano.
-- E cada plano guarda o seu proprio link de checkout externo.
-- ============================================================

-- Modo de checkout do admin: 'buckpay' (PIX) ou 'external' (link proprio).
alter table admins
  add column if not exists checkout_mode text not null default 'buckpay';

-- Link de checkout externo por plano (usado quando checkout_mode = 'external').
alter table plans
  add column if not exists checkout_url text not null default '';

-- Migra a conta coringa@gmail.com para o novo modo, preservando o link antigo.
update admins
  set checkout_mode = 'external'
  where lower(email) = 'coringa@gmail.com';

update plans p
  set checkout_url = 'https://pay.cakto.com.br/o4kdzy3'
  from admins a
  where p.admin_id = a.id
    and lower(a.email) = 'coringa@gmail.com'
    and coalesce(p.checkout_url, '') = '';

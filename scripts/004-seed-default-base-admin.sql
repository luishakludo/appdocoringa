-- ============================================================
-- CORINGA · Adm padrao (Base Geral)
--
-- Todo usuario que loga sem link de indicacao e sem cadastro
-- previo cai automaticamente na base deste adm.
--
-- O app tambem cria este adm automaticamente no primeiro login
-- caso ele ainda nao exista (ver ensureDefaultBaseAdminId em lib/adm.ts),
-- mas este script garante as credenciais de acesso ao painel.
-- ============================================================

insert into public.admins (name, email, password, role, status, referral_code)
values ('Base Geral', 'jhon@gmail.com', '121212', 'admin', 'active', 'BASEGERAL')
on conflict (email) do nothing;

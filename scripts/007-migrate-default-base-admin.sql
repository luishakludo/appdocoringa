-- ============================================================
-- CORINGA · Troca do adm padrao (Base Geral)
--
-- Objetivo:
--   - Tornar jhon@gmail.com o adm padrao (recebe todo usuario que
--     entra sem link de indicacao).
--   - Mover TUDO que pertencia ao antigo adm padrao (hakla02@gmail.com)
--     para o jhon@gmail.com.
--   - Apagar o hakla02@gmail.com.
--
-- Rode este script UMA vez no SQL Editor do Supabase.
-- E seguro rodar novamente: se o hakla02 ja nao existir, nada acontece.
-- ============================================================

do $$
declare
  old_id uuid;
  new_id uuid;
begin
  -- 1) Garante que o novo adm padrao (jhon) exista.
  select id into new_id from public.admins where email = 'jhon@gmail.com';
  if new_id is null then
    insert into public.admins (name, email, password, role, status, referral_code)
    values ('Base Geral', 'jhon@gmail.com', '121212', 'admin', 'active', 'BASEGERAL')
    returning id into new_id;
  end if;

  -- 2) Localiza o antigo adm padrao (hakla02).
  select id into old_id from public.admins where email = 'hakla02@gmail.com';

  -- Se o antigo nao existir, nao ha nada para migrar.
  if old_id is null then
    raise notice 'hakla02@gmail.com nao encontrado - nada a migrar.';
    return;
  end if;

  -- 3) Move todos os vinculos do antigo adm para o novo.
  update public.app_users       set admin_id = new_id where admin_id = old_id;
  update public.support_tickets set admin_id = new_id where admin_id = old_id;
  update public.plans           set admin_id = new_id where admin_id = old_id;
  update public.pix_transactions set admin_id = new_id where admin_id = old_id;

  -- 4) Apaga o antigo adm padrao.
  delete from public.admins where id = old_id;

  raise notice 'Migracao concluida: hakla02 -> jhon (%).', new_id;
end $$;

-- =============================================================
-- MIGRAÇÃO 002 — Administrador master + categorias Sênior/Consultor
-- -------------------------------------------------------------
-- Para quem JÁ TEM o banco rodando com dados. Não apaga nada:
--   • só ACRESCENTA a coluna "categoria" em membros (todos começam como 'demolay');
--   • AMPLIA os perfis permitidos para incluir 'master';
--   • SUBSTITUI funções e políticas (create or replace / drop + create).
--
-- Está dentro de uma TRANSAÇÃO (begin … commit): se qualquer linha der
-- erro, o Postgres desfaz tudo e o banco fica exatamente como estava.
-- Pode rodar mais de uma vez sem problema (é "idempotente").
--
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run.
-- Instalação nova: rode primeiro o schema.sql e depois este arquivo.
-- =============================================================

begin;

-- -------------------------------------------------------------
-- 1. Três níveis de acesso
--    master  → tudo do admin + gerencia acessos e senhas
--    admin   → altera dados (presença, caixa, mensalidades, calendário, membros)
--    membro  → só visualiza
-- -------------------------------------------------------------
-- A regra antiga (check role in ('admin','membro')) foi criada sem nome
-- explícito; o Postgres a batizou de "profiles_role_check".
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('master', 'admin', 'membro'));

-- -------------------------------------------------------------
-- 2. Categoria do membro
--    demolay   → membro ativo do capítulo (entra no quórum e paga mensalidade)
--    senior    → Sênior DeMolay
--    consultor → Consultor do capítulo (tio)
-- -------------------------------------------------------------
alter table public.membros add column if not exists categoria text not null default 'demolay';
alter table public.membros drop constraint if exists membros_categoria_check;
alter table public.membros add constraint membros_categoria_check
  check (categoria in ('demolay', 'senior', 'consultor'));

-- -------------------------------------------------------------
-- 3. Funções de permissão
-- -------------------------------------------------------------
-- is_admin continua sendo usada por TODAS as políticas de escrita.
-- Agora o master também conta como admin (pode tudo que o admin pode).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin', 'master'));
$$;

create or replace function public.is_master()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'master');
$$;

-- Gerir acessos: só master (ou o dono do banco no SQL Editor, onde auth.uid() é nulo)
create or replace function public.pode_gerir_acessos()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null or public.is_master();
$$;

-- -------------------------------------------------------------
-- 4. Criar acesso: master cria 'admin' ou 'membro'.
--    Criar outro 'master' só pelo SQL Editor (proteção extra).
-- -------------------------------------------------------------
create or replace function public.admin_criar_usuario(
  p_login text, p_senha text, p_nome text,
  p_role text default 'membro', p_membro_id bigint default null)
returns uuid language plpgsql security definer
set search_path = public, extensions, auth as $$
declare
  v_dominio text := 'crateus.app';            -- igual a LOGIN_DOMINIO do js/config.js
  v_login   text := lower(trim(p_login));
  v_email   text;
  v_id      uuid := gen_random_uuid();
begin
  if not public.pode_gerir_acessos() then
    raise exception 'Permissão negada: apenas o administrador master pode criar acessos.';
  end if;
  if v_login !~ '^[a-z0-9._-]{3,40}$' then
    raise exception 'ID inválido: use de 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado.';
  end if;
  if length(coalesce(p_senha, '')) < 6 then
    raise exception 'A senha precisa ter pelo menos 6 caracteres.';
  end if;
  if p_role not in ('master', 'admin', 'membro') then
    raise exception 'Perfil inválido.';
  end if;
  if p_role = 'master' and auth.uid() is not null then
    raise exception 'Um novo master só pode ser criado pelo SQL Editor do Supabase.';
  end if;

  v_email := v_login || '@' || v_dominio;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Já existe um acesso com esse ID.';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, crypt(p_senha, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('nome', p_nome),
    now(), now(), '', '', '', '');

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now());

  insert into public.profiles (id, nome, role, login, membro_id)
  values (v_id, p_nome, p_role, v_login, p_membro_id)
  on conflict (id) do update
    set nome = excluded.nome, role = excluded.role,
        login = excluded.login, membro_id = excluded.membro_id;

  return v_id;
end $$;

create or replace function public.admin_redefinir_senha(p_user uuid, p_senha text)
returns void language plpgsql security definer
set search_path = public, extensions, auth as $$
begin
  if not public.pode_gerir_acessos() then
    raise exception 'Permissão negada: apenas o administrador master pode redefinir senhas.';
  end if;
  if length(coalesce(p_senha, '')) < 6 then
    raise exception 'A senha precisa ter pelo menos 6 caracteres.';
  end if;
  update auth.users set encrypted_password = crypt(p_senha, gen_salt('bf')), updated_at = now()
  where id = p_user;
end $$;

create or replace function public.admin_excluir_usuario(p_user uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.pode_gerir_acessos() then
    raise exception 'Permissão negada: apenas o administrador master pode excluir acessos.';
  end if;
  if p_user = auth.uid() then
    raise exception 'Você não pode excluir o seu próprio acesso.';
  end if;
  if auth.uid() is not null and exists (select 1 from public.profiles where id = p_user and role = 'master') then
    raise exception 'Um acesso master só pode ser excluído pelo SQL Editor.';
  end if;
  delete from auth.users where id = p_user;
end $$;

-- -------------------------------------------------------------
-- 5. Quem pode ver/alterar a tabela de perfis
-- -------------------------------------------------------------
drop policy if exists "perfil_proprio" on public.profiles;
drop policy if exists "perfil_admin"   on public.profiles;
drop policy if exists "perfil_master"  on public.profiles;
create policy "perfil_proprio" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_master());
create policy "perfil_master" on public.profiles for update to authenticated
  using (public.is_master()) with check (public.is_master());

-- O perfil 'master' nunca muda pelo site: nem promover alguém a master,
-- nem rebaixar um master (inclusive a si mesmo). Só pelo SQL Editor.
create or replace function public.protege_proprio_admin()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and (old.role = 'master' or new.role = 'master')
     and old.role is distinct from new.role then
    raise exception 'O perfil master só pode ser alterado pelo SQL Editor do Supabase.';
  end if;
  return new;
end $$;
-- (o gatilho trg_protege_proprio_admin já existe e passa a usar esta nova versão)

revoke all on function public.is_master() from public, anon;
grant execute on function public.is_master() to authenticated;

-- -------------------------------------------------------------
-- 6. Promove o PRIMEIRO master automaticamente
--    Se ainda não existe nenhum master, o administrador mais antigo
--    (o que você criou no SQL Editor na instalação) vira master.
-- -------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.profiles where role = 'master') then
    update public.profiles set role = 'master'
    where id = (select p.id from public.profiles p
                join auth.users u on u.id = p.id
                where p.role = 'admin'
                order by u.created_at
                limit 1);
  end if;
end $$;

commit;

-- -------------------------------------------------------------
-- Confira o resultado (rode separado, depois do commit):
--
--   select login, nome, role from public.profiles order by role, nome;
--
-- Se o master ficou com a pessoa errada, corrija (troque os IDs):
--
--   update public.profiles set role = 'admin'  where login = 'id_errado';
--   update public.profiles set role = 'master' where login = 'seu_id';
-- -------------------------------------------------------------

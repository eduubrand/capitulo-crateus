-- =============================================================
-- Capítulo Crateús — esquema do banco (Supabase / PostgreSQL)
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar mais de uma vez sem quebrar (usa IF NOT EXISTS / OR REPLACE).
--
-- ⚠️ Esta é a VERSÃO 1 do banco. Depois dela, rode em ordem os arquivos da
-- pasta supabase/migracoes/ (002_..., 003_...). Cada migração evolui o banco
-- sem apagar dados. Banco já em uso? Rode SÓ as migrações que faltam.
-- =============================================================

-- ---------- 1. TABELAS ----------------------------------------

-- Perfil de cada usuário que faz login (ligado ao auth.users do Supabase)
create table if not exists public.profiles (
  id    uuid primary key references auth.users(id) on delete cascade,
  nome  text not null default '',
  role  text not null default 'membro' check (role in ('admin', 'membro'))
);

-- Quadro de membros do capítulo (não precisam ter login)
create table if not exists public.membros (
  id         bigint generated always as identity primary key,
  nome       text not null,
  cargo      text not null default 'Membro',
  ativo      boolean not null default true,
  ordem      int not null default 100,
  created_at timestamptz not null default now()
);

-- Calendário: sessões, reuniões, cerimônias, eventos
create table if not exists public.eventos (
  id        bigint generated always as identity primary key,
  titulo    text not null,
  tipo      text not null default 'sessao'
            check (tipo in ('sessao', 'reuniao', 'cerimonia', 'evento', 'outro')),
  data      date not null,
  hora      time,
  local     text default '',
  descricao text default ''
);

-- Presença: uma linha por (evento, membro)
create table if not exists public.presencas (
  evento_id bigint not null references public.eventos(id) on delete cascade,
  membro_id bigint not null references public.membros(id) on delete cascade,
  status    char(1) not null check (status in ('P', 'F', 'J')),
  primary key (evento_id, membro_id)
);

-- Livro de caixa
create table if not exists public.lancamentos (
  id         bigint generated always as identity primary key,
  data       date not null default current_date,
  descricao  text not null,
  categoria  text not null default 'Outros',
  tipo       text not null check (tipo in ('entrada', 'saida')),
  valor      numeric(10,2) not null check (valor > 0),
  criado_por text default '',
  created_at timestamptz not null default now()
);

-- Mensalidades pagas: uma linha = um mês pago por um membro
create table if not exists public.mensalidades (
  membro_id     bigint not null references public.membros(id) on delete cascade,
  competencia   text not null check (competencia ~ '^\d{4}-\d{2}$'),  -- 'AAAA-MM'
  valor         numeric(10,2) not null default 20,
  pago_em       date not null default current_date,
  lancamento_id bigint references public.lancamentos(id) on delete set null,
  primary key (membro_id, competencia)
);

-- Configurações simples (chave/valor). Ex.: valor_mensalidade = 20
create table if not exists public.config (
  chave text primary key,
  valor text not null
);
insert into public.config (chave, valor) values ('valor_mensalidade', '20')
on conflict (chave) do nothing;

create index if not exists idx_eventos_data      on public.eventos (data);
create index if not exists idx_lancamentos_data  on public.lancamentos (data);
create index if not exists idx_presencas_membro  on public.presencas (membro_id);

-- ---------- 2. FUNÇÕES E GATILHOS -----------------------------

-- Diz se o usuário logado é administrador.
-- SECURITY DEFINER: roda com permissão do dono, evitando recursão nas políticas.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Cria o perfil automaticamente quando um usuário é cadastrado no Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quando uma mensalidade é marcada como paga, lança a entrada no caixa.
create or replace function public.mensalidade_lanca_caixa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_id   bigint;
  meses  text[] := array['janeiro','fevereiro','março','abril','maio','junho','julho',
                         'agosto','setembro','outubro','novembro','dezembro'];
begin
  select nome into v_nome from public.membros where id = new.membro_id;
  insert into public.lancamentos (data, descricao, categoria, tipo, valor, criado_por)
  values (new.pago_em,
          'Mensalidade de ' || meses[split_part(new.competencia, '-', 2)::int]
            || '/' || split_part(new.competencia, '-', 1) || ' — ' || v_nome,
          'Mensalidades', 'entrada', new.valor,
          coalesce((select nome from public.profiles where id = auth.uid()), 'Sistema'))
  returning id into v_id;
  new.lancamento_id := v_id;
  return new;
end $$;

drop trigger if exists trg_mensalidade_insert on public.mensalidades;
create trigger trg_mensalidade_insert
  before insert on public.mensalidades
  for each row execute function public.mensalidade_lanca_caixa();

-- Quando o pagamento é desmarcado, remove a entrada do caixa.
create or replace function public.mensalidade_estorna_caixa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.lancamento_id is not null then
    delete from public.lancamentos where id = old.lancamento_id;
  end if;
  return old;
end $$;

drop trigger if exists trg_mensalidade_delete on public.mensalidades;
create trigger trg_mensalidade_delete
  after delete on public.mensalidades
  for each row execute function public.mensalidade_estorna_caixa();

-- ---------- 3. SEGURANÇA (Row Level Security) -----------------
-- Regra geral: qualquer usuário LOGADO pode ler; só ADMIN pode escrever.

alter table public.profiles     enable row level security;
alter table public.membros      enable row level security;
alter table public.eventos      enable row level security;
alter table public.presencas    enable row level security;
alter table public.lancamentos  enable row level security;
alter table public.mensalidades enable row level security;
alter table public.config       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['membros','eventos','presencas','lancamentos','mensalidades','config'] loop
    execute format('drop policy if exists "leitura_logados" on public.%I', t);
    execute format('drop policy if exists "escrita_admin"   on public.%I', t);
    execute format('create policy "leitura_logados" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "escrita_admin" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- profiles: cada um lê o próprio perfil; admin lê e altera todos.
drop policy if exists "perfil_proprio" on public.profiles;
drop policy if exists "perfil_admin"   on public.profiles;
create policy "perfil_proprio" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "perfil_admin" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- 4. LOGIN POR ID + GESTÃO DE ACESSOS PELO ADMIN ----
-- O membro entra com um ID (ex.: "arthur.lima") e senha. O Supabase Auth
-- exige e-mail, então guardamos "id@crateus.app" (ninguém recebe e-mail lá).
-- Criar usuário / trocar senha de outra pessoa mexe na tabela auth.users,
-- que o navegador não pode tocar. Por isso usamos funções SECURITY DEFINER
-- que só executam se quem chamou for administrador.

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles add column if not exists login text unique;
alter table public.profiles add column if not exists membro_id bigint
  references public.membros(id) on delete set null;

-- Quem pode administrar acessos: um admin logado, ou o dono do banco
-- rodando direto no SQL Editor (auth.uid() é nulo lá) — usado para criar
-- o PRIMEIRO admin. Visitantes anônimos não podem nem chamar (revoke abaixo).
create or replace function public.pode_gerir_acessos()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null or public.is_admin();
$$;

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
    raise exception 'Permissão negada: apenas administradores podem criar acessos.';
  end if;
  if v_login !~ '^[a-z0-9._-]{3,40}$' then
    raise exception 'ID inválido: use de 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado.';
  end if;
  if length(coalesce(p_senha, '')) < 6 then
    raise exception 'A senha precisa ter pelo menos 6 caracteres.';
  end if;
  if p_role not in ('admin', 'membro') then
    raise exception 'Perfil inválido.';
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

  -- o gatilho on_auth_user_created já criou o perfil; completamos os dados
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
    raise exception 'Permissão negada: apenas administradores podem redefinir senhas.';
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
    raise exception 'Permissão negada: apenas administradores podem excluir acessos.';
  end if;
  if p_user = auth.uid() then
    raise exception 'Você não pode excluir o seu próprio acesso.';
  end if;
  delete from auth.users where id = p_user;   -- profiles e identities caem junto (cascade)
end $$;

-- Impede o admin de rebaixar a si mesmo (evita ficar sem nenhum admin)
create or replace function public.protege_proprio_admin()
returns trigger language plpgsql as $$
begin
  if old.id = auth.uid() and old.role = 'admin' and new.role <> 'admin' then
    raise exception 'Você não pode remover o seu próprio perfil de administrador.';
  end if;
  return new;
end $$;
drop trigger if exists trg_protege_proprio_admin on public.profiles;
create trigger trg_protege_proprio_admin
  before update on public.profiles
  for each row execute function public.protege_proprio_admin();

-- Só usuários logados podem chamar as funções (e elas conferem se é admin)
revoke all on function public.admin_criar_usuario(text, text, text, text, bigint) from public, anon;
revoke all on function public.admin_redefinir_senha(uuid, text) from public, anon;
revoke all on function public.admin_excluir_usuario(uuid) from public, anon;
revoke all on function public.pode_gerir_acessos() from public, anon;
grant execute on function public.admin_criar_usuario(text, text, text, text, bigint) to authenticated;
grant execute on function public.admin_redefinir_senha(uuid, text) to authenticated;
grant execute on function public.admin_excluir_usuario(uuid) to authenticated;
grant execute on function public.pode_gerir_acessos() to authenticated;

-- ---------- 5. PRIMEIRO ADMINISTRADOR -------------------------
-- Rode UMA vez no SQL Editor, trocando ID, senha e nome:
--
--   select public.admin_criar_usuario('admin', 'TroqueEstaSenha123', 'Seu Nome', 'admin');
--
-- Depois entre no site com esse ID e senha e cadastre os demais
-- na aba "Administração".

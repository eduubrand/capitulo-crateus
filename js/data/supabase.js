// =============================================================
// Banco REAL: Supabase (PostgreSQL + autenticação).
// Expõe exatamente as mesmas funções do local.js, então as páginas
// não precisam saber qual banco está sendo usado.
// =============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { CONFIG } from '../config.js';

// Aceita a URL mesmo se colada com "/rest/v1/" ou barra no final
// (o cliente monta esses caminhos sozinho; duplicá-los gera
// "Invalid path specified in request URL").
const URL_PROJETO = CONFIG.SUPABASE_URL.trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '');
const sb = createClient(URL_PROJETO, CONFIG.SUPABASE_ANON_KEY.trim());

const PK = {
  membros: ['id'], eventos: ['id'], lancamentos: ['id'],
  presencas: ['evento_id', 'membro_id'], mensalidades: ['membro_id', 'competencia'],
  config: ['chave'],
};

// O usuário digita só o ID; o Supabase Auth trabalha com e-mail.
// Ex.: "Arthur.Lima" -> "arthur.lima@crateus.app"
const loginParaEmail = (login) => {
  const l = String(login || '').trim().toLowerCase();
  return l.includes('@') ? l : `${l}@${CONFIG.LOGIN_DOMINIO}`;
};

// Traduz erros comuns para português
function erro(e) {
  const msg = e?.message || String(e);
  if (/Invalid login credentials/i.test(msg)) return new Error('ID ou senha incorretos.');
  if (/row-level security|permission denied/i.test(msg)) return new Error('Permissão negada: apenas administradores podem alterar dados.');
  if (/duplicate key/i.test(msg)) return new Error('Esse registro já existe.');
  if (/should be at least 6/i.test(msg)) return new Error('A senha precisa ter pelo menos 6 caracteres.');
  if (/different from the old/i.test(msg)) return new Error('A nova senha precisa ser diferente da atual.');
  return new Error(msg);
}
const ok = ({ data, error }) => { if (error) throw erro(error); return data; };

export const db = {
  modo: 'supabase',

  // ---------- autenticação ----------
  async signIn(login, senha) {
    const { error } = await sb.auth.signInWithPassword({ email: loginParaEmail(login), password: senha });
    if (error) throw erro(error);
    return this.getUser();
  },
  async signOut() { await sb.auth.signOut(); },

  async getUser() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data: perfil } = await sb.from('profiles').select('nome, role, login, membro_id').eq('id', session.user.id).maybeSingle();
    return {
      id: session.user.id,
      login: perfil?.login || session.user.email,
      nome: perfil?.nome || session.user.email,
      role: perfil?.role || 'membro',
      membro_id: perfil?.membro_id ?? null,
    };
  },

  // O próprio usuário troca a senha (o Supabase confere a sessão atual)
  async alterarMinhaSenha(nova) {
    const { error } = await sb.auth.updateUser({ password: nova });
    if (error) throw erro(error);
  },

  // ---------- gestão de acessos (somente master) ----------
  // Criar/excluir usuários e trocar senha de outra pessoa mexem em auth.users,
  // então são feitos por funções SQL (RPC) que conferem se quem chama é master.
  async listarUsuarios() {
    return ok(await sb.from('profiles').select('id, login, nome, role, membro_id').order('nome'));
  },
  async criarUsuario({ login, senha, nome, role, membro_id }) {
    return ok(await sb.rpc('admin_criar_usuario', {
      p_login: login, p_senha: senha, p_nome: nome, p_role: role, p_membro_id: membro_id || null,
    }));
  },
  async atualizarUsuario(id, { nome, role, membro_id }) {
    ok(await sb.from('profiles').update({ nome, role, membro_id: membro_id || null }).eq('id', id));
  },
  async redefinirSenha(id, senha) {
    ok(await sb.rpc('admin_redefinir_senha', { p_user: id, p_senha: senha }));
  },
  async excluirUsuario(id) {
    ok(await sb.rpc('admin_excluir_usuario', { p_user: id }));
  },

  // ---------- tabelas ----------
  async list(tabela) { return ok(await sb.from(tabela).select('*')); },
  async insert(tabela, row) { return ok(await sb.from(tabela).insert(row).select().single()); },
  async update(tabela, match, patch) { ok(await sb.from(tabela).update(patch).match(match)); },
  async remove(tabela, match) { ok(await sb.from(tabela).delete().match(match)); },
  async upsert(tabela, rows) {
    ok(await sb.from(tabela).upsert(rows, { onConflict: PK[tabela].join(',') }));
  },
};

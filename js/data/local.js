// =============================================================
// Banco "falso" para o MODO DEMONSTRAÇÃO.
// Guarda tudo no localStorage do navegador e imita o comportamento
// do Supabase: mesmas funções, mesmas regras (só admin escreve) e o
// mesmo "gatilho" das mensalidades lançando no caixa.
// =============================================================
import { gerarSeed } from './seed.js';

const KEY = 'crateus_demo_v3';
const SESSION_KEY = 'crateus_demo_sessao_v3';

// Acessos de exemplo (no Supabase eles ficam em auth.users + profiles)
const USUARIOS_DEMO = [
  { id: 'u1', login: 'master', senha: 'master123', nome: 'Gabriel Sousa', role: 'master', membro_id: 4 },
  { id: 'u2', login: 'rafael', senha: 'admin123', nome: 'Rafael Monteiro', role: 'admin', membro_id: 5 },
  { id: 'u3', login: 'igor', senha: 'membro123', nome: 'Igor Bezerra', role: 'membro', membro_id: 10 },
];

// Chave primária de cada tabela (para update/delete/upsert)
const PK = {
  membros: ['id'], eventos: ['id'], lancamentos: ['id'],
  presencas: ['evento_id', 'membro_id'], mensalidades: ['membro_id', 'competencia'],
  config: ['chave'],
};

let state = carregar();

function carregar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(KEY));
    if (salvo && salvo.membros) return salvo;
  } catch { /* storage indisponível: usa seed em memória */ }
  return { ...gerarSeed(), usuarios: structuredClone(USUARIOS_DEMO) };
}
function salvar() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignora */ }
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const casa = (row, match) => Object.entries(match).every(([k, v]) => String(row[k]) === String(v));
const proximoId = (t) => state[t].reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
const semSenha = ({ senha, ...u }) => u;

function usuarioAtual() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    const u = s && state.usuarios.find((x) => x.id === s.id); // pode ter sido excluído/alterado
    return u ? semSenha(u) : null;
  } catch { return null; }
}
function exigirAdmin() {
  // Equivalente às políticas RLS "escrita_admin" e ao is_admin() (admin OU master)
  if (!['admin', 'master'].includes(usuarioAtual()?.role)) throw new Error('Permissão negada: apenas administradores podem alterar dados.');
}
function exigirMaster() {
  // Equivalente ao is_master() / pode_gerir_acessos() da migração 002
  if (usuarioAtual()?.role !== 'master') throw new Error('Permissão negada: apenas o administrador master pode gerenciar acessos.');
}
const ehMaster = (id) => state.usuarios.find((u) => u.id === id)?.role === 'master';
export function normalizarLogin(l) { return String(l || '').trim().toLowerCase(); }
function validarAcesso(login, senha) {
  if (!/^[a-z0-9._-]{3,40}$/.test(login)) throw new Error('ID inválido: use de 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado.');
  if (senha !== undefined && String(senha).length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Imita os gatilhos trg_mensalidade_insert / trg_mensalidade_delete
function aoInserir(tabela, row) {
  if (tabela !== 'mensalidades') return;
  const [ano, mes] = row.competencia.split('-');
  const membro = state.membros.find((m) => m.id === Number(row.membro_id));
  const lanc = {
    id: proximoId('lancamentos'), data: row.pago_em,
    descricao: `Mensalidade de ${MESES[Number(mes) - 1]}/${ano} — ${membro?.nome ?? ''}`,
    categoria: 'Mensalidades', tipo: 'entrada', valor: Number(row.valor),
    criado_por: usuarioAtual()?.nome ?? 'Sistema', created_at: new Date().toISOString(),
  };
  state.lancamentos.push(lanc);
  row.lancamento_id = lanc.id;
}
function aoRemover(tabela, row) {
  if (tabela === 'mensalidades' && row.lancamento_id) {
    state.lancamentos = state.lancamentos.filter((l) => l.id !== row.lancamento_id);
  }
  if (tabela === 'membros') { // on delete cascade / set null
    state.presencas = state.presencas.filter((p) => p.membro_id !== row.id);
    state.mensalidades = state.mensalidades.filter((p) => p.membro_id !== row.id);
    state.usuarios.forEach((u) => { if (u.membro_id === row.id) u.membro_id = null; });
  }
  if (tabela === 'eventos') state.presencas = state.presencas.filter((p) => p.evento_id !== row.id);
}

const esperar = () => new Promise((r) => setTimeout(r, 80)); // simula a rede

export const db = {
  modo: 'demo',

  // ---------- autenticação ----------
  async signIn(login, senha) {
    await esperar();
    const u = state.usuarios.find((x) => x.login === normalizarLogin(login) && x.senha === senha);
    if (!u) throw new Error('ID ou senha incorretos.');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: u.id }));
    return semSenha(u);
  },
  async signOut() { sessionStorage.removeItem(SESSION_KEY); },
  async getUser() { return usuarioAtual(); },
  async alterarMinhaSenha(nova) {
    await esperar();
    if (String(nova).length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
    const u = state.usuarios.find((x) => x.id === usuarioAtual()?.id);
    if (!u) throw new Error('Sessão expirada. Entre novamente.');
    u.senha = nova; salvar();
  },

  // ---------- gestão de acessos (somente master) ----------
  async listarUsuarios() { exigirMaster(); return clone(state.usuarios.map(semSenha)); },

  async criarUsuario({ login, senha, nome, role, membro_id }) {
    exigirMaster(); await esperar();
    login = normalizarLogin(login);
    validarAcesso(login, senha);
    if (!['admin', 'membro'].includes(role)) throw new Error('Um novo master só pode ser criado pelo SQL Editor do Supabase.');
    if (state.usuarios.some((u) => u.login === login)) throw new Error('Já existe um acesso com esse ID.');
    const novo = { id: 'u' + Date.now(), login, senha, nome, role, membro_id: membro_id || null };
    state.usuarios.push(novo); salvar();
    return semSenha(novo);
  },

  async atualizarUsuario(id, { nome, role, membro_id }) {
    exigirMaster(); await esperar();
    const u = state.usuarios.find((x) => x.id === id);
    // Igual ao gatilho protege_proprio_admin: o perfil master não muda pelo site
    if ((u.role === 'master' || role === 'master') && u.role !== role) throw new Error('O perfil master só pode ser alterado pelo SQL Editor do Supabase.');
    Object.assign(u, { nome, role, membro_id: membro_id || null }); salvar();
  },

  async redefinirSenha(id, senha) {
    exigirMaster(); await esperar();
    if (String(senha).length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
    state.usuarios.find((x) => x.id === id).senha = senha; salvar();
  },

  async excluirUsuario(id) {
    exigirMaster(); await esperar();
    if (id === usuarioAtual().id) throw new Error('Você não pode excluir o seu próprio acesso.');
    if (ehMaster(id)) throw new Error('Um acesso master só pode ser excluído pelo SQL Editor.');
    state.usuarios = state.usuarios.filter((x) => x.id !== id); salvar();
  },

  // ---------- tabelas ----------
  async list(tabela) { return clone(state[tabela] || []); },

  async insert(tabela, row) {
    exigirAdmin(); await esperar();
    const novo = { ...row };
    if (PK[tabela][0] === 'id') novo.id = proximoId(tabela);
    if (tabela === 'lancamentos') {
      novo.created_at = new Date().toISOString();
      novo.criado_por = usuarioAtual()?.nome ?? '';
    }
    aoInserir(tabela, novo);
    state[tabela].push(novo);
    salvar();
    return clone(novo);
  },

  async update(tabela, match, patch) {
    exigirAdmin(); await esperar();
    state[tabela].forEach((r) => { if (casa(r, match)) Object.assign(r, patch); });
    salvar();
  },

  async remove(tabela, match) {
    exigirAdmin(); await esperar();
    const fora = state[tabela].filter((r) => casa(r, match));
    state[tabela] = state[tabela].filter((r) => !casa(r, match));
    fora.forEach((r) => aoRemover(tabela, r));
    salvar();
  },

  async upsert(tabela, rows) {
    exigirAdmin(); await esperar();
    const chaves = PK[tabela];
    for (const row of rows) {
      const match = Object.fromEntries(chaves.map((k) => [k, row[k]]));
      const existente = state[tabela].find((r) => casa(r, match));
      if (existente) Object.assign(existente, row);
      else { const novo = { ...row }; aoInserir(tabela, novo); state[tabela].push(novo); }
    }
    salvar();
  },

  // Só existe no modo demo: volta aos dados de exemplo
  async resetDemo() { state = { ...gerarSeed(), usuarios: structuredClone(USUARIOS_DEMO) }; salvar(); },
};

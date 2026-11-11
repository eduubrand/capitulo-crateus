// Regras de negócio "puras": recebem dados e devolvem números.
// Separar isso da tela facilita testar e reaproveitar (painel usa várias).
import { hojeISO, competencia } from './utils.js';

export const ordenarMembros = (ms) => [...ms].sort((a, b) => (a.ordem - b.ordem) || a.nome.localeCompare(b.nome));

// Categorias do quadro. Membros antigos (sem a coluna) contam como 'demolay'.
export const CATEGORIAS = {
  demolay: { nome: 'DeMolay', plural: 'DeMolays' },
  senior: { nome: 'Sênior DeMolay', plural: 'Seniores DeMolay' },
  consultor: { nome: 'Consultor', plural: 'Consultores' },
};
export const categoriaDe = (m) => (CATEGORIAS[m.categoria] ? m.categoria : 'demolay');

// DeMolays ativos: a base do quórum e das mensalidades.
export const ativos = (ms) => ordenarMembros(ms.filter((m) => m.ativo && categoriaDe(m) === 'demolay'));
// Seniores e consultores ativos: aparecem na chamada, mas fora do quórum.
export const apoio = (ms) => ordenarMembros(ms.filter((m) => m.ativo && categoriaDe(m) !== 'demolay'))
  .sort((a, b) => (categoriaDe(a) === 'consultor') - (categoriaDe(b) === 'consultor'));

// Saldo e lançamentos em ordem cronológica, com saldo acumulado em cada linha
export function livroCaixa(lancamentos) {
  const ord = [...lancamentos].sort((a, b) => a.data.localeCompare(b.data) || (a.id - b.id));
  let saldo = 0;
  return ord.map((l) => {
    saldo += (l.tipo === 'entrada' ? 1 : -1) * Number(l.valor);
    return { ...l, valor: Number(l.valor), saldo };
  });
}
export const saldoAtual = (lancs) => {
  const lv = livroCaixa(lancs);
  return lv.length ? lv[lv.length - 1].saldo : 0;
};

// Eventos que já tiveram chamada, do mais recente para o mais antigo
export function sessoesComChamada(eventos, presencas) {
  const comChamada = new Set(presencas.map((p) => Number(p.evento_id)));
  return eventos.filter((e) => comChamada.has(Number(e.id)))
    .sort((a, b) => b.data.localeCompare(a.data));
}

// Quórum de uma sessão. "quadro" = lista de quem conta (DeMolays ativos);
// marcações de seniores/consultores são ignoradas aqui.
export function resumoChamada(eventoId, presencas, quadro) {
  const ids = new Set(quadro.map((m) => Number(m.id)));
  const ps = presencas.filter((p) => Number(p.evento_id) === Number(eventoId) && ids.has(Number(p.membro_id)));
  const P = ps.filter((p) => p.status === 'P').length;
  const F = ps.filter((p) => p.status === 'F').length;
  const J = ps.filter((p) => p.status === 'J').length;
  return { P, F, J, total: quadro.length, pct: quadro.length ? Math.round((P / quadro.length) * 100) : 0 };
}

export function proximoEvento(eventos, filtro = () => true) {
  const hoje = hojeISO();
  return [...eventos].filter((e) => e.data >= hoje && filtro(e))
    .sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')))[0];
}

// Semestre: 1 = jan–jun, 2 = jul–dez
export function mesesDoSemestre(ano, sem) {
  const ini = sem === 1 ? 1 : 7;
  return Array.from({ length: 6 }, (_, i) => `${ano}-${String(ini + i).padStart(2, '0')}`);
}
export function semestreAtual() {
  const h = hojeISO();
  return { ano: Number(h.slice(0, 4)), sem: Number(h.slice(5, 7)) <= 6 ? 1 : 2 };
}

// Mensalidades em aberto por membro, considerando meses do semestre até o mês atual.
// Só cobra a partir do mês em que o membro foi cadastrado (created_at), quando existir.
export function pendencias(membros, mensalidades, valor, meses) {
  const mesAtual = competencia(hojeISO());
  const pagos = new Set(mensalidades.map((m) => `${m.membro_id}|${m.competencia}`));
  return ativos(membros).map((m) => {
    const inicio = m.created_at ? m.created_at.slice(0, 7) : '0000-00';
    const abertos = meses.filter((c) => c <= mesAtual && c >= inicio && !pagos.has(`${m.id}|${c}`));
    return { membro: m, abertos, total: abertos.length * valor };
  });
}

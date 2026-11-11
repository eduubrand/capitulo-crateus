import { esc, iniciais, icon, cabecalho, tentar, confirmar, abrirModal } from '../utils.js';
import { ordenarMembros, categoriaDe, CATEGORIAS } from '../calculos.js';

// Cargos sugeridos por categoria. Um cargo que já existe no banco e não
// está na lista continua aparecendo (não perdemos dados antigos).
const CARGOS = {
  demolay: ['Mestre Conselheiro', '1º Conselheiro', '2º Conselheiro', 'Escrivão', 'Tesoureiro',
    'Hospitaleiro', 'Capelão', 'Mestre de Cerimônias', '1º Diácono', '2º Diácono', '1º Mordomo',
    '2º Mordomo', 'Orador', 'Porta-Bandeira', 'Organista', 'Sentinela', 'Membro'],
  senior: ['Sênior DeMolay'],
  consultor: ['Presidente do Conselho Consultivo', 'Consultor do Capítulo'],
};

let filtro = 'todos'; // 'todos' | 'demolay' | 'senior' | 'consultor'

export async function render(el, ctx) {
  const { db, admin } = ctx;
  const [membros, presencas, mensalidades] = await Promise.all(['membros', 'presencas', 'mensalidades'].map((t) => db.list(t)));
  const ordem = { demolay: 0, senior: 1, consultor: 2 };
  const lista = ordenarMembros(membros).sort((a, b) => ordem[categoriaDe(a)] - ordem[categoriaDe(b)]);
  const conta = (c) => lista.filter((m) => m.ativo && categoriaDe(m) === c).length;
  const visiveis = lista.filter((m) => filtro === 'todos' || categoriaDe(m) === filtro);

  const freq = (id) => {
    const ps = presencas.filter((p) => Number(p.membro_id) === id);
    return ps.length ? Math.round((ps.filter((p) => p.status !== 'F').length / ps.length) * 100) : null;
  };

  el.innerHTML = `
    ${cabecalho(`${conta('demolay')} DeMolays · ${conta('senior')} seniores · ${conta('consultor')} consultores ativos`, 'Quadro de', 'Membros',
      admin ? `<button class="btn btn-primary" id="novo">${icon('plus')} Novo membro</button>` : '')}

    <section class="card">
      <div class="card-head">
        <h2>${filtro === 'todos' ? 'Todos' : CATEGORIAS[filtro].plural}</h2>
        <div class="segmented">
          ${[['todos', 'Todos'], ['demolay', 'DeMolays'], ['senior', 'Seniores'], ['consultor', 'Consultores']].map(([v, t]) =>
            `<button class="${filtro === v ? 'on' : ''}" data-filtro="${v}">${t}</button>`).join('')}
        </div>
      </div>
      <div class="tabela-wrap"><table class="tabela">
        <thead><tr><th>Membro</th><th class="hide-sm">Cargo</th><th class="hide-sm">Categoria</th><th class="num">Frequência</th><th class="num hide-sm">Mensalidades pagas</th><th class="center">Situação</th>${admin ? '<th></th>' : ''}</tr></thead>
        <tbody>${visiveis.map((m) => {
          const f = freq(m.id);
          const cat = categoriaDe(m);
          return `<tr class="${m.ativo ? '' : 'inativo'}">
            <td><div class="membro-cel"><div class="avatar ${cat !== 'demolay' ? 'avatar-' + cat : ''}">${esc(iniciais(m.nome))}</div>
              <div><strong>${esc(m.nome)}</strong><small class="muted block show-sm">${esc(m.cargo)}${cat !== 'demolay' ? ' · ' + CATEGORIAS[cat].nome : ''}</small></div></div></td>
            <td class="muted hide-sm">${esc(m.cargo)}</td>
            <td class="hide-sm"><span class="chip chip-cat-${cat}">${CATEGORIAS[cat].nome}</span></td>
            <td class="num" title="Presentes + justificadas, sobre todas as chamadas">${f === null ? '—' : `${f}%`}</td>
            <td class="num hide-sm">${cat === 'demolay' ? mensalidades.filter((x) => Number(x.membro_id) === m.id).length : '—'}</td>
            <td class="center"><span class="chip ${m.ativo ? 'chip-ok' : 'chip-off'}">${m.ativo ? 'Ativo' : 'Inativo'}</span></td>
            ${admin ? `<td class="acao nowrap">
              <button class="btn-icon sm" data-edit="${m.id}" aria-label="Editar ${esc(m.nome)}" title="Editar">${icon('editar')}</button>
              <button class="btn-icon sm" data-del="${m.id}" aria-label="Excluir ${esc(m.nome)}" title="Excluir">${icon('lixo')}</button>
            </td>` : ''}
          </tr>`;
        }).join('') || '<tr><td colspan="7" class="vazio">Nenhum membro nesta categoria.</td></tr>'}</tbody>
      </table></div>
      <p class="muted small">Só <strong>DeMolays ativos</strong> contam no quórum e pagam mensalidade. Seniores e consultores aparecem numa lista separada na chamada. Inativos somem da chamada, mas o histórico é mantido.</p>
    </section>`;

  el.querySelectorAll('[data-filtro]').forEach((b) => { b.onclick = () => { filtro = b.dataset.filtro; ctx.recarregar(); }; });

  if (!admin) return;

  el.querySelector('#novo').onclick = () => formulario(ctx, {
    ativo: true, categoria: filtro === 'todos' ? 'demolay' : filtro, ordem: 100,
  });
  el.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => formulario(ctx, lista.find((m) => String(m.id) === b.dataset.edit));
  });
  el.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      const m = lista.find((x) => String(x.id) === b.dataset.del);
      if (!(await confirmar(`Excluir ${m.nome}? Todo o histórico de presença e mensalidades dele será apagado. Se ele só saiu do capítulo, prefira marcar como inativo.`))) return;
      if (await tentar(() => ctx.db.remove('membros', { id: m.id }).then(() => true), 'Membro excluído.')) ctx.recarregar();
    };
  });
}

function opcoesCargo(categoria, atual) {
  const lista = [...CARGOS[categoria]];
  if (atual && !lista.includes(atual)) lista.unshift(atual); // preserva cargo antigo
  return lista.map((c) => `<option ${c === atual ? 'selected' : ''}>${esc(c)}</option>`).join('');
}

function formulario(ctx, m) {
  const editando = Boolean(m.id);
  const cat = categoriaDe(m);
  const dlg = abrirModal(editando ? 'Editar membro' : 'Novo membro', `
    <form class="form">
      <label class="field"><span>Nome completo</span><input name="nome" required maxlength="80" value="${esc(m.nome || '')}"></label>
      <label class="field"><span>Categoria</span>
        <select name="categoria">${Object.entries(CATEGORIAS).map(([k, c]) => `<option value="${k}" ${cat === k ? 'selected' : ''}>${c.nome}</option>`).join('')}</select>
        <small class="muted" id="ajudaCat"></small>
      </label>
      <div class="row-2">
        <label class="field"><span>Cargo</span><select name="cargo">${opcoesCargo(cat, m.cargo || CARGOS[cat][CARGOS[cat].length - 1])}</select></label>
        <label class="field"><span>Ordem na lista</span><input name="ordem" type="number" min="1" value="${m.ordem ?? 100}"></label>
      </div>
      <label class="check"><input type="checkbox" name="ativo" ${m.ativo ? 'checked' : ''}> Ativo</label>
      <div class="modal-actions">
        <button type="button" class="btn" data-fechar>Cancelar</button>
        <button class="btn btn-primary">${editando ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </form>`);
  const f = dlg.querySelector('form');
  const ajuda = {
    demolay: 'Conta no quórum e paga mensalidade.',
    senior: 'Aparece na chamada em lista separada. Não conta no quórum nem paga mensalidade.',
    consultor: 'Tio / consultor. Lista separada na chamada, fora do quórum e das mensalidades.',
  };
  const atualizaAjuda = () => { f.querySelector('#ajudaCat').textContent = ajuda[f.categoria.value]; };
  atualizaAjuda();
  // Trocar a categoria troca a lista de cargos sugeridos
  f.categoria.onchange = () => {
    const c = f.categoria.value;
    f.cargo.innerHTML = opcoesCargo(c, CARGOS[c].includes(m.cargo) ? m.cargo : CARGOS[c][CARGOS[c].length - 1]);
    atualizaAjuda();
  };
  f.nome.focus();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const dados = {
      nome: f.nome.value.trim(), categoria: f.categoria.value, cargo: f.cargo.value,
      ordem: Number(f.ordem.value) || 100, ativo: f.ativo.checked,
    };
    const ok = await tentar(() => (editando
      ? ctx.db.update('membros', { id: m.id }, dados)
      : ctx.db.insert('membros', dados)).then(() => true), editando ? 'Membro atualizado.' : 'Membro adicionado.');
    if (ok) { dlg.close(); ctx.recarregar(); }
  };
}

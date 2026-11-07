import { esc, iniciais, icon, cabecalho, tentar, confirmar, abrirModal } from '../utils.js';
import { ordenarMembros } from '../calculos.js';

const CARGOS = ['Mestre Conselheiro', '1º Conselheiro', '2º Conselheiro', 'Escrivão', 'Tesoureiro',
  'Hospitaleiro', 'Capelão', 'Mestre de Cerimônias', '1º Diácono', '2º Diácono', '1º Mordomo',
  '2º Mordomo', 'Orador', 'Porta-Bandeira', 'Organista', 'Sentinela', 'Membro', 'Sênior', 'Tio (Consultor)'];

export async function render(el, ctx) {
  const { db, admin } = ctx;
  const [membros, presencas, mensalidades] = await Promise.all(['membros', 'presencas', 'mensalidades'].map((t) => db.list(t)));
  const lista = ordenarMembros(membros);
  const ativosN = lista.filter((m) => m.ativo).length;

  const freq = (id) => {
    const ps = presencas.filter((p) => Number(p.membro_id) === id);
    return ps.length ? Math.round((ps.filter((p) => p.status !== 'F').length / ps.length) * 100) : null;
  };

  el.innerHTML = `
    ${cabecalho(`${ativosN} ativos · ${lista.length - ativosN} inativos`, 'Quadro de', 'Membros',
      admin ? `<button class="btn btn-primary" id="novo">${icon('plus')} Novo membro</button>` : '')}

    <section class="card">
      <div class="tabela-wrap"><table class="tabela">
        <thead><tr><th>Membro</th><th class="hide-sm">Cargo</th><th class="num">Frequência</th><th class="num hide-sm">Mensalidades pagas</th><th class="center">Situação</th>${admin ? '<th></th>' : ''}</tr></thead>
        <tbody>${lista.map((m) => {
          const f = freq(m.id);
          return `<tr class="${m.ativo ? '' : 'inativo'}">
            <td><div class="membro-cel"><div class="avatar">${esc(iniciais(m.nome))}</div>
              <div><strong>${esc(m.nome)}</strong><small class="muted block show-sm">${esc(m.cargo)}</small></div></div></td>
            <td class="muted hide-sm">${esc(m.cargo)}</td>
            <td class="num" title="Presentes + justificadas, sobre todas as chamadas">${f === null ? '—' : `${f}%`}</td>
            <td class="num hide-sm">${mensalidades.filter((x) => Number(x.membro_id) === m.id).length}</td>
            <td class="center"><span class="chip ${m.ativo ? 'chip-ok' : 'chip-off'}">${m.ativo ? 'Ativo' : 'Inativo'}</span></td>
            ${admin ? `<td class="acao nowrap">
              <button class="btn-icon sm" data-edit="${m.id}" aria-label="Editar ${esc(m.nome)}" title="Editar">${icon('editar')}</button>
              <button class="btn-icon sm" data-del="${m.id}" aria-label="Excluir ${esc(m.nome)}" title="Excluir">${icon('lixo')}</button>
            </td>` : ''}
          </tr>`;
        }).join('') || '<tr><td colspan="6" class="vazio">Nenhum membro cadastrado.</td></tr>'}</tbody>
      </table></div>
      <p class="muted small">Membros inativos não aparecem na chamada nem nas cobranças de mensalidade, mas o histórico deles é mantido.</p>
    </section>`;

  if (!admin) return;

  el.querySelector('#novo').onclick = () => formulario(ctx, { ativo: true, cargo: 'Membro', ordem: 100 });
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

function formulario(ctx, m) {
  const editando = Boolean(m.id);
  const dlg = abrirModal(editando ? 'Editar membro' : 'Novo membro', `
    <form class="form">
      <label class="field"><span>Nome completo</span><input name="nome" required maxlength="80" value="${esc(m.nome || '')}"></label>
      <div class="row-2">
        <label class="field"><span>Cargo</span>
          <select name="cargo">${CARGOS.map((c) => `<option ${m.cargo === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Ordem na lista</span><input name="ordem" type="number" min="1" value="${m.ordem ?? 100}"></label>
      </div>
      <label class="check"><input type="checkbox" name="ativo" ${m.ativo ? 'checked' : ''}> Membro ativo</label>
      <div class="modal-actions">
        <button type="button" class="btn" data-fechar>Cancelar</button>
        <button class="btn btn-primary">${editando ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </form>`);
  const f = dlg.querySelector('form');
  f.nome.focus();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const dados = { nome: f.nome.value.trim(), cargo: f.cargo.value, ordem: Number(f.ordem.value) || 100, ativo: f.ativo.checked };
    const ok = await tentar(() => (editando
      ? ctx.db.update('membros', { id: m.id }, dados)
      : ctx.db.insert('membros', dados)).then(() => true), editando ? 'Membro atualizado.' : 'Membro adicionado.');
    if (ok) { dlg.close(); ctx.recarregar(); }
  };
}

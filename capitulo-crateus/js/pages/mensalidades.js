import {
  esc, fmtBRL, hojeISO, competencia, icon, cabecalho, tentar, MESES, MESES_CURTO, abrirModal,
} from '../utils.js';
import { ativos, mesesDoSemestre, semestreAtual, pendencias } from '../calculos.js';

let semestre = null;      // { ano, sem }
let filtro = 'todos';     // 'todos' | 'emdia' | 'pendente'

export async function render(el, ctx) {
  const { db, admin } = ctx;
  const [membros, mensalidades, config] = await Promise.all(['membros', 'mensalidades', 'config'].map((t) => db.list(t)));
  const valor = Number(config.find((c) => c.chave === 'valor_mensalidade')?.valor || 20);
  semestre ||= semestreAtual();
  const meses = mesesDoSemestre(semestre.ano, semestre.sem);
  const mesAtual = competencia(hojeISO());
  const quadro = ativos(membros);

  const pago = new Map(mensalidades.map((m) => [`${m.membro_id}|${m.competencia}`, m]));
  const pend = new Map(pendencias(membros, mensalidades, valor, meses).map((p) => [p.membro.id, p]));

  // KPIs do mês atual (ou do último mês do semestre exibido, se for passado)
  const mesRef = meses.includes(mesAtual) ? mesAtual : meses[meses.length - 1];
  const pagosRef = quadro.filter((m) => pago.has(`${m.id}|${mesRef}`));
  const arrecadadoRef = pagosRef.reduce((s, m) => s + Number(pago.get(`${m.id}|${mesRef}`).valor), 0);
  const totalAberto = [...pend.values()].reduce((s, p) => s + p.total, 0);
  const comPend = [...pend.values()].filter((p) => p.abertos.length).length;
  const nomeMesRef = MESES[Number(mesRef.slice(5)) - 1];

  const visiveis = quadro.filter((m) => {
    const p = pend.get(m.id);
    if (filtro === 'emdia') return !p?.abertos.length;
    if (filtro === 'pendente') return p?.abertos.length;
    return true;
  });

  // Opções de semestre: do ano anterior ao próximo
  const opcoes = [];
  for (let a = semestre.ano - 1; a <= semestre.ano + 1; a++) for (const s of [1, 2]) opcoes.push({ ano: a, sem: s });

  el.innerHTML = `
    ${cabecalho(`${semestre.sem}º semestre de ${semestre.ano}`, 'Controle de', 'Mensalidades', `
      <label class="field inline"><span>Semestre</span>
        <select id="semestre">${opcoes.map((o) => `<option value="${o.ano}-${o.sem}" ${o.ano === semestre.ano && o.sem === semestre.sem ? 'selected' : ''}>${o.ano}.${o.sem}</option>`).join('')}</select>
      </label>
      <div class="pill">Valor mensal <strong>${fmtBRL(valor)}</strong>
        ${admin ? `<button class="btn-icon sm" id="editarValor" title="Alterar valor" aria-label="Alterar valor da mensalidade">${icon('editar')}</button>` : ''}</div>`)}

    <section class="kpis kpis-3">
      <div class="kpi kpi-destaque">
        <div class="kpi-label">Arrecadado em ${nomeMesRef.toLowerCase()}</div>
        <div class="kpi-valor">${fmtBRL(arrecadadoRef)}</div>
        <div class="kpi-sub">de ${fmtBRL(quadro.length * valor)} esperados</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Pagaram ${nomeMesRef.toLowerCase()}</div>
        <div class="kpi-valor">${pagosRef.length} <small>de ${quadro.length}</small></div>
        <div class="meter"><span style="width:${quadro.length ? (pagosRef.length / quadro.length) * 100 : 0}%"></span></div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Total em aberto</div>
        <div class="kpi-valor txt-red">${fmtBRL(totalAberto)}</div>
        <div class="kpi-sub">${comPend} ${comPend === 1 ? 'membro' : 'membros'} com pendência</div>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Quadro do semestre</h2>
        <div class="segmented">
          ${[['todos', 'Todos'], ['emdia', 'Em dia'], ['pendente', 'Com pendência']].map(([v, t]) =>
            `<button class="${filtro === v ? 'on' : ''}" data-filtro="${v}">${t}</button>`).join('')}
        </div>
      </div>
      <p class="aviso">${icon('info')} ${admin
        ? 'Toque num mês para marcar como pago ou em aberto. Cada pagamento entra automaticamente no Livro de Caixa.'
        : 'Visualização: apenas administradores podem registrar pagamentos.'}</p>
      <div class="tabela-wrap">
        <table class="tabela mens">
          <thead><tr><th>Membro</th>${meses.map((c) => `<th class="center">${MESES_CURTO[Number(c.slice(5)) - 1]}</th>`).join('')}<th class="num">Situação</th></tr></thead>
          <tbody>
            ${visiveis.map((m) => {
              const p = pend.get(m.id);
              return `<tr>
                <td><strong class="nowrap">${esc(m.nome)}</strong><small class="muted block">${esc(m.cargo)}</small></td>
                ${meses.map((c) => {
                  const pg = pago.has(`${m.id}|${c}`);
                  const futuro = c > mesAtual;
                  if (futuro && !pg) return `<td class="center"><button class="mes mes-futuro" data-m="${m.id}" data-c="${c}" ${admin ? '' : 'disabled'} title="Mês futuro — clique para adiantar">—</button></td>`;
                  return `<td class="center"><button class="mes ${pg ? 'mes-pago' : 'mes-aberto'}" data-m="${m.id}" data-c="${c}" ${admin ? '' : 'disabled'}
                    aria-label="${esc(m.nome)}, ${MESES[Number(c.slice(5)) - 1]}: ${pg ? 'pago' : 'em aberto'}">
                    ${pg ? `${icon('check')} Pago` : 'Em aberto'}</button></td>`;
                }).join('')}
                <td class="num nowrap">${p?.abertos.length
                  ? `<span class="txt-red">${p.abertos.length} ${p.abertos.length === 1 ? 'mês' : 'meses'} · ${fmtBRL(p.total)}</span>`
                  : '<span class="txt-gold">Em dia</span>'}</td>
              </tr>`;
            }).join('') || `<tr><td colspan="${meses.length + 2}" class="vazio">Ninguém nesta lista.</td></tr>`}
          </tbody>
          <tfoot><tr><td class="muted">Arrecadado</td>${meses.map((c) => {
            const t = mensalidades.filter((x) => x.competencia === c).reduce((s, x) => s + Number(x.valor), 0);
            return `<td class="center muted nowrap">${c > mesAtual && !t ? '—' : fmtBRL(t)}</td>`;
          }).join('')}<td></td></tr></tfoot>
        </table>
      </div>
    </section>`;

  el.querySelector('#semestre').onchange = (e) => {
    const [ano, sem] = e.target.value.split('-').map(Number);
    semestre = { ano, sem }; ctx.recarregar();
  };
  el.querySelectorAll('[data-filtro]').forEach((b) => { b.onclick = () => { filtro = b.dataset.filtro; ctx.recarregar(); }; });

  if (!admin) return;

  el.querySelectorAll('.mes').forEach((b) => {
    b.onclick = async () => {
      const membro_id = Number(b.dataset.m);
      const c = b.dataset.c;
      b.disabled = true;
      const ok = await tentar(async () => {
        if (pago.has(`${membro_id}|${c}`)) await db.remove('mensalidades', { membro_id, competencia: c });
        else await db.insert('mensalidades', { membro_id, competencia: c, valor, pago_em: hojeISO() });
        return true;
      });
      if (ok) ctx.recarregar(); else b.disabled = false;
    };
  });

  el.querySelector('#editarValor').onclick = () => {
    const dlg = abrirModal('Valor da mensalidade', `
      <form class="form" id="formValor">
        <label class="field"><span>Novo valor (R$)</span><input name="valor" type="number" min="0" step="0.01" value="${valor}" required></label>
        <p class="muted small">Vale para os próximos pagamentos. Os já registrados mantêm o valor antigo.</p>
        <div class="modal-actions"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn btn-primary">Salvar</button></div>
      </form>`);
    dlg.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const ok = await tentar(() => db.upsert('config', [{ chave: 'valor_mensalidade', valor: String(Number(e.target.valor.value)) }]).then(() => true), 'Valor atualizado.');
      if (ok) { dlg.close(); ctx.recarregar(); }
    };
  };
}

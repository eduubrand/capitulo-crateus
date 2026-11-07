import {
  esc, fmtBRL, fmtData, hojeISO, icon, cabecalho, tentar, confirmar, MESES,
} from '../utils.js';
import { livroCaixa } from '../calculos.js';
import { tabelaLancamentos } from './painel.js';

const CATEGORIAS = ['Mensalidades', 'Eventos', 'Doações', 'Materiais', 'Taxas', 'Filantropia', 'Outros'];

let periodo = 'tudo';   // 'tudo' ou 'AAAA-MM'
let filtroTipo = 'todos';
let tipoNovo = 'entrada';

export async function render(el, ctx) {
  const { db, admin } = ctx;
  const lancamentos = await db.list('lancamentos');
  const livro = livroCaixa(lancamentos);
  const saldo = livro.length ? livro[livro.length - 1].saldo : 0;

  const meses = [...new Set(livro.map((l) => l.data.slice(0, 7)))].sort().reverse();
  if (periodo !== 'tudo' && !meses.includes(periodo)) periodo = 'tudo';

  const noPeriodo = livro.filter((l) => periodo === 'tudo' || l.data.startsWith(periodo));
  const ent = noPeriodo.filter((l) => l.tipo === 'entrada');
  const sai = noPeriodo.filter((l) => l.tipo === 'saida');
  const soma = (ls) => ls.reduce((s, l) => s + l.valor, 0);
  const anteriores = livro.filter((l) => periodo !== 'tudo' && l.data < `${periodo}-01`);
  const saldoInicial = anteriores.length ? anteriores[anteriores.length - 1].saldo : 0;

  const visiveis = noPeriodo.filter((l) => filtroTipo === 'todos' || l.tipo === filtroTipo).reverse();

  // Saídas por categoria
  const porCat = {};
  sai.forEach((l) => { porCat[l.categoria] = (porCat[l.categoria] || 0) + l.valor; });
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...cats.map((c) => c[1]));

  const nomeMes = (c) => `${MESES[Number(c.slice(5)) - 1]} ${c.slice(0, 4)}`;

  el.innerHTML = `
    ${cabecalho('Tesouraria', 'Livro de', 'Caixa', `
      <label class="field inline"><span>Período</span>
        <select id="periodo">
          <option value="tudo">Todo o histórico</option>
          ${meses.map((c) => `<option value="${c}" ${c === periodo ? 'selected' : ''}>${nomeMes(c)}</option>`).join('')}
        </select>
      </label>
      <button class="btn" id="imprimir">${icon('pdf')} Prestação de contas (PDF)</button>`)}

    <section class="kpis kpis-3">
      <div class="kpi kpi-destaque">
        <div class="kpi-label">Saldo atual</div>
        <div class="kpi-valor">${fmtBRL(saldo)}</div>
        <div class="kpi-sub">${periodo === 'tudo' ? `${livro.length} lançamentos no total` : `Saldo inicial em 01/${periodo.slice(5)}: ${fmtBRL(saldoInicial)}`}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Entradas no período</div>
        <div class="kpi-valor txt-gold">${fmtBRL(soma(ent))}</div>
        <div class="kpi-sub">${ent.length} lançamentos</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Saídas no período</div>
        <div class="kpi-valor txt-red">${fmtBRL(soma(sai))}</div>
        <div class="kpi-sub">${sai.length} lançamentos</div>
      </div>
    </section>

    <section class="grid-caixa">
      <div class="card">
        <div class="card-head">
          <h2>Lançamentos</h2>
          <div class="segmented" role="tablist">
            ${[['todos', 'Todos'], ['entrada', 'Entradas'], ['saida', 'Saídas']].map(([v, t]) =>
              `<button class="${filtroTipo === v ? 'on' : ''}" data-filtro="${v}">${t}</button>`).join('')}
          </div>
        </div>
        ${tabelaLancamentos(visiveis, { saldo: true, excluir: admin })}
      </div>

      <div class="coluna-lateral">
        ${admin ? `
        <div class="card">
          <div class="card-head"><h2>Novo lançamento</h2></div>
          <form id="formLanc" class="form">
            <div class="segmented full">
              <button type="button" class="${tipoNovo === 'entrada' ? 'on' : ''}" data-tipo="entrada">Entrada</button>
              <button type="button" class="${tipoNovo === 'saida' ? 'on on-red' : ''}" data-tipo="saida">Saída</button>
            </div>
            <label class="field"><span>Descrição</span><input name="descricao" required maxlength="120" placeholder="Ex.: Rifa beneficente"></label>
            <div class="row-2">
              <label class="field"><span>Valor (R$)</span><input name="valor" type="number" min="0.01" step="0.01" required inputmode="decimal" placeholder="0,00"></label>
              <label class="field"><span>Data</span><input name="data" type="date" required value="${hojeISO()}"></label>
            </div>
            <label class="field"><span>Categoria</span>
              <select name="categoria">${CATEGORIAS.map((c) => `<option>${c}</option>`).join('')}</select>
            </label>
            <button class="btn ${tipoNovo === 'entrada' ? 'btn-gold' : 'btn-primary'} btn-block" type="submit">
              Registrar ${tipoNovo === 'entrada' ? 'entrada' : 'saída'}</button>
          </form>
        </div>` : ''}

        <div class="card">
          <div class="card-head"><h2>Saídas por categoria</h2></div>
          ${cats.length ? `<ul class="barras barras-cat">${cats.map(([c, v]) => `
            <li><div class="barras-rot"><strong>${esc(c)}</strong></div>
              <div class="barra barra-red"><span style="width:${(v / maxCat) * 100}%"></span></div>
              <div class="barras-val">${fmtBRL(v)}</div></li>`).join('')}</ul>` : '<p class="vazio">Sem saídas no período.</p>'}
        </div>
      </div>
    </section>

    <div class="print-only print-rodape">Prestação de contas · ${periodo === 'tudo' ? 'todo o histórico' : nomeMes(periodo)} · emitido em ${fmtData(hojeISO())}</div>`;

  el.querySelector('#periodo').onchange = (e) => { periodo = e.target.value; ctx.recarregar(); };
  el.querySelector('#imprimir').onclick = () => window.print();
  el.querySelectorAll('[data-filtro]').forEach((b) => { b.onclick = () => { filtroTipo = b.dataset.filtro; ctx.recarregar(); }; });

  if (!admin) return;

  el.querySelectorAll('[data-tipo]').forEach((b) => { b.onclick = () => { tipoNovo = b.dataset.tipo; ctx.recarregar(); }; });

  el.querySelector('#formLanc').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const valor = Number(f.valor.value);
    if (!f.descricao.value.trim() || !(valor > 0)) return;
    const ok = await tentar(() => db.insert('lancamentos', {
      data: f.data.value, descricao: f.descricao.value.trim(), categoria: f.categoria.value,
      tipo: tipoNovo, valor, criado_por: ctx.usuario.nome,
    }), 'Lançamento registrado.');
    if (ok) ctx.recarregar();
  });

  el.querySelectorAll('[data-excluir]').forEach((b) => {
    b.onclick = async () => {
      const l = livro.find((x) => String(x.id) === b.dataset.excluir);
      if (!(await confirmar(`Excluir "${l.descricao}" (${fmtBRL(l.valor)})? Essa ação não pode ser desfeita.`))) return;
      // Se for lançamento de mensalidade, desmarca o pagamento também
      const mens = (await db.list('mensalidades')).find((m) => Number(m.lancamento_id) === l.id);
      const ok = await tentar(() => (mens
        ? db.remove('mensalidades', { membro_id: mens.membro_id, competencia: mens.competencia })
        : db.remove('lancamentos', { id: l.id })).then(() => true), 'Lançamento excluído.');
      if (ok) ctx.recarregar();
    };
  });
}

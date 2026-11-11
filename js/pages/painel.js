import {
  esc, fmtBRL, fmtDia, fmtHora, fmtDataLonga, hojeISO, competencia, iniciais, icon,
  cabecalho, MESES, MESES_CURTO, TIPOS_EVENTO,
} from '../utils.js';
import {
  livroCaixa, saldoAtual, sessoesComChamada, resumoChamada, proximoEvento,
  ativos, pendencias, semestreAtual, mesesDoSemestre,
} from '../calculos.js';

export async function render(el, { db, admin }) {
  const [membros, eventos, presencas, lancamentos, mensalidades, config] = await Promise.all(
    ['membros', 'eventos', 'presencas', 'lancamentos', 'mensalidades', 'config'].map((t) => db.list(t)),
  );
  const valor = Number(config.find((c) => c.chave === 'valor_mensalidade')?.valor || 20);
  const hoje = hojeISO();
  const mes = competencia(hoje);
  const quadro = ativos(membros);

  // --- KPIs ---
  const saldo = saldoAtual(lancamentos);
  const sessoes = sessoesComChamada(eventos, presencas);
  const ultimas4 = sessoes.slice(0, 4).map((s) => resumoChamada(s.id, presencas, quadro));
  const mediaPres = ultimas4.length ? Math.round(ultimas4.reduce((a, r) => a + r.pct, 0) / ultimas4.length) : 0;
  const pagaramMes = mensalidades.filter((m) => m.competencia === mes && quadro.some((q) => q.id === Number(m.membro_id))).length;
  const prox = proximoEvento(eventos, (e) => e.tipo === 'sessao' || e.tipo === 'cerimonia') || proximoEvento(eventos);

  // --- listas ---
  const { ano, sem } = semestreAtual();
  const pend = pendencias(membros, mensalidades, valor, mesesDoSemestre(ano, sem))
    .filter((p) => p.abertos.length).sort((a, b) => b.total - a.total);
  const livro = livroCaixa(lancamentos);
  const ultimos = [...livro].reverse().slice(0, 5);
  const proximos = [...eventos].filter((e) => e.data >= hoje)
    .sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || ''))).slice(0, 4);

  const acoes = admin ? `
    <a class="btn" href="#/caixa">Novo lançamento</a>
    <a class="btn btn-primary" href="#/presenca">${icon('plus')} Nova chamada</a>` : '';

  el.innerHTML = `
    ${cabecalho(fmtDataLonga(hoje), 'Visão geral do', 'Capítulo', acoes)}

    <section class="kpis">
      <div class="kpi kpi-destaque">
        <div class="kpi-label">Saldo em caixa</div>
        <div class="kpi-valor">${fmtBRL(saldo)}</div>
        <a class="kpi-link" href="#/caixa">Ver livro de caixa →</a>
      </div>
      <div class="kpi">
        <div class="kpi-label">Presença média</div>
        <div class="kpi-valor">${mediaPres}%</div>
        <div class="kpi-sub">Últimas ${ultimas4.length || 0} sessões</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Mensalidades · ${MESES_CURTO[Number(mes.slice(5)) - 1]}</div>
        <div class="kpi-valor">${pagaramMes} <small>de ${quadro.length} pagas</small></div>
        <div class="meter" role="img" aria-label="${pagaramMes} de ${quadro.length} pagas"><span style="width:${quadro.length ? (pagaramMes / quadro.length) * 100 : 0}%"></span></div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Próxima sessão</div>
        ${prox ? `
          <div class="kpi-valor">${fmtDia(prox.data)} <small>${esc(fmtHora(prox.hora))}</small></div>
          <div class="kpi-sub">${esc(prox.titulo)}</div>` : '<div class="kpi-sub">Nada agendado</div>'}
      </div>
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="card-head"><h2>Presença nas últimas sessões</h2><a class="link" href="#/presenca">Abrir chamadas</a></div>
        ${sessoes.length ? `<ul class="barras">${sessoes.slice(0, 5).map((s) => {
          const r = resumoChamada(s.id, presencas, quadro);
          return `<li title="${r.P} presentes, ${r.F} faltas, ${r.J} justificadas">
            <div class="barras-rot"><strong>${fmtDia(s.data)}</strong><small>${esc(s.titulo)}</small></div>
            <div class="barra"><span style="width:${r.pct}%"></span></div>
            <div class="barras-val">${r.pct}%</div>
          </li>`;
        }).join('')}</ul>` : '<p class="vazio">Nenhuma chamada registrada ainda.</p>'}
      </div>

      <div class="card">
        <div class="card-head"><h2>Mensalidades em aberto</h2><a class="link" href="#/mensalidades">Ver todas</a></div>
        ${pend.length ? `<ul class="lista">${pend.slice(0, 5).map((p) => `
          <li>
            <div class="avatar">${esc(iniciais(p.membro.nome))}</div>
            <div class="lista-txt"><strong>${esc(p.membro.nome)}</strong>
              <small>${p.abertos.map((c) => MESES_CURTO[Number(c.slice(5)) - 1]).join(', ')}</small></div>
            <div class="valor-neg">${fmtBRL(p.total)}</div>
          </li>`).join('')}</ul>` : '<p class="vazio">Todos em dia. 🎉</p>'}
      </div>
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="card-head"><h2>Entradas e saídas por mês</h2></div>
        ${graficoFluxo(lancamentos, hoje)}
      </div>
      <div class="card">
        <div class="card-head"><h2>Próximos compromissos</h2><a class="link" href="#/calendario">Calendário</a></div>
        ${proximos.length ? `<ul class="agenda">${proximos.map((e) => `
          <li>
            <div class="agenda-data"><strong>${e.data.slice(8, 10)}</strong><small>${MESES_CURTO[Number(e.data.slice(5, 7)) - 1]}</small></div>
            <div class="lista-txt"><strong>${esc(e.titulo)}</strong>
              <small>${esc(TIPOS_EVENTO[e.tipo] || '')}${e.hora ? ' · ' + esc(fmtHora(e.hora)) : ''}${e.local ? ' · ' + esc(e.local) : ''}</small></div>
            <span class="chip chip-${esc(e.tipo)}">${esc(TIPOS_EVENTO[e.tipo] || e.tipo)}</span>
          </li>`).join('')}</ul>` : '<p class="vazio">Nada agendado.</p>'}
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Últimos lançamentos do caixa</h2><a class="link" href="#/caixa">Livro de caixa completo</a></div>
      ${tabelaLancamentos(ultimos)}
    </section>`;

  // tooltip do gráfico
  const graf = el.querySelector('.fluxo');
  const tip = el.querySelector('.fluxo-tip');
  graf?.querySelectorAll('.fluxo-col').forEach((col) => {
    const mostrar = () => {
      tip.innerHTML = col.dataset.tip;
      tip.hidden = false;
      const r = col.getBoundingClientRect(), g = graf.getBoundingClientRect();
      tip.style.left = `${Math.min(Math.max(r.left - g.left + r.width / 2, 70), g.width - 70)}px`;
    };
    col.addEventListener('mouseenter', mostrar);
    col.addEventListener('focus', mostrar);
    col.addEventListener('mouseleave', () => { tip.hidden = true; });
    col.addEventListener('blur', () => { tip.hidden = true; });
  });
}

export function tabelaLancamentos(linhas, { saldo = false, excluir = false } = {}) {
  if (!linhas.length) return '<p class="vazio">Nenhum lançamento.</p>';
  return `
    <div class="tabela-wrap"><table class="tabela">
      <thead><tr><th>Data</th><th>Descrição</th><th class="hide-sm">Categoria</th><th class="num">Valor</th>
        ${saldo ? '<th class="num hide-sm">Saldo</th>' : ''}${excluir ? '<th></th>' : ''}</tr></thead>
      <tbody>${linhas.map((l) => `
        <tr>
          <td class="muted nowrap">${fmtDia(l.data)}</td>
          <td><div>${esc(l.descricao)}</div>${saldo && l.criado_por ? `<small class="muted">Lançado por ${esc(l.criado_por)}</small>` : ''}
            <small class="muted show-sm">${esc(l.categoria)}</small></td>
          <td class="muted hide-sm">${esc(l.categoria)}</td>
          <td class="num nowrap ${l.tipo === 'entrada' ? 'valor-pos' : 'valor-neg'}">${l.tipo === 'entrada' ? '+' : '−'} ${fmtBRL(l.valor)}</td>
          ${saldo ? `<td class="num nowrap hide-sm">${fmtBRL(l.saldo)}</td>` : ''}
          ${excluir ? `<td class="acao"><button class="btn-icon sm" data-excluir="${l.id}" title="Excluir lançamento" aria-label="Excluir">${icon('lixo')}</button></td>` : ''}
        </tr>`).join('')}</tbody>
    </table></div>`;
}

// Gráfico de colunas agrupadas (entradas x saídas) dos últimos 6 meses, em HTML/CSS
function graficoFluxo(lancamentos, hoje) {
  const [a, m] = hoje.split('-').map(Number);
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(a, m - 1 - (5 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const dados = meses.map((c) => {
    const ls = lancamentos.filter((l) => l.data.startsWith(c) && l.categoria !== 'Saldo inicial');
    const soma = (t) => ls.filter((l) => l.tipo === t).reduce((s, l) => s + Number(l.valor), 0);
    return { c, ent: soma('entrada'), sai: soma('saida') };
  });
  const max = Math.max(1, ...dados.flatMap((d) => [d.ent, d.sai]));
  const teto = Math.ceil(max / 100) * 100;
  return `
    <div class="legenda"><span><i class="sw sw-ent"></i>Entradas</span><span><i class="sw sw-sai"></i>Saídas</span></div>
    <div class="fluxo" role="img" aria-label="Gráfico de entradas e saídas dos últimos 6 meses">
      <div class="fluxo-grade"><span>${fmtBRL(teto)}</span><span>${fmtBRL(teto / 2)}</span><span>R$ 0</span></div>
      <div class="fluxo-cols">
        ${dados.map((d) => `
          <div class="fluxo-col" tabindex="0" data-tip="<strong>${MESES[Number(d.c.slice(5)) - 1]}</strong><br><i class='sw sw-ent'></i>Entradas ${fmtBRL(d.ent)}<br><i class='sw sw-sai'></i>Saídas ${fmtBRL(d.sai)}<br>Resultado <b>${fmtBRL(d.ent - d.sai)}</b>">
            <div class="fluxo-par">
              <span class="col-ent" style="height:${(d.ent / teto) * 100}%"></span>
              <span class="col-sai" style="height:${(d.sai / teto) * 100}%"></span>
            </div>
            <small>${MESES_CURTO[Number(d.c.slice(5)) - 1]}</small>
          </div>`).join('')}
      </div>
      <div class="fluxo-tip" hidden></div>
    </div>`;
}

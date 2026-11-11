import {
  esc, fmtDia, fmtData, fmtHora, hojeISO, iniciais, icon, cabecalho, toast, tentar, TIPOS_EVENTO,
} from '../utils.js';
import { ativos, apoio, categoriaDe, CATEGORIAS, sessoesComChamada } from '../calculos.js';

const ROTULO = { P: 'Presente', F: 'Falta', J: 'Justificada' };

let eventoSelecionado = null; // lembra a sessão escolhida ao recarregar

export async function render(el, ctx) {
  const { db, admin } = ctx;
  const [membros, eventos, presencas] = await Promise.all(['membros', 'eventos', 'presencas'].map((t) => db.list(t)));
  const quadro = ativos(membros);        // DeMolays ativos → contam no quórum
  const convidados = apoio(membros);     // Seniores e consultores → lista separada
  const idsQuadro = new Set(quadro.map((m) => m.id));
  const hoje = hojeISO();
  const ordenados = [...eventos].sort((a, b) => b.data.localeCompare(a.data));

  if (!ordenados.some((e) => e.id === eventoSelecionado)) {
    eventoSelecionado = (ordenados.find((e) => e.data <= hoje) || ordenados[ordenados.length - 1])?.id ?? null;
  }
  const evento = ordenados.find((e) => e.id === eventoSelecionado);

  // Rascunho da chamada: começa com o que está salvo no banco
  const salvo = new Map(presencas.filter((p) => Number(p.evento_id) === Number(eventoSelecionado))
    .map((p) => [Number(p.membro_id), p.status]));
  const marcas = new Map(salvo);
  let alterado = false;

  // Histórico: as 4 sessões com chamada anteriores à selecionada
  const anteriores = evento ? sessoesComChamada(eventos, presencas)
    .filter((s) => s.data < evento.data).slice(0, 4).reverse() : [];
  const statusDe = (eid, mid) => presencas.find((p) => Number(p.evento_id) === Number(eid) && Number(p.membro_id) === mid)?.status;

  // Uma linha da chamada (usada nas duas listas)
  const linha = (m) => `
    <li data-id="${m.id}" data-nome="${esc(m.nome.toLowerCase())}">
      <div class="avatar ${categoriaDe(m) !== 'demolay' ? 'avatar-' + categoriaDe(m) : ''}">${esc(iniciais(m.nome))}</div>
      <div class="chamada-nome">
        <strong>${esc(m.nome)}</strong>
        <small>${esc(m.cargo)}
          <span class="hist">${anteriores.map((s) => {
            const st = statusDe(s.id, m.id);
            return `<i class="h h-${st || 'n'}" title="${fmtDia(s.data)}: ${ROTULO[st] || 'sem registro'}">${st || '·'}</i>`;
          }).join('')}</span>
        </small>
      </div>
      <div class="pfj" role="group" aria-label="Status de ${esc(m.nome)}">
        ${['P', 'F', 'J'].map((s) => `
          <button class="pfj-btn pfj-${s}" data-status="${s}" ${admin ? '' : 'disabled'} aria-pressed="false">
            <span class="pfj-curto">${s}</span><span class="pfj-longo">${ROTULO[s]}</span>
          </button>`).join('')}
      </div>
    </li>`;

  const acoes = `
    <button class="btn" id="exportar">${icon('pdf')} Exportar lista (PDF)</button>
    ${admin ? `<button class="btn btn-primary" id="salvar" ${evento ? '' : 'disabled'}>${icon('check')} Salvar chamada</button>` : ''}`;

  el.innerHTML = `
    ${cabecalho('Chamada da sessão', 'Controle de', 'Presença', acoes)}

    <section class="card filtros">
      <label class="field">
        <span>Sessão / evento</span>
        <select id="selEvento">
          ${ordenados.map((e) => `<option value="${e.id}" ${e.id === eventoSelecionado ? 'selected' : ''}>
            ${fmtData(e.data)} — ${esc(e.titulo)}${e.data > hoje ? ' (futura)' : ''}</option>`).join('')}
        </select>
      </label>
      ${evento ? `
        <div class="field"><span>Tipo</span><div class="field-static">${esc(TIPOS_EVENTO[evento.tipo] || evento.tipo)}</div></div>
        <div class="field"><span>Início</span><div class="field-static">${esc(fmtHora(evento.hora) || '—')}</div></div>` : ''}
      ${admin ? `<button class="btn" id="novaSessao">${icon('plus')} Nova sessão hoje</button>` : ''}
    </section>

    ${!evento ? '<div class="card"><p class="vazio">Nenhum evento cadastrado. Crie uma sessão no Calendário.</p></div>' : `
    <section class="kpis" id="kpisChamada"></section>

    <section class="card">
      <div class="chamada-tools">
        <label class="busca">${icon('busca')}<input type="search" id="busca" placeholder="Buscar membro…" aria-label="Buscar membro"></label>
        ${admin ? `<div class="tools-dir">
          <button class="btn sm" id="limpar">Limpar</button>
          <button class="btn sm btn-gold" id="todosPresentes">Marcar todos presentes</button>
        </div>` : ''}
      </div>
      ${!admin ? `<p class="aviso">${icon('cadeado')} Você está no modo de visualização. Apenas administradores podem registrar presença.</p>` : ''}
      <div class="secao-chamada">
        <h2>DeMolays ativos</h2>
        <span class="chip chip-ok">Contam no quórum · ${quadro.length}</span>
      </div>
      <div class="chamada-head"><span>Membro · ${anteriores.length ? `últimas ${anteriores.length} sessões` : 'histórico'}</span><span>Status nesta sessão</span></div>
      <ul class="chamada lista-pfj" id="listaChamada">
        ${quadro.map(linha).join('') || '<li class="vazio">Nenhum DeMolay ativo cadastrado.</li>'}
      </ul>
      <p class="legenda-hist">Legenda do histórico: <i class="h h-P">P</i> Presente <i class="h h-F">F</i> Falta <i class="h h-J">J</i> Justificada</p>
    </section>

    ${convidados.length ? `
    <section class="card card-apoio">
      <div class="secao-chamada">
        <h2>Seniores e Consultores</h2>
        <span class="chip chip-off">Não contam no quórum</span>
      </div>
      <p class="muted small sem-margem">${[...new Set(convidados.map(categoriaDe))].map((c) =>
        `${convidados.filter((m) => categoriaDe(m) === c).length} ${CATEGORIAS[c].plural}`).join(' · ')}</p>
      <ul class="chamada lista-pfj" id="listaApoio">${convidados.map(linha).join('')}</ul>
    </section>` : ''}
    ${admin ? `<div class="barra-salvar" id="barraSalvar" hidden><span id="resumoSalvar"></span><button class="btn btn-primary" id="salvar2">Salvar chamada</button></div>` : ''}`}
  `;

  // ---------- interações ----------
  el.querySelector('#selEvento')?.addEventListener('change', (e) => {
    if (alterado && !window.confirm('Há alterações não salvas nesta chamada. Trocar mesmo assim?')) {
      e.target.value = eventoSelecionado; return;
    }
    eventoSelecionado = Number(e.target.value);
    ctx.recarregar();
  });

  el.querySelector('#exportar').onclick = () => window.print();

  el.querySelector('#novaSessao')?.addEventListener('click', async () => {
    const novo = await tentar(() => db.insert('eventos', {
      titulo: 'Sessão ordinária', tipo: 'sessao', data: hoje, hora: '19:30', local: '', descricao: '',
    }), 'Sessão criada para hoje.');
    if (novo) { eventoSelecionado = novo.id; ctx.recarregar(); }
  });

  if (!evento) return;

  function pintar() {
    el.querySelectorAll('.lista-pfj li[data-id]').forEach((li) => {
      const st = marcas.get(Number(li.dataset.id));
      li.querySelectorAll('.pfj-btn').forEach((b) => {
        const on = b.dataset.status === st;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on);
      });
    });
    // Contagem do quórum: SOMENTE DeMolays ativos
    const vals = [...marcas].filter(([id]) => idsQuadro.has(id)).map(([, st]) => st);
    const P = vals.filter((v) => v === 'P').length;
    const F = vals.filter((v) => v === 'F').length;
    const J = vals.filter((v) => v === 'J').length;
    const pct = quadro.length ? Math.round((P / quadro.length) * 100) : 0;
    const apoioP = convidados.filter((m) => marcas.get(m.id) === 'P').length;
    el.querySelector('#kpisChamada').innerHTML = `
      <div class="kpi kpi-destaque"><div class="kpi-label">Quórum</div><div class="kpi-valor">${pct}% <small>(${P}/${quadro.length})</small></div>
        ${convidados.length ? `<div class="kpi-sub">+ ${apoioP} ${apoioP === 1 ? 'sênior/consultor presente' : 'seniores/consultores presentes'}</div>` : ''}</div>
      <div class="kpi"><div class="kpi-label">Presentes</div><div class="kpi-valor txt-gold">${P}</div></div>
      <div class="kpi"><div class="kpi-label">Faltas</div><div class="kpi-valor txt-red">${F}</div></div>
      <div class="kpi"><div class="kpi-label">Justificadas</div><div class="kpi-valor">${J}</div></div>`;
    const barra = el.querySelector('#barraSalvar');
    if (barra) {
      barra.hidden = !alterado;
      el.querySelector('#resumoSalvar').textContent = `Alterações não salvas · quórum ${P}/${quadro.length}`;
    }
  }
  pintar();

  if (admin) {
    el.querySelectorAll('.lista-pfj').forEach((ul) => ul.addEventListener('click', (e) => {
      const b = e.target.closest('.pfj-btn');
      if (!b) return;
      const id = Number(b.closest('li').dataset.id);
      if (marcas.get(id) === b.dataset.status) marcas.delete(id); else marcas.set(id, b.dataset.status);
      alterado = true; pintar();
    }));
    // "Marcar todos" marca só os DeMolays; seniores/consultores são marcados um a um
    el.querySelector('#todosPresentes').onclick = () => { quadro.forEach((m) => marcas.set(m.id, 'P')); alterado = true; pintar(); };
    el.querySelector('#limpar').onclick = () => { marcas.clear(); alterado = true; pintar(); };

    const salvar = async () => {
      const linhas = [...marcas].map(([membro_id, status]) => ({ evento_id: evento.id, membro_id, status }));
      const removidos = [...salvo.keys()].filter((id) => !marcas.has(id));
      const ok = await tentar(async () => {
        if (linhas.length) await db.upsert('presencas', linhas);
        for (const id of removidos) await db.remove('presencas', { evento_id: evento.id, membro_id: id });
        return true;
      }, 'Chamada salva!');
      if (ok) ctx.recarregar();
    };
    el.querySelector('#salvar').onclick = salvar;
    el.querySelector('#salvar2').onclick = salvar;
    if (!marcas.size) toast('Chamada ainda não registrada para esta sessão.', 'info');
  }

  el.querySelector('#busca').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    el.querySelectorAll('.lista-pfj li[data-id]').forEach((li) => { li.hidden = q && !li.dataset.nome.includes(q); });
  });
}

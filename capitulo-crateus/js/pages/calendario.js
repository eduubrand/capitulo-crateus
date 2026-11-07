import {
  esc, fmtHora, fmtDataLonga, hojeISO, icon, cabecalho, tentar, confirmar, abrirModal,
  MESES, MESES_CURTO, TIPOS_EVENTO,
} from '../utils.js';

let mesVisto = null; // 'AAAA-MM'

const iso = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export async function render(el, ctx) {
  const { db, admin } = ctx;
  const eventos = (await db.list('eventos'))
    .sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')));
  const hoje = hojeISO();
  mesVisto ||= hoje.slice(0, 7);
  const [ano, mes] = mesVisto.split('-').map(Number);

  const primeiroDia = new Date(ano, mes - 1, 1).getDay();      // 0 = domingo
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const celulas = [];
  for (let i = 0; i < primeiroDia; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(iso(ano, mes, d));
  while (celulas.length % 7) celulas.push(null);

  const doDia = (d) => eventos.filter((e) => e.data === d);
  const doMes = eventos.filter((e) => e.data.startsWith(mesVisto));
  const proximos = eventos.filter((e) => e.data >= hoje).slice(0, 6);

  el.innerHTML = `
    ${cabecalho('Agenda do capítulo', 'Calendário de', 'Atividades', admin
      ? `<button class="btn btn-primary" id="novoEvento">${icon('plus')} Novo evento</button>` : '')}

    <section class="grid-cal">
      <div class="card">
        <div class="cal-nav">
          <button class="btn-icon" id="ant" aria-label="Mês anterior">${icon('esq')}</button>
          <h2>${MESES[mes - 1]} <span class="muted">${ano}</span></h2>
          <button class="btn-icon" id="prox" aria-label="Próximo mês">${icon('dir')}</button>
          <button class="btn sm" id="hoje">Hoje</button>
        </div>
        <div class="cal" role="grid">
          ${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => `<div class="cal-dow">${d}</div>`).join('')}
          ${celulas.map((d) => {
            if (!d) return '<div class="cal-dia vazio-dia"></div>';
            const evs = doDia(d);
            return `<div class="cal-dia ${d === hoje ? 'hoje' : ''} ${admin ? 'clicavel' : ''}" data-dia="${d}">
              <span class="cal-num">${Number(d.slice(8))}</span>
              <div class="cal-evs">${evs.map((e) => `
                <button class="cal-ev chip-${esc(e.tipo)}" data-ev="${e.id}" title="${esc(e.titulo)}">
                  <span class="cal-ev-txt">${e.hora ? esc(fmtHora(e.hora)) + ' ' : ''}${esc(e.titulo)}</span>
                </button>`).join('')}</div>
            </div>`;
          }).join('')}
        </div>
        <div class="legenda">${Object.entries(TIPOS_EVENTO).map(([k, t]) => `<span><i class="sw chip-${k}"></i>${t}</span>`).join('')}</div>
      </div>

      <div class="coluna-lateral">
        <div class="card">
          <div class="card-head"><h2>Próximos</h2></div>
          ${listaEventos(proximos)}
        </div>
        <div class="card">
          <div class="card-head"><h2>Neste mês</h2><span class="muted small">${doMes.length} ${doMes.length === 1 ? 'evento' : 'eventos'}</span></div>
          ${listaEventos(doMes)}
        </div>
      </div>
    </section>`;

  const mudarMes = (delta) => {
    const d = new Date(ano, mes - 1 + delta, 1);
    mesVisto = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    ctx.recarregar();
  };
  el.querySelector('#ant').onclick = () => mudarMes(-1);
  el.querySelector('#prox').onclick = () => mudarMes(1);
  el.querySelector('#hoje').onclick = () => { mesVisto = hoje.slice(0, 7); ctx.recarregar(); };

  // onclick (e não addEventListener) para não acumular ouvintes a cada recarregar()
  el.onclick = (e) => {
    const ev = e.target.closest('[data-ev]');
    if (ev) { e.stopPropagation(); detalhes(eventos.find((x) => String(x.id) === ev.dataset.ev), ctx); return; }
    const dia = e.target.closest('.cal-dia.clicavel');
    if (dia && admin) formulario(ctx, { data: dia.dataset.dia });
  };
  el.querySelector('#novoEvento')?.addEventListener('click', () => formulario(ctx, { data: hoje }));
}

function listaEventos(evs) {
  if (!evs.length) return '<p class="vazio">Nada agendado.</p>';
  return `<ul class="agenda">${evs.map((e) => `
    <li class="clicavel-li" data-ev="${e.id}">
      <div class="agenda-data"><strong>${e.data.slice(8, 10)}</strong><small>${MESES_CURTO[Number(e.data.slice(5, 7)) - 1]}</small></div>
      <div class="lista-txt"><strong>${esc(e.titulo)}</strong>
        <small>${esc(TIPOS_EVENTO[e.tipo] || '')}${e.hora ? ' · ' + esc(fmtHora(e.hora)) : ''}</small></div>
      <i class="sw chip-${esc(e.tipo)}"></i>
    </li>`).join('')}</ul>`;
}

function detalhes(e, ctx) {
  const dlg = abrirModal(e.titulo, `
    <span class="chip chip-${esc(e.tipo)}">${esc(TIPOS_EVENTO[e.tipo] || e.tipo)}</span>
    <ul class="detalhes">
      <li>${icon('calendario')} ${esc(fmtDataLonga(e.data))}</li>
      ${e.hora ? `<li>${icon('relogio')} ${esc(fmtHora(e.hora))}</li>` : ''}
      ${e.local ? `<li>${icon('local')} ${esc(e.local)}</li>` : ''}
    </ul>
    ${e.descricao ? `<p class="muted">${esc(e.descricao)}</p>` : ''}
    ${ctx.admin ? `<div class="modal-actions">
      <button class="btn btn-danger-ghost" data-del>${icon('lixo')} Excluir</button>
      <button class="btn btn-primary" data-edit>${icon('editar')} Editar</button>
    </div>` : ''}`);
  if (!ctx.admin) return;
  dlg.querySelector('[data-edit]').onclick = () => { dlg.close(); formulario(ctx, e); };
  dlg.querySelector('[data-del]').onclick = async () => {
    dlg.close();
    if (!(await confirmar(`Excluir "${e.titulo}"? A chamada desse evento também será apagada.`))) return;
    if (await tentar(() => ctx.db.remove('eventos', { id: e.id }).then(() => true), 'Evento excluído.')) ctx.recarregar();
  };
}

function formulario(ctx, ev) {
  const editando = Boolean(ev.id);
  const dlg = abrirModal(editando ? 'Editar evento' : 'Novo evento', `
    <form class="form" id="formEvento">
      <label class="field"><span>Título</span><input name="titulo" required maxlength="80" value="${esc(ev.titulo || '')}" placeholder="Ex.: Sessão ordinária"></label>
      <div class="row-2">
        <label class="field"><span>Tipo</span>
          <select name="tipo">${Object.entries(TIPOS_EVENTO).map(([k, t]) => `<option value="${k}" ${ev.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Data</span><input name="data" type="date" required value="${esc(ev.data || '')}"></label>
      </div>
      <div class="row-2">
        <label class="field"><span>Horário</span><input name="hora" type="time" value="${esc((ev.hora || '').slice(0, 5))}"></label>
        <label class="field"><span>Local</span><input name="local" maxlength="80" value="${esc(ev.local || '')}"></label>
      </div>
      <label class="field"><span>Descrição</span><textarea name="descricao" rows="3" maxlength="500">${esc(ev.descricao || '')}</textarea></label>
      <div class="modal-actions">
        <button type="button" class="btn" data-fechar>Cancelar</button>
        <button class="btn btn-primary">${editando ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </form>`);
  const f = dlg.querySelector('form');
  f.titulo.focus();
  // Preenche o título automaticamente ao escolher o tipo
  f.tipo.onchange = () => { if (!f.titulo.value) f.titulo.value = { sessao: 'Sessão ordinária', reuniao: 'Reunião' }[f.tipo.value] || ''; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const dados = {
      titulo: f.titulo.value.trim(), tipo: f.tipo.value, data: f.data.value,
      hora: f.hora.value || null, local: f.local.value.trim(), descricao: f.descricao.value.trim(),
    };
    const ok = await tentar(() => (editando
      ? ctx.db.update('eventos', { id: ev.id }, dados)
      : ctx.db.insert('eventos', dados)).then(() => true), editando ? 'Evento atualizado.' : 'Evento adicionado.');
    if (ok) { dlg.close(); mesVisto = dados.data.slice(0, 7); ctx.recarregar(); }
  };
}

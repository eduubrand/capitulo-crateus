// Funções utilitárias compartilhadas por todas as páginas.

// Escapa texto antes de colocar em innerHTML (evita XSS: alguém cadastrar
// um membro chamado "<script>..." e o código rodar na tela dos outros).
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtBRL = (n) => brl.format(Number(n) || 0);

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
  'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Datas: trabalhamos com strings 'AAAA-MM-DD' (como o Postgres devolve)
// para não sofrer com fuso horário.
export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const parseISO = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
export const fmtDia = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
export const fmtData = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
export const fmtHora = (h) => (h ? h.slice(0, 5).replace(':', 'h') : '');
export function fmtDataLonga(s) {
  const d = parseISO(s);
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
}
export const competencia = (s) => s.slice(0, 7); // 'AAAA-MM'

export function iniciais(nome) {
  const p = String(nome).trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export const TIPOS_EVENTO = {
  sessao: 'Sessão ordinária',
  reuniao: 'Reunião',
  cerimonia: 'Cerimônia',
  evento: 'Evento',
  outro: 'Outro',
};

// ---------- Notificações ("toast") ----------
export function toast(msg, tipo = 'ok') {
  const box = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add('saindo'), 3200);
  setTimeout(() => t.remove(), 3600);
}

// ---------- Janela modal ----------
// Abre um <dialog> com o HTML dado. Retorna o elemento para ligar eventos.
export function abrirModal(titulo, corpoHtml) {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  dlg.innerHTML = `
    <div class="modal-head">
      <h3>${esc(titulo)}</h3>
      <button class="btn-icon" data-fechar aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body">${corpoHtml}</div>`;
  document.body.appendChild(dlg);
  // Substituímos close() para remover o elemento na hora. Não dependemos do
  // evento "close", que alguns navegadores disparam com atraso ou não disparam.
  const fecharNativo = HTMLDialogElement.prototype.close;
  dlg.aoFechar = null;
  dlg.close = () => {
    if (!dlg.isConnected) return;
    if (dlg.open) fecharNativo.call(dlg);
    dlg.remove();
    dlg.aoFechar?.();
  };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); dlg.close(); }); // tecla Esc
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-fechar]')) dlg.close();
  });
  dlg.showModal();
  return dlg;
}

// Fecha qualquer janela aberta (usado ao trocar de tela ou sair)
export function fecharModais() {
  document.querySelectorAll('dialog.modal').forEach((d) => (d.close ? d.close() : d.remove()));
}

export function confirmar(mensagem, textoBotao = 'Excluir') {
  return new Promise((resolve) => {
    const dlg = abrirModal('Confirmar', `
      <p class="muted">${esc(mensagem)}</p>
      <div class="modal-actions">
        <button class="btn" data-fechar>Cancelar</button>
        <button class="btn btn-danger" data-sim>${esc(textoBotao)}</button>
      </div>`);
    let resp = false;
    dlg.querySelector('[data-sim]').onclick = () => { resp = true; dlg.close(); };
    dlg.aoFechar = () => resolve(resp);
  });
}

// Executa uma ação assíncrona mostrando erro amigável se falhar.
export async function tentar(fn, msgOk) {
  try {
    const r = await fn();
    if (msgOk) toast(msgOk);
    return r;
  } catch (e) {
    console.error(e);
    toast(e.message || 'Algo deu errado.', 'erro');
    return undefined;
  }
}

// ---------- Ícones (SVG inline, traço de 1.8px) ----------
const ICONES = {
  painel: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  presenca: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 13l2 2 4-4"/>',
  caixa: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M7 3h10"/>',
  mensalidades: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 15h3"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.4"/>',
  membros: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  sair: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
  esq: '<path d="M15 5l-7 7 7 7"/>',
  dir: '<path d="M9 5l7 7-7 7"/>',
  pdf: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h4"/>',
  busca: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  local: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  chave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
  escudo: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  cadeado: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
};
export function icon(nome, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome] || ''}</svg>`;
}

// Cabeçalho padrão das páginas (rótulo dourado + título gótico)
export function cabecalho(rotulo, linha1, linha2, acoes = '') {
  return `
    <header class="page-head">
      <div>
        <div class="eyebrow">${esc(rotulo)}</div>
        <h1 class="page-title"><span>${esc(linha1)}</span><em>${esc(linha2)}</em></h1>
      </div>
      <div class="page-actions">${acoes}</div>
    </header>`;
}

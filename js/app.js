// =============================================================
// Ponto de entrada: autenticação, menu lateral e "roteador".
// O roteador usa o hash da URL (#/painel, #/caixa...) — assim o site
// funciona em qualquer hospedagem estática, sem configurar servidor.
// =============================================================
import { db } from './data/index.js';
import { CONFIG } from './config.js';
import { esc, icon, iniciais, toast, abrirModal, fecharModais } from './utils.js';
import { renderLogin } from './pages/login.js';
import * as painel from './pages/painel.js';
import * as presenca from './pages/presenca.js';
import * as caixa from './pages/caixa.js';
import * as mensalidades from './pages/mensalidades.js';
import * as calendario from './pages/calendario.js';
import * as membros from './pages/membros.js';
import * as admin from './pages/admin.js';

// soAdmin: a rota nem aparece no menu de quem não é administrador
const ROTAS = {
  painel: { titulo: 'Painel', icone: 'painel', mod: painel },
  presenca: { titulo: 'Presença', icone: 'presenca', mod: presenca },
  caixa: { titulo: 'Caixa', icone: 'caixa', mod: caixa },
  mensalidades: { titulo: 'Mensalidades', icone: 'mensalidades', mod: mensalidades },
  calendario: { titulo: 'Calendário', icone: 'calendario', mod: calendario },
  membros: { titulo: 'Membros', icone: 'membros', mod: membros },
  admin: { titulo: 'Administração', icone: 'escudo', mod: admin, soAdmin: true },
};

const app = document.getElementById('app');
let usuario = null;

async function iniciar() {
  try {
    usuario = await db.getUser();
  } catch (e) {
    console.error(e);
    usuario = null;
  }
  window.addEventListener('hashchange', render);
  render();
}

function rotaAtual() {
  const nome = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (!ROTAS[nome] || (ROTAS[nome].soAdmin && usuario?.role !== 'admin')) return 'painel';
  return nome;
}

function alterarSenha() {
  const dlg = abrirModal('Alterar minha senha', `
    <form class="form" autocomplete="off">
      <label class="field"><span>Nova senha</span><input type="password" name="nova" minlength="6" required autocomplete="new-password"></label>
      <label class="field"><span>Repita a nova senha</span><input type="password" name="conf" minlength="6" required autocomplete="new-password"></label>
      <p class="form-erro" role="alert"></p>
      <div class="modal-actions"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn btn-primary">Salvar</button></div>
    </form>`);
  const f = dlg.querySelector('form');
  f.nova.focus();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const erro = f.querySelector('.form-erro');
    if (f.nova.value.length < 6) { erro.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
    if (f.nova.value !== f.conf.value) { erro.textContent = 'As senhas não conferem.'; return; }
    try {
      await db.alterarMinhaSenha(f.nova.value);
      dlg.close(); toast('Senha alterada.');
    } catch (err) { erro.textContent = err.message; }
  };
}

function marca() {
  return `
    <div class="brand">
      <div class="eyebrow">Capítulo</div>
      <div class="brand-name">${esc(CONFIG.NOME_CAPITULO)}</div>
      <div class="brand-sub">${esc(CONFIG.SUBTITULO)}</div>
    </div>`;
}

async function render() {
  fecharModais();
  if (!usuario) {
    renderLogin(app, {
      db,
      aoEntrar: (u) => { usuario = u; if (!location.hash) location.hash = '#/painel'; render(); },
    });
    return;
  }

  const atual = rotaAtual();
  const admin = usuario.role === 'admin';
  const nav = Object.entries(ROTAS).filter(([, r]) => !r.soAdmin || admin).map(([k, r]) => `
    ${r.soAdmin ? '<div class="nav-sep">Restrito</div>' : ''}
    <a href="#/${k}" class="nav-item ${k === atual ? 'ativo' : ''}" ${k === atual ? 'aria-current="page"' : ''}>
      ${icon(r.icone)}<span>${r.titulo}</span>
    </a>`).join('');

  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar" id="sidebar">
        ${marca()}
        <nav class="nav">${nav}</nav>
        <div class="sidebar-foot">
          ${db.modo === 'demo' ? `<div class="demo-flag">${icon('info')}<span>Modo demonstração<br><small>dados salvos só neste navegador</small></span></div>` : ''}
          <div class="user-card">
            <div class="avatar">${esc(iniciais(usuario.nome))}</div>
            <div class="user-info">
              <strong>${esc(usuario.nome)}</strong>
              <small>${admin ? 'Administrador' : 'Membro · somente leitura'}</small>
            </div>
            <button class="btn-icon" id="trocarSenha" title="Alterar minha senha" aria-label="Alterar minha senha">${icon('chave')}</button>
            <button class="btn-icon" id="sair" title="Sair" aria-label="Sair">${icon('sair')}</button>
          </div>
        </div>
      </aside>
      <div class="scrim" id="scrim"></div>
      <div class="main-wrap">
        <header class="topbar">
          <button class="btn-icon" id="abrirMenu" aria-label="Abrir menu">${icon('menu')}</button>
          <div class="topbar-title">
            <span class="eyebrow">Capítulo</span>
            <span class="brand-name sm">${esc(CONFIG.NOME_CAPITULO)}</span>
          </div>
          <div class="avatar sm">${esc(iniciais(usuario.nome))}</div>
        </header>
        <main class="main" id="main"><div class="loading">Carregando…</div></main>
      </div>
    </div>`;

  document.title = `${ROTAS[atual].titulo} · Capítulo ${CONFIG.NOME_CAPITULO}`;

  const sidebar = document.getElementById('sidebar');
  const fecharMenu = () => document.body.classList.remove('menu-aberto');
  document.getElementById('abrirMenu').onclick = () => document.body.classList.add('menu-aberto');
  document.getElementById('scrim').onclick = fecharMenu;
  sidebar.querySelectorAll('.nav-item').forEach((a) => a.addEventListener('click', fecharMenu));
  document.getElementById('trocarSenha').onclick = () => { fecharMenu(); alterarSenha(); };
  document.getElementById('sair').onclick = async () => {
    await db.signOut();
    usuario = null;
    fecharMenu();
    toast('Você saiu da conta.');
    render();
  };

  const main = document.getElementById('main');
  const ctx = {
    db,
    usuario,
    admin,
    recarregar: () => ROTAS[atual].mod.render(main, ctx),
  };
  try {
    await ROTAS[atual].mod.render(main, ctx);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="card erro-card"><h3>Não foi possível carregar</h3><p class="muted">${esc(e.message)}</p></div>`;
  }
  main.focus?.();
  window.scrollTo(0, 0);
}

iniciar();

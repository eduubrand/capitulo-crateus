import { CONFIG } from '../config.js';
import { esc, icon } from '../utils.js';

export function renderLogin(app, { db, aoEntrar }) {
  const demo = db.modo === 'demo';
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-brand">
          <img class="login-logo" src="assets/logo-crateus.png" width="720" height="760"
               alt="Brasão do Capítulo Cidade de Crateús nº 831">
          <div class="eyebrow">Capítulo</div>
          <div class="brand-name xl">${esc(CONFIG.NOME_CAPITULO)}</div>
          <div class="brand-sub">${esc(CONFIG.SUBTITULO)}</div>
        </div>
        <form id="formLogin" class="form" novalidate>
          <label class="field">
            <span>ID do membro</span>
            <input type="text" name="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required placeholder="Ex.: arthur.lima">
          </label>
          <label class="field">
            <span>Senha</span>
            <input type="password" name="senha" autocomplete="current-password" required placeholder="••••••••">
          </label>
          <p class="form-erro" id="erroLogin" role="alert"></p>
          <button class="btn btn-primary btn-block" type="submit">${icon('cadeado')} Entrar</button>
        </form>
        ${demo ? `
          <div class="demo-box">
            <strong>Modo demonstração</strong>
            <p>Nenhum banco configurado ainda. Entre com um dos perfis de teste:</p>
            <div class="demo-btns">
              <button class="btn" data-demo="master|master123">Master<br><small class="muted">master · master123</small></button>
              <button class="btn" data-demo="rafael|admin123">Administrador<br><small class="muted">rafael · admin123</small></button>
              <button class="btn" data-demo="igor|membro123">Membro<br><small class="muted">igor · membro123</small></button>
            </div>
          </div>` : ''}
          <p class="login-hint">Seu ID e sua senha são cadastrados pela administração do capítulo. Esqueceu? Peça ao Escrivão para redefinir.</p>
      </div>
    </div>`;

  const form = app.querySelector('#formLogin');
  const erro = app.querySelector('#erroLogin');

  async function entrar(email, senha) {
    erro.textContent = '';
    if (!email || !senha) { erro.textContent = 'Preencha seu ID e sua senha.'; return; }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      aoEntrar(await db.signIn(email, senha));
    } catch (e) {
      erro.textContent = e.message;
      btn.disabled = false; btn.innerHTML = `${icon('cadeado')} Entrar`;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    entrar(form.email.value, form.senha.value);
  });
  app.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => {
    const [email, senha] = b.dataset.demo.split('|');
    form.email.value = email; form.senha.value = senha;
    entrar(email, senha);
  }));
}

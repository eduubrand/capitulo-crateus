// Aba "Administração": o admin cadastra os acessos (ID + senha) de cada membro.
import { esc, iniciais, icon, cabecalho, tentar, confirmar, abrirModal, toast } from '../utils.js';
import { ordenarMembros } from '../calculos.js';

const sugerirLogin = (nome) => {
  const p = String(nome).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  return p.length > 1 ? `${p[0]}.${p[p.length - 1]}` : (p[0] || '');
};

// Gera senha provisória legível (sem 0/O, 1/l para não confundir ao ditar)
function gerarSenha() {
  const c = 'abcdefghjkmnpqrstuvwxyz23456789';
  const a = new Uint32Array(8);
  crypto.getRandomValues(a);
  return [...a].map((n) => c[n % c.length]).join('');
}

export async function render(el, ctx) {
  const { db, usuario } = ctx;
  if (!ctx.admin) { location.hash = '#/painel'; return; }

  const [usuarios, membros] = await Promise.all([db.listarUsuarios(), db.list('membros')]);
  const listaMembros = ordenarMembros(membros);
  const nomeMembro = (id) => listaMembros.find((m) => m.id === Number(id))?.nome;
  const ordenados = [...usuarios].sort((a, b) => (a.role === b.role ? a.nome.localeCompare(b.nome) : a.role === 'admin' ? -1 : 1));
  const comAcesso = new Set(usuarios.map((u) => Number(u.membro_id)).filter(Boolean));
  const semAcesso = listaMembros.filter((m) => m.ativo && !comAcesso.has(m.id));
  const nAdmin = usuarios.filter((u) => u.role === 'admin').length;

  el.innerHTML = `
    ${cabecalho('Área restrita', 'Administração de', 'Acessos',
      `<button class="btn btn-primary" id="novo">${icon('plus')} Novo acesso</button>`)}

    <section class="kpis kpis-3">
      <div class="kpi kpi-destaque"><div class="kpi-label">Acessos cadastrados</div><div class="kpi-valor">${usuarios.length}</div>
        <div class="kpi-sub">${nAdmin} ${nAdmin === 1 ? 'administrador' : 'administradores'} · ${usuarios.length - nAdmin} ${usuarios.length - nAdmin === 1 ? 'membro' : 'membros'}</div></div>
      <div class="kpi"><div class="kpi-label">Membros ativos sem acesso</div><div class="kpi-valor ${semAcesso.length ? 'txt-red' : 'txt-gold'}">${semAcesso.length}</div>
        <div class="kpi-sub">${semAcesso.length ? 'Ainda não conseguem entrar' : 'Todos já podem entrar'}</div></div>
      <div class="kpi"><div class="kpi-label">Como o membro entra</div><div class="kpi-valor kpi-valor-sm">ID + senha</div>
        <div class="kpi-sub">Você cadastra aqui e repassa a ele</div></div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Acessos</h2></div>
      <div class="tabela-wrap"><table class="tabela">
        <thead><tr><th>Pessoa</th><th>ID de acesso</th><th class="hide-sm">Membro vinculado</th><th class="center">Perfil</th><th></th></tr></thead>
        <tbody>${ordenados.map((u) => `
          <tr>
            <td><div class="membro-cel"><div class="avatar">${esc(iniciais(u.nome))}</div>
              <div><strong>${esc(u.nome)}</strong>${u.id === usuario.id ? ' <small class="muted">(você)</small>' : ''}
              <small class="muted block show-sm">${esc(nomeMembro(u.membro_id) || '')}</small></div></div></td>
            <td><code class="login">${esc(u.login || '—')}</code></td>
            <td class="muted hide-sm">${esc(nomeMembro(u.membro_id) || '—')}</td>
            <td class="center"><span class="chip ${u.role === 'admin' ? 'chip-sessao' : 'chip-off'}">${u.role === 'admin' ? 'Administrador' : 'Membro'}</span></td>
            <td class="acao nowrap">
              <button class="btn-icon sm" data-senha="${esc(u.id)}" title="Redefinir senha" aria-label="Redefinir senha de ${esc(u.nome)}">${icon('chave')}</button>
              <button class="btn-icon sm" data-edit="${esc(u.id)}" title="Editar" aria-label="Editar ${esc(u.nome)}">${icon('editar')}</button>
              ${u.id === usuario.id ? '' : `<button class="btn-icon sm" data-del="${esc(u.id)}" title="Excluir acesso" aria-label="Excluir acesso de ${esc(u.nome)}">${icon('lixo')}</button>`}
            </td>
          </tr>`).join('')}</tbody>
      </table></div>
    </section>

    ${semAcesso.length ? `
    <section class="card">
      <div class="card-head"><h2>Membros ativos sem acesso</h2><span class="muted small">Clique para criar o acesso</span></div>
      <div class="chips-membros">${semAcesso.map((m) => `
        <button class="btn sm" data-criar-para="${m.id}">${icon('plus')} ${esc(m.nome)}</button>`).join('')}</div>
    </section>` : ''}

    <p class="aviso">${icon('info')} Administradores podem alterar todos os dados. Membros apenas visualizam. As senhas ficam criptografadas: nem o administrador consegue vê-las, só redefinir.</p>`;

  el.querySelector('#novo').onclick = () => formulario(ctx, {}, listaMembros, comAcesso);
  el.querySelectorAll('[data-criar-para]').forEach((b) => {
    b.onclick = () => {
      const m = listaMembros.find((x) => String(x.id) === b.dataset.criarPara);
      formulario(ctx, { nome: m.nome, membro_id: m.id, login: sugerirLogin(m.nome) }, listaMembros, comAcesso);
    };
  });
  el.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => formulario(ctx, usuarios.find((u) => u.id === b.dataset.edit), listaMembros, comAcesso);
  });
  el.querySelectorAll('[data-senha]').forEach((b) => {
    b.onclick = () => redefinir(ctx, usuarios.find((u) => u.id === b.dataset.senha));
  });
  el.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      const u = usuarios.find((x) => x.id === b.dataset.del);
      if (!(await confirmar(`Excluir o acesso de ${u.nome} (ID "${u.login}")? Ele não conseguirá mais entrar. O cadastro de membro e o histórico continuam.`))) return;
      if (await tentar(() => db.excluirUsuario(u.id).then(() => true), 'Acesso excluído.')) ctx.recarregar();
    };
  });
}

function formulario(ctx, u, membros, comAcesso) {
  const editando = Boolean(u.id);
  const proprio = u.id === ctx.usuario.id;
  // No select, só membros sem acesso (mais o já vinculado a este usuário)
  const opcoes = membros.filter((m) => !comAcesso.has(m.id) || m.id === Number(u.membro_id));
  const senhaSugerida = gerarSenha();

  const dlg = abrirModal(editando ? 'Editar acesso' : 'Novo acesso', `
    <form class="form" autocomplete="off">
      <label class="field"><span>Membro vinculado</span>
        <select name="membro_id">
          <option value="">— Nenhum (ex.: tio/consultor) —</option>
          ${opcoes.map((m) => `<option value="${m.id}" ${Number(u.membro_id) === m.id ? 'selected' : ''}>${esc(m.nome)} · ${esc(m.cargo)}</option>`).join('')}
        </select>
      </label>
      <label class="field"><span>Nome de exibição</span><input name="nome" required maxlength="80" value="${esc(u.nome || '')}"></label>
      <label class="field"><span>ID de acesso</span>
        <input name="login" required maxlength="40" pattern="[a-z0-9._\\-]{3,40}" value="${esc(u.login || '')}" ${editando ? 'disabled' : ''}
          autocapitalize="none" spellcheck="false" placeholder="ex.: arthur.lima">
        <small class="muted">${editando ? 'O ID não pode ser alterado. Para trocar, exclua e crie outro.' : 'Letras minúsculas, números, ponto ou hífen (3 a 40). É o que o membro digita para entrar.'}</small>
      </label>
      ${editando ? '' : `
      <label class="field"><span>Senha provisória</span>
        <div class="input-acao">
          <input name="senha" required minlength="6" value="${senhaSugerida}" spellcheck="false">
          <button type="button" class="btn sm" data-gerar>Gerar</button>
        </div>
        <small class="muted">Anote e repasse ao membro. Ele pode trocar depois em “Alterar senha”.</small>
      </label>`}
      <label class="field"><span>Perfil</span>
        <select name="role" ${proprio ? 'disabled' : ''}>
          <option value="membro" ${u.role !== 'admin' ? 'selected' : ''}>Membro — só visualiza</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador — pode alterar tudo</option>
        </select>
        ${proprio ? '<small class="muted">Você não pode mudar o seu próprio perfil.</small>' : ''}
      </label>
      <p class="form-erro" role="alert"></p>
      <div class="modal-actions">
        <button type="button" class="btn" data-fechar>Cancelar</button>
        <button class="btn btn-primary">${editando ? 'Salvar' : 'Criar acesso'}</button>
      </div>
    </form>`);

  const f = dlg.querySelector('form');
  const erro = f.querySelector('.form-erro');
  dlg.querySelector('[data-gerar]')?.addEventListener('click', () => { f.senha.value = gerarSenha(); });

  // Ao escolher um membro, preenche nome e sugere o ID
  f.membro_id.onchange = () => {
    const m = membros.find((x) => String(x.id) === f.membro_id.value);
    if (!m) return;
    f.nome.value = m.nome;
    if (!editando) f.login.value = sugerirLogin(m.nome);
  };
  if (!editando) f.login.addEventListener('input', () => { f.login.value = f.login.value.toLowerCase().replace(/\s/g, ''); });

  f.onsubmit = async (e) => {
    e.preventDefault();
    erro.textContent = '';
    const dados = {
      nome: f.nome.value.trim(),
      role: proprio ? 'admin' : f.role.value,
      membro_id: f.membro_id.value ? Number(f.membro_id.value) : null,
    };
    const botao = f.querySelector('.btn-primary');
    botao.disabled = true;
    try {
      if (editando) {
        await ctx.db.atualizarUsuario(u.id, dados);
        toast('Acesso atualizado.');
        dlg.close(); ctx.recarregar();
      } else {
        const login = f.login.value.trim();
        const senha = f.senha.value;
        await ctx.db.criarUsuario({ ...dados, login, senha });
        dlg.close();
        mostrarCredenciais(dados.nome, login, senha);
        ctx.recarregar();
      }
    } catch (err) {
      erro.textContent = err.message;
      botao.disabled = false;
    }
  };
}

function redefinir(ctx, u) {
  const dlg = abrirModal('Redefinir senha', `
    <form class="form" autocomplete="off">
      <p class="muted">Nova senha para <strong>${esc(u.nome)}</strong> (ID <code class="login">${esc(u.login)}</code>).</p>
      <label class="field"><span>Nova senha</span>
        <div class="input-acao"><input name="senha" required minlength="6" value="${gerarSenha()}" spellcheck="false">
          <button type="button" class="btn sm" data-gerar>Gerar</button></div>
      </label>
      <p class="form-erro" role="alert"></p>
      <div class="modal-actions"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn btn-primary">Redefinir</button></div>
    </form>`);
  const f = dlg.querySelector('form');
  dlg.querySelector('[data-gerar]').onclick = () => { f.senha.value = gerarSenha(); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await ctx.db.redefinirSenha(u.id, f.senha.value);
      dlg.close();
      mostrarCredenciais(u.nome, u.login, f.senha.value, 'Senha redefinida');
    } catch (err) { f.querySelector('.form-erro').textContent = err.message; }
  };
}

// Mostra ID e senha uma única vez, com botão de copiar a mensagem pronta
function mostrarCredenciais(nome, login, senha, titulo = 'Acesso criado') {
  const msg = `Olá, ${nome.split(' ')[0]}! Seu acesso ao sistema do Capítulo Crateús:\nSite: ${location.origin}${location.pathname}\nID: ${login}\nSenha: ${senha}\nVocê pode trocar a senha depois de entrar.`;
  const dlg = abrirModal(titulo, `
    <p class="muted">Repasse estes dados para <strong>${esc(nome)}</strong>. Depois de fechar, a senha não aparece de novo.</p>
    <div class="credenciais">
      <div><span>ID</span><code>${esc(login)}</code></div>
      <div><span>Senha</span><code>${esc(senha)}</code></div>
    </div>
    <div class="modal-actions">
      <button class="btn" data-copiar>${icon('copiar')} Copiar mensagem</button>
      <button class="btn btn-primary" data-fechar>Pronto</button>
    </div>`);
  dlg.querySelector('[data-copiar]').onclick = async () => {
    try { await navigator.clipboard.writeText(msg); toast('Mensagem copiada. Cole no WhatsApp do membro.'); }
    catch { toast('Não foi possível copiar automaticamente.', 'erro'); }
  };
}

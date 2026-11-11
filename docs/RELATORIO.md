# Relatório técnico — Site do Capítulo Crateús

Este relatório explica **o que foi construído, por que de cada decisão e como cada parte
funciona**, para servir de material de estudo. Sugestão: leia com o código aberto ao lado.

> **Versão 2:** nível *master*, categorias Sênior/Consultor, chamada em duas seções e brasão.
> As mudanças e o passo a passo de atualização estão em **[ATUALIZACAO-V2.md](ATUALIZACAO-V2.md)**.
> Partes deste relatório que falam em "admin gerencia acessos" valem agora para o **master**.

---

## 1. Visão geral

**Objetivo:** um sistema de secretaria para o capítulo, baseado nas artes (Painel, Presença,
Caixa, Mensalidades e versão mobile da chamada), com login, dois perfis de acesso, responsivo e
hospedável de graça.

**O que foi entregue**

- Tela de **login** (e-mail e senha).
- **Painel** com indicadores (KPIs), gráfico de entradas × saídas, presença por sessão,
  mensalidades em aberto, próximos compromissos e últimos lançamentos.
- **Presença**: chamada por evento, com P/F/J, quórum e histórico.
- **Caixa**: livro de caixa com saldo acumulado, filtros, novo lançamento, gráfico por categoria.
- **Mensalidades**: quadro membro × mês; ao marcar “pago”, entra uma receita no caixa.
- **Calendário**: grade mensal, criação/edição/exclusão de eventos.
- **Membros**: cadastro, cargos, ativo/inativo, frequência.
- **Administração** (só admin): cria o acesso (ID + senha) de cada membro, redefine senha,
  promove a admin, exclui acesso.
- **Perfis**: `admin` (lê e escreve) e `membro` (só lê). Todos entram com **ID + senha**.
- **Alterar minha senha**: qualquer usuário troca a própria senha (ícone de chave).
- **Modo demonstração**: funciona sem banco, para testar e apresentar.
- **Exportar PDF**: chamada e prestação de contas, usando a impressão do navegador.

---

## 2. Arquitetura e escolha de tecnologias

```
 Navegador (celular / PC)                         Supabase (nuvem, grátis)
┌─────────────────────────────┐   HTTPS + JSON   ┌───────────────────────────┐
│ index.html + CSS + JS        │ ───────────────▶ │ Auth (login, sessões JWT) │
│  • app.js (rotas, menu)      │                  │ PostgREST (API automática)│
│  • pages/*.js (telas)        │ ◀─────────────── │ PostgreSQL + RLS          │
│  • data/*.js (acesso a dados)│                  │ (tabelas, gatilhos)       │
└─────────────────────────────┘                  └───────────────────────────┘
   hospedado no GitHub Pages / Netlify (arquivos estáticos)
```

### Por que **HTML + CSS + JavaScript puro** (sem React, sem build)?

- **Não precisa instalar nada** (seu PC não tem Node.js). Abre e roda.
- **Hospedagem estática** é a mais fácil e barata (grátis) que existe: o servidor só entrega arquivos.
- Para estudo, você vê os fundamentos sem “mágica” de framework: DOM, eventos, `fetch`, módulos.
- Usa **módulos ES** (`import`/`export`) — o mesmo conceito que React/Vue usam por baixo.

**Trade-off:** sem framework, re-renderizamos a tela inteira com `innerHTML` a cada mudança.
Para o tamanho deste sistema (dezenas de membros) isso é instantâneo. Num sistema gigante,
um framework com DOM virtual (React) ou reatividade (Vue/Svelte) compensaria.

### Por que **Supabase**?

Um site estático não tem “servidor” para guardar dados nem verificar senha. O Supabase entrega isso pronto:

- **PostgreSQL**: banco relacional de verdade (o mesmo usado em empresas).
- **Auth**: cadastro/login com senha criptografada e tokens JWT.
- **API automática (PostgREST)**: cada tabela vira uma rota HTTP, sem escrever back-end.
- **RLS (Row Level Security)**: as regras de permissão ficam **dentro do banco**.

Alternativas consideradas: Firebase (NoSQL, regras em outra linguagem — Postgres ensina mais
SQL, que cai em prova e entrevista); back-end próprio em Node/PHP (precisaria de servidor pago
ou com hibernação, e muito mais código de segurança).

---

## 3. Estrutura de pastas

```
capitulo-crateus/
├── index.html              → página única; carrega fontes, CSS e js/app.js
├── css/style.css           → todo o visual (cores, layout, responsivo, impressão)
├── assets/favicon.svg      → ícone da aba
├── js/
│   ├── config.js           → URL/chave do Supabase (vazio = modo demo)
│   ├── app.js              → login, menu lateral, roteador por hash
│   ├── utils.js            → formatação (R$, datas), modal, toast, ícones, escape
│   ├── calculos.js         → regras de negócio puras (saldo, quórum, pendências)
│   ├── data/
│   │   ├── index.js        → escolhe Supabase ou demo
│   │   ├── supabase.js     → acesso ao banco real
│   │   ├── local.js        → banco falso no localStorage (modo demo)
│   │   └── seed.js         → dados de exemplo das artes
│   └── pages/              → uma tela por arquivo, todas com render(el, ctx)
│       ├── login.js  painel.js  presenca.js  caixa.js
│       └── mensalidades.js  calendario.js  membros.js  admin.js
├── supabase/schema.sql     → tabelas, gatilhos e regras de segurança
├── ferramentas/servidor-local.ps1 → servidor para testar no Windows
└── docs/                   → este relatório e o guia de hospedagem
```

**Princípio usado: separação de responsabilidades.**
*Tela* (pages) não sabe qual banco existe; *dados* (data) não sabe desenhar nada;
*cálculos* não sabem nem de tela nem de banco — só recebem listas e devolvem números.

---

## 4. Como o app funciona, passo a passo

### 4.1 Inicialização (`app.js`)

1. O navegador carrega `index.html`, que importa `js/app.js` como módulo.
2. `data/index.js` olha o `config.js`: se tem URL do Supabase, importa `supabase.js`; senão, `local.js`.
   Isso usa **`await import()` dinâmico** e **top-level await**.
3. `db.getUser()` verifica se já existe sessão (login salvo). Se não → tela de login.
4. Se há usuário, desenha o “shell” (menu + área principal) e chama `render()` da página atual.

### 4.2 Roteamento por hash

A URL fica como `site.com/#/caixa`. Tudo depois do `#` **não vai para o servidor**, então
não importa onde o site está hospedado — sempre é o mesmo `index.html` que responde.
O evento `hashchange` dispara quando você clica num link `<a href="#/caixa">`, e o `app.js`
troca a tela. (Roteamento com URLs “limpas” tipo `/caixa` exigiria configurar o servidor.)

### 4.3 Contrato das páginas

Toda página exporta `async function render(el, ctx)`:

- `el` → o elemento `<main>` onde desenhar.
- `ctx.db` → objeto de dados; `ctx.usuario`; `ctx.admin` (true/false);
  `ctx.recarregar()` → redesenha a página (usado depois de salvar algo).

Padrão interno de cada página: **(1)** buscar dados com `Promise.all` (em paralelo),
**(2)** calcular, **(3)** montar HTML com *template strings*, **(4)** ligar os eventos (`onclick`, `submit`).

### 4.4 Camada de dados — o padrão “Adapter”

`local.js` e `supabase.js` exportam um objeto `db` com **as mesmas funções**:

| Função | O que faz |
|---|---|
| `signIn(id, senha)` / `signOut()` / `getUser()` | autenticação |
| `alterarMinhaSenha(nova)` | o usuário logado troca a própria senha |
| `listarUsuarios()` / `criarUsuario()` / `atualizarUsuario()` / `redefinirSenha()` / `excluirUsuario()` | gestão de acessos (só admin) |
| `list(tabela)` | lê todas as linhas |
| `insert(tabela, linha)` | cria |
| `update(tabela, filtro, mudanças)` | altera |
| `remove(tabela, filtro)` | apaga |
| `upsert(tabela, linhas)` | cria ou atualiza pela chave primária |

Isso se chama **Adapter** (ou *Repository*): as telas programam contra uma interface, e a
implementação pode ser trocada. Ganho prático: o modo demo inteiro existe sem mexer em nenhuma tela.

---

## 5. Banco de dados (`supabase/schema.sql`)

### 5.1 Modelo

```
profiles (id → auth.users, nome, role,           ← quem faz login
          login, membro_id → membros)

membros ──┬──< presencas >── eventos             ← chamada = evento × membro
          │      (status P/F/J)
          └──< mensalidades ──> lancamentos      ← pagamento gera receita
                 (competencia 'AAAA-MM')
config (chave, valor)                            ← ex.: valor_mensalidade
```

Decisões importantes:

- **`membros` separado de `profiles`**: nem todo membro precisa ter login, e um admin pode não
  ser membro. Misturar os dois seria um erro de modelagem comum.
- **Chave primária composta** em `presencas (evento_id, membro_id)`: impede duas marcações do
  mesmo membro na mesma sessão — a regra fica garantida pelo banco, não pelo código.
- **Mensalidade como linha “paga”**: a existência da linha = pago; ausência = em aberto.
  O que está em aberto é **calculado** (meses até hoje sem linha), não armazenado. Menos dados
  duplicados = menos inconsistência.
- **`competencia` como texto `'AAAA-MM'`** com `check` por expressão regular: ordena
  corretamente como texto e evita confusão de fuso com datas.
- **`on delete cascade`**: excluir um evento apaga sua chamada automaticamente.
- **`check (valor > 0)`** e `check (tipo in (...))`: validação no banco, a última barreira.
- **Índices** em `data` para as consultas por período.

### 5.2 Gatilhos (triggers)

- `on_auth_user_created`: quando um usuário é criado no Auth, cria o `profile` com `role = 'membro'`.
- `trg_mensalidade_insert`: ao marcar mensalidade como paga, **insere o lançamento no caixa** e
  guarda o `lancamento_id`.
- `trg_mensalidade_delete`: ao desmarcar, **apaga o lançamento** correspondente.

Por que no banco e não no JavaScript? Porque assim é **atômico**: ou as duas coisas acontecem,
ou nenhuma. Se a internet cair no meio, não fica mensalidade paga sem entrada no caixa.

### 5.3 Segurança — RLS (Row Level Security)

Este é o conceito mais importante do projeto. **Esconder um botão não é segurança.** Qualquer
pessoa pode abrir o DevTools (F12) e chamar a API direto. Por isso as regras estão no banco:

```sql
create policy "leitura_logados" on membros for select to authenticated using (true);
create policy "escrita_admin"   on membros for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

- `to authenticated` → visitante sem login não lê nada.
- `is_admin()` → função que consulta `profiles.role` do usuário do token (`auth.uid()`).
- É `security definer` para conseguir ler `profiles` sem cair em recursão de políticas.

Na interface, `ctx.admin` só serve para **experiência do usuário** (não mostrar botões inúteis).
No modo demo, `local.js` imita a RLS com `exigirAdmin()` — testamos isso tentando gravar como
membro pelo console e recebemos “Permissão negada”.

**Sobre a anon key no código:** ela é pública por design. Ela só identifica o projeto; o que
cada pessoa pode fazer é decidido pelo token de login + RLS. A chave `service_role` (que ignora
RLS) **nunca** deve ir para o front-end.

### 5.4 Login por ID e cadastro de acessos pelo administrador

**Requisito:** o membro entra com um **ID** (não e-mail) e uma senha que o **administrador cadastra**.

**Problema 1: o Supabase Auth só entende e-mail.** Solução: o ID vira um e-mail “técnico”.
O usuário digita `arthur.lima`; o código (`loginParaEmail` em `supabase.js`) transforma em
`arthur.lima@crateus.app` antes de chamar `signInWithPassword`. Ninguém recebe e-mail nesse
endereço; ele é só uma chave única. Consequência: “esqueci minha senha” por e-mail não existe,
e quem redefine é o admin.

**Problema 2: criar usuário exige privilégio de servidor.** A tabela `auth.users` não pode ser
tocada pelo navegador (nem deveria: senão qualquer um criaria admins). Três caminhos possíveis:

| Opção | Como | Por que (não) usei |
|---|---|---|
| `supabase.auth.signUp()` no navegador | o próprio site cadastra | exigiria **cadastro público aberto**: qualquer pessoa criaria conta |
| *Edge Function* com a chave `service_role` | um mini back-end no Supabase | o jeito “oficial”, mas exige instalar a CLI/Deno e fazer deploy separado |
| **Função SQL `SECURITY DEFINER`** ✅ | `admin_criar_usuario()` no banco | um único arquivo SQL, sem deploy extra |

A função escolhida roda **com permissão do dono do banco**, mas só depois de checar
`pode_gerir_acessos()` (= quem chamou é admin). Ela:
1. valida o ID com regex (`^[a-z0-9._-]{3,40}$`) e a senha (mínimo 6);
2. insere em `auth.users` com a senha **criptografada com bcrypt** (`crypt(senha, gen_salt('bf'))`);
3. insere em `auth.identities` (o Supabase exige essa linha para o login por senha funcionar);
4. completa o `profiles` com nome, perfil, ID e membro vinculado.

`revoke ... from anon` garante que visitantes nem consigam chamar a função. Chamada pelo
SQL Editor (onde não há usuário logado, `auth.uid()` é nulo) ela é permitida: é assim que se
cria o **primeiro** admin, resolvendo o problema do “ovo e da galinha”.

> **Atenção (trade-off):** inserir direto em `auth.users` depende da estrutura interna do Supabase.
> Se um dia o Supabase mudar essas tabelas e a criação de acesso falhar, o caminho é migrar para
> uma Edge Function usando `supabase.auth.admin.createUser()`. É um bom exercício de estudo.

**Senhas:** nem o administrador consegue *ver* uma senha. O banco guarda só o *hash* bcrypt.
Por isso o site mostra a senha provisória **uma única vez**, logo após criar ou redefinir,
com um botão para copiar a mensagem e mandar ao membro.

**Regras de proteção extras:**
- O admin não pode **excluir o próprio acesso** nem **rebaixar a si mesmo** (trigger
  `trg_protege_proprio_admin`). Sem isso, o capítulo poderia ficar sem nenhum admin.
- A aba Administração tem `soAdmin: true` no roteador: nem aparece no menu do membro,
  e acessar `#/admin` na mão redireciona para o Painel. Mas, de novo, **a proteção real é
  no banco**: testamos chamar `criarUsuario()` como membro pelo console, e foi negado.

### 5.5 Outras proteções

- **XSS**: todo texto vindo do banco passa por `esc()` antes de entrar no `innerHTML`. Sem isso,
  um membro chamado `<img src=x onerror=alert(1)>` executaria código na tela de todo mundo.
- **Cadastro fechado**: o guia manda desativar o *sign up* público; só o admin cria contas.

---

## 6. Regras de negócio (`calculos.js`)

| Indicador | Como é calculado |
|---|---|
| **Saldo** | ordena lançamentos por data e soma `+entrada / −saída`, guardando o saldo de cada linha (livro de caixa) |
| **Quórum de uma sessão** | presentes ÷ membros ativos |
| **Presença média** | média do quórum das últimas 4 sessões que tiveram chamada |
| **Mensalidades em aberto** | para cada membro ativo, meses do semestre ≤ mês atual (e ≥ mês de cadastro) sem pagamento |
| **Frequência do membro** | (presenças + justificadas) ÷ chamadas registradas |
| **Próxima sessão** | primeiro evento do tipo sessão/cerimônia com data ≥ hoje |

Funções “puras” (mesma entrada → mesma saída, sem efeitos colaterais) são fáceis de testar.
Um próximo passo de estudo seria escrever testes para elas.

---

## 7. Interface e responsividade (`style.css`)

- **Design tokens**: cores em variáveis CSS (`--red`, `--gold`, `--surface`...), tiradas das artes.
  Mudar a identidade visual = mudar ~10 linhas.
- **Fontes**: *UnifrakturMaguntia* (gótica, títulos) e *Montserrat* (texto), do Google Fonts.
- **Layout**: CSS Grid para KPIs e colunas; Flexbox para linhas.
- **Breakpoints**:
  - `≤ 1100px`: KPIs em 2 colunas; caixa/calendário em coluna única.
  - `≤ 900px`: o menu lateral vira **gaveta** (botão ☰) com fundo escurecido.
  - `≤ 640px`: chamada com botões grandes **P / F / J** (como na arte mobile, alvo de toque ≥ 44px),
    calendário vira grade compacta com pontinhos coloridos, tabelas escondem colunas secundárias.
- **Impressão** (`@media print`): esconde menu e botões, troca para fundo branco — o
  “Exportar PDF” é só `window.print()` + “Salvar como PDF”. Zero bibliotecas.
- **Acessibilidade**: `aria-pressed` nos botões P/F/J, `aria-label` nos ícones, foco visível
  dourado, `<dialog>` nativo para modais (fecha com Esc), contraste de texto vermelho ajustado
  (`--red-ink`) para leitura em fundo escuro.

---

## 8. Fluxos importantes (para traçar no código)

**Salvar chamada** (`presenca.js`)
1. Ao abrir, copia do banco para um `Map` local (`marcas`) — o “rascunho”.
2. Clicar em P/F/J só altera o `Map` e repinta (`pintar()`), sem ir ao banco.
3. Aparece a barra “Alterações não salvas”.
4. “Salvar” → `upsert` das marcações + `remove` das que foram limpas → `recarregar()`.

**Pagar mensalidade** (`mensalidades.js`)
1. Clique em “Em aberto” → `db.insert('mensalidades', {...})`.
2. No banco, o gatilho cria o lançamento “Mensalidade de novembro/2026 — Fulano”.
3. `recarregar()` → KPIs atualizados; no Caixa, a entrada já aparece.
4. Excluir esse lançamento no Caixa também desmarca a mensalidade (o código detecta o vínculo).

---

## 9. Testes realizados

Testado no navegador, modo demonstração:

- Login por ID (aceita maiúsculas e espaços, que são normalizados); ID ou senha errados dão erro; logout.
- Admin cria acesso para um membro (ID sugerido `arthur.lima`), ID duplicado é recusado,
  o novo membro entra, troca a própria senha, e a senha antiga deixa de funcionar.
- Admin redefine senha, promove a admin, exclui acesso (o excluído não entra mais);
  não consegue excluir nem rebaixar a si mesmo.
- Membro não vê a aba Administração; acessar `#/admin` redireciona; criar acesso pelo console é negado.
- Painel com os mesmos números das artes (saldo R$ 1.842,50; presença 81%; 11 de 16).
- Marcar falta e salvar chamada → persistiu; KPIs recalculados (75%).
- Marcar mensalidade paga → 12 de 16, aberto R$ 140, entrada de R$ 20 no caixa, saldo R$ 1.862,50.
- Criar evento clicando num dia do calendário → aparece na grade.
- Perfil membro: nenhum botão de edição em nenhuma tela; gravação direta pelo console bloqueada.
- Celular (375px): sem rolagem horizontal em nenhuma tela; menu em gaveta; chamada P/F/J.

**Não testado** (precisa da sua conta): a conexão real com o Supabase, incluindo as funções
SQL de criação de acesso. O código segue a API oficial do `supabase-js` v2, mas valide
seguindo o guia de hospedagem.

**Bug encontrado nos testes e corrigido:** as janelas (modais) usavam o evento `close` do
`<dialog>` para se removerem da página, e esse evento não disparava em todos os casos. As
janelas ficavam acumuladas e até sobreviviam ao logout. A correção (em `utils.js`) foi
sobrescrever `dlg.close()` para remover o elemento na hora, sem depender do evento, e fechar
todas as janelas sempre que a tela muda. Lição: não dependa de eventos assíncronos para
limpeza essencial quando dá para fazer de forma direta.

---

## 10. Limitações e ideias de evolução (bons exercícios)

1. **Comprovantes** no caixa (a arte tem “Anexar foto ou PDF”): usar **Supabase Storage** e
   guardar a URL em `lancamentos.comprovante_url`.
2. **Lembrete aos pendentes** (botão da arte): gerar link `https://wa.me/55...?text=...` por membro.
3. **Migrar a criação de acessos para uma Edge Function** (`auth.admin.createUser`), que não
   depende da estrutura interna de `auth.users` (ver 5.4).
4. **Testes automatizados** das funções de `calculos.js` (Vitest/Jest).
5. **PWA**: `manifest.json` + *service worker* para “instalar” no celular e abrir offline.
6. **Auditoria**: tabela de histórico (quem alterou o quê e quando) via gatilho.
7. **Paginação**: `list()` traz tudo; com milhares de lançamentos, filtrar por período no banco.
8. **TypeScript**: tipar as linhas das tabelas para pegar erros antes de rodar.

---

## 11. Glossário rápido

- **SPA** (*Single Page Application*): um único HTML; o JS troca o conteúdo.
- **Módulo ES**: arquivo JS com `import/export`; precisa ser servido por HTTP.
- **KPI**: indicador-chave (os cartões do topo).
- **JWT**: token assinado que prova quem você é a cada requisição.
- **RLS**: regras por linha no Postgres; o banco decide o que cada usuário vê/altera.
- **Trigger**: função que o banco executa automaticamente em insert/update/delete.
- **Upsert**: insere ou, se a chave já existe, atualiza.
- **XSS**: injeção de código malicioso via texto exibido na página.
- **Adapter**: padrão que esconde implementações diferentes atrás da mesma interface.
- **SECURITY DEFINER**: função SQL que roda com as permissões de quem a criou, não de quem a chama.
- **Hash (bcrypt)**: transformação de mão única da senha; dá para conferir, mas não para “desfazer”.
- **RPC**: chamar uma função do banco pela API (`supabase.rpc('nome', {parametros})`).

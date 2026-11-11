# Atualização v2: master, Seniores/Consultores e brasão

Este guia ensina **como aplicar** a atualização no site que já está no ar, **sem perder os
dados** do Supabase, e **explica cada mudança** para você estudar.

---

## 1. O que mudou

| Mudança | Antes | Agora |
|---|---|---|
| **Níveis de acesso** | `admin` e `membro` | **`master`**, `admin` e `membro` |
| **Quem gerencia acessos e senhas** | qualquer admin | **só o master** |
| **Categorias de membro** | todos iguais | **DeMolay**, **Sênior DeMolay** e **Consultor** |
| **Chamada** | uma lista | DeMolays ativos + **lista separada** de Seniores e Consultores |
| **Quórum** | todos os ativos | **só DeMolays ativos** |
| **Mensalidades** | todos os ativos | **só DeMolays ativos** |
| **Visual** | texto "Crateús" | **brasão do capítulo** no login, no menu, no celular e no ícone da aba |

O que cada nível pode fazer:

| | Membro | Admin | Master |
|---|:-:|:-:|:-:|
| Ver painel, presença, caixa, mensalidades, calendário, membros | ✅ | ✅ | ✅ |
| Registrar presença, lançar no caixa, marcar mensalidade, editar calendário e membros | | ✅ | ✅ |
| Aba **Administração**: criar/excluir acessos, tornar alguém admin, redefinir senhas | | | ✅ |
| Trocar a **própria** senha | ✅ | ✅ | ✅ |
| Criar outro master / rebaixar um master | só pelo **SQL Editor** do Supabase |||

---

## 2. Conceito: o que é uma *migração* (e por que não rodar o `schema.sql` de novo)

O `schema.sql` **cria** o banco do zero. Seu banco já existe e tem dados, então ele precisa ser
**evoluído**, não recriado. Para isso existe a **migração**: um script que leva o banco da
versão N para a versão N+1.

A migração `supabase/migracoes/002_master_e_categorias.sql` foi escrita com três cuidados:

1. **Só acrescenta, nunca apaga.**
   `alter table membros add column if not exists categoria ... default 'demolay'` cria a coluna
   e preenche todo mundo que já existe com `'demolay'`. Nenhuma linha é removida.
2. **É uma transação** (`begin; ... commit;`).
   Se qualquer comando der erro no meio, o Postgres desfaz **tudo** (*rollback*) e o banco
   continua exatamente como estava. Ou aplica tudo, ou nada.
3. **É idempotente.** Rodar duas vezes dá o mesmo resultado que rodar uma: `if not exists`,
   `drop ... if exists` seguido de `create`, `create or replace`.

> ⚠️ **Não rode o `schema.sql` de novo no banco que já está em uso.** Ele tem as versões antigas
> das funções e políticas e desfaria parte desta migração. A regra daqui para frente é:
> banco novo → `schema.sql` + todas as migrações em ordem; banco existente → só as migrações que faltam.

---

## 3. Passo a passo para aplicar

> **A ordem importa.** Primeiro o banco, depois o site. O site novo envia o campo `categoria`
> ao salvar um membro; se o site for publicado antes da migração, salvar um membro dá
> erro ("column categoria does not exist"), porque a coluna ainda não existe.

### Passo 1: Backup (5 minutos, faça sempre)

No Supabase → **Table Editor** → abra cada tabela → botão **Export** → **Export to CSV**:
`profiles`, `membros`, `eventos`, `presencas`, `lancamentos`, `mensalidades`, `config`.
Guarde os arquivos numa pasta `backup-AAAA-MM-DD`. A migração não apaga nada, mas backup antes
de mexer em banco de produção é hábito de profissional.

### Passo 2: Rodar a migração

1. Supabase → **SQL Editor** → **New query**.
2. Abra `supabase/migracoes/002_master_e_categorias.sql`, copie **tudo**, cole e clique **Run**.
3. Deve aparecer *Success. No rows returned*.
   Se aparecer erro, **nada foi alterado** (por causa da transação). Copie a mensagem e me mande.

### Passo 3: Conferir quem virou master

A migração promove automaticamente a **primeira conta de administrador que foi criada** (a que
você fez no SQL Editor na instalação). Confira numa nova query:

```sql
select login, nome, role from public.profiles order by role, nome;
```

Se o master ficou com a pessoa errada, corrija (troque os IDs):

```sql
update public.profiles set role = 'admin'  where login = 'id_errado';
update public.profiles set role = 'master' where login = 'seu_id';
```

### Passo 4: Publicar o site novo

Copie os arquivos atualizados para onde o site está hospedado:

- **GitHub Pages:** na pasta do projeto, `git add .`, `git commit -m "v2: master, seniores/consultores e brasão"` e `git push`.
- **Netlify Drop:** arraste a pasta inteira de novo.

Arquivos novos ou alterados nesta versão:

```
assets/logo-crateus.png         (novo)   brasão grande, sem fundo
assets/logo-crateus-sm.png      (novo)   brasão pequeno, para o menu
assets/favicon-64.png           (novo)   ícone da aba
assets/apple-touch-icon.png     (novo)   ícone ao "adicionar à tela inicial" no iPhone
assets/favicon.svg              (removido)
index.html                      favicon e pré-carregamento do brasão
css/style.css                   estilos do brasão, master, categorias e chamada
js/calculos.js                  categorias, quórum só de DeMolays
js/app.js                       nível master, menu, brasão
js/data/index.js                atalho ?demo
js/data/local.js                regras do modo demo (espelham o banco)
js/data/supabase.js             comentários
js/data/seed.js                 seniores e consultores de exemplo
js/pages/admin.js               aba restrita ao master
js/pages/membros.js             categorias e cargos por categoria
js/pages/presenca.js            chamada em duas seções
js/pages/painel.js              quórum com a nova regra
js/pages/login.js               brasão e três perfis de teste
supabase/migracoes/002_...sql   (novo)   a migração
```

Depois de publicar, abra o site e aperte **Ctrl+F5** para o navegador não usar a versão antiga
guardada em cache.

### Passo 5: Reclassificar seniores e consultores

Todos os membros antigos entraram como **DeMolay**. Entre como admin ou master → **Membros** →
lápis ✏️ em cada sênior/consultor → **Categoria** → salvar. A partir daí eles saem do quórum e
das mensalidades e vão para a lista separada na chamada.

Você também pode fazer em lote no SQL Editor:

```sql
update public.membros set categoria = 'senior',    cargo = 'Sênior DeMolay'
 where nome in ('Fulano de Tal', 'Ciclano');
update public.membros set categoria = 'consultor', cargo = 'Consultor do Capítulo'
 where nome in ('Tio Beltrano');
```

### Passo 6: Testar (checklist)

- [ ] Entrar como **master**: aparece "Administrador master" no rodapé do menu e a aba **Administração**.
- [ ] Na Administração, criar um acesso de teste como **Administrador**.
- [ ] Entrar com esse admin: **não** aparece a aba Administração, mas dá para salvar uma chamada.
- [ ] Na **Presença**, seniores/consultores aparecem na lista "Seniores e Consultores", e marcá-los não muda o quórum.
- [ ] **Mensalidades** mostra só DeMolays.
- [ ] Excluir o acesso de teste.

### Se precisar desfazer (rollback)

Como nada foi apagado, voltar atrás é simples. **Só use se realmente precisar**:

```sql
begin;
update public.profiles set role = 'admin' where role = 'master';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','membro'));
commit;
```

Depois rode de novo a seção **4** do `schema.sql` (funções de acesso) e publique a versão antiga
do site. A coluna `categoria` pode ficar: o site antigo simplesmente a ignora.

---

## 4. Entendendo o código (para estudar)

### 4.1 Banco: três níveis com duas funções

O truque é **reaproveitar** o que já existia:

```sql
-- is_admin() é usada por TODAS as políticas de escrita (presença, caixa…).
-- Basta incluir 'master' aqui para o master herdar tudo do admin:
select exists (select 1 from profiles where id = auth.uid() and role in ('admin','master'));

-- Nova função, usada SÓ na gestão de acessos:
create function is_master() … role = 'master'
create function pode_gerir_acessos() … auth.uid() is null or is_master()
```

Isso é **hierarquia de papéis** (RBAC, *Role-Based Access Control*): em vez de dar permissões
pessoa por pessoa, damos permissões a **papéis** e cada pessoa tem um papel.

Duas proteções extras que vale entender:

- **Ninguém vira master pelo site.** Nem um master consegue promover outro: a função
  `admin_criar_usuario` recusa `p_role = 'master'` quando há usuário logado, e o gatilho
  `protege_proprio_admin` recusa qualquer `update` que mude o papel de/para master. Por quê?
  Se a senha do master vazar, o invasor não consegue criar outros masters "de reserva".
- **A política da tabela `profiles` mudou** de `is_admin()` para `is_master()`. Senão, um admin
  comum poderia mudar o próprio papel com um `update` direto pela API, sem usar o site.
  **Lembre: esconder o botão não protege nada; a regra no banco protege.**

### 4.2 Categoria: valor padrão garante compatibilidade

```js
// calculos.js
export const categoriaDe = (m) => (CATEGORIAS[m.categoria] ? m.categoria : 'demolay');
export const ativos = (ms) => ms.filter((m) => m.ativo && categoriaDe(m) === 'demolay');
export const apoio  = (ms) => ms.filter((m) => m.ativo && categoriaDe(m) !== 'demolay');
```

`categoriaDe` trata "sem categoria" como `'demolay'`. É **programação defensiva**: o site continua
funcionando mesmo com dados antigos ou incompletos.

Repare que a função `ativos()` já era usada pelo painel, pela presença e pelas mensalidades.
Mudando **só ela**, as três telas passaram a ignorar seniores e consultores no quórum e nas
cobranças. Esse é o ganho de ter as regras de negócio num único lugar (`calculos.js`).

### 4.3 Quórum: contar pelos IDs, não por tudo que foi marcado

Antes, `resumoChamada` contava **todas** as marcações do evento. Agora recebe a lista de quem
conta e filtra:

```js
export function resumoChamada(eventoId, presencas, quadro) {
  const ids = new Set(quadro.map((m) => Number(m.id)));
  const ps = presencas.filter((p) => p.evento_id == eventoId && ids.has(Number(p.membro_id)));
  …
}
```

Usar um `Set` torna a verificação `ids.has(x)` instantânea (O(1)) em vez de procurar na lista
inteira a cada presença (O(n)).

### 4.4 Chamada em duas seções sem duplicar código

Em `presenca.js`, a linha de um membro virou uma função `linha(m)`, usada nas **duas** listas:

```js
${quadro.map(linha).join('')}       // DeMolays ativos
${convidados.map(linha).join('')}   // Seniores e Consultores
```

E os eventos de clique são ligados nas duas listas pela classe comum `.lista-pfj`. Uma alteração
visual na linha vale para as duas seções automaticamente. Isso é o princípio **DRY** (*Don't
Repeat Yourself*).

### 4.5 Modo demo espelha o banco

`local.js` ganhou `exigirMaster()`, equivalente a `is_master()`. Sempre que uma regra muda no
SQL, ela muda também aqui. Assim o modo demonstração se comporta igual ao real e você testa sem
risco. Abra `http://localhost:5731/?demo` para usar o modo demo mesmo com o Supabase configurado.

### 4.6 Como o fundo preto do brasão foi removido

Não dava para simplesmente apagar "todo pixel preto": as **letras da faixa** ("Capítulo Cidade
de Crateús Nº 831") também são pretas e sumiriam. O método usado foi:

1. Marcar os pixels escuros (brilho < 45).
2. Agrupar os escuros **vizinhos** em "ilhas" (*flood fill*, o balde de tinta do Paint).
3. Apagar só as ilhas que **encostam na borda** da imagem (o fundo) e os vãos dentro das
   volutas laterais. As letras são ilhas pequenas cercadas de dourado, então ficam.
4. Suavizar a borda: pixels de transição ficam semitransparentes, com a cor corrigida
   (`cor / alfa`), para não ficar um contorno serrilhado.
5. Recortar as sobras e exportar em 4 tamanhos (para não carregar a imagem grande no celular à toa).

Isso foi feito com um script em C# rodando pelo PowerShell (`System.Drawing`), sem instalar nada.

---

## 5. Exercícios sugeridos

1. Mostrar no **Painel** um cartão "Seniores e consultores presentes na última sessão".
2. Na **Administração**, filtrar os acessos por nível (Master / Admin / Membro).
3. Criar a **migração 003** adicionando a coluna `telefone` em `membros`, seguindo o mesmo padrão
   (transação + `add column if not exists`), e um campo no formulário de membro.
4. Gerar um relatório de frequência separado: DeMolays × Seniores × Consultores.

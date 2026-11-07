# Guia de hospedagem gratuita

O site tem duas partes, e as duas têm plano gratuito:

| Parte | Serviço | O que fica lá | Custo |
|---|---|---|---|
| **Front-end** (HTML, CSS, JS) | GitHub Pages *ou* Netlify *ou* Vercel | Os arquivos desta pasta | Grátis |
| **Back-end** (banco + login) | Supabase | Tabelas, usuários e regras de segurança | Grátis (500 MB de banco) |

> ⚠️ No plano grátis o Supabase **pausa o projeto após 7 dias sem nenhum acesso**. Basta entrar no
> painel do Supabase e clicar em *Restore*. Com o capítulo usando toda semana, isso não acontece.

---

## Parte 1 — Banco de dados (Supabase)

1. Acesse <https://supabase.com>, clique em **Start your project** e entre com sua conta do GitHub.
2. **New project** → nome `capitulo-crateus`, crie uma senha forte para o banco (guarde-a),
   região **South America (São Paulo)** → **Create new project**. Espere ~2 minutos.
3. Menu lateral → **SQL Editor** → **New query**. Abra o arquivo `supabase/schema.sql` deste
   projeto, copie tudo, cole e clique em **Run**. Deve aparecer *Success. No rows returned*.
4. Menu → **Authentication** → **Sign In / Providers** → em *Email*, **desative “Allow new users to sign up”**
   (assim ninguém de fora cria conta sozinho; os acessos são criados pelo administrador no site).
5. Crie o **primeiro administrador** (você). Ainda no **SQL Editor**, numa nova query, rode
   trocando o ID, a senha e o nome:

   ```sql
   select public.admin_criar_usuario('admin', 'TroqueEstaSenha123', 'Gabriel Sousa', 'admin');
   ```

   Esse é o único acesso criado pelo SQL. **Todos os outros você cria pelo próprio site**, na
   aba **Administração** (só aparece para administradores): escolhe o membro, define o ID e uma
   senha provisória, e o site mostra uma mensagem pronta para copiar e mandar no WhatsApp.
   Cada membro pode trocar a própria senha depois, no ícone de chave ao lado do nome.
6. Menu → **Project Settings** → **API** (ou *Data API*). Copie:
   - **Project URL** (ex.: `https://abcd1234.supabase.co`)
   - **anon public key** (um texto longo começando com `eyJ...`)

## Parte 2 — Ligar o site ao banco

Abra `js/config.js` e preencha:

```js
export const CONFIG = {
  SUPABASE_URL: 'https://abcd1234.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...',
  ...
};
```

> **Pode deixar a anon key no código público?** Sim. Ela foi feita para ficar no navegador.
> Quem protege os dados são as **políticas RLS** do `schema.sql`: sem login ninguém lê nada, e
> só `admin` consegue gravar. **Nunca** coloque a chave `service_role` no site — essa ignora a RLS.

Teste localmente (`ferramentas/servidor-local.ps1`) e entre com o ID e a senha do passo 5. O aviso
"Modo demonstração" deve sumir. Ordem sugerida para começar:

1. **Membros** → cadastre o quadro do capítulo.
2. **Administração** → na lista "Membros ativos sem acesso", clique em cada um para criar o acesso.
3. Repasse ID e senha para cada membro.

> **Sobre o ID:** o membro digita só o ID (ex.: `arthur.lima`). Por baixo, o Supabase guarda
> `arthur.lima@crateus.app`, porque o Auth dele trabalha com e-mail. Esse endereço não recebe
> nada; por isso a recuperação de senha é feita pelo administrador (botão de chave na aba
> Administração), e não por e-mail. O domínio é configurado em `LOGIN_DOMINIO` (`js/config.js`)
> e em `v_dominio` (`supabase/schema.sql`); os dois precisam ser iguais.

## Parte 3 — Publicar o site

### Opção A — GitHub Pages (recomendado)

1. Crie um repositório no GitHub, ex.: `capitulo-crateus` (pode ser público).
2. Na pasta do projeto:

   ```bash
   git init
   git add .
   git commit -m "Site do Capítulo Crateús"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/capitulo-crateus.git
   git push -u origin main
   ```

3. No GitHub: **Settings** → **Pages** → *Source*: **Deploy from a branch** → branch `main`, pasta `/ (root)` → **Save**.
4. Em ~1 minuto o site estará em `https://SEU-USUARIO.github.io/capitulo-crateus/`.
5. Toda vez que você der `git push`, o site atualiza sozinho.

### Opção B — Netlify (sem usar git)

1. Entre em <https://app.netlify.com/drop>.
2. Arraste a pasta `capitulo-crateus` inteira para a página. Pronto, ele gera um link.
3. Em *Site configuration* dá para trocar o nome para `capitulo-crateus.netlify.app`.

## Domínio próprio (opcional)

Um domínio `.com.br` custa cerca de R$ 40/ano no Registro.br. GitHub Pages e Netlify
aceitam domínio próprio de graça, com HTTPS automático.

## Backup

Supabase → **Database** → **Backups** (o plano grátis guarda por pouco tempo). Para um backup
manual, use **Table Editor** → cada tabela → **Export to CSV**, uma vez por mês.

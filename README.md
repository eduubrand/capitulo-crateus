# Capítulo Crateús — Secretaria & Tesouraria

Sistema web do **Capítulo Crateús da Ordem DeMolay** para controlar presença, mensalidades,
livro de caixa e calendário, com painel de indicadores. Funciona no computador e no celular.

| Tela | O que faz |
|---|---|
| **Painel** | Saldo, presença média, mensalidades do mês, próxima sessão, gráfico de entradas × saídas, pendências e últimos lançamentos |
| **Presença** | Chamada por sessão (Presente / Falta / Justificada), quórum, histórico das últimas 4 sessões, exportar PDF |
| **Caixa** | Livro de caixa com saldo acumulado, filtro por período e tipo, novo lançamento, saídas por categoria, prestação de contas em PDF |
| **Mensalidades** | Quadro do semestre (membro × mês). Marcar como pago lança a entrada no caixa automaticamente |
| **Calendário** | Mês em grade, sessões, reuniões, cerimônias e eventos; adicionar/editar/excluir |
| **Membros** | Quadro de membros, cargos, ativo/inativo e frequência |
| **Administração** *(só master)* | Cria o acesso de cada membro (ID + senha), redefine senha, define quem é admin, exclui acesso |

**Perfis:** *Master* faz tudo e gerencia acessos · *Administrador* altera os dados · *Membro* só visualiza.
**Quadro:** DeMolays (contam no quórum e pagam mensalidade), Seniores DeMolay e Consultores (lista separada na chamada).
**Login:** todos entram com **ID + senha** cadastrados pelo administrador; cada um pode trocar a própria senha.

## Testar agora (modo demonstração)

Sem configurar nada, o site roda em **modo demonstração**: os dados de exemplo ficam salvos no
seu navegador. Como o site usa *módulos JavaScript*, ele precisa ser aberto por um servidor
(não funciona dando dois cliques no `index.html`). No Windows, rode no PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File ferramentas\servidor-local.ps1 -Root . -Port 5731
```

Depois abra <http://localhost:5731> e entre como **Administrador** ou **Membro** pelos botões da tela de login
(`master` / `master123`, `rafael` / `admin123` ou `igor` / `membro123`).
Com o Supabase já configurado, abra <http://localhost:5731/?demo> para usar o modo demonstração
sem tocar nos dados reais.

> **Atualizando de uma versão anterior?** Siga **[docs/ATUALIZACAO-V2.md](docs/ATUALIZACAO-V2.md)**.

> Alternativa: a extensão **Live Server** do VS Code também serve.

## Colocar no ar de graça

Passo a passo completo em **[docs/HOSPEDAGEM.md](docs/HOSPEDAGEM.md)**. Resumo:

1. Criar projeto grátis no **Supabase** e rodar `supabase/schema.sql` e depois as migrações de `supabase/migracoes/` em ordem.
2. Colar URL e *anon key* em `js/config.js`.
3. Subir a pasta no **GitHub** e ativar o **GitHub Pages** (ou arrastar a pasta no Netlify).
4. Criar o primeiro acesso com um comando SQL (ele vira **master**); os demais são criados pela aba **Administração**.

## Para estudar

O relatório técnico explicando arquitetura, banco, segurança e cada arquivo está em
**[docs/RELATORIO.md](docs/RELATORIO.md)**.

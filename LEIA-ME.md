# SQL Lab · Unidade II

Laboratório de SQL Server para a Unidade II de Modelagem de Banco de Dados Relacional e NoSQL (UNIP).

## Como abrir
Dê dois cliques em `index.html`. Funciona sem servidor e sem internet (as fontes do Google são opcionais).

## Estrutura
- `index.html` — marcação (Bootstrap 5.3)
- `css/styles.css` — tema claro/escuro, terminal e componentes
- `css/home.css` — página Início e Tutorial
- `css/api.css` — aba API ao vivo
- `js/data.js` — banco de exemplo, biblioteca de comandos, missões, Bug Lab e quiz
- `js/engine.js` — motor SQL (SQLite/WASM) + tradução T-SQL, Raio-X, linter e mensagens de erro no estilo SQL Server
- `js/home.js` — página Início com animações GSAP (teatro da consulta, relacionamentos, famílias de comandos)
- `js/tutorial.js` — 11 lições com SQL executável numa cópia do banco
- `js/api.js` — aba API ao vivo: formulário → API REST simulada → SQL → banco → JSON → tela, animado com GSAP + MotionPath
- `js/downloads.js` — gera os arquivos para SSMS, Azure Data Studio e DBeaver (.sql T-SQL, .db SQLite e esquema DDL)
- `js/app.js` — interface (terminal, explorador, missões, quiz, DER, exportação)
- `vendor/` — Bootstrap, sql.js e GSAP 3.12.5 (com ScrollTrigger e MotionPathPlugin)

Para adicionar missões, bugs ou questões, edite os arrays `LAB.MISSIONS`, `LAB.BUGS` e `LAB.QUIZ` em `js/data.js`.

## Abrir o banco em outras ferramentas
Menu **Banco → Baixar para SSMS / DBeaver** (também na Início, no DER e na Referência). Os arquivos são gerados na hora, a partir do banco original ou do estado atual.

## Publicar (GitHub Pages, Vercel, Netlify)
O projeto é 100% estático: não há servidor nem build. Basta enviar a pasta inteira.
- **GitHub Pages:** crie um repositório, envie os arquivos e ative *Settings → Pages → Deploy from a branch* (pasta raiz).
- **Vercel / Netlify:** importe o repositório e use a configuração "Other / sem framework", sem comando de build.

/* =====================================================================
   SQL Lab · Tutorial (lições com SQL executável numa cópia do banco)
   ===================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const G = window.gsap;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KEY = 'sqllab2.tutorial';
  const store = { get() { try { return JSON.parse(localStorage.getItem(KEY)) || { seen: {}, cur: 0 }; } catch (e) { return { seen: {}, cur: 0 }; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { } } };

  /* ------------------------------------------------------------------
     Lições
     ------------------------------------------------------------------ */
  const L = [
    {
      id: 'app', cat: 'SQL Lab', title: 'O que é esta aplicação',
      intro: 'O SQL Lab é um laboratório de SQL Server que roda inteiro no seu navegador. Ele traz um banco de dados de exemplo (uma pequena empresa com funcionários, clientes, produtos e pedidos) para você praticar os comandos da Unidade II sem instalar nada.',
      html: `<div class="tut-cols">
        <div class="xray-card"><h4>O que acontece quando você executa</h4><dl class="kv">
          <dt>1. Classifica</dt><dd>Diz a família do comando: DDL, DML, DQL, DCL ou TCL.</dd>
          <dt>2. Executa</dt><dd>Roda no banco e mostra o resultado em grade, como o SSMS.</dd>
          <dt>3. Explica</dt><dd>O Raio-X descreve cada cláusula e a ordem em que o servidor processa.</dd>
          <dt>4. Alerta</dt><dd>Aponta erros de lógica e más práticas, como UPDATE sem WHERE.</dd></dl></div>
        <div class="xray-card"><h4>As áreas do laboratório</h4><dl class="kv">
          <dt>Tutorial</dt><dd>Você está aqui: 11 lições curtas.</dd>
          <dt>Terminal</dt><dd>Escreva qualquer SQL. F5 ou Ctrl+Enter executa.</dd>
          <dt>Missões</dt><dd>27 exercícios com correção automática.</dd>
          <dt>Bug Lab</dt><dd>Erros clássicos para rodar e corrigir.</dd>
          <dt>Quiz · DER · Referência</dt><dd>Revisão, diagrama vivo e resumo da matéria.</dd></dl></div>
      </div>
      <div class="exam"><div class="eyebrow">Sem medo de errar</div>Os exemplos do tutorial rodam numa cópia do banco. No terminal as alterações são reais, mas o menu <b>Banco → Restaurar banco original</b> desfaz tudo. O motor é SQLite com uma camada que imita o SQL Server: quase tudo que a disciplina usa funciona igual.</div>`,
      examples: [{ l: 'Ver as tabelas do banco', sql: 'sp_tables;' }, { l: 'Uma primeira consulta', sql: 'SELECT nome, cargo FROM Funcionario;' }]
    },
    {
      id: 'modelo', cat: 'Conceitos', title: 'Tabelas, linhas, colunas e chaves',
      intro: 'Um banco relacional guarda dados em tabelas. Cada tabela trata de um assunto; cada linha é um registro; cada coluna é um atributo com um tipo de dado.',
      html: `<div class="tut-cols">
        <div><div class="syntax"><div class="lbl">Tabela Departamento (trecho)</div>
          <div class="tbl-wrap"><table class="mini-table w-100"><thead><tr><th style="color:var(--exam)">id_departamento (PK)</th><th>nome</th><th>localizacao</th></tr></thead>
          <tbody><tr><td>1</td><td>Tecnologia</td><td>São Paulo</td></tr><tr><td>2</td><td>Financeiro</td><td>São Paulo</td></tr><tr><td>6</td><td>Jurídico</td><td>Brasília</td></tr></tbody></table></div></div></div>
        <div><dl class="kv">
          <dt style="color:var(--exam)">PRIMARY KEY</dt><dd>Identifica cada linha. Não repete e não pode ser NULL.</dd>
          <dt>FOREIGN KEY</dt><dd>Coluna que aponta para a PK de outra tabela. Funcionario.id_departamento aponta para Departamento.</dd>
          <dt>NULL</dt><dd>Ausência de valor. Não é zero nem texto vazio.</dd></dl></div>
      </div>
      <p>No banco do laboratório há 7 tabelas. As que você mais vai usar: <code>Funcionario</code>, <code>Departamento</code>, <code>Cliente</code>, <code>Pedido</code>, <code>ItemPedido</code> e <code>Produto</code>. A aba DER mostra como elas se ligam.</p>`,
      examples: [{ l: 'Colunas e chaves de Funcionario', sql: 'sp_help Funcionario;' }, { l: 'Todos os departamentos', sql: 'SELECT * FROM Departamento;' }]
    },
    {
      id: 'select', cat: 'DQL', title: 'SELECT e FROM: lendo dados',
      intro: 'SELECT diz quais colunas você quer; FROM diz de qual tabela. É o comando mais usado do SQL e nunca altera nada no banco.',
      syntax: 'SELECT coluna1, coluna2 AS apelido\nFROM Tabela;',
      does: ['Lê e exibe as colunas pedidas, de todas as linhas da tabela.', 'AS dá um nome (alias) para a coluna no resultado.', 'DISTINCT remove linhas repetidas do resultado.'],
      not: ['Não altera, insere nem apaga dados.', 'SELECT * traz tudo, mas em sistemas reais é melhor listar as colunas.'],
      examples: [{ l: 'Escolher colunas', sql: 'SELECT nome, cargo, salario\nFROM Funcionario;' }, { l: 'Alias com AS', sql: 'SELECT nome AS funcionario,\n       salario * 12 AS salario_anual\nFROM Funcionario;' }, { l: 'DISTINCT', sql: 'SELECT DISTINCT cargo\nFROM Funcionario;' }],
      tip: 'Sem AS, uma expressão como <code>salario * 12</code> aparece como "(Nenhum nome de coluna)", igual ao SSMS.'
    },
    {
      id: 'where', cat: 'DQL', title: 'WHERE: filtrando linhas',
      intro: 'WHERE testa uma condição em cada linha. Só as linhas em que a condição é verdadeira entram no resultado.',
      syntax: "SELECT colunas\nFROM Tabela\nWHERE condição;",
      html: `<div class="anno">
        <div class="anno-row"><code>salario &gt; 5000</code><span>comparação: = &lt;&gt; &gt; &lt; &gt;= &lt;=</span></div>
        <div class="anno-row"><code>cargo IN ('Analista','Gerente')</code><span>pertence a uma lista (substitui vários OR)</span></div>
        <div class="anno-row"><code>salario BETWEEN 3000 AND 6000</code><span>intervalo inclusivo: 3000 e 6000 entram</span></div>
        <div class="anno-row"><code>nome LIKE 'J%'</code><span>padrão de texto: % = qualquer sequência, _ = um caractere</span></div>
        <div class="anno-row"><code>id_departamento IS NULL</code><span>ausência de valor (nunca use = NULL)</span></div>
        <div class="anno-row"><span><code>a AND b</code> · <code>a OR b</code> · <code>NOT a</code></span><span>combinações lógicas</span></div></div>`,
      does: ['Filtra linha a linha, antes de qualquer agrupamento.'],
      not: ['Não aceita funções agregadas como SUM ou AVG (isso é HAVING).', 'Não enxerga aliases criados no SELECT.'],
      examples: [{ l: 'Comparação', sql: 'SELECT nome, salario\nFROM Funcionario\nWHERE salario > 5000;' }, { l: 'LIKE + AND', sql: "SELECT nome, salario\nFROM Funcionario\nWHERE nome LIKE 'J%' AND salario BETWEEN 1000 AND 9000;" }, { l: 'IS NULL', sql: 'SELECT nome, cargo\nFROM Funcionario\nWHERE id_departamento IS NULL;' }, { l: 'Erro clássico: = NULL', sql: 'SELECT nome\nFROM Funcionario\nWHERE id_departamento = NULL;' }],
      tip: '<code>= NULL</code> não dá erro, mas nunca retorna linhas. Rode o último exemplo e veja o alerta.'
    },
    {
      id: 'order', cat: 'DQL', title: 'ORDER BY e TOP: ordenando e limitando',
      intro: 'ORDER BY ordena o resultado final: ASC (crescente, o padrão) ou DESC (decrescente). TOP, do T-SQL, limita quantas linhas voltam.',
      syntax: 'SELECT TOP 5 colunas\nFROM Tabela\nORDER BY coluna DESC;',
      does: ['Ordena por uma ou várias colunas (ORDER BY cargo, salario DESC).', 'TOP n devolve só as n primeiras linhas.'],
      not: ['Não muda a ordem em que os dados estão gravados.', 'TOP sem ORDER BY não garante quais linhas virão.'],
      examples: [{ l: 'Maiores salários', sql: 'SELECT TOP 5 nome, salario\nFROM Funcionario\nORDER BY salario DESC;' }, { l: 'Duas colunas', sql: 'SELECT cargo, nome, salario\nFROM Funcionario\nORDER BY cargo, salario DESC;' }]
    },
    {
      id: 'agg', cat: 'DQL', title: 'Agregação: COUNT, SUM, AVG e GROUP BY',
      intro: 'Funções de agregação resumem várias linhas em um número. Com GROUP BY, o resumo é feito por grupo. HAVING filtra os grupos depois de formados.',
      syntax: 'SELECT coluna_do_grupo, COUNT(*), AVG(coluna)\nFROM Tabela\nWHERE filtro_de_linhas\nGROUP BY coluna_do_grupo\nHAVING filtro_de_grupos;',
      does: ['COUNT conta, SUM soma, AVG tira a média, MAX e MIN acham extremos.', 'GROUP BY gera uma linha por valor distinto da coluna agrupada.', 'HAVING aceita condições com agregação: HAVING SUM(salario) > 15000.'],
      not: ['Coluna no SELECT que não está agregada precisa estar no GROUP BY (erro 8120).', 'WHERE não filtra grupos.'],
      examples: [{ l: 'Totais gerais', sql: 'SELECT COUNT(*) AS qtd, SUM(salario) AS folha, AVG(salario) AS media\nFROM Funcionario;' }, { l: 'Por departamento', sql: 'SELECT id_departamento, COUNT(*) AS qtd, AVG(salario) AS media\nFROM Funcionario\nGROUP BY id_departamento;' }, { l: 'HAVING', sql: 'SELECT id_departamento, SUM(salario) AS folha\nFROM Funcionario\nGROUP BY id_departamento\nHAVING SUM(salario) > 15000;' }, { l: 'Erro 8120', sql: 'SELECT id_departamento, nome, AVG(salario)\nFROM Funcionario\nGROUP BY id_departamento;' }],
      tip: 'Ordem lógica: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY. Por isso a agregação vai no HAVING e não no WHERE.'
    },
    {
      id: 'join', cat: 'DQL', title: 'JOIN: juntando tabelas',
      intro: 'Os dados ficam espalhados em tabelas diferentes. O JOIN junta as linhas que combinam pela condição ON, geralmente PK = FK.',
      syntax: 'SELECT A.coluna, B.coluna\nFROM TabelaA A\nINNER JOIN TabelaB B ON B.fk = A.pk;',
      html: `<div class="anno">
        <div class="anno-row"><code>INNER JOIN</code><span>só as linhas que têm par nas duas tabelas</span></div>
        <div class="anno-row"><code>LEFT JOIN</code><span>todas da esquerda; sem par, a direita vem NULL</span></div>
        <div class="anno-row"><code>RIGHT JOIN</code><span>todas da direita; sem par, a esquerda vem NULL</span></div>
        <div class="anno-row"><code>FULL JOIN</code><span>todas dos dois lados</span></div>
        <div class="anno-row"><code>CROSS JOIN</code><span>produto cartesiano: N × M linhas, sem ON</span></div></div>`,
      does: ['Combina colunas de tabelas diferentes na mesma linha do resultado.', 'Aliases (F, D) deixam a consulta curta e evitam colunas ambíguas.'],
      not: ['Sem a condição ON correta, vira produto cartesiano.', 'INNER JOIN esconde registros sem correspondência.'],
      examples: [{ l: 'INNER JOIN', sql: 'SELECT F.nome, D.nome AS departamento\nFROM Funcionario F\nINNER JOIN Departamento D ON D.id_departamento = F.id_departamento;' }, { l: 'LEFT JOIN', sql: 'SELECT D.nome AS departamento, F.nome AS funcionario\nFROM Departamento D\nLEFT JOIN Funcionario F ON F.id_departamento = D.id_departamento;' }, { l: 'Clientes sem pedido', sql: 'SELECT C.nome\nFROM Cliente C\nLEFT JOIN Pedido P ON P.id_cliente = C.id_cliente\nWHERE P.id_pedido IS NULL;' }],
      tip: 'Compare INNER e LEFT: o departamento Jurídico só aparece no LEFT JOIN, com funcionario = NULL.'
    },
    {
      id: 'dml', cat: 'DML', title: 'INSERT, UPDATE e DELETE: alterando dados',
      intro: 'Estes comandos mudam o conteúdo das tabelas. O servidor responde com quantas linhas foram afetadas.',
      syntax: "INSERT INTO Tabela (col1, col2) VALUES (v1, v2);\nUPDATE Tabela SET col = valor WHERE condição;\nDELETE FROM Tabela WHERE condição;",
      does: ['INSERT adiciona linhas novas.', 'UPDATE altera colunas das linhas que passam no WHERE.', 'DELETE remove as linhas que passam no WHERE.'],
      not: ['UPDATE e DELETE sem WHERE atingem a tabela inteira.', 'DELETE não remove a tabela (isso é DROP, que é DDL).', 'As restrições continuam valendo: FK, UNIQUE, CHECK e NOT NULL podem recusar a alteração.'],
      examples: [{ l: 'INSERT', sql: "INSERT INTO Cliente (nome, email, cidade, uf)\nVALUES ('Bazar Central', 'bazar@central.com', 'Sorocaba', 'SP');\nSELECT * FROM Cliente WHERE uf = 'SP';" }, { l: 'UPDATE', sql: "UPDATE Produto SET preco = preco * 1.05\nWHERE categoria = 'Papelaria';\nSELECT nome, preco FROM Produto WHERE categoria = 'Papelaria';" }, { l: 'DELETE com cascata', sql: "DELETE FROM Pedido WHERE id_pedido = 1;\nSELECT COUNT(*) AS itens_do_pedido_1 FROM ItemPedido WHERE id_pedido = 1;" }, { l: 'Violação de FK', sql: "INSERT INTO Pedido (id_cliente, data_pedido)\nVALUES (999, '2025-05-01');" }],
      tip: 'Hábito profissional: rode antes um SELECT com o mesmo WHERE para ver quais linhas serão atingidas.'
    },
    {
      id: 'tcl', cat: 'TCL', title: 'Transações: BEGIN, COMMIT e ROLLBACK',
      intro: 'Uma transação agrupa alterações: ou todas valem (COMMIT) ou nenhuma vale (ROLLBACK). É a rede de segurança de quem altera dados.',
      syntax: 'BEGIN TRANSACTION;\n    -- alterações\nCOMMIT;    -- confirma\n-- ou\nROLLBACK;  -- desfaz',
      does: ['ROLLBACK desfaz tudo desde o BEGIN TRANSACTION.', 'COMMIT torna as alterações definitivas.'],
      not: ['Depois do COMMIT, o ROLLBACK não desfaz mais.'],
      examples: [{ l: 'Desastre desfeito', sql: 'BEGIN TRANSACTION;\nUPDATE Funcionario SET salario = 0 WHERE 1 = 1;\nSELECT nome, salario FROM Funcionario;\nROLLBACK;\nSELECT nome, salario FROM Funcionario;' }]
    },
    {
      id: 'ddl', cat: 'DDL', title: 'CREATE TABLE e restrições',
      intro: 'CREATE TABLE define uma tabela nova: colunas, tipos de dados e as regras (restrições) que protegem a integridade.',
      syntax: 'CREATE TABLE Nome (\n    id    INT PRIMARY KEY IDENTITY(1,1),\n    campo NVARCHAR(100) NOT NULL,\n    valor DECIMAL(10,2) CHECK (valor >= 0),\n    fk_id INT FOREIGN KEY REFERENCES Outra(id)\n);',
      html: `<div class="anno">
        <div class="anno-row"><code>PRIMARY KEY</code><span>identifica a linha; IDENTITY(1,1) gera 1, 2, 3...</span></div>
        <div class="anno-row"><code>NOT NULL</code><span>valor obrigatório</span></div>
        <div class="anno-row"><code>UNIQUE</code><span>não pode repetir</span></div>
        <div class="anno-row"><code>CHECK (cond)</code><span>regra lógica, como salário não negativo</span></div>
        <div class="anno-row"><code>DEFAULT valor</code><span>valor padrão quando a coluna é omitida</span></div>
        <div class="anno-row"><code>DECIMAL(10,2)</code><span>tipo exato para dinheiro (nunca FLOAT)</span></div></div>`,
      does: ['Cria a estrutura vazia, pronta para receber INSERTs.'],
      not: ['Não insere dados.', 'Não pode ser criada duas vezes com o mesmo nome (erro 2714).'],
      examples: [{ l: 'Criar e testar o CHECK', sql: "CREATE TABLE Fornecedor (\n    id_fornecedor  INT PRIMARY KEY IDENTITY(1,1),\n    razao_social   NVARCHAR(120) NOT NULL,\n    cnpj           CHAR(14) UNIQUE,\n    limite_credito DECIMAL(10,2) CHECK (limite_credito >= 0)\n);\nINSERT INTO Fornecedor (razao_social, cnpj, limite_credito)\nVALUES ('Papelaria Alfa', '12345678000199', 5000);\nINSERT INTO Fornecedor (razao_social, cnpj, limite_credito)\nVALUES ('Beta Ltda', '98765432000111', -10);\nSELECT * FROM Fornecedor;" }]
    },
    {
      id: 'fim', cat: 'Próximos passos', title: 'Pronto para praticar',
      intro: 'Você viu as cinco famílias de comandos e o essencial de cada uma. Agora é praticar.',
      html: `<div class="tut-cols">
        <div class="xray-card"><h4>Atalhos do terminal</h4><dl class="kv">
          <dt>F5 · Ctrl+Enter</dt><dd>executa</dd><dt>seleção</dt><dd>executa só o trecho selecionado</dd>
          <dt>Ctrl+↑ / ↓</dt><dd>histórico</dd><dt>help</dt><dd>lista os comandos do terminal</dd>
          <dt>desc Tabela</dt><dd>mostra colunas e chaves</dd></dl></div>
        <div class="xray-card"><h4>Para onde ir agora</h4>
          <div class="d-grid gap-2">
            <button class="btn-lab" type="button" data-view="terminal">Abrir o terminal</button>
            <button class="btn-ghost" type="button" data-view="missoes">Fazer as missões</button>
            <button class="btn-ghost" type="button" data-view="bugs">Estudar os bugs clássicos</button>
            <button class="btn-ghost" type="button" data-view="quiz">Testar com o quiz</button>
          </div></div></div>`,
      examples: []
    }
  ];

  /* ------------------------------------------------------------------
     Estado e renderização
     ------------------------------------------------------------------ */
  let st = store.get(); let ed = null; let exIdx = 0;
  function save() { store.set(st); }
  function progress() {
    const n = L.filter(l => st.seen[l.id]).length;
    $('#tutProgTxt').textContent = `${n}/${L.length}`; $('#tutProgBar').style.width = (100 * n / L.length) + '%';
    const nav = $('#navTut'); if (nav) nav.textContent = `${n}/${L.length}`;
  }
  function rail() {
    $('#tutRail').innerHTML = L.map((l, i) => `<button type="button" class="${i === st.cur ? 'on' : ''} ${st.seen[l.id] ? 'seen' : ''}" data-i="${i}" ${i === st.cur ? 'aria-current="step"' : ''}><span class="n">${st.seen[l.id] ? '✓' : i + 1}</span><span>${esc(l.title)}</span></button>`).join('');
    $$('#tutRail button').forEach(b => b.addEventListener('click', () => open(+b.dataset.i)));
    const on = $('#tutRail button.on'); if (on && window.innerWidth < 992) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function catChip(c) { return ['DQL', 'DML', 'DDL', 'DCL', 'TCL'].includes(c) ? `<span class="cat cat-${c}">${c}</span>` : `<span class="lvl">${esc(c)}</span>`; }
  function open(i, dir) {
    const prev = st.cur; st.cur = Math.max(0, Math.min(L.length - 1, i)); exIdx = 0;
    st.seen[L[st.cur].id] = true; save();
    const l = L[st.cur]; const A = window.LabApp; const hl = A ? A.highlight : esc;
    const list = (arr, cls, mark) => arr && arr.length ? arr.map(t => `<li><span class="${cls}">${mark}</span><span>${esc(t)}</span></li>`).join('') : '';
    const doesNot = (l.does || l.not) ? `<div class="xray-card"><h4>O que faz · o que não faz</h4><ul class="does">${list(l.does, 'y', '✓')}${list(l.not, 'n', '✗')}</ul></div>` : '';
    const syntax = l.syntax ? `<div class="syntax"><div class="lbl">Sintaxe</div><pre class="code">${hl(l.syntax)}</pre></div>` : '';
    const tryBox = l.examples && l.examples.length ? `<div class="tut-try"><div class="d-flex justify-content-between align-items-center flex-wrap gap-2"><h3>Experimente</h3><span class="small text-muted-2">roda numa cópia do banco · F5 executa</span></div>
        <div class="ex-chips">${l.examples.map((e, k) => `<button type="button" data-ex="${k}" class="${k === 0 ? 'on' : ''}">${esc(e.l)}</button>`).join('')}</div>
        <div id="tutEditor"></div>
        <div class="d-flex gap-2 flex-wrap"><button class="btn-lab btn-sm-lab" type="button" id="tutRun">▶ Executar</button><button class="btn-ghost btn-sm-lab" type="button" id="tutToTerm">Abrir no terminal</button></div>
        <div class="tut-out" id="tutOut"></div></div>` : '';
    $('#tutStage').innerHTML = `<div class="tut-inner">
        <div class="d-flex gap-2 align-items-center flex-wrap"><span class="eyebrow">Lição ${st.cur + 1} de ${L.length}</span>${catChip(l.cat)}</div>
        <h2>${esc(l.title)}</h2>
        <p class="intro">${esc(l.intro)}</p>
        ${syntax || doesNot ? `<div class="tut-cols">${syntax}${doesNot}</div>` : ''}
        ${l.html || ''}
        ${l.tip ? `<div class="exam"><div class="eyebrow">Ponto de atenção</div>${l.tip}</div>` : ''}
        ${tryBox}
      </div>
      <div class="tut-nav">
        <button class="btn-ghost" type="button" id="tutPrev" ${st.cur === 0 ? 'disabled' : ''}>← Anterior</button>
        ${st.cur < L.length - 1 ? `<button class="btn-lab" type="button" id="tutNext">Próxima: ${esc(L[st.cur + 1].title)} →</button>` : `<button class="btn-lab" type="button" data-view="terminal">Ir para o terminal →</button>`}
      </div>`;
    if (A && l.examples && l.examples.length) {
      ed = A.makeEditor($('#tutEditor'), { boxed: true, id: 'tutSql', onRun: run });
      ed.set(l.examples[0].sql);
      $$('[data-ex]').forEach(b => b.addEventListener('click', () => { exIdx = +b.dataset.ex; $$('[data-ex]').forEach(x => x.classList.toggle('on', x === b)); ed.set(l.examples[exIdx].sql); run(); }));
      $('#tutRun').addEventListener('click', run);
      $('#tutToTerm').addEventListener('click', () => A.sendToTerminal(ed.get(), false));
    } else ed = null;
    const pb = $('#tutPrev'); if (pb) pb.addEventListener('click', () => open(st.cur - 1, -1));
    const nb = $('#tutNext'); if (nb) nb.addEventListener('click', () => open(st.cur + 1, 1));
    rail(); progress();
    if (G && !reduce && prev !== undefined) {
      const d = dir || (st.cur >= prev ? 1 : -1);
      G.from('#tutStage .tut-inner > *', { x: 24 * d, opacity: 0, duration: .4, stagger: .04, ease: 'power2.out', clearProps: 'all' });
    }
    if (dir) $('#tutStage').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  /** Executa o SQL do editor numa cópia do banco e mostra o resultado. */
  function run() {
    const A = window.LabApp; if (!A || !ed) return;
    const sql = ed.get().trim(); const outEl = $('#tutOut'); if (!sql) return;
    let entries;
    try { const sandbox = A.engine.clone(); sandbox.safeMode = true; entries = A.flatten(sandbox.run(sql)); }
    catch (e) { outEl.innerHTML = `<div class="alert-lab al-erro"><b>Erro:</b> ${esc(e.message)}</div>`; return; }
    let h = '';
    entries.forEach(e => {
      const a = e.analysis || {};
      const chip = a.cat ? `<span class="cat cat-${esc(a.cat)}">${esc(a.cat)}</span> ` : '';
      if (e.kind === 'result') h += `<div class="mt-2">${chip}<span class="small text-muted-2">${e.total} linha(s)</span><div class="term mt-1">${A.tableHTML(e.cols, e.rows, { maxRows: 50 })}</div></div>`;
      else if (e.kind === 'msg') h += `<div class="alert-lab al-ok mt-2"><span>${chip}${esc(e.msg)}</span></div>`;
      else if (e.kind === 'error') h += `<div class="alert-lab al-erro mt-2"><b>${chip}${e.err.code ? 'Msg ' + e.err.code + ': ' : ''}${esc(e.err.title)}</b>${e.err.why ? `<span>${esc(e.err.why)}</span>` : ''}${e.err.fix ? `<span class="fx">→ ${esc(e.err.fix)}</span>` : ''}</div>`;
      else if (e.kind === 'blocked') h += `<div class="alert-lab al-atencao mt-2"><b>${esc(e.msg)}</b></div>`;
      const w = (a.warnings || []).filter(x => x.level === 'erro' || x.level === 'atencao');
      w.forEach(x => { h += `<div class="alert-lab al-${x.level} mt-2"><b>Alerta:</b> <span>${esc(x.text)}</span>${x.fix ? `<span class="fx">→ ${esc(x.fix)}</span>` : ''}</div>`; });
    });
    outEl.innerHTML = h;
    if (G && !reduce) G.from(outEl.children, { y: 8, opacity: 0, duration: .3, stagger: .05, clearProps: 'all' });
  }

  function onShow() { if (!$('#tutRail').children.length) open(st.cur || 0); }
  function openByCat(cat) { const i = L.findIndex(l => l.cat === cat); if (window.LabApp) window.LabApp.go('tutorial'); open(i < 0 ? 0 : i, 1); }

  document.addEventListener('keydown', (e) => {
    if ($('#view-tutorial').hidden) return;
    if (e.target.closest('textarea, input')) return;
    if (e.key === 'ArrowRight' && st.cur < L.length - 1) open(st.cur + 1, 1);
    if (e.key === 'ArrowLeft' && st.cur > 0) open(st.cur - 1, -1);
  });
  document.addEventListener('lab:ready', progress, { once: true });
  window.LabTutorial = { onShow, run, openByCat, count: L.length };
})();

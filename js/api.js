/* =====================================================================
   SQL Lab · API ao vivo
   Uma tela (formulário) chama uma API simulada, que monta SQL e consulta
   uma cópia do banco do laboratório. GSAP + MotionPath animam o caminho
   do pedido: Tela → API → Banco → API → Tela.
   ===================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const G = window.gsap;
  if (G && window.MotionPathPlugin) G.registerPlugin(MotionPathPlugin);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let speed = 1;
  const D = (s) => reduce ? 0.01 : s / speed;
  const brl = (n) => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sleep = (ms) => new Promise(r => setTimeout(r, reduce ? 0 : ms / speed));
  const tween = (t, v) => new Promise(r => { if (!G) { r(); return; } G.to(t, { ...v, duration: D(v.duration ?? .5), onComplete: r }); });
  const STATUS = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 404: 'Not Found', 409: 'Conflict', 500: 'Internal Server Error' };

  /* ------------------------------------------------------------------
     Banco da API (cópia do banco do laboratório)
     ------------------------------------------------------------------ */
  let db = null;
  function buildDb() {
    const A = window.LabApp;
    try { db = A.engine.clone(); }
    catch (e) { db = new SQLEngine.Engine(A.engine.SQL); db.run(LAB.SEED_SQL + LAB.SEED_PROCS); }
    db.safeMode = false;
    if (!db.procs().some(p => p.name.toLowerCase() === 'sp_pedidosdocliente')) db.run(LAB.SEED_PROCS);
    db.run(`CREATE TABLE IF NOT EXISTS Usuario (
      id INTEGER PRIMARY KEY AUTOINCREMENT, login VARCHAR(40) NOT NULL UNIQUE,
      senha VARCHAR(60) NOT NULL, perfil VARCHAR(20) NOT NULL);`);
    if (!db.scalar('SELECT COUNT(*) FROM Usuario')) db.run("INSERT INTO Usuario (login, senha, perfil) VALUES ('admin','Adm#2026!','administrador'),('ana.souza','ana123','vendedor'),('bruno.c','bruno@1','estoquista');");
  }
  const L = (v) => db.literal(v);
  const fill = (sql, params) => sql.replace(/@(\w+)/g, (m, k) => params.hasOwnProperty(k) ? L(params[k]) : m);
  /** Executa no banco da API e devolve um resumo. */
  function q(sql) {
    const t0 = performance.now();
    const list = window.LabApp.flatten(db.run(sql));
    const ms = performance.now() - t0;
    const err = list.find(e => e.kind === 'error');
    const res = [...list].reverse().find(e => e.kind === 'result');
    const msg = [...list].reverse().find(e => e.kind === 'msg' && /linha/.test(e.msg));
    const affected = msg ? +(msg.msg.match(/\((\d+)/) || [0, 0])[1] : 0;
    return { error: err ? err.err : null, cols: res ? res.cols : [], rows: res ? res.rows : [], affected, ms };
  }
  const objs = (r) => r.rows.map(row => Object.fromEntries(r.cols.map((c, i) => [c, row[i]])));
  const list = (sql) => db.query(sql).rows;

  /* ------------------------------------------------------------------
     Cenários
     ------------------------------------------------------------------ */
  const UFS = ['SP', 'RJ', 'MG', 'PR', 'SC', 'BA', 'PE', 'RS', 'GO', 'DF'];
  const SC = [
    /* ---------------- 1. Buscar ---------------- */
    {
      id: 'buscar', method: 'GET', label: 'Buscar funcionários', page: 'lojalab.app/equipe',
      form: () => {
        const deps = list('SELECT id_departamento, nome FROM Departamento ORDER BY nome');
        return `<h3>Equipe</h3><div class="sub">Filtre os funcionários por departamento e salário.</div>
          <form class="app-form" id="appForm" novalidate>
            <label>Departamento<select id="f_depto" data-k="depto"><option value="">Todos</option>${deps.map(d => `<option value="${d[0]}" ${d[0] === 1 ? 'selected' : ''}>${esc(d[1])}</option>`).join('')}</select></label>
            <label>Salário mínimo (R$)<input id="f_min" data-k="salarioMin" type="number" value="5000" step="500"></label>
            <div class="app-actions full"><button class="app-submit" type="submit">Buscar</button><button class="app-link" type="button" data-fill='{"f_min":"-10"}'>testar salário negativo</button></div>
          </form><div class="app-out" id="appOut"><div class="app-ph">Os resultados aparecem aqui.</div></div>`;
      },
      read: () => ({ depto: $('#f_depto').value ? +$('#f_depto').value : null, salarioMin: $('#f_min').value === '' ? 0 : +$('#f_min').value }),
      request: (v) => ({ method: 'GET', path: '/api/funcionarios?' + [v.depto !== null ? 'depto=' + v.depto : '', 'salarioMin=' + v.salarioMin].filter(Boolean).join('&') }),
      fetchCode: "fetch(`/api/funcionarios?depto=${depto}&salarioMin=${min}`)",
      route: () => [
        "app.get('/api/funcionarios', async (req, res) => {",
        "  const depto = req.query.depto ? Number(req.query.depto) : null;",
        "  const salarioMin = Number(req.query.salarioMin ?? 0);",
        "  if (salarioMin < 0)",
        "    return res.status(400).json({ erro: 'salarioMin não pode ser negativo' });",
        "  const rows = await db.query(SQL_BUSCAR_FUNCIONARIOS,",
        "                              { depto, salarioMin });",
        "  res.status(200).json(rows);",
        "});"],
      marks: { recv: [0, 1, 2], check: [3], bad: [4], sql: [5, 6], ok: [7] },
      validate: (v) => v.salarioMin < 0 ? { field: 'f_min', erro: 'salarioMin não pode ser negativo' } : null,
      plan(v) {
        const p = { depto: v.depto, salarioMin: v.salarioMin };
        const text = `SELECT F.nome, F.cargo, F.salario, D.nome AS departamento
FROM Funcionario F
LEFT JOIN Departamento D ON D.id_departamento = F.id_departamento
WHERE (@depto IS NULL OR F.id_departamento = @depto)
  AND F.salario >= @salarioMin
ORDER BY F.salario DESC;`;
        return { params: p, shown: text, exec: () => q(fill(text, p)) };
      },
      respond: (r) => ({ status: 200, body: objs(r), mark: 'ok' }),
      render(resp) {
        const b = resp.body;
        if (!b.length) return `<div class="app-msg warn">Nenhum funcionário encontrado com esses filtros.</div>`;
        return `<div class="small" style="color:#59647d">${b.length} funcionário(s)</div>` + b.map(f => `<div class="app-card"><div><b>${esc(f.nome)}</b><small>${esc(f.cargo)} · ${esc(f.departamento ?? 'sem departamento')}</small></div><span class="val">${brl(f.salario)}</span></div>`).join('');
      },
      lesson(resp) {
        if (resp.status === 400) return ['A API barrou o pedido antes do banco', 'Validação é trabalho da API: um salário negativo nem chega a virar SQL. O banco só recebe pedidos que fazem sentido, e a tela recebe 400 Bad Request com o motivo.', 'where'];
        return ['Cada filtro da tela virou uma condição no WHERE', `O select de departamento e o campo de salário viraram @depto e @salarioMin no WHERE (Aula 2). O nome do departamento veio de um LEFT JOIN (Aula 3), por isso quem não tem departamento também aparece. Lista vazia continua sendo 200 OK: "não encontrei nada" é uma resposta válida para uma busca.`, 'join'];
      }
    },
    /* ---------------- 2. Cadastrar ---------------- */
    {
      id: 'cadastrar', method: 'POST', label: 'Cadastrar cliente', page: 'lojalab.app/clientes/novo',
      form: () => `<h3>Novo cliente</h3><div class="sub">Cadastro simples. O e-mail não pode se repetir.</div>
          <form class="app-form" id="appForm" novalidate>
            <label class="full">Nome<input id="f_nome" data-k="nome" value="Livraria Página Nova"></label>
            <label class="full">E-mail<input id="f_email" data-k="email" type="email" value="contato@paginanova.com"></label>
            <label>Cidade<input id="f_cidade" data-k="cidade" value="Campinas"></label>
            <label>UF<select id="f_uf" data-k="uf">${UFS.map(u => `<option ${u === 'SP' ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
            <div class="app-actions full"><button class="app-submit" type="submit">Cadastrar</button>
              <button class="app-link" type="button" data-fill='{"f_email":"vida@farma.com"}'>usar e-mail já cadastrado</button>
              <button class="app-link" type="button" data-fill='{"f_nome":""}'>deixar o nome vazio</button></div>
          </form><div class="app-out" id="appOut"><div class="app-ph">A confirmação aparece aqui.</div></div>`,
      read: () => ({ nome: $('#f_nome').value.trim(), email: $('#f_email').value.trim(), cidade: $('#f_cidade').value.trim(), uf: $('#f_uf').value }),
      request: (v) => ({ method: 'POST', path: '/api/clientes', body: v }),
      fetchCode: "fetch('/api/clientes', { method: 'POST', body: JSON.stringify(cliente) })",
      route: () => [
        "app.post('/api/clientes', async (req, res) => {",
        "  const { nome, email, cidade, uf } = req.body;",
        "  const erro = validarCliente(req.body);",
        "  if (erro) return res.status(400).json({ erro });",
        "  try {",
        "    const { id } = await db.query(SQL_INSERIR_CLIENTE, req.body);",
        "    res.status(201).location(`/api/clientes/${id}`)",
        "       .json({ id, nome, email, cidade, uf });",
        "  } catch (e) {",
        "    if (e.number === 2627) // violação de UNIQUE",
        "      return res.status(409).json({ erro: 'E-mail já cadastrado' });",
        "  }",
        "});"],
      marks: { recv: [0, 1], check: [2], bad: [3], sql: [4, 5], ok: [6, 7], conflict: [8, 9, 10] },
      validate(v) {
        if (!v.nome) return { field: 'f_nome', erro: 'nome é obrigatório' };
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) return { field: 'f_email', erro: 'e-mail inválido' };
        return null;
      },
      plan(v) {
        const text = `INSERT INTO Cliente (nome, email, cidade, uf)
VALUES (@nome, @email, @cidade, @uf);
SELECT SCOPE_IDENTITY() AS id;  -- id gerado pelo IDENTITY(1,1)`;
        return {
          params: v, shown: text, exec: () => {
            const r = q(fill('INSERT INTO Cliente (nome, email, cidade, uf) VALUES (@nome, @email, @cidade, @uf);', v));
            if (r.error) return r;
            const id = db.scalar('SELECT last_insert_rowid()');
            return { ...r, cols: ['id'], rows: [[id]] };
          }
        };
      },
      respond(r, v) {
        if (r.error && r.error.code === 2627) return { status: 409, body: { erro: 'E-mail já cadastrado' }, mark: 'conflict', field: 'f_email' };
        if (r.error) return { status: 500, body: { erro: 'Falha no servidor' }, mark: 'conflict' };
        const id = r.rows[0][0];
        return { status: 201, headers: { Location: '/api/clientes/' + id }, body: { id, ...v }, mark: 'ok' };
      },
      render(resp) {
        if (resp.status === 201) return `<div class="app-msg ok"><b>Cliente cadastrado!</b> ${esc(resp.body.nome)} recebeu o código <b>#${resp.body.id}</b>.</div>`;
        return `<div class="app-msg bad">${esc(resp.body.erro)}. Corrija e tente de novo.</div>`;
      },
      lesson(resp) {
        if (resp.status === 201) return ['Um formulário de cadastro é um INSERT', 'O POST levou os campos até a API, que montou o INSERT com parâmetros (Aula 1, DML). O código do cliente não veio da tela: foi o IDENTITY(1,1) do CREATE TABLE que gerou. A API responde 201 Created e informa onde o novo recurso mora (header Location).', 'dml'];
        if (resp.status === 409) return ['A restrição UNIQUE protegeu o cadastro', 'O banco recusou o e-mail repetido com o erro 2627, por causa do UNIQUE que está no CREATE TABLE. A API traduziu esse erro técnico em 409 Conflict, e a tela mostrou uma mensagem que o usuário entende. Sem a restrição no banco, o cliente duplicado entraria.', 'ddl'];
        return ['Validação na API: o banco nem foi consultado', 'Campos obrigatórios e formato de e-mail são checados na API, que responde 400 Bad Request. O NOT NULL no banco continua existindo como última linha de defesa.', 'ddl'];
      }
    },
    /* ---------------- 3. Atualizar ---------------- */
    {
      id: 'atualizar', method: 'PUT', label: 'Reajustar preço', page: 'lojalab.app/produtos/editar',
      form: () => {
        const ps = list('SELECT id_produto, nome, preco FROM Produto ORDER BY nome');
        return `<h3>Editar preço</h3><div class="sub">Escolha o produto e informe o novo preço.</div>
          <form class="app-form" id="appForm" novalidate>
            <label class="full">Produto<select id="f_prod" data-k="id">${ps.map(p => `<option value="${p[0]}" data-preco="${p[2]}" ${p[0] === 3 ? 'selected' : ''}>#${p[0]} · ${esc(p[1])} (${brl(p[2])})</option>`).join('')}<option value="999">#999 · produto que não existe</option></select></label>
            <label class="full">Novo preço (R$)<input id="f_preco" data-k="preco" type="number" step="0.01" value="949.90"></label>
            <div class="app-actions full"><button class="app-submit" type="submit">Salvar</button><button class="app-link" type="button" data-fill='{"f_prod":"999"}'>usar id inexistente</button><button class="app-link" type="button" data-fill='{"f_preco":"0"}'>preço zero</button></div>
          </form><div class="app-out" id="appOut"><div class="app-ph">A confirmação aparece aqui.</div></div>`;
      },
      read: () => ({ id: +$('#f_prod').value, preco: $('#f_preco').value === '' ? NaN : +$('#f_preco').value }),
      request: (v) => ({ method: 'PUT', path: '/api/produtos/' + v.id, body: { preco: v.preco } }),
      fetchCode: "fetch(`/api/produtos/${id}`, { method: 'PUT', body: JSON.stringify({ preco }) })",
      route: () => [
        "app.put('/api/produtos/:id', async (req, res) => {",
        "  const preco = Number(req.body.preco);",
        "  if (!(preco > 0))",
        "    return res.status(400).json({ erro: 'preço deve ser maior que zero' });",
        "  const { rowsAffected } = await db.query(SQL_ATUALIZAR_PRECO,",
        "                             { id: req.params.id, preco });",
        "  if (rowsAffected === 0)",
        "    return res.status(404).json({ erro: 'Produto não encontrado' });",
        "  res.status(200).json({ id: Number(req.params.id), preco });",
        "});"],
      marks: { recv: [0, 1], check: [2], bad: [3], sql: [4, 5], ok: [8], conflict: [6, 7] },
      validate: (v) => !(v.preco > 0) ? { field: 'f_preco', erro: 'preço deve ser maior que zero' } : null,
      plan(v) {
        const text = `UPDATE Produto
SET preco = @preco
WHERE id_produto = @id;   -- WHERE pela chave primária: no máximo 1 linha`;
        return { params: v, shown: text, exec: () => { const old = db.query(`SELECT nome, preco FROM Produto WHERE id_produto = ${L(v.id)}`).rows[0]; const r = q(fill('UPDATE Produto SET preco = @preco WHERE id_produto = @id;', v)); return { ...r, old }; } };
      },
      respond(r, v) {
        if (r.affected === 0) return { status: 404, body: { erro: 'Produto não encontrado' }, mark: 'conflict' };
        return { status: 200, body: { id: v.id, nome: r.old[0], preco_anterior: r.old[1], preco: v.preco }, mark: 'ok' };
      },
      render(resp) {
        if (resp.status === 200) return `<div class="app-card"><div><b>${esc(resp.body.nome)}</b><small>preço atualizado</small></div><span class="val"><s style="color:#8a94aa">${brl(resp.body.preco_anterior)}</s> → <b>${brl(resp.body.preco)}</b></span></div>`;
        return `<div class="app-msg bad">${esc(resp.body.erro)}.</div>`;
      },
      lesson(resp) {
        if (resp.status === 404) return ['0 linhas afetadas virou 404', 'O UPDATE rodou sem erro, mas o WHERE não encontrou o id 999: o banco respondeu "0 linhas afetadas". A API usa esse número para responder 404 Not Found. É por isso que o SSMS sempre mostra quantas linhas foram afetadas.', 'dml'];
        if (resp.status === 400) return ['Regra de negócio validada na API', 'Preço zero não passa nem na API (400) nem no banco, que tem CHECK (preco > 0). Duas camadas protegendo o mesmo dado.', 'ddl'];
        return ['Editar na tela é um UPDATE com WHERE', 'O PUT trouxe o id na URL e o preço no corpo. A API montou um UPDATE com WHERE pela chave primária, então só uma linha muda. Sem esse WHERE, todos os produtos ficariam com o mesmo preço: o bug mais famoso da Aula 1.', 'dml'];
      }
    },
    /* ---------------- 4. Excluir ---------------- */
    {
      id: 'excluir', method: 'DELETE', label: 'Excluir registro', page: 'lojalab.app/admin',
      form: () => {
        const peds = list("SELECT P.id_pedido, C.nome, P.status, (SELECT COUNT(*) FROM ItemPedido I WHERE I.id_pedido = P.id_pedido) FROM Pedido P JOIN Cliente C ON C.id_cliente = P.id_cliente ORDER BY P.id_pedido");
        const prods = list('SELECT P.id_produto, P.nome, (SELECT COUNT(*) FROM ItemPedido I WHERE I.id_produto = P.id_produto) FROM Produto P ORDER BY P.id_produto');
        return `<h3>Administração</h3><div class="sub">Excluir um pedido ou um produto.</div>
          <form class="app-form" id="appForm" novalidate>
            <label>Recurso<select id="f_rec" data-k="recurso"><option value="pedidos">Pedido</option><option value="produtos">Produto</option></select></label>
            <label>Registro<select id="f_idp" data-k="id">${peds.map(p => `<option value="${p[0]}">#${p[0]} · ${esc(p[1])} · ${p[3]} item(ns)</option>`).join('')}</select>
              <select id="f_idr" data-k="id" hidden>${prods.map(p => `<option value="${p[0]}" ${p[0] === 1 ? 'selected' : ''}>#${p[0]} · ${esc(p[1])} · ${p[2] ? 'já vendido' : 'nunca vendido'}</option>`).join('')}</select></label>
            <div class="app-actions full"><button class="app-submit" type="submit" style="background:#c42b3b">Excluir</button><span class="small" style="color:#59647d">Teste um produto já vendido e um nunca vendido.</span></div>
          </form><div class="app-out" id="appOut"><div class="app-ph">O resultado aparece aqui.</div></div>`;
      },
      mount() { const sync = () => { const p = $('#f_rec').value === 'produtos'; $('#f_idp').hidden = p; $('#f_idr').hidden = !p; }; $('#f_rec').addEventListener('change', sync); sync(); },
      read: () => { const rec = $('#f_rec').value; return { recurso: rec, id: +(rec === 'pedidos' ? $('#f_idp').value : $('#f_idr').value) }; },
      request: (v) => ({ method: 'DELETE', path: `/api/${v.recurso}/${v.id}` }),
      fetchCode: "fetch(`/api/${recurso}/${id}`, { method: 'DELETE' })",
      route: () => [
        "app.delete('/api/:recurso/:id', async (req, res) => {",
        "  const tabela = { pedidos: 'Pedido', produtos: 'Produto' }[req.params.recurso];",
        "  if (!tabela) return res.status(404).end();",
        "  try {",
        "    const { rowsAffected } = await db.query(SQL_EXCLUIR[tabela],",
        "                               { id: req.params.id });",
        "    if (rowsAffected === 0) return res.status(404).end();",
        "    res.status(204).end();   // 204 = deu certo, sem corpo",
        "  } catch (e) {",
        "    if (e.number === 547) // conflito com FOREIGN KEY",
        "      return res.status(409).json({ erro: 'Registro em uso por outra tabela' });",
        "  }",
        "});"],
      marks: { recv: [0, 1], check: [2], bad: [2], sql: [3, 4, 5], ok: [7], conflict: [8, 9, 10] },
      validate: () => null,
      plan(v) {
        const ped = v.recurso === 'pedidos';
        const text = ped ? `-- ItemPedido → Pedido: FOREIGN KEY ... ON DELETE CASCADE
DELETE FROM Pedido
WHERE id_pedido = @id;` : `-- ItemPedido → Produto: FOREIGN KEY ... ON DELETE NO ACTION
DELETE FROM Produto
WHERE id_produto = @id;`;
        return {
          params: { id: v.id }, shown: text, exec: () => {
            const filhos = db.scalar(`SELECT COUNT(*) FROM ItemPedido WHERE ${ped ? 'id_pedido' : 'id_produto'} = ${L(v.id)}`);
            const r = q(fill(ped ? 'DELETE FROM Pedido WHERE id_pedido = @id;' : 'DELETE FROM Produto WHERE id_produto = @id;', { id: v.id }));
            return { ...r, filhos };
          }
        };
      },
      respond(r, v) {
        if (r.error && r.error.code === 547) return { status: 409, body: { erro: 'Registro em uso por outra tabela' }, mark: 'conflict', filhos: r.filhos };
        if (r.affected === 0) return { status: 404, body: null, mark: 'conflict' };
        return { status: 204, body: null, mark: 'ok', filhos: r.filhos };
      },
      render(resp, v) {
        if (resp.status === 204) return `<div class="app-msg ok"><b>${v.recurso === 'pedidos' ? 'Pedido' : 'Produto'} #${v.id} excluído.</b>${v.recurso === 'pedidos' && resp.filhos ? ` ${resp.filhos} item(ns) do pedido saíram junto.` : ''}</div>`;
        if (resp.status === 409) return `<div class="app-msg bad"><b>Não foi possível excluir.</b> Este produto aparece em ${resp.filhos} item(ns) de pedido.</div>`;
        return `<div class="app-msg bad">Registro não encontrado.</div>`;
      },
      lesson(resp, v) {
        if (resp.status === 409) return ['A FOREIGN KEY impediu um registro órfão', 'O produto já foi vendido: ItemPedido aponta para ele, e a regra da FK é NO ACTION. O banco recusou com o erro 547 e a API respondeu 409 Conflict. É a integridade referencial da Aula 1 funcionando dentro de um sistema.', 'dml'];
        if (resp.status === 204 && v.recurso === 'pedidos') return ['Um clique excluiu o pedido e os itens dele', 'A API mandou um único DELETE no Pedido. Os itens foram removidos pelo próprio banco, por causa do ON DELETE CASCADE na FOREIGN KEY de ItemPedido. A resposta 204 No Content significa "deu certo e não há nada para devolver".', 'dml'];
        return ['DELETE com WHERE pela chave', 'Produto sem vendas não tem filhos em ItemPedido, então a FOREIGN KEY não bloqueia a exclusão.', 'dml'];
      }
    },
    /* ---------------- 5. Procedure ---------------- */
    {
      id: 'historico', method: 'GET', label: 'Histórico (procedure)', page: 'lojalab.app/clientes/historico',
      form: () => {
        const cs = list('SELECT C.id_cliente, C.nome, (SELECT COUNT(*) FROM Pedido P WHERE P.id_cliente = C.id_cliente) FROM Cliente C ORDER BY C.nome');
        return `<h3>Histórico de compras</h3><div class="sub">Pedidos de um cliente, com o total de cada um.</div>
          <form class="app-form" id="appForm" novalidate>
            <label class="full">Cliente<select id="f_cli" data-k="id">${cs.map(c => `<option value="${c[0]}" ${c[0] === 3 ? 'selected' : ''}>${esc(c[1])} (${c[2]} pedido${c[2] === 1 ? '' : 's'})</option>`).join('')}</select></label>
            <div class="app-actions full"><button class="app-submit" type="submit">Ver histórico</button></div>
          </form><div class="app-out" id="appOut"><div class="app-ph">O histórico aparece aqui.</div></div>`;
      },
      read: () => ({ id: +$('#f_cli').value }),
      request: (v) => ({ method: 'GET', path: `/api/clientes/${v.id}/pedidos` }),
      fetchCode: "fetch(`/api/clientes/${id}/pedidos`)",
      route: () => [
        "app.get('/api/clientes/:id/pedidos', async (req, res) => {",
        "  const id = Number(req.params.id);",
        "  // a API não escreve SQL: chama a procedure do banco",
        "  const result = await db.request()",
        "    .input('id_cliente', sql.Int, id)",
        "    .execute('sp_PedidosDoCliente');",
        "  res.status(200).json(result.recordset);",
        "});"],
      marks: { recv: [0, 1], check: [2], bad: [], sql: [3, 4, 5], ok: [6] },
      validate: () => null,
      plan(v) {
        const text = `EXEC sp_PedidosDoCliente @id_cliente = @id;
-- dentro da procedure (criada uma vez no servidor):
--   SELECT P.id_pedido, P.data_pedido, P.status,
--          SUM(I.quantidade * I.preco_unitario) AS total
--   FROM Pedido P JOIN ItemPedido I ON ...
--   WHERE P.id_cliente = @id_cliente
--   GROUP BY P.id_pedido, P.data_pedido, P.status`;
        return { params: { id: v.id }, shown: text, exec: () => q(`EXEC sp_PedidosDoCliente @id_cliente = ${L(v.id)};`) };
      },
      respond: (r) => ({ status: 200, body: objs(r), mark: 'ok' }),
      render(resp) {
        const b = resp.body; if (!b.length) return `<div class="app-msg warn">Este cliente ainda não fez pedidos.</div>`;
        const tot = b.reduce((s, p) => s + p.total, 0);
        return b.map(p => `<div class="app-card"><div><b>Pedido #${p.id_pedido}</b><small>${esc(p.data_pedido)} · ${esc(p.status)}</small></div><span class="val">${brl(p.total)}</span></div>`).join('') + `<div class="app-card" style="background:#eef3ff"><b>Total comprado</b><span class="val"><b>${brl(tot)}</b></span></div>`;
      },
      lesson: () => ['A API chamou uma stored procedure', 'Em vez de montar o SQL, a API executou sp_PedidosDoCliente (Aula 3). O JOIN e o GROUP BY ficam guardados no servidor, com o plano de execução reaproveitado. Para a API funcionar basta GRANT EXECUTE na procedure: ela nem precisa de permissão direta nas tabelas.', 'join']
    },
    /* ---------------- 6. Transação ---------------- */
    {
      id: 'pedido', method: 'POST', label: 'Fazer pedido (transação)', page: 'lojalab.app/loja/checkout',
      form: () => {
        const cs = list('SELECT id_cliente, nome FROM Cliente ORDER BY nome');
        const ps = list('SELECT id_produto, nome, preco, estoque FROM Produto ORDER BY nome');
        return `<h3>Finalizar compra</h3><div class="sub">O pedido só vale se houver estoque para tudo.</div>
          <form class="app-form" id="appForm" novalidate>
            <label class="full">Cliente<select id="f_c" data-k="id_cliente">${cs.map(c => `<option value="${c[0]}" ${c[0] === 10 ? 'selected' : ''}>${esc(c[1])}</option>`).join('')}</select></label>
            <label>Produto<select id="f_p" data-k="id_produto">${ps.map(p => `<option value="${p[0]}" ${p[0] === 11 ? 'selected' : ''}>${esc(p[1])} · estoque ${p[3]}</option>`).join('')}</select></label>
            <label>Quantidade<input id="f_q" data-k="quantidade" type="number" min="1" value="2"></label>
            <div class="app-actions full"><button class="app-submit" type="submit">Comprar</button><button class="app-link" type="button" data-fill='{"f_p":"7","f_q":"1"}'>produto sem estoque</button><button class="app-link" type="button" data-fill='{"f_q":"999"}'>quantidade enorme</button></div>
          </form><div class="app-out" id="appOut"><div class="app-ph">A confirmação aparece aqui.</div></div>`;
      },
      read: () => ({ id_cliente: +$('#f_c').value, id_produto: +$('#f_p').value, quantidade: $('#f_q').value === '' ? 0 : +$('#f_q').value }),
      request: (v) => ({ method: 'POST', path: '/api/pedidos', body: v }),
      fetchCode: "fetch('/api/pedidos', { method: 'POST', body: JSON.stringify(carrinho) })",
      route: () => [
        "app.post('/api/pedidos', async (req, res) => {",
        "  const { id_cliente, id_produto, quantidade } = req.body;",
        "  if (!(quantidade >= 1)) return res.status(400).json({ erro: 'quantidade inválida' });",
        "  const tx = await db.beginTransaction();          // BEGIN TRAN",
        "  try {",
        "    const { id } = await tx.query(SQL_NOVO_PEDIDO, { id_cliente });",
        "    await tx.query(SQL_INSERIR_ITEM, { id, id_produto, quantidade });",
        "    const r = await tx.query(SQL_BAIXAR_ESTOQUE, { id_produto, quantidade });",
        "    if (r.rowsAffected === 0) throw new Error('SEM_ESTOQUE');",
        "    await tx.commit();                             // COMMIT",
        "    res.status(201).json({ id_pedido: id });",
        "  } catch (e) {",
        "    await tx.rollback();                           // ROLLBACK",
        "    res.status(409).json({ erro: 'Estoque insuficiente: nada foi gravado' });",
        "  }",
        "});"],
      marks: { recv: [0, 1], check: [2], bad: [2], sql: [3, 4, 5, 6, 7, 8], ok: [9, 10], conflict: [11, 12, 13] },
      validate: (v) => !(v.quantidade >= 1) ? { field: 'f_q', erro: 'quantidade inválida' } : null,
      plan(v) {
        const text = `BEGIN TRANSACTION;
INSERT INTO Pedido (id_cliente, data_pedido, status)
VALUES (@id_cliente, GETDATE(), 'Aberto');
INSERT INTO ItemPedido (id_pedido, id_produto, quantidade, preco_unitario)
SELECT SCOPE_IDENTITY(), id_produto, @quantidade, preco
FROM Produto WHERE id_produto = @id_produto;
UPDATE Produto SET estoque = estoque - @quantidade
WHERE id_produto = @id_produto AND estoque >= @quantidade;
-- 1 linha afetada → COMMIT · 0 linhas → ROLLBACK`;
        return {
          params: v, shown: text, exec: () => {
            const t0 = performance.now(); const steps = [];
            db.run('BEGIN TRANSACTION');
            const r1 = q(fill("INSERT INTO Pedido (id_cliente, data_pedido, status) VALUES (@id_cliente, GETDATE(), 'Aberto');", v));
            const id = db.scalar('SELECT last_insert_rowid()');
            steps.push(['INSERT Pedido', r1.error ? 'erro' : `id ${id} criado`, !r1.error]);
            const r2 = q(fill(`INSERT INTO ItemPedido (id_pedido, id_produto, quantidade, preco_unitario) SELECT ${id}, id_produto, @quantidade, preco FROM Produto WHERE id_produto = @id_produto;`, v));
            steps.push(['INSERT ItemPedido', r2.error ? 'erro' : `${r2.affected} linha`, !r2.error]);
            const r3 = q(fill('UPDATE Produto SET estoque = estoque - @quantidade WHERE id_produto = @id_produto AND estoque >= @quantidade;', v));
            steps.push(['UPDATE estoque', `${r3.affected} linha(s)`, r3.affected > 0]);
            const ok = !r1.error && !r2.error && r3.affected > 0;
            db.run(ok ? 'COMMIT' : 'ROLLBACK');
            steps.push([ok ? 'COMMIT' : 'ROLLBACK', ok ? 'gravado' : `tudo desfeito (o pedido ${id} deixou de existir)`, ok]);
            const total = ok ? db.scalar(`SELECT SUM(quantidade * preco_unitario) FROM ItemPedido WHERE id_pedido = ${id}`) : 0;
            return { steps, ok, id, total, ms: performance.now() - t0, cols: [], rows: [], affected: 0 };
          }
        };
      },
      respond(r) {
        if (!r.ok) return { status: 409, body: { erro: 'Estoque insuficiente: nada foi gravado' }, mark: 'conflict', tentativa: r.id };
        return { status: 201, headers: { Location: '/api/pedidos/' + r.id }, body: { id_pedido: r.id, total: r.total }, mark: 'ok' };
      },
      render(resp) {
        if (resp.status === 201) return `<div class="app-msg ok"><b>Pedido #${resp.body.id_pedido} confirmado!</b> Total: ${brl(resp.body.total)}. O estoque já foi baixado.</div>`;
        return `<div class="app-msg bad"><b>Compra não concluída.</b> ${esc(resp.body.erro)}.</div>`;
      },
      lesson(resp) {
        if (resp.status === 409) return ['ROLLBACK: o pedido existiu por um instante e sumiu', `O pedido #${resp.tentativa} chegou a ser inserido, junto com o item. Quando o UPDATE do estoque afetou 0 linhas, a API deu ROLLBACK e tudo foi desfeito. Ninguém fica com pedido sem estoque nem com estoque negativo: é a transação (DTL/TCL) da Aula 1 garantindo "tudo ou nada".`, 'tcl'];
        if (resp.status === 400) return ['Validação antes da transação', 'Quantidade zero ou negativa é barrada na API, antes de abrir qualquer transação no banco.', 'tcl'];
        return ['Três comandos, uma única operação', 'Um clique em Comprar virou BEGIN TRANSACTION + 2 INSERTs + 1 UPDATE + COMMIT. Se qualquer etapa falhasse, o ROLLBACK desfaria as anteriores. É assim que lojas, bancos e sistemas de matrícula evitam dados pela metade.', 'tcl'];
      }
    },
    /* ---------------- 7. SQL Injection ---------------- */
    {
      id: 'login', method: 'POST', label: 'Login e SQL Injection', page: 'lojalab.app/login', secure: false,
      form() {
        return `<h3>Entrar</h3><div class="sub">Área restrita da loja. Experimente o ataque nas duas versões da API.</div>
          <div class="app-toggle" role="group" aria-label="Versão da API"><button type="button" data-mode="0" class="${this.secure ? '' : 'on bad'}">API vulnerável</button><button type="button" data-mode="1" class="${this.secure ? 'on good' : ''}">API segura</button></div>
          <form class="app-form" id="appForm" novalidate>
            <label class="full">Usuário<input id="f_u" data-k="usuario" value="ana.souza" autocomplete="off"></label>
            <label class="full">Senha<input id="f_s" data-k="senha" type="text" value="senha-errada" autocomplete="off"></label>
            <div class="app-actions full"><button class="app-submit" type="submit">Entrar</button><button class="app-link" type="button" data-fill='{"f_u":"&#39; OR 1=1 --","f_s":"qualquer"}'>preencher o ataque</button><button class="app-link" type="button" data-fill='{"f_u":"ana.souza","f_s":"ana123"}'>senha correta</button></div>
          </form><div class="app-out" id="appOut"><div class="app-ph">O resultado do login aparece aqui.</div></div>`;
      },
      mount() { $$('.app-toggle [data-mode]').forEach(b => b.addEventListener('click', () => { const keep = this.read(); this.secure = b.dataset.mode === '1'; mountScenario(this, keep); })); },
      read: () => ({ usuario: $('#f_u').value, senha: $('#f_s').value }),
      request: (v) => ({ method: 'POST', path: '/api/login', body: v }),
      fetchCode: "fetch('/api/login', { method: 'POST', body: JSON.stringify({ usuario, senha }) })",
      route() {
        return this.secure ? [
          "app.post('/api/login', async (req, res) => {",
          "  const { usuario, senha } = req.body;",
          "  // ✓ o texto do usuário vai como PARÂMETRO, nunca como SQL",
          "  const rows = await db.query(",
          "    'SELECT id, login, perfil FROM Usuario WHERE login = @usuario AND senha = @senha',",
          "    { usuario, senha });",
          "  if (rows.length === 0) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });",
          "  res.status(200).json({ bemVindo: rows[0].login, perfil: rows[0].perfil });",
          "});"] : [
          "app.post('/api/login', async (req, res) => {",
          "  const { usuario, senha } = req.body;",
          "  // ⚠ texto do usuário colado direto dentro do SQL",
          "  const sqlTexto = \"SELECT id, login, perfil FROM Usuario \" +",
          "    \"WHERE login = '\" + usuario + \"' AND senha = '\" + senha + \"'\";",
          "  const rows = await db.query(sqlTexto);",
          "  if (rows.length === 0) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });",
          "  res.status(200).json({ bemVindo: rows[0].login, perfil: rows[0].perfil });",
          "});"];
      },
      get marks() { return { recv: [0, 1], check: [2], bad: [], sql: [3, 4, 5], ok: [7], conflict: [6] }; },
      validate: () => null,
      plan(v) {
        if (this.secure) {
          const text = `SELECT id, login, perfil FROM Usuario
WHERE login = @usuario AND senha = @senha;
-- @usuario = ${L(v.usuario)}
-- o valor inteiro é tratado como texto, mesmo com aspas`;
          return { params: v, shown: text, exec: () => q(fill('SELECT id, login, perfil FROM Usuario WHERE login = @usuario AND senha = @senha;', v)) };
        }
        const sqlTexto = "SELECT id, login, perfil FROM Usuario WHERE login = '" + v.usuario + "' AND senha = '" + v.senha + "'";
        return { params: v, shown: '-- SQL montado concatenando o texto digitado:\n' + sqlTexto.replace(' WHERE', '\nWHERE'), exec: () => q(sqlTexto + '\n;') };
      },
      respond(r) {
        if (r.error) return { status: 500, body: { erro: 'Erro interno' }, mark: 'conflict' };
        if (!r.rows.length) return { status: 401, body: { erro: 'Usuário ou senha inválidos' }, mark: 'conflict' };
        const u = objs(r)[0];
        return { status: 200, body: { bemVindo: u.login, perfil: u.perfil }, mark: 'ok', linhas: r.rows.length };
      },
      render(resp, v) {
        if (resp.status === 200) {
          const ataque = /'|--/.test(v.usuario);
          return ataque ? `<div class="app-msg bad"><b>Invasão! Entrou como "${esc(resp.body.bemVindo)}" (${esc(resp.body.perfil)}) sem saber a senha.</b> O banco devolveu ${resp.linhas} usuários.</div>`
            : `<div class="app-msg ok"><b>Bem-vinda, ${esc(resp.body.bemVindo)}!</b> Perfil: ${esc(resp.body.perfil)}.</div>`;
        }
        return `<div class="app-msg bad">${esc(resp.body.erro)}.</div>`;
      },
      lesson(resp, v) {
        const ataque = /'|--/.test(v.usuario);
        if (ataque && resp.status === 200) return ['SQL Injection: o texto digitado virou código SQL', `A API colou o campo usuário dentro do SQL. A aspa fechou o texto, o OR 1=1 tornou o WHERE sempre verdadeiro e o -- comentou a checagem da senha. O banco devolveu todos os usuários e a API logou como o primeiro, o administrador. Troque para "API segura" e envie de novo.`, 'where'];
        if (ataque) return ['Com parâmetros, o ataque vira só um nome estranho', 'Na API segura, o que o usuário digita vai como parâmetro (@usuario). O banco procura um login literalmente igual a \' OR 1=1 -- e não encontra ninguém: 401. Esse é o motivo de toda API usar consultas parametrizadas, e uma das vantagens das stored procedures.', 'where'];
        return ['Login é um SELECT com WHERE', 'Por trás da tela de login existe um SELECT procurando usuário e senha. Em sistemas reais a senha fica guardada como hash, nunca em texto puro como neste exemplo didático.', 'where'];
      }
    }
  ];
  let cur = SC[0];

  /* ------------------------------------------------------------------
     Montagem da tela do app
     ------------------------------------------------------------------ */
  function xrayFor(sc) {
    const r = sc.request(sc.read());
    return `<span class="c">// ${esc(sc.page)} · o que acontece ao enviar o formulário</span>
form.addEventListener(<span class="j-str">'submit'</span>, <span class="hl-kw">async</span> (evento) => {
  evento.preventDefault();          <span class="c">// não recarrega a página</span>
  botao.disabled = <span class="j-lit">true</span>;
  <span class="hl-kw">const</span> resposta = <span class="hl-kw">await</span> ${esc(sc.fetchCode)};
  <span class="c">//    → ${esc(r.method)} ${esc(r.path)}</span>
  <span class="hl-kw">const</span> dados = resposta.status === <span class="j-num">204</span> ? <span class="j-lit">null</span> : <span class="hl-kw">await</span> resposta.json();
  <span class="hl-kw">if</span> (resposta.ok) mostrarResultado(dados);
  <span class="hl-kw">else</span> mostrarErro(dados.erro);     <span class="c">// 400, 401, 404, 409…</span>
  botao.disabled = <span class="j-lit">false</span>;
});

<span class="c">// A tela não conhece SQL nem o banco.
// Ela só conversa com a API usando HTTP + JSON.</span>`;
  }
  function mountScenario(sc, keep) {
    cur = sc;
    $$('#apiScenarios button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === sc.id)));
    $('#appUi').innerHTML = sc.form();
    if (keep) Object.entries(keep).forEach(([k, val]) => { const el = $(`#appForm [data-k="${k}"]`); if (el) el.value = val; });
    if (sc.mount) sc.mount();
    $('#appUrl').textContent = sc.page;
    $('#appForm').addEventListener('submit', (e) => { e.preventDefault(); run(); });
    $$('#appUi [data-fill]').forEach(b => b.addEventListener('click', () => { const f = JSON.parse(b.dataset.fill); Object.entries(f).forEach(([id, val]) => { const el = $('#' + id); if (el) { el.value = val; el.dispatchEvent(new Event('change')); } }); }));
    $('#appForm').addEventListener('input', updateXray); $('#appForm').addEventListener('change', updateXray);
    renderRoute(sc.route()); updateXray();
  }
  function updateXray() { try { $('#xrayCode').innerHTML = xrayFor(cur); } catch (e) { } }
  function renderRoute(lines) {
    $('#routeCode').innerHTML = lines.map((l, i) => {
      let h = esc(l).replace(/(\/\/.*)$/, '<span class="c">$1</span>');
      return `<span class="ln" data-l="${i}"><span class="no">${i + 1}</span>${h}</span>`;
    }).join('');
  }
  function hot(lines, cls = '') {
    $$('#routeCode .ln').forEach(el => el.classList.remove('hot', 'err', 'ok'));
    (lines || []).forEach(i => { const el = $(`#routeCode .ln[data-l="${i}"]`); if (el) el.classList.add('hot', ...(cls ? [cls] : [])); });
  }
  async function stepLines(lines, cls) { for (const i of lines || []) { hot([i], cls); await sleep(260); } if ((lines || []).length) hot(lines, cls); }

  /* ------------------------------------------------------------------
     Trilhas (SVG) e pacote
     ------------------------------------------------------------------ */
  function geom() {
    const st = $('#apiStage').getBoundingClientRect();
    const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left - st.left, t: b.top - st.top, r: b.right - st.left, b: b.bottom - st.top, w: b.width, h: b.height }; };
    return { st, app: r($('#nodeApp .browser')), api: r($('#nodeApi .srv')), db: r($('#nodeDb .dbbox')) };
  }
  function link(A, B, lane) {
    const off = lane === 'req' ? -13 : 13;
    if (B.l >= A.r - 8) { const y1 = A.t + Math.min(A.h, B.h) * .42 + off, y2 = B.t + Math.min(A.h, B.h) * .42 + off; const m = (A.r + B.l) / 2; return `M${A.r},${y1} C${m},${y1} ${m},${y2} ${B.l},${y2}`; }
    if (B.r <= A.l + 8) { const y1 = A.t + Math.min(A.h, B.h) * .42 + off, y2 = B.t + Math.min(A.h, B.h) * .42 + off; const m = (A.l + B.r) / 2; return `M${A.l},${y1} C${m},${y1} ${m},${y2} ${B.r},${y2}`; }
    const cx = (B.l + B.r) / 2 + off * 1.6; const x1 = Math.max(A.l + 20, Math.min(A.r - 20, cx));
    if (B.t >= A.b - 8) { const m = (A.b + B.t) / 2; return `M${x1},${A.b} C${x1},${m} ${cx},${m} ${cx},${B.t}`; }
    const cxA = (A.l + A.r) / 2 + off * 1.6; const x2 = Math.max(B.l + 20, Math.min(B.r - 20, cxA)); const m = (A.t + B.b) / 2;
    return `M${cxA},${A.t} C${cxA},${m} ${x2},${m} ${x2},${B.b}`;
  }
  function drawWires() {
    const g = geom(); const svg = $('#apiWires');
    svg.setAttribute('viewBox', `0 0 ${g.st.width} ${g.st.height}`);
    const W = [['wReq1', g.app, g.api, 'req'], ['wReq2', g.api, g.db, 'req'], ['wRes2', g.db, g.api, 'res'], ['wRes1', g.api, g.app, 'res']];
    svg.innerHTML = W.map(([id, a, b, lane]) => { const d = link(a, b, lane); return `<path class="wire ${lane}" d="${d}"/><path class="flow ${lane}" id="${id}" d="${d}"/>`; }).join('');
    const mid = (id) => { const p = $('#' + id); const L = p.getTotalLength(); return p.getPointAtLength(L / 2); };
    const a = mid('wReq1'), b = mid('wReq2');
    svg.insertAdjacentHTML('beforeend', `<text class="lane-lbl" x="${a.x}" y="${a.y - 22}" text-anchor="middle">HTTP + JSON</text><text class="lane-lbl" x="${b.x}" y="${b.y - 22}" text-anchor="middle">SQL</text>`);
  }
  function startPoint(id) {
    const p = $('#' + id); const pt = p.getPointAtLength(0); const st = $('#apiStage').getBoundingClientRect();
    return { x: st.left + pt.x, y: st.top + pt.y };
  }
  async function travel(id, kind, m, t) {
    const pk = $('#packet'); const path = $('#' + id);
    pk.className = 'packet ' + kind; $('#pkM').textContent = m; $('#pkT').textContent = t.length > 34 ? t.slice(0, 33) + '…' : t;
    $$('#apiWires .flow').forEach(f => f.classList.remove('on', 'err')); path.classList.add('on'); if (kind === 'err') path.classList.add('err');
    if (!G || !window.MotionPathPlugin) { await sleep(300); path.classList.remove('on'); return; }
    G.set(pk, { opacity: 1, scale: 1 });
    await new Promise(r => G.to(pk, { duration: D(1.05), ease: 'power1.inOut', motionPath: { path, align: path, alignOrigin: [0.5, 0.5] }, onComplete: r }));
    await tween(pk, { scale: 1.25, duration: .12, yoyo: true, repeat: 1 });
    path.classList.remove('on');
  }
  function live(node, on, err) { const n = $('#' + node); n.classList.toggle('live', on); n.classList.toggle('err', !!(on && err)); }
  function apiStatus(t, cls) { const s = $('#apiStatus'); s.textContent = t; s.className = 'srv-status ' + (cls || ''); }

  /* ------------------------------------------------------------------
     Pausa por camada
     ------------------------------------------------------------------ */
  function gate(next) {
    if (!$('#apiPause').checked) return Promise.resolve();
    const b = $('#apiContinue'); b.hidden = false; b.textContent = `Continuar: ${next} ▶`;
    return new Promise(r => { b.onclick = () => { b.hidden = true; r(); }; });
  }

  /* ------------------------------------------------------------------
     Inspetor e rede
     ------------------------------------------------------------------ */
  const TABS = [['req', 'Requisição'], ['route', 'Rota da API'], ['sql', 'SQL'], ['db', 'Banco'], ['res', 'Resposta'], ['ui', 'Tela']];
  let insp = {}; let inspSel = null;
  function json(o) {
    if (o === null || o === undefined) return '<span class="h-hdr">(sem corpo)</span>';
    return esc(JSON.stringify(o, null, 2)).replace(/&quot;([^&]+?)&quot;:/g, '<span class="j-key">"$1"</span>:').replace(/: &quot;(.*?)&quot;/g, ': <span class="j-str">"$1"</span>').replace(/: (-?\d+(?:\.\d+)?)/g, ': <span class="j-num">$1</span>').replace(/: (true|false|null)/g, ': <span class="j-lit">$1</span>');
  }
  function renderTabs() {
    $('#inspTabs').innerHTML = TABS.map(([k, n], i) => `<button type="button" data-k="${k}" class="${insp[k] ? 'ready' : ''} ${insp[k] && insp[k].err ? 'err' : ''} ${inspSel === k ? 'on' : ''}" ${insp[k] ? '' : 'disabled'}><span class="k">${i + 1}</span>${n}</button>`).join('');
    $$('#inspTabs button').forEach(b => b.addEventListener('click', () => showInsp(b.dataset.k)));
  }
  function setInsp(k, data, auto = true) { insp[k] = data; if (auto) inspSel = k; renderTabs(); if (auto) showInsp(k); }
  function showInsp(k) {
    inspSel = k; const d = insp[k]; if (!d) return;
    $$('#inspTabs button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    const body = $('#inspBody');
    body.innerHTML = `<div class="insp-grid"><pre class="code">${d.code}</pre><div class="insp-explain"><h3>${esc(d.title)}</h3>${d.html}</div></div>`;
    if (G && !reduce) G.from(body.firstElementChild, { opacity: 0, y: 6, duration: .25 });
  }
  function netRow(req, status, t) {
    const log = $('#netLog'); if ($('.empty', log)) log.innerHTML = '';
    const total = t.n1 + t.api + t.db + t.n2; const pct = (x) => (100 * x / total).toFixed(1) + '%';
    const row = document.createElement('div'); row.className = 'net-row';
    row.innerHTML = `<span class="http ${req.method}">${req.method}</span><span class="u" title="${esc(req.path)}">${esc(req.path)}</span><span class="st s${String(status)[0]}">${status}</span>
      <div class="bar" aria-hidden="true"><i style="width:${pct(t.n1)};background:var(--c-dql)"></i><i style="width:${pct(t.api)};background:var(--c-ddl)"></i><i style="width:${pct(t.db)};background:var(--c-dml)"></i><i style="width:${pct(t.n2)};background:var(--c-dql)"></i></div>
      <span class="ms">${total.toFixed(0)} ms · rede ${(t.n1 + t.n2).toFixed(0)} · API ${t.api.toFixed(1)} · banco ${t.db.toFixed(1)}</span>`;
    log.prepend(row);
    if (G && !reduce) G.from(row, { opacity: 0, x: -20, duration: .4 });
  }
  const LESSON_LINK = { where: ['tutorial', 'Lição: WHERE'], join: ['tutorial', 'Lição: JOIN'], dml: ['tutorial', 'Lição: INSERT, UPDATE e DELETE'], ddl: ['tutorial', 'Lição: CREATE TABLE'], tcl: ['tutorial', 'Lição: Transações'] };
  function lesson(sc, resp, v, sqlForTerminal) {
    const [title, text, key] = sc.lesson(resp, v);
    const box = $('#apiLesson'); box.hidden = false;
    box.innerHTML = `<div class="ic">?</div><h3>${esc(title)}</h3><p>${esc(text)}</p>
      <div class="links">${sqlForTerminal ? `<button class="btn-lab btn-sm-lab" type="button" id="lsTerm">Rodar este SQL no terminal</button>` : ''}<button class="btn-ghost btn-sm-lab" type="button" id="lsTut">${esc(LESSON_LINK[key][1])}</button></div>`;
    const t = $('#lsTerm'); if (t) t.addEventListener('click', () => window.LabApp.sendToTerminal(sqlForTerminal, false));
    $('#lsTut').addEventListener('click', () => { const map = { where: 'DQL', join: 'DQL', dml: 'DML', ddl: 'DDL', tcl: 'TCL' }; if (window.LabTutorial) window.LabTutorial.openByCat(map[key]); });
    if (G && !reduce) G.from(box, { y: 16, opacity: 0, duration: .5, ease: 'power2.out' });
  }

  /* ------------------------------------------------------------------
     O fluxo completo
     ------------------------------------------------------------------ */
  let running = false; let token = 0;
  function httpReq(req) {
    const body = req.body !== undefined;
    return `<span class="h-line">${req.method} ${esc(req.path)} HTTP/1.1</span>
<span class="h-hdr">Host: api.lojalab.app
Accept: application/json${body ? '\nContent-Type: application/json' : ''}
Origin: https://lojalab.app</span>
${body ? '\n' + json(req.body) : ''}`;
  }
  function httpRes(status, headers, body, ms) {
    const h = { 'Content-Type': 'application/json; charset=utf-8', ...(headers || {}), 'X-Response-Time': ms.toFixed(0) + 'ms' };
    return `<span class="h-line">HTTP/1.1 ${status} ${STATUS[status] || ''}</span>
<span class="h-hdr">${Object.entries(h).map(([k, v]) => `${k}: ${esc(v)}`).join('\n')}</span>
${status === 204 ? '' : '\n' + json(body)}`;
  }
  async function typeSql(text) {
    const el = $('#dbSql'); el.style.color = 'var(--term-ink)';
    if (!G || reduce) { el.innerHTML = window.LabApp.highlight(text); return; }
    const o = { n: 0 };
    await new Promise(r => G.to(o, { n: text.length, duration: D(Math.min(1.4, .25 + text.length / 260)), ease: 'none', onUpdate: () => { el.textContent = text.slice(0, Math.round(o.n)); }, onComplete: r }));
    el.innerHTML = window.LabApp.highlight(text);
  }
  function dbResultHTML(r) {
    if (r.steps) return r.steps.map(([a, b, ok]) => `<div class="r"><span>${esc(a)}</span><span class="${ok ? 'n' : ''}" style="${ok ? 'color:var(--term-green)' : 'color:var(--term-red)'}">${ok ? '✓' : '✗'} ${esc(b)}</span></div>`).join('');
    if (r.error) return `<div class="dberr">Msg ${r.error.code}: ${esc(r.error.title)}</div>`;
    if (!r.cols.length) return `<div class="aff">(${r.affected} ${r.affected === 1 ? 'linha afetada' : 'linhas afetadas'})</div>`;
    const head = `<div class="r h">${r.cols.slice(0, 4).map(c => `<span>${esc(c)}</span>`).join('')}</div>`;
    const rows = r.rows.slice(0, 5).map(row => `<div class="r">${row.slice(0, 4).map(v => `<span class="${typeof v === 'number' ? 'n' : ''}">${esc(v === null ? 'NULL' : v)}</span>`).join('')}</div>`).join('');
    return head + rows + (r.rows.length > 5 ? `<div class="more">… mais ${r.rows.length - 5} linha(s)</div>` : '') + (r.rows.length ? '' : '<div class="more">(0 linhas)</div>');
  }
  function resetStage() {
    insp = {}; inspSel = null; renderTabs();
    $('#inspBody').innerHTML = '<p class="empty mb-0">Acompanhe as etapas aparecerem aqui conforme o pedido avança.</p>';
    hot([]); apiStatus('aguardando'); ['nodeApp', 'nodeApi', 'nodeDb'].forEach(n => live(n, false));
    $('#dbState').textContent = 'ocioso'; $('#dbMeta').textContent = '';
    $('#apiLesson').hidden = true;
    $$('#appForm .ferr').forEach(e => e.remove()); $$('#appForm .bad').forEach(e => e.classList.remove('bad'));
  }
  async function flyFields() {
    const target = startPoint('wReq1');
    const fields = $$('#appForm [data-k]').filter(el => !el.hidden);
    const chips = fields.map(el => {
      const b = el.getBoundingClientRect(); const c = document.createElement('div'); c.className = 'fly-chip';
      const val = el.tagName === 'SELECT' ? (el.selectedOptions[0] ? el.selectedOptions[0].textContent.split(' · ')[0].split(' (')[0] : '') : el.value;
      c.textContent = `${el.dataset.k}: ${String(val).slice(0, 18)}`; c.style.left = b.left + 'px'; c.style.top = b.top + 'px'; document.body.appendChild(c); return c;
    });
    if (G && !reduce) await new Promise(r => G.to(chips, { left: target.x - 30, top: target.y - 10, scale: .4, opacity: 0, duration: D(.75), ease: 'power2.in', stagger: D(.08), onComplete: r }));
    chips.forEach(c => c.remove());
  }
  async function run() {
    if (running) return; running = true; const my = ++token;
    const sc = cur; const btn = $('#appForm .app-submit'); const label = btn.textContent;
    const alive = () => my === token;
    try {
      resetStage();
      const v = sc.read(); const req = sc.request(v);
      const T = { n1: 30 + Math.random() * 40, api: 0, db: 0, n2: 25 + Math.random() * 35 };
      btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${esc(label)}`;
      // 1. Tela
      live('nodeApp', true);
      setInsp('req', { code: httpReq(req), title: 'A tela enviou uma requisição HTTP', html: `<p>O formulário não fala com o banco. Ele empacota os campos em <b>JSON</b> e chama a API pelo método <span class="http ${req.method}">${req.method}</span>.</p><ul><li><b>URL</b>: qual recurso (${esc(req.path.split('?')[0])})</li><li><b>Método</b>: o que fazer com ele</li>${req.body ? '<li><b>Corpo</b>: os dados digitados</li>' : '<li>Em um GET, os filtros vão na própria URL (query string)</li>'}</ul>` });
      await flyFields(); if (!alive()) return;
      await gate('enviar para a API');
      live('nodeApp', false);
      await travel('wReq1', 'req', req.method, req.path); if (!alive()) return;
      // 2. API
      live('nodeApi', true); apiStatus('processando', 'busy');
      setInsp('route', { code: sc.route().map((l, i) => `<span class="h-hdr">${String(i + 1).padStart(2)}</span>  ${esc(l)}`).join('\n'), title: 'A API recebeu e decidiu o que fazer', html: '<p>A rota é a função que atende aquela URL + método. Ela lê os dados, <b>valida</b>, monta o SQL com <b>parâmetros</b> e escolhe o status HTTP da resposta.</p><p>As linhas acesas no painel da API mostram o caminho que o código percorreu.</p>' });
      await stepLines(sc.marks.recv); await stepLines(sc.marks.check);
      const bad = sc.validate(v);
      if (bad) {
        T.api = 1 + Math.random() * 2;
        await stepLines(sc.marks.bad, 'err'); live('nodeApi', true, true); apiStatus('400', 'err');
        const resp = { status: 400, body: { erro: bad.erro } };
        setInsp('res', { err: true, code: httpRes(400, null, resp.body, T.n1 + T.api + T.n2), title: '400 Bad Request: barrado na API', html: '<p>A validação falhou, então a API respondeu na hora. <b>Nenhum SQL foi enviado ao banco.</b></p>' });
        await gate('devolver a resposta');
        await travel('wRes1', 'err', '400', 'Bad Request'); if (!alive()) return;
        live('nodeApi', false);
        finishUi(sc, resp, v, req, T, bad.field); lesson(sc, resp, v, null);
        return;
      }
      const plan = sc.plan(v);
      await stepLines(sc.marks.sql);
      T.api = 2 + Math.random() * 4;   // tempo de processamento simulado
      const shownFilled = plan.shown;
      setInsp('sql', { code: window.LabApp.highlight(shownFilled), title: 'O SQL que a API mandou para o banco', html: `<p>Repare nos <b>@parâmetros</b>: os valores da tela não são colados no texto do SQL; vão separados. Isso evita SQL Injection (veja o cenário de login).</p>${Object.keys(plan.params || {}).length ? '<ul>' + Object.entries(plan.params).map(([k, val]) => `<li><code>@${esc(k)}</code> = ${esc(val === null ? 'NULL' : val)}</li>`).join('') + '</ul>' : ''}` });
      await gate('enviar o SQL ao banco');
      await travel('wReq2', 'sql', 'SQL', shownFilled.replace(/--.*\n/g, '').split('\n')[0]); if (!alive()) return;
      // 3. Banco
      live('nodeDb', true); $('#dbState').textContent = 'executando…'; $('#dbResult').innerHTML = '';
      await typeSql(shownFilled);
      const r = plan.exec();
      T.db = Math.max(.4, r.ms || .4);
      $('#dbState').textContent = r.error || (r.steps && !r.ok) ? 'erro / desfeito' : 'concluído';
      $('#dbMeta').textContent = `${(r.ms || 0).toFixed(2)} ms · ${r.steps ? 'transação' : r.cols.length ? r.rows.length + ' linha(s)' : r.affected + ' afetada(s)'}`;
      $('#dbResult').innerHTML = dbResultHTML(r);
      if (G && !reduce) G.from('#dbResult > *', { opacity: 0, x: 14, stagger: D(.06), duration: D(.3) });
      const dbErr = !!r.error || (r.steps && !r.ok);
      if (dbErr) live('nodeDb', true, true);
      setInsp('db', { err: dbErr, code: `<span class="h-hdr">-- resultado devolvido à API</span>\n${r.steps ? r.steps.map(s => `${s[2] ? '✓' : '✗'} ${s[0]}: ${s[1]}`).join('\n') : r.error ? `Msg ${r.error.code}: ${esc(r.error.title)}` : r.cols.length ? esc(r.cols.join(' | ')) + '\n' + r.rows.slice(0, 12).map(x => esc(x.map(y => y === null ? 'NULL' : y).join(' | '))).join('\n') : `(${r.affected} linha(s) afetada(s))`}`, title: dbErr ? 'O banco recusou ou desfez a operação' : 'O banco executou e devolveu o resultado', html: dbErr ? `<p>${r.error ? `As restrições do banco (as mesmas do CREATE TABLE) recusaram o comando com o erro <b>${r.error.code}</b>.` : 'Uma etapa da transação falhou e o ROLLBACK desfez as anteriores.'}</p>` : `<p>${r.cols.length ? `O banco devolveu <b>${r.rows.length} linha(s)</b> em formato de tabela.` : r.steps ? 'Todas as etapas da transação deram certo e o COMMIT gravou tudo.' : `O banco informou <b>${r.affected} linha(s) afetada(s)</b>, o mesmo número que o SSMS mostra.`}</p><p>O banco não sabe que existe uma tela: ele só responde à API.</p>` });
      await gate('voltar para a API');
      await travel('wRes2', dbErr ? 'err' : 'res', dbErr ? 'ERRO' : 'ROWS', r.steps ? (r.ok ? 'COMMIT' : 'ROLLBACK') : r.error ? 'erro ' + r.error.code : r.cols.length ? `${r.rows.length} linha(s)` : `${r.affected} afetada(s)`); if (!alive()) return;
      live('nodeDb', false);
      // 4. API responde
      const resp = sc.respond(r, v);
      const okResp = resp.status < 400;
      live('nodeApi', true, !okResp); apiStatus(String(resp.status), okResp ? 'ok' : 'err');
      await stepLines(okResp ? sc.marks.ok : sc.marks.conflict, okResp ? 'ok' : 'err');
      setInsp('res', { err: !okResp, code: httpRes(resp.status, resp.headers, resp.body, T.n1 + T.api + T.db + T.n2), title: `${resp.status} ${STATUS[resp.status]}: a API traduziu o banco em HTTP`, html: `<p>Tabelas viraram <b>JSON</b>, e o resultado virou um <b>código de status</b>: a tela só precisa olhar o número para saber se deu certo.</p><ul><li><b>2xx</b>: sucesso</li><li><b>4xx</b>: o pedido tinha um problema (dado inválido, não encontrado, conflito)</li><li><b>5xx</b>: falha do servidor</li></ul>` });
      await gate('devolver para a tela');
      await travel('wRes1', okResp ? 'res' : 'err', String(resp.status), STATUS[resp.status]); if (!alive()) return;
      live('nodeApi', false);
      finishUi(sc, resp, v, req, T, resp.field);
      lesson(sc, resp, v, fill(plan.shown, plan.params || {}));
      if (['excluir', 'pedido', 'atualizar', 'historico', 'cadastrar'].includes(sc.id)) refreshSelects(sc);
    } finally {
      if (my === token) { running = false; const b = $('#appForm .app-submit'); if (b) { b.disabled = false; b.textContent = label; } G && G.to('#packet', { opacity: 0, duration: D(.3) }); }
    }
  }
  function finishUi(sc, resp, v, req, T, field) {
    live('nodeApp', true, resp.status >= 400);
    const out = $('#appOut'); out.innerHTML = sc.render(resp, v);
    if (field && $('#' + field)) { const el = $('#' + field); el.classList.add('bad'); el.insertAdjacentHTML('afterend', `<span class="ferr">${esc(resp.body.erro)}</span>`); }
    if (G && !reduce) G.from(out.children, { opacity: 0, y: 10, stagger: D(.06), duration: D(.35) });
    setInsp('ui', { err: resp.status >= 400, code: `<span class="h-hdr">// a tela leu o status e o JSON</span>\n<span class="hl-kw">if</span> (resposta.status === <span class="j-num">${resp.status}</span>) ${resp.status < 400 ? 'mostrarResultado(dados)' : 'mostrarErro(dados.erro)'};\n\n<span class="h-hdr">// e redesenhou só a área de resultado,\n// sem recarregar a página.</span>`, title: 'A tela se atualizou com os dados', html: `<p>O ciclo completo levou cerca de <b>${(T.n1 + T.api + T.db + T.n2).toFixed(0)} ms</b>. O usuário só viu um botão e um resultado; por baixo, passaram HTTP, código da API e SQL.</p>` });
    netRow(req, resp.status, T);
    setTimeout(() => live('nodeApp', false), 900);
  }
  function refreshSelects(sc) {
    if (cur !== sc) return;
    const keep = {}; $$('#appForm [data-k]').forEach(el => { keep[el.id] = el.value; });
    const out = $('#appOut').innerHTML;
    mountScenario(sc);
    Object.entries(keep).forEach(([id, val]) => { const el = $('#' + id); if (el && [...(el.options || [{ value: val }])].some(o => o.value === val)) { el.value = val; el.dispatchEvent(new Event('change')); } });
    $('#appOut').innerHTML = out;
  }

  /* ------------------------------------------------------------------
     Raio-X da tela
     ------------------------------------------------------------------ */
  let xrayOn = false;
  function toggleXray() {
    xrayOn = !xrayOn; $('#btnXray').setAttribute('aria-pressed', String(xrayOn)); updateXray();
    const x = $('#appXray'), s = $('#scanline'); const w = $('#nodeApp .browser-body').offsetWidth;
    $('#appXray').setAttribute('aria-hidden', String(!xrayOn));
    if (!G || reduce) { x.style.clipPath = xrayOn ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)'; return; }
    const tl = G.timeline();
    if (xrayOn) tl.set(s, { x: 0, opacity: 1 }).to(x, { clipPath: 'inset(0 0% 0 0)', duration: .9, ease: 'power2.inOut' }, 0).to(s, { x: w, duration: .9, ease: 'power2.inOut' }, 0).to(s, { opacity: 0, duration: .2 });
    else tl.set(s, { x: w, opacity: 1 }).to(x, { clipPath: 'inset(0 100% 0 0)', duration: .7, ease: 'power2.inOut' }, 0).to(s, { x: 0, duration: .7, ease: 'power2.inOut' }, 0).to(s, { opacity: 0, duration: .2 });
  }

  /* ------------------------------------------------------------------
     Inicialização
     ------------------------------------------------------------------ */
  let ready = false, shownOnce = false, rt;
  function init() {
    if (ready) return; ready = true;
    buildDb();
    $('#apiScenarios').innerHTML = SC.map(s => `<button type="button" role="tab" data-id="${s.id}" aria-selected="false"><span class="http ${s.method}">${s.method}</span>${esc(s.label)}</button>`).join('');
    $$('#apiScenarios button').forEach(b => b.addEventListener('click', () => { token++; running = false; resetStage(); G && G.set('#packet', { opacity: 0 }); mountScenario(SC.find(s => s.id === b.dataset.id)); requestAnimationFrame(drawWires); }));
    $('#btnXray').addEventListener('click', toggleXray);
    $$('.seg [data-speed]').forEach(b => b.addEventListener('click', () => { speed = +b.dataset.speed; $$('.seg [data-speed]').forEach(x => x.classList.toggle('on', x === b)); }));
    $('#apiPause').addEventListener('change', (e) => { if (!e.target.checked) { const c = $('#apiContinue'); if (!c.hidden) c.click(); } });
    $('#apiResetData').addEventListener('click', () => { token++; running = false; buildDb(); resetStage(); mountScenario(cur); window.LabApp.toast('Dados da API restaurados a partir do banco do laboratório'); });
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!$('#view-api').hidden) drawWires(); }, 150); });
    renderTabs();
    mountScenario(SC[0]);
  }
  function onShow() {
    init();
    requestAnimationFrame(() => {
      drawWires();
      if (!shownOnce) {
        shownOnce = true;
        if (G && !reduce) {
          const tl = G.timeline();
          tl.from('.api-node', { y: 30, opacity: 0, stagger: .15, duration: .6, ease: 'power3.out' })
            .from('#apiWires .wire, #apiWires .lane-lbl', { opacity: 0, duration: .6, stagger: .08 }, '-=.3')
            .add(() => setTimeout(run, 300));
        } else setTimeout(run, 300);
      }
    });
  }
  function onHide() { const c = $('#apiContinue'); if (c && !c.hidden) { /* mantém pausado */ } }
  window.LabApi = { onShow, onHide };
})();

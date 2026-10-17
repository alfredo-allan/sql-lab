/* =====================================================================
   SQL Lab · Página Início (animações com GSAP + ScrollTrigger)
   Tudo fica visível sem animação; o GSAP só acrescenta movimento.
   ===================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const G = window.gsap;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (G && window.ScrollTrigger) G.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------------------
     1. Teatro da consulta
     ------------------------------------------------------------------ */
  const EMP = [
    { nome: 'Ana', cargo: 'Gerente', depto: 'TI', salario: 14500 },
    { nome: 'Bruno', cargo: 'Analista', depto: 'TI', salario: 7200 },
    { nome: 'Carla', cargo: 'Gerente', depto: 'Financeiro', salario: 12800 },
    { nome: 'Igor', cargo: 'Assistente', depto: 'RH', salario: 2900 },
    { nome: 'Diego', cargo: 'Analista', depto: 'Financeiro', salario: 6100 },
    { nome: 'Jéssica', cargo: 'Assistente', depto: 'Financeiro', salario: 3200 }
  ];
  const COLS = ['nome', 'cargo', 'depto', 'salario'];
  const fmt = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const D = (s) => reduce ? 0.01 : s;   // durações
  const GROUP_COLORS = { TI: 'rgb(75 142 247 / .16)', Financeiro: 'rgb(183 148 255 / .16)', RH: 'rgb(246 196 84 / .16)' };

  const SCENES = [
    {
      id: 'filtrar', label: 'Filtrar e ordenar',
      parts: [['SELECT', 'SELECT nome, salario'], ['FROM', 'FROM Funcionario'], ['WHERE', 'WHERE salario > 5000'], ['ORDER', 'ORDER BY salario DESC;']],
      steps: [
        { k: 'FROM', t: '1 · FROM', c: 'O banco começa pela tabela: carrega todas as linhas de Funcionario.', run: stepFrom },
        { k: 'WHERE', t: '2 · WHERE', c: 'Testa cada linha: salario > 5000? Quem não passa no teste sai do resultado.', run: (tl) => stepWhere(tl, r => r.salario > 5000, 'salario') },
        { k: 'SELECT', t: '3 · SELECT', c: 'Só agora as colunas são escolhidas. Repare: o SELECT é escrito primeiro, mas roda depois do WHERE.', run: (tl) => stepSelect(tl, ['nome', 'salario']) },
        { k: 'ORDER', t: '4 · ORDER BY', c: 'Por último, ordena do maior para o menor salário. Resultado: 4 linhas.', run: (tl) => stepOrder(tl, (a, b) => b.salario - a.salario) }
      ]
    },
    {
      id: 'agrupar', label: 'Agrupar',
      parts: [['SELECT', 'SELECT depto, COUNT(*), AVG(salario)'], ['FROM', 'FROM Funcionario'], ['GROUP', 'GROUP BY depto;']],
      steps: [
        { k: 'FROM', t: '1 · FROM', c: 'Carrega as 6 linhas de Funcionario.', run: stepFrom },
        { k: 'GROUP', t: '2 · GROUP BY', c: 'Junta as linhas com o mesmo depto. Cada cor é um grupo.', run: stepGroup },
        { k: 'SELECT', t: '3 · SELECT + agregação', c: 'Cada grupo vira uma linha só. COUNT(*) conta as linhas do grupo e AVG(salario) calcula a média.', run: stepAggregate }
      ]
    },
    {
      id: 'atualizar', label: 'Atualizar',
      parts: [['UPDATE', 'UPDATE Funcionario'], ['SET', 'SET salario = salario * 1.10'], ['WHERE', "WHERE depto = 'TI';"]],
      steps: [
        { k: 'UPDATE', t: '1 · UPDATE', c: 'Escolhe a tabela que será alterada.', run: stepFrom },
        { k: 'WHERE', t: '2 · WHERE', c: "Encontra as linhas em que depto = 'TI'. Só elas serão alteradas.", run: (tl) => stepWhere(tl, r => r.depto === 'TI', 'depto', true) },
        { k: 'SET', t: '3 · SET', c: 'Aplica o reajuste de 10% nas linhas encontradas. Mensagem do servidor: (2 linhas afetadas).', run: stepSet }
      ]
    },
    {
      id: 'excluir', label: 'Excluir',
      parts: [['DELETE', 'DELETE FROM Funcionario'], ['WHERE', "WHERE depto = 'RH';"]],
      steps: [
        { k: 'DELETE', t: '1 · DELETE FROM', c: 'Escolhe a tabela de onde as linhas serão removidas.', run: stepFrom },
        { k: 'WHERE', t: '2 · WHERE', c: "Marca só as linhas com depto = 'RH'.", run: (tl) => stepWhere(tl, r => r.depto === 'RH', 'depto', true) },
        { k: 'DELETE', t: '3 · Remoção', c: 'A linha marcada é removida: (1 linha afetada). Sem o WHERE, todas as 6 linhas seriam apagadas.', run: stepDelete }
      ]
    }
  ];

  const qt = { scene: SCENES[0], step: 0, rows: [], busy: false, token: 0 };

  function renderQuery() {
    $('#qtQuery').innerHTML = qt.scene.parts.map(([k, t]) => {
      const html = esc(t).replace(/^(SELECT|FROM|WHERE|ORDER BY|GROUP BY|UPDATE|SET|DELETE FROM)/, '<span class="kw">$1</span>');
      return `<span class="tk" data-k="${k}">${html}</span>`;
    }).join(' ');
    $('#qtSteps').innerHTML = qt.scene.steps.map((s, i) => `<span data-i="${i}">${esc(s.t.split(' · ')[1])}</span>`).join('');
  }
  function buildTable() {
    const t = $('#qtTable');
    qt.rows = EMP.map(r => ({ ...r }));
    t.innerHTML = `<div class="qt-row head">${COLS.map(c => `<div class="qt-cell${c === 'salario' ? ' num' : ''}" data-col="${c}">${c}</div>`).join('')}</div>` +
      qt.rows.map((r, i) => `<div class="qt-row" data-i="${i}">${COLS.map(c => `<div class="qt-cell${c === 'salario' ? ' num' : ''}" data-col="${c}">${c === 'salario' ? fmt(r[c]) : esc(r[c])}</div>`).join('')}</div>`).join('');
    $$('.qt-row', t).forEach((el, k) => { if (k) qt.rows[k - 1].el = el; });
  }
  function setCaption(title, text) {
    const c = $('#qtCaption');
    c.innerHTML = `<b>${esc(title)}</b>${esc(text)}`;
    if (G) G.fromTo(c, { opacity: .3, y: 4 }, { opacity: 1, y: 0, duration: D(.35) });
  }
  function markTokens(i) {
    const steps = qt.scene.steps;
    $$('#qtQuery .tk').forEach(tk => {
      const k = tk.dataset.k;
      const idx = steps.findIndex((s, j) => j <= i && s.k === k);
      tk.classList.toggle('on', i >= 0 && steps[i] && steps[i].k === k);
      tk.classList.toggle('done', idx >= 0 && !(steps[i] && steps[i].k === k));
    });
    $$('#qtSteps span').forEach(s => { const j = +s.dataset.i; s.classList.toggle('on', j === i); s.classList.toggle('done', j < i); });
  }
  function reset() {
    qt.token++; qt.step = 0; qt.busy = false;
    if (G) G.killTweensOf('#qtTable *');
    buildTable(); markTokens(-1);
    $$('.qt-msg').forEach(m => m.remove());
    $('#qtCaption').innerHTML = '<b>Pronto</b>Aperte reproduzir ou avance passo a passo.';
    $('#qtStep').disabled = false;
  }
  function selectScene(id) {
    qt.scene = SCENES.find(s => s.id === id) || SCENES[0];
    $$('#qtScenes button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === qt.scene.id)));
    renderQuery(); reset();
  }
  function runStep() {
    if (qt.busy || qt.step >= qt.scene.steps.length) return Promise.resolve();
    const s = qt.scene.steps[qt.step]; const i = qt.step;
    qt.busy = true; markTokens(i); setCaption(s.t, s.c);
    const tl = G ? G.timeline() : null;
    if (tl) s.run(tl); else s.run(null);
    qt.step++;
    if (qt.step >= qt.scene.steps.length) $('#qtStep').disabled = true;
    return (tl ? tl.then() : Promise.resolve()).then(() => { qt.busy = false; if (qt.step >= qt.scene.steps.length) markTokens(qt.scene.steps.length); });
  }
  async function play() {
    if (qt.step >= qt.scene.steps.length || qt.step > 0) reset();
    const my = ++qt.token;
    while (qt.step < qt.scene.steps.length && my === qt.token) {
      await runStep();
      if (my !== qt.token) return;
      await new Promise(r => setTimeout(r, reduce ? 300 : 1100));
    }
  }

  /* ---- passos ---- */
  function liveRows() { return qt.rows.filter(r => r.el && r.el.isConnected); }
  function stepFrom(tl) {
    const els = liveRows().map(r => r.el);
    if (!tl) return;
    tl.fromTo(els, { opacity: 0, x: -18 }, { opacity: 1, x: 0, stagger: D(.07), duration: D(.35), ease: 'power2.out' });
  }
  function stepWhere(tl, test, col, keepFailing) {
    const rows = liveRows();
    rows.forEach((r, k) => {
      const ok = test(r);
      const cell = r.el.querySelector(`[data-col="${col}"]`);
      const apply = () => { r.el.classList.add(ok ? 'pass' : 'fail'); if (keepFailing) r.el.classList.toggle('fail', false); if (keepFailing && !ok) r.el.style.opacity = .45; };
      if (!tl) { apply(); return; }
      const t0 = k * D(.22);
      tl.to(cell, { backgroundColor: ok ? 'rgba(74,222,128,.25)' : 'rgba(255,95,109,.25)', duration: D(.18) }, t0)
        .add(apply, t0 + D(.18))
        .to(cell, { backgroundColor: 'rgba(0,0,0,0)', duration: D(.3) }, t0 + D(.18));
    });
    if (keepFailing) { if (tl) tl.to(rows.filter(r => !test(r)).map(r => r.el), { opacity: .4, duration: D(.3) }); return; }
    const out = rows.filter(r => !test(r));
    if (!tl) { out.forEach(r => r.el.remove()); return; }
    tl.to(out.map(r => r.el), { height: 0, paddingTop: 0, paddingBottom: 0, opacity: 0, duration: D(.45), ease: 'power2.in', stagger: D(.05) }, '+=0.35')
      .add(() => out.forEach(r => r.el.remove()));
  }
  function stepSelect(tl, keep) {
    const drop = COLS.filter(c => !keep.includes(c));
    const cells = drop.flatMap(c => $$(`#qtTable [data-col="${c}"]`));
    if (!tl) { cells.forEach(c => c.remove()); return; }
    tl.to(cells, { opacity: 0, duration: D(.25) })
      .to(cells, { flexGrow: 0, flexBasis: 0, paddingLeft: 0, paddingRight: 0, duration: D(.5), ease: 'power2.inOut' })
      .add(() => cells.forEach(c => c.remove()));
  }
  function flipReorder(tl, sorted) {
    const t = $('#qtTable');
    const els = sorted.map(r => r.el);
    const first = new Map(els.map(e => [e, e.getBoundingClientRect().top]));
    const apply = () => {
      const f = new Map(els.map(e => [e, e.getBoundingClientRect().top]));
      els.forEach(e => t.appendChild(e));
      if (G) els.forEach(e => G.from(e, { y: f.get(e) - e.getBoundingClientRect().top, duration: D(.7), ease: 'power3.inOut' }));
    };
    if (!tl) { els.forEach(e => t.appendChild(e)); return; }
    tl.add(apply).to({}, { duration: D(.75) });
    return first;
  }
  function stepOrder(tl, cmp) { flipReorder(tl, liveRows().slice().sort(cmp)); }
  function stepGroup(tl) {
    const order = ['TI', 'Financeiro', 'RH'];
    const rows = liveRows();
    if (tl) rows.forEach(r => tl.to(r.el, { backgroundColor: GROUP_COLORS[r.depto], duration: D(.25) }, '<0.08'));
    else rows.forEach(r => r.el.style.backgroundColor = GROUP_COLORS[r.depto]);
    flipReorder(tl, rows.slice().sort((a, b) => order.indexOf(a.depto) - order.indexOf(b.depto)));
  }
  function stepAggregate(tl) {
    const groups = {};
    liveRows().forEach(r => (groups[r.depto] = groups[r.depto] || []).push(r));
    const drop = ['nome', 'cargo'].flatMap(c => $$(`#qtTable [data-col="${c}"]`));
    const extras = Object.values(groups).flatMap(g => g.slice(1).map(r => r.el));
    const head = $('#qtTable .qt-row.head [data-col="salario"]');
    const finish = () => {
      head.textContent = 'AVG(salario)';
      Object.entries(groups).forEach(([d, g]) => {
        const avg = g.reduce((s, r) => s + r.salario, 0) / g.length;
        const dc = g[0].el.querySelector('[data-col="depto"]');
        dc.innerHTML = `${esc(d)}<span class="qt-badge">COUNT ${g.length}</span>`;
        const sc = g[0].el.querySelector('[data-col="salario"]');
        const o = { v: g[0].salario };
        if (G) G.to(o, { v: avg, duration: D(.8), ease: 'power1.out', onUpdate: () => sc.textContent = fmt(o.v) }); else sc.textContent = fmt(avg);
      });
    };
    if (!tl) { drop.forEach(c => c.remove()); extras.forEach(e => e.remove()); finish(); return; }
    tl.to(drop, { opacity: 0, duration: D(.25) })
      .to(drop, { flexGrow: 0, flexBasis: 0, paddingLeft: 0, paddingRight: 0, duration: D(.45) })
      .add(() => drop.forEach(c => c.remove()))
      .to(extras, { height: 0, paddingTop: 0, paddingBottom: 0, opacity: 0, duration: D(.5), ease: 'power2.in' })
      .add(() => extras.forEach(e => e.remove()))
      .add(finish).to({}, { duration: D(.85) });
  }
  function stepSet(tl) {
    const hit = liveRows().filter(r => r.depto === 'TI');
    hit.forEach(r => {
      const c = r.el.querySelector('[data-col="salario"]'); const o = { v: r.salario }; const target = r.salario * 1.1;
      if (!tl) { c.textContent = fmt(target); return; }
      tl.to(c, { backgroundColor: 'rgba(74,222,128,.3)', duration: D(.2) }, 0)
        .to(o, { v: target, duration: D(1), ease: 'power1.out', onUpdate: () => c.textContent = fmt(o.v) }, 0)
        .to(c, { backgroundColor: 'rgba(0,0,0,0)', duration: D(.6) }, D(1));
    });
    message(tl, '(2 linhas afetadas)');
  }
  function stepDelete(tl) {
    const hit = liveRows().filter(r => r.depto === 'RH');
    const els = hit.map(r => r.el);
    if (!tl) { els.forEach(e => e.remove()); message(null, '(1 linha afetada)'); return; }
    tl.to(els, { backgroundColor: 'rgba(255,95,109,.35)', duration: D(.2) })
      .to(els, { x: 6, repeat: 5, yoyo: true, duration: D(.05) })
      .to(els, { x: 60, opacity: 0, duration: D(.4), ease: 'power2.in' })
      .to(els, { height: 0, paddingTop: 0, paddingBottom: 0, duration: D(.3) })
      .add(() => els.forEach(e => e.remove()));
    message(tl, '(1 linha afetada)');
  }
  function message(tl, txt) {
    const add = () => { const m = document.createElement('div'); m.className = 'qt-msg'; m.textContent = txt; $('#qtTable').after(m); if (G) G.from(m, { opacity: 0, y: -6, duration: D(.3) }); };
    if (tl) tl.add(add); else add();
  }

  function initTheater() {
    $('#qtScenes').innerHTML = SCENES.map(s => `<button type="button" role="tab" data-id="${s.id}" aria-selected="false">${esc(s.label)}</button>`).join('');
    $$('#qtScenes button').forEach(b => b.addEventListener('click', () => { selectScene(b.dataset.id); play(); }));
    $('#qtPlay').addEventListener('click', play);
    $('#qtStep').addEventListener('click', () => { qt.token++; runStep(); });
    $('#qtReset').addEventListener('click', reset);
    selectScene('filtrar');
  }

  /* ------------------------------------------------------------------
     2. Faixa de palavras-chave
     ------------------------------------------------------------------ */
  function initMarquee() {
    const W = [['SELECT', 'dql'], ['CREATE TABLE', 'ddl'], ['INSERT', 'dml'], ['WHERE', 'dql'], ['GRANT', 'dcl'], ['JOIN', 'dql'], ['UPDATE', 'dml'], ['BEGIN TRAN', 'tcl'], ['GROUP BY', 'dql'], ['ALTER', 'ddl'], ['DELETE', 'dml'], ['HAVING', 'dql'], ['COMMIT', 'tcl'], ['REVOKE', 'dcl'], ['UNION', 'dql'], ['DROP', 'ddl'], ['ROLLBACK', 'tcl'], ['ORDER BY', 'dql']];
    const html = W.map(([w, c]) => `<span style="--c:var(--c-${c})">${w}</span>`).join('');
    const tr = $('#kwTrack'); tr.innerHTML = html + html;
    if (G && !reduce) G.to(tr, { xPercent: -50, duration: 40, ease: 'none', repeat: -1 });
  }

  /* ------------------------------------------------------------------
     3. Relacional: Cliente ⟶ Pedido
     ------------------------------------------------------------------ */
  const CLI = [[1, 'Mercado Bom Preço'], [2, 'Padaria Pão Quente'], [3, 'Tech Soluções'], [10, 'Café Aroma']];
  const PED = [[1, 1, 'Entregue'], [2, 1, 'Entregue'], [3, 2, 'Entregue'], [4, 3, 'Pago'], [5, 3, 'Enviado'], [11, 1, 'Enviado']];
  function initRelational() {
    $('#miniCliente').insertAdjacentHTML('beforeend', CLI.map(([id, n]) => `<div class="mini-row" data-c="${id}" tabindex="0" role="button" aria-label="Ver pedidos de ${esc(n)}"><span class="pk-t">${id}</span><span>${esc(n)}</span></div>`).join(''));
    $('#miniPedido').insertAdjacentHTML('beforeend', PED.map(([p, c, s]) => `<div class="mini-row" data-c="${c}"><span class="pk-t">${p}</span><span class="fk-t">${c}</span><span>${esc(s)}</span></div>`).join(''));
    $$('#miniCliente .mini-row[data-c]').forEach(r => {
      const on = () => lightClient(+r.dataset.c);
      r.addEventListener('mouseenter', on); r.addEventListener('focus', on); r.addEventListener('click', on);
    });
    $('#miniCliente').addEventListener('mouseleave', () => lightClient(null));
    window.addEventListener('resize', () => { if (relCurrent !== null) lightClient(relCurrent, true); });
  }
  let relCurrent = null;
  function lightClient(id, instant) {
    relCurrent = id;
    const svg = $('#relSvg'); svg.innerHTML = '';
    $$('#relStage .mini-row[data-c]').forEach(r => { r.classList.remove('lit', 'dim', 'orphan'); });
    const hint = $('#relHint');
    if (id === null) { hint.textContent = 'Passe o mouse ou toque em um cliente para ver os pedidos dele.'; return; }
    const crow = $(`#miniCliente .mini-row[data-c="${id}"]`);
    const prows = $$(`#miniPedido .mini-row[data-c="${id}"]`);
    $$('#relStage .mini-row[data-c]').forEach(r => { if (r !== crow && !prows.includes(r)) r.classList.add('dim'); });
    crow.classList.add(prows.length ? 'lit' : 'orphan'); prows.forEach(p => p.classList.add('lit'));
    const name = CLI.find(c => c[0] === id)[1];
    hint.innerHTML = prows.length
      ? `<b>${esc(name)}</b> (id_cliente = ${id}) tem ${prows.length} pedido(s). Em cada um, a FK <b>Pedido.id_cliente</b> guarda o valor ${id}.`
      : `<b>${esc(name)}</b> não tem pedidos. Num INNER JOIN ele some do resultado; num LEFT JOIN aparece com as colunas de Pedido em NULL.`;
    const st = $('#relStage').getBoundingClientRect(); const cb = crow.getBoundingClientRect();
    prows.forEach((p, k) => {
      const pb = p.getBoundingClientRect();
      const side = pb.left > cb.right - 4;
      const x1 = (side ? cb.right : cb.left) - st.left, y1 = cb.top + cb.height / 2 - st.top;
      const x2 = pb.left - st.left, y2 = pb.top + pb.height / 2 - st.top;
      const d = side ? `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}` : `M${x1},${y1} C${x1 - 40},${y1} ${x2 - 40},${y2} ${x2},${y2}`;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', d); svg.appendChild(path);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('cx', x2); dot.setAttribute('cy', y2); dot.setAttribute('r', 3.5); svg.appendChild(dot);
      if (G && !instant && !reduce) { const len = path.getTotalLength(); G.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: .5, delay: k * .08, ease: 'power2.out' }); G.from(dot, { scale: 0, transformOrigin: 'center', duration: .2, delay: .45 + k * .08 }); }
    });
  }

  /* ------------------------------------------------------------------
     4. Famílias de comandos
     ------------------------------------------------------------------ */
  const FAM = [
    { k: 'DDL', c: 'ddl', full: 'Data Definition Language', what: 'Define a estrutura: cria, altera e remove objetos.', verbs: 'CREATE · ALTER · DROP', sql: "CREATE TABLE Fornecedor (\n    id_fornecedor INT PRIMARY KEY IDENTITY(1,1),\n    razao_social  NVARCHAR(120) NOT NULL,\n    cnpj          CHAR(14) UNIQUE\n);", does: 'Cria a tabela vazia, com colunas, tipos e restrições.', not: 'Não insere nenhum dado.' },
    { k: 'DML', c: 'dml', full: 'Data Manipulation Language', what: 'Mexe nos dados: insere, altera e remove linhas.', verbs: 'INSERT · UPDATE · DELETE', sql: "UPDATE Produto\nSET preco = preco * 1.05\nWHERE categoria = 'Papelaria';", does: 'Altera o preço só dos produtos de Papelaria.', not: 'Sem WHERE, alteraria todos os produtos.' },
    { k: 'DQL', c: 'dql', full: 'Data Query Language', what: 'Consulta: lê e combina dados sem alterar nada.', verbs: 'SELECT', sql: "SELECT nome, salario\nFROM Funcionario\nWHERE salario > 5000\nORDER BY salario DESC;", does: 'Lista quem ganha mais de 5 mil, do maior salário ao menor.', not: 'Não altera nenhuma linha do banco.' },
    { k: 'DCL', c: 'dcl', full: 'Data Control Language', what: 'Segurança: quem pode fazer o quê.', verbs: 'GRANT · REVOKE · DENY', sql: "GRANT SELECT ON Cliente TO usuario_relatorio;", does: 'Permite que usuario_relatorio leia a tabela Cliente.', not: 'Não dá permissão de alterar dados.' },
    { k: 'TCL', c: 'tcl', full: 'Transaction Control (DTL)', what: 'Agrupa alterações: tudo ou nada.', verbs: 'BEGIN TRAN · COMMIT · ROLLBACK', sql: "BEGIN TRANSACTION;\nUPDATE Funcionario SET salario = 0 WHERE 1 = 1;\nROLLBACK;", does: 'Desfaz o UPDATE desastroso: os salários voltam ao valor anterior.', not: 'Depois de um COMMIT, o ROLLBACK não desfaz mais.' }
  ];
  function initFamilies() {
    const g = $('#famGrid');
    g.innerHTML = FAM.map((f, i) => `<button type="button" class="fam" style="--c:var(--c-${f.c})" data-i="${i}" aria-expanded="false"><span class="abbr">${f.k}</span><span class="full">${esc(f.full)}</span><span class="what">${esc(f.what)}</span><span class="verbs">${esc(f.verbs)}</span></button>`).join('');
    $$('.fam', g).forEach(b => b.addEventListener('click', () => openFamily(+b.dataset.i)));
  }
  function openFamily(i) {
    const g = $('#famGrid'); const f = FAM[i];
    const was = $(`.fam[data-i="${i}"]`, g).getAttribute('aria-expanded') === 'true';
    $$('.fam', g).forEach(b => b.setAttribute('aria-expanded', 'false'));
    const old = $('.fam-detail', g); if (old) old.remove();
    if (was) return;
    $(`.fam[data-i="${i}"]`, g).setAttribute('aria-expanded', 'true');
    const hl = window.LabApp ? window.LabApp.highlight : esc;
    const d = document.createElement('div'); d.className = 'fam-detail';
    d.innerHTML = `<div><h3><span class="cat cat-${f.k}">${f.k}</span> ${esc(f.full)}</h3><ul class="does"><li><span class="y">✓</span><span>${esc(f.does)}</span></li><li><span class="n">✗</span><span>${esc(f.not)}</span></li></ul>
      <div class="d-flex gap-2 mt-3 flex-wrap"><button class="btn-lab btn-sm-lab" type="button" data-term>Executar no terminal</button><button class="btn-ghost btn-sm-lab" type="button" data-tut>Ver no tutorial</button></div></div>
      <pre class="code">${hl(f.sql)}</pre>`;
    // insere a explicação logo após a linha do cartão clicado
    const cards = $$('.fam', g); const cols = getComputedStyle(g).gridTemplateColumns.split(' ').length;
    const after = cards[Math.min(cards.length - 1, Math.floor(i / cols) * cols + cols - 1)];
    after.after(d);
    $('[data-term]', d).addEventListener('click', () => window.LabApp && window.LabApp.sendToTerminal(f.sql));
    $('[data-tut]', d).addEventListener('click', () => { if (window.LabTutorial) window.LabTutorial.openByCat(f.k); });
    if (G) G.from(d, { opacity: 0, y: -10, duration: D(.35), ease: 'power2.out' });
  }

  /* ------------------------------------------------------------------
     5. Entrada da página e rolagem
     ------------------------------------------------------------------ */
  function splitTitle() {
    const h = $('#heroTitle'); if (!h || h.dataset.split) return;
    const walk = (node) => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(p => { if (!p) return; if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p)); else { const s = document.createElement('span'); s.className = 'w'; s.textContent = p; frag.appendChild(s); } });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'EM') walk(n);
        else if (n.nodeType === 1) n.classList.add('w');
      });
    };
    walk(h); h.dataset.split = '1';
  }
  let introDone = false, scrollSet = false;
  function intro() {
    if (!G || reduce) return;
    splitTitle();
    const tl = G.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('#heroTitle .w', { y: 36, opacity: 0, duration: .7, stagger: .035 })
      .from('.hero-lede, .hero-cta', { y: 16, opacity: 0, duration: .5, stagger: .1 }, '-=.5')
      .from('.hero-counts > div', { y: 14, opacity: 0, duration: .4, stagger: .07 }, '-=.3')
      .from('#queryTheater', { y: 30, opacity: 0, rotate: 1.2, duration: .8 }, .25);
    $$('.hero-counts dd').forEach(dd => { const o = { v: 0 }; const to = +dd.dataset.count; tl.to(o, { v: to, duration: 1, ease: 'power2.out', onUpdate: () => dd.textContent = Math.round(o.v) }, .6); });
    tl.add(() => play(), '-=.2');
  }
  function scrollAnims() {
    if (!G || !window.ScrollTrigger || reduce || scrollSet) return; scrollSet = true;
    $$('.home-sec .sec-head').forEach(h => G.from(h.children, { y: 24, opacity: 0, duration: .6, stagger: .08, ease: 'power2.out', scrollTrigger: { trigger: h, start: 'top 85%' } }));
    G.from('.rel-term', { x: -16, opacity: 0, stagger: .06, duration: .45, scrollTrigger: { trigger: '#hRelacional .rel-wrap', start: 'top 80%' } });
    G.from('.mini', { y: 26, opacity: 0, stagger: .15, duration: .6, ease: 'back.out(1.4)', scrollTrigger: { trigger: '#relStage', start: 'top 80%', onEnter: () => setTimeout(() => { if (relCurrent === null) lightClient(1); }, 700) } });
    G.from('.fam', { y: 40, opacity: 0, rotateX: -25, transformPerspective: 600, stagger: .08, duration: .6, ease: 'power3.out', scrollTrigger: { trigger: '#famGrid', start: 'top 85%' } });
    G.from('.path li', { y: 30, opacity: 0, stagger: .1, duration: .5, scrollTrigger: { trigger: '#pathList', start: 'top 85%' } });
    G.from('.home-final', { scale: .96, opacity: 0, duration: .6, scrollTrigger: { trigger: '.home-final', start: 'top 90%' } });
  }

  function onShow() {
    if (!introDone) { introDone = true; intro(); if (!G || reduce) play(); }
    scrollAnims();
  }

  function init() {
    initTheater(); initMarquee(); initRelational(); initFamilies();
  }
  document.addEventListener('lab:ready', init, { once: true });
  window.LabHome = { onShow: () => { if (!$('#qtScenes').children.length) init(); onShow(); } };
})();

/* =====================================================================
   SQL Lab · Levar o banco para SSMS, DBeaver, Azure Data Studio...
   Gera os arquivos na hora, a partir do banco original ou do atual.
   ===================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let modal = null;

  /* ---------- Geração ---------- */
  function sourceEngine() {
    const A = window.LabApp;
    if ($('#dlAtual').checked) return A.engine.clone();
    const e = new SQLEngine.Engine(A.engine.SQL);
    e.run(LAB.SEED_SQL + LAB.SEED_PROCS);
    return e;
  }
  const SQLSERVER_HEADER = `-- =============================================================
-- Banco LabUnidade2 · SQL Lab Unidade II (UNIP)
-- Para SQL Server 2016+ · SSMS, Azure Data Studio ou DBeaver
-- SSMS: Arquivo > Abrir > Arquivo (Ctrl+O) e depois Executar (F5)
-- =============================================================
IF DB_ID('LabUnidade2') IS NULL CREATE DATABASE LabUnidade2;
GO
USE LabUnidade2;
GO

`;
  function buildTSQL(withData) { return SQLSERVER_HEADER + sourceEngine().script({ data: withData }); }
  function buildSQLite() {
    const e = sourceEngine();
    e.db.run('DROP TABLE IF EXISTS __lab_procs; DROP TABLE IF EXISTS __lab_perms;');
    const has = (n) => e.scalar(`SELECT COUNT(*) FROM sqlite_master WHERE name = '${n}'`);
    if (!has('vw_PedidosComTotal') && has('Pedido') && has('ItemPedido') && has('Cliente')) e.db.run(`CREATE VIEW vw_PedidosComTotal AS
SELECT P.id_pedido, C.nome AS cliente, P.data_pedido, P.status, SUM(I.quantidade * I.preco_unitario) AS total
FROM Pedido P JOIN Cliente C ON C.id_cliente = P.id_cliente JOIN ItemPedido I ON I.id_pedido = P.id_pedido
GROUP BY P.id_pedido, C.nome, P.data_pedido, P.status;`);
    if (!has('vw_FuncionarioDepartamento') && has('Funcionario') && has('Departamento')) e.db.run(`CREATE VIEW vw_FuncionarioDepartamento AS
SELECT F.id_funcionario, F.nome, F.cargo, F.salario, D.nome AS departamento, G.nome AS gerente
FROM Funcionario F LEFT JOIN Departamento D ON D.id_departamento = F.id_departamento
LEFT JOIN Funcionario G ON G.id_funcionario = F.id_gerente;`);
    e.db.run('VACUUM;');
    return e.export();
  }

  const FILES = [
    {
      id: 'tsql', title: 'SQL Server', file: 'labunidade2_sqlserver.sql', mime: 'text/plain;charset=utf-8',
      tools: ['SSMS', 'Azure Data Studio', 'DBeaver + SQL Server'],
      what: 'Script T-SQL completo: cria o banco LabUnidade2, as tabelas com PK, FK e restrições, os dados e as stored procedures.',
      steps: ['Abra o arquivo no SSMS (Ctrl+O) ou no editor SQL da ferramenta.', 'Execute o script inteiro (F5 no SSMS, Alt+X no DBeaver).', 'No Pesquisador de Objetos: LabUnidade2 → Diagramas de Banco de Dados → Novo Diagrama → adicione as tabelas.'],
      build: () => buildTSQL(true), copy: true
    },
    {
      id: 'sqlite', title: 'Arquivo SQLite', file: 'labunidade2.db', mime: 'application/vnd.sqlite3',
      tools: ['DBeaver', 'DB Browser for SQLite', 'DataGrip', 'VS Code'],
      what: 'O banco pronto em um único arquivo. Abre direto, sem instalar servidor. Inclui duas views de estudo. Procedures não existem no SQLite.',
      steps: ['DBeaver: Nova conexão → SQLite.', 'Em "Caminho", selecione o arquivo labunidade2.db (aceite baixar o driver).', 'Expanda a conexão, clique com o botão direito em Tabelas → Visualizar diagrama.'],
      build: () => buildSQLite(), copy: false
    },
    {
      id: 'ddl', title: 'Somente esquema (DDL)', file: 'labunidade2_esquema.sql', mime: 'text/plain;charset=utf-8',
      tools: ['SSMS', 'Azure Data Studio', 'Git'],
      what: 'Só a estrutura, sem nenhum dado: o mesmo resultado de "Gerar Scripts → somente esquema" do SSMS, visto na Aula 4.',
      steps: ['Use para montar um ambiente de testes vazio ou versionar o banco no Git.', 'Execute no SQL Server da mesma forma que o script completo.', 'Repare na ordem: tabelas pai antes das filhas.'],
      build: () => buildTSQL(false), copy: true
    }
  ];

  function size(n) { return n < 1024 ? n + ' B' : (n / 1024).toFixed(1).replace('.', ',') + ' KB'; }
  function render() {
    const grid = $('#dlGrid'); let sizes = {};
    try { FILES.forEach(f => { const c = f.build(); sizes[f.id] = typeof c === 'string' ? new Blob([c]).size : c.length; }); }
    catch (e) { grid.innerHTML = `<div class="alert-lab al-atencao"><b>Não foi possível gerar agora.</b><span>${esc(e.message)}</span></div>`; return; }
    grid.innerHTML = FILES.map(f => `<article class="dl-card">
        <div class="dl-head"><span class="dl-ext">${esc(f.file.split('.').pop())}</span><div><h3>${esc(f.title)}</h3><div class="dl-file mono">${esc(f.file)} · ${size(sizes[f.id])}</div></div></div>
        <div class="dl-tags">${f.tools.map(t => `<span>${esc(t)}</span>`).join('')}</div>
        <p>${esc(f.what)}</p>
        <ol class="dl-steps">${f.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        <div class="dl-actions"><button class="btn-lab btn-sm-lab" type="button" data-dl="${f.id}">Baixar ${esc(f.file.split('.').pop())}</button>${f.copy ? `<button class="btn-ghost btn-sm-lab" type="button" data-copy="${f.id}">Copiar script</button>` : ''}</div>
      </article>`).join('');
    $$('[data-dl]', grid).forEach(b => b.addEventListener('click', () => download(FILES.find(f => f.id === b.dataset.dl))));
    $$('[data-copy]', grid).forEach(b => b.addEventListener('click', () => copy(FILES.find(f => f.id === b.dataset.copy))));
  }

  function download(f) {
    let content;
    try { content = f.build(); } catch (e) { window.LabApp.toast(e.message); return; }
    const blob = new Blob([content], { type: f.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = f.file; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    window.LabApp.toast(`Baixando ${f.file}`);
  }
  function copy(f) {
    const text = f.build();
    const done = () => window.LabApp.toast('Script copiado. Cole no editor da ferramenta.');
    const fallback = () => { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { window.LabApp.toast('Não consegui copiar automaticamente.'); } t.remove(); };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }

  function open() {
    if (!window.LabApp) return;
    const tx = window.LabApp.engine.inTx;
    $('#dlAtual').disabled = tx;
    if (tx) $('#dlOrig').checked = true;
    $('#dlAtual').closest('.dl-radio').title = tx ? 'Finalize a transação aberta (COMMIT ou ROLLBACK) para exportar o estado atual.' : '';
    render();
    modal = modal || new bootstrap.Modal('#modalDownload');
    modal.show();
  }

  document.addEventListener('click', (e) => { if (e.target.closest('[data-action="download"]')) { e.preventDefault(); open(); } });
  document.addEventListener('change', (e) => { if (e.target.name === 'dlState') render(); });
  window.LabDownloads = { open };
})();

/* =====================================================================
   SQL Lab · Unidade II — Interface
   ===================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = { db: 'sqllab2.db.v1', prog: 'sqllab2.missions', hist: 'sqllab2.history', theme: 'sqllab2.theme', safe: 'sqllab2.safe', quiz: 'sqllab2.quizbest' };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } }
  };

  let SQL, engine, termEd, missionEd;
  const state = { history: store.get(KEY.hist, []), hIdx: -1, lastEntries: [], xraySel: 0, executed: 0, progress: store.get(KEY.prog, {}), mission: null };

  /* =============================== Tema =============================== */
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function effectiveTheme() { const t = document.documentElement.getAttribute('data-theme'); return t || (mq.matches ? 'dark' : 'light'); }
  function syncBsTheme() { const t = effectiveTheme(); document.documentElement.setAttribute('data-bs-theme', t); $('#themeIcon').textContent = t === 'dark' ? '☾' : '☀'; }
  function initTheme() {
    const saved = store.get(KEY.theme, null);
    if (saved && !document.documentElement.getAttribute('data-theme')) document.documentElement.setAttribute('data-theme', saved);
    syncBsTheme();
    mq.addEventListener ? mq.addEventListener('change', syncBsTheme) : mq.addListener(syncBsTheme);
    new MutationObserver(syncBsTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    $('#btnTheme').addEventListener('click', () => { const n = effectiveTheme() === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', n); store.set(KEY.theme, n); });
  }

  /* ========================= Realce de sintaxe ========================= */
  const KW = new Set('SELECT FROM WHERE AND OR NOT IN IS NULL LIKE BETWEEN AS ON JOIN INNER LEFT RIGHT FULL OUTER CROSS GROUP BY ORDER HAVING DISTINCT TOP UNION ALL INTERSECT EXCEPT INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP TRUNCATE ADD COLUMN PRIMARY KEY FOREIGN REFERENCES UNIQUE CHECK DEFAULT CONSTRAINT CASCADE NO ACTION INDEX VIEW PROCEDURE PROC EXEC EXECUTE BEGIN END TRANSACTION TRAN COMMIT ROLLBACK SAVE GRANT REVOKE DENY TO CASE WHEN THEN ELSE EXISTS ASC DESC DECLARE PRINT GO WITH LIMIT IDENTITY USE OR REPLACE IF'.split(' '));
  const FN = new Set('COUNT SUM AVG MIN MAX LEN LENGTH ISNULL IFNULL COALESCE UPPER LOWER SUBSTRING SUBSTR GETDATE YEAR MONTH DAY DATEDIFF DATEADD CAST CONVERT ROUND ABS CONCAT REPLACE TRIM LTRIM RTRIM CHARINDEX NULLIF'.split(' '));
  const TY = new Set('INT INTEGER BIGINT SMALLINT TINYINT DECIMAL NUMERIC FLOAT REAL MONEY BIT CHAR VARCHAR NVARCHAR NCHAR TEXT DATE TIME DATETIME DATETIME2 VARBINARY UNIQUEIDENTIFIER'.split(' '));
  const HL = /(--[^\n]*)|(\/\*[\s\S]*?(?:\*\/|$))|(N?'(?:[^']|'')*'?)|(\b\d+(?:\.\d+)?\b)|(@@?\w+)|([A-Za-z_][\w$]*)|([\s\S])/g;
  function highlight(src) {
    let out = ''; let m; HL.lastIndex = 0;
    while ((m = HL.exec(src))) {
      const v = esc(m[0]);
      if (m[1] || m[2]) out += `<span class="hl-com">${v}</span>`;
      else if (m[3]) out += `<span class="hl-str">${v}</span>`;
      else if (m[4]) out += `<span class="hl-num">${v}</span>`;
      else if (m[5]) out += `<span class="hl-var">${v}</span>`;
      else if (m[6]) { const u = m[6].toUpperCase(); out += KW.has(u) ? `<span class="hl-kw">${v}</span>` : FN.has(u) ? `<span class="hl-fn">${v}</span>` : TY.has(u) ? `<span class="hl-type">${v}</span>` : /^sp_/i.test(m[6]) ? `<span class="hl-fn">${v}</span>` : v; }
      else out += v;
    }
    return out;
  }

  /* ============================== Editor ============================== */
  function makeEditor(host, { placeholder = '', onRun, onHistory, boxed = false, id }) {
    host.classList.add('editor'); if (boxed) host.classList.add('boxed');
    host.innerHTML = `<pre aria-hidden="true"><code></code></pre><textarea id="${id}" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Editor SQL" placeholder="${esc(placeholder)}"></textarea>`;
    const ta = $('textarea', host), code = $('code', host), pre = $('pre', host);
    const paint = () => { code.innerHTML = highlight(ta.value) + (ta.value.endsWith('\n') || !ta.value ? ' ' : ''); pre.scrollTop = ta.scrollTop; };
    const grow = () => { if (boxed) return; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, window.innerHeight * 0.4) + 'px'; };
    ta.addEventListener('input', () => { paint(); grow(); });
    ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; });
    ta.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || e.key === 'F5') { e.preventDefault(); onRun && onRun(); return; }
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('    ', s, ta.selectionEnd, 'end'); paint(); return; }
      if (onHistory && (e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); onHistory(e.key === 'ArrowUp' ? 1 : -1); }
    });
    const api = {
      el: ta,
      get: () => ta.value,
      set: (v) => { ta.value = v; paint(); grow(); },
      selection: () => ta.value.slice(ta.selectionStart, ta.selectionEnd),
      focus: () => { try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); } }
    };
    paint();
    return api;
  }

  /* ============================ Utilidades ============================ */
  function fmt(v) {
    if (v === null || v === undefined) return { t: 'NULL', c: 'null' };
    if (typeof v === 'number') { let s = Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(6))); return { t: s, c: 'num' }; }
    if (v instanceof Uint8Array) return { t: '0x' + [...v.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase() + (v.length > 16 ? '…' : ''), c: '' };
    return { t: String(v), c: '' };
  }
  const isNoName = (c) => /[()*+\-\/|]|\s/.test(c);
  function tableHTML(cols, rows, { maxRows = 500, rn = true } = {}) {
    const head = (rn ? '<th class="rn"></th>' : '') + cols.map(c => isNoName(c) ? `<th class="noname" title="Expressão: ${esc(c)} — use AS para dar nome">(Nenhum nome de coluna)</th>` : `<th>${esc(c)}</th>`).join('');
    const body = rows.slice(0, maxRows).map((r, i) => '<tr>' + (rn ? `<td class="rn">${i + 1}</td>` : '') + r.map(v => { const f = fmt(v); return `<td class="${f.c}">${esc(f.t)}</td>`; }).join('') + '</tr>').join('');
    return `<div class="t-table-wrap"><table class="t-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function toCSV(cols, rows) { const q = (v) => { const s = v === null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; return [cols.join(';'), ...rows.map(r => r.map(q).join(';'))].join('\n'); }
  function copyText(text, okMsg = 'Copiado') {
    try { navigator.clipboard.writeText(text).then(() => toast(okMsg), () => fallback()); } catch (e) { fallback(); }
    function fallback() { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast(okMsg); } catch (e) { toast('Selecione e copie manualmente'); } t.remove(); }
  }
  let toastT; function toast(msg) { let t = $('.toast-lab'); if (!t) { t = document.createElement('div'); t.className = 'toast-lab'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2400); }
  function b64(bytes) { let s = ''; const ch = 0x8000; for (let i = 0; i < bytes.length; i += ch) s += String.fromCharCode.apply(null, bytes.subarray(i, i + ch)); return btoa(s); }
  function unb64(str) { const s = atob(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  let saveT; function saveDb() { clearTimeout(saveT); saveT = setTimeout(() => { if (engine.inTx) return; try { localStorage.setItem(KEY.db, b64(engine.export())); } catch (e) { } }, 400); }

  /* ============================== Terminal ============================= */
  const out = () => $('#termOut');
  function tprint(html, cls = '') { const d = document.createElement('div'); d.className = 't-line ' + cls; d.innerHTML = html; out().appendChild(d); return d; }
  function scrollEnd() { const o = out(); o.scrollTop = o.scrollHeight; }
  function echo(cmd) {
    tprint(`<span class="t-prompt1">┌──(<span class="u">aluno㉿unip</span>)-[<span class="p">~/unidade2</span>]</span>${engine.inTx ? '<span class="t-warn"> (TRAN)</span>' : ''}`);
    tprint(`<span class="t-prompt2">└─<span class="d">$</span></span> <span class="t-cmd">${highlight(cmd)}</span>`);
  }
  function welcome() {
    tprint(`<span class="t-info">  ____   ___  _       _          _     </span>
<span class="t-info"> / ___| / _ \\| |     | |    __ _| |__  </span>
<span class="t-info"> \\___ \\| | | | |     | |   / _\` | '_ \\ </span>
<span class="t-info">  ___) | |_| | |___  | |__| (_| | |_) |</span>
<span class="t-info"> |____/ \\__\\_\\_____| |_____\\__,_|_.__/ </span>  <span class="t-dim">Unidade II</span>`);
    tprint(`<span class="t-dim">Microsoft SQL Server (simulado) · motor SQLite ${esc(engine.scalar('select sqlite_version()'))} em WebAssembly</span>`);
    const t = engine.tables().filter(x => x.type === 'table');
    tprint(`<span class="t-ok">✔</span> Banco <b>LabUnidade2</b> pronto: ${t.length} tabelas, ${engine.procs().length} procedures. Chaves estrangeiras <span class="t-ok">ativas</span>.`);
    tprint(`<span class="t-dim">Comece por:</span> <span class="t-info">SELECT * FROM Funcionario;</span> <span class="t-dim">· abra a</span> Biblioteca <span class="t-dim">· ou digite</span> <span class="t-info">help</span>`, 't-block');
  }
  function renderEntry(e, depth = 0) {
    const a = e.analysis || {}; const cat = a.cat || '?';
    const firstLine = (e.sql || '').split('\n')[0].slice(0, 70);
    const box = document.createElement('div'); box.className = 't-block'; if (depth) box.style.marginLeft = '1rem';
    let h = `<div class="t-line"><span class="t-tag ${esc(cat)}">${esc(cat)}</span><span class="t-dim">${esc(firstLine)}${(e.sql || '').length > 70 || (e.sql || '').includes('\n') ? ' …' : ''}</span></div>`;
    if (e.kind === 'result') {
      h += tableHTML(e.cols, e.rows);
      const more = e.total > 500 ? ` · exibindo 500 de ${e.total}` : '';
      h += `<div class="t-meta"><span>(${e.total} ${e.total === 1 ? 'linha' : 'linhas'})${more}</span><span>${e.ms.toFixed(1)} ms</span><button type="button" data-csv>copiar CSV</button></div>`;
    } else if (e.kind === 'msg') {
      h += `<div class="t-line t-ok">${esc(e.msg)}</div>`;
    } else if (e.kind === 'error') {
      const er = e.err;
      h += `<div class="t-errbox"><div class="t-err">${er.code ? `Msg ${er.code}, Nível 16, Estado 1` : 'Erro'}</div><div class="t-err">${esc(er.title)}</div>${er.why ? `<div class="t-dim">por quê: ${esc(er.why)}</div>` : ''}${er.fix ? `<div class="t-info">→ ${esc(er.fix)}</div>` : ''}</div>`;
    } else if (e.kind === 'blocked') {
      h += `<div class="t-blockbox"><div class="t-warn">⛔ ${esc(e.msg)}</div><div class="t-dim">No SQL Server real o comando rodaria sem perguntar. Adicione um WHERE, desligue o modo seguro ou confirme abaixo.</div><div class="t-meta mt-1"><button type="button" data-force>executar mesmo assim</button><button type="button" data-wrap>executar dentro de uma transação</button></div></div>`;
    } else if (e.kind === 'proc') {
      const ps = Object.entries(e.params).map(([k, v]) => `${k} = ${v}`).join(', ');
      h += `<div class="t-line t-vio">▸ EXEC ${esc(e.name)}${ps ? ' ' + esc(ps) : ''}</div>`;
    }
    const w = (a.warnings || []).filter(x => x.level === 'erro' || x.level === 'atencao');
    if (w.length && e.kind !== 'blocked') h += `<div class="t-line t-warn">⚠ ${esc(w[0].text)}${w.length > 1 ? ` (+${w.length - 1})` : ''} <span class="t-dim">— veja o Raio-X</span></div>`;
    if (e.notes && e.notes.length) h += `<div class="t-line t-dim">↳ tradução T-SQL: ${esc(e.notes.join(', '))}</div>`;
    box.innerHTML = h;
    const csv = $('[data-csv]', box); if (csv) csv.addEventListener('click', () => copyText(toCSV(e.cols, e.rows), 'CSV copiado'));
    const force = $('[data-force]', box); if (force) force.addEventListener('click', () => runTerminal(e.sql + ' -- confirmar'));
    const wrap = $('[data-wrap]', box); if (wrap) wrap.addEventListener('click', () => runTerminal('BEGIN TRANSACTION;\n' + e.sql + ' -- confirmar\n;\n-- confira o resultado e depois digite COMMIT ou ROLLBACK'));
    out().appendChild(box);
    if (e.kind === 'proc') e.children.forEach(c => renderEntry(c, depth + 1));
  }
  const META = /^\s*(help|\?|clear|cls|tables|desc\s+\w+|describe\s+\w+|history|reset)\s*;?\s*$/i;
  function runTerminal(text, { echoCmd = true } = {}) {
    text = (text || '').trim(); if (!text) return;
    if (echoCmd) echo(text);
    pushHistory(text);
    const mm = text.match(META);
    if (mm) { meta(mm[1]); scrollEnd(); return; }
    let entries;
    try { entries = engine.run(text); } catch (e) { tprint(`<span class="t-err">${esc(e.message)}</span>`); return; }
    entries.forEach(e => renderEntry(e));
    state.executed += entries.length;
    state.lastEntries = flatten(entries); state.xraySel = Math.max(0, state.lastEntries.length - 1);
    // prioriza mostrar no Raio-X o primeiro comando com problema
    const bad = state.lastEntries.findIndex(x => x.kind === 'error' || x.kind === 'blocked'); if (bad >= 0) state.xraySel = bad;
    renderXray();
    afterChange(entries);
    scrollEnd();
  }
  function flatten(list) { const r = []; list.forEach(e => { r.push(e); if (e.kind === 'proc') r.push(...flatten(e.children)); }); return r; }
  function afterChange(entries) {
    const all = flatten(entries);
    if (all.some(e => e.ddl || (e.analysis && e.analysis.cat === 'DDL' && e.kind !== 'error'))) { renderExplorer(); if (!$('#view-der').hidden) renderDER(); }
    else if (all.some(e => e.dml || (e.analysis && ['DML', 'TCL', 'DCL'].includes(e.analysis.cat)))) renderExplorer();
    if (all.some(e => e.kind !== 'error' && e.analysis && e.analysis.cat !== 'DQL')) saveDb();
    $('#txPill').hidden = !engine.inTx; $('#promptTx').textContent = engine.inTx ? ' (TRAN aberta)' : '';
    renderStats();
  }
  function meta(cmd) {
    const c = cmd.toLowerCase();
    if (c === 'clear' || c === 'cls') { out().innerHTML = ''; return; }
    if (c === 'help' || c === '?') {
      tprint(`<span class="t-info">Comandos do terminal</span>
  <span class="t-ok">help</span>            esta ajuda
  <span class="t-ok">clear</span> | <span class="t-ok">cls</span>     limpa a tela
  <span class="t-ok">tables</span>          lista tabelas e views (sp_tables)
  <span class="t-ok">desc</span> Tabela     colunas, tipos e chaves (sp_help)
  <span class="t-ok">history</span>         últimos comandos
  <span class="t-ok">reset</span>           restaura o banco original

<span class="t-info">Procedures de sistema simuladas</span>
  sp_tables · sp_help [tabela] · sp_helptext proc · sp_stored_procedures · sp_helprotect

<span class="t-info">Atalhos</span>
  F5 ou Ctrl+Enter executa · botão "seleção" executa só o trecho selecionado
  Ctrl+↑/↓ navega no histórico · Tab insere 4 espaços
  Vários comandos podem ser separados por ; ou por GO`, 't-block'); return;
    }
    if (c === 'tables') { engine.run('sp_tables').forEach(e => renderEntry(e)); return; }
    if (/^desc/.test(c)) { engine.run('sp_help ' + cmd.split(/\s+/)[1]).forEach(e => renderEntry(e)); return; }
    if (c === 'history') { tprint(state.history.slice(0, 20).map((h, i) => `<span class="t-dim">${String(i + 1).padStart(3)}</span>  ${esc(h.split('\n')[0].slice(0, 90))}`).join('\n') || '<span class="t-dim">(vazio)</span>', 't-block'); return; }
    if (c === 'reset') { openReset(); return; }
  }
  function pushHistory(t) { if (state.history[0] !== t) state.history.unshift(t); state.history = state.history.slice(0, 100); state.hIdx = -1; store.set(KEY.hist, state.history); }
  function histNav(dir) { const h = state.history; if (!h.length) return; state.hIdx = Math.max(-1, Math.min(h.length - 1, state.hIdx + dir)); termEd.set(state.hIdx < 0 ? '' : h[state.hIdx]); }
  function runFromEditor(selOnly) { const sel = termEd.selection(); const t = selOnly ? sel : termEd.get(); if (selOnly && !sel.trim()) { toast('Selecione um trecho do editor primeiro'); return; } runTerminal(t); if (!selOnly) termEd.set(''); }
  function sendToTerminal(sql, run = true) { go('terminal'); if (run) runTerminal(sql); else { termEd.set(sql); termEd.focus(); } }

  /* =============================== Raio-X ============================== */
  function renderXray() {
    const host = $('#xray'); const list = state.lastEntries;
    if (!list.length) return;
    const i = Math.min(state.xraySel, list.length - 1); const e = list[i]; const a = e.analysis || { cat: '?', clauses: [], warnings: [] };
    let tabs = '';
    if (list.length > 1) tabs = `<div class="xray-tabs" role="tablist">${list.map((x, k) => `<button type="button" role="tab" class="${k === i ? 'on' : ''}" data-k="${k}"><span class="cat cat-${esc((x.analysis || {}).cat || '')}">${esc((x.analysis || {}).cat || '?')}</span>${k + 1} · ${esc((x.analysis || {}).key || '')}${x.kind === 'error' ? ' <span style="color:var(--bad)">✖</span>' : x.kind === 'blocked' ? ' ⛔' : ''}</button>`).join('')}</div>`;
    const status = e.kind === 'error' ? `<div class="alert-lab al-erro"><b>Erro ${e.err.code ? 'Msg ' + e.err.code : ''}: ${esc(e.err.title)}</b>${e.err.why ? `<span>${esc(e.err.why)}</span>` : ''}${e.err.fix ? `<span class="fx">Como corrigir: ${esc(e.err.fix)}</span>` : ''}</div>`
      : e.kind === 'blocked' ? `<div class="alert-lab al-atencao"><b>${esc(e.msg)}</b><span class="fx">O modo seguro existe só no simulador. Em produção, a proteção é o hábito: WHERE + transação.</span></div>` : '';
    const cl = a.clauses && a.clauses.length ? a.clauses.map(c => `<div class="clause"><b>${esc(c.k)}</b> — ${esc(c.does)}${c.not ? `<div class="not">Não faz: ${esc(c.not)}</div>` : ''}</div>`).join('') : '<p class="empty mb-0">Sem cláusulas adicionais para comentar.</p>';
    const order = a.order ? `<div class="xray-card"><h4>Ordem lógica de processamento</h4><div class="flow">${a.order.map(([n, on], k) => `${k ? '<i>→</i>' : ''}<span class="${on ? 'on' : ''}">${esc(n)}</span>`).join('')}</div><p class="small text-muted-2 mt-2 mb-0">Em destaque, as etapas presentes neste comando. Por isso um alias do SELECT não pode ser usado no WHERE.</p></div>` : '';
    const warns = a.warnings && a.warnings.length ? a.warnings.map(w => `<div class="alert-lab al-${esc(w.level)}"><b>${{ erro: 'Erro de lógica', atencao: 'Atenção', dica: 'Boa prática', info: 'Desempenho' }[w.level] || 'Nota'}:</b> <span>${esc(w.text)}</span>${w.fix ? `<span class="fx">→ ${esc(w.fix)}</span>` : ''}</div>`).join('') : `<div class="alert-lab al-ok"><b>Nenhum alerta.</b><span>O comando segue as boas práticas verificadas pelo laboratório.</span></div>`;
    host.innerHTML = `${tabs}${status ? '<div class="mt-2">' + status + '</div>' : ''}
      <div class="xray-grid">
        <div class="xray-card"><h4>Classificação</h4>
          <div class="d-flex gap-2 align-items-center flex-wrap mb-2"><span class="cat cat-${esc(a.cat)}">${esc(a.cat)}</span><b class="mono" style="font-size:.9rem">${esc(a.key || '')}</b></div>
          <ul class="does"><li><span class="y">✓</span><span>${esc(a.does || '')}</span></li>${a.not ? `<li><span class="n">✗</span><span>${esc(a.not)}</span></li>` : ''}</ul>
          ${e.notes && e.notes.length ? `<p class="small text-muted-2 mt-2 mb-0">Traduzido para o simulador: ${esc(e.notes.join(', '))}.</p>` : ''}
        </div>
        <div class="xray-card"><h4>Cláusulas usadas</h4>${cl}</div>
        ${order}
        <div class="xray-card"><h4>Alertas e boas práticas</h4>${warns}</div>
      </div>`;
    $$('.xray-tabs button', host).forEach(b => b.addEventListener('click', () => { state.xraySel = +b.dataset.k; renderXray(); }));
  }

  /* ============================ Explorador ============================= */
  function renderExplorer() {
    const tabs = engine.tables(); const procs = engine.procs();
    const tbl = tabs.filter(t => t.type === 'table'), views = tabs.filter(t => t.type === 'view');
    const obj = (t) => `<details class="obj"><summary>${esc(t.name)}<span class="rows">${t.count} lin.</span></summary>
      <ul class="cols">${t.cols.map(c => { const fk = t.fks.find(f => f.from === c.name); return `<li>${c.pk ? '<span class="key pk">PK</span>' : ''}${fk ? `<span class="key fk" title="→ ${esc(fk.table)}.${esc(fk.to)} (ON DELETE ${esc(fk.onDelete)})">FK</span>` : ''}<span>${esc(c.name)}</span><span class="ty">${esc(c.type)}${c.notnull && !c.pk ? ' NN' : ''}</span></li>`; }).join('')}</ul>
      <div class="obj-actions"><button type="button" data-q="SELECT TOP 100 * FROM ${esc(t.name)};">SELECT TOP 100</button><button type="button" data-q="sp_help ${esc(t.name)};">sp_help</button><button type="button" data-ins="${esc(t.name)}">inserir nome</button></div></details>`;
    const html = `<div class="grp"><span>Tabelas</span><span>${tbl.length}</span></div>${tbl.map(obj).join('')}
      ${views.length ? `<div class="grp"><span>Views</span><span>${views.length}</span></div>${views.map(obj).join('')}` : ''}
      <div class="grp"><span>Procedures</span><span>${procs.length}</span></div>
      ${procs.map(p => `<details class="obj"><summary>${esc(p.name)}</summary><ul class="cols">${p.params.map(x => `<li><span class="hl-var">${esc(x.name)}</span><span class="ty">${esc(x.type)}</span></li>`).join('') || '<li class="ty">sem parâmetros</li>'}</ul><div class="obj-actions"><button type="button" data-ed="EXEC ${esc(p.name)} ${esc(p.params.map(x => x.name + ' = ').join(', '))}">EXEC…</button><button type="button" data-q="sp_helptext ${esc(p.name)};">código</button></div></details>`).join('')}`;
    ['#explorer', '#explorerMobile'].forEach(sel => {
      const host = $(sel); const open = $$('details[open] > summary', host).map(s => s.firstChild.textContent);
      host.innerHTML = html;
      $$('details', host).forEach(d => { if (open.includes($('summary', d).firstChild.textContent)) d.open = true; });
      $$('[data-q]', host).forEach(b => b.addEventListener('click', () => { closeOffcanvas(); runTerminal(b.dataset.q); }));
      $$('[data-ed]', host).forEach(b => b.addEventListener('click', () => { closeOffcanvas(); termEd.set(b.dataset.ed); termEd.focus(); }));
      $$('[data-ins]', host).forEach(b => b.addEventListener('click', () => { closeOffcanvas(); const ta = termEd.el; ta.setRangeText(b.dataset.ins, ta.selectionStart, ta.selectionEnd, 'end'); termEd.set(ta.value); termEd.focus(); }));
    });
  }
  function closeOffcanvas() { $$('.offcanvas.show').forEach(o => bootstrap.Offcanvas.getInstance(o)?.hide()); }
  function renderStats() {
    const t = engine.tables(); const rows = t.reduce((s, x) => s + (x.type === 'table' ? x.count : 0), 0);
    $('#statRow').innerHTML = `<span class="stat">tabelas <b>${t.filter(x => x.type === 'table').length}</b></span><span class="stat">linhas <b>${rows}</b></span><span class="stat">procedures <b>${engine.procs().length}</b></span><span class="stat">comandos nesta sessão <b>${state.executed}</b></span>`;
  }

  /* ============================= Biblioteca ============================ */
  function renderSnippets() {
    $('#snippetList').innerHTML = `<p class="small text-muted-2">Clique para colocar o comando no editor. Revise e execute com F5.</p>` + LAB.SNIPPETS.map((g, gi) => `<div class="snip-group"><h3>${esc(g.group)}</h3>${g.items.map((s, si) => `<button type="button" class="snip" data-g="${gi}" data-s="${si}">${esc(s.t)}</button>`).join('')}</div>`).join('');
    $$('#snippetList .snip').forEach(b => b.addEventListener('click', () => { const s = LAB.SNIPPETS[b.dataset.g].items[b.dataset.s]; closeOffcanvas(); termEd.set(s.sql); termEd.focus(); }));
  }

  /* ============================== Missões ============================== */
  const AULAS = { 1: 'Aula 1 · DDL e DML', 2: 'Aula 2 · Filtros, conjuntos e agregação', 3: 'Aula 3 · JOINs, subconsultas e procedures', 4: 'Aula 4 · Transações e governança' };
  function renderMissionList() {
    const done = LAB.MISSIONS.filter(m => state.progress[m.id]).length, total = LAB.MISSIONS.length;
    $('#mProgTxt').textContent = `${done}/${total}`; $('#mProgBar').style.width = (100 * done / total) + '%'; $('#navMissions').textContent = `${done}/${total}`;
    let h = ''; let cur = 0;
    LAB.MISSIONS.forEach(m => {
      if (m.aula !== cur) { cur = m.aula; h += `<div class="aula">${AULAS[cur]}</div>`; }
      h += `<button type="button" class="m-item ${state.progress[m.id] ? 'done' : ''} ${state.mission === m.id ? 'on' : ''}" data-id="${m.id}"><span class="m-check">${state.progress[m.id] ? '✓' : ''}</span><span>${esc(m.title)}<br><span class="lvl lvl-${m.level}">${m.level}</span></span></button>`;
    });
    $('#missionList').innerHTML = h;
    $$('#missionList .m-item').forEach(b => b.addEventListener('click', () => { openMission(b.dataset.id); if (window.innerWidth < 992) $('#missionDetail').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  }
  function openMission(id) {
    const m = LAB.MISSIONS.find(x => x.id === id) || LAB.MISSIONS[0]; state.mission = m.id;
    const host = $('#missionDetail');
    host.innerHTML = `<div class="d-flex gap-2 align-items-center flex-wrap mb-1"><span class="eyebrow">${esc(AULAS[m.aula])}</span><span class="lvl lvl-${m.level}">${m.level}</span>${state.progress[m.id] ? '<span class="lvl" style="color:var(--ok);border-color:var(--ok)">concluída</span>' : ''}</div>
      <h2 class="h3 fw-bold mb-2">${esc(m.title)}</h2>
      <p class="statement">${m.text}</p>
      <div id="mEditor"></div>
      <div class="d-flex flex-wrap gap-2 mt-2">
        <button class="btn-lab" type="button" id="mCheck">Verificar resposta <kbd style="background:transparent;border:0;color:inherit">F5</kbd></button>
        <button class="btn-ghost" type="button" id="mHint">Dica</button>
        <button class="btn-ghost" type="button" id="mSol">Ver solução</button>
        <button class="btn-ghost" type="button" id="mTerm">Abrir no terminal</button>
      </div>
      <div id="mHintBox" class="mt-3" hidden><div class="exam"><div class="eyebrow">Dica</div>${esc(m.hint)}</div></div>
      <div id="mSolBox" class="mt-3" hidden><div class="eyebrow mb-1">Solução comentada</div><pre class="code good">${highlight(m.solution)}</pre></div>
      <div class="mission-result" id="mResult"></div>`;
    missionEd = makeEditor($('#mEditor'), { boxed: true, id: 'missionSql', placeholder: '-- escreva seu SQL aqui e clique em Verificar', onRun: checkMission });
    const draft = store.get('sqllab2.draft.' + m.id, ''); if (draft) missionEd.set(draft);
    missionEd.el.addEventListener('input', () => store.set('sqllab2.draft.' + m.id, missionEd.get()));
    $('#mCheck').addEventListener('click', checkMission);
    $('#mHint').addEventListener('click', () => { $('#mHintBox').hidden = !$('#mHintBox').hidden; });
    $('#mSol').addEventListener('click', () => { $('#mSolBox').hidden = !$('#mSolBox').hidden; });
    $('#mTerm').addEventListener('click', () => sendToTerminal(missionEd.get() || m.solution, false));
    renderMissionList();
  }
  function lastResult(entries) { const f = flatten(entries).filter(e => e.kind === 'result'); return f.length ? f[f.length - 1] : null; }
  function normRows(rows) { return rows.map(r => r.map(v => v === null ? 'NULL' : typeof v === 'number' ? (Math.round(v * 100) / 100).toFixed(2) : String(v).trim()).join('␟')); }
  function checkMission() {
    const m = LAB.MISSIONS.find(x => x.id === state.mission); const sql = missionEd.get().trim(); const res = $('#mResult');
    if (!sql) { res.innerHTML = `<div class="alert-lab al-atencao"><b>Editor vazio.</b><span>Escreva o comando antes de verificar.</span></div>`; return; }
    const user = engine.clone(); let verdict = { ok: false, msg: '', extra: '' };
    try {
      if (m.kind === 'query') {
        const ue = user.run(sql); const err = flatten(ue).find(e => e.kind === 'error');
        if (err) verdict.msg = `Seu comando gerou erro: ${err.err.title}` + (err.err.fix ? ` → ${err.err.fix}` : '');
        else {
          const ur = lastResult(ue); const sr = lastResult(engine.clone().run(m.solution));
          if (!ur) verdict.msg = 'Seu comando não retornou um resultado (era esperado um SELECT).';
          else {
            const ordered = /\bORDER\s+BY\b/i.test(SQLEngine.mask(m.solution).s);
            let a = normRows(ur.rows), b = normRows(sr.rows); if (!ordered) { a = [...a].sort(); b = [...b].sort(); }
            if (ur.cols.length !== sr.cols.length) verdict.msg = `O resultado tem ${ur.cols.length} coluna(s); o esperado são ${sr.cols.length}: ${sr.cols.join(', ')}.`;
            else if (a.length !== b.length) verdict.msg = `Seu resultado tem ${a.length} linha(s); o esperado são ${b.length}. Revise o filtro ou o tipo de JOIN.`;
            else if (a.join('\n') !== b.join('\n')) verdict.msg = ordered && [...a].sort().join() === [...b].sort().join() ? 'As linhas estão certas, mas a ordem não. Confira o ORDER BY.' : 'A quantidade de linhas bate, mas os valores não. Confira as colunas e os cálculos.';
            else verdict.ok = true;
            if (!verdict.ok) verdict.extra = `<div class="cmp"><div><div class="lbl">seu resultado</div><div class="term" style="padding:.4rem">${tableHTML(ur.cols, ur.rows, { maxRows: 12 })}</div></div><div><div class="lbl">resultado esperado</div><div class="term" style="padding:.4rem">${tableHTML(sr.cols, sr.rows, { maxRows: 12 })}</div></div></div>`;
            else verdict.extra = `<div class="term mt-2" style="padding:.4rem">${tableHTML(ur.cols, ur.rows, { maxRows: 12 })}</div>`;
          }
        }
      } else if (m.kind === 'state') {
        if (m.requireText && !m.requireText.test(sql)) verdict.msg = 'A missão pede o uso explícito do comando indicado no enunciado.';
        else {
          const before = {}; (m.checks || []).forEach((c, k) => { if (c.delta || c.ratio) before[k] = user.scalar(SQLEngine.translate(c.delta || c.ratio, new Set())); });
          const ue = user.run(sql); const err = flatten(ue).find(e => e.kind === 'error');
          if (err) verdict.msg = `Seu comando gerou erro: ${err.err.title}` + (err.err.fix ? ` → ${err.err.fix}` : '');
          else {
            verdict.ok = true;
            for (const [k, c] of (m.checks || []).entries()) {
              let pass = true;
              if (c.q !== undefined) { let v; try { v = user.scalar(c.q); } catch (e) { v = null; } pass = Number(v) === c.expect; }
              else if (c.delta) { const v = user.scalar(SQLEngine.translate(c.delta, new Set())); pass = Math.abs((Number(v) || 0) - (Number(before[k]) || 0) - c.expect) < 0.01; }
              else if (c.ratio) { const v = user.scalar(SQLEngine.translate(c.ratio, new Set())); pass = before[k] ? Math.abs(v / before[k] - c.expect) < 0.001 : false; }
              else if (c.tryFail) { const r = user.run(c.tryFail); pass = flatten(r).some(e => e.kind === 'error'); }
              if (!pass) { verdict.ok = false; verdict.msg = c.msg; break; }
            }
          }
        }
      } else if (m.kind === 'proc') {
        const ue = user.run(sql); const err = flatten(ue).find(e => e.kind === 'error');
        if (err) verdict.msg = `Seu comando gerou erro: ${err.err.title}`;
        else if (!user.procs().some(p => p.name.toLowerCase() === m.proc.toLowerCase())) verdict.msg = `A procedure ${m.proc} não foi criada.`;
        else if (!/\bEXEC(UTE)?\s+/i.test(sql)) verdict.msg = 'Faltou executar a procedure com EXEC.';
        else {
          const r1 = lastResult(user.run(`EXEC ${m.proc} ${m.procArgs}`)); const r2 = lastResult(user.run(m.expectSql));
          if (r1 && r2 && normRows(r1.rows).sort().join() === normRows(r2.rows).sort().join() && r1.cols.length === r2.cols.length) verdict.ok = true;
          else verdict.msg = `Testei EXEC ${m.proc} ${m.procArgs} e o resultado não confere com o esperado (nome e cidade dos clientes daquela UF).`;
        }
      }
    } catch (e) { verdict.msg = 'Falha ao verificar: ' + e.message; }
    if (verdict.ok) { state.progress[m.id] = true; store.set(KEY.prog, state.progress); renderMissionList(); }
    const next = LAB.MISSIONS[LAB.MISSIONS.findIndex(x => x.id === m.id) + 1];
    res.innerHTML = verdict.ok
      ? `<div class="alert-lab al-ok"><b>Correto!</b><span>${esc(m.success || 'Resultado idêntico ao esperado.')}</span></div>${verdict.extra}${next ? `<button class="btn-ok btn mt-3" type="button" id="mNext">Próxima missão →</button>` : ''}`
      : `<div class="alert-lab al-erro"><b>Ainda não.</b><span>${esc(verdict.msg)}</span></div>${verdict.extra}`;
    const nb = $('#mNext'); if (nb) nb.addEventListener('click', () => openMission(next.id));
  }

  /* =============================== Bug Lab ============================= */
  function renderBugs() {
    $('#bugGrid').innerHTML = LAB.BUGS.map((b, i) => `<article class="panel bug">
      <div class="d-flex gap-2 align-items-center flex-wrap"><span class="sev sev-${esc(b.sev)}">${esc(b.sev)}</span><span class="cat cat-${esc(b.tag)}">${esc(b.tag)}</span></div>
      <h3>${esc(b.title)}</h3>
      <pre class="code bad">${highlight(b.bug)}</pre>
      <dl><dt>Sintoma</dt><dd>${esc(b.symptom)}</dd><dt>Por quê</dt><dd>${esc(b.why)}</dd></dl>
      <pre class="code good">${highlight(b.fix)}</pre>
      <div class="exam py-2"><div class="eyebrow">Boa prática</div>${esc(b.practice)}</div>
      <div class="actions"><button class="btn-ghost btn-sm-lab" type="button" data-bug="${i}">▶ Rodar o bug</button><button class="btn-lab btn-sm-lab" type="button" data-fix="${i}">▶ Rodar a correção</button></div>
    </article>`).join('');
    $$('[data-bug]').forEach(b => b.addEventListener('click', () => { const bug = LAB.BUGS[b.dataset.bug]; sendToTerminal(bug.bug); }));
    $$('[data-fix]').forEach(b => b.addEventListener('click', () => sendToTerminal(LAB.BUGS[b.dataset.fix].fix)));
  }

  /* ================================ Quiz =============================== */
  const quiz = { i: 0, score: 0, answered: false, order: [] };
  function startQuiz() { quiz.i = 0; quiz.score = 0; quiz.order = LAB.QUIZ.map((_, k) => k).sort(() => Math.random() - .5); renderQuiz(); }
  function renderQuiz() {
    const host = $('#quizBox'); const best = store.get(KEY.quiz, null);
    if (quiz.i >= quiz.order.length) {
      const pct = Math.round(100 * quiz.score / quiz.order.length);
      if (best === null || quiz.score > best) store.set(KEY.quiz, quiz.score);
      host.innerHTML = `<div class="text-center py-3"><div class="eyebrow mb-2">Resultado</div><div class="score">${quiz.score}/${quiz.order.length}</div><p class="mt-2 mb-1">${pct >= 80 ? 'Excelente. Você está pronto para a prova da Unidade II.' : pct >= 60 ? 'Bom resultado. Revise as justificativas das questões que errou.' : 'Vale revisar a aba Referência e refazer as missões.'}</p><p class="small text-muted-2">Melhor pontuação: ${Math.max(best ?? 0, quiz.score)}</p><button class="btn-lab mt-2" type="button" id="qAgain">Refazer quiz</button></div>`;
      $('#qAgain').addEventListener('click', startQuiz); return;
    }
    const q = LAB.QUIZ[quiz.order[quiz.i]]; quiz.answered = false;
    host.innerHTML = `<div class="d-flex justify-content-between align-items-center mb-2"><span class="eyebrow">Questão ${quiz.i + 1} de ${quiz.order.length} · ${esc(q.src)}</span><span class="small text-muted-2">acertos: <b>${quiz.score}</b></span></div>
      <div class="progress-lab mb-3"><div style="width:${100 * quiz.i / quiz.order.length}%;background:var(--accent)"></div></div>
      <p class="q">${esc(q.q)}</p>
      <div id="qOpts">${q.o.map((o, k) => `<button type="button" class="opt" data-k="${k}"><span class="ltr">${'ABCDE'[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      <div id="qFb" class="mt-3"></div>`;
    $$('#qOpts .opt').forEach(b => b.addEventListener('click', () => {
      if (quiz.answered) return; quiz.answered = true; const k = +b.dataset.k; const right = k === q.a; if (right) quiz.score++;
      $$('#qOpts .opt').forEach(x => { x.disabled = true; if (+x.dataset.k === q.a) x.classList.add('right'); });
      if (!right) b.classList.add('wrong');
      $('#qFb').innerHTML = `<div class="alert-lab ${right ? 'al-ok' : 'al-erro'}"><b>${right ? 'Correto.' : 'Resposta correta: ' + 'ABCDE'[q.a] + '.'}</b><span>${esc(q.e)}</span></div><button class="btn-lab mt-3" type="button" id="qNext">${quiz.i + 1 < quiz.order.length ? 'Próxima questão →' : 'Ver resultado'}</button>`;
      $('#qNext').addEventListener('click', () => { quiz.i++; renderQuiz(); }); $('#qNext').focus();
    }));
  }

  /* ================================ DER ================================ */
  const DER_POS = { Departamento: [30, 30], Funcionario: [360, 30], ClienteLegado: [1020, 30], Cliente: [30, 330], Pedido: [360, 330], ItemPedido: [690, 330], Produto: [1020, 330] };
  function renderDER() {
    const ts = engine.tables().filter(t => t.type === 'table');
    const W = 250, HH = 28, RH = 19; const pos = {}; let extra = 0;
    ts.forEach(t => { if (DER_POS[t.name]) pos[t.name] = DER_POS[t.name]; });
    const usedMaxY = Math.max(0, ...ts.filter(t => pos[t.name]).map(t => pos[t.name][1] + HH + t.cols.length * RH));
    ts.forEach(t => { if (!pos[t.name]) { pos[t.name] = [30 + (extra % 4) * 300, usedMaxY + 60 + Math.floor(extra / 4) * 260]; extra++; } });
    const box = (t) => { const [x, y] = pos[t.name]; return { x, y, w: W, h: HH + t.cols.length * RH + 8 }; };
    let maxX = 0, maxY = 0; ts.forEach(t => { const b = box(t); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); });
    let links = '', boxes = '';
    ts.forEach(t => {
      t.fks.forEach(f => {
        const p = ts.find(x => x.name.toLowerCase() === f.table.toLowerCase()); if (!p) return;
        const cb = box(t), pb = box(p);
        const cy = cb.y + HH + t.cols.findIndex(c => c.name === f.from) * RH + RH / 2 + 2;
        const pIdx = Math.max(0, p.cols.findIndex(c => c.name === f.to));
        const py = pb.y + HH + pIdx * RH + RH / 2 + 2;
        let d, lx, ly, cx1, px1, cdir;
        if (p === t) { cx1 = cb.x + cb.w; px1 = cb.x + cb.w; d = `M${cx1},${cy} C${cx1 + 60},${cy} ${px1 + 60},${py} ${px1},${py}`; lx = cx1 + 34; ly = (cy + py) / 2; cdir = 1; }
        else if (Math.abs(cb.x - pb.x) < 40) { cx1 = cb.x; px1 = pb.x; d = `M${cx1},${cy} C${cx1 - 70},${cy} ${px1 - 70},${py} ${px1},${py}`; lx = cx1 - 60; ly = (cy + py) / 2; cdir = -1; }
        else if (cb.x > pb.x) { cx1 = cb.x; px1 = pb.x + pb.w; const mx = (cx1 + px1) / 2; d = `M${cx1},${cy} C${mx},${cy} ${mx},${py} ${px1},${py}`; lx = mx; ly = (cy + py) / 2 - 6; cdir = -1; }
        else { cx1 = cb.x + cb.w; px1 = pb.x; const mx = (cx1 + px1) / 2; d = `M${cx1},${cy} C${mx},${cy} ${mx},${py} ${px1},${py}`; lx = mx; ly = (cy + py) / 2 - 6; cdir = 1; }
        const crow = `M${cx1 + cdir * 10},${cy} L${cx1},${cy - 6} M${cx1 + cdir * 10},${cy} L${cx1},${cy + 6} M${cx1 + cdir * 10},${cy} L${cx1},${cy}`;
        const pdir = (p === t || px1 === pb.x + pb.w) ? 1 : -1;
        const bar = `M${px1 + pdir * 7},${py - 6} L${px1 + pdir * 7},${py + 6}`;
        links += `<path class="der-link" d="${d}"/><path class="der-link" d="${crow}"/><path class="der-link" d="${bar}"/><text class="der-label" x="${lx}" y="${ly}" text-anchor="middle">${esc(f.onDelete)}</text>`;
      });
      const b = box(t);
      boxes += `<g class="der-box"><rect class="body" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="7"/><rect class="head" x="${b.x}" y="${b.y}" width="${b.w}" height="${HH}" rx="7"/><rect class="head" x="${b.x}" y="${b.y + HH - 8}" width="${b.w}" height="8"/><text class="title" x="${b.x + 10}" y="${b.y + 19}">${esc(t.name)}</text><text class="title" x="${b.x + b.w - 10}" y="${b.y + 19}" text-anchor="end" style="font-weight:400;opacity:.8">${t.count}</text>
        ${t.cols.map((c, k) => { const fk = t.fks.some(f => f.from === c.name); const yy = b.y + HH + 16 + k * RH; return `<text x="${b.x + 10}" y="${yy}" class="${c.pk ? 'pk' : fk ? 'fk' : ''}">${c.pk ? 'PK' : fk ? 'FK' : '  '}</text><text x="${b.x + 36}" y="${yy}">${esc(c.name)}</text><text class="ty" x="${b.x + b.w - 10}" y="${yy}" text-anchor="end">${esc(c.type.replace(' IDENTITY(1,1)', ' ID').slice(0, 15))}</text>`; }).join('')}</g>`;
    });
    $('#derWrap').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX + 90}" height="${maxY + 40}" viewBox="0 0 ${maxX + 90} ${maxY + 40}" role="img" aria-label="Diagrama entidade-relacionamento do banco">${links}${boxes}</svg>`;
  }

  /* ============================= Referência ============================ */
  function venn(type, id) {
    const A = '<circle cx="52" cy="43" r="32"/>', B = '<circle cx="88" cy="43" r="32"/>';
    let fill = '';
    if (type === 'INNER') fill = `<clipPath id="c${id}"><circle cx="88" cy="43" r="32"/></clipPath><circle class="venn-fill" cx="52" cy="43" r="32" clip-path="url(#c${id})"/>`;
    if (type === 'LEFT') fill = `<circle class="venn-fill" cx="52" cy="43" r="32"/>`;
    if (type === 'RIGHT') fill = `<circle class="venn-fill" cx="88" cy="43" r="32"/>`;
    if (type === 'FULL') fill = `<circle class="venn-fill" cx="52" cy="43" r="32"/><circle class="venn-fill" cx="88" cy="43" r="32"/>`;
    if (type === 'ANTI') fill = `<mask id="m${id}"><rect width="140" height="86" fill="#fff"/><circle cx="88" cy="43" r="32" fill="#000"/></mask><circle class="venn-fill" cx="52" cy="43" r="32" mask="url(#m${id})"/>`;
    if (type === 'CROSS') { let g = ''; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g += `<circle class="venn-fill" cx="${40 + i * 20}" cy="${23 + j * 20}" r="5"/>`; return `<svg viewBox="0 0 140 86" aria-hidden="true">${g}<text class="venn-txt" x="70" y="84" text-anchor="middle">A × B</text></svg>`; }
    return `<svg viewBox="0 0 140 86" aria-hidden="true">${fill}<g class="venn-line">${A}${B}</g><text class="venn-txt" x="36" y="47">A</text><text class="venn-txt" x="96" y="47">B</text></svg>`;
  }
  function renderRef() {
    const J = [
      ['INNER', 'INNER JOIN', 'Só os pares que combinam (A ∩ B).', 'SELECT D.nome AS departamento, F.nome AS funcionario\nFROM Departamento D\nINNER JOIN Funcionario F ON F.id_departamento = D.id_departamento;'],
      ['LEFT', 'LEFT JOIN', 'Todo A; sem par, B vem NULL.', 'SELECT D.nome AS departamento, F.nome AS funcionario\nFROM Departamento D\nLEFT JOIN Funcionario F ON F.id_departamento = D.id_departamento;'],
      ['RIGHT', 'RIGHT JOIN', 'Todo B; sem par, A vem NULL.', 'SELECT D.nome AS departamento, F.nome AS funcionario\nFROM Departamento D\nRIGHT JOIN Funcionario F ON F.id_departamento = D.id_departamento;'],
      ['FULL', 'FULL JOIN', 'Tudo dos dois lados (A ∪ B).', 'SELECT D.nome AS departamento, F.nome AS funcionario\nFROM Departamento D\nFULL JOIN Funcionario F ON F.id_departamento = D.id_departamento;'],
      ['ANTI', 'LEFT JOIN + IS NULL', 'A sem correspondência em B.', 'SELECT D.nome AS departamento_vazio\nFROM Departamento D\nLEFT JOIN Funcionario F ON F.id_departamento = D.id_departamento\nWHERE F.id_funcionario IS NULL;'],
      ['CROSS', 'CROSS JOIN', 'Produto cartesiano: N × M linhas.', 'SELECT COUNT(*) AS linhas  -- 6 x 16\nFROM Departamento D\nCROSS JOIN Funcionario F;']
    ];
    $('#joinCards').innerHTML = J.map(([t, n, d, q], k) => `<div class="join-card">${venn(t, k)}<h3>${n}</h3><p>${d}</p><button class="btn-ghost btn-sm-lab" type="button" data-run="${esc(q)}">▶ executar</button></div>`).join('');
    const CK = [
      ['Qual a diferença entre DDL e DML?', 'DDL cria e altera a estrutura dos objetos (CREATE, ALTER, DROP). DML manipula os dados das tabelas (INSERT, UPDATE, DELETE).'],
      ['Por que DECIMAL(10,2) em vez de FLOAT para dinheiro?', 'DECIMAL tem precisão exata. FLOAT é aproximado e acumula erros de arredondamento em somatórios.'],
      ['Quando usar HAVING em vez de WHERE?', 'Quando o filtro envolve função de agregação, como AVG(salario) > 3000. O WHERE filtra linhas antes do GROUP BY.'],
      ['UNION × UNION ALL?', 'UNION remove duplicatas (etapa extra de ordenação). UNION ALL mantém tudo e é mais rápido.'],
      ['O que retorna Cliente LEFT JOIN Pedido?', 'Todos os clientes. Os que não têm pedido aparecem com as colunas de Pedido em NULL.'],
      ['Vantagens de uma Stored Procedure?', 'Reuso do plano de execução, encapsulamento da regra de negócio e segurança granular (GRANT EXECUTE sem acesso às tabelas).'],
      ['Por que o DER do SSMS é "documentação viva"?', 'Porque é gerado do esquema físico e acompanha as mudanças da estrutura do banco.']
    ];
    $('#checklist').innerHTML = CK.map(([q, a]) => `<details class="panel"><summary class="panel-body py-2" style="cursor:pointer;font-weight:600">${esc(q)}</summary><div class="panel-body pt-0">${esc(a)}</div></details>`).join('');
  }

  /* ======================= Exportar / importar ======================= */
  let modalExport, modalReset;
  function openExport() { fillExport(); modalExport.show(); }
  function fillExport() { $('#exportCode').innerHTML = highlight(engine.script({ data: $('#expAll').checked })); }
  function openReset() { modalReset.show(); }
  function resetDb() {
    store.del(KEY.db); engine = buildFresh(); renderExplorer(); renderStats(); renderDER(); modalReset.hide();
    $('#txPill').hidden = true; $('#promptTx').textContent = '';
    tprint('<span class="t-ok">✔ Banco restaurado ao estado original.</span>', 't-block'); scrollEnd(); toast('Banco restaurado');
  }
  function buildFresh() { const e = new SQLEngine.Engine(SQL); e.run(LAB.SEED_SQL + LAB.SEED_PROCS); e.safeMode = $('#safeMode').checked; return e; }

  /* ============================== Roteador ============================= */
  const VIEWS = ['home', 'tutorial', 'terminal', 'api', 'missoes', 'bugs', 'quiz', 'der', 'referencia'];
  function go(v) {
    if (!VIEWS.includes(v)) v = 'terminal';
    VIEWS.forEach(x => { $('#view-' + x).hidden = x !== v; });
    $$('.lab-tabs .nav-link').forEach(a => a.classList.toggle('active', a.dataset.view === v));
    if (v === 'der') renderDER();
    if (v === 'missoes' && !state.mission) openMission(LAB.MISSIONS[0].id);
    const nav = $('#navMain'); if (nav.classList.contains('show')) bootstrap.Collapse.getOrCreateInstance(nav).hide();
    if (location.hash.slice(1) !== v) { try { history.replaceState(null, '', '#' + v); } catch (e) { } }
    window.scrollTo({ top: 0 });
    if (v === 'home' && window.LabHome) window.LabHome.onShow();
    if (v === 'tutorial' && window.LabTutorial) window.LabTutorial.onShow();
    if (window.LabApi) { if (v === 'api') window.LabApi.onShow(); else window.LabApi.onHide(); }
    if (window.ScrollTrigger) requestAnimationFrame(() => ScrollTrigger.refresh());
  }

  /* =============================== Boot =============================== */
  async function boot() {
    initTheme();
    SQL = await initSqlJs(window.SQL_WASM_B64 ? { wasmBinary: unb64(window.SQL_WASM_B64) } : { locateFile: f => 'vendor/' + f });
    const saved = (() => { try { return localStorage.getItem(KEY.db); } catch (e) { return null; } })();
    if (saved) { try { engine = new SQLEngine.Engine(SQL, unb64(saved)); if (!engine.tables().length) throw 0; } catch (e) { engine = null; } }
    if (!engine) engine = buildFresh();
    const safe = store.get(KEY.safe, true); $('#safeMode').checked = safe; engine.safeMode = safe;

    termEd = makeEditor($('#termEditor'), { id: 'termSql', placeholder: 'SELECT nome, salario FROM Funcionario WHERE salario > 5000;', onRun: () => runFromEditor(false), onHistory: histNav });
    $('#btnRun').addEventListener('click', () => runFromEditor(false));
    $('#btnRunSel').addEventListener('click', () => runFromEditor(true));
    $('#btnClear').addEventListener('click', () => { out().innerHTML = ''; });
    $('#safeMode').addEventListener('change', (e) => { engine.safeMode = e.target.checked; store.set(KEY.safe, e.target.checked); toast(e.target.checked ? 'Modo seguro ligado' : 'Modo seguro desligado: UPDATE/DELETE sem WHERE vão rodar'); });

    modalExport = new bootstrap.Modal('#modalExport'); modalReset = new bootstrap.Modal('#modalReset');
    $('#mExport').addEventListener('click', openExport);
    $$('input[name=expMode]').forEach(r => r.addEventListener('change', fillExport));
    $('#btnExpCopy').addEventListener('click', () => copyText(engine.script({ data: $('#expAll').checked }), 'Script copiado'));
    $('#btnExpTerm').addEventListener('click', () => { modalExport.hide(); sendToTerminal(engine.script({ data: $('#expAll').checked }), false); });
    $('#mReset').addEventListener('click', openReset);
    $('#btnResetOk').addEventListener('click', resetDb);
    $('#mImport').addEventListener('click', () => $('#fileSql').click());
    $('#fileSql').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { sendToTerminal(String(r.result), false); toast(`${f.name} carregado no editor. Revise e pressione F5.`); }; r.readAsText(f); e.target.value = ''; });
    $('#btnDerRefresh').addEventListener('click', renderDER);

    document.addEventListener('click', (e) => {
      const r = e.target.closest('[data-run]'); if (r) { e.preventDefault(); sendToTerminal(r.dataset.run); return; }
      const ex = e.target.closest('[data-action="export"]'); if (ex) { openExport(); return; }
      const v = e.target.closest('[data-view]'); if (v) { e.preventDefault(); go(v.dataset.view); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'F5') return;
      if (!$('#view-missoes').hidden && missionEd) { e.preventDefault(); checkMission(); }
      else if (!$('#view-terminal').hidden) { e.preventDefault(); runFromEditor(false); }
      else if (!$('#view-tutorial').hidden && window.LabTutorial) { e.preventDefault(); window.LabTutorial.run(); }
    });
    window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (VIEWS.includes(h)) go(h); });

    renderExplorer(); renderSnippets(); renderMissionList(); renderBugs(); startQuiz(); renderRef(); renderStats();
    // API usada pelas páginas Início (home.js) e Tutorial (tutorial.js)
    window.LabApp = { get engine() { return engine; }, go, sendToTerminal, tableHTML, highlight, makeEditor, toast, esc, flatten, missionsDone: () => LAB.MISSIONS.filter(m => state.progress[m.id]).length };
    document.dispatchEvent(new CustomEvent('lab:ready'));
    welcome();
    $('#loading').hidden = true;
    const h = location.hash.slice(1); go(VIEWS.includes(h) ? h : 'home');
    termEd.set('SELECT D.nome AS departamento,\n       COUNT(F.id_funcionario) AS funcionarios,\n       AVG(F.salario) AS media_salarial\nFROM Departamento D\nLEFT JOIN Funcionario F ON F.id_departamento = D.id_departamento\nGROUP BY D.nome\nORDER BY funcionarios DESC;');
  }
  boot().catch(err => { $('#loading').innerHTML = `<div class="alert-lab al-erro" style="max-width:520px"><b>Não foi possível iniciar o motor SQL.</b><span>${esc(err && err.message || err)}</span><span class="fx">Se você abriu o arquivo direto do disco (file://), rode um servidor local, por exemplo: <code>python -m http.server</code> na pasta do projeto.</span></div>`; });
})();

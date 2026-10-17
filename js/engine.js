/* =====================================================================
   SQL Lab · Motor de execução
   SQLite (WebAssembly, via sql.js) + camada de compatibilidade T-SQL,
   analisador didático (Raio-X), linter de boas práticas e tradutor de
   erros no estilo das mensagens do SQL Server.
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Léxico: mascara strings e comentários para que as regras de
     tradução nunca alterem texto literal.
     ------------------------------------------------------------------ */
  const LEX = /(--[^\n]*)|(\/\*[\s\S]*?(?:\*\/|$))|(N?'(?:[^']|'')*'?)|("(?:[^"]|"")*"?)|(\[[^\]\n]*\]?)|([A-Za-z_@#][\w@#$]*)|(;)|(\s+)|(.)/g;

  function lex(text) {
    const out = []; let m; LEX.lastIndex = 0;
    while ((m = LEX.exec(text))) {
      let type = 'other';
      if (m[1] || m[2]) type = 'comment';
      else if (m[3]) type = 'string';
      else if (m[4] || m[5]) type = 'ident';
      else if (m[6]) type = 'word';
      else if (m[7]) type = 'semi';
      else if (m[8]) type = 'ws';
      out.push({ type, v: m[0], i: m.index });
    }
    return out;
  }

  /** Substitui strings por marcadores e remove comentários. */
  function mask(text) {
    const strings = [];
    const toks = lex(text);
    let s = '';
    for (const t of toks) {
      if (t.type === 'string') {
        let v = t.v; if (/^N'/i.test(v)) v = v.slice(1);
        strings.push(v); s += '\u0001' + (strings.length - 1) + '\u0002';
      } else if (t.type === 'comment') { s += ' '; }
      else s += t.v;
    }
    return { s, strings };
  }
  function unmask(s, strings) { return s.replace(/\u0001(\d+)\u0002/g, (_, n) => strings[+n]); }

  /* ------------------------------------------------------------------
     Divisão do script em comandos. Respeita ';', a palavra GO e blocos
     BEGIN...END / CASE...END (procedures).
     ------------------------------------------------------------------ */
  function split(text) {
    text = text.replace(/^[ \t]*GO[ \t]*(?:\d+)?[ \t]*$/gim, ';');
    const toks = lex(text);
    const stmts = []; let buf = ''; let depth = 0; let startIdx = 0;
    const nextWord = (k) => { for (let j = k + 1; j < toks.length; j++) { if (toks[j].type === 'ws' || toks[j].type === 'comment') continue; return toks[j]; } return null; };
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      if (!buf.trim() && t.type !== 'ws') startIdx = t.i;
      if (t.type === 'word') {
        const u = t.v.toUpperCase();
        if (u === 'BEGIN') {
          const n = nextWord(k);
          const isTx = !n || n.type === 'semi' || (n.type === 'word' && /^(TRAN|TRANSACTION|WORK|DEFERRED|IMMEDIATE|EXCLUSIVE)$/i.test(n.v));
          if (!isTx) depth++;
        } else if (u === 'CASE') depth++;
        else if (u === 'END' && depth > 0) depth--;
      }
      if (t.type === 'semi' && depth === 0) {
        if (buf.trim()) stmts.push({ text: buf.trim(), start: startIdx });
        buf = ''; continue;
      }
      buf += t.v;
    }
    if (buf.trim()) stmts.push({ text: buf.trim(), start: startIdx });
    // descarta "comandos" que são só comentários
    return stmts.filter(s => mask(s.text).s.trim().length);
  }

  /* ------------------------------------------------------------------
     Utilidades de parsing (sobre texto mascarado)
     ------------------------------------------------------------------ */
  function matchParen(s, open) { let d = 0; for (let i = open; i < s.length; i++) { if (s[i] === '(') d++; else if (s[i] === ')') { d--; if (d === 0) return i; } } return -1; }
  function splitTop(s, sep = ',') { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === sep && d === 0) { out.push(cur); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur); return out.map(x => x.trim()); }
  function rewriteCall(s, name, fn) {
    const re = new RegExp('\\b' + name + '\\s*\\(', 'i');
    let guard = 0, m;
    while ((m = re.exec(s)) && guard++ < 200) {
      const open = m.index + m[0].length - 1; const close = matchParen(s, open);
      if (close < 0) break;
      const args = splitTop(s.slice(open + 1, close));
      s = s.slice(0, m.index) + fn(args) + s.slice(close + 1);
    }
    return s;
  }
  /** Palavras no nível 0 de parênteses → [{w, i}] */
  function topWords(s) {
    const out = []; let d = 0; const re = /\(|\)|[A-Za-z_][\w]*/g; let m;
    while ((m = re.exec(s))) { if (m[0] === '(') d++; else if (m[0] === ')') d--; else if (d === 0) out.push({ w: m[0].toUpperCase(), i: m.index }); }
    return out;
  }
  function hasTop(s, phrase) {
    const words = topWords(s).map(x => x.w); const p = phrase.split(' ');
    for (let i = 0; i <= words.length - p.length; i++) if (p.every((w, j) => words[i + j] === w)) return true;
    return false;
  }
  function clauseText(s, startKw, enders) {
    const tw = topWords(s); let st = -1, stLen = 0;
    const kw = startKw.split(' ');
    for (let i = 0; i < tw.length; i++) { if (kw.every((w, j) => tw[i + j] && tw[i + j].w === w)) { st = tw[i + kw.length - 1].i + kw[kw.length - 1].length; stLen = i + kw.length; break; } }
    if (st < 0) return null;
    let end = s.length;
    for (let i = stLen; i < tw.length; i++) if (enders.includes(tw[i].w)) { end = tw[i].i; break; }
    return s.slice(st, end).trim();
  }
  const norm = (x) => x.toLowerCase().replace(/[\s\[\]"]/g, '');
  const AGG = /\b(COUNT|SUM|AVG|MIN|MAX|GROUP_CONCAT|STRING_AGG|TOTAL|STDEV|VAR)\s*\(/i;

  /* ------------------------------------------------------------------
     Tradução T-SQL → SQLite
     ------------------------------------------------------------------ */
  function translate(stmt, notes) {
    const { s: m0, strings } = mask(stmt);
    let s = m0.trim();

    // IDENTITY
    s = s.replace(/\b(?:INT|INTEGER|BIGINT|SMALLINT)\s+((?:NOT\s+NULL\s+)?)(PRIMARY\s+KEY\s+)?IDENTITY\s*(?:\(\s*\d+\s*,\s*\d+\s*\))?(\s+(?:NOT\s+NULL\s+)?PRIMARY\s+KEY)?/gi,
      (all, nn, pk1, pk2) => { notes.add('IDENTITY → AUTOINCREMENT'); return (pk1 || pk2) ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INTEGER'; });
    s = s.replace(/\bIDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, '');
    // (MAX)
    s = s.replace(/\(\s*MAX\s*\)/gi, '(8000)');
    // Funções de data/hora
    s = s.replace(/\b(?:GETDATE|SYSDATETIME|GETUTCDATE)\s*\(\s*\)/gi, () => { notes.add('GETDATE()'); return "(datetime('now','localtime'))"; });
    s = rewriteCall(s, 'YEAR', a => `CAST(strftime('%Y', ${a[0]}) AS INTEGER)`);
    s = rewriteCall(s, 'MONTH', a => `CAST(strftime('%m', ${a[0]}) AS INTEGER)`);
    s = rewriteCall(s, 'DAY', a => `CAST(strftime('%d', ${a[0]}) AS INTEGER)`);
    s = rewriteCall(s, 'DATEDIFF', a => {
      const part = (a[0] || '').toLowerCase();
      if (/^(year|yy|yyyy)$/.test(part)) return `(CAST(strftime('%Y', ${a[2]}) AS INTEGER) - CAST(strftime('%Y', ${a[1]}) AS INTEGER))`;
      if (/^(month|mm|m)$/.test(part)) return `((CAST(strftime('%Y', ${a[2]}) AS INTEGER) - CAST(strftime('%Y', ${a[1]}) AS INTEGER)) * 12 + CAST(strftime('%m', ${a[2]}) AS INTEGER) - CAST(strftime('%m', ${a[1]}) AS INTEGER))`;
      return `CAST(julianday(${a[2]}) - julianday(${a[1]}) AS INTEGER)`;
    });
    s = rewriteCall(s, 'DATEADD', a => {
      const part = (a[0] || '').toLowerCase(); const u = /^(year|yy|yyyy)$/.test(part) ? 'years' : /^(month|mm|m)$/.test(part) ? 'months' : 'days';
      return `date(${a[2]}, (${a[1]}) || ' ${u}')`;
    });
    // Funções de texto / nulos
    s = s.replace(/\bLEN\s*\(/gi, 'LENGTH(').replace(/\bISNULL\s*\(/gi, 'IFNULL(').replace(/\bCHARINDEX\s*\(/gi, '__CHARINDEX(');
    s = rewriteCall(s, '__CHARINDEX', a => `INSTR(${a[1]}, ${a[0]})`);
    s = rewriteCall(s, 'LEFT', a => a.length === 2 ? `SUBSTR(${a[0]}, 1, ${a[1]})` : `LEFT(${a.join(',')})`);
    s = rewriteCall(s, 'RIGHT', a => a.length === 2 ? `SUBSTR(${a[0]}, -(${a[1]}))` : `RIGHT(${a.join(',')})`);
    s = rewriteCall(s, 'CONVERT', a => `CAST(${a[1]} AS ${a[0]})`);
    s = s.replace(/\bSUBSTRING\s*\(/gi, 'SUBSTR(').replace(/\bNEWID\s*\(\s*\)/gi, "lower(hex(randomblob(16)))");
    // TOP n → LIMIT n
    const top = s.match(/^(\s*SELECT\s+(?:DISTINCT\s+)?)TOP\s*\(?\s*(\d+)\s*\)?\s*(PERCENT\s+)?/i);
    if (top) { s = top[1] + s.slice(top[0].length) + ' LIMIT ' + top[2]; notes.add('TOP → LIMIT'); }
    // Transações
    s = s.replace(/^BEGIN\s+TRAN(?:SACTION)?(?:\s+\w+)?\s*$/i, 'BEGIN TRANSACTION')
         .replace(/^COMMIT(?:\s+TRAN(?:SACTION)?)?(?:\s+\w+)?\s*$/i, 'COMMIT')
         .replace(/^ROLLBACK(?:\s+TRAN(?:SACTION)?)?(?:\s+\w+)?\s*$/i, 'ROLLBACK')
         .replace(/^SAVE\s+TRAN(?:SACTION)?\s+(\w+)$/i, 'SAVEPOINT $1');
    // TRUNCATE
    if (/^TRUNCATE\s+TABLE\s+/i.test(s)) { s = s.replace(/^TRUNCATE\s+TABLE\s+/i, 'DELETE FROM '); notes.add('TRUNCATE → DELETE'); }
    // CREATE OR ALTER VIEW
    s = s.replace(/^CREATE\s+OR\s+ALTER\s+VIEW/i, 'CREATE VIEW');
    // dbo.
    s = s.replace(/\b(?:\[dbo\]|dbo)\.(?=[\w\[])/gi, '');
    // FULL OUTER / LEFT OUTER são aceitos; FULL JOIN também.
    return unmask(s, strings);
  }

  /* ------------------------------------------------------------------
     Classificação e Raio-X didático
     ------------------------------------------------------------------ */
  function classify(masked) {
    const u = masked.trim().toUpperCase().replace(/\s+/g, ' ');
    const first = u.split(' ')[0];
    const two = u.split(' ').slice(0, 2).join(' ');
    if (/^CREATE (OR ALTER )?PROC/.test(u)) return { key: 'CREATE PROCEDURE', cat: 'DDL' };
    if (/^ALTER PROC/.test(u)) return { key: 'CREATE PROCEDURE', cat: 'DDL' };
    if (/^CREATE (UNIQUE |CLUSTERED |NONCLUSTERED )*INDEX/.test(u)) return { key: 'CREATE INDEX', cat: 'DDL' };
    if (/^CREATE (OR ALTER )?VIEW/.test(u)) return { key: 'CREATE VIEW', cat: 'DDL' };
    if (two === 'CREATE TABLE') return { key: 'CREATE TABLE', cat: 'DDL' };
    if (first === 'CREATE') return { key: 'CREATE TABLE', cat: 'DDL' };
    if (two === 'ALTER TABLE') return { key: 'ALTER TABLE', cat: 'DDL' };
    if (first === 'DROP') return { key: 'DROP', cat: 'DDL' };
    if (first === 'TRUNCATE') return { key: 'TRUNCATE', cat: 'DDL' };
    if (first === 'INSERT') return { key: 'INSERT', cat: 'DML' };
    if (first === 'UPDATE') return { key: 'UPDATE', cat: 'DML' };
    if (first === 'DELETE') return { key: 'DELETE', cat: 'DML' };
    if (first === 'SELECT' || first === 'WITH' || first === '(') return { key: 'SELECT', cat: 'DQL' };
    if (['GRANT', 'REVOKE', 'DENY'].includes(first)) return { key: first, cat: 'DCL' };
    if (/^BEGIN( TRAN| TRANSACTION|$)/.test(u)) return { key: 'BEGIN TRANSACTION', cat: 'TCL' };
    if (first === 'COMMIT') return { key: 'COMMIT', cat: 'TCL' };
    if (first === 'ROLLBACK') return { key: 'ROLLBACK', cat: 'TCL' };
    if (first === 'SAVE') return { key: 'ROLLBACK', cat: 'TCL' };
    if (first === 'EXEC' || first === 'EXECUTE' || /^SP_/.test(first)) return { key: 'EXEC', cat: 'PROC' };
    if (first === 'DECLARE') return { key: 'DECLARE', cat: 'T-SQL' };
    if (first === 'SET') return { key: 'SET', cat: 'T-SQL' };
    if (first === 'PRINT') return { key: 'PRINT', cat: 'T-SQL' };
    return { key: first, cat: '?' };
  }

  function analyze(original, opts = {}) {
    const { s } = mask(original);
    const cl = classify(s);
    const info = (window.LAB && LAB.STATEMENTS[cl.key]) || { cat: cl.cat, does: 'Comando ' + cl.key + '.', not: '' };
    const a = { cat: cl.cat, key: cl.key, does: info.does, not: info.not, clauses: [], warnings: [], order: null, sql: original };
    const U = s.toUpperCase();
    const add = (k) => { const c = LAB.CLAUSES[k]; if (c && !a.clauses.find(x => x.k === k)) a.clauses.push({ k, ...c }); };
    const warn = (level, text, fix) => a.warnings.push({ level, text, fix });

    if (cl.cat === 'DQL' || cl.key === 'INSERT' || cl.key === 'CREATE VIEW') {
      if (/\bDISTINCT\b/.test(U)) add('DISTINCT');
      if (/\bTOP\b/.test(U)) add('TOP');
      if (/\bWHERE\b/.test(U)) add('WHERE');
      if (/\bLIKE\b/.test(U)) add('LIKE');
      if (/\bBETWEEN\b/.test(U)) add('BETWEEN');
      if (/\bIN\s*\(/.test(U)) add('IN');
      if (/\bIS\s+(NOT\s+)?NULL\b/.test(U)) add('IS NULL');
      if (/\bEXISTS\s*\(/.test(U)) add('EXISTS');
      if (/\bCROSS\s+JOIN\b/.test(U)) add('CROSS JOIN');
      if (/\bFULL\s+(OUTER\s+)?JOIN\b/.test(U)) add('FULL JOIN');
      if (/\bLEFT\s+(OUTER\s+)?JOIN\b/.test(U)) add('LEFT JOIN');
      if (/\bRIGHT\s+(OUTER\s+)?JOIN\b/.test(U)) add('RIGHT JOIN');
      if (/(\bINNER\s+JOIN\b)|((?<!LEFT|RIGHT|FULL|OUTER|CROSS)\s+JOIN\b)/.test(U)) add('INNER JOIN');
      if (/\bGROUP\s+BY\b/.test(U)) add('GROUP BY');
      if (/\bHAVING\b/.test(U)) add('HAVING');
      if (/\bUNION\s+ALL\b/.test(U)) add('UNION ALL'); else if (/\bUNION\b/.test(U)) add('UNION');
      if (/\bINTERSECT\b/.test(U)) add('INTERSECT');
      if (/\bEXCEPT\b/.test(U)) add('EXCEPT');
      if (/\bCASE\b/.test(U)) add('CASE');
      if (/\bORDER\s+BY\b/.test(U)) add('ORDER BY');
      if (/\bAS\b/.test(U)) add('AS');

      // Subconsultas
      const subs = (U.match(/\(\s*SELECT\b/g) || []).length;
      if (subs) {
        const derived = /\bFROM\s*\(\s*SELECT\b|\bJOIN\s*\(\s*SELECT\b/.test(U);
        // correlacionada: alias externo usado dentro da subconsulta
        const aliases = [...s.matchAll(/\b(?:FROM|JOIN)\s+([A-Za-z_]\w*)\s+(?:AS\s+)?([A-Za-z_]\w*)/gi)].map(m => m[2]).filter(x => !/^(WHERE|INNER|LEFT|RIGHT|FULL|CROSS|JOIN|ON|GROUP|ORDER|HAVING|UNION|AS|SET)$/i.test(x));
        let correlated = false;
        const reSub = /\(\s*SELECT\b/gi; let m;
        while ((m = reSub.exec(s))) {
          const close = matchParen(s, m.index); const body = s.slice(m.index, close);
          const inner = [...body.matchAll(/\b(?:FROM|JOIN)\s+[A-Za-z_]\w*\s+(?:AS\s+)?([A-Za-z_]\w*)/gi)].map(x => x[1].toUpperCase());
          for (const al of aliases) if (!inner.includes(al.toUpperCase()) && new RegExp('\\b' + al + '\\.', 'i').test(body)) correlated = true;
        }
        a.clauses.push({ k: 'SUBCONSULTA', does: correlated ? 'Subconsulta correlacionada: referencia a linha da consulta externa e é reavaliada linha a linha.' : derived ? 'Tabela derivada: uma subconsulta no FROM funciona como tabela temporária (precisa de alias).' : 'Subconsulta simples: executada uma vez e o resultado alimenta a consulta externa.', not: correlated ? 'Em tabelas grandes pode custar caro; avalie reescrever com JOIN.' : '' });
        if (correlated) warn('info', 'Subconsulta correlacionada detectada: é reavaliada para cada linha externa.', 'Em tabelas grandes, compare o plano com uma versão usando JOIN + GROUP BY.');
      }

      // Ordem lógica de execução
      if (cl.cat === 'DQL') {
        a.order = [
          ['FROM / JOIN', true], ['WHERE', /\bWHERE\b/.test(U)], ['GROUP BY', /\bGROUP\s+BY\b/.test(U)], ['HAVING', /\bHAVING\b/.test(U)],
          ['SELECT', true], ['DISTINCT', /\bDISTINCT\b/.test(U)], ['ORDER BY', /\bORDER\s+BY\b/.test(U)], ['TOP', /\bTOP\b/.test(U)]
        ];
      }

      // ---------- Linter ----------
      if (/(=|<>|!=)\s*NULL\b/i.test(s)) warn('erro', 'Comparação direta com NULL ("= NULL" ou "<> NULL") nunca é verdadeira. A consulta roda, mas não traz o que você espera.', 'Use IS NULL ou IS NOT NULL.');
      if (/SELECT\s+(TOP\s*\(?\d+\)?\s+)?\*/i.test(s)) warn('dica', 'SELECT * traz todas as colunas: mais tráfego e consultas que quebram quando a tabela muda.', 'Liste só as colunas necessárias.');
      if (/\bCROSS\s+JOIN\b/i.test(s)) warn('atencao', 'CROSS JOIN gera N × M linhas (produto cartesiano).', 'Confirme se é intencional; para relacionar tabelas use INNER/LEFT JOIN ... ON.');
      const fromTxt = clauseText(s, 'FROM', ['WHERE', 'GROUP', 'ORDER', 'HAVING', 'UNION', 'INTERSECT', 'EXCEPT', 'LIMIT']);
      if (fromTxt && splitTop(fromTxt).length > 1 && !hasTop(s, 'WHERE') && !/\bJOIN\b/i.test(fromTxt)) warn('erro', 'Várias tabelas no FROM separadas por vírgula e sem WHERE: isso é um produto cartesiano acidental.', 'Use a sintaxe ANSI: INNER JOIN ... ON chave_pk = chave_fk.');
      if (/\bUNION\b(?!\s+ALL)/i.test(s)) warn('dica', 'UNION remove duplicatas com uma etapa extra de ordenação.', 'Se os conjuntos não se sobrepõem ou duplicatas são aceitáveis, UNION ALL é mais rápido.');
      if (/LIKE\s+\u0001\d+\u0002/i.test(s)) {
        const { strings } = mask(original);
        [...s.matchAll(/LIKE\s+\u0001(\d+)\u0002/gi)].forEach(mm => { if (/^'%/.test(strings[+mm[1]])) warn('dica', `O padrão ${strings[+mm[1]]} começa com %: o índice da coluna não pode ser usado para buscar (varredura completa).`, 'Quando possível, use prefixo fixo, como \'Ana%\'. Esse tema volta na Unidade III.'); });
      }
      if (/\bNOT\s+IN\s*\(\s*SELECT\b/i.test(s)) warn('atencao', 'NOT IN com subconsulta: se a subconsulta retornar algum NULL, o resultado fica vazio.', 'Prefira NOT EXISTS ou adicione WHERE coluna IS NOT NULL na subconsulta.');
      const having = clauseText(s, 'HAVING', ['ORDER', 'UNION', 'INTERSECT', 'EXCEPT', 'LIMIT']);
      if (having && !AGG.test(having)) warn('dica', 'O HAVING não usa nenhuma função agregada.', 'Condições sobre linhas ficam mais eficientes no WHERE, antes do GROUP BY.');
      const ob = clauseText(s, 'ORDER BY', ['LIMIT']);
      if (/\bTOP\b/i.test(s) && !ob) warn('atencao', 'TOP sem ORDER BY: o SQL Server não garante quais linhas serão retornadas.', 'Adicione um ORDER BY que defina o critério.');
      if (/\bBETWEEN\s+\u0001\d+\u0002\s+AND\s+\u0001\d+\u0002/i.test(s)) warn('dica', 'BETWEEN com datas é inclusivo. Com colunas DATETIME, \'2024-12-31\' significa meia-noite, e o restante do dia fica de fora.', "Para datas com hora, prefira: col >= '2024-01-01' AND col < '2025-01-01'.");
    }

    if (cl.key === 'UPDATE' || cl.key === 'DELETE') {
      if (!hasTop(s, 'WHERE')) warn('erro', `${cl.key} sem WHERE afeta TODAS as linhas da tabela.`, 'Adicione WHERE. Teste o filtro antes com um SELECT e use BEGIN TRANSACTION para poder desfazer.');
      else warn('dica', 'Boa prática: rode antes um SELECT com o mesmo WHERE para conferir quais linhas serão atingidas.', '');
      if (cl.key === 'DELETE') add('WHERE');
    }
    if (cl.key === 'CREATE TABLE') {
      if (/\b(FLOAT|REAL)\b/i.test(s) && /(sal|prec|valor|total|preco|custo|limite|orcamento)\w*\s+(FLOAT|REAL)/i.test(s)) warn('erro', 'Coluna monetária declarada como FLOAT/REAL: precisão aproximada gera erros de arredondamento.', 'Use DECIMAL(10,2) ou NUMERIC(p,s).');
      if (!/PRIMARY\s+KEY/i.test(s)) warn('atencao', 'Tabela sem PRIMARY KEY: não há como identificar cada linha de forma única.', 'Defina uma chave primária (ex.: id INT PRIMARY KEY IDENTITY(1,1)).');
      if (/\bVARCHAR\b/i.test(s) && !/\bNVARCHAR\b/i.test(s)) warn('dica', 'VARCHAR não armazena Unicode no SQL Server (até a collation UTF-8 do 2019).', 'Para nomes com acentos e alfabetos diversos, NVARCHAR é o mais seguro.');
      if (/REFERENCES/i.test(s) && !/ON\s+DELETE/i.test(s)) warn('dica', 'FOREIGN KEY sem ON DELETE explícito usa NO ACTION: excluir o pai será bloqueado se houver filhos.', 'Decida conscientemente: CASCADE, SET NULL ou NO ACTION.');
    }
    if (cl.key === 'DROP') warn('atencao', 'DROP remove o objeto e todos os seus dados de forma definitiva.', 'Gere o script do objeto antes (aba Exportar) ou execute dentro de uma transação.');
    if (cl.key === 'TRUNCATE') warn('atencao', 'TRUNCATE apaga todas as linhas e não aceita WHERE.', 'Para remover só parte dos dados, use DELETE ... WHERE.');
    return a;
  }

  /* Validação do GROUP BY (emula o erro 8120 do SQL Server, que o SQLite não verifica) */
  function checkGroupBy(masked) {
    const s = masked;
    if (!/^\s*SELECT\b/i.test(s)) return null;
    if (hasTop(s, 'UNION') || hasTop(s, 'INTERSECT') || hasTop(s, 'EXCEPT')) return null;
    const list = clauseText(s, 'SELECT', ['FROM']);
    if (!list) return null;
    const items = splitTop(list.replace(/^DISTINCT\s+/i, '').replace(/^TOP\s*\(?\s*\d+\s*\)?\s*/i, ''));
    const gbTxt = clauseText(s, 'GROUP BY', ['HAVING', 'ORDER', 'LIMIT', 'UNION']);
    const anyAgg = items.some(it => AGG.test(it));
    if (!gbTxt && !anyAgg) return null;
    if (items.some(it => /\bOVER\s*\(/i.test(it))) return null;
    const gb = gbTxt ? splitTop(gbTxt).map(norm) : [];
    for (const raw of items) {
      if (AGG.test(raw)) continue;
      let expr = raw.trim().replace(/\s+AS\s+\S+$/i, '');
      const am = expr.match(/^([\s\S]*[\w\)\u0002])\s+([A-Za-z_]\w*)$/);
      if (am && !/^(END|AND|OR|NOT|NULL|THEN|ELSE|ASC|DESC)$/i.test(am[2]) && !/\b(CASE|WHEN|THEN|ELSE|AND|OR|NOT|IS)$/i.test(am[1].trim())) expr = am[1];
      expr = expr.trim();
      if (/^(\u0001\d+\u0002|-?\d+(\.\d+)?|NULL)$/i.test(expr)) continue;
      if (expr === '*' || /\.\*$/.test(expr)) return { col: expr };
      const n = norm(expr); const bare = n.replace(/^\w+\./, '');
      const ok = gb.some(g => g === n || g.replace(/^\w+\./, '') === bare);
      if (!ok) {
        const col = expr.replace(/\u0001\d+\u0002/g, "'…'");
        return { col };
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------
     Tradutor de erros (SQLite → estilo SQL Server, em português)
     ------------------------------------------------------------------ */
  function explainError(msg, original) {
    const m = String(msg);
    const R = (code, title, why, fix) => ({ code, title, why, fix, raw: m });
    let x;
    if ((x = m.match(/no such table: (\S+)/))) return R(208, `Nome de objeto inválido '${x[1]}'.`, 'A tabela/view não existe (ou o nome está digitado diferente).', 'Confira o nome no Explorador de Objetos (painel lateral) ou rode sp_tables.');
    if ((x = m.match(/no such column: (\S+)/))) return R(207, `Nome de coluna inválido '${x[1]}'.`, 'A coluna não existe na tabela, ou o alias usado não foi definido no FROM. Lembre: alias criado no SELECT não vale no WHERE.', 'Rode sp_help NomeDaTabela para ver as colunas.');
    if ((x = m.match(/UNIQUE constraint failed: (\S+)/))) return R(2627, `Violação da restrição UNIQUE/PRIMARY KEY em ${x[1]}.`, 'Já existe uma linha com esse valor em uma coluna que exige unicidade.', 'Verifique a existência antes de inserir ou use outro valor.');
    if (/FOREIGN KEY constraint failed/.test(m)) return R(547, 'A instrução conflitou com a restrição FOREIGN KEY.', /^\s*DELETE|^\s*DROP/i.test(original) ? 'Há registros filhos vinculados e a regra da FK é NO ACTION, que bloqueia a exclusão do pai.' : 'O valor da chave estrangeira não existe na tabela pai: seria um registro órfão.', /^\s*DELETE/i.test(original) ? 'Exclua (ou reatribua) os filhos primeiro, ou redefina a FK com ON DELETE CASCADE / SET NULL.' : 'Insira primeiro o registro pai ou use um id existente.');
    if ((x = m.match(/CHECK constraint failed: (.+)/))) return R(547, 'A instrução conflitou com a restrição CHECK.', `O valor viola a regra: ${x[1]}.`, 'Ajuste o valor para respeitar a condição definida na tabela.');
    if ((x = m.match(/NOT NULL constraint failed: (\S+)/))) return R(515, `Não é possível inserir NULL na coluna '${x[1]}'.`, 'A coluna foi definida como NOT NULL e não tem DEFAULT.', 'Informe um valor para essa coluna no INSERT/UPDATE.');
    if (/misuse of aggregate/.test(m)) return R(147, 'Uma agregação não pode aparecer na cláusula WHERE.', 'O WHERE é processado antes do GROUP BY, quando os grupos ainda não existem.', 'Mova a condição com SUM/AVG/COUNT para o HAVING.');
    if ((x = m.match(/ambiguous column name: (\S+)/))) return R(209, `Nome de coluna ambíguo '${x[1]}'.`, 'A coluna existe em mais de uma tabela do JOIN.', 'Qualifique com o alias: F.nome, D.nome.');
    if (/do not have the same number of result columns/.test(m)) return R(205, 'Todas as consultas combinadas por UNION, INTERSECT ou EXCEPT devem ter o mesmo número de expressões.', 'As listas de colunas dos SELECTs não são compatíveis.', 'Alinhe a quantidade e a ordem das colunas.');
    if ((x = m.match(/(?:table|view|index) (\S+) already exists/))) return R(2714, `Já existe um objeto chamado '${x[1]}' no banco de dados.`, 'O objeto foi criado antes.', 'Use outro nome, ou DROP antes de recriar.');
    if (/cannot start a transaction within a transaction/.test(m)) return R(0, 'Já existe uma transação aberta.', 'O simulador não aninha transações (no SQL Server, @@TRANCOUNT subiria).', 'Finalize com COMMIT ou ROLLBACK antes de abrir outra.');
    if (/no transaction is active/.test(m)) return R(3902, 'A solicitação COMMIT/ROLLBACK TRANSACTION não tem BEGIN TRANSACTION correspondente.', 'Não há transação aberta.', 'Abra com BEGIN TRANSACTION antes.');
    if (/sub-select returns \d+ columns/.test(m)) return R(116, 'Somente uma expressão pode ser especificada na lista de seleção quando a subconsulta não é introduzida com EXISTS.', 'A subconsulta usada como valor retorna mais de uma coluna.', 'Retorne uma única coluna na subconsulta.');
    if (/a GROUP BY clause is required before HAVING/.test(m)) return R(0, 'HAVING sem GROUP BY.', 'O HAVING filtra grupos, que precisam ser formados antes.', 'Adicione GROUP BY, ou use WHERE para filtrar linhas.');
    if (/incomplete input/.test(m)) return R(102, 'Sintaxe incorreta: o comando terminou antes do esperado.', 'Algo ficou aberto: parêntese, aspas ou bloco BEGIN.', 'Feche parênteses e aspas.');
    if ((x = m.match(/near "([^"]+)": syntax error/))) return R(102, `Sintaxe incorreta próxima de '${x[1]}'.`, 'O SGBD não reconheceu a estrutura do comando nesse ponto. Causas comuns: vírgula sobrando, palavra-chave na ordem errada ou recurso T-SQL não suportado pelo simulador.', 'Confira a ordem: SELECT → FROM → JOIN → WHERE → GROUP BY → HAVING → ORDER BY.');
    if (/cannot add a PRIMARY KEY column|Cannot add a UNIQUE column/.test(m)) return R(0, 'Não é possível adicionar essa coluna com ALTER TABLE.', 'O motor do simulador (SQLite) não adiciona colunas PRIMARY KEY/UNIQUE em tabela existente.', 'Recrie a tabela ou adicione a coluna sem a restrição.');
    if (/no such function: (\S+)/.test(m)) { x = m.match(/no such function: (\S+)/); return R(195, `'${x[1]}' não é um nome de função interna reconhecido.`, 'A função não existe ou não é suportada pelo simulador.', 'Veja a tabela de compatibilidade na aba Referência.'); }
    if (/too many terms in compound SELECT/.test(m)) return R(0, 'Consulta composta grande demais.', '', '');
    return R(0, m, 'Erro reportado pelo motor.', '');
  }

  /* ------------------------------------------------------------------
     Engine
     ------------------------------------------------------------------ */
  class Engine {
    constructor(SQL, bytes) {
      this.SQL = SQL;
      this.db = bytes ? new SQL.Database(bytes) : new SQL.Database();
      this.db.run('PRAGMA foreign_keys = ON;');
      this.db.run('CREATE TABLE IF NOT EXISTS __lab_procs (name TEXT PRIMARY KEY COLLATE NOCASE, params TEXT, body TEXT, source TEXT);');
      this.db.run('CREATE TABLE IF NOT EXISTS __lab_perms (acao TEXT, permissao TEXT, objeto TEXT, principal TEXT, quando TEXT);');
      this.vars = {}; this.inTx = false; this.safeMode = true; this.depth = 0;
    }
    /** Copia o banco. O sql.js reabre a conexão ao exportar: isso desligaria as FKs
        e descartaria uma transação aberta, então bloqueamos e religamos o PRAGMA. */
    export() {
      if (this.inTx) throw new Error('Há uma transação aberta no terminal. Finalize com COMMIT ou ROLLBACK e tente de novo.');
      const bytes = this.db.export();
      this.db.run('PRAGMA foreign_keys = ON;');
      return bytes;
    }
    clone() { const e = new Engine(this.SQL, this.export()); e.safeMode = false; e.vars = { ...this.vars }; return e; }

    query(sql, params) { const st = this.db.prepare(sql); if (params) st.bind(params); const cols = st.getColumnNames(); const rows = []; while (st.step()) rows.push(st.get()); st.free(); return { cols, rows }; }
    scalar(sql) { const r = this.query(sql); return r.rows.length ? r.rows[0][0] : null; }

    /** Executa um script com vários comandos. Retorna lista de "entradas". */
    run(text, opts = {}) {
      const out = [];
      for (const st of split(text)) {
        const t0 = performance.now();
        let entry;
        try { entry = this.runOne(st.text, opts); }
        catch (e) { entry = { kind: 'error', err: explainError(e.message, st.text) }; }
        entry.ms = performance.now() - t0;
        entry.sql = st.text;
        if (!entry.analysis) { try { entry.analysis = analyze(st.text); } catch (e) { entry.analysis = null; } }
        if (Array.isArray(entry.children)) { out.push(entry); continue; }
        out.push(entry);
        if (entry.kind === 'error' && opts.stopOnError) break;
      }
      return out;
    }

    substituteVars(text) {
      if (!Object.keys(this.vars).length) return text;
      const toks = lex(text);
      return toks.map(t => (t.type === 'word' && t.v[0] === '@' && this.vars.hasOwnProperty(t.v.toLowerCase())) ? this.vars[t.v.toLowerCase()] : t.v).join('');
    }
    literal(v) { if (v === null || v === undefined) return 'NULL'; if (typeof v === 'number') return String(v); return "'" + String(v).replace(/'/g, "''") + "'"; }
    evalExpr(expr) { const v = this.scalar('SELECT ' + translate(this.substituteVars(expr), new Set())); return v; }

    runOne(sqlText, opts) {
      sqlText = stripLead(sqlText);
      const { s: masked } = mask(sqlText);
      const U = masked.trim().toUpperCase().replace(/\s+/g, ' ');
      const analysis = analyze(sqlText);

      /* ---- T-SQL: variáveis, PRINT, USE ---- */
      if (/^USE\s+/.test(U)) return { kind: 'msg', msg: `Contexto de banco alterado para '${sqlText.trim().split(/\s+/)[1]}'. (O simulador possui um único banco: LabUnidade2.)`, analysis };
      if (/^DECLARE\s+@/.test(U)) {
        const defs = splitTop(sqlText.trim().replace(/^DECLARE\s+/i, ''));
        const done = [];
        for (const d of defs) {
          const m = d.match(/^(@\w+)\s+(?:AS\s+)?[A-Za-z]+(?:\s*\([^)]*\))?\s*(?:=\s*([\s\S]+))?$/i);
          if (!m) throw new Error('near "' + d.slice(0, 20) + '": syntax error');
          const val = m[2] !== undefined ? this.evalExpr(m[2]) : null;
          this.vars[m[1].toLowerCase()] = this.literal(val); done.push(`${m[1]} = ${this.literal(val)}`);
        }
        return { kind: 'msg', msg: 'Variável declarada: ' + done.join(', '), analysis };
      }
      if (/^SET\s+@/.test(U)) {
        const m = sqlText.trim().match(/^SET\s+(@\w+)\s*=\s*([\s\S]+)$/i);
        if (!m) throw new Error('near "SET": syntax error');
        if (!this.vars.hasOwnProperty(m[1].toLowerCase())) return { kind: 'error', err: { code: 137, title: `É necessário declarar a variável escalar "${m[1]}".`, why: 'A variável não foi declarada com DECLARE nesta sessão.', fix: `DECLARE ${m[1]} INT;` }, analysis };
        const v = this.evalExpr(m[2]); this.vars[m[1].toLowerCase()] = this.literal(v);
        return { kind: 'msg', msg: `${m[1]} = ${this.literal(v)}`, analysis };
      }
      if (/^SET\s+(NOCOUNT|IDENTITY_INSERT|ANSI_NULLS|QUOTED_IDENTIFIER|XACT_ABORT)\b/.test(U)) return { kind: 'msg', msg: 'Opção de sessão aceita (sem efeito no simulador).', analysis };
      if (/^PRINT\b/.test(U)) { const v = this.evalExpr(sqlText.trim().replace(/^PRINT\s+/i, '')); return { kind: 'msg', msg: String(v), analysis }; }

      /* ---- DCL simulado ---- */
      if (/^(GRANT|REVOKE|DENY)\b/.test(U)) {
        const m = sqlText.trim().match(/^(GRANT|REVOKE|DENY)\s+([\w\s,]+?)\s+ON\s+(?:OBJECT::)?([\w\.\[\]]+)\s+(?:TO|FROM)\s+([\w\[\]]+)/i);
        if (!m) throw new Error('near "' + U.split(' ')[0] + '": syntax error');
        const obj = m[3].replace(/^\[?dbo\]?\./i, '').replace(/[\[\]]/g, '');
        const exists = this.scalar(`SELECT COUNT(*) FROM sqlite_master WHERE lower(name)=lower('${obj.replace(/'/g, "''")}')`) + this.scalar(`SELECT COUNT(*) FROM __lab_procs WHERE name='${obj.replace(/'/g, "''")}'`);
        if (!exists) return { kind: 'error', err: { code: 15151, title: `Não é possível localizar o objeto '${obj}', pois ele não existe ou você não tem permissão.`, why: 'O objeto referenciado não existe.', fix: 'Confira o nome em sp_tables / sp_stored_procedures.' }, analysis };
        const acao = m[1].toUpperCase();
        if (acao === 'REVOKE') this.db.run('DELETE FROM __lab_perms WHERE upper(permissao)=upper(?) AND lower(objeto)=lower(?) AND lower(principal)=lower(?)', [m[2].trim(), obj, m[4]]);
        else this.db.run("INSERT INTO __lab_perms VALUES (?,?,?,?,datetime('now','localtime'))", [acao, m[2].trim().toUpperCase(), obj, m[4].replace(/[\[\]]/g, '')]);
        const verbo = { GRANT: 'concedida a', REVOKE: 'removida de', DENY: 'negada a' }[acao];
        return { kind: 'msg', msg: `Permissão ${m[2].trim().toUpperCase()} em ${obj} ${verbo} ${m[4]}. (Simulado: o simulador tem um único usuário; consulte com sp_helprotect.)`, analysis };
      }

      /* ---- Procedures ---- */
      if (/^(CREATE|ALTER|CREATE OR ALTER) PROC(EDURE)?\b/.test(U)) return this.createProc(sqlText, analysis);
      if (/^DROP PROC(EDURE)?\b/.test(U)) {
        const name = sqlText.trim().split(/\s+/).pop().replace(/[\[\];]/g, '').replace(/^dbo\./i, '');
        const n = this.scalar(`SELECT COUNT(*) FROM __lab_procs WHERE name = '${name.replace(/'/g, "''")}'`);
        if (!n) return { kind: 'error', err: { code: 3701, title: `Não é possível descartar o procedimento '${name}' porque ele não existe.`, why: '', fix: 'sp_stored_procedures lista as procedures existentes.' }, analysis };
        this.db.run('DELETE FROM __lab_procs WHERE name = ?', [name]);
        return { kind: 'msg', msg: `Procedure ${name} removida.`, analysis, ddl: true };
      }
      if (/^(EXEC|EXECUTE)\s+/.test(U) || /^SP_\w+/.test(U)) return this.exec(sqlText, analysis, opts);

      /* ---- ALTER não suportado ---- */
      if (/^ALTER TABLE \S+ (ALTER COLUMN|ADD CONSTRAINT|DROP CONSTRAINT)/.test(U)) {
        return { kind: 'error', err: { code: 0, title: 'Recurso não suportado pelo simulador.', why: 'No SQL Server este comando é válido. O motor do simulador (SQLite) não altera restrições ou tipos de colunas existentes.', fix: 'Declare as restrições no CREATE TABLE. Para mudar, recrie a tabela (DROP + CREATE) ou crie uma nova e copie os dados com INSERT ... SELECT.' }, analysis };
      }

      /* ---- Modo seguro ---- */
      if ((analysis.key === 'UPDATE' || analysis.key === 'DELETE') && this.safeMode && !hasTop(masked, 'WHERE') && !/--\s*confirmar/i.test(sqlText)) {
        const n = this.scalar('SELECT COUNT(*) FROM ' + (masked.match(/^\s*(?:UPDATE|DELETE\s+FROM|DELETE)\s+([\w\[\]\.]+)/i) || [, 'sqlite_master'])[1]);
        return { kind: 'blocked', msg: `Modo seguro: ${analysis.key} sem WHERE foi bloqueado. Ele afetaria ${n} linha(s).`, analysis };
      }

      /* ---- GROUP BY (Msg 8120) ---- */
      if (analysis.key === 'SELECT') {
        const gb = checkGroupBy(mask(this.substituteVars(sqlText)).s);
        if (gb) return { kind: 'error', err: { code: 8120, title: `A coluna '${gb.col}' é inválida na lista de seleção porque não está contida em uma função de agregação nem na cláusula GROUP BY.`, why: 'Cada grupo pode conter vários valores dessa coluna, e o SQL Server não escolhe um ao acaso. (O SQLite aceitaria em silêncio; o simulador reproduz o comportamento do SQL Server.)', fix: `Inclua ${gb.col} no GROUP BY ou envolva-a em uma agregação (MAX, COUNT...).` }, analysis };
      }

      /* ---- Execução real ---- */
      const notes = new Set();
      const sql = translate(this.substituteVars(sqlText), notes);
      const st = this.db.prepare(sql);
      const cols = st.getColumnNames(); const rows = [];
      let n = 0; while (st.step()) { if (n++ < 5000) rows.push(st.get()); }
      st.free();
      const k = analysis.key;
      if (k === 'BEGIN TRANSACTION') this.inTx = true;
      if (k === 'COMMIT' || k === 'ROLLBACK') this.inTx = false;
      if (cols.length) return { kind: 'result', cols, rows, total: n, analysis, notes: [...notes] };
      const affected = this.db.getRowsModified();
      let msg;
      if (['INSERT', 'UPDATE', 'DELETE'].includes(k)) msg = `(${affected} ${affected === 1 ? 'linha afetada' : 'linhas afetadas'})`;
      else if (k === 'BEGIN TRANSACTION') msg = 'Transação iniciada. Alterações ficam pendentes até COMMIT ou ROLLBACK.';
      else if (k === 'COMMIT') msg = 'Transação confirmada (COMMIT). Alterações gravadas.';
      else if (k === 'ROLLBACK') msg = 'Transação desfeita (ROLLBACK). O banco voltou ao estado anterior.';
      else msg = 'Comandos concluídos com êxito.';
      return { kind: 'msg', msg, analysis, notes: [...notes], ddl: analysis.cat === 'DDL', dml: analysis.cat === 'DML' };
    }

    createProc(sqlText, analysis) {
      const m = sqlText.trim().match(/^(CREATE(?:\s+OR\s+ALTER)?|ALTER)\s+PROC(?:EDURE)?\s+([\w\.\[\]]+)\s*([\s\S]*?)\bAS\b\s*([\s\S]*)$/i);
      if (!m) throw new Error('near "PROCEDURE": syntax error');
      const name = m[2].replace(/[\[\]]/g, '').replace(/^dbo\./i, '');
      const params = [...m[3].replace(/^\(|\)\s*$/g, '').matchAll(/(@\w+)\s+([A-Za-z]+(?:\s*\([^)]*\))?)(?:\s*=\s*([^,]+))?/g)].map(p => ({ name: p[1], type: p[2].toUpperCase(), def: p[3] ? p[3].trim() : null }));
      let body = m[4].trim();
      const bm = body.match(/^BEGIN\b([\s\S]*)\bEND\s*;?\s*$/i);
      if (bm) body = bm[1].trim();
      const exists = this.scalar(`SELECT COUNT(*) FROM __lab_procs WHERE name='${name.replace(/'/g, "''")}'`);
      if (exists && /^CREATE$/i.test(m[1])) return { kind: 'error', err: { code: 2714, title: `Já existe um objeto chamado '${name}' no banco de dados.`, why: 'A procedure já foi criada.', fix: `Use ALTER PROCEDURE ${name} ... ou CREATE OR ALTER PROCEDURE.` }, analysis };
      this.db.run('INSERT OR REPLACE INTO __lab_procs VALUES (?,?,?,?)', [name, JSON.stringify(params), body, sqlText.trim()]);
      return { kind: 'msg', msg: `Procedure ${name} ${exists ? 'alterada' : 'criada'} com ${params.length} parâmetro(s). Execute com: EXEC ${name}${params.length ? ' ' + params.map(p => p.name + ' = ...').join(', ') : ''};`, analysis, ddl: true };
    }

    exec(sqlText, analysis, opts) {
      const t = sqlText.trim().replace(/;$/, '');
      const m = t.match(/^(?:EXEC(?:UTE)?\s+)?([\w\.\[\]]+)\s*([\s\S]*)$/i);
      const name = m[1].replace(/[\[\]]/g, '').replace(/^dbo\./i, '');
      const argTxt = m[2].trim();
      const sys = this.systemProc(name.toLowerCase(), argTxt.replace(/^'|'$/g, '').replace(/^N'/i, ''), analysis);
      if (sys) return sys;
      const row = this.query('SELECT params, body FROM __lab_procs WHERE name = ?', [name]).rows[0];
      if (!row) return { kind: 'error', err: { code: 2812, title: `Não foi possível localizar o procedimento armazenado '${name}'.`, why: 'A procedure não existe neste banco.', fix: 'sp_stored_procedures lista as existentes. Crie com CREATE PROCEDURE.' }, analysis };
      if (this.depth > 5) throw new Error('Nível máximo de aninhamento de procedures excedido.');
      const params = JSON.parse(row[0]); const vals = {};
      const args = argTxt ? splitTop(mask(argTxt).s).map(a => unmask(a, mask(argTxt).strings)) : [];
      args.forEach((a, i) => {
        const nm = a.match(/^(@\w+)\s*=\s*([\s\S]+)$/);
        if (nm) vals[nm[1].toLowerCase()] = nm[2].trim();
        else if (params[i]) vals[params[i].name.toLowerCase()] = a.trim();
      });
      for (const p of params) {
        const k = p.name.toLowerCase();
        if (vals[k] === undefined) {
          if (p.def !== null) vals[k] = p.def;
          else return { kind: 'error', err: { code: 201, title: `O procedimento '${name}' espera o parâmetro '${p.name}', que não foi fornecido.`, why: 'Parâmetro obrigatório sem valor padrão.', fix: `EXEC ${name} ${params.map(x => x.name + ' = valor').join(', ')};` }, analysis };
        }
        vals[k] = this.literal(this.evalExpr(vals[k]));
      }
      const body = lex(row[1]).map(tk => (tk.type === 'word' && tk.v[0] === '@' && vals[tk.v.toLowerCase()] !== undefined) ? vals[tk.v.toLowerCase()] : tk.v).join('');
      this.depth++;
      let children; try { children = this.run(body, opts); } finally { this.depth--; }
      return { kind: 'proc', name, params: vals, children, analysis, dml: children.some(c => c.dml) };
    }

    systemProc(name, arg, analysis) {
      const R = (cols, rows, title) => ({ kind: 'result', cols, rows, total: rows.length, analysis, title });
      if (name === 'sp_tables') return R(['TABLE_NAME', 'TABLE_TYPE', 'LINHAS'], this.tables().map(t => [t.name, t.type === 'view' ? 'VIEW' : 'TABLE', t.count]));
      if (name === 'sp_stored_procedures') return R(['PROCEDURE_NAME', 'PARAMETROS'], this.procs().map(p => [p.name, p.params.map(x => x.name + ' ' + x.type).join(', ') || '(nenhum)']));
      if (name === 'sp_helprotect') return R(['ACAO', 'PERMISSAO', 'OBJETO', 'PRINCIPAL', 'QUANDO'], this.query('SELECT * FROM __lab_perms ORDER BY quando').rows);
      if (name === 'sp_helptext') { const r = this.query('SELECT source FROM __lab_procs WHERE name = ?', [arg]).rows[0] || this.query("SELECT sql FROM sqlite_master WHERE type='view' AND lower(name)=lower(?)", [arg]).rows[0]; if (!r) return { kind: 'error', err: { code: 15009, title: `O objeto '${arg}' não existe.`, why: '', fix: '' }, analysis }; return R(['Text'], String(r[0]).split('\n').map(l => [l])); }
      if (name === 'sp_help' || name === 'sp_columns') {
        if (!arg) return R(['Name', 'Owner', 'Object_type'], this.tables().map(t => [t.name, 'dbo', t.type === 'view' ? 'view' : 'user table']));
        const t = this.tables().find(x => x.name.toLowerCase() === arg.toLowerCase());
        if (!t) return { kind: 'error', err: { code: 15009, title: `O objeto '${arg}' não existe no banco de dados.`, why: '', fix: 'Rode sp_tables.' }, analysis };
        return R(['Column_name', 'Type', 'Nullable', 'Default', 'Key', 'References'], t.cols.map(c => {
          const fk = t.fks.find(f => f.from === c.name);
          return [c.name, c.type, c.notnull ? 'no' : 'yes', c.dflt === null ? '' : c.dflt, c.pk ? 'PK' : (fk ? 'FK' : ''), fk ? `${fk.table}(${fk.to}) ON DELETE ${fk.onDelete}` : ''];
        }), t.name);
      }
      return null;
    }

    /* ---------- Metadados ---------- */
    tables() {
      const list = this.query("SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__lab_%' ORDER BY type, name").rows;
      return list.map(([name, type, sql]) => {
        const q = (x) => '"' + x.replace(/"/g, '""') + '"';
        const cols = this.query('PRAGMA table_info(' + q(name) + ')').rows.map(r => ({ name: r[1], type: backType(r[2]), notnull: !!r[3], dflt: r[4] === null ? null : backDefault(r[4]), pk: r[5] > 0 }));
        const fks = type === 'table' ? this.query('PRAGMA foreign_key_list(' + q(name) + ')').rows.map(r => ({ table: r[2], from: r[3], to: r[4], onDelete: r[6] })) : [];
        let count = 0; try { count = this.scalar('SELECT COUNT(*) FROM ' + q(name)); } catch (e) { }
        if (/AUTOINCREMENT/i.test(sql || '')) { const pkc = cols.find(c => c.pk); if (pkc) { pkc.identity = true; pkc.type = 'INT IDENTITY(1,1)'; } }
        cols.forEach(c => { if (c.pk) c.notnull = true; });
        return { name, type, cols, fks, count, sql };
      });
    }
    procs() { return this.query('SELECT name, params, source FROM __lab_procs ORDER BY name').rows.map(r => ({ name: r[0], params: JSON.parse(r[1]), source: r[2] })); }
    indexes() { return this.query("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").rows; }

    /** Gera script estilo SSMS → "Gerar Scripts" (ordem de dependência respeitada). */
    script({ data = false } = {}) {
      const ts = this.tables(); const tabs = ts.filter(t => t.type === 'table'); const views = ts.filter(t => t.type === 'view');
      const ordered = []; const seen = new Set(); const visiting = new Set();
      const visit = (t) => { if (seen.has(t.name)) return; if (visiting.has(t.name)) return; visiting.add(t.name); t.fks.forEach(f => { const p = tabs.find(x => x.name.toLowerCase() === f.table.toLowerCase()); if (p && p !== t) visit(p); }); visiting.delete(t.name); seen.add(t.name); ordered.push(t); };
      tabs.forEach(visit);
      const now = new Date().toLocaleString('pt-BR');
      let out = `/* ==========================================================\n   Script gerado pelo SQL Lab · Unidade II   (${now})\n   Conteúdo: ${data ? 'esquema (DDL) + dados (DML)' : 'somente esquema (DDL) — nenhum dado exportado'}\n   Ordem: tabelas PAI antes das tabelas FILHAS (dependência de FK)\n   ========================================================== */\n\n`;
      ordered.forEach((t, i) => {
        out += `/****** Objeto: Table [dbo].[${t.name}]  · ordem ${i + 1}${t.fks.filter(f => f.table !== t.name).length ? ' · depende de: ' + [...new Set(t.fks.filter(f => f.table !== t.name).map(f => f.table))].join(', ') : ''} ******/\n`;
        out += toTSQL(t.sql) + ';\nGO\n\n';
      });
      this.indexes().forEach(([n, , sql]) => { out += `/****** Objeto: Index [${n}] ******/\n${sql};\nGO\n\n`; });
      views.forEach(v => { out += `/****** Objeto: View [dbo].[${v.name}] ******/\n${v.sql};\nGO\n\n`; });
      this.procs().forEach(p => { out += `/****** Objeto: StoredProcedure [dbo].[${p.name}] ******/\n${p.source.replace(/;?\s*$/, '')};\nGO\n\n`; });
      if (data) {
        out += '/* ======================= DADOS ======================= */\n\n';
        ordered.forEach(t => {
          const r = this.query('SELECT * FROM "' + t.name + '"'); if (!r.rows.length) return;
          const ident = t.cols.some(c => c.identity);
          if (ident) out += `SET IDENTITY_INSERT [dbo].[${t.name}] ON;\n`;
          out += `INSERT INTO ${t.name} (${r.cols.join(', ')}) VALUES\n` + r.rows.map(row => ' (' + row.map(v => this.literal(v)).join(', ') + ')').join(',\n') + ';\n';
          if (ident) out += `SET IDENTITY_INSERT [dbo].[${t.name}] OFF;\n`;
          out += 'GO\n\n';
        });
      }
      return out;
    }
  }

  function stripLead(t) { let prev; do { prev = t; t = t.replace(/^\s*(--[^\n]*\n?|\/\*[\s\S]*?\*\/)/, ''); } while (t !== prev); return t.trim(); }
  function backType(t) { return (t || '').toUpperCase(); }
  function backDefault(d) { return String(d).replace(/\(datetime\('now','localtime'\)\)/i, 'GETDATE()'); }
  function toTSQL(sql) {
    return String(sql)
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'INT IDENTITY(1,1) PRIMARY KEY')
      .replace(/\(datetime\('now','localtime'\)\)/gi, 'GETDATE()')
      .replace(/\bLENGTH\(/g, 'LEN(');
  }

  window.SQLEngine = { Engine, split, mask, lex, translate, analyze, explainError };
})();

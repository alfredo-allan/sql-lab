/* =====================================================================
   SQL Lab · Unidade II — Conteúdo didático e banco de exemplo
   Disciplina: Modelagem de Banco de Dados Relacional e NoSQL (UNIP)
   ===================================================================== */
window.LAB = window.LAB || {};

/* ---------------------------------------------------------------------
   1. Script de criação do banco (escrito em T-SQL, como no SQL Server).
      A camada de compatibilidade (engine.js) traduz IDENTITY, GETDATE()
      etc. para o motor SQLite que roda no navegador.
   --------------------------------------------------------------------- */
LAB.SEED_SQL = `
-- ============ TABELAS PAI (criadas primeiro: ordem de dependência) ============
CREATE TABLE Departamento (
    id_departamento INT PRIMARY KEY IDENTITY(1,1),
    nome            NVARCHAR(60)  NOT NULL UNIQUE,
    localizacao     NVARCHAR(60)  NULL,
    orcamento       DECIMAL(12,2) CHECK (orcamento >= 0)
);

CREATE TABLE Cliente (
    id_cliente    INT PRIMARY KEY IDENTITY(1,1),
    nome          NVARCHAR(100) NOT NULL,
    email         VARCHAR(150)  NOT NULL UNIQUE,
    cidade        NVARCHAR(60),
    uf            CHAR(2)       CHECK (LEN(uf) = 2),
    data_cadastro DATE          DEFAULT GETDATE()
);

CREATE TABLE Produto (
    id_produto INT PRIMARY KEY IDENTITY(1,1),
    nome       NVARCHAR(80)  NOT NULL,
    categoria  NVARCHAR(40)  NOT NULL,
    preco      DECIMAL(10,2) NOT NULL CHECK (preco > 0),
    estoque    INT           NOT NULL DEFAULT 0 CHECK (estoque >= 0)
);

-- Base legada (sistema antigo) — usada nas Operações de Conjunto
CREATE TABLE ClienteLegado (
    id_legado INT PRIMARY KEY IDENTITY(1,1),
    nome      NVARCHAR(100) NOT NULL,
    email     VARCHAR(150)  NOT NULL,
    cidade    NVARCHAR(60)
);

-- ============ TABELAS FILHAS (dependem das anteriores) ============
CREATE TABLE Funcionario (
    id_funcionario  INT PRIMARY KEY IDENTITY(1,1),
    nome            NVARCHAR(100) NOT NULL,
    email           VARCHAR(150)  NOT NULL UNIQUE,
    cargo           NVARCHAR(40)  NOT NULL,
    salario         DECIMAL(10,2) NOT NULL CHECK (salario >= 0),
    data_admissao   DATE          NOT NULL,
    id_departamento INT NULL,
    id_gerente      INT NULL,
    FOREIGN KEY (id_departamento) REFERENCES Departamento(id_departamento) ON DELETE SET NULL,
    FOREIGN KEY (id_gerente)      REFERENCES Funcionario(id_funcionario)    ON DELETE NO ACTION
);

CREATE TABLE Pedido (
    id_pedido   INT PRIMARY KEY IDENTITY(1,1),
    id_cliente  INT NOT NULL,
    data_pedido DATE NOT NULL,
    status      NVARCHAR(20) NOT NULL DEFAULT 'Aberto'
                CHECK (status IN ('Aberto','Pago','Enviado','Entregue','Cancelado')),
    FOREIGN KEY (id_cliente) REFERENCES Cliente(id_cliente) ON DELETE CASCADE
);

CREATE TABLE ItemPedido (
    id_pedido      INT NOT NULL,
    id_produto     INT NOT NULL,
    quantidade     INT NOT NULL CHECK (quantidade > 0),
    preco_unitario DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id_pedido, id_produto),
    FOREIGN KEY (id_pedido)  REFERENCES Pedido(id_pedido)   ON DELETE CASCADE,
    FOREIGN KEY (id_produto) REFERENCES Produto(id_produto) ON DELETE NO ACTION
);

-- ============ DADOS (DML) ============
INSERT INTO Departamento (nome, localizacao, orcamento) VALUES
 ('Tecnologia','São Paulo',450000.00),
 ('Financeiro','São Paulo',220000.00),
 ('Comercial','Campinas',310000.00),
 ('Recursos Humanos','São Paulo',120000.00),
 ('Logística','Santos',180000.00),
 ('Jurídico','Brasília',95000.00);

INSERT INTO Funcionario (nome,email,cargo,salario,data_admissao,id_departamento,id_gerente) VALUES
 ('Ana Beatriz Souza','ana.souza@empresa.com','Gerente',14500.00,'2016-03-01',1,NULL),
 ('Bruno Carvalho','bruno.c@empresa.com','Analista',7200.00,'2019-07-15',1,1),
 ('Juliana Prado','juliana.p@empresa.com','Desenvolvedora',8900.00,'2021-02-10',1,1),
 ('João Mendes','joao.m@empresa.com','Estagiário',1800.00,'2024-01-08',1,2),
 ('Carla Nunes','carla.n@empresa.com','Gerente',12800.00,'2015-05-20',2,NULL),
 ('Diego Ramos','diego.r@empresa.com','Analista',6100.00,'2020-09-01',2,5),
 ('Jéssica Lima','jessica.l@empresa.com','Assistente',3200.00,'2022-11-03',2,5),
 ('Eduardo Teixeira','eduardo.t@empresa.com','Gerente',11900.00,'2017-08-14',3,NULL),
 ('Fernanda Alves','fernanda.a@empresa.com','Vendedora',4300.00,'2020-03-16',3,8),
 ('Gustavo Pereira','gustavo.p@empresa.com','Vendedor',4100.00,'2023-06-05',3,8),
 ('Alice Martins','alice.m@empresa.com','Vendedora',3950.00,'2024-04-22',3,8),
 ('Helena Costa','helena.c@empresa.com','Analista',5600.00,'2018-10-01',4,NULL),
 ('Igor Santana','igor.s@empresa.com','Assistente',2900.00,'2021-12-13',4,12),
 ('Larissa Rocha','larissa.r@empresa.com','Coordenadora',7800.00,'2019-01-28',5,NULL),
 ('Marcos Vieira','marcos.v@empresa.com','Motorista',3100.00,'2022-02-14',5,14),
 ('Paulo Henrique','paulo.h@empresa.com','Consultor',6500.00,'2023-09-11',NULL,NULL);

INSERT INTO Cliente (nome,email,cidade,uf,data_cadastro) VALUES
 ('Mercado Bom Preço','contato@bompreco.com','São Paulo','SP','2021-01-10'),
 ('Padaria Pão Quente','pao@quente.com','Campinas','SP','2021-03-22'),
 ('Tech Soluções ME','ti@techsol.com','Belo Horizonte','MG','2021-06-05'),
 ('Ótica Visão Clara','visao@clara.com','Rio de Janeiro','RJ','2022-02-18'),
 ('Farmácia Vida','vida@farma.com','São Paulo','SP','2022-05-30'),
 ('Livraria Saber','saber@livros.com','Curitiba','PR','2022-08-12'),
 ('Academia Força','forca@academia.com','Santos','SP','2023-01-09'),
 ('Pet Shop Amigo','amigo@pet.com','Niterói','RJ','2023-04-17'),
 ('Construtora Alicerce','obra@alicerce.com','Salvador','BA','2023-07-21'),
 ('Café Aroma','aroma@cafe.com','São Paulo','SP','2024-02-02'),
 ('Escola Aprender','sec@aprender.edu','Recife','PE','2024-05-14'),
 ('Ateliê Arte Viva','arte@viva.com','Florianópolis','SC','2024-09-03');

INSERT INTO ClienteLegado (nome,email,cidade) VALUES
 ('Mercado Bom Preço','contato@bompreco.com','São Paulo'),
 ('Tech Soluções ME','ti@techsol.com','Belo Horizonte'),
 ('Farmácia Vida','vida@farma.com','São Paulo'),
 ('Café Aroma','aroma@cafe.com','São Paulo'),
 ('Gráfica Rápida','grafica@rapida.com','Goiânia'),
 ('Sorveteria Polar','polar@sorvete.com','Fortaleza'),
 ('Oficina do Zé','ze@oficina.com','Porto Alegre'),
 ('Mercado Bom Preço','contato@bompreco.com','São Paulo');

INSERT INTO Produto (nome,categoria,preco,estoque) VALUES
 ('Notebook 14"','Informática',3899.90,25),
 ('Mouse sem fio','Informática',89.90,240),
 ('Monitor 24"','Informática',899.00,40),
 ('Teclado mecânico','Informática',349.50,75),
 ('Cadeira ergonômica','Mobiliário',1290.00,18),
 ('Mesa em L','Mobiliário',980.00,12),
 ('Gaveteiro','Mobiliário',420.00,0),
 ('Papel A4 (caixa)','Papelaria',229.90,130),
 ('Caneta (cx 50)','Papelaria',59.90,300),
 ('Grampeador','Papelaria',38.50,95),
 ('Headset USB','Áudio',219.00,60),
 ('Caixa de som BT','Áudio',189.90,0);

INSERT INTO Pedido (id_cliente,data_pedido,status) VALUES
 (1,'2024-01-15','Entregue'),
 (1,'2024-03-02','Entregue'),
 (2,'2024-02-20','Entregue'),
 (3,'2024-04-11','Pago'),
 (3,'2024-06-25','Enviado'),
 (4,'2024-05-07','Cancelado'),
 (5,'2024-07-19','Entregue'),
 (5,'2024-08-30','Aberto'),
 (6,'2024-09-12','Entregue'),
 (7,'2024-10-01','Pago'),
 (1,'2024-11-05','Enviado'),
 (9,'2024-11-20','Cancelado'),
 (9,'2025-01-14','Entregue'),
 (3,'2025-02-03','Aberto'),
 (2,'2025-03-18','Pago');

INSERT INTO ItemPedido (id_pedido,id_produto,quantidade,preco_unitario) VALUES
 (1,1,2,3799.90),(1,2,2,89.90),
 (2,8,10,229.90),(2,9,5,59.90),
 (3,9,3,59.90),(3,10,2,38.50),
 (4,1,5,3899.90),(4,3,5,899.00),(4,4,5,349.50),
 (5,11,10,219.00),
 (6,5,1,1290.00),
 (7,2,4,89.90),(7,8,2,229.90),
 (8,6,1,980.00),(8,5,1,1290.00),
 (9,8,3,229.90),(9,10,1,38.50),
 (10,11,4,219.00),(10,12,2,189.90),
 (11,3,2,899.00),(11,4,2,349.50),
 (12,1,1,3899.90),
 (13,5,6,1250.00),(13,6,6,960.00),
 (14,2,20,85.00),(14,4,10,339.00),
 (15,9,10,59.90);
`;

/* Procedimentos armazenados pré-instalados (exemplos do livro-texto) */
LAB.SEED_PROCS = `
CREATE PROCEDURE sp_AtualizarSalario
    @id_depto INT,
    @percentual DECIMAL(5,2)
AS
BEGIN
    UPDATE Funcionario
    SET salario = salario * (1 + @percentual / 100)
    WHERE id_departamento = @id_depto;
END;

CREATE PROCEDURE sp_PedidosDoCliente
    @id_cliente INT
AS
BEGIN
    SELECT P.id_pedido, P.data_pedido, P.status,
           SUM(I.quantidade * I.preco_unitario) AS total
    FROM Pedido P
    INNER JOIN ItemPedido I ON I.id_pedido = P.id_pedido
    WHERE P.id_cliente = @id_cliente
    GROUP BY P.id_pedido, P.data_pedido, P.status
    ORDER BY P.data_pedido;
END;
`;

/* ---------------------------------------------------------------------
   2. Biblioteca de comandos (snippets) por subconjunto / tópico
   --------------------------------------------------------------------- */
LAB.SNIPPETS = [
  { group: 'DQL · Filtros', items: [
    { t: 'SELECT com WHERE + LIKE + BETWEEN', sql: "SELECT nome, salario\nFROM Funcionario\nWHERE nome LIKE 'J%' AND salario BETWEEN 1000 AND 9000;" },
    { t: 'IN substituindo vários OR', sql: "SELECT nome, cargo\nFROM Funcionario\nWHERE cargo IN ('Analista', 'Gerente');" },
    { t: 'LIKE com _ (um caractere)', sql: "SELECT nome FROM Funcionario\nWHERE nome LIKE '_u%';" },
    { t: 'IS NULL (nunca = NULL)', sql: "SELECT nome, cargo\nFROM Funcionario\nWHERE id_departamento IS NULL;" },
    { t: 'TOP + ORDER BY (T-SQL)', sql: "SELECT TOP 5 nome, salario\nFROM Funcionario\nORDER BY salario DESC;" },
    { t: 'DISTINCT', sql: "SELECT DISTINCT categoria FROM Produto ORDER BY categoria;" },
    { t: 'CASE (classificação)', sql: "SELECT nome, salario,\n  CASE WHEN salario >= 10000 THEN 'Alto'\n       WHEN salario >= 5000  THEN 'Médio'\n       ELSE 'Base' END AS faixa\nFROM Funcionario\nORDER BY salario DESC;" }
  ]},
  { group: 'DQL · Agregação', items: [
    { t: 'COUNT / SUM / AVG / MAX / MIN', sql: "SELECT COUNT(*) AS qtd, SUM(salario) AS folha,\n       AVG(salario) AS media, MAX(salario) AS maior, MIN(salario) AS menor\nFROM Funcionario;" },
    { t: 'GROUP BY + HAVING (livro)', sql: "SELECT id_departamento, AVG(salario) AS Media_Salarial\nFROM Funcionario\nWHERE data_admissao >= '2020-01-01'  -- filtra LINHAS\nGROUP BY id_departamento\nHAVING AVG(salario) > 3000;         -- filtra GRUPOS" },
    { t: 'Folha por departamento > 15 mil', sql: "SELECT D.nome AS setor, SUM(F.salario) AS folha\nFROM Funcionario F\nINNER JOIN Departamento D ON D.id_departamento = F.id_departamento\nGROUP BY D.nome\nHAVING SUM(F.salario) > 15000\nORDER BY folha DESC;" },
    { t: 'COUNT(*) vs COUNT(coluna)', sql: "SELECT COUNT(*) AS todas_linhas,\n       COUNT(id_departamento) AS com_departamento,\n       COUNT(id_gerente) AS com_gerente\nFROM Funcionario;" }
  ]},
  { group: 'DQL · Conjuntos', items: [
    { t: 'UNION (remove duplicatas)', sql: "SELECT nome, email FROM Cliente\nUNION\nSELECT nome, email FROM ClienteLegado;" },
    { t: 'UNION ALL (mantém duplicatas)', sql: "SELECT nome, email FROM Cliente\nUNION ALL\nSELECT nome, email FROM ClienteLegado;" },
    { t: 'INTERSECT (em ambas)', sql: "SELECT email FROM Cliente\nINTERSECT\nSELECT email FROM ClienteLegado;" },
    { t: 'EXCEPT (só na 1ª)', sql: "SELECT email FROM ClienteLegado\nEXCEPT\nSELECT email FROM Cliente;" }
  ]},
  { group: 'DQL · JOINs', items: [
    { t: 'INNER JOIN', sql: "SELECT F.nome, F.cargo, D.nome AS departamento\nFROM Funcionario F\nINNER JOIN Departamento D ON D.id_departamento = F.id_departamento;" },
    { t: 'LEFT JOIN (clientes sem pedido = NULL)', sql: "SELECT C.nome, P.data_pedido\nFROM Cliente C\nLEFT JOIN Pedido P ON C.id_cliente = P.id_cliente\nORDER BY C.nome;" },
    { t: 'RIGHT JOIN', sql: "SELECT F.nome, D.nome AS departamento\nFROM Funcionario F\nRIGHT JOIN Departamento D ON D.id_departamento = F.id_departamento;" },
    { t: 'FULL JOIN', sql: "SELECT D.nome AS departamento, F.nome AS funcionario\nFROM Departamento D\nFULL JOIN Funcionario F ON F.id_departamento = D.id_departamento;" },
    { t: 'CROSS JOIN (produto cartesiano)', sql: "SELECT COUNT(*) AS linhas_geradas\nFROM Departamento\nCROSS JOIN Produto;  -- 6 x 12 = 72" },
    { t: 'SELF JOIN (funcionário x gerente)', sql: "SELECT F.nome AS funcionario, G.nome AS gerente\nFROM Funcionario F\nLEFT JOIN Funcionario G ON G.id_funcionario = F.id_gerente;" },
    { t: 'JOIN de 4 tabelas', sql: "SELECT C.nome AS cliente, P.id_pedido, PR.nome AS produto,\n       I.quantidade, I.quantidade * I.preco_unitario AS subtotal\nFROM Cliente C\nJOIN Pedido P      ON P.id_cliente = C.id_cliente\nJOIN ItemPedido I  ON I.id_pedido  = P.id_pedido\nJOIN Produto PR    ON PR.id_produto = I.id_produto\nORDER BY P.id_pedido;" }
  ]},
  { group: 'DQL · Subconsultas', items: [
    { t: 'Simples (acima da média)', sql: "SELECT nome, salario\nFROM Funcionario\nWHERE salario > (SELECT AVG(salario) FROM Funcionario);" },
    { t: 'Correlacionada (maior salário do depto)', sql: "SELECT F.nome, F.id_departamento, F.salario\nFROM Funcionario F\nWHERE F.salario = (SELECT MAX(F2.salario)\n                   FROM Funcionario F2\n                   WHERE F2.id_departamento = F.id_departamento);" },
    { t: 'Tabela derivada no FROM', sql: "SELECT AVG(T.total) AS ticket_medio\nFROM (SELECT id_pedido, SUM(quantidade * preco_unitario) AS total\n      FROM ItemPedido\n      GROUP BY id_pedido) AS T;" },
    { t: 'EXISTS / NOT EXISTS', sql: "SELECT C.nome\nFROM Cliente C\nWHERE NOT EXISTS (SELECT 1 FROM Pedido P WHERE P.id_cliente = C.id_cliente);" },
    { t: 'IN com subconsulta', sql: "SELECT nome FROM Produto\nWHERE id_produto IN (SELECT id_produto FROM ItemPedido WHERE quantidade >= 10);" }
  ]},
  { group: 'DDL · Estrutura', items: [
    { t: 'CREATE TABLE com restrições', sql: "CREATE TABLE Fornecedor (\n    id_fornecedor  INT PRIMARY KEY IDENTITY(1,1),\n    razao_social   NVARCHAR(120) NOT NULL,\n    cnpj           CHAR(14)      NOT NULL UNIQUE,\n    limite_credito DECIMAL(10,2) CHECK (limite_credito >= 0),\n    data_cadastro  DATE DEFAULT GETDATE()\n);" },
    { t: 'ALTER TABLE ADD coluna', sql: "ALTER TABLE Cliente ADD telefone VARCHAR(20) NULL;" },
    { t: 'CREATE INDEX (prévia da Unidade III)', sql: "CREATE INDEX IX_Funcionario_Depto ON Funcionario (id_departamento);" },
    { t: 'CREATE VIEW', sql: "CREATE VIEW vw_FolhaPorDepto AS\nSELECT D.nome AS setor, SUM(F.salario) AS folha\nFROM Funcionario F\nJOIN Departamento D ON D.id_departamento = F.id_departamento\nGROUP BY D.nome;" },
    { t: 'DROP TABLE', sql: "DROP TABLE Fornecedor;" }
  ]},
  { group: 'DML · Dados', items: [
    { t: 'INSERT', sql: "INSERT INTO Cliente (nome, email, cidade, uf)\nVALUES ('Bazar Central', 'bazar@central.com', 'Sorocaba', 'SP');" },
    { t: 'UPDATE com WHERE', sql: "UPDATE Produto\nSET preco = preco * 1.05\nWHERE categoria = 'Papelaria';" },
    { t: 'DELETE com WHERE', sql: "DELETE FROM Pedido\nWHERE status = 'Cancelado';" },
    { t: 'INSERT ... SELECT', sql: "INSERT INTO Cliente (nome, email, cidade, uf)\nSELECT L.nome, L.email, L.cidade, 'XX'\nFROM ClienteLegado L\nWHERE L.email NOT IN (SELECT email FROM Cliente)\n  AND L.id_legado IN (5, 6, 7);" }
  ]},
  { group: 'DTL/TCL · Transações', items: [
    { t: 'BEGIN TRAN + ROLLBACK', sql: "BEGIN TRANSACTION;\nUPDATE Funcionario SET salario = 0;  -- desastre!\nSELECT nome, salario FROM Funcionario;\nROLLBACK;  -- desfaz tudo\nSELECT nome, salario FROM Funcionario;" },
    { t: 'BEGIN TRAN + COMMIT', sql: "BEGIN TRANSACTION;\nUPDATE Produto SET estoque = estoque - 1 WHERE id_produto = 1;\nINSERT INTO Pedido (id_cliente, data_pedido) VALUES (10, '2025-04-01');\nCOMMIT;" }
  ]},
  { group: 'DCL · Segurança', items: [
    { t: 'GRANT / REVOKE', sql: "GRANT SELECT ON Cliente TO usuario_relatorio;\nGRANT EXECUTE ON sp_PedidosDoCliente TO app_vendas;\nREVOKE SELECT ON Cliente FROM usuario_relatorio;\nsp_helprotect;" }
  ]},
  { group: 'Stored Procedures', items: [
    { t: 'EXEC sp_AtualizarSalario', sql: "EXEC sp_AtualizarSalario @id_depto = 4, @percentual = 10;\nSELECT nome, salario FROM Funcionario WHERE id_departamento = 4;" },
    { t: 'EXEC sp_PedidosDoCliente', sql: "EXEC sp_PedidosDoCliente 1;" },
    { t: 'CREATE PROCEDURE (nova)', sql: "CREATE PROCEDURE sp_ProdutosAbaixoDoEstoque\n    @minimo INT\nAS\nBEGIN\n    SELECT nome, categoria, estoque\n    FROM Produto\n    WHERE estoque < @minimo\n    ORDER BY estoque;\nEND;\n\nEXEC sp_ProdutosAbaixoDoEstoque 20;" },
    { t: 'Variáveis DECLARE / SET', sql: "DECLARE @media DECIMAL(10,2);\nSET @media = (SELECT AVG(salario) FROM Funcionario);\nPRINT @media;\nSELECT nome, salario FROM Funcionario WHERE salario > @media;" }
  ]},
  { group: 'Metadados (SSMS)', items: [
    { t: 'sp_tables', sql: "sp_tables;" },
    { t: 'sp_help Funcionario', sql: "sp_help Funcionario;" },
    { t: 'sp_stored_procedures', sql: "sp_stored_procedures;" }
  ]}
];

/* ---------------------------------------------------------------------
   3. Missões práticas (validadas automaticamente)
      kind 'query': compara o resultado com a solução.
      kind 'state': executa dentro de um SAVEPOINT e roda checks.
   --------------------------------------------------------------------- */
LAB.MISSIONS = [
  /* ---------- Aula 1 ---------- */
  { id: 'a1-1', aula: 1, level: 'Básico', title: 'Quem está sem departamento?',
    text: 'Liste <b>nome</b> e <b>cargo</b> dos funcionários que <b>não</b> estão alocados em nenhum departamento.',
    hint: 'NULL não é comparável com =. Use o operador próprio para ausência de valor.',
    solution: 'SELECT nome, cargo\nFROM Funcionario\nWHERE id_departamento IS NULL;', kind: 'query' },
  { id: 'a1-2', aula: 1, level: 'Básico', title: 'Criar a tabela Fornecedor',
    text: 'Crie a tabela <b>Fornecedor</b> com: <code>id_fornecedor</code> (PK com IDENTITY), <code>razao_social</code> NVARCHAR(120) obrigatória, <code>cnpj</code> CHAR(14) <b>único</b> e <code>limite_credito</code> DECIMAL(10,2) que <b>não pode ser negativo</b>.',
    hint: 'Restrições: PRIMARY KEY, NOT NULL, UNIQUE e CHECK (limite_credito >= 0).',
    solution: 'CREATE TABLE Fornecedor (\n    id_fornecedor  INT PRIMARY KEY IDENTITY(1,1),\n    razao_social   NVARCHAR(120) NOT NULL,\n    cnpj           CHAR(14) NOT NULL UNIQUE,\n    limite_credito DECIMAL(10,2) CHECK (limite_credito >= 0)\n);',
    kind: 'state', checks: [
      { q: "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND lower(name)='fornecedor'", expect: 1, msg: 'A tabela Fornecedor não foi criada.' },
      { tryFail: "INSERT INTO Fornecedor (razao_social, cnpj, limite_credito) VALUES ('X','12345678000199',-1)", msg: 'Um limite_credito negativo foi aceito — falta o CHECK.' },
      { tryFail: "INSERT INTO Fornecedor (razao_social, cnpj, limite_credito) VALUES ('A','11111111000111',10); INSERT INTO Fornecedor (razao_social, cnpj, limite_credito) VALUES ('B','11111111000111',10)", msg: 'Dois CNPJs iguais foram aceitos — falta o UNIQUE.' },
      { tryFail: "INSERT INTO Fornecedor (razao_social, cnpj, limite_credito) VALUES (NULL,'22222222000122',10)", msg: 'razao_social aceitou NULL — falta o NOT NULL.' }
    ] },
  { id: 'a1-3', aula: 1, level: 'Básico', title: 'Cadastrar dois clientes',
    text: 'Insira <b>dois</b> novos clientes do estado <b>MG</b> (nome, email, cidade e uf). Os e-mails precisam ser novos.',
    hint: 'Um único INSERT INTO ... VALUES (...), (...); resolve. A coluna email é UNIQUE.',
    solution: "INSERT INTO Cliente (nome, email, cidade, uf) VALUES\n ('Doceria Mineira', 'doce@mineira.com', 'Uberlândia', 'MG'),\n ('Queijaria Serra', 'queijo@serra.com', 'Juiz de Fora', 'MG');",
    kind: 'state', checks: [
      { delta: "SELECT COUNT(*) FROM Cliente WHERE uf = 'MG'", expect: 2, msg: 'Esperava exatamente 2 clientes novos com uf = MG.' }
    ] },
  { id: 'a1-4', aula: 1, level: 'Intermediário', title: 'Reajuste só para Tecnologia',
    text: 'Aplique um reajuste de <b>10%</b> no salário de todos os funcionários do departamento <b>1 (Tecnologia)</b>, sem alterar mais ninguém.',
    hint: 'UPDATE ... SET salario = salario * 1.10 WHERE ... — e cuidado: UPDATE sem WHERE altera a tabela inteira.',
    solution: 'UPDATE Funcionario\nSET salario = salario * 1.10\nWHERE id_departamento = 1;',
    kind: 'state', checks: [
      { ratio: 'SELECT SUM(salario) FROM Funcionario WHERE id_departamento = 1', expect: 1.10, msg: 'A folha do departamento 1 deveria subir exatamente 10%.' },
      { delta: 'SELECT SUM(salario) FROM Funcionario WHERE id_departamento IS NOT 1', expect: 0, msg: 'Salários de outros departamentos foram alterados.' }
    ] },
  { id: 'a1-5', aula: 1, level: 'Intermediário', title: 'Excluir pedidos cancelados',
    text: 'Exclua os pedidos com status <b>Cancelado</b>. Depois observe: o que aconteceu com os itens desses pedidos?',
    hint: 'ItemPedido tem FOREIGN KEY ... ON DELETE CASCADE para Pedido.',
    solution: "DELETE FROM Pedido\nWHERE status = 'Cancelado';",
    kind: 'state', checks: [
      { q: "SELECT COUNT(*) FROM Pedido WHERE status = 'Cancelado'", expect: 0, msg: 'Ainda existem pedidos cancelados.' },
      { delta: "SELECT COUNT(*) FROM Pedido WHERE status <> 'Cancelado'", expect: 0, msg: 'Pedidos que não estavam cancelados foram excluídos.' },
      { q: 'SELECT COUNT(*) FROM ItemPedido WHERE id_pedido NOT IN (SELECT id_pedido FROM Pedido)', expect: 0, msg: 'Ficaram itens órfãos.' }
    ], success: 'Os itens dos pedidos 6 e 12 sumiram junto: isso é o ON DELETE CASCADE em ação.' },

  /* ---------- Aula 2 ---------- */
  { id: 'a2-1', aula: 2, level: 'Básico', title: 'LIKE: nomes que começam com A',
    text: 'Liste o <b>nome</b> dos funcionários cujo nome começa com a letra <b>A</b>.',
    hint: "% representa zero ou mais caracteres.", solution: "SELECT nome\nFROM Funcionario\nWHERE nome LIKE 'A%';", kind: 'query' },
  { id: 'a2-2', aula: 2, level: 'Básico', title: 'BETWEEN: faixa salarial',
    text: 'Liste <b>nome</b> e <b>salario</b> de quem ganha entre <b>3.000 e 6.000</b> (inclusive), do maior para o menor salário.',
    hint: 'BETWEEN é inclusivo nas duas pontas. ORDER BY ... DESC.',
    solution: 'SELECT nome, salario\nFROM Funcionario\nWHERE salario BETWEEN 3000 AND 6000\nORDER BY salario DESC;', kind: 'query' },
  { id: 'a2-3', aula: 2, level: 'Básico', title: 'IN: analistas e gerentes',
    text: 'Liste <b>nome</b> e <b>cargo</b> dos funcionários com cargo <b>Analista</b> ou <b>Gerente</b>, sem usar OR.',
    hint: "IN ('...', '...')", solution: "SELECT nome, cargo\nFROM Funcionario\nWHERE cargo IN ('Analista', 'Gerente');", kind: 'query' },
  { id: 'a2-4', aula: 2, level: 'Básico', title: 'Contagem por departamento',
    text: 'Mostre <b>id_departamento</b> e a <b>quantidade</b> de funcionários de cada um (incluindo o grupo NULL).',
    hint: 'COUNT(*) com GROUP BY id_departamento.',
    solution: 'SELECT id_departamento, COUNT(*) AS quantidade\nFROM Funcionario\nGROUP BY id_departamento;', kind: 'query' },
  { id: 'a2-5', aula: 2, level: 'Intermediário', title: 'Questão UNIP: folha acima do limite',
    text: 'Exiba o <b>id_departamento</b> e o <b>total da folha</b> (SUM do salário), apenas dos departamentos cuja folha ultrapassa <b>R$ 15.000,00</b>.',
    hint: 'Filtro sobre agregação vai no HAVING, não no WHERE.',
    solution: 'SELECT id_departamento, SUM(salario) AS folha\nFROM Funcionario\nGROUP BY id_departamento\nHAVING SUM(salario) > 15000;', kind: 'query' },
  { id: 'a2-6', aula: 2, level: 'Intermediário', title: 'WHERE e HAVING juntos',
    text: 'Considerando apenas admitidos a partir de <b>2020-01-01</b>, mostre <b>id_departamento</b> e a <b>média salarial</b> dos departamentos cuja média passa de <b>4.000</b>.',
    hint: 'WHERE filtra linhas antes do agrupamento; HAVING filtra os grupos depois.',
    solution: "SELECT id_departamento, AVG(salario) AS media\nFROM Funcionario\nWHERE data_admissao >= '2020-01-01'\nGROUP BY id_departamento\nHAVING AVG(salario) > 4000;", kind: 'query' },
  { id: 'a2-7', aula: 2, level: 'Intermediário', title: 'UNION: base consolidada',
    text: 'Gere uma lista única (<b>sem duplicatas</b>) com <b>nome</b> e <b>email</b> de todos os clientes, unindo Cliente e ClienteLegado.',
    hint: 'UNION remove duplicatas; UNION ALL não.',
    solution: 'SELECT nome, email FROM Cliente\nUNION\nSELECT nome, email FROM ClienteLegado;', kind: 'query' },
  { id: 'a2-8', aula: 2, level: 'Intermediário', title: 'INTERSECT: clientes migrados',
    text: 'Liste os <b>emails</b> que existem <b>nas duas</b> bases (Cliente e ClienteLegado).',
    hint: 'INTERSECT retorna o que aparece em ambas as consultas.',
    solution: 'SELECT email FROM Cliente\nINTERSECT\nSELECT email FROM ClienteLegado;', kind: 'query' },
  { id: 'a2-9', aula: 2, level: 'Intermediário', title: 'EXCEPT: quem não migrou',
    text: 'Liste os <b>emails</b> da base legada que <b>ainda não</b> existem em Cliente.',
    hint: 'A ordem das consultas importa no EXCEPT.',
    solution: 'SELECT email FROM ClienteLegado\nEXCEPT\nSELECT email FROM Cliente;', kind: 'query' },
  { id: 'a2-10', aula: 2, level: 'Avançado', title: 'Produto mais caro por categoria',
    text: 'Para cada <b>categoria</b>, mostre o <b>maior preço</b> e a <b>quantidade de produtos</b>, ordenado pela categoria.',
    hint: 'MAX(preco), COUNT(*), GROUP BY categoria, ORDER BY categoria.',
    solution: 'SELECT categoria, MAX(preco) AS maior_preco, COUNT(*) AS qtd\nFROM Produto\nGROUP BY categoria\nORDER BY categoria;', kind: 'query' },

  /* ---------- Aula 3 ---------- */
  { id: 'a3-1', aula: 3, level: 'Básico', title: 'INNER JOIN: funcionário e setor',
    text: 'Liste o <b>nome do funcionário</b> e o <b>nome do departamento</b> em que trabalha (só quem tem departamento).',
    hint: 'INNER JOIN ... ON D.id_departamento = F.id_departamento',
    solution: 'SELECT F.nome, D.nome AS departamento\nFROM Funcionario F\nINNER JOIN Departamento D ON D.id_departamento = F.id_departamento;', kind: 'query' },
  { id: 'a3-2', aula: 3, level: 'Intermediário', title: 'Questão UNIP: departamentos vazios',
    text: 'Liste o <b>nome</b> dos departamentos que <b>não possuem nenhum</b> funcionário alocado.',
    hint: 'LEFT JOIN com Departamento à esquerda, depois filtre o lado direito por IS NULL.',
    solution: 'SELECT D.nome\nFROM Departamento D\nLEFT JOIN Funcionario F ON F.id_departamento = D.id_departamento\nWHERE F.id_funcionario IS NULL;', kind: 'query' },
  { id: 'a3-3', aula: 3, level: 'Intermediário', title: 'Clientes que nunca compraram',
    text: 'Liste o <b>nome</b> dos clientes que <b>nunca</b> fizeram pedido.',
    hint: 'LEFT JOIN + IS NULL, ou NOT EXISTS.',
    solution: 'SELECT C.nome\nFROM Cliente C\nLEFT JOIN Pedido P ON P.id_cliente = C.id_cliente\nWHERE P.id_pedido IS NULL;', kind: 'query' },
  { id: 'a3-4', aula: 3, level: 'Intermediário', title: 'FULL JOIN: o quadro completo',
    text: 'Mostre <b>nome do departamento</b> e <b>nome do funcionário</b>, trazendo inclusive departamentos sem funcionários e funcionários sem departamento.',
    hint: 'FULL JOIN preserva os dois lados.',
    solution: 'SELECT D.nome AS departamento, F.nome AS funcionario\nFROM Departamento D\nFULL JOIN Funcionario F ON F.id_departamento = D.id_departamento;', kind: 'query' },
  { id: 'a3-5', aula: 3, level: 'Intermediário', title: 'Valor total de cada pedido',
    text: 'Mostre <b>id_pedido</b>, <b>nome do cliente</b> e o <b>total</b> do pedido (quantidade × preço unitário), do maior para o menor total.',
    hint: 'JOIN de Pedido, Cliente e ItemPedido + SUM + GROUP BY.',
    solution: 'SELECT P.id_pedido, C.nome, SUM(I.quantidade * I.preco_unitario) AS total\nFROM Pedido P\nJOIN Cliente C ON C.id_cliente = P.id_cliente\nJOIN ItemPedido I ON I.id_pedido = P.id_pedido\nGROUP BY P.id_pedido, C.nome\nORDER BY total DESC;', kind: 'query' },
  { id: 'a3-6', aula: 3, level: 'Intermediário', title: 'Subconsulta: acima da média',
    text: 'Liste <b>nome</b> e <b>salario</b> de quem ganha <b>acima da média</b> geral da empresa.',
    hint: 'WHERE salario > (SELECT AVG(salario) FROM ...)',
    solution: 'SELECT nome, salario\nFROM Funcionario\nWHERE salario > (SELECT AVG(salario) FROM Funcionario);', kind: 'query' },
  { id: 'a3-7', aula: 3, level: 'Avançado', title: 'Correlacionada: o maior de cada setor',
    text: 'Liste <b>nome</b>, <b>id_departamento</b> e <b>salario</b> do funcionário que tem o <b>maior salário dentro do seu departamento</b>.',
    hint: 'A subconsulta interna referencia o departamento da linha externa (F2.id_departamento = F.id_departamento).',
    solution: 'SELECT F.nome, F.id_departamento, F.salario\nFROM Funcionario F\nWHERE F.salario = (SELECT MAX(F2.salario) FROM Funcionario F2\n                   WHERE F2.id_departamento = F.id_departamento);', kind: 'query' },
  { id: 'a3-8', aula: 3, level: 'Avançado', title: 'Tabela derivada: ticket médio',
    text: 'Calcule o <b>ticket médio</b> dos pedidos: a média dos totais de cada pedido. Retorne uma única coluna.',
    hint: 'Primeiro calcule o total por pedido numa subconsulta no FROM (com alias), depois tire o AVG.',
    solution: 'SELECT AVG(T.total) AS ticket_medio\nFROM (SELECT id_pedido, SUM(quantidade * preco_unitario) AS total\n      FROM ItemPedido GROUP BY id_pedido) AS T;', kind: 'query' },
  { id: 'a3-9', aula: 3, level: 'Avançado', title: 'Self join: quem é o gestor?',
    text: 'Liste o <b>nome do funcionário</b> e o <b>nome do seu gerente</b>, apenas para quem tem gerente.',
    hint: 'A mesma tabela aparece duas vezes, com aliases diferentes.',
    solution: 'SELECT F.nome AS funcionario, G.nome AS gerente\nFROM Funcionario F\nJOIN Funcionario G ON G.id_funcionario = F.id_gerente;', kind: 'query' },
  { id: 'a3-10', aula: 3, level: 'Avançado', title: 'Criar uma Stored Procedure',
    text: 'Crie a procedure <b>sp_ClientesPorUF</b> com o parâmetro <code>@uf</code>, que retorna <b>nome</b> e <b>cidade</b> dos clientes daquele estado. Em seguida execute-a para <b>SP</b>.',
    hint: "CREATE PROCEDURE sp_ClientesPorUF @uf CHAR(2) AS BEGIN ... END; depois EXEC sp_ClientesPorUF 'SP';",
    solution: "CREATE PROCEDURE sp_ClientesPorUF\n    @uf CHAR(2)\nAS\nBEGIN\n    SELECT nome, cidade FROM Cliente WHERE uf = @uf;\nEND;\n\nEXEC sp_ClientesPorUF 'SP';",
    kind: 'proc', proc: 'sp_ClientesPorUF', procArgs: "'RJ'", expectSql: "SELECT nome, cidade FROM Cliente WHERE uf = 'RJ'" },
  { id: 'a3-11', aula: 3, level: 'Básico', title: 'O tamanho do CROSS JOIN',
    text: 'Usando CROSS JOIN entre <b>Departamento</b> e <b>Produto</b>, retorne apenas a <b>quantidade de linhas</b> geradas.',
    hint: 'SELECT COUNT(*) FROM A CROSS JOIN B',
    solution: 'SELECT COUNT(*) AS linhas\nFROM Departamento\nCROSS JOIN Produto;', kind: 'query' },

  /* ---------- Aula 4 / transações ---------- */
  { id: 'a4-1', aula: 4, level: 'Intermediário', title: 'Transação desfeita',
    text: 'Abra uma transação, zere o <b>estoque</b> de todos os produtos, confira com um SELECT e desfaça tudo com <b>ROLLBACK</b>. Ao final, nenhum estoque deve ter mudado.',
    hint: 'BEGIN TRANSACTION; UPDATE ...; SELECT ...; ROLLBACK;',
    solution: 'BEGIN TRANSACTION;\nUPDATE Produto SET estoque = 0;\nSELECT nome, estoque FROM Produto;\nROLLBACK;',
    kind: 'state', requireText: /rollback/i, checks: [
      { delta: 'SELECT SUM(estoque) FROM Produto', expect: 0, msg: 'O estoque mudou: a transação não foi desfeita.' }
    ] }
];

/* ---------------------------------------------------------------------
   4. Laboratório de Bugs: erro clássico → sintoma → causa → correção
   --------------------------------------------------------------------- */
LAB.BUGS = [
  { title: 'UPDATE sem WHERE', tag: 'DML', sev: 'crítico',
    bug: "UPDATE Funcionario SET salario = 5000;",
    symptom: 'Todos os funcionários passam a ganhar 5.000. A armadilha clássica de prova.',
    why: 'Sem WHERE, o UPDATE atinge todas as linhas da tabela. O SQL Server não pede confirmação.',
    fix: "BEGIN TRANSACTION;\nUPDATE Funcionario SET salario = 5000\nWHERE id_funcionario = 4;\nSELECT nome, salario FROM Funcionario WHERE id_funcionario = 4;\nCOMMIT;",
    practice: 'Escreva o WHERE primeiro, teste com um SELECT usando o mesmo filtro e envolva alterações em uma transação.' },
  { title: 'Comparar com = NULL', tag: 'DQL', sev: 'alto',
    bug: "SELECT nome FROM Funcionario WHERE id_departamento = NULL;",
    symptom: 'Nenhuma linha retorna, mesmo existindo funcionário sem departamento. Não há erro, o que torna o bug silencioso.',
    why: 'NULL significa valor desconhecido. Qualquer comparação com NULL resulta em UNKNOWN, nunca em TRUE.',
    fix: "SELECT nome FROM Funcionario WHERE id_departamento IS NULL;",
    practice: 'Use sempre IS NULL / IS NOT NULL.' },
  { title: 'Agregação no WHERE', tag: 'DQL', sev: 'alto',
    bug: "SELECT id_departamento, SUM(salario)\nFROM Funcionario\nWHERE SUM(salario) > 15000\nGROUP BY id_departamento;",
    symptom: 'Erro: uma agregação não pode aparecer na cláusula WHERE (Msg 147 no SQL Server).',
    why: 'O WHERE roda antes do GROUP BY, quando os grupos ainda não existem.',
    fix: "SELECT id_departamento, SUM(salario) AS folha\nFROM Funcionario\nGROUP BY id_departamento\nHAVING SUM(salario) > 15000;",
    practice: 'Filtro sobre linha → WHERE. Filtro sobre função agregada → HAVING.' },
  { title: 'Coluna fora do GROUP BY', tag: 'DQL', sev: 'alto',
    bug: "SELECT id_departamento, nome, AVG(salario)\nFROM Funcionario\nGROUP BY id_departamento;",
    symptom: 'Erro Msg 8120: a coluna nome é inválida na lista de seleção.',
    why: 'Cada grupo tem vários nomes. O SQL Server não sabe qual escolher. (Alguns SGBDs, como SQLite e MySQL antigo, escolhem um ao acaso; o simulador bloqueia como o SQL Server.)',
    fix: "SELECT id_departamento, COUNT(nome) AS qtd, AVG(salario) AS media\nFROM Funcionario\nGROUP BY id_departamento;",
    practice: 'Toda coluna não agregada do SELECT precisa estar no GROUP BY.' },
  { title: 'Registro órfão (violação de FK)', tag: 'DML', sev: 'médio',
    bug: "INSERT INTO Pedido (id_cliente, data_pedido) VALUES (999, '2025-05-01');",
    symptom: 'Erro Msg 547: conflito com a restrição FOREIGN KEY.',
    why: 'Não existe Cliente com id 999. A FK protege a integridade referencial.',
    fix: "INSERT INTO Pedido (id_cliente, data_pedido) VALUES (12, '2025-05-01');",
    practice: 'Insira primeiro o registro pai. Em scripts, crie e popule as tabelas pai antes das filhas.' },
  { title: 'Excluir pai com filhos (NO ACTION)', tag: 'DML', sev: 'médio',
    bug: "DELETE FROM Produto WHERE id_produto = 1;",
    symptom: 'Erro de FK: o produto 1 aparece em ItemPedido, cuja regra é ON DELETE NO ACTION.',
    why: 'NO ACTION/RESTRICT impede a exclusão do pai enquanto houver filhos vinculados.',
    fix: "-- Produto sem vendas pode ser excluído:\nDELETE FROM Produto WHERE id_produto = 7;",
    practice: 'Escolha a regra de cascata conscientemente: CASCADE apaga filhos, SET NULL desvincula, NO ACTION bloqueia.' },
  { title: 'FLOAT para dinheiro', tag: 'DDL', sev: 'médio',
    bug: "SELECT CASE WHEN CAST(0.1 AS FLOAT) + CAST(0.2 AS FLOAT) = 0.3\n            THEN 'igual' ELSE 'DIFERENTE' END AS teste_float;",
    symptom: '0,1 + 0,2 em FLOAT não é igual a 0,3: internamente vale 0,30000000000000004.',
    why: 'FLOAT é ponto flutuante binário (precisão aproximada). Somatórios financeiros acumulam o erro.',
    fix: "SELECT ROUND(0.1 + 0.2, 2) AS soma_exibida;\n-- No SQL Server real: DECIMAL(10,2) guarda o valor exato.",
    practice: 'Use DECIMAL(p,s)/NUMERIC para valores monetários. Observação: o simulador usa SQLite, que guarda DECIMAL como número real; no SQL Server o DECIMAL é exato.' },
  { title: 'Produto cartesiano acidental', tag: 'DQL', sev: 'alto',
    bug: "SELECT F.nome, D.nome\nFROM Funcionario F, Departamento D;",
    symptom: '96 linhas (16 × 6) em vez de 15. Cada funcionário aparece em todos os departamentos.',
    why: 'Junção no estilo antigo (vírgula) sem condição vira CROSS JOIN.',
    fix: "SELECT F.nome, D.nome AS departamento\nFROM Funcionario F\nINNER JOIN Departamento D ON D.id_departamento = F.id_departamento;",
    practice: 'Prefira a sintaxe ANSI explícita (JOIN ... ON). Fica impossível esquecer a condição.' },
  { title: 'UNION com colunas incompatíveis', tag: 'DQL', sev: 'baixo',
    bug: "SELECT nome, email FROM Cliente\nUNION\nSELECT nome FROM ClienteLegado;",
    symptom: 'Erro Msg 205: as consultas devem ter o mesmo número de colunas.',
    why: 'Operações de conjunto exigem estruturas compatíveis (mesmo número e tipos de colunas, na mesma ordem).',
    fix: "SELECT nome, email FROM Cliente\nUNION\nSELECT nome, email FROM ClienteLegado;",
    practice: 'Alinhe as colunas e use aliases da primeira consulta para nomear o resultado.' },
  { title: 'NOT IN com NULL na subconsulta', tag: 'DQL', sev: 'alto',
    bug: "SELECT nome FROM Departamento\nWHERE id_departamento NOT IN (SELECT id_departamento FROM Funcionario);",
    symptom: 'Retorna zero linhas, embora o Jurídico não tenha funcionários.',
    why: 'Um funcionário tem id_departamento NULL. "x NOT IN (..., NULL)" nunca é TRUE.',
    fix: "SELECT D.nome FROM Departamento D\nWHERE NOT EXISTS (SELECT 1 FROM Funcionario F\n                  WHERE F.id_departamento = D.id_departamento);",
    practice: 'Prefira NOT EXISTS, ou filtre IS NOT NULL dentro da subconsulta.' },
  { title: 'HAVING usado como WHERE', tag: 'DQL', sev: 'baixo',
    bug: "SELECT categoria, COUNT(*) AS qtd\nFROM Produto\nGROUP BY categoria\nHAVING categoria <> 'Áudio';",
    symptom: 'Funciona, mas agrupa linhas que depois serão descartadas.',
    why: 'Condição sobre coluna comum deve filtrar antes do agrupamento: menos trabalho para o servidor.',
    fix: "SELECT categoria, COUNT(*) AS qtd\nFROM Produto\nWHERE categoria <> 'Áudio'\nGROUP BY categoria;",
    practice: 'HAVING é para condições com agregação.' },
  { title: 'Violação de UNIQUE', tag: 'DML', sev: 'baixo',
    bug: "INSERT INTO Cliente (nome, email, uf) VALUES ('Duplicado', 'vida@farma.com', 'SP');",
    symptom: 'Erro Msg 2627: violação de restrição UNIQUE KEY.',
    why: 'O e-mail já pertence à Farmácia Vida.',
    fix: "SELECT id_cliente, nome FROM Cliente WHERE email = 'vida@farma.com';",
    practice: 'Verifique a existência antes de inserir, ou trate o erro na aplicação/procedure.' }
];

/* ---------------------------------------------------------------------
   5. Quiz (questões no estilo das provas UNIP)
   --------------------------------------------------------------------- */
LAB.QUIZ = [
  { q: 'Durante a implementação de uma tabela de Funcionários, é preciso garantir que não existam salários negativos e que cada e-mail seja exclusivo. Quais restrições devem ser aplicadas, respectivamente?',
    o: ['FOREIGN KEY e PRIMARY KEY', 'CHECK e UNIQUE', 'DEFAULT e CHECK', 'UNIQUE e NOT NULL', 'PRIMARY KEY e CHECK'], a: 1,
    e: 'CHECK valida uma condição lógica (salario >= 0). UNIQUE garante valores distintos sem ser a chave primária.', src: 'Aula 1' },
  { q: 'Qual a estrutura correta para exibir o total da folha por setor, apenas dos setores cujo somatório ultrapasse R$ 50.000,00?',
    o: ['... WHERE SUM(Salario) > 50000 GROUP BY Setor', '... GROUP BY Setor HAVING SUM(Salario) > 50000', '... HAVING Salario > 50000 GROUP BY Setor', 'SELECT Setor, Salario ... WHERE Salario > 50000 GROUP BY Setor'], a: 1,
    e: 'Condições sobre funções de agregação vão no HAVING, depois do GROUP BY.', src: 'Aula 2' },
  { q: 'Qual JOIN lista TODOS os departamentos, inclusive os que não possuem funcionários?',
    o: ['INNER JOIN', 'CROSS JOIN', 'LEFT JOIN com Departamento à esquerda', 'RIGHT JOIN com Funcionario à esquerda'], a: 2,
    e: 'O LEFT JOIN preserva todas as linhas da tabela da esquerda e completa a direita com NULL.', src: 'Aula 3' },
  { q: 'Um DBA precisa levar tabelas, chaves e procedures da produção para testes, sem os dados reais dos clientes. Qual o procedimento mais adequado no SSMS?',
    o: ['Backup completo (.bak) e restore', 'Exportar scripts de esquema (DDL)', 'Copiar os arquivos .mdf e .ldf', 'CROSS JOIN entre servidores'], a: 1,
    e: 'O script de esquema contém só o DDL (estrutura), sem os dados: atende à privacidade.', src: 'Aula 4' },
  { q: 'GRANT e REVOKE pertencem a qual subconjunto da SQL?',
    o: ['DDL', 'DML', 'DCL', 'DTL/TCL'], a: 2, e: 'DCL (Data Control Language) gerencia permissões de acesso.', src: 'Aula 1' },
  { q: 'Por que usar DECIMAL(10,2) em vez de FLOAT para valores monetários?',
    o: ['DECIMAL ocupa menos espaço sempre', 'FLOAT não aceita casas decimais', 'DECIMAL tem precisão exata; FLOAT é aproximado', 'FLOAT não pode ser indexado'], a: 2,
    e: 'FLOAT usa ponto flutuante binário e gera erros de arredondamento em somatórios.', src: 'Checklist' },
  { q: 'Qual a diferença prática entre UNION e UNION ALL?',
    o: ['UNION ALL remove duplicatas', 'UNION remove duplicatas; UNION ALL mantém e é mais rápido', 'Não há diferença', 'UNION só funciona com duas tabelas iguais'], a: 1,
    e: 'UNION faz uma etapa extra de deduplicação; UNION ALL apenas concatena.', src: 'Aula 2' },
  { q: 'O que retorna WHERE coluna = NULL?',
    o: ['As linhas com NULL', 'Um erro de sintaxe', 'Nenhuma linha (a comparação é UNKNOWN)', 'Todas as linhas'], a: 2,
    e: 'Comparações com NULL não resultam em TRUE. Use IS NULL.', src: 'Aula 1' },
  { q: 'Uma tabela A tem 1.000 linhas e B tem 1.000 linhas. Quantas linhas o CROSS JOIN gera?',
    o: ['1.000', '2.000', '1.000.000', 'Depende da chave'], a: 2, e: 'Produto cartesiano: N × M.', src: 'Aula 3' },
  { q: 'Qual característica define uma subconsulta correlacionada?',
    o: ['Fica no FROM', 'Executa uma única vez', 'Referencia colunas da consulta externa e é reavaliada linha a linha', 'Só pode retornar uma linha'], a: 2,
    e: 'Por depender da linha externa, pode custar caro em tabelas grandes; muitas vezes um JOIN é melhor.', src: 'Aula 3' },
  { q: 'Qual NÃO é uma vantagem de Stored Procedures?',
    o: ['Reutilização do plano de execução', 'Controle de segurança via GRANT EXECUTE', 'Centralização de regras de negócio', 'Dispensar índices nas tabelas'], a: 3,
    e: 'Procedures não substituem índices. As outras três são vantagens citadas no livro-texto.', src: 'Aula 3' },
  { q: 'Qual a ordem LÓGICA de processamento de um SELECT?',
    o: ['SELECT → FROM → WHERE → GROUP BY', 'FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY', 'WHERE → FROM → SELECT → HAVING', 'FROM → SELECT → WHERE → ORDER BY'], a: 1,
    e: 'Por isso um alias criado no SELECT pode ser usado no ORDER BY, mas não no WHERE.', src: 'Aula 2' },
  { q: 'Qual ferramenta oferece Notebooks (SQL + Markdown + gráficos) e é multiplataforma?',
    o: ['SSMS', 'Azure Data Studio', 'SQL Server Profiler', 'Excel'], a: 1, e: 'O SSMS é focado em administração e é exclusivo do Windows.', src: 'Aula 4' },
  { q: 'Ao importar um script de esquema, por que as tabelas pai devem ser criadas antes das filhas?',
    o: ['Por ordem alfabética', 'Porque a FOREIGN KEY da filha referencia a PK do pai, que precisa existir', 'Para economizar espaço', 'Não importa a ordem'], a: 1,
    e: 'É o desafio de "ordem de dependência" citado na Aula 4.', src: 'Aula 4' },
  { q: 'ON DELETE SET NULL em uma FK significa que, ao excluir o pai:',
    o: ['Os filhos são excluídos', 'A exclusão é bloqueada', 'A FK dos filhos passa a NULL', 'O pai recebe NULL'], a: 2, e: 'Os filhos continuam existindo, mas desvinculados.', src: 'Aula 1' },
  { q: 'TRUNCATE TABLE, ALTER TABLE e DROP TABLE pertencem a:',
    o: ['DML', 'DDL', 'DQL', 'DCL'], a: 1, e: 'Todos alteram estrutura/objetos. TRUNCATE é classificado como DDL no SQL Server.', src: 'Aula 1' }
];

/* ---------------------------------------------------------------------
   6. Dicionário de explicações por comando / cláusula
   --------------------------------------------------------------------- */
LAB.CLAUSES = {
  SELECT:   { does: 'Projeta as colunas e expressões que aparecem no resultado.', not: 'Não altera nenhum dado nem estrutura.' },
  DISTINCT: { does: 'Remove linhas duplicadas do resultado.', not: 'Não remove duplicatas da tabela; só do resultado exibido.' },
  TOP:      { does: 'Limita o número de linhas retornadas (sintaxe T-SQL).', not: 'Sem ORDER BY, não garante quais linhas virão.' },
  WHERE:    { does: 'Filtra linhas individuais antes de qualquer agrupamento.', not: 'Não aceita funções agregadas (SUM, AVG, COUNT...).' },
  'GROUP BY': { does: 'Agrupa linhas com o mesmo valor para que as funções agregadas calculem por grupo.', not: 'Não ordena o resultado (use ORDER BY).' },
  HAVING:   { does: 'Filtra os grupos já formados, normalmente usando agregações.', not: 'Não deve substituir o WHERE para condições de linha.' },
  'ORDER BY': { does: 'Ordena o resultado final.', not: 'Não altera a ordem física de armazenamento.' },
  LIKE:     { does: "Busca padrões em texto: % = zero ou mais caracteres; _ = exatamente um.", not: "Curinga no início ('%x') impede o uso eficiente de índice (tema da Unidade III)." },
  BETWEEN:  { does: 'Filtra um intervalo inclusivo: mínimo e máximo entram no resultado.', not: 'Não inverte limites: BETWEEN 10 AND 1 retorna vazio.' },
  IN:       { does: 'Testa se o valor pertence a uma lista ou ao resultado de uma subconsulta.', not: 'NOT IN com NULL na lista nunca retorna TRUE.' },
  'INNER JOIN': { does: 'Retorna só as linhas com correspondência nas duas tabelas (A ∩ B).', not: 'Não traz registros sem par: eles somem do resultado.' },
  'LEFT JOIN':  { does: 'Mantém todas as linhas da esquerda; sem par, a direita vem NULL.', not: 'Não preserva linhas da direita sem correspondência.' },
  'RIGHT JOIN': { does: 'Mantém todas as linhas da direita; sem par, a esquerda vem NULL.', not: 'Não preserva linhas da esquerda sem correspondência.' },
  'FULL JOIN':  { does: 'Mantém todas as linhas dos dois lados, completando com NULL onde não há par (A ∪ B).', not: 'Não elimina duplicatas: é uma junção, não uma união de conjuntos.' },
  'CROSS JOIN': { does: 'Gera o produto cartesiano: cada linha de A com todas as linhas de B (N × M).', not: 'Não usa condição ON.' },
  UNION:      { does: 'Empilha os resultados de dois SELECTs e remove duplicatas.', not: 'Não junta colunas lado a lado (isso é JOIN).' },
  'UNION ALL':{ does: 'Empilha os resultados mantendo todas as duplicatas; mais rápido.', not: 'Não deduplica.' },
  INTERSECT:  { does: 'Retorna apenas as linhas presentes nos dois resultados.', not: 'Não exige chave: compara a linha inteira.' },
  EXCEPT:     { does: 'Retorna as linhas da 1ª consulta que não aparecem na 2ª.', not: 'Não é simétrico: A EXCEPT B ≠ B EXCEPT A.' },
  'IS NULL':  { does: 'Testa ausência de valor corretamente.', not: '' },
  EXISTS:     { does: 'Retorna TRUE se a subconsulta devolver pelo menos uma linha.', not: 'Não usa os valores retornados, só a existência.' },
  CASE:       { does: 'Cria lógica condicional dentro da consulta (if/else por linha).', not: '' },
  AS:         { does: 'Cria apelidos (alias) de colunas ou tabelas.', not: 'Alias de coluna não pode ser usado no WHERE (ele é processado antes do SELECT).' }
};

LAB.STATEMENTS = {
  'CREATE TABLE':  { cat: 'DDL', does: 'Cria uma nova tabela física com colunas, tipos e restrições.', not: 'Não insere dados.' },
  'CREATE VIEW':   { cat: 'DDL', does: 'Cria uma consulta salva que se comporta como tabela virtual.', not: 'Não copia os dados; a view é recalculada a cada uso.' },
  'CREATE INDEX':  { cat: 'DDL', does: 'Cria uma estrutura auxiliar para acelerar buscas (Unidade III).', not: 'Não muda o resultado das consultas, só o caminho de acesso.' },
  'CREATE PROCEDURE': { cat: 'DDL', does: 'Armazena um bloco T-SQL parametrizado no servidor.', not: 'Não executa o bloco: para isso use EXEC.' },
  'ALTER TABLE':   { cat: 'DDL', does: 'Modifica a estrutura de uma tabela existente.', not: 'Não altera os dados já gravados (exceto ao remover colunas).' },
  'DROP':          { cat: 'DDL', does: 'Remove o objeto e, no caso de tabela, todos os seus dados.', not: 'Não pode ser desfeito fora de uma transação.' },
  'TRUNCATE':      { cat: 'DDL', does: 'Remove todas as linhas da tabela rapidamente.', not: 'Não aceita WHERE e não dispara triggers de DELETE.' },
  'INSERT':        { cat: 'DML', does: 'Adiciona novas linhas a uma tabela.', not: 'Não altera linhas existentes.' },
  'UPDATE':        { cat: 'DML', does: 'Altera valores de linhas existentes.', not: 'Não cria linhas novas. Sem WHERE, altera TODAS.' },
  'DELETE':        { cat: 'DML', does: 'Remove linhas de uma tabela.', not: 'Não remove a tabela (isso é DROP). Sem WHERE, apaga TODAS as linhas.' },
  'SELECT':        { cat: 'DQL', does: 'Consulta e extrai dados.', not: 'Não altera dados nem estrutura.' },
  'GRANT':         { cat: 'DCL', does: 'Concede permissão a um usuário ou papel.', not: '' },
  'REVOKE':        { cat: 'DCL', does: 'Remove uma permissão concedida anteriormente.', not: '' },
  'DENY':          { cat: 'DCL', does: 'Nega explicitamente uma permissão (prevalece sobre GRANT).', not: '' },
  'BEGIN TRANSACTION': { cat: 'TCL', does: 'Abre uma transação: as alterações seguintes só ficam definitivas com COMMIT.', not: '' },
  'COMMIT':        { cat: 'TCL', does: 'Confirma as alterações da transação.', not: 'Não pode ser desfeito depois.' },
  'ROLLBACK':      { cat: 'TCL', does: 'Desfaz as alterações até o início da transação.', not: 'Não desfaz o que já sofreu COMMIT.' },
  'EXEC':          { cat: 'PROC', does: 'Executa uma stored procedure, passando parâmetros.', not: '' },
  'DECLARE':       { cat: 'T-SQL', does: 'Declara uma variável local (@nome) da sessão.', not: '' },
  'SET':           { cat: 'T-SQL', does: 'Atribui valor a uma variável.', not: '' },
  'PRINT':         { cat: 'T-SQL', does: 'Exibe uma mensagem na aba Mensagens.', not: '' }
};

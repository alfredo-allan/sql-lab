-- Para SQL Server (ex.: container Docker mcr.microsoft.com/mssql/server).
-- No DBeaver: conecte no servidor, abra este arquivo no editor SQL e use "Executar script" (Alt+X).
IF DB_ID('LabUnidade2') IS NULL CREATE DATABASE LabUnidade2;
GO
USE LabUnidade2;
GO

/* ==========================================================
   Script gerado pelo SQL Lab · Unidade II   (17/10/2026, 16:47:45)
   Conteúdo: esquema (DDL) + dados (DML)
   Ordem: tabelas PAI antes das tabelas FILHAS (dependência de FK)
   ========================================================== */

/****** Objeto: Table [dbo].[Cliente]  · ordem 1 ******/
CREATE TABLE Cliente (
    id_cliente    INT IDENTITY(1,1) PRIMARY KEY,
    nome          NVARCHAR(100) NOT NULL,
    email         VARCHAR(150)  NOT NULL UNIQUE,
    cidade        NVARCHAR(60),
    uf            CHAR(2)       CHECK (LEN(uf) = 2),
    data_cadastro DATE          DEFAULT GETDATE()
);
GO

/****** Objeto: Table [dbo].[ClienteLegado]  · ordem 2 ******/
CREATE TABLE ClienteLegado (
    id_legado INT IDENTITY(1,1) PRIMARY KEY,
    nome      NVARCHAR(100) NOT NULL,
    email     VARCHAR(150)  NOT NULL,
    cidade    NVARCHAR(60)
);
GO

/****** Objeto: Table [dbo].[Departamento]  · ordem 3 ******/
CREATE TABLE Departamento (
    id_departamento INT IDENTITY(1,1) PRIMARY KEY,
    nome            NVARCHAR(60)  NOT NULL UNIQUE,
    localizacao     NVARCHAR(60)  NULL,
    orcamento       DECIMAL(12,2) CHECK (orcamento >= 0)
);
GO

/****** Objeto: Table [dbo].[Funcionario]  · ordem 4 · depende de: Departamento ******/
CREATE TABLE Funcionario (
    id_funcionario  INT IDENTITY(1,1) PRIMARY KEY,
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
GO

/****** Objeto: Table [dbo].[Produto]  · ordem 5 ******/
CREATE TABLE Produto (
    id_produto INT IDENTITY(1,1) PRIMARY KEY,
    nome       NVARCHAR(80)  NOT NULL,
    categoria  NVARCHAR(40)  NOT NULL,
    preco      DECIMAL(10,2) NOT NULL CHECK (preco > 0),
    estoque    INT           NOT NULL DEFAULT 0 CHECK (estoque >= 0)
);
GO

/****** Objeto: Table [dbo].[Pedido]  · ordem 6 · depende de: Cliente ******/
CREATE TABLE Pedido (
    id_pedido   INT IDENTITY(1,1) PRIMARY KEY,
    id_cliente  INT NOT NULL,
    data_pedido DATE NOT NULL,
    status      NVARCHAR(20) NOT NULL DEFAULT 'Aberto'
                CHECK (status IN ('Aberto','Pago','Enviado','Entregue','Cancelado')),
    FOREIGN KEY (id_cliente) REFERENCES Cliente(id_cliente) ON DELETE CASCADE
);
GO

/****** Objeto: Table [dbo].[ItemPedido]  · ordem 7 · depende de: Produto, Pedido ******/
CREATE TABLE ItemPedido (
    id_pedido      INT NOT NULL,
    id_produto     INT NOT NULL,
    quantidade     INT NOT NULL CHECK (quantidade > 0),
    preco_unitario DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id_pedido, id_produto),
    FOREIGN KEY (id_pedido)  REFERENCES Pedido(id_pedido)   ON DELETE CASCADE,
    FOREIGN KEY (id_produto) REFERENCES Produto(id_produto) ON DELETE NO ACTION
);
GO

/****** Objeto: StoredProcedure [dbo].[sp_AtualizarSalario] ******/
CREATE PROCEDURE sp_AtualizarSalario
    @id_depto INT,
    @percentual DECIMAL(5,2)
AS
BEGIN
    UPDATE Funcionario
    SET salario = salario * (1 + @percentual / 100)
    WHERE id_departamento = @id_depto;
END;
GO

/****** Objeto: StoredProcedure [dbo].[sp_PedidosDoCliente] ******/
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
GO

/* ======================= DADOS ======================= */

SET IDENTITY_INSERT [dbo].[Cliente] ON;
INSERT INTO Cliente (id_cliente, nome, email, cidade, uf, data_cadastro) VALUES
 (1, 'Mercado Bom Preço', 'contato@bompreco.com', 'São Paulo', 'SP', '2021-01-10'),
 (2, 'Padaria Pão Quente', 'pao@quente.com', 'Campinas', 'SP', '2021-03-22'),
 (3, 'Tech Soluções ME', 'ti@techsol.com', 'Belo Horizonte', 'MG', '2021-06-05'),
 (4, 'Ótica Visão Clara', 'visao@clara.com', 'Rio de Janeiro', 'RJ', '2022-02-18'),
 (5, 'Farmácia Vida', 'vida@farma.com', 'São Paulo', 'SP', '2022-05-30'),
 (6, 'Livraria Saber', 'saber@livros.com', 'Curitiba', 'PR', '2022-08-12'),
 (7, 'Academia Força', 'forca@academia.com', 'Santos', 'SP', '2023-01-09'),
 (8, 'Pet Shop Amigo', 'amigo@pet.com', 'Niterói', 'RJ', '2023-04-17'),
 (9, 'Construtora Alicerce', 'obra@alicerce.com', 'Salvador', 'BA', '2023-07-21'),
 (10, 'Café Aroma', 'aroma@cafe.com', 'São Paulo', 'SP', '2024-02-02'),
 (11, 'Escola Aprender', 'sec@aprender.edu', 'Recife', 'PE', '2024-05-14'),
 (12, 'Ateliê Arte Viva', 'arte@viva.com', 'Florianópolis', 'SC', '2024-09-03');
SET IDENTITY_INSERT [dbo].[Cliente] OFF;
GO

SET IDENTITY_INSERT [dbo].[ClienteLegado] ON;
INSERT INTO ClienteLegado (id_legado, nome, email, cidade) VALUES
 (1, 'Mercado Bom Preço', 'contato@bompreco.com', 'São Paulo'),
 (2, 'Tech Soluções ME', 'ti@techsol.com', 'Belo Horizonte'),
 (3, 'Farmácia Vida', 'vida@farma.com', 'São Paulo'),
 (4, 'Café Aroma', 'aroma@cafe.com', 'São Paulo'),
 (5, 'Gráfica Rápida', 'grafica@rapida.com', 'Goiânia'),
 (6, 'Sorveteria Polar', 'polar@sorvete.com', 'Fortaleza'),
 (7, 'Oficina do Zé', 'ze@oficina.com', 'Porto Alegre'),
 (8, 'Mercado Bom Preço', 'contato@bompreco.com', 'São Paulo');
SET IDENTITY_INSERT [dbo].[ClienteLegado] OFF;
GO

SET IDENTITY_INSERT [dbo].[Departamento] ON;
INSERT INTO Departamento (id_departamento, nome, localizacao, orcamento) VALUES
 (1, 'Tecnologia', 'São Paulo', 450000),
 (2, 'Financeiro', 'São Paulo', 220000),
 (3, 'Comercial', 'Campinas', 310000),
 (4, 'Recursos Humanos', 'São Paulo', 120000),
 (5, 'Logística', 'Santos', 180000),
 (6, 'Jurídico', 'Brasília', 95000);
SET IDENTITY_INSERT [dbo].[Departamento] OFF;
GO

SET IDENTITY_INSERT [dbo].[Funcionario] ON;
INSERT INTO Funcionario (id_funcionario, nome, email, cargo, salario, data_admissao, id_departamento, id_gerente) VALUES
 (1, 'Ana Beatriz Souza', 'ana.souza@empresa.com', 'Gerente', 14500, '2016-03-01', 1, NULL),
 (2, 'Bruno Carvalho', 'bruno.c@empresa.com', 'Analista', 7200, '2019-07-15', 1, 1),
 (3, 'Juliana Prado', 'juliana.p@empresa.com', 'Desenvolvedora', 8900, '2021-02-10', 1, 1),
 (4, 'João Mendes', 'joao.m@empresa.com', 'Estagiário', 1800, '2024-01-08', 1, 2),
 (5, 'Carla Nunes', 'carla.n@empresa.com', 'Gerente', 12800, '2015-05-20', 2, NULL),
 (6, 'Diego Ramos', 'diego.r@empresa.com', 'Analista', 6100, '2020-09-01', 2, 5),
 (7, 'Jéssica Lima', 'jessica.l@empresa.com', 'Assistente', 3200, '2022-11-03', 2, 5),
 (8, 'Eduardo Teixeira', 'eduardo.t@empresa.com', 'Gerente', 11900, '2017-08-14', 3, NULL),
 (9, 'Fernanda Alves', 'fernanda.a@empresa.com', 'Vendedora', 4300, '2020-03-16', 3, 8),
 (10, 'Gustavo Pereira', 'gustavo.p@empresa.com', 'Vendedor', 4100, '2023-06-05', 3, 8),
 (11, 'Alice Martins', 'alice.m@empresa.com', 'Vendedora', 3950, '2024-04-22', 3, 8),
 (12, 'Helena Costa', 'helena.c@empresa.com', 'Analista', 5600, '2018-10-01', 4, NULL),
 (13, 'Igor Santana', 'igor.s@empresa.com', 'Assistente', 2900, '2021-12-13', 4, 12),
 (14, 'Larissa Rocha', 'larissa.r@empresa.com', 'Coordenadora', 7800, '2019-01-28', 5, NULL),
 (15, 'Marcos Vieira', 'marcos.v@empresa.com', 'Motorista', 3100, '2022-02-14', 5, 14),
 (16, 'Paulo Henrique', 'paulo.h@empresa.com', 'Consultor', 6500, '2023-09-11', NULL, NULL);
SET IDENTITY_INSERT [dbo].[Funcionario] OFF;
GO

SET IDENTITY_INSERT [dbo].[Produto] ON;
INSERT INTO Produto (id_produto, nome, categoria, preco, estoque) VALUES
 (1, 'Notebook 14"', 'Informática', 3899.9, 25),
 (2, 'Mouse sem fio', 'Informática', 89.9, 240),
 (3, 'Monitor 24"', 'Informática', 899, 40),
 (4, 'Teclado mecânico', 'Informática', 349.5, 75),
 (5, 'Cadeira ergonômica', 'Mobiliário', 1290, 18),
 (6, 'Mesa em L', 'Mobiliário', 980, 12),
 (7, 'Gaveteiro', 'Mobiliário', 420, 0),
 (8, 'Papel A4 (caixa)', 'Papelaria', 229.9, 130),
 (9, 'Caneta (cx 50)', 'Papelaria', 59.9, 300),
 (10, 'Grampeador', 'Papelaria', 38.5, 95),
 (11, 'Headset USB', 'Áudio', 219, 60),
 (12, 'Caixa de som BT', 'Áudio', 189.9, 0);
SET IDENTITY_INSERT [dbo].[Produto] OFF;
GO

SET IDENTITY_INSERT [dbo].[Pedido] ON;
INSERT INTO Pedido (id_pedido, id_cliente, data_pedido, status) VALUES
 (1, 1, '2024-01-15', 'Entregue'),
 (2, 1, '2024-03-02', 'Entregue'),
 (3, 2, '2024-02-20', 'Entregue'),
 (4, 3, '2024-04-11', 'Pago'),
 (5, 3, '2024-06-25', 'Enviado'),
 (6, 4, '2024-05-07', 'Cancelado'),
 (7, 5, '2024-07-19', 'Entregue'),
 (8, 5, '2024-08-30', 'Aberto'),
 (9, 6, '2024-09-12', 'Entregue'),
 (10, 7, '2024-10-01', 'Pago'),
 (11, 1, '2024-11-05', 'Enviado'),
 (12, 9, '2024-11-20', 'Cancelado'),
 (13, 9, '2025-01-14', 'Entregue'),
 (14, 3, '2025-02-03', 'Aberto'),
 (15, 2, '2025-03-18', 'Pago');
SET IDENTITY_INSERT [dbo].[Pedido] OFF;
GO

INSERT INTO ItemPedido (id_pedido, id_produto, quantidade, preco_unitario) VALUES
 (1, 1, 2, 3799.9),
 (1, 2, 2, 89.9),
 (2, 8, 10, 229.9),
 (2, 9, 5, 59.9),
 (3, 9, 3, 59.9),
 (3, 10, 2, 38.5),
 (4, 1, 5, 3899.9),
 (4, 3, 5, 899),
 (4, 4, 5, 349.5),
 (5, 11, 10, 219),
 (6, 5, 1, 1290),
 (7, 2, 4, 89.9),
 (7, 8, 2, 229.9),
 (8, 6, 1, 980),
 (8, 5, 1, 1290),
 (9, 8, 3, 229.9),
 (9, 10, 1, 38.5),
 (10, 11, 4, 219),
 (10, 12, 2, 189.9),
 (11, 3, 2, 899),
 (11, 4, 2, 349.5),
 (12, 1, 1, 3899.9),
 (13, 5, 6, 1250),
 (13, 6, 6, 960),
 (14, 2, 20, 85),
 (14, 4, 10, 339),
 (15, 9, 10, 59.9);
GO


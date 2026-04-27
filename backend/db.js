import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DB_PATH permite apontar para um volume persistente em produção
// (ex.: /data/spacefy.db no Railway). Fallback: arquivo local no backend.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'spacefy.db');
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cnpj TEXT,
    whatsapp TEXT,
    tipo_contrato TEXT,
    valor_padrao REAL,
    dia_vencimento INTEGER,
    servico_padrao TEXT,
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recebimentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    cliente TEXT NOT NULL,
    servico TEXT NOT NULL,
    mes_ref TEXT NOT NULL,
    valor REAL NOT NULL,
    vencimento TEXT,
    status TEXT NOT NULL DEFAULT 'Pendente',
    cliente_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gastos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    categoria TEXT NOT NULL,
    descricao TEXT,
    mes_ref TEXT NOT NULL,
    valor REAL NOT NULL,
    forma_pagamento TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cobrancas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    valor REAL NOT NULL,
    vencimento TEXT NOT NULL,
    descricao TEXT,
    status TEXT NOT NULL DEFAULT 'Pendente',
    data_pagamento TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT,
    google_id TEXT UNIQUE,
    avatar TEXT,
    criado_em TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tarefas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    prioridade TEXT NOT NULL DEFAULT 'Média',
    data_limite TEXT,
    cliente_id INTEGER,
    status TEXT NOT NULL DEFAULT 'A Fazer',
    ordem INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agenda_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    inicio TEXT NOT NULL,
    fim TEXT NOT NULL,
    cor TEXT DEFAULT '#1B6FEE',
    cliente_id INTEGER,
    repeticao TEXT DEFAULT 'nao',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS campanhas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    nome TEXT NOT NULL,
    plataforma TEXT NOT NULL DEFAULT 'Meta Ads',
    objetivo TEXT NOT NULL DEFAULT 'Conversão',
    orcamento_mensal REAL NOT NULL DEFAULT 0,
    investimento_mes REAL NOT NULL DEFAULT 0,
    resultado_mes REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Ativa',
    data_inicio TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS campanha_reunioes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campanha_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    pauta TEXT,
    decisoes TEXT,
    ajustes_orcamento TEXT,
    proximos_passos TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL DEFAULT '',
    corpo TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cliente_relatorio_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    ano_mes TEXT NOT NULL,
    investimento REAL NOT NULL DEFAULT 0,
    resultado REAL NOT NULL DEFAULT 0,
    roas REAL NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(cliente_id, ano_mes),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cliente_servicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    servico TEXT NOT NULL,
    custom_text TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(cliente_id, servico),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
  );
`);

// Idempotent migrations for DBs created by older schema versions
try { db.exec('ALTER TABLE recebimentos ADD COLUMN cliente_id INTEGER'); } catch {}
try { db.exec('ALTER TABLE clientes ADD COLUMN cnpj TEXT'); } catch {}
try { db.exec('ALTER TABLE cobrancas ADD COLUMN numero_comprovante TEXT'); } catch {}
try { db.exec('ALTER TABLE cobrancas ADD COLUMN tipo TEXT'); } catch {}
try { db.exec("UPDATE cobrancas SET tipo = 'Pagamento Único' WHERE tipo IS NULL"); } catch {}
try { db.exec('ALTER TABLE cobrancas ADD COLUMN enviado_em TEXT'); } catch {}
try { db.exec('ALTER TABLE clientes ADD COLUMN relatorio_token TEXT'); } catch {}
try { db.exec('ALTER TABLE clientes ADD COLUMN observacoes TEXT'); } catch {}
try { db.exec('ALTER TABLE notas ADD COLUMN concluido_em TEXT'); } catch {}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_rec_mes ON recebimentos(mes_ref);
  CREATE INDEX IF NOT EXISTS idx_gas_mes ON gastos(mes_ref);
  CREATE INDEX IF NOT EXISTS idx_rec_cliente ON recebimentos(cliente_id);
  CREATE INDEX IF NOT EXISTS idx_cob_cliente ON cobrancas(cliente_id);
  CREATE INDEX IF NOT EXISTS idx_cob_venc ON cobrancas(vencimento);
  CREATE INDEX IF NOT EXISTS idx_tar_status ON tarefas(status);
  CREATE INDEX IF NOT EXISTS idx_tar_cliente ON tarefas(cliente_id);
  CREATE INDEX IF NOT EXISTS idx_usu_email ON usuarios(email);
  CREATE INDEX IF NOT EXISTS idx_usu_google ON usuarios(google_id);
  CREATE INDEX IF NOT EXISTS idx_age_inicio ON agenda_eventos(inicio);
  CREATE INDEX IF NOT EXISTS idx_age_cliente ON agenda_eventos(cliente_id);
  CREATE INDEX IF NOT EXISTS idx_camp_cliente ON campanhas(cliente_id);
  CREATE INDEX IF NOT EXISTS idx_camp_status ON campanhas(status);
  CREATE INDEX IF NOT EXISTS idx_reu_camp ON campanha_reunioes(campanha_id);
  CREATE INDEX IF NOT EXISTS idx_cli_token ON clientes(relatorio_token);
  CREATE INDEX IF NOT EXISTS idx_snap_cliente ON cliente_relatorio_snapshots(cliente_id);
  CREATE INDEX IF NOT EXISTS idx_snap_mes ON cliente_relatorio_snapshots(ano_mes);
  CREATE INDEX IF NOT EXISTS idx_notas_updated ON notas(updated_at);
  CREATE INDEX IF NOT EXISTS idx_cli_serv_cli ON cliente_servicos(cliente_id);
`);

const DEFAULT_TEMPLATE = `Olá {nome_cliente}! 👋

Passando para lembrar que sua cobrança com a Spacefy Marketing no valor de R$ {valor} vence em {vencimento}.

Você pode pagar via PIX: {chave_pix}

Qualquer dúvida estou à disposição. Obrigado! 💙`;

const seed = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
seed.run('chave_pix', '');
seed.run('whatsapp_dono', '');
seed.run('template_cobranca', DEFAULT_TEMPLATE);
seed.run('logo_data', '');

export default db;

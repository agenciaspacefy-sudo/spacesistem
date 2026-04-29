import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from './db.js';
import authRouter, { requireAuth, checkAccess, setupPassport } from './auth.js';
import stripeWebhookHandler from './stripeWebhook.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-env';

// Railway/Heroku ficam atrás de proxy reverso → necessário para cookies secure + IPs
app.set('trust proxy', 1);

// Em produção o frontend é servido pelo próprio backend (mesma origem),
// então CORS só é necessário em dev. Se FRONTEND_URL for definido, libera
// essa origem específica; caso contrário, reflete a origem (same-origin).
app.use(cors({
  origin: IS_PROD ? true : FRONTEND_URL,
  credentials: true
}));

// Stripe webhook precisa receber o corpo RAW (Buffer) para validar a assinatura.
// Por isso é registrado ANTES do express.json() global.
app.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler
);

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: 10 * 60 * 1000
  }
}));
setupPassport();
app.use(passport.initialize());

app.use('/auth', authRouter);

// ---------- RELATÓRIO PÚBLICO (sem autenticação) ----------
// ATENÇÃO: registrado ANTES do middleware requireAuth para ficar acessível sem login.
// Busca cliente pelo token, campanhas ativas + snapshots mensais + reuniões recentes.
function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

app.get('/api/public/relatorio/:token', (req, res) => {
  // Cabeçalhos: não indexável + sem cache agressivo
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');

  const token = String(req.params.token || '').trim();
  if (!token || token.length < 16) {
    return res.status(404).json({ error: 'Relatório não encontrado' });
  }

  const cliente = db
    .prepare('SELECT id, nome FROM clientes WHERE relatorio_token = ?')
    .get(token);

  if (!cliente) {
    return res.status(404).json({ error: 'Relatório não encontrado' });
  }

  // Campanhas ATIVAS apenas — não retornar dados financeiros de cobranças.
  const campanhas = db
    .prepare(`
      SELECT id, nome, plataforma, objetivo, orcamento_mensal,
             investimento_mes, resultado_mes, status, data_inicio
      FROM campanhas
      WHERE cliente_id = ? AND status = 'Ativa'
      ORDER BY nome ASC
    `)
    .all(cliente.id);

  // Totais do mês atual
  let totalInvestido = 0;
  let totalResultado = 0;
  for (const c of campanhas) {
    totalInvestido += Number(c.investimento_mes) || 0;
    totalResultado += Number(c.resultado_mes) || 0;
  }
  const roasAtual = totalInvestido > 0 ? totalResultado / totalInvestido : 0;

  // Snapshot automático do mês atual (upsert) — permite que o histórico
  // se construa organicamente conforme o cliente acessa o relatório ao longo do tempo.
  const anoMes = currentYearMonth();
  if (totalInvestido > 0 || totalResultado > 0) {
    db.prepare(`
      INSERT INTO cliente_relatorio_snapshots (cliente_id, ano_mes, investimento, resultado, roas, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(cliente_id, ano_mes) DO UPDATE SET
        investimento = excluded.investimento,
        resultado = excluded.resultado,
        roas = excluded.roas,
        updated_at = excluded.updated_at
    `).run(cliente.id, anoMes, totalInvestido, totalResultado, roasAtual);
  }

  // Histórico últimos 6 meses (mais antigo → mais recente para o gráfico)
  const historico = db
    .prepare(`
      SELECT ano_mes, investimento, resultado, roas
      FROM cliente_relatorio_snapshots
      WHERE cliente_id = ?
      ORDER BY ano_mes DESC
      LIMIT 6
    `)
    .all(cliente.id)
    .reverse();

  // Últimas 3 reuniões de qualquer campanha ATIVA do cliente
  const reunioes = campanhas.length === 0 ? [] : db
    .prepare(`
      SELECT r.data, r.decisoes, r.proximos_passos, c.nome AS campanha_nome
      FROM campanha_reunioes r
      JOIN campanhas c ON c.id = r.campanha_id
      WHERE c.cliente_id = ? AND c.status = 'Ativa'
      ORDER BY r.data DESC, r.id DESC
      LIMIT 3
    `)
    .all(cliente.id);

  res.json({
    cliente: { id: cliente.id, nome: cliente.nome },
    atualizado_em: new Date().toISOString(),
    resumo: {
      total_investido: totalInvestido,
      total_resultado: totalResultado,
      roas_atual: roasAtual,
      meta_roas: 6
    },
    campanhas,
    historico,
    reunioes
  });
});

// ---------- ACESSO PÚBLICO POR CAMPANHA (sem autenticação) ----------
app.get('/api/public/campanha/:token', (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');

  const token = String(req.params.token || '').trim();
  if (!token || token.length < 16) return res.status(404).json({ error: 'Campanha não encontrada' });

  const camp = db
    .prepare(`
      SELECT c.id, c.cliente_id, c.nome, c.plataforma, c.objetivo, c.status,
             c.orcamento_mensal, c.investimento_mes, c.resultado_mes, c.data_inicio,
             cl.nome AS cliente_nome
      FROM campanhas c
      LEFT JOIN clientes cl ON cl.id = c.cliente_id
      WHERE c.acesso_token = ?
    `)
    .get(token);

  if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });

  const investido = Number(camp.investimento_mes) || 0;
  const resultado = Number(camp.resultado_mes) || 0;
  const roas = investido > 0 ? resultado / investido : 0;

  // Auto-snapshot do mês atual para construir histórico
  const ym = currentYearMonth();
  try {
    db.prepare(`
      INSERT INTO campanha_roas_snapshots (campanha_id, ano_mes, investimento, resultado, roas, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(campanha_id, ano_mes) DO UPDATE SET
        investimento = excluded.investimento,
        resultado = excluded.resultado,
        roas = excluded.roas,
        updated_at = excluded.updated_at
    `).run(camp.id, ym, investido, resultado, roas);
  } catch (e) {
    console.warn('[campanha-publica] snapshot falhou:', e?.message);
  }

  // Histórico dos últimos 6 meses
  const meses = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const historico = db
    .prepare(`
      SELECT ano_mes, investimento, resultado, roas
      FROM campanha_roas_snapshots
      WHERE campanha_id = ? AND ano_mes IN (${meses.map(() => '?').join(',')})
      ORDER BY ano_mes ASC
    `)
    .all(camp.id, ...meses);

  res.json({
    campanha: {
      id: camp.id,
      nome: camp.nome,
      plataforma: camp.plataforma,
      objetivo: camp.objetivo,
      status: camp.status,
      cliente_nome: camp.cliente_nome,
      data_inicio: camp.data_inicio
    },
    metrics: {
      investimento: investido,
      resultado,
      roas,
      orcamento_mensal: Number(camp.orcamento_mensal) || 0
    },
    historico,
    atualizado_em: new Date().toISOString()
  });
});

// Todas as rotas /api/* exigem autenticação E acesso ativo (trial ou plano).
// Ordem importa: requireAuth popula req.user; checkAccess verifica billing.
app.use('/api', requireAuth, checkAccess);

// Healthcheck (usado pelo Railway)
app.get('/healthz', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;

const REC_FIELDS = ['data', 'cliente', 'servico', 'mes_ref', 'valor', 'vencimento', 'status', 'cliente_id'];
const GAS_FIELDS = ['data', 'categoria', 'descricao', 'mes_ref', 'valor', 'forma_pagamento'];
const CLI_FIELDS = ['nome', 'cnpj', 'whatsapp', 'ativo', 'observacoes'];
const COB_FIELDS = ['cliente_id', 'valor', 'vencimento', 'descricao', 'status', 'data_pagamento', 'numero_comprovante', 'tipo', 'enviado_em'];
const TAR_FIELDS = ['titulo', 'descricao', 'prioridade', 'data_limite', 'cliente_id', 'status', 'ordem'];
const AGE_FIELDS = ['titulo', 'descricao', 'inicio', 'fim', 'cor', 'cliente_id', 'repeticao'];
const CAMP_FIELDS = ['cliente_id', 'nome', 'plataforma', 'objetivo', 'orcamento_mensal', 'investimento_mes', 'resultado_mes', 'status', 'data_inicio'];
const REU_FIELDS = ['campanha_id', 'data', 'pauta', 'decisoes', 'ajustes_orcamento', 'proximos_passos'];

function nextReceiptNumber(year) {
  const prefix = `REC-${year}-`;
  const row = db
    .prepare(
      `SELECT numero_comprovante FROM cobrancas
       WHERE numero_comprovante LIKE ?
       ORDER BY CAST(SUBSTR(numero_comprovante, ?) AS INTEGER) DESC
       LIMIT 1`
    )
    .get(`${prefix}%`, prefix.length + 1);
  const lastSeq = row?.numero_comprovante ? parseInt(row.numero_comprovante.slice(prefix.length), 10) : 0;
  const next = (isNaN(lastSeq) ? 0 : lastSeq) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

function buildInsert(table, fields, body) {
  const cols = fields.join(', ');
  const placeholders = fields.map(() => '?').join(', ');
  const values = fields.map((f) => (body[f] === undefined ? null : body[f]));
  const stmt = db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`);
  const info = stmt.run(...values);
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
}

function buildUpdate(table, fields, id, body) {
  const keys = Object.keys(body).filter((k) => fields.includes(k));
  if (keys.length === 0) return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => body[k]);
  db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...values, id);
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
}

// ---------- RECEBIMENTOS ----------
app.get('/api/recebimentos', (req, res) => {
  const { mes } = req.query;
  const rows = mes
    ? db.prepare('SELECT * FROM recebimentos WHERE mes_ref = ? ORDER BY data DESC, id DESC').all(mes)
    : db.prepare('SELECT * FROM recebimentos ORDER BY data DESC, id DESC').all();
  res.json(rows);
});

app.post('/api/recebimentos', (req, res) => {
  try { res.status(201).json(buildInsert('recebimentos', REC_FIELDS, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/recebimentos/:id', (req, res) => {
  try {
    const row = buildUpdate('recebimentos', REC_FIELDS, req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/recebimentos/:id', (req, res) => {
  const info = db.prepare('DELETE FROM recebimentos WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------- GASTOS ----------
app.get('/api/gastos', (req, res) => {
  const { mes } = req.query;
  const rows = mes
    ? db.prepare('SELECT * FROM gastos WHERE mes_ref = ? ORDER BY data DESC, id DESC').all(mes)
    : db.prepare('SELECT * FROM gastos ORDER BY data DESC, id DESC').all();
  res.json(rows);
});

app.post('/api/gastos', (req, res) => {
  try { res.status(201).json(buildInsert('gastos', GAS_FIELDS, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/gastos/:id', (req, res) => {
  try {
    const row = buildUpdate('gastos', GAS_FIELDS, req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/gastos/:id', (req, res) => {
  const info = db.prepare('DELETE FROM gastos WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------- CLIENTES ----------
app.get('/api/clientes', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM cliente_servicos s WHERE s.cliente_id = c.id) AS servicos_count
    FROM clientes c
    ORDER BY c.nome
  `).all();
  res.json(rows);
});

app.post('/api/clientes', (req, res) => {
  try { res.status(201).json(buildInsert('clientes', CLI_FIELDS, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/clientes/:id', (req, res) => {
  try {
    const row = buildUpdate('clientes', CLI_FIELDS, req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/clientes/:id', (req, res) => {
  const info = db.prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Gera (ou regenera) token do relatório público de um cliente
app.post('/api/clientes/:id/relatorio-token', (req, res) => {
  try {
    const cli = db.prepare('SELECT id FROM clientes WHERE id = ?').get(req.params.id);
    if (!cli) return res.status(404).json({ error: 'Cliente não encontrado' });
    const token = crypto.randomUUID();
    db.prepare('UPDATE clientes SET relatorio_token = ? WHERE id = ?').run(token, req.params.id);
    res.json({ relatorio_token: token });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Revoga token (invalida o link atual)
app.delete('/api/clientes/:id/relatorio-token', (req, res) => {
  try {
    const cli = db.prepare('SELECT id FROM clientes WHERE id = ?').get(req.params.id);
    if (!cli) return res.status(404).json({ error: 'Cliente não encontrado' });
    db.prepare('UPDATE clientes SET relatorio_token = NULL WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------- SERVIÇOS CONTRATADOS DO CLIENTE ----------
// Lista os serviços (códigos + custom) de um cliente
app.get('/api/clientes/:id/servicos', (req, res) => {
  try {
    const cli = db.prepare('SELECT id FROM clientes WHERE id = ?').get(req.params.id);
    if (!cli) return res.status(404).json({ error: 'Cliente não encontrado' });
    const rows = db.prepare(
      'SELECT servico, custom_text FROM cliente_servicos WHERE cliente_id = ?'
    ).all(req.params.id);
    res.json(rows);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Toggle de um serviço individual (insere ou remove)
// body: { servico: 'meta_ads', ativo: true, custom_text?: '...' }
app.post('/api/clientes/:id/servicos/toggle', (req, res) => {
  try {
    const cli = db.prepare('SELECT id FROM clientes WHERE id = ?').get(req.params.id);
    if (!cli) return res.status(404).json({ error: 'Cliente não encontrado' });
    const { servico, ativo, custom_text } = req.body || {};
    if (!servico || typeof servico !== 'string') {
      return res.status(400).json({ error: 'servico obrigatório' });
    }
    if (ativo) {
      db.prepare(`
        INSERT INTO cliente_servicos (cliente_id, servico, custom_text)
        VALUES (?, ?, ?)
        ON CONFLICT(cliente_id, servico) DO UPDATE SET
          custom_text = excluded.custom_text
      `).run(req.params.id, servico, custom_text ?? null);
    } else {
      db.prepare(
        'DELETE FROM cliente_servicos WHERE cliente_id = ? AND servico = ?'
      ).run(req.params.id, servico);
    }
    const rows = db.prepare(
      'SELECT servico, custom_text FROM cliente_servicos WHERE cliente_id = ?'
    ).all(req.params.id);
    res.json({ servicos: rows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Atualiza apenas o texto custom (Outros) — não altera flag ativa
app.put('/api/clientes/:id/servicos/:servico', (req, res) => {
  try {
    const { id, servico } = req.params;
    const { custom_text } = req.body || {};
    db.prepare(
      'UPDATE cliente_servicos SET custom_text = ? WHERE cliente_id = ? AND servico = ?'
    ).run(custom_text ?? null, id, servico);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------- COBRANCAS ----------
const COB_SELECT = `
  SELECT c.*, cl.nome AS cliente_nome, cl.whatsapp AS cliente_whatsapp, cl.cnpj AS cliente_cnpj
  FROM cobrancas c
  LEFT JOIN clientes cl ON cl.id = c.cliente_id
`;

app.get('/api/cobrancas', (req, res) => {
  const rows = db.prepare(`${COB_SELECT} ORDER BY c.vencimento DESC, c.id DESC`).all();
  res.json(rows);
});

app.post('/api/cobrancas', (req, res) => {
  try {
    const { tipo, vencimento } = req.body;
    const stmt = db.prepare(`INSERT INTO cobrancas (${COB_FIELDS.join(', ')}) VALUES (${COB_FIELDS.map(() => '?').join(', ')})`);
    const selectStmt = db.prepare(`${COB_SELECT} WHERE c.id = ?`);

    if (tipo === 'Recorrência Mensal' && vencimento) {
      const duracao = Math.max(1, Math.min(120, parseInt(req.body.duracao_meses ?? 12, 10) || 12));
      const [y, m, d] = vencimento.split('-').map(Number);
      db.exec('BEGIN');
      try {
        const created = [];
        for (let i = 0; i < duracao; i++) {
          const dt = new Date(y, m - 1 + i, 1);
          const year = dt.getFullYear();
          const month = dt.getMonth() + 1;
          const lastDay = new Date(year, month, 0).getDate();
          const day = Math.min(d, lastDay);
          const venc = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const row = { ...req.body, vencimento: venc };
          const info = stmt.run(...COB_FIELDS.map((f) => (row[f] === undefined ? null : row[f])));
          created.push(selectStmt.get(info.lastInsertRowid));
        }
        db.exec('COMMIT');
        return res.status(201).json(created);
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    }

    const info = stmt.run(...COB_FIELDS.map((f) => (req.body[f] === undefined ? null : req.body[f])));
    const row = selectStmt.get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/cobrancas/:id', (req, res) => {
  try {
    const body = { ...req.body };
    if (body.status === 'Pago') {
      const existing = db.prepare('SELECT numero_comprovante, data_pagamento FROM cobrancas WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (!existing.numero_comprovante) {
        const payDate = body.data_pagamento || existing.data_pagamento || new Date().toISOString().slice(0, 10);
        const year = payDate.slice(0, 4);
        body.numero_comprovante = nextReceiptNumber(year);
        if (!body.data_pagamento && !existing.data_pagamento) body.data_pagamento = payDate;
      }
    }
    const keys = Object.keys(body).filter((k) => COB_FIELDS.includes(k));
    if (keys.length > 0) {
      const setClause = keys.map((k) => `${k} = ?`).join(', ');
      const values = keys.map((k) => body[k]);
      db.prepare(`UPDATE cobrancas SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
    }
    const row = db.prepare(`${COB_SELECT} WHERE c.id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/cobrancas/:id', (req, res) => {
  const info = db.prepare('DELETE FROM cobrancas WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Marca cobrança como enviada (registra apenas o último envio; não bloqueia reenvio)
app.post('/api/cobrancas/:id/marcar-enviada', (req, res) => {
  try {
    const agora = new Date().toISOString();
    db.prepare('UPDATE cobrancas SET enviado_em = ? WHERE id = ?').run(agora, req.params.id);
    const row = db.prepare(`${COB_SELECT} WHERE c.id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------- TAREFAS ----------
const TAR_SELECT = `
  SELECT t.*, cl.nome AS cliente_nome
  FROM tarefas t
  LEFT JOIN clientes cl ON cl.id = t.cliente_id
`;

app.get('/api/tarefas', (req, res) => {
  const rows = db.prepare(`${TAR_SELECT} ORDER BY t.ordem ASC, t.id DESC`).all();
  res.json(rows);
});

app.post('/api/tarefas', (req, res) => {
  try {
    const info = db
      .prepare(`INSERT INTO tarefas (${TAR_FIELDS.join(', ')}) VALUES (${TAR_FIELDS.map(() => '?').join(', ')})`)
      .run(...TAR_FIELDS.map((f) => (req.body[f] === undefined ? null : req.body[f])));
    const row = db.prepare(`${TAR_SELECT} WHERE t.id = ?`).get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/tarefas/:id', (req, res) => {
  try {
    const keys = Object.keys(req.body).filter((k) => TAR_FIELDS.includes(k));
    if (keys.length > 0) {
      const setClause = keys.map((k) => `${k} = ?`).join(', ');
      const values = keys.map((k) => req.body[k]);
      db.prepare(`UPDATE tarefas SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
    }
    const row = db.prepare(`${TAR_SELECT} WHERE t.id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/tarefas/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tarefas WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------- AGENDA (EVENTOS) ----------
const AGE_SELECT = `
  SELECT a.*, cl.nome AS cliente_nome
  FROM agenda_eventos a
  LEFT JOIN clientes cl ON cl.id = a.cliente_id
`;

app.get('/api/agenda', (req, res) => {
  // Suporta filtro opcional por intervalo (?de=YYYY-MM-DD&ate=YYYY-MM-DD)
  const { de, ate } = req.query;
  let rows;
  if (de && ate) {
    rows = db
      .prepare(`${AGE_SELECT} WHERE a.fim >= ? AND a.inicio <= ? ORDER BY a.inicio ASC`)
      .all(de, ate + 'T23:59:59');
  } else {
    rows = db.prepare(`${AGE_SELECT} ORDER BY a.inicio ASC`).all();
  }
  res.json(rows);
});

app.post('/api/agenda', (req, res) => {
  try {
    const info = db
      .prepare(`INSERT INTO agenda_eventos (${AGE_FIELDS.join(', ')}) VALUES (${AGE_FIELDS.map(() => '?').join(', ')})`)
      .run(...AGE_FIELDS.map((f) => (req.body[f] === undefined ? null : req.body[f])));
    const row = db.prepare(`${AGE_SELECT} WHERE a.id = ?`).get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/agenda/:id', (req, res) => {
  try {
    const keys = Object.keys(req.body).filter((k) => AGE_FIELDS.includes(k));
    if (keys.length > 0) {
      const setClause = keys.map((k) => `${k} = ?`).join(', ');
      const values = keys.map((k) => req.body[k]);
      db.prepare(`UPDATE agenda_eventos SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
    }
    const row = db.prepare(`${AGE_SELECT} WHERE a.id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/agenda/:id', (req, res) => {
  const info = db.prepare('DELETE FROM agenda_eventos WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------- CAMPANHAS (tráfego pago) ----------
const CAMP_SELECT = `
  SELECT c.*, cl.nome AS cliente_nome
  FROM campanhas c
  LEFT JOIN clientes cl ON cl.id = c.cliente_id
`;

app.get('/api/campanhas', (req, res) => {
  const rows = db.prepare(`${CAMP_SELECT} ORDER BY c.status ASC, c.nome ASC`).all();
  res.json(rows);
});

app.post('/api/campanhas', (req, res) => {
  try {
    const info = db
      .prepare(`INSERT INTO campanhas (${CAMP_FIELDS.join(', ')}) VALUES (${CAMP_FIELDS.map(() => '?').join(', ')})`)
      .run(...CAMP_FIELDS.map((f) => (req.body[f] === undefined ? null : req.body[f])));
    const row = db.prepare(`${CAMP_SELECT} WHERE c.id = ?`).get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/campanhas/:id', (req, res) => {
  try {
    const keys = Object.keys(req.body).filter((k) => CAMP_FIELDS.includes(k));
    if (keys.length > 0) {
      const setClause = keys.map((k) => `${k} = ?`).join(', ');
      const values = keys.map((k) => req.body[k]);
      db.prepare(`UPDATE campanhas SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
    }
    const row = db.prepare(`${CAMP_SELECT} WHERE c.id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/campanhas/:id', (req, res) => {
  const info = db.prepare('DELETE FROM campanhas WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  // Deleta reuniões órfãs (o FK tem ON DELETE CASCADE, mas garantimos)
  db.prepare('DELETE FROM campanha_reunioes WHERE campanha_id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Gera token de acesso público para uma campanha (uso pelo cliente final)
app.post('/api/campanhas/:id/acesso-token', (req, res) => {
  try {
    const camp = db.prepare('SELECT id, acesso_token FROM campanhas WHERE id = ?').get(req.params.id);
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });
    const email = (req.body?.email || '').trim() || null;
    const token = camp.acesso_token || crypto.randomUUID();
    db.prepare('UPDATE campanhas SET acesso_token = ?, acesso_email = ? WHERE id = ?')
      .run(token, email, req.params.id);
    res.json({ acesso_token: token, acesso_email: email });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/campanhas/:id/acesso-token', (req, res) => {
  try {
    db.prepare('UPDATE campanhas SET acesso_token = NULL, acesso_email = NULL WHERE id = ?')
      .run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Resumo agregado (para cards do topo)
app.get('/api/campanhas/resumo', (_req, res) => {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'Ativa' THEN 1 ELSE 0 END) AS ativas,
      COALESCE(SUM(CASE WHEN status = 'Ativa' THEN investimento_mes END), 0) AS total_investido,
      COALESCE(SUM(CASE WHEN status = 'Ativa' THEN resultado_mes END), 0) AS total_resultado
    FROM campanhas
  `).get();
  const roasMedio = row.total_investido > 0 ? row.total_resultado / row.total_investido : 0;
  res.json({ ...row, roas_medio: roasMedio });
});

// Reuniões de uma campanha
app.get('/api/campanhas/:id/reunioes', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM campanha_reunioes WHERE campanha_id = ? ORDER BY data DESC, id DESC')
    .all(req.params.id);
  res.json(rows);
});

app.post('/api/campanhas/:id/reunioes', (req, res) => {
  try {
    const body = { ...req.body, campanha_id: Number(req.params.id) };
    const info = db
      .prepare(`INSERT INTO campanha_reunioes (${REU_FIELDS.join(', ')}) VALUES (${REU_FIELDS.map(() => '?').join(', ')})`)
      .run(...REU_FIELDS.map((f) => (body[f] === undefined ? null : body[f])));
    const row = db.prepare('SELECT * FROM campanha_reunioes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/reunioes/:id', (req, res) => {
  try {
    const keys = Object.keys(req.body).filter((k) => REU_FIELDS.includes(k) && k !== 'campanha_id');
    if (keys.length > 0) {
      const setClause = keys.map((k) => `${k} = ?`).join(', ');
      const values = keys.map((k) => req.body[k]);
      db.prepare(`UPDATE campanha_reunioes SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
    }
    const row = db.prepare('SELECT * FROM campanha_reunioes WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/reunioes/:id', (req, res) => {
  const info = db.prepare('DELETE FROM campanha_reunioes WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------- SETTINGS ----------
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json(obj);
});

app.put('/api/settings', (req, res) => {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(req.body || {})) {
    stmt.run(k, String(v ?? ''));
  }
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json(obj);
});

// ---------- NOTAS (bloco de notas) ----------
app.get('/api/notas', (req, res) => {
  const { q, incluir_concluidas } = req.query;
  // Por padrão filtra concluídas; ?incluir_concluidas=1 traz todas;
  // ?incluir_concluidas=apenas traz só as concluídas
  let where = '';
  const params = [];
  if (incluir_concluidas === 'apenas') {
    where = 'WHERE concluido_em IS NOT NULL';
  } else if (incluir_concluidas !== '1') {
    where = 'WHERE concluido_em IS NULL';
  }
  if (q) {
    const like = `%${q}%`;
    where += where ? ' AND ' : 'WHERE ';
    where += '(titulo LIKE ? OR corpo LIKE ?)';
    params.push(like, like);
  }
  const rows = db
    .prepare(`SELECT * FROM notas ${where} ORDER BY updated_at DESC, id DESC`)
    .all(...params);
  res.json(rows);
});

// Marca/desmarca nota como concluída (sem deletar do banco)
app.post('/api/notas/:id/concluir', (req, res) => {
  try {
    const desfazer = req.body?.desfazer === true;
    if (desfazer) {
      db.prepare('UPDATE notas SET concluido_em = NULL WHERE id = ?').run(req.params.id);
    } else {
      db.prepare("UPDATE notas SET concluido_em = datetime('now') WHERE id = ?").run(req.params.id);
    }
    const row = db.prepare('SELECT * FROM notas WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/notas', (req, res) => {
  try {
    const titulo = String(req.body?.titulo ?? '');
    const corpo = String(req.body?.corpo ?? '');
    const info = db
      .prepare(`INSERT INTO notas (titulo, corpo, updated_at) VALUES (?, ?, datetime('now'))`)
      .run(titulo, corpo);
    const row = db.prepare('SELECT * FROM notas WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/notas/:id', (req, res) => {
  try {
    const fields = [];
    const values = [];
    if (req.body?.titulo !== undefined) { fields.push('titulo = ?'); values.push(String(req.body.titulo)); }
    if (req.body?.corpo !== undefined) { fields.push('corpo = ?'); values.push(String(req.body.corpo)); }
    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      db.prepare(`UPDATE notas SET ${fields.join(', ')} WHERE id = ?`).run(...values, req.params.id);
    }
    const row = db.prepare('SELECT * FROM notas WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/notas/:id', (req, res) => {
  const info = db.prepare('DELETE FROM notas WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------- RESUMO MENSAL ----------
app.get('/api/resumo', (req, res) => {
  const receitas = db
    .prepare(`SELECT mes_ref, SUM(valor) AS total FROM recebimentos WHERE status = 'Pago' GROUP BY mes_ref`)
    .all();
  const gastos = db
    .prepare(`SELECT mes_ref, SUM(valor) AS total FROM gastos GROUP BY mes_ref`)
    .all();

  const mapa = new Map();
  for (const r of receitas) mapa.set(r.mes_ref, { mes: r.mes_ref, receita: r.total || 0, gastos: 0 });
  for (const g of gastos) {
    const cur = mapa.get(g.mes_ref) || { mes: g.mes_ref, receita: 0, gastos: 0 };
    cur.gastos = g.total || 0;
    mapa.set(g.mes_ref, cur);
  }

  const resumo = [...mapa.values()]
    .map((r) => {
      const lucro = r.receita - r.gastos;
      const margem = r.receita > 0 ? (lucro / r.receita) * 100 : 0;
      return { ...r, lucro, margem };
    })
    .sort((a, b) => b.mes.localeCompare(a.mes));

  res.json(resumo);
});

// ---------- CONTEÚDOS (calendário editorial) ----------
app.get('/api/conteudos', (req, res) => {
  const { de, ate, cliente_id, plataforma } = req.query;
  let where = '1=1';
  const params = [];
  if (de) { where += ' AND data_pub >= ?'; params.push(de); }
  if (ate) { where += ' AND data_pub <= ?'; params.push(ate); }
  if (cliente_id) { where += ' AND cliente_id = ?'; params.push(Number(cliente_id)); }
  const rows = db
    .prepare(`
      SELECT c.*, cl.nome AS cliente_nome
      FROM conteudos c
      LEFT JOIN clientes cl ON cl.id = c.cliente_id
      WHERE ${where}
      ORDER BY data_pub ASC
    `)
    .all(...params);

  // Filtro por plataforma é feito em JS (plataformas é JSON-string)
  const out = plataforma
    ? rows.filter((r) => {
        try { return JSON.parse(r.plataformas || '[]').includes(plataforma); }
        catch { return false; }
      })
    : rows;

  // Parse plataformas pra facilitar no front
  res.json(out.map((r) => ({
    ...r,
    plataformas: (() => {
      try { return JSON.parse(r.plataformas || '[]'); } catch { return []; }
    })()
  })));
});

app.post('/api/conteudos', (req, res) => {
  try {
    const b = req.body || {};
    const plataformas = Array.isArray(b.plataformas) ? b.plataformas : [];
    const info = db.prepare(`
      INSERT INTO conteudos (cliente_id, titulo, descricao, data_pub, plataformas, tipo, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      b.cliente_id ? Number(b.cliente_id) : null,
      String(b.titulo || ''),
      String(b.descricao || ''),
      String(b.data_pub || ''),
      JSON.stringify(plataformas),
      String(b.tipo || 'Feed'),
      String(b.status || 'Planejado')
    );
    const row = db.prepare('SELECT * FROM conteudos WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({
      ...row,
      plataformas: (() => { try { return JSON.parse(row.plataformas || '[]'); } catch { return []; } })()
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/conteudos/:id', (req, res) => {
  try {
    const fields = [];
    const values = [];
    const b = req.body || {};
    if (b.cliente_id !== undefined) { fields.push('cliente_id = ?'); values.push(b.cliente_id ? Number(b.cliente_id) : null); }
    if (b.titulo !== undefined)     { fields.push('titulo = ?');     values.push(String(b.titulo)); }
    if (b.descricao !== undefined)  { fields.push('descricao = ?');  values.push(String(b.descricao)); }
    if (b.data_pub !== undefined)   { fields.push('data_pub = ?');   values.push(String(b.data_pub)); }
    if (b.plataformas !== undefined) {
      fields.push('plataformas = ?');
      values.push(JSON.stringify(Array.isArray(b.plataformas) ? b.plataformas : []));
    }
    if (b.tipo !== undefined)       { fields.push('tipo = ?');       values.push(String(b.tipo)); }
    if (b.status !== undefined)     { fields.push('status = ?');     values.push(String(b.status)); }
    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      db.prepare(`UPDATE conteudos SET ${fields.join(', ')} WHERE id = ?`).run(...values, req.params.id);
    }
    const row = db.prepare('SELECT * FROM conteudos WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({
      ...row,
      plataformas: (() => { try { return JSON.parse(row.plataformas || '[]'); } catch { return []; } })()
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/conteudos/:id', (req, res) => {
  const info = db.prepare('DELETE FROM conteudos WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------- Frontend estático (build do Vite) ----------
// Em produção (ou sempre que a pasta dist existir), o backend serve o
// frontend como single-page-app com fallback para index.html.
const DIST_DIR = path.resolve(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { maxAge: IS_PROD ? '1h' : 0, index: false }));

  // Service worker precisa ser servido do root sem cache agressivo
  app.get('/sw.js', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST_DIR, 'sw.js'));
  });

  // SPA fallback: qualquer GET que não bateu nas rotas acima devolve index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  console.log('[server] dist/ não encontrado — rodando apenas como API (use `npm run dev` no frontend).');
}

app.listen(PORT, () => {
  console.log(`SpaceSystem rodando em http://localhost:${PORT}`);
});

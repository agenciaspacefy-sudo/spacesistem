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
import authRouter, { requireAuth, setupPassport } from './auth.js';

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

// Todas as rotas /api/* exigem autenticação
app.use('/api', requireAuth);

// Healthcheck (usado pelo Railway)
app.get('/healthz', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;

const REC_FIELDS = ['data', 'cliente', 'servico', 'mes_ref', 'valor', 'vencimento', 'status', 'cliente_id'];
const GAS_FIELDS = ['data', 'categoria', 'descricao', 'mes_ref', 'valor', 'forma_pagamento'];
const CLI_FIELDS = ['nome', 'cnpj', 'whatsapp', 'ativo'];
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
  const rows = db.prepare('SELECT * FROM clientes ORDER BY nome').all();
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
  const { q } = req.query;
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db
      .prepare(`SELECT * FROM notas WHERE titulo LIKE ? OR corpo LIKE ? ORDER BY updated_at DESC, id DESC`)
      .all(like, like);
  } else {
    rows = db.prepare(`SELECT * FROM notas ORDER BY updated_at DESC, id DESC`).all();
  }
  res.json(rows);
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

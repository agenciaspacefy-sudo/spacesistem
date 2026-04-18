import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import path from 'path';
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

// Todas as rotas /api/* exigem autenticação
app.use('/api', requireAuth);

// Healthcheck (usado pelo Railway)
app.get('/healthz', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;

const REC_FIELDS = ['data', 'cliente', 'servico', 'mes_ref', 'valor', 'vencimento', 'status', 'cliente_id'];
const GAS_FIELDS = ['data', 'categoria', 'descricao', 'mes_ref', 'valor', 'forma_pagamento'];
const CLI_FIELDS = ['nome', 'cnpj', 'whatsapp', 'ativo'];
const COB_FIELDS = ['cliente_id', 'valor', 'vencimento', 'descricao', 'status', 'data_pagamento', 'numero_comprovante', 'tipo'];
const TAR_FIELDS = ['titulo', 'descricao', 'prioridade', 'data_limite', 'cliente_id', 'status', 'ordem'];

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
  console.log(`SpaceSistem rodando em http://localhost:${PORT}`);
});

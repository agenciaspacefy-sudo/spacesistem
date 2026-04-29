import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import db from './db.js';

const {
  JWT_SECRET = 'change-me-in-env',
  FRONTEND_URL = 'http://localhost:5173',
  BACKEND_URL = 'http://localhost:3001'
} = process.env;

// Lê as credenciais Google do ambiente a cada chamada, com trim() — assim
// valores colados com espaço/quebra-de-linha no Railway não quebram silenciosamente,
// e podemos atualizar as vars sem restart caso o dotenv seja recarregado.
function readGoogleCreds() {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  return { clientId, clientSecret };
}

const TOKEN_TTL = '7d';
const COOKIE_NAME = 'spacefy_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------- JWT helpers ----------
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nome: user.nome },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// ---------- Middleware ----------
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// Bloqueia acesso quando o trial expirou e não há assinatura ativa.
// Deve ser usado APÓS requireAuth (depende de req.user).
// Retorna 402 (Payment Required) com payload sinalizando o estado.
export function checkAccess(req, res, next) {
  if (!req.user?.id) return next();
  try {
    const u = findUserById(req.user.id);
    if (!u) return next();
    const { billing } = refreshBillingState(u);
    req.billing = billing;
    if (billing?.expirado) {
      return res.status(402).json({
        error: 'Acesso bloqueado — faça seu plano',
        billing
      });
    }
    next();
  } catch (e) {
    // Em caso de falha do middleware, não derruba a request — só loga.
    console.warn('[checkAccess] erro:', e?.message);
    next();
  }
}

// ---------- DB helpers ----------
function findUserByEmail(email) {
  return db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
}

function findUserById(id) {
  return db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
}

function findUserByGoogleId(googleId) {
  return db.prepare('SELECT * FROM usuarios WHERE google_id = ?').get(googleId);
}

const TRIAL_DAYS = 14;

function createUser({ nome, email, senha_hash = null, google_id = null, avatar = null }) {
  // Trial é configurado no momento da criação.
  // datetime('now') no SQLite retorna UTC em formato 'YYYY-MM-DD HH:MM:SS'.
  const info = db
    .prepare(
      `INSERT INTO usuarios
        (nome, email, senha_hash, google_id, avatar,
         trial_inicio, trial_fim, plano, assinatura_ativa)
       VALUES (?, ?, ?, ?, ?,
         datetime('now'), datetime('now', '+${TRIAL_DAYS} days'), 'trial', 0)`
    )
    .run(nome, email, senha_hash, google_id, avatar);
  return findUserById(info.lastInsertRowid);
}

// Verifica se o trial expirou e atualiza o plano para 'expirado' se necessário.
// Retorna o usuário atualizado e info de billing.
function refreshBillingState(user) {
  if (!user) return { user, billing: null };

  const ehTrial = !user.plano || user.plano === 'trial';
  let updated = user;

  if (ehTrial && user.trial_fim) {
    const fimMs = Date.parse(
      user.trial_fim.includes('T') ? user.trial_fim : user.trial_fim.replace(' ', 'T') + 'Z'
    );
    if (!isNaN(fimMs) && fimMs < Date.now()) {
      // Marca como expirado no banco
      db.prepare("UPDATE usuarios SET plano = 'expirado' WHERE id = ?").run(user.id);
      updated = findUserById(user.id);
    }
  }

  return { user: updated, billing: computeBilling(updated) };
}

function computeBilling(u) {
  if (!u) return null;
  const plano = u.plano || 'trial';
  const assinaturaAtiva = !!u.assinatura_ativa;
  const expirado = plano === 'expirado' && !assinaturaAtiva;

  let daysLeft = null;
  if (u.trial_fim) {
    const fimMs = Date.parse(
      u.trial_fim.includes('T') ? u.trial_fim : u.trial_fim.replace(' ', 'T') + 'Z'
    );
    if (!isNaN(fimMs)) {
      daysLeft = Math.max(0, Math.ceil((fimMs - Date.now()) / (24 * 60 * 60 * 1000)));
    }
  }

  return {
    plano,
    assinatura_ativa: assinaturaAtiva,
    expirado,
    em_trial: plano === 'trial',
    trial_inicio: u.trial_inicio,
    trial_fim: u.trial_fim,
    days_left: daysLeft
  };
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    avatar: u.avatar,
    billing: computeBilling(u)
  };
}

export function getUserBilling(userId) {
  const u = findUserById(userId);
  if (!u) return null;
  const { billing } = refreshBillingState(u);
  return billing;
}

// ---------- Passport (Google OAuth) ----------
export function setupPassport() {
  const { clientId, clientSecret } = readGoogleCreds();
  if (!clientId || !clientSecret) {
    console.warn(
      '[auth] Google OAuth desabilitado — faltando:',
      [!clientId && 'GOOGLE_CLIENT_ID', !clientSecret && 'GOOGLE_CLIENT_SECRET'].filter(Boolean).join(', ')
    );
    return;
  }
  console.log('[auth] Google OAuth habilitado — callback:', `${BACKEND_URL}/auth/google/callback`);

  passport.use(
    new GoogleStrategy(
      {
        clientID: clientId,
        clientSecret: clientSecret,
        callbackURL: `${BACKEND_URL}/auth/google/callback`
      },
      (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const nome = profile.displayName || email;
          const avatar = profile.photos?.[0]?.value || null;
          if (!email) return done(new Error('Conta Google sem e-mail'));

          let user = findUserByGoogleId(profile.id) || findUserByEmail(email);
          if (!user) {
            user = createUser({ nome, email, google_id: profile.id, avatar });
          } else if (!user.google_id) {
            db.prepare('UPDATE usuarios SET google_id = ?, avatar = COALESCE(avatar, ?) WHERE id = ?')
              .run(profile.id, avatar, user.id);
            user = findUserById(user.id);
          }
          done(null, user);
        } catch (e) { done(e); }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    try { done(null, findUserById(id)); } catch (e) { done(e); }
  });
}

export const googleEnabled = () => {
  const { clientId, clientSecret } = readGoogleCreds();
  return Boolean(clientId && clientSecret);
};

// ---------- Routes ----------
const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { nome, email, senha } = req.body || {};
    if (!nome || !email || !senha) return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
    if (senha.length < 6) return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });
    if (findUserByEmail(email)) return res.status(409).json({ error: 'E-mail já cadastrado' });

    const senha_hash = await bcrypt.hash(senha, 10);
    const user = createUser({ nome: nome.trim(), email: email.trim().toLowerCase(), senha_hash });
    const token = signToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ user: publicUser(user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    if (!email || !senha) return res.status(400).json({ error: 'E-mail e senha obrigatórios' });
    const user = findUserByEmail(email.trim().toLowerCase());
    if (!user || !user.senha_hash) return res.status(401).json({ error: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ user: publicUser(user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.json({ user: null });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findUserById(payload.id);
    if (!user) return res.json({ user: null });
    const { user: refreshed } = refreshBillingState(user);
    res.json({ user: publicUser(refreshed) });
  } catch {
    res.json({ user: null });
  }
});

// Atualiza nome e/ou avatar do usuário autenticado
router.put('/me', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const { nome, avatar } = req.body || {};
    const fields = [];
    const values = [];
    if (typeof nome === 'string' && nome.trim()) {
      fields.push('nome = ?');
      values.push(nome.trim());
    }
    if (typeof avatar === 'string' || avatar === null) {
      // Limita avatar a ~400KB de base64 (200x200 JPEG cabe folgado)
      if (typeof avatar === 'string' && avatar.length > 600 * 1024) {
        return res.status(413).json({ error: 'Avatar muito grande (máx 400KB).' });
      }
      fields.push('avatar = ?');
      values.push(avatar);
    }
    if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });
    values.push(payload.id);
    db.prepare(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const user = findUserById(payload.id);
    // Re-emite o token com o novo nome (se mudou) para manter o JWT atualizado
    const newToken = signToken(user);
    setAuthCookie(res, newToken);
    res.json({ user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/config', (req, res) => {
  const { clientId, clientSecret } = readGoogleCreds();
  // Diagnóstico: expomos só a EXISTÊNCIA das vars (booleans), nunca os valores.
  // Assim, abrindo /auth/config direto no navegador em produção, dá pra ver
  // qual variável está faltando sem vazar segredo.
  res.json({
    googleEnabled: Boolean(clientId && clientSecret),
    googleClientIdSet: Boolean(clientId),
    googleClientSecretSet: Boolean(clientSecret),
    backendUrl: BACKEND_URL,
    expectedCallback: `${BACKEND_URL}/auth/google/callback`
  });
});

// Google OAuth
router.get('/google', (req, res, next) => {
  if (!googleEnabled()) return res.redirect(`${FRONTEND_URL}/login?error=google_desabilitado`);
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

router.get(
  '/google/callback',
  (req, res, next) => {
    if (!googleEnabled()) return res.redirect(`${FRONTEND_URL}/login?error=google_desabilitado`);
    passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=google_falhou` })(req, res, next);
  },
  (req, res) => {
    const token = signToken(req.user);
    setAuthCookie(res, token);
    res.redirect(`${FRONTEND_URL}/`);
  }
);

export default router;

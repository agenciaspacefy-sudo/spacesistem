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

function createUser({ nome, email, senha_hash = null, google_id = null, avatar = null }) {
  const info = db
    .prepare('INSERT INTO usuarios (nome, email, senha_hash, google_id, avatar) VALUES (?, ?, ?, ?, ?)')
    .run(nome, email, senha_hash, google_id, avatar);
  return findUserById(info.lastInsertRowid);
}

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, nome: u.nome, email: u.email, avatar: u.avatar };
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
    res.json({ user: publicUser(user) });
  } catch {
    res.json({ user: null });
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

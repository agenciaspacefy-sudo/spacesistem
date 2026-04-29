import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import Logo from './Logo.jsx';
import SpaceBackground from './SpaceBackground.jsx';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function PasswordField({ label, value, onChange, placeholder, minLength, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field field-full">
      <label>{label}</label>
      <div className="password-input-wrap">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minLength={minLength}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          title={visible ? 'Ocultar senha' : 'Mostrar senha'}
          tabIndex={-1}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

export default function AuthScreen() {
  const { login, register, googleEnabled } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ nome: '', email: '', senha: '', senha2: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        if (form.senha !== form.senha2) {
          setError('As senhas não conferem.');
          return;
        }
        await register({ nome: form.nome, email: form.email, senha: form.senha });
      } else {
        await login(form.email, form.senha);
      }
    } catch (err) {
      setError(err.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    window.location.href = '/auth/google';
  }

  return (
    <div className="auth-screen auth-screen-space">
      <SpaceBackground />
      <div className="auth-card auth-card-glass">
        <div className="auth-logo">
          <Logo />
        </div>

        <h1 className="auth-title">
          {mode === 'login' ? 'Bem-vindo de volta' : 'Criar sua conta'}
        </h1>
        <p className="auth-sub">
          {mode === 'login'
            ? 'Entre para acessar o painel da Spacefy Finance.'
            : 'Preencha os dados para criar uma nova conta.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="field field-full">
              <label>Nome</label>
              <input
                value={form.nome}
                onChange={(e) => update('nome', e.target.value)}
                placeholder="Seu nome completo"
                required
                autoFocus
              />
            </div>
          )}
          <div className="field field-full">
            <label>E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="voce@exemplo.com"
              required
              autoFocus={mode === 'login'}
            />
          </div>
          <PasswordField
            label="Senha"
            value={form.senha}
            onChange={(e) => update('senha', e.target.value)}
            placeholder={mode === 'register' ? 'Ao menos 6 caracteres' : 'Sua senha'}
            minLength={6}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
          {mode === 'register' && (
            <PasswordField
              label="Confirmar senha"
              value={form.senha2}
              onChange={(e) => update('senha2', e.target.value)}
              placeholder="Repita a senha"
              minLength={6}
              autoComplete="new-password"
            />
          )}

          {error && <div className="auth-error">{error}</div>}

          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="auth-divider"><span>ou</span></div>

        <button
          className="btn btn-google"
          onClick={handleGoogle}
          disabled={!googleEnabled}
          title={googleEnabled ? '' : 'Google OAuth não configurado no servidor'}
        >
          <GoogleIcon />
          {mode === 'login' ? 'Continuar com Google' : 'Cadastrar com Google'}
        </button>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              Não tem conta?{' '}
              <button type="button" className="auth-link" onClick={() => { setMode('register'); setError(''); }}>
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button type="button" className="auth-link" onClick={() => { setMode('login'); setError(''); }}>
                Entrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

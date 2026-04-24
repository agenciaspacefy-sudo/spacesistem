import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth } from './api/client.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  const reload = useCallback(async () => {
    // Usamos allSettled pra garantir que uma falha (ex.: /auth/me devolvendo 500)
    // não derrube a leitura do /auth/config — que é quem habilita o botão do Google.
    const [meR, cfgR] = await Promise.allSettled([auth.me(), auth.config()]);

    if (meR.status === 'fulfilled') setUser(meR.value?.user || null);
    else setUser(null);

    if (cfgR.status === 'fulfilled') {
      setGoogleEnabled(!!cfgR.value?.googleEnabled);
    } else {
      setGoogleEnabled(false);
      // Log pra facilitar debug em produção (DevTools → Console)
      console.warn('[auth] Falha ao carregar /auth/config:', cfgR.reason);
    }

    setLoaded(true);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    function onUnauthorized() { setUser(null); }
    window.addEventListener('spacefy:unauthenticated', onUnauthorized);
    return () => window.removeEventListener('spacefy:unauthenticated', onUnauthorized);
  }, []);

  async function login(email, senha) {
    const { user } = await auth.login(email, senha);
    setUser(user);
    return user;
  }

  async function register(data) {
    const { user } = await auth.register(data);
    setUser(user);
    return user;
  }

  async function logout() {
    await auth.logout();
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, loaded, googleEnabled, login, register, logout, reload }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

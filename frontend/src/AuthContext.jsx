import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth } from './api/client.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [me, cfg] = await Promise.all([auth.me(), auth.config()]);
      setUser(me.user || null);
      setGoogleEnabled(!!cfg.googleEnabled);
    } catch {
      setUser(null);
    } finally {
      setLoaded(true);
    }
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

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { formatBRL, MASKED_BRL, maskCnpj, maskWhatsapp } from './utils.js';

/**
 * Modo privacidade: oculta valores monetários, CNPJs e WhatsApps na tela.
 *
 * Uso:
 *   const { privacy, togglePrivacy } = usePrivacy();
 *   const fmt = useFormatBRL();
 *   return <span>{fmt(rec.valor)}</span>;
 *
 * IMPORTANTE: exports (PDF, WhatsApp templates, notificações push) NÃO devem
 * usar esses hooks — eles precisam do valor real. Para essas saídas, continue
 * usando formatBRL / valor cru direto do utils.js.
 */

const KEY = 'spacefy-privacy';
const PrivacyCtx = createContext(null);

export function PrivacyProvider({ children }) {
  const [privacy, setPrivacy] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, privacy ? '1' : '0'); } catch {}
  }, [privacy]);

  const togglePrivacy = useCallback(() => setPrivacy((p) => !p), []);

  return (
    <PrivacyCtx.Provider value={{ privacy, togglePrivacy }}>
      {children}
    </PrivacyCtx.Provider>
  );
}

export function usePrivacy() {
  const ctx = useContext(PrivacyCtx);
  if (!ctx) throw new Error('usePrivacy precisa estar dentro de <PrivacyProvider>');
  return ctx;
}

// Formatadores que respeitam o modo privacidade.
// Retornam funções, não strings — então são "estáveis" entre renders quando
// o privacy não muda e forçam re-render quando ele muda.

export function useFormatBRL() {
  const { privacy } = usePrivacy();
  return (value) => (privacy ? MASKED_BRL : formatBRL(value));
}

export function useFormatCnpj() {
  const { privacy } = usePrivacy();
  return (value) => (privacy ? maskCnpj(value) : (value || ''));
}

export function useFormatWhatsapp() {
  const { privacy } = usePrivacy();
  return (value) => (privacy ? maskWhatsapp(value) : (value || ''));
}

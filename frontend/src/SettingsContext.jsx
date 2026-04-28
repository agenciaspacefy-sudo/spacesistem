import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api/client.js';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    nome_agencia: '',
    chave_pix: '',
    whatsapp_dono: '',
    template_cobranca: '',
    logo_data: ''
  });
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const s = await api.getSettings();
    setSettings((prev) => ({ ...prev, ...s }));
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (patch) => {
    const updated = await api.saveSettings(patch);
    setSettings(updated);
    return updated;
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, save, reload: load, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

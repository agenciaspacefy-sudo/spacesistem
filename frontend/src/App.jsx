import { useEffect, useState } from 'react';
import Recebimentos from './components/Recebimentos.jsx';
import Gastos from './components/Gastos.jsx';
import Resumo from './components/Resumo.jsx';
import Clientes from './components/Clientes.jsx';
import Cobrancas from './components/Cobrancas.jsx';
import Tarefas from './components/Tarefas.jsx';
import Configuracoes from './components/Configuracoes.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import Logo from './components/Logo.jsx';
import Alerts from './components/Alerts.jsx';
import { SettingsProvider, useSettings } from './SettingsContext.jsx';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { currentMonth } from './utils.js';
import { registerServiceWorker, requestNotificationPermission } from './notifications.js';

const TABS = [
  { id: 'recebimentos', label: 'Recebimentos' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'cobrancas', label: 'Cobranças' },
  { id: 'resumo', label: 'Resumo Mensal' },
  { id: 'tarefas', label: 'Tarefas' }
];

const TABS_WITH_MES = new Set(['recebimentos', 'gastos', 'resumo']);

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('spacefy-theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('spacefy-theme', theme);
  }, [theme]);

  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function AppShell() {
  const [tab, setTab] = useState('recebimentos');
  const [mesFiltro, setMesFiltro] = useState(currentMonth());
  const [theme, toggleTheme] = useTheme();
  const { settings } = useSettings();
  const { user, logout } = useAuth();

  // Registrar service worker e pedir permissão de notificação uma vez
  useEffect(() => {
    (async () => {
      await registerServiceWorker();
      await requestNotificationPermission();
    })();
  }, []);

  const showMesFilter = TABS_WITH_MES.has(tab);

  return (
    <div className="app">
      <header className="header">
        <Logo customUrl={settings.logo_data || null} />
        <div className="header-actions">
          {user && (
            <div className="user-chip" title={user.email}>
              {user.avatar && <img src={user.avatar} alt="" className="user-avatar" />}
              <span className="user-name">{user.nome}</span>
            </div>
          )}
          <Alerts onNavigate={setTab} />
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            className={`theme-toggle ${tab === 'config' ? 'active' : ''}`}
            onClick={() => setTab('config')}
            title="Configurações"
          >
            <GearIcon />
          </button>
          <button
            className="theme-toggle"
            onClick={logout}
            title="Sair"
          >
            <LogoutIcon />
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {showMesFilter && (
        <div className="toolbar">
          <div className="toolbar-left">
            <span className="label">Filtrar por mês</span>
            <input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} />
            {mesFiltro && (
              <button className="btn btn-ghost btn-sm" onClick={() => setMesFiltro('')}>
                Limpar
              </button>
            )}
          </div>
        </div>
      )}

      <main className="content" style={!showMesFilter ? { paddingTop: 20 } : undefined}>
        {tab === 'recebimentos' && <Recebimentos mesFiltro={mesFiltro} />}
        {tab === 'gastos' && <Gastos mesFiltro={mesFiltro} />}
        {tab === 'clientes' && <Clientes />}
        {tab === 'cobrancas' && <Cobrancas />}
        {tab === 'tarefas' && <Tarefas />}
        {tab === 'resumo' && <Resumo mesFiltro={mesFiltro} />}
        {tab === 'config' && <Configuracoes />}
      </main>
    </div>
  );
}

function AuthGate() {
  const { user, loaded } = useAuth();
  if (!loaded) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-dim)' }}>
        Carregando…
      </div>
    );
  }
  if (!user) return <AuthScreen />;
  return (
    <SettingsProvider>
      <AppShell />
    </SettingsProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Recebimentos from './components/Recebimentos.jsx';
import Gastos from './components/Gastos.jsx';
import Resumo from './components/Resumo.jsx';
import Conteudo from './components/Conteudo.jsx';
import MapaMental from './components/MapaMental.jsx';
import AcceptInvite from './components/AcceptInvite.jsx';
import Clientes from './components/Clientes.jsx';
import Cobrancas from './components/Cobrancas.jsx';
import Tarefas from './components/Tarefas.jsx';
import Agenda from './components/Agenda.jsx';
import Campanhas from './components/Campanhas.jsx';
import Notas from './components/Notas.jsx';
import Configuracoes from './components/Configuracoes.jsx';
import Planos from './components/Planos.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import Alerts from './components/Alerts.jsx';
import Calculator from './components/Calculator.jsx';
import FeedbackWidget from './components/FeedbackWidget.jsx';
import RelatorioPublico from './components/RelatorioPublico.jsx';
import CampanhaPublica from './components/CampanhaPublica.jsx';
import Sidebar, { SidebarMobileToggle } from './components/Sidebar.jsx';
import TrialBadge from './components/TrialBadge.jsx';
import BlockedAccess from './components/BlockedAccess.jsx';
import { SettingsProvider, useSettings } from './SettingsContext.jsx';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { ConfirmProvider } from './ConfirmContext.jsx';
import { PrivacyProvider, usePrivacy } from './PrivacyContext.jsx';
import { ToastProvider } from './ToastContext.jsx';
import { currentMonth } from './utils.js';
import { registerServiceWorker, requestNotificationPermission } from './notifications.js';

const TABS_WITH_MES = new Set(['recebimentos', 'gastos']);

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  recebimentos: 'Recebimentos',
  gastos: 'Pagamentos',
  clientes: 'Clientes',
  cobrancas: 'Cobranças',
  campanhas: 'Campanhas',
  conteudo: 'Calendário de Conteúdo',
  mapa: 'Mapa Mental',
  tarefas: 'Tarefas',
  agenda: 'Agenda',
  notas: 'Notas',
  config: 'Configurações',
  planos: 'Planos'
};

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

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function PrivacyToggle() {
  const { privacy, togglePrivacy } = usePrivacy();
  return (
    <button
      className={`theme-toggle ${privacy ? 'active' : ''}`}
      onClick={togglePrivacy}
      title={privacy ? 'Mostrar valores' : 'Ocultar valores'}
      aria-pressed={privacy}
      aria-label={privacy ? 'Mostrar valores ocultos' : 'Ocultar valores sensíveis'}
    >
      {privacy ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return (
    <span
      className="topbar-clock"
      role="timer"
      aria-live="off"
      title="Hora atual"
    >
      {hh}:{mm}:{ss}
    </span>
  );
}

function AppShell() {
  const { user } = useAuth();
  const abasRestritas = Array.isArray(user?.abas_acesso) && user.abas_acesso.length > 0
    ? user.abas_acesso
    : null;
  const tabInicial = abasRestritas ? abasRestritas[0] : 'dashboard';
  const [tab, setTab] = useState(tabInicial);
  const [mesFiltro, setMesFiltro] = useState(currentMonth());
  const [theme, toggleTheme] = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { settings } = useSettings();

  // Registrar service worker e pedir permissão de notificação uma vez
  useEffect(() => {
    (async () => {
      await registerServiceWorker();
      await requestNotificationPermission();
    })();
  }, []);

  const showMesFilter = TABS_WITH_MES.has(tab);
  const pageTitle = PAGE_TITLES[tab] || '';

  return (
    <div className="app app-with-sidebar">
      <Sidebar
        tab={tab}
        onTab={setTab}
        theme={theme}
        onToggleTheme={toggleTheme}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <SidebarMobileToggle onClick={() => setMobileNavOpen(true)} />
            <h1 className="topbar-title">{pageTitle}</h1>
          </div>
          <div className="topbar-actions">
            <Clock />
            <TrialBadge onClickPlanos={() => setTab('planos')} />
            <Calculator />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <Alerts onNavigate={setTab} />
            <PrivacyToggle />
          </div>
        </header>

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
          {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
          {tab === 'recebimentos' && <Recebimentos mesFiltro={mesFiltro} />}
          {tab === 'gastos' && <Gastos mesFiltro={mesFiltro} />}
          {tab === 'clientes' && <Clientes />}
          {tab === 'cobrancas' && <Cobrancas />}
          {tab === 'campanhas' && <Campanhas />}
          {tab === 'conteudo' && <Conteudo />}
          {tab === 'mapa' && <MapaMental />}
          {tab === 'tarefas' && <Tarefas />}
          {tab === 'agenda' && <Agenda />}
          {tab === 'notas' && <Notas />}
          {tab === 'config' && <Configuracoes />}
          {tab === 'planos' && <Planos />}
        </main>
      </div>
      <FeedbackWidget />
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

  // Trial expirado / sem assinatura → bloqueia totalmente o sistema.
  // Não monta SettingsProvider nem chamadas para /api (que retornariam 402).
  if (user.billing?.expirado) {
    return <BlockedAccess />;
  }

  return (
    <SettingsProvider>
      <PrivacyProvider>
        <AppShell />
      </PrivacyProvider>
    </SettingsProvider>
  );
}

// Router público minimalista: relatório aberto não usa AuthProvider
// (sem toast de 401, sem sidebar, sem tema escuro forçado)
function publicReportToken() {
  const m = window.location.pathname.match(/^\/relatorio\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function publicCampanhaToken() {
  const m = window.location.pathname.match(/^\/campanha\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function publicConviteToken() {
  const m = window.location.pathname.match(/^\/convite\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function App() {
  const token = publicReportToken();
  if (token) return <RelatorioPublico token={token} />;
  const campToken = publicCampanhaToken();
  if (campToken) return <CampanhaPublica token={campToken} />;
  const conviteToken = publicConviteToken();
  if (conviteToken) return <AcceptInvite token={conviteToken} />;

  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthGate />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

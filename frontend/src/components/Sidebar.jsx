import { useEffect, useState } from 'react';
import { LogoMark } from './Logo.jsx';
import { useAuth } from '../AuthContext.jsx';

// --------------- Ícones (stroke, 20px) ---------------
function Icon({ children }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function IconDashboard() {
  return (
    <Icon>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Icon>
  );
}
function IconRecebimentos() {
  return (
    <Icon>
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Icon>
  );
}
function IconGastos() {
  return (
    <Icon>
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </Icon>
  );
}
function IconClientes() {
  return (
    <Icon>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}
function IconCobrancas() {
  return (
    <Icon>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </Icon>
  );
}
function IconTarefas() {
  return (
    <Icon>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Icon>
  );
}
function IconAgenda() {
  return (
    <Icon>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </Icon>
  );
}
function IconResumo() {
  return (
    <Icon>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </Icon>
  );
}
function IconCampanhas() {
  // Megafone
  return (
    <Icon>
      <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z" />
      <path d="M15 8a4 4 0 0 1 0 8" />
      <path d="M18 5a8 8 0 0 1 0 14" />
    </Icon>
  );
}
function IconNotas() {
  // Caderno/bloco de notas
  return (
    <Icon>
      <path d="M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <line x1="8" y1="2" x2="8" y2="22" />
      <line x1="11" y1="7" x2="17" y2="7" />
      <line x1="11" y1="11" x2="17" y2="11" />
      <line x1="11" y1="15" x2="15" y2="15" />
    </Icon>
  );
}
function IconGear() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  );
}
function IconSun() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </Icon>
  );
}
function IconMoon() {
  return (
    <Icon>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Icon>
  );
}
function IconLogout() {
  return (
    <Icon>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Icon>
  );
}
function IconMenu() {
  return (
    <Icon>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </Icon>
  );
}

// --------------- Itens do menu ---------------
const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',     Icon: IconDashboard },
  { id: 'recebimentos',label: 'Recebimentos',  Icon: IconRecebimentos },
  { id: 'gastos',      label: 'Gastos',        Icon: IconGastos },
  { id: 'clientes',    label: 'Clientes',      Icon: IconClientes },
  { id: 'cobrancas',   label: 'Cobranças',     Icon: IconCobrancas },
  { id: 'campanhas',   label: 'Campanhas',     Icon: IconCampanhas },
  { id: 'tarefas',     label: 'Tarefas',       Icon: IconTarefas },
  { id: 'agenda',      label: 'Agenda',        Icon: IconAgenda },
  { id: 'notas',       label: 'Notas',         Icon: IconNotas },
  { id: 'resumo',      label: 'Resumo Mensal', Icon: IconResumo }
];

// --------------- Sidebar ---------------
export default function Sidebar({ tab, onTab, theme, onToggleTheme, mobileOpen, onCloseMobile }) {
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState(false);

  // Fecha o menu mobile ao trocar de aba
  useEffect(() => {
    if (mobileOpen) onCloseMobile?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function handleNav(id) {
    onTab(id);
  }

  const sidebarClass = [
    'sidebar',
    expanded ? 'sidebar-expanded' : '',
    mobileOpen ? 'sidebar-mobile-open' : ''
  ].filter(Boolean).join(' ');

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={onCloseMobile} />}
      <aside
        className={sidebarClass}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* --- Topo: logo --- */}
        <div className="sidebar-brand" onClick={() => handleNav('dashboard')} role="button" tabIndex={0}>
          <div className="sidebar-brand-mark">
            <LogoMark size={28} />
          </div>
          <div className="sidebar-brand-text">
            <span>Space</span><span className="accent">System</span>
          </div>
        </div>

        {/* --- Navegação principal --- */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ id, label, Icon: ItemIcon }) => (
            <button
              key={id}
              type="button"
              className={`sidebar-item ${tab === id ? 'active' : ''}`}
              onClick={() => handleNav(id)}
              title={expanded ? undefined : label}
              data-tooltip={label}
            >
              <span className="sidebar-item-icon"><ItemIcon /></span>
              <span className="sidebar-item-label">{label}</span>
            </button>
          ))}
        </nav>

        {/* --- Rodapé: config, tema, avatar, logout --- */}
        <div className="sidebar-footer">
          <button
            type="button"
            className={`sidebar-item ${tab === 'config' ? 'active' : ''}`}
            onClick={() => handleNav('config')}
            title={expanded ? undefined : 'Configurações'}
            data-tooltip="Configurações"
          >
            <span className="sidebar-item-icon"><IconGear /></span>
            <span className="sidebar-item-label">Configurações</span>
          </button>

          <button
            type="button"
            className="sidebar-item"
            onClick={onToggleTheme}
            title={expanded ? undefined : (theme === 'dark' ? 'Tema claro' : 'Tema escuro')}
            data-tooltip={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          >
            <span className="sidebar-item-icon">
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </span>
            <span className="sidebar-item-label">
              {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            </span>
          </button>

          {user && (
            <div
              className="sidebar-user"
              title={expanded ? undefined : (user.nome || user.email)}
              data-tooltip={user.nome || user.email}
            >
              <span className="sidebar-user-avatar">
                {user.avatar
                  ? <img src={user.avatar} alt="" />
                  : (user.nome || user.email || '?').charAt(0).toUpperCase()}
              </span>
              <span className="sidebar-user-name" title={user.email}>
                {user.nome || user.email}
              </span>
            </div>
          )}

          <button
            type="button"
            className="sidebar-item sidebar-item-danger"
            onClick={logout}
            title={expanded ? undefined : 'Sair'}
            data-tooltip="Sair"
          >
            <span className="sidebar-item-icon"><IconLogout /></span>
            <span className="sidebar-item-label">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// Botão hamburguer mostrado apenas em mobile (no header)
export function SidebarMobileToggle({ onClick }) {
  return (
    <button
      type="button"
      className="sidebar-mobile-toggle"
      aria-label="Abrir menu"
      onClick={onClick}
    >
      <IconMenu />
    </button>
  );
}

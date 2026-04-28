import { useAuth } from '../AuthContext.jsx';

/**
 * Banner sutil de trial — aparece no topo do app quando o usuário está
 * em período de teste. Cor muda conforme se aproxima do fim:
 *   > 3 dias  → azul (info)
 *   ≤ 3 dias  → amarelo (warning)
 *   ≤ 1 dia   → vermelho (urgente)
 */
export default function TrialBanner({ onClickPlanos }) {
  const { user } = useAuth();
  const billing = user?.billing;
  if (!billing || !billing.em_trial) return null;

  const days = billing.days_left ?? 0;

  let variant = 'info';
  if (days <= 1) variant = 'urgent';
  else if (days <= 3) variant = 'warn';

  const label = days === 0
    ? 'Seu teste expira hoje'
    : days === 1
      ? 'Resta 1 dia no seu período de teste'
      : `Você está no período de teste — ${days} dias restantes`;

  return (
    <div className={`trial-banner trial-banner-${variant}`} role="status">
      <span className="trial-banner-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </span>
      <span className="trial-banner-text">{label}</span>
      <button
        type="button"
        className="trial-banner-cta"
        onClick={onClickPlanos}
      >
        Ver planos
      </button>
    </div>
  );
}

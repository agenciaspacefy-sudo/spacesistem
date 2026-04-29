import { useAuth } from '../AuthContext.jsx';

/**
 * Pílula no header mostrando dias restantes do trial.
 *  - 1 a 3 dias: amarela com pulso
 *  - 0 dias / expirado: vermelha (também mostrada após o trial terminar)
 *  - mais que 3: azul (accent)
 *
 * Clique navega para a aba Planos.
 */
export default function TrialBadge({ onClickPlanos }) {
  const { user } = useAuth();
  const billing = user?.billing;
  if (!billing) return null;
  // Apenas mostramos enquanto está em trial OU quando expirou (até assinar).
  if (!billing.em_trial && !billing.expirado) return null;

  const days = billing.days_left ?? 0;
  let variant = 'info';
  if (billing.expirado) variant = 'urgent';
  else if (days <= 1) variant = 'urgent';
  else if (days <= 3) variant = 'warn';

  const label = billing.expirado
    ? 'Plano expirado'
    : days === 0
      ? 'Hoje é o último dia'
      : `${days} ${days === 1 ? 'dia' : 'dias'} de teste restantes`;

  const display = billing.expirado ? '!' : `${days}d`;

  return (
    <button
      type="button"
      className={`trial-badge trial-badge-${variant}`}
      onClick={onClickPlanos}
      title={label}
      aria-label={label}
    >
      <span className="trial-badge-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" />
        </svg>
      </span>
      <span className="trial-badge-count">{display}</span>
    </button>
  );
}

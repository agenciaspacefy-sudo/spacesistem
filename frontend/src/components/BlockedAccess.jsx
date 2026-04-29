import { LogoMark } from './Logo.jsx';
import { useAuth } from '../AuthContext.jsx';

const STRIPE_MENSAL = 'https://buy.stripe.com/bJecN53WU2wT5lO2n97ss06';
const STRIPE_ANUAL  = 'https://buy.stripe.com/aFafZheBy0oL5lO6Dp7ss07';

export default function BlockedAccess() {
  const { user, logout } = useAuth();

  return (
    <div className="blocked-access">
      <div className="blocked-card">
        <div className="blocked-logo">
          <LogoMark size={56} />
        </div>

        <h1 className="blocked-title">Seu período de teste encerrou</h1>
        <p className="blocked-sub">
          Os 14 dias de teste grátis chegaram ao fim. Para continuar usando o
          SpaceSystem, escolha um plano abaixo. Seus dados estão seguros e o
          acesso volta automaticamente assim que a assinatura for confirmada.
        </p>

        <div className="blocked-plans">
          <a
            href={STRIPE_MENSAL}
            target="_blank"
            rel="noopener noreferrer"
            className="blocked-plan-btn"
          >
            <span className="blocked-plan-name">Mensal</span>
            <span className="blocked-plan-price">R$ 109,90<small>/mês</small></span>
          </a>
          <a
            href={STRIPE_ANUAL}
            target="_blank"
            rel="noopener noreferrer"
            className="blocked-plan-btn blocked-plan-btn-primary"
          >
            <span className="blocked-plan-badge">Recomendado</span>
            <span className="blocked-plan-name">Anual</span>
            <span className="blocked-plan-price">R$ 899,90<small>/ano</small></span>
            <span className="blocked-plan-savings">Economize R$ 418,80</span>
          </a>
        </div>

        <p className="blocked-help">
          Já assinou? Aguarde alguns segundos e <button type="button" className="link-btn" onClick={() => window.location.reload()}>recarregue a página</button>.
        </p>

        {user?.email && (
          <div className="blocked-footer">
            Logado como <strong>{user.email}</strong> ·{' '}
            <button type="button" className="link-btn" onClick={logout}>Sair</button>
          </div>
        )}
      </div>
    </div>
  );
}

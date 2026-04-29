export default function Planos() {
  const mensal = 109.90;
  const anualTotal = 899.90;
  const anualNoMes = anualTotal / 12;
  const economia = (mensal * 12) - anualTotal;

  const fmt = (v) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="planos-page">
      <div className="planos-trial-badge">
        <span className="planos-trial-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </span>
        <div className="planos-trial-text">
          <strong>Teste grátis por 14 dias</strong>
          <span>Use todos os recursos sem compromisso. Cancele quando quiser.</span>
        </div>
      </div>

      <div className="planos-section" style={{ marginTop: 0 }}>
        <div className="planos-header">
          <h3>Escolha o seu plano</h3>
          <p>Desbloqueie todos os recursos do SpaceSystem.</p>
        </div>

        <div className="planos-grid">
          {/* Mensal */}
          <div className="plano-card">
            <div className="plano-nome">Mensal</div>
            <div className="plano-preco">
              <span className="plano-preco-moeda">R$</span>
              <span className="plano-preco-valor">{fmt(mensal)}</span>
              <span className="plano-preco-periodo">/mês</span>
            </div>
            <div className="plano-desconto">Flexibilidade total, cancele quando quiser.</div>
            <ul className="plano-features">
              <li>Todos os módulos financeiros e operacionais</li>
              <li>Relatórios públicos ilimitados por cliente</li>
              <li>Notificações automáticas no WhatsApp</li>
              <li>Suporte por e-mail</li>
            </ul>
            <a
              href="https://buy.stripe.com/bJecN53WU2wT5lO2n97ss06"
              target="_blank"
              rel="noopener noreferrer"
              className="plano-btn"
            >
              Assinar mensal
            </a>
          </div>

          {/* Anual */}
          <div className="plano-card plano-card-destaque">
            <span className="plano-badge">Mais popular</span>
            <div className="plano-nome">Anual</div>
            <div className="plano-preco">
              <span className="plano-preco-moeda">R$</span>
              <span className="plano-preco-valor">{fmt(anualTotal)}</span>
              <span className="plano-preco-periodo">/ano</span>
            </div>
            <div className="plano-desconto">
              <s>R$ {fmt(mensal * 12)}</s>
              <span>•</span>
              <strong>Economize R$ {fmt(economia)}</strong>
            </div>
            <ul className="plano-features">
              <li>Equivale a R$ {fmt(anualNoMes)}/mês</li>
              <li>Todos os módulos financeiros e operacionais</li>
              <li>Relatórios públicos ilimitados por cliente</li>
              <li>Notificações automáticas no WhatsApp</li>
              <li>Suporte prioritário</li>
            </ul>
            <a
              href="https://buy.stripe.com/aFafZheBy0oL5lO6Dp7ss07"
              target="_blank"
              rel="noopener noreferrer"
              className="plano-btn"
            >
              Assinar anual
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

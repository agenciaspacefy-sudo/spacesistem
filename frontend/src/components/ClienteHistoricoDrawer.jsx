import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { formatDate } from '../utils.js';
import { useFormatBRL } from '../PrivacyContext.jsx';

function StatusBadge({ value }) {
  const cls =
    value === 'Pago' ? 'badge-pago' :
    value === 'Atrasado' ? 'badge-atrasado' : 'badge-pendente';
  return <span className={`badge ${cls}`}>{value || 'Pendente'}</span>;
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function tempoComoCliente(dataISO) {
  if (!dataISO) return '—';
  const inicio = new Date(dataISO);
  if (isNaN(inicio.getTime())) return '—';
  const hoje = new Date();
  const meses = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
  if (meses < 1) {
    const dias = Math.floor((hoje - inicio) / (1000 * 60 * 60 * 24));
    return `${dias} dia${dias === 1 ? '' : 's'}`;
  }
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const anos = Math.floor(meses / 12);
  const restoMeses = meses % 12;
  if (restoMeses === 0) return `${anos} ano${anos === 1 ? '' : 's'}`;
  return `${anos}a ${restoMeses}m`;
}

export default function ClienteHistoricoDrawer({ cliente, onClose }) {
  const fmtBRL = useFormatBRL();
  const [cobrancas, setCobrancas] = useState([]);
  const [recebimentos, setRecebimentos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cliente) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [cobs, recs] = await Promise.all([
          api.listCobrancas().catch(() => []),
          api.listRecebimentos().catch(() => [])
        ]);
        if (!alive) return;
        setCobrancas((cobs || []).filter((c) => c.cliente_id === cliente.id));
        setRecebimentos((recs || []).filter((r) => r.cliente_id === cliente.id));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [cliente]);

  // Fecha no Esc
  useEffect(() => {
    if (!cliente) return;
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cliente, onClose]);

  const totais = useMemo(() => {
    const recebido =
      cobrancas.filter((c) => c.status === 'Pago').reduce((s, c) => s + Number(c.valor || 0), 0) +
      recebimentos.filter((r) => r.status === 'Pago').reduce((s, r) => s + Number(r.valor || 0), 0);
    const aberto =
      cobrancas.filter((c) => c.status !== 'Pago').reduce((s, c) => s + Number(c.valor || 0), 0) +
      recebimentos.filter((r) => r.status !== 'Pago').reduce((s, r) => s + Number(r.valor || 0), 0);
    return { recebido, aberto };
  }, [cobrancas, recebimentos]);

  const primeiroLancamento = useMemo(() => {
    const datas = [
      ...cobrancas.map((c) => c.vencimento || c.created_at),
      ...recebimentos.map((r) => r.data || r.created_at),
      cliente?.created_at
    ].filter(Boolean).map((d) => String(d).slice(0, 10));
    if (datas.length === 0) return null;
    return datas.sort()[0];
  }, [cobrancas, recebimentos, cliente]);

  const cobrancasOrdenadas = useMemo(() => {
    return [...cobrancas].sort((a, b) => (b.vencimento || '').localeCompare(a.vencimento || ''));
  }, [cobrancas]);

  if (!cliente) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Histórico do cliente">
        <header className="drawer-header">
          <div>
            <div className="drawer-title">{cliente.nome}</div>
            <div className="drawer-sub">
              {cliente.cnpj ? cliente.cnpj : 'Sem CNPJ cadastrado'}
            </div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Fechar">
            <CloseIcon />
          </button>
        </header>

        <div className="drawer-body">
          <div className="drawer-stats">
            <div className="drawer-stat">
              <div className="drawer-stat-label">Total recebido</div>
              <div className="drawer-stat-value pos">{fmtBRL(totais.recebido)}</div>
            </div>
            <div className="drawer-stat">
              <div className="drawer-stat-label">Em aberto</div>
              <div className="drawer-stat-value">{fmtBRL(totais.aberto)}</div>
            </div>
            <div className="drawer-stat">
              <div className="drawer-stat-label">Tempo como cliente</div>
              <div className="drawer-stat-value">{tempoComoCliente(primeiroLancamento)}</div>
              {primeiroLancamento && (
                <div className="drawer-stat-sub">desde {formatDate(primeiroLancamento)}</div>
              )}
            </div>
          </div>

          <section className="drawer-section">
            <h4>Cobranças ({cobrancasOrdenadas.length})</h4>
            {loading ? (
              <div className="empty-state">Carregando…</div>
            ) : cobrancasOrdenadas.length === 0 ? (
              <div className="empty-state">Nenhuma cobrança cadastrada para este cliente.</div>
            ) : (
              <ul className="drawer-list">
                {cobrancasOrdenadas.map((c) => (
                  <li key={c.id} className="drawer-list-item">
                    <div className="drawer-list-main">
                      <div className="drawer-list-title">
                        {c.descricao || <em style={{ color: 'var(--text-mute)' }}>Sem descrição</em>}
                      </div>
                      <div className="drawer-list-sub">
                        Venc. {c.vencimento ? formatDate(c.vencimento) : '—'}
                        {c.data_pagamento && ` · Pago em ${formatDate(c.data_pagamento)}`}
                      </div>
                    </div>
                    <div className="drawer-list-right">
                      <div className="drawer-list-value mono">{fmtBRL(c.valor)}</div>
                      <StatusBadge value={c.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {recebimentos.length > 0 && (
            <section className="drawer-section">
              <h4>Recebimentos ({recebimentos.length})</h4>
              <ul className="drawer-list">
                {recebimentos
                  .slice()
                  .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
                  .map((r) => (
                    <li key={r.id} className="drawer-list-item">
                      <div className="drawer-list-main">
                        <div className="drawer-list-title">{r.servico || '—'}</div>
                        <div className="drawer-list-sub">
                          {r.data ? formatDate(r.data) : '—'} · Ref. {r.mes_ref}
                        </div>
                      </div>
                      <div className="drawer-list-right">
                        <div className="drawer-list-value mono">{fmtBRL(r.valor)}</div>
                        <StatusBadge value={r.status} />
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="drawer-footer">
          <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
        </footer>
      </aside>
    </div>
  );
}

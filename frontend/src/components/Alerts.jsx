import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { formatDate, todayISO } from '../utils.js';
import { useFormatBRL } from '../PrivacyContext.jsx';

const POLL_MS = 5 * 60 * 1000; // 5 minutos

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function CobrancaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function TarefaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function classifyCobranca(c, hoje) {
  if (c.status === 'Pago') return null;
  if (!c.vencimento) return null;
  if (c.vencimento < hoje) return 'atrasada';
  if (c.vencimento === hoje) return 'hoje';
  return null;
}

function classifyTarefa(t, hoje) {
  if (t.status === 'Concluído') return null;
  if (!t.data_limite) return null;
  if (t.data_limite < hoje) return 'atrasada';
  if (t.data_limite === hoje) return 'hoje';
  return null;
}

export default function Alerts({ onNavigate }) {
  const fmtBRL = useFormatBRL();
  const [open, setOpen] = useState(false);
  const [cobrancas, setCobrancas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSeenSignature, setLastSeenSignature] = useState(() => {
    return localStorage.getItem('spacefy-alerts-seen') || '';
  });
  const dropdownRef = useRef(null);
  const btnRef = useRef(null);

  async function loadAlerts() {
    setLoading(true);
    try {
      const [cobs, ts] = await Promise.all([
        api.listCobrancas().catch(() => []),
        api.listTarefas().catch(() => [])
      ]);
      setCobrancas(cobs || []);
      setTarefas(ts || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
    const timer = setInterval(loadAlerts, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (dropdownRef.current?.contains(e.target)) return;
      if (btnRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  // Fecha com Esc
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const hoje = todayISO();

  const cobAlertas = useMemo(() => {
    return cobrancas
      .map((c) => ({ ...c, _alertType: classifyCobranca(c, hoje) }))
      .filter((c) => c._alertType)
      .sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
  }, [cobrancas, hoje]);

  const tarAlertas = useMemo(() => {
    return tarefas
      .map((t) => ({ ...t, _alertType: classifyTarefa(t, hoje) }))
      .filter((t) => t._alertType)
      .sort((a, b) => (a.data_limite || '').localeCompare(b.data_limite || ''));
  }, [tarefas, hoje]);

  const total = cobAlertas.length + tarAlertas.length;

  // Assinatura baseada nos IDs + tipo — muda quando novos alertas aparecem
  const currentSignature = useMemo(() => {
    const parts = [
      ...cobAlertas.map((c) => `c${c.id}:${c._alertType}`),
      ...tarAlertas.map((t) => `t${t.id}:${t._alertType}`)
    ];
    return parts.join('|');
  }, [cobAlertas, tarAlertas]);

  const temNovos = total > 0 && currentSignature !== lastSeenSignature;

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      // Ao abrir, marca os alertas como vistos (zera o badge vermelho)
      setLastSeenSignature(currentSignature);
      localStorage.setItem('spacefy-alerts-seen', currentSignature);
    }
  }

  function handleClickAlert(type) {
    setOpen(false);
    if (type === 'cobranca') onNavigate?.('cobrancas');
    else if (type === 'tarefa') onNavigate?.('tarefas');
  }

  return (
    <div className="alerts-wrap">
      <button
        ref={btnRef}
        className={`theme-toggle alerts-btn ${open ? 'active' : ''}`}
        onClick={handleToggle}
        title={total > 0 ? `${total} alerta(s)` : 'Sem alertas'}
        aria-label="Abrir alertas"
      >
        <BellIcon />
        {total > 0 && (
          <span className={`alerts-badge ${temNovos ? 'pulse' : 'dim'}`}>
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div ref={dropdownRef} className="alerts-dropdown" role="menu">
          <div className="alerts-dropdown-header">
            <strong>Alertas</strong>
            <span className="alerts-dropdown-sub">
              {loading ? 'Atualizando…' : total === 0 ? 'Tudo em dia ✓' : `${total} item(s)`}
            </span>
          </div>

          <div className="alerts-dropdown-body">
            {total === 0 && !loading && (
              <div className="alerts-empty">
                Nenhuma cobrança ou tarefa pendente para hoje.
              </div>
            )}

            {cobAlertas.length > 0 && (
              <div className="alerts-section">
                <div className="alerts-section-title">Cobranças</div>
                {cobAlertas.map((c) => (
                  <button
                    key={`c-${c.id}`}
                    className={`alert-item alert-${c._alertType}`}
                    onClick={() => handleClickAlert('cobranca')}
                  >
                    <span className="alert-item-icon"><CobrancaIcon /></span>
                    <span className="alert-item-body">
                      <span className="alert-item-title">
                        {c.cliente_nome || 'Cliente removido'}
                        <span className={`alert-tag alert-tag-${c._alertType}`}>
                          {c._alertType === 'atrasada' ? 'Atrasada' : 'Vence hoje'}
                        </span>
                      </span>
                      <span className="alert-item-sub">
                        {fmtBRL(c.valor)} • {c.vencimento ? formatDate(c.vencimento) : '—'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {tarAlertas.length > 0 && (
              <div className="alerts-section">
                <div className="alerts-section-title">Tarefas</div>
                {tarAlertas.map((t) => (
                  <button
                    key={`t-${t.id}`}
                    className={`alert-item alert-${t._alertType}`}
                    onClick={() => handleClickAlert('tarefa')}
                  >
                    <span className="alert-item-icon"><TarefaIcon /></span>
                    <span className="alert-item-body">
                      <span className="alert-item-title">
                        {t.titulo}
                        <span className={`alert-tag alert-tag-${t._alertType}`}>
                          {t._alertType === 'atrasada' ? 'Atrasada' : 'Hoje'}
                        </span>
                      </span>
                      <span className="alert-item-sub">
                        {t.data_limite ? formatDate(t.data_limite) : '—'}
                        {t.cliente_nome ? ` • ${t.cliente_nome}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

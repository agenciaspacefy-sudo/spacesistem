import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { LogoMark } from './Logo.jsx';
import { fetchCampanhaPublica } from '../api/client.js';

function formatBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function roasClass(roas) {
  if (roas >= 6) return 'rp-roas-alto';
  if (roas >= 3) return 'rp-roas-medio';
  return 'rp-roas-baixo';
}

function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'ativa') return 'badge-pago';
  if (s === 'pausada') return 'badge-pendente';
  return 'badge-neutral';
}

function fmtMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

export default function CampanhaPublica({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-public-report', 'true');
    return () => document.documentElement.removeAttribute('data-public-report');
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const r = await fetchCampanhaPublica(token);
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setErro(e?.message || 'Erro ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="relatorio-publico relatorio-publico-centered">
        <p className="relatorio-publico-msg">Carregando…</p>
      </div>
    );
  }

  if (erro || !data) {
    return (
      <div className="relatorio-publico relatorio-publico-centered">
        <div className="relatorio-publico-notfound">
          <h1>Campanha não encontrada</h1>
          <p>O link pode ter expirado ou foi revogado pela agência.</p>
        </div>
      </div>
    );
  }

  const { campanha, metrics, historico, atualizado_em } = data;
  const roas = metrics.roas || 0;
  const meta = 6;
  const progressoMeta = Math.min(100, (roas / meta) * 100);

  const chartData = (historico || []).map((h) => ({
    mes: fmtMonth(h.ano_mes),
    ROAS: Number(h.roas || 0),
    Investimento: Number(h.investimento || 0),
    Resultado: Number(h.resultado || 0)
  }));

  const atualizadoStr = atualizado_em
    ? new Date(atualizado_em).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : '';

  return (
    <div className="relatorio-publico">
      <header className="rp-header">
        <div className="rp-header-inner">
          <div className="rp-brand">
            <LogoMark size={36} bg="#FFFFFF" />
            <div>
              <div className="rp-brand-name">SpaceSystem</div>
              <div className="rp-brand-sub">Spacefy Marketing</div>
            </div>
          </div>
          <div className="rp-header-meta">
            <div className="rp-cliente">{campanha.cliente_nome || 'Cliente'}</div>
            <div className="rp-update">Atualizado {atualizadoStr}</div>
          </div>
        </div>
      </header>

      <main className="rp-main">
        <section>
          <h1 className="rp-title">{campanha.nome}</h1>
          <div className="rp-subtitle">
            <span className="rp-pill">{campanha.plataforma}</span>
            <span className="rp-pill">{campanha.objetivo}</span>
            <span className={`badge ${statusClass(campanha.status)}`}>{campanha.status}</span>
            {campanha.data_inicio && (
              <span className="rp-pill">
                Desde {new Date(campanha.data_inicio).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        </section>

        <section className="rp-cards">
          <div className="rp-card">
            <div className="rp-card-label">Investimento atual</div>
            <div className="rp-card-value">{formatBRL(metrics.investimento)}</div>
          </div>
          <div className="rp-card">
            <div className="rp-card-label">Resultado gerado</div>
            <div className="rp-card-value">{formatBRL(metrics.resultado)}</div>
          </div>
          <div className="rp-card">
            <div className="rp-card-label">ROAS</div>
            <div className={`rp-card-value ${roasClass(roas)}`}>{roas.toFixed(2)}x</div>
            <div className="rp-card-meta">Meta {meta}x</div>
          </div>
          <div className="rp-card">
            <div className="rp-card-label">Orçamento mensal</div>
            <div className="rp-card-value">{formatBRL(metrics.orcamento_mensal)}</div>
          </div>
        </section>

        <section className="rp-progress-section">
          <div className="rp-progress-head">
            <span>Progresso para a meta de ROAS {meta}x</span>
            <span><strong>{roas.toFixed(2)}x</strong> / {meta}x</span>
          </div>
          <div className="rp-progress-bar">
            <div
              className={`rp-progress-fill ${
                roas >= meta ? 'rp-progress-alto' : roas >= meta / 2 ? 'rp-progress-medio' : 'rp-progress-baixo'
              }`}
              style={{ width: `${progressoMeta}%` }}
            />
          </div>
        </section>

        <section>
          <h2 className="rp-section-title">Evolução do ROAS</h2>
          {chartData.length === 0 ? (
            <div className="rp-empty">Histórico ainda em construção.</div>
          ) : (
            <div className="rp-chart-wrap">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cp-roas-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1B6FEE" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#1B6FEE" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E2" />
                  <XAxis dataKey="mes" stroke="#6B6B6B" tick={{ fill: '#6B6B6B', fontSize: 12 }} />
                  <YAxis stroke="#6B6B6B" tick={{ fill: '#6B6B6B', fontSize: 12 }} tickFormatter={(v) => `${v}x`} />
                  <Tooltip
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E5E2', borderRadius: 8, fontSize: 13 }}
                    formatter={(v) => [`${Number(v).toFixed(2)}x`, 'ROAS']}
                  />
                  <Area
                    type="monotone"
                    dataKey="ROAS"
                    stroke="#1B6FEE"
                    strokeWidth={2.4}
                    fill="url(#cp-roas-grad)"
                    isAnimationActive={true}
                    animationDuration={650}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </main>

      <footer className="rp-footer">
        Powered by <strong>SpaceSystem</strong> — Spacefy Marketing
      </footer>
    </div>
  );
}

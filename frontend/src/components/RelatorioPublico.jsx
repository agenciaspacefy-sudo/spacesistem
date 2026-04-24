import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { LogoMark } from './Logo.jsx';
import { fetchRelatorioPublico } from '../api/client.js';

// --------------- Helpers ---------------
function brl(v) {
  const n = Number(v) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}

function formatRoas(roas) {
  const n = Number(roas) || 0;
  return `${n.toFixed(2)}x`;
}

function roasTier(roas) {
  const n = Number(roas) || 0;
  if (n >= 6) return 'alto';
  if (n >= 3) return 'medio';
  return 'baixo';
}

function formatAnoMes(anoMes) {
  if (!anoMes) return '';
  const [ano, mes] = anoMes.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const idx = Math.max(0, Math.min(11, Number(mes) - 1));
  return `${nomes[idx]}/${String(ano).slice(-2)}`;
}

function formatDate(iso) {
  if (!iso) return '';
  // Aceita "YYYY-MM-DD" ou ISO completo
  const d = iso.length <= 10 ? new Date(iso + 'T00:00:00') : new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// --------------- Página ---------------
export default function RelatorioPublico({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Meta <meta name="robots" content="noindex, nofollow"> em runtime
  useEffect(() => {
    const prevTitle = document.title;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    document.documentElement.setAttribute('data-public-report', 'true');
    return () => {
      meta.remove();
      document.documentElement.removeAttribute('data-public-report');
      document.title = prevTitle;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchRelatorioPublico(token);
        if (cancel) return;
        setData(res);
        document.title = `Relatório — ${res.cliente?.nome || 'Cliente'} • SpaceSystem`;
      } catch (e) {
        if (cancel) return;
        setError(e.message || 'Erro ao carregar');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="relatorio-publico relatorio-publico-centered">
        <p className="relatorio-publico-msg">Carregando relatório…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="relatorio-publico relatorio-publico-centered">
        <div className="relatorio-publico-notfound">
          <h1>Relatório não encontrado</h1>
          <p>O link pode ter expirado ou sido revogado. Entre em contato com a Spacefy Marketing para um novo link.</p>
        </div>
      </div>
    );
  }

  const { cliente, atualizado_em, resumo, campanhas, historico, reunioes } = data;
  const roasAtual = Number(resumo?.roas_atual) || 0;
  const metaRoas = Number(resumo?.meta_roas) || 6;
  const progressoMeta = Math.min(100, (roasAtual / metaRoas) * 100);

  // Série do gráfico: histórico (já vem ordenado asc)
  const chartData = (historico || []).map((h) => ({
    mes: formatAnoMes(h.ano_mes),
    ROAS: Number(Number(h.roas || 0).toFixed(2))
  }));

  return (
    <div className="relatorio-publico">
      {/* --- Cabeçalho --- */}
      <header className="rp-header">
        <div className="rp-header-inner">
          <div className="rp-brand">
            <div className="rp-brand-mark">
              <LogoMark size={36} bg="#FFFFFF" />
            </div>
            <div className="rp-brand-text">
              <div className="rp-brand-name">
                <span>Space</span><span className="rp-accent">System</span>
              </div>
              <div className="rp-brand-agency">Spacefy Marketing</div>
            </div>
          </div>
          <div className="rp-header-meta">
            <div className="rp-updated-label">Última atualização</div>
            <div className="rp-updated-value">{formatDateTime(atualizado_em)}</div>
          </div>
        </div>
      </header>

      <main className="rp-main">
        <div className="rp-title-block">
          <h1 className="rp-title">Relatório de Campanhas</h1>
          <div className="rp-cliente">{cliente?.nome}</div>
        </div>

        {/* --- Cards de resumo --- */}
        <section className="rp-cards">
          <div className="rp-card">
            <div className="rp-card-label">Total investido no mês</div>
            <div className="rp-card-value">{brl(resumo?.total_investido)}</div>
          </div>
          <div className="rp-card">
            <div className="rp-card-label">Resultado gerado</div>
            <div className="rp-card-value">{brl(resumo?.total_resultado)}</div>
          </div>
          <div className="rp-card">
            <div className="rp-card-label">ROAS atual</div>
            <div className={`rp-card-value rp-roas-${roasTier(roasAtual)}`}>{formatRoas(roasAtual)}</div>
          </div>
          <div className="rp-card">
            <div className="rp-card-label">Meta de ROAS</div>
            <div className="rp-card-value rp-card-value-muted">{formatRoas(metaRoas)}</div>
          </div>
        </section>

        {/* --- Barra de progresso vs meta --- */}
        <section className="rp-progress-block">
          <div className="rp-progress-head">
            <span className="rp-progress-label">Progresso até a meta de {formatRoas(metaRoas)}</span>
            <span className="rp-progress-value">{progressoMeta.toFixed(0)}%</span>
          </div>
          <div className="rp-progress-bar">
            <div
              className={`rp-progress-fill rp-progress-${roasTier(roasAtual)}`}
              style={{ width: `${progressoMeta}%` }}
            />
          </div>
          <div className="rp-progress-scale">
            <span>0x</span>
            <span>{formatRoas(metaRoas)}</span>
          </div>
        </section>

        {/* --- Tabela de campanhas --- */}
        <section className="rp-section">
          <h2 className="rp-section-title">Campanhas ativas</h2>
          {campanhas?.length === 0 ? (
            <div className="rp-empty">Nenhuma campanha ativa no momento.</div>
          ) : (
            <div className="rp-table-wrap">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>Campanha</th>
                    <th>Plataforma</th>
                    <th className="rp-num">Investimento</th>
                    <th className="rp-num">Resultado</th>
                    <th className="rp-num">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {campanhas.map((c) => {
                    const roas = (Number(c.investimento_mes) || 0) > 0
                      ? (Number(c.resultado_mes) || 0) / Number(c.investimento_mes)
                      : 0;
                    return (
                      <tr key={c.id}>
                        <td className="rp-td-nome">{c.nome}</td>
                        <td>
                          <span className="rp-platform-pill">{c.plataforma}</span>
                        </td>
                        <td className="rp-num">{brl(c.investimento_mes)}</td>
                        <td className="rp-num">{brl(c.resultado_mes)}</td>
                        <td className="rp-num">
                          <span className={`rp-roas-badge rp-roas-badge-${roasTier(roas)}`}>
                            {formatRoas(roas)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* --- Gráfico evolução ROAS --- */}
        <section className="rp-section">
          <h2 className="rp-section-title">Evolução do ROAS (últimos 6 meses)</h2>
          {chartData.length === 0 ? (
            <div className="rp-empty">Sem histórico suficiente ainda.</div>
          ) : (
            <div className="rp-chart-wrap">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEAE4" />
                  <XAxis dataKey="mes" stroke="#6B6762" tick={{ fill: '#6B6762', fontSize: 12 }} />
                  <YAxis stroke="#6B6762" tick={{ fill: '#6B6762', fontSize: 12 }} tickFormatter={(v) => `${v}x`} />
                  <Tooltip
                    contentStyle={{ background: '#FFF', border: '1px solid #E6E1D9', borderRadius: 8, fontSize: 13 }}
                    formatter={(v) => [`${Number(v).toFixed(2)}x`, 'ROAS']}
                  />
                  <Line
                    type="monotone"
                    dataKey="ROAS"
                    stroke="#D97757"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#D97757' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* --- Últimas reuniões --- */}
        <section className="rp-section">
          <h2 className="rp-section-title">Últimas atualizações</h2>
          {reunioes?.length === 0 ? (
            <div className="rp-empty">Nenhuma reunião registrada ainda.</div>
          ) : (
            <ul className="rp-reunioes">
              {reunioes.map((r, idx) => (
                <li key={idx} className="rp-reuniao">
                  <div className="rp-reuniao-head">
                    <span className="rp-reuniao-data">{formatDate(r.data)}</span>
                    {r.campanha_nome && <span className="rp-reuniao-camp">{r.campanha_nome}</span>}
                  </div>
                  {r.decisoes && (
                    <div className="rp-reuniao-block">
                      <div className="rp-reuniao-label">Decisões</div>
                      <div className="rp-reuniao-text">{r.decisoes}</div>
                    </div>
                  )}
                  {r.proximos_passos && (
                    <div className="rp-reuniao-block">
                      <div className="rp-reuniao-label">Próximos passos</div>
                      <div className="rp-reuniao-text">{r.proximos_passos}</div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="rp-footer">
        Powered by <strong>SpaceSystem</strong> • Spacefy Marketing
      </footer>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { api } from '../api/client.js';
import {
  currentMonth,
  formatDate,
  lastNMonths,
  monthLabel,
  todayISO
} from '../utils.js';
import { useFormatBRL, usePrivacy } from '../PrivacyContext.jsx';
import { useSettings } from '../SettingsContext.jsx';
import { generateMonthlyReport } from '../reportPdf.js';
import RecebimentosChart from './RecebimentosChart.jsx';

function endOfWeekISO(baseIso) {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 6);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function DashCard({ label, value, variant }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className={`card-value ${variant || ''}`}>{value}</div>
    </div>
  );
}

function PrioBadge({ prio }) {
  const cls =
    prio === 'Alta' ? 'badge-atrasado' :
    prio === 'Média' ? 'badge-pendente' : 'badge-neutral';
  return <span className={`badge ${cls}`}>{prio || 'Média'}</span>;
}

function ReceitaChartTooltip({ active, payload, label }) {
  const fmtBRL = useFormatBRL();
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-dot" style={{ background: 'var(--color-accent)' }} />
        <span>Recebido:</span>
        <strong className="mono">{fmtBRL(payload[0].value)}</strong>
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const fmtBRL = useFormatBRL();
  const { privacy } = usePrivacy();
  const [cobrancas, setCobrancas] = useState([]);
  const [recebimentos, setRecebimentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [resumo, setResumo] = useState([]);
  const [loading, setLoading] = useState(true);

  const mes = currentMonth();
  const hoje = todayISO();
  const fimSemana = endOfWeekISO(hoje);

  async function load() {
    setLoading(true);
    try {
      const [cobs, recs, cls, tars, res] = await Promise.all([
        api.listCobrancas().catch(() => []),
        api.listRecebimentos(mes).catch(() => []),
        api.listClientes().catch(() => []),
        api.listTarefas().catch(() => []),
        api.resumo().catch(() => [])
      ]);
      setCobrancas(cobs || []);
      setRecebimentos(recs || []);
      setClientes(cls || []);
      setTarefas(tars || []);
      setResumo(res || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    function onCobrancaPaga() { load(); }
    window.addEventListener('spacefy:cobranca-paga', onCobrancaPaga);
    return () => window.removeEventListener('spacefy:cobranca-paga', onCobrancaPaga);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- MRR: soma das cobranças recorrentes não pagas (por cliente)
  // Pega o valor médio por mês de cada grupo de cobranças recorrentes ativas.
  const mrr = useMemo(() => {
    const porCliente = new Map();
    for (const c of cobrancas) {
      if (c.tipo !== 'Recorrência Mensal') continue;
      if (c.status === 'Pago') continue; // conta apenas as ainda ativas
      const key = c.cliente_id ?? c.id;
      if (!porCliente.has(key)) porCliente.set(key, Number(c.valor) || 0);
    }
    return [...porCliente.values()].reduce((s, v) => s + v, 0);
  }, [cobrancas]);

  // ----- Recebido no mês (recebimentos com status Pago no mês atual)
  const recebidoMes = useMemo(
    () => recebimentos.filter((r) => r.status === 'Pago').reduce((s, r) => s + Number(r.valor || 0), 0),
    [recebimentos]
  );

  // ----- A receber no mês (pendente + atrasado no mês atual)
  const aReceberMes = useMemo(
    () => recebimentos.filter((r) => r.status !== 'Pago').reduce((s, r) => s + Number(r.valor || 0), 0),
    [recebimentos]
  );

  // ----- Clientes ativos
  const clientesAtivos = useMemo(
    () => clientes.filter((c) => c.ativo).length,
    [clientes]
  );

  // ----- Cobranças vencendo esta semana (pendentes/atrasadas, venc entre hoje e +6 dias)
  const cobrancasSemana = useMemo(() => {
    return cobrancas
      .filter((c) => c.status !== 'Pago')
      .filter((c) => c.vencimento && c.vencimento >= hoje && c.vencimento <= fimSemana)
      .sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
  }, [cobrancas, hoje, fimSemana]);

  // ----- Tarefas pendentes hoje (data_limite == hoje, status != Concluído)
  const tarefasHoje = useMemo(() => {
    return tarefas
      .filter((t) => t.status !== 'Concluído')
      .filter((t) => t.data_limite === hoje)
      .sort((a, b) => {
        const ordem = { Alta: 0, 'Média': 1, Baixa: 2 };
        return (ordem[a.prioridade] ?? 1) - (ordem[b.prioridade] ?? 1);
      });
  }, [tarefas, hoje]);

  // ----- Dados do gráfico: últimos 6 meses, receita Paga
  const chartData = useMemo(() => {
    const meses = lastNMonths(6);
    const byMes = new Map((resumo || []).map((r) => [r.mes, r]));
    return meses.map((m) => ({
      mes: monthLabel(m),
      Recebido: byMes.get(m)?.receita || 0
    }));
  }, [resumo]);

  const temDadosGrafico = chartData.some((d) => d.Recebido > 0);

  return (
    <div className="dashboard">
      <div className="cards">
        <DashCard label="MRR (recorrente ativo)" value={fmtBRL(mrr)} />
        <DashCard label="Recebido no mês" value={fmtBRL(recebidoMes)} variant="pos" />
        <DashCard label="A receber no mês" value={fmtBRL(aReceberMes)} />
        <DashCard label="Clientes ativos" value={clientesAtivos} />
      </div>

      <RecebimentosChart defaultPeriodo="mes" titulo="Recebimentos no período" />

      <div className="chart-card">
        <div className="chart-header">
          <div>
            <div className="chart-title">Receita recebida (histórico)</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>Últimos 6 meses</div>
          </div>
        </div>
        {!temDadosGrafico ? (
          <div className="empty-state">Ainda não há recebimentos pagos nos últimos 6 meses.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dash-recebido" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1B6FEE" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#4B8FF5" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis
                stroke="var(--text-dim)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                tickFormatter={(v) => {
                  if (privacy) return 'R$ •••';
                  if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
                  return `R$${v}`;
                }}
              />
              <Tooltip content={<ReceitaChartTooltip />} cursor={{ fill: 'var(--row-hover)' }} />
              <Bar dataKey="Recebido" fill="url(#dash-recebido)" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Cobranças vencendo esta semana</h3>
            <button className="btn btn-sm btn-ghost" onClick={() => onNavigate?.('cobrancas')}>
              Ver todas →
            </button>
          </div>
          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : cobrancasSemana.length === 0 ? (
            <div className="empty-state">Nenhuma cobrança vencendo esta semana.</div>
          ) : (
            <ul className="dashboard-list">
              {cobrancasSemana.map((c) => {
                const atrasada = c.vencimento < hoje;
                return (
                  <li key={c.id} className="dashboard-list-item">
                    <div className="dashboard-list-main">
                      <div className="dashboard-list-title">{c.cliente_nome || 'Cliente removido'}</div>
                      <div className="dashboard-list-sub">
                        Venc. {formatDate(c.vencimento)}
                        {atrasada && <span className="badge badge-atrasado" style={{ marginLeft: 6 }}>Atrasada</span>}
                      </div>
                    </div>
                    <div className="dashboard-list-value mono">{fmtBRL(c.valor)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Tarefas pendentes hoje</h3>
            <button className="btn btn-sm btn-ghost" onClick={() => onNavigate?.('tarefas')}>
              Ver todas →
            </button>
          </div>
          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : tarefasHoje.length === 0 ? (
            <div className="empty-state">Nenhuma tarefa para hoje. Bom dia tranquilo ✨</div>
          ) : (
            <ul className="dashboard-list">
              {tarefasHoje.map((t) => (
                <li key={t.id} className="dashboard-list-item">
                  <div className="dashboard-list-main">
                    <div className="dashboard-list-title">{t.titulo}</div>
                    {t.cliente_nome && (
                      <div className="dashboard-list-sub">{t.cliente_nome}</div>
                    )}
                  </div>
                  <PrioBadge prio={t.prioridade} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ----- RESUMO ANUAL (movido da aba Resumo) ----- */}
      <ResumoAnualSection resumo={resumo} fmtBRL={fmtBRL} />
    </div>
  );
}

// =========================================================
// Resumo Anual (antes era aba dedicada)
// =========================================================
function ResumoAnualSection({ resumo, fmtBRL }) {
  const { settings } = useSettings();
  const [anoFiltro, setAnoFiltro] = useState(() => new Date().getFullYear());
  const [exporting, setExporting] = useState(false);

  const anosDisponiveis = useMemo(() => {
    const set = new Set();
    for (const r of resumo) {
      const y = (r.mes || '').slice(0, 4);
      if (y) set.add(Number(y));
    }
    set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [resumo]);

  const filtradas = useMemo(() => {
    return resumo.filter((r) => (r.mes || '').startsWith(String(anoFiltro)));
  }, [resumo, anoFiltro]);

  const totais = useMemo(() => {
    const receita = filtradas.reduce((s, r) => s + r.receita, 0);
    const gastos = filtradas.reduce((s, r) => s + r.gastos, 0);
    const lucro = receita - gastos;
    const margem = receita > 0 ? (lucro / receita) * 100 : 0;
    return { receita, gastos, lucro, margem };
  }, [filtradas]);

  const chartData = useMemo(() => {
    return filtradas
      .slice()
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((r) => ({
        mes: monthLabel(r.mes),
        Receita: r.receita,
        Pagamentos: r.gastos
      }));
  }, [filtradas]);

  async function handleExportPdf() {
    setExporting(true);
    try {
      generateMonthlyReport({
        resumoRows: filtradas,
        recebimentos: [],
        gastos: [],
        mesFiltro: '',
        settings
      });
    } catch (e) {
      alert('Erro ao gerar PDF: ' + (e?.message || e));
    } finally { setExporting(false); }
  }

  return (
    <section className="resumo-anual-section">
      <div className="resumo-anual-header">
        <div>
          <h3 className="resumo-anual-title">Resumo Anual</h3>
          <p className="resumo-anual-sub">Receita, pagamentos, lucro e margem por mês.</p>
        </div>
        <div className="resumo-anual-actions">
          <select
            value={anoFiltro}
            onChange={(e) => setAnoFiltro(Number(e.target.value))}
            title="Ano"
          >
            {anosDisponiveis.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportPdf}
            disabled={exporting || filtradas.length === 0}
          >
            {exporting ? 'Gerando…' : '↓ Exportar PDF'}
          </button>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <div className="chart-header">
            <div className="chart-title">Receita × Pagamentos</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>{anoFiltro}</div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dash-rec-anual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16A34A" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#16A34A" stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id="dash-pag-anual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#DC2626" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#DC2626" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={{ stroke: 'var(--border)' }}
                tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`} />
              <Tooltip
                cursor={{ fill: 'var(--row-hover)' }}
                contentStyle={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 13
                }}
                formatter={(v) => fmtBRL(v)}
              />
              <Bar dataKey="Receita" fill="url(#dash-rec-anual)" radius={[6, 6, 0, 0]} maxBarSize={36} />
              <Bar dataKey="Pagamentos" fill="url(#dash-pag-anual)" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th className="right">Receita recebida</th>
              <th className="right">Total pagamentos</th>
              <th className="right">Lucro líquido</th>
              <th className="right">Margem</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">Nenhum lançamento em {anoFiltro}.</div>
                </td>
              </tr>
            )}
            {filtradas.map((r) => {
              const lucroCls = r.lucro >= 0 ? 'pos' : 'neg';
              const margemCls = r.margem >= 0 ? 'pos' : 'neg';
              return (
                <tr key={r.mes}>
                  <td><div className="cell">{monthLabel(r.mes)}</div></td>
                  <td><div className="cell mono" style={{ justifyContent: 'flex-end' }}>{fmtBRL(r.receita)}</div></td>
                  <td><div className="cell mono" style={{ justifyContent: 'flex-end' }}>{fmtBRL(r.gastos)}</div></td>
                  <td><div className={`cell mono ${lucroCls}`} style={{ justifyContent: 'flex-end' }}>{fmtBRL(r.lucro)}</div></td>
                  <td><div className={`cell mono ${margemCls}`} style={{ justifyContent: 'flex-end' }}>{r.margem.toFixed(1).replace('.', ',')}%</div></td>
                </tr>
              );
            })}
          </tbody>
          {filtradas.length > 1 && (
            <tfoot>
              <tr>
                <td><div className="cell" style={{ fontWeight: 700 }}>Total {anoFiltro}</div></td>
                <td><div className="cell mono pos" style={{ justifyContent: 'flex-end', fontWeight: 700 }}>{fmtBRL(totais.receita)}</div></td>
                <td><div className="cell mono neg" style={{ justifyContent: 'flex-end', fontWeight: 700 }}>{fmtBRL(totais.gastos)}</div></td>
                <td><div className={`cell mono ${totais.lucro >= 0 ? 'pos' : 'neg'}`} style={{ justifyContent: 'flex-end', fontWeight: 700 }}>{fmtBRL(totais.lucro)}</div></td>
                <td><div className={`cell mono ${totais.margem >= 0 ? 'pos' : 'neg'}`} style={{ justifyContent: 'flex-end', fontWeight: 700 }}>{totais.margem.toFixed(1).replace('.', ',')}%</div></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

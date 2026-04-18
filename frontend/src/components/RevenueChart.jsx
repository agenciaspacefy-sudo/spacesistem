import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { formatBRL, lastNMonths, monthLabel } from '../utils.js';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <strong className="mono">{formatBRL(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function RevenueChart({ resumo }) {
  const meses = lastNMonths(12);
  const byMonth = new Map((resumo || []).map((r) => [r.mes, r]));
  const data = meses.map((m) => {
    const r = byMonth.get(m);
    return {
      mes: monthLabel(m),
      Receita: r?.receita || 0,
      Gastos: r?.gastos || 0
    };
  });

  const total = data.reduce((s, d) => s + d.Receita + d.Gastos, 0);

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <div className="chart-title">Receita recebida × Gastos</div>
          <div style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>Últimos 12 meses</div>
        </div>
      </div>
      {total === 0 ? (
        <div className="empty-state">Ainda não há lançamentos para exibir no gráfico.</div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="g-receita" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3ecf8e" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#3ecf8e" stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id="g-gastos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f26b6b" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#f26b6b" stopOpacity={0.55} />
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
                if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
                return `R$${v}`;
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--row-hover)' }} />
            <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} iconType="circle" />
            <Bar dataKey="Receita" fill="url(#g-receita)" radius={[6, 6, 0, 0]} maxBarSize={40} />
            <Bar dataKey="Gastos" fill="url(#g-gastos)" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

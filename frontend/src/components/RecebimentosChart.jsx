import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { api } from '../api/client.js';
import { useFormatBRL, usePrivacy } from '../PrivacyContext.jsx';

const PERIODOS = [
  { id: 'dia',    label: 'Dia',    days: 1 },
  { id: 'semana', label: 'Semana', days: 7 },
  { id: 'mes',    label: 'Mês',    days: 30 },
  { id: 'ano',    label: 'Ano',    days: 365 }
];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function labelDay(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function labelWeekday(d) {
  return d.toLocaleDateString('pt-BR', { weekday: 'short' });
}

function labelMonth(d) {
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

// Constrói os pontos do gráfico com base nos recebimentos pagos
function buildSeries(periodoId, recebimentos) {
  const hoje = startOfDay(new Date());
  const days = PERIODOS.find((p) => p.id === periodoId).days;
  const desde = startOfDay(addDays(hoje, -(days - 1)));

  // Agrupa por dia
  const porDia = new Map();
  for (const r of recebimentos) {
    if (!r.data) continue;
    const d = startOfDay(new Date(`${r.data}T00:00`));
    if (d < desde || d > hoje) continue;
    const key = isoDate(d);
    porDia.set(key, (porDia.get(key) || 0) + Number(r.valor || 0));
  }

  if (periodoId === 'ano') {
    // Agrega por mês (12 buckets)
    const buckets = new Map();
    for (let i = 11; i >= 0; i--) {
      const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { date: ref, label: labelMonth(ref), valor: 0 });
    }
    for (const [iso, valor] of porDia) {
      const [y, m] = iso.split('-');
      const key = `${y}-${m}`;
      const b = buckets.get(key);
      if (b) b.valor += valor;
    }
    return [...buckets.values()].map((b) => ({ x: b.label, valor: b.valor, dateLabel: b.label }));
  }

  if (periodoId === 'dia') {
    // Apenas hoje, valor único, mostramos como ponto duplicado para a area renderizar
    const valorHoje = porDia.get(isoDate(hoje)) || 0;
    return [
      { x: '00h', valor: 0, dateLabel: labelDay(hoje) },
      { x: 'agora', valor: valorHoje, dateLabel: labelDay(hoje) }
    ];
  }

  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(hoje, -i);
    const valor = porDia.get(isoDate(d)) || 0;
    out.push({
      x: periodoId === 'semana' ? labelWeekday(d) : labelDay(d),
      valor,
      dateLabel: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    });
  }
  return out;
}

function CustomTooltip({ active, payload }) {
  const fmtBRL = useFormatBRL();
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{p.dateLabel || p.x}</div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-dot" style={{ background: '#1B6FEE' }} />
        <span>Recebido:</span>
        <strong className="mono">{fmtBRL(p.valor)}</strong>
      </div>
    </div>
  );
}

export default function RecebimentosChart({ defaultPeriodo = 'mes', titulo = 'Recebimentos no período' }) {
  const fmtBRL = useFormatBRL();
  const { privacy } = usePrivacy();
  const [periodo, setPeriodo] = useState(defaultPeriodo);
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carrega todos os recebimentos pagos uma vez (dataset pequeno, simples e suficiente)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const rows = await api.listRecebimentos();
        if (!cancelled) {
          setTodos((rows || []).filter((r) => r.status === 'Pago'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const data = useMemo(() => buildSeries(periodo, todos), [periodo, todos]);
  const total = data.reduce((s, p) => s + p.valor, 0);
  const media = data.length > 0 ? total / data.length : 0;
  const tickY = (v) => {
    if (privacy) return 'R$ •••';
    if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
    return `R$${v}`;
  };

  return (
    <div className="chart-card receb-chart-card">
      <div className="chart-header">
        <div>
          <div className="chart-title">{titulo}</div>
          <div style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>
            Total recebido (Pago) ·{' '}
            <strong style={{ color: 'var(--text)' }}>{fmtBRL(total)}</strong>
          </div>
        </div>
        <div className="receb-chart-tabs" role="tablist" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={periodo === p.id}
              className={`receb-chart-tab ${periodo === p.id ? 'is-active' : ''}`}
              onClick={() => setPeriodo(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Carregando…</div>
      ) : total === 0 ? (
        <div className="empty-state">Nenhum recebimento pago neste período.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="receb-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1B6FEE" stopOpacity={0.55} />
                <stop offset="60%" stopColor="#1B6FEE" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#1B6FEE" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="x"
              stroke="var(--text-dim)"
              fontSize={11.5}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              stroke="var(--text-dim)"
              fontSize={11.5}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tickFormatter={tickY}
              width={55}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#1B6FEE', strokeOpacity: 0.3, strokeWidth: 1 }} />
            {media > 0 && (
              <ReferenceLine
                y={media}
                stroke="var(--text-dim)"
                strokeDasharray="4 4"
                label={{
                  value: `Média ${fmtBRL(media).replace('R$ ', 'R$')}`,
                  position: 'insideTopRight',
                  fill: 'var(--text-dim)',
                  fontSize: 10.5
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="valor"
              stroke="#1B6FEE"
              strokeWidth={2.4}
              fill="url(#receb-grad)"
              dot={false}
              activeDot={{ r: 5, fill: '#1B6FEE', stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={650}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

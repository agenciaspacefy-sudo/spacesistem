import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useConfirm } from '../ConfirmContext.jsx';

// ---------- Plataformas ----------
export const PLATAFORMAS_CONTEUDO = [
  {
    id: 'instagram',
    nome: 'Instagram',
    cor: '#E1306C',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    )
  },
  {
    id: 'facebook',
    nome: 'Facebook',
    cor: '#1877F2',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
      </svg>
    )
  },
  {
    id: 'tiktok',
    nome: 'TikTok',
    cor: '#000000',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.45a8.16 8.16 0 0 0 4.77 1.52V6.69h-1.84z" />
      </svg>
    )
  },
  {
    id: 'linkedin',
    nome: 'LinkedIn',
    cor: '#0A66C2',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 1 1 8.3 6.5a1.78 1.78 0 0 1-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0 0 13 14.19a.66.66 0 0 0 0 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 0 1 2.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
      </svg>
    )
  },
  {
    id: 'youtube',
    nome: 'YouTube',
    cor: '#FF0000',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23 9.71a8.5 8.5 0 0 0-.91-4.13 2.92 2.92 0 0 0-1.72-1A78.36 78.36 0 0 0 12 4.27a78.45 78.45 0 0 0-8.34.3 2.87 2.87 0 0 0-1.46.74c-.9.83-1 2.25-1.1 3.45a48.29 48.29 0 0 0 0 6.48 9.55 9.55 0 0 0 .3 2 3.14 3.14 0 0 0 .71 1.36 2.86 2.86 0 0 0 1.49.78 45.18 45.18 0 0 0 6.5.33c3.5.05 6.57 0 10.2-.28a2.88 2.88 0 0 0 1.53-.78 2.49 2.49 0 0 0 .61-1 10.58 10.58 0 0 0 .52-3.4c.04-.56.04-3.94.04-4.54zM9.74 14.85V8.66l5.92 3.11c-1.66.92-3.85 1.96-5.92 3.08z" />
      </svg>
    )
  },
  {
    id: 'google',
    nome: 'Google',
    cor: '#4285F4',
    icon: (
      <svg width="14" height="14" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
    )
  }
];

const PLAT_BY_ID = Object.fromEntries(PLATAFORMAS_CONTEUDO.map((p) => [p.id, p]));

const TIPOS = ['Feed', 'Stories', 'Reels', 'Vídeo', 'Carrossel'];
const STATUS = ['Planejado', 'Em produção', 'Agendado', 'Publicado'];
const STATUS_CLASS = {
  'Planejado':    'cont-status-planejado',
  'Em produção':  'cont-status-producao',
  'Agendado':     'cont-status-agendado',
  'Publicado':    'cont-status-publicado'
};

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function pad2(n) { return String(n).padStart(2, '0'); }
function isoDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function isoDateTimeLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function parseISO(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(s));
  if (!m) return null;
  return new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4] || 0), Number(m[5] || 0)
  );
}

export default function Conteudo() {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [editando, setEditando] = useState(null); // { ...form } | { date: ... }
  const [fCliente, setFCliente] = useState('');
  const [fPlataforma, setFPlataforma] = useState('');

  async function load() {
    setLoading(true);
    try {
      const start = startOfMonth(cursor);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const [conts, cls] = await Promise.all([
        api.listConteudos({
          de: isoDate(start),
          ate: isoDate(end) + ' 23:59:59',
          cliente_id: fCliente || undefined,
          plataforma: fPlataforma || undefined
        }),
        api.listClientes()
      ]);
      setItems(conts);
      setClientes(cls);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cursor, fCliente, fPlataforma]);

  // Agrupa por dia (yyyy-mm-dd)
  const porDia = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      const d = parseISO(it.data_pub);
      if (!d) continue;
      const key = isoDate(d);
      if (!m.has(key)) m.set(key, []);
      m.get(key).push({ ...it, _dt: d });
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a._dt - b._dt);
    }
    return m;
  }, [items]);

  // Constrói grade do mês: 6 semanas, começando na segunda
  const grade = useMemo(() => {
    const first = startOfMonth(cursor);
    const dim = daysInMonth(cursor);
    // weekday: 0 = segunda
    const offset = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < offset; i++) {
      const d = new Date(first.getFullYear(), first.getMonth(), 1 - (offset - i));
      cells.push({ date: d, otherMonth: true });
    }
    for (let i = 1; i <= dim; i++) {
      cells.push({ date: new Date(first.getFullYear(), first.getMonth(), i), otherMonth: false });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last); d.setDate(d.getDate() + 1);
      cells.push({ date: d, otherMonth: true });
    }
    // Garante 6 semanas para layout estável
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last); d.setDate(d.getDate() + 1);
      cells.push({ date: d, otherMonth: true });
    }
    return cells;
  }, [cursor]);

  function abrirNovo(date) {
    const d = date || new Date();
    d.setHours(9, 0, 0, 0);
    setEditando({
      cliente_id: '',
      data_pub: isoDateTimeLocal(d),
      plataformas: [],
      tipo: 'Feed',
      status: 'Planejado',
      titulo: '',
      descricao: ''
    });
  }

  function abrirEditar(item) {
    setEditando({
      id: item.id,
      cliente_id: item.cliente_id ? String(item.cliente_id) : '',
      data_pub: item.data_pub.length > 16
        ? item.data_pub.slice(0, 16).replace(' ', 'T')
        : item.data_pub,
      plataformas: Array.isArray(item.plataformas) ? item.plataformas : [],
      tipo: item.tipo || 'Feed',
      status: item.status || 'Planejado',
      titulo: item.titulo || '',
      descricao: item.descricao || ''
    });
  }

  async function handleSave(form) {
    const payload = {
      ...form,
      cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
      data_pub: String(form.data_pub).replace('T', ' '),
      plataformas: form.plataformas
    };
    if (form.id) {
      await api.updateConteudo(form.id, payload);
    } else {
      await api.createConteudo(payload);
    }
    setEditando(null);
    load();
  }

  async function handleDelete(item) {
    const ok = await confirm({
      message: <>Excluir o conteúdo <strong>{item.titulo || 'sem título'}</strong>?</>
    });
    if (!ok) return;
    await api.deleteConteudo(item.id);
    setItems((arr) => arr.filter((i) => i.id !== item.id));
    if (editando?.id === item.id) setEditando(null);
  }

  function prevMonth() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }
  function hoje() {
    setCursor(startOfMonth(new Date()));
  }

  const hojeIso = isoDate(new Date());

  return (
    <div>
      <div className="conteudo-toolbar">
        <div className="conteudo-toolbar-left">
          <button className="btn btn-ghost btn-sm" onClick={prevMonth} aria-label="Mês anterior">‹</button>
          <h2 className="conteudo-month-title">
            {MESES_PT[cursor.getMonth()]} <span>{cursor.getFullYear()}</span>
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={nextMonth} aria-label="Próximo mês">›</button>
          <button className="btn btn-ghost btn-sm" onClick={hoje}>Hoje</button>
        </div>
        <div className="conteudo-toolbar-right">
          <select value={fCliente} onChange={(e) => setFCliente(e.target.value)}>
            <option value="">Todos clientes</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select value={fPlataforma} onChange={(e) => setFPlataforma(e.target.value)}>
            <option value="">Todas plataformas</option>
            {PLATAFORMAS_CONTEUDO.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => abrirNovo()}>+ Novo conteúdo</button>
        </div>
      </div>

      <div className="conteudo-grid">
        <div className="conteudo-grid-header">
          {DIAS_SEMANA.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="conteudo-grid-body">
          {grade.map(({ date, otherMonth }, idx) => {
            const key = isoDate(date);
            const items = porDia.get(key) || [];
            const isToday = key === hojeIso;
            return (
              <div
                key={idx}
                className={`conteudo-day ${otherMonth ? 'is-other-month' : ''} ${isToday ? 'is-today' : ''}`}
                onClick={() => abrirNovo(date)}
              >
                <div className="conteudo-day-number">{date.getDate()}</div>
                {items.length > 0 && (
                  <div className="conteudo-day-pills">
                    {items.slice(0, 3).map((it) => (
                      <button
                        key={it.id}
                        className={`conteudo-pill ${STATUS_CLASS[it.status] || ''}`}
                        onClick={(e) => { e.stopPropagation(); abrirEditar(it); }}
                        title={`${it.titulo || 'Sem título'}${it.cliente_nome ? ' — ' + it.cliente_nome : ''}`}
                      >
                        <span className="conteudo-pill-time">{pad2(it._dt.getHours())}:{pad2(it._dt.getMinutes())}</span>
                        <span className="conteudo-pill-icons">
                          {(it.plataformas || []).slice(0, 4).map((pid) => (
                            <span key={pid} className="conteudo-plat-icon" style={{ color: PLAT_BY_ID[pid]?.cor }}>
                              {PLAT_BY_ID[pid]?.icon}
                            </span>
                          ))}
                        </span>
                        <span className="conteudo-pill-text">
                          {it.cliente_nome || it.titulo || 'Conteúdo'}
                        </span>
                      </button>
                    ))}
                    {items.length > 3 && (
                      <div className="conteudo-pill-more">+{items.length - 3} mais</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {loading && <div className="empty-state" style={{ marginTop: 12 }}>Carregando…</div>}

      {editando && (
        <ConteudoEditor
          form={editando}
          clientes={clientes}
          onClose={() => setEditando(null)}
          onSave={handleSave}
          onDelete={editando.id ? () => {
            const it = items.find((i) => i.id === editando.id);
            if (it) handleDelete(it);
          } : null}
        />
      )}
    </div>
  );
}

// ---------- Editor (modal) ----------
function ConteudoEditor({ form: initial, clientes, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function togglePlataforma(id) {
    setForm((f) => {
      const set = new Set(f.plataformas || []);
      if (set.has(id)) set.delete(id); else set.add(id);
      return { ...f, plataformas: [...set] };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.data_pub) return;
    setBusy(true);
    try { await onSave(form); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal modal-wide" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-head">
          <h3 className="modal-title">{form.id ? 'Editar conteúdo' : 'Novo conteúdo'}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field">
              <label>Cliente</label>
              <select
                value={form.cliente_id}
                onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
              >
                <option value="">— Sem cliente —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Data e horário</label>
              <input
                type="datetime-local"
                value={form.data_pub}
                onChange={(e) => setForm({ ...form, data_pub: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                {TIPOS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field field-full">
              <label>Título / descrição curta</label>
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex.: Carrossel sobre lançamento"
              />
            </div>
            <div className="field field-full">
              <label>Plataformas</label>
              <div className="conteudo-plat-grid">
                {PLATAFORMAS_CONTEUDO.map((p) => {
                  const ativa = (form.plataformas || []).includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      className={`conteudo-plat-btn ${ativa ? 'is-active' : ''}`}
                      onClick={() => togglePlataforma(p.id)}
                      style={ativa ? { borderColor: p.cor, color: p.cor } : undefined}
                    >
                      <span className="conteudo-plat-btn-icon" style={{ color: p.cor }}>{p.icon}</span>
                      <span>{p.nome}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="field field-full">
              <label>Descrição completa (opcional)</label>
              <textarea
                rows={4}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Briefing, copy, observações…"
              />
            </div>
          </div>

          <div className="modal-actions modal-actions-split" style={{ marginTop: 18 }}>
            {onDelete ? (
              <button type="button" className="btn btn-ghost btn-danger" onClick={onDelete} disabled={busy}>
                Excluir
              </button>
            ) : <span />}
            <div className="modal-actions-right">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

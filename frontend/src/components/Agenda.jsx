import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable
} from '@dnd-kit/core';
import { api } from '../api/client.js';
import { useConfirm } from '../ConfirmContext.jsx';

// ---------- Paleta de cores disponíveis ----------
const CORES = [
  { id: '#D97757', label: 'Laranja' },
  { id: '#16A34A', label: 'Verde' },
  { id: '#2563EB', label: 'Azul' },
  { id: '#9333EA', label: 'Roxo' },
  { id: '#DC2626', label: 'Vermelho' },
  { id: '#F59E0B', label: 'Âmbar' }
];

const REPETICOES = [
  { id: 'nao', label: 'Não repete' },
  { id: 'diario', label: 'Diário' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'mensal', label: 'Mensal' }
];

const HORA_INICIO = 6;
const HORA_FIM = 23;
const SLOT_H = 44; // px por 1h
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// ---------- Helpers de data ----------
function pad2(n) { return String(n).padStart(2, '0'); }

function toISOLocal(d) {
  // YYYY-MM-DDTHH:mm (sem timezone, tratado como local)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseISOLocal(iso) {
  // Interpreta "YYYY-MM-DDTHH:mm" ou com segundos/timezone — como data local
  if (!iso) return new Date(NaN);
  const s = String(iso);
  // Se vier com Z ou offset, o new Date vai interpretar certo.
  // Se for "naive" (sem Z), tratamos como local.
  if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (!m) return new Date(s);
  return new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4]), Number(m[5]), Number(m[6] || 0)
  );
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d) {
  // Segunda como primeiro dia
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // 0 = segunda
  x.setDate(x.getDate() - dow);
  return startOfDay(x);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function formatHoraRange(inicio, fim) {
  return `${pad2(inicio.getHours())}:${pad2(inicio.getMinutes())} – ${pad2(fim.getHours())}:${pad2(fim.getMinutes())}`;
}

// ---------- Expande repetições em ocorrências visíveis no período ----------
function expandOcorrencias(eventos, rangeStart, rangeEnd) {
  const out = [];
  for (const ev of eventos) {
    const inicio = parseISOLocal(ev.inicio);
    const fim = parseISOLocal(ev.fim);
    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) continue;

    const dur = fim - inicio;
    const rep = ev.repeticao || 'nao';

    if (rep === 'nao') {
      if (fim >= rangeStart && inicio <= rangeEnd) {
        out.push({ ...ev, _inicio: inicio, _fim: fim, _originalStart: inicio });
      }
      continue;
    }

    // Gera ocorrências até rangeEnd (limite de 500 por segurança)
    let cursor = new Date(inicio);
    let count = 0;
    while (cursor <= rangeEnd && count < 500) {
      const ocFim = new Date(cursor.getTime() + dur);
      if (ocFim >= rangeStart) {
        out.push({ ...ev, _inicio: new Date(cursor), _fim: ocFim, _originalStart: inicio });
      }
      if (rep === 'diario') cursor = addDays(cursor, 1);
      else if (rep === 'semanal') cursor = addDays(cursor, 7);
      else if (rep === 'mensal') cursor = addMonths(cursor, 1);
      else break;
      count++;
    }
  }
  return out;
}

// ---------- Ícones ----------
function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ==========================================================================
// Bloco de evento arrastável (visão Semana/Dia)
// ==========================================================================
function EventoBloco({ evento, top, height, onClick, compact }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `evento-${evento.id}-${evento._inicio.getTime()}`,
    data: { evento }
  });
  const style = {
    top,
    height: Math.max(height, 22),
    background: evento.cor || '#D97757',
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab'
  };
  return (
    <div
      ref={setNodeRef}
      className={`agenda-evento ${compact ? 'agenda-evento-compact' : ''}`}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onClick?.(evento); }}
    >
      <div className="agenda-evento-titulo">{evento.titulo}</div>
      {height > 36 && (
        <div className="agenda-evento-hora">
          {formatHoraRange(evento._inicio, evento._fim)}
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// Célula de horário droppable
// ==========================================================================
function SlotDroppable({ id, children, onClick }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`agenda-slot ${isOver ? 'is-over' : ''}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ==========================================================================
// Modal de criar/editar evento
// ==========================================================================
function EventoModal({ evento, clientes, onClose, onSave, onDelete }) {
  const isEdit = !!evento?.id;
  const [form, setForm] = useState(() => ({
    titulo: evento?.titulo ?? '',
    inicio: evento?.inicio ?? toISOLocal(new Date()),
    fim: evento?.fim ?? toISOLocal(new Date(Date.now() + 60 * 60 * 1000)),
    cor: evento?.cor ?? '#D97757',
    descricao: evento?.descricao ?? '',
    cliente_id: evento?.cliente_id ?? '',
    repeticao: evento?.repeticao ?? 'nao'
  }));

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    if (!form.inicio || !form.fim) return;
    if (new Date(form.inicio) >= new Date(form.fim)) {
      alert('A data/hora de fim deve ser depois do início.');
      return;
    }
    onSave({
      ...form,
      titulo: form.titulo.trim(),
      cliente_id: form.cliente_id ? Number(form.cliente_id) : null
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()} role="dialog">
        <h3>{isEdit ? 'Editar evento' : 'Novo evento'}</h3>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field field-full">
              <label>Título *</label>
              <input
                autoFocus
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                required
              />
            </div>

            <div className="field">
              <label>Início *</label>
              <input
                type="datetime-local"
                value={form.inicio}
                onChange={(e) => setForm({ ...form, inicio: e.target.value })}
                required
              />
            </div>

            <div className="field">
              <label>Fim *</label>
              <input
                type="datetime-local"
                value={form.fim}
                onChange={(e) => setForm({ ...form, fim: e.target.value })}
                required
              />
            </div>

            <div className="field field-full">
              <label>Cor</label>
              <div className="agenda-cor-picker">
                {CORES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`agenda-cor-opt ${form.cor === c.id ? 'selected' : ''}`}
                    style={{ background: c.id }}
                    onClick={() => setForm({ ...form, cor: c.id })}
                    title={c.label}
                    aria-label={c.label}
                    aria-pressed={form.cor === c.id}
                  />
                ))}
              </div>
            </div>

            <div className="field">
              <label>Cliente vinculado</label>
              <select
                value={form.cliente_id || ''}
                onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
              >
                <option value="">— Nenhum —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Repetir</label>
              <select
                value={form.repeticao}
                onChange={(e) => setForm({ ...form, repeticao: e.target.value })}
              >
                {REPETICOES.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="field field-full">
              <label>Descrição</label>
              <textarea
                rows={3}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: 16, justifyContent: 'space-between' }}>
            <div>
              {isEdit && (
                <button
                  type="button"
                  className="btn btn-ghost btn-danger"
                  onClick={onDelete}
                >
                  Excluir
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Salvar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================================================
// Componente principal
// ==========================================================================
export default function Agenda() {
  const confirm = useConfirm();
  const [visao, setVisao] = useState('semana'); // 'dia' | 'semana' | 'mes'
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [eventos, setEventos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // { evento? , inicio?, fim? }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Calcula intervalo visível para busca no backend
  const range = useMemo(() => {
    if (visao === 'dia') {
      const s = startOfDay(cursor);
      const e = addDays(s, 1);
      return { start: s, end: e };
    }
    if (visao === 'semana') {
      const s = startOfWeek(cursor);
      const e = addDays(s, 7);
      return { start: s, end: e };
    }
    // mês
    const s = startOfMonth(cursor);
    const e = addMonths(s, 1);
    return { start: s, end: e };
  }, [visao, cursor]);

  async function load() {
    setLoading(true);
    try {
      const [evs, cls] = await Promise.all([
        api.listAgenda().catch(() => []),
        api.listClientes().catch(() => [])
      ]);
      setEventos(evs || []);
      setClientes((cls || []).filter((c) => c.ativo));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Eventos expandidos (com recorrência) dentro do range visível ampliado
  const ocorrencias = useMemo(() => {
    // amplia o range para pegar eventos que começam antes e estendem dentro
    const extStart = addDays(range.start, -1);
    const extEnd = addDays(range.end, 1);
    return expandOcorrencias(eventos, extStart, extEnd);
  }, [eventos, range]);

  // --------- Navegação ---------
  function navPrev() {
    if (visao === 'dia') setCursor((c) => addDays(c, -1));
    else if (visao === 'semana') setCursor((c) => addDays(c, -7));
    else setCursor((c) => addMonths(c, -1));
  }
  function navNext() {
    if (visao === 'dia') setCursor((c) => addDays(c, 1));
    else if (visao === 'semana') setCursor((c) => addDays(c, 7));
    else setCursor((c) => addMonths(c, 1));
  }
  function navHoje() {
    setCursor(startOfDay(new Date()));
  }

  // --------- CRUD ---------
  async function handleSave(form) {
    try {
      if (modal?.evento?.id) {
        const updated = await api.updateEvento(modal.evento.id, form);
        setEventos((xs) => xs.map((e) => (e.id === updated.id ? updated : e)));
      } else {
        const created = await api.createEvento(form);
        setEventos((xs) => [...xs, created]);
      }
      setModal(null);
    } catch (e) {
      alert('Erro ao salvar evento: ' + (e?.message || e));
    }
  }

  async function handleDelete() {
    if (!modal?.evento?.id) return;
    const ok = await confirm({
      message: (
        <>
          Tem certeza que deseja excluir este evento?
          <br /><strong>{modal.evento.titulo}</strong>
        </>
      )
    });
    if (!ok) return;
    try {
      await api.deleteEvento(modal.evento.id);
      setEventos((xs) => xs.filter((e) => e.id !== modal.evento.id));
      setModal(null);
    } catch (e) {
      alert('Erro ao excluir: ' + (e?.message || e));
    }
  }

  // --------- Drag and drop (Semana/Dia) ---------
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const ocorrencia = active.data?.current?.evento;
    if (!ocorrencia) return;
    // over.id = `slot-YYYY-MM-DD-HH`
    const m = /^slot-(\d{4})-(\d{2})-(\d{2})-(\d{2})$/.exec(String(over.id));
    if (!m) return;
    const [_, y, mth, dy, hr] = m;
    const novoInicio = new Date(Number(y), Number(mth) - 1, Number(dy), Number(hr), ocorrencia._inicio.getMinutes());
    const dur = ocorrencia._fim - ocorrencia._inicio;
    const novoFim = new Date(novoInicio.getTime() + dur);

    const payload = {
      inicio: toISOLocal(novoInicio),
      fim: toISOLocal(novoFim)
    };
    // Atualiza otimisticamente
    setEventos((xs) => xs.map((e) => (e.id === ocorrencia.id ? { ...e, ...payload } : e)));
    api.updateEvento(ocorrencia.id, payload).catch((err) => {
      alert('Erro ao mover evento: ' + (err?.message || err));
      load();
    });
  }

  // --------- Abrir modal clicando em slot vazio ---------
  function handleNewAtSlot(dia, hora) {
    const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora, 0);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
    setModal({
      evento: null,
      inicio: toISOLocal(inicio),
      fim: toISOLocal(fim)
    });
  }

  function handleNewOnDay(dia) {
    const now = new Date();
    const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 9, 0);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
    setModal({
      evento: null,
      inicio: toISOLocal(inicio),
      fim: toISOLocal(fim)
    });
  }

  function handleOpenEvento(ev) {
    // Abre com os dados do evento "mãe" (não da ocorrência expandida)
    const mae = eventos.find((x) => x.id === ev.id) || ev;
    setModal({ evento: mae });
  }

  // --------- Título do cabeçalho ---------
  const headerTitle = useMemo(() => {
    if (visao === 'dia') {
      return cursor.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    }
    if (visao === 'semana') {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      return `${s.getDate()} – ${e.getDate()} ${MESES_NOMES[e.getMonth()]} ${e.getFullYear()}`;
    }
    return `${MESES_NOMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }, [visao, cursor]);

  // --------- Render helpers ---------
  const horas = useMemo(() => {
    const arr = [];
    for (let h = HORA_INICIO; h <= HORA_FIM; h++) arr.push(h);
    return arr;
  }, []);

  function renderColunaDia(dia) {
    const hoje = sameDay(dia, new Date());
    const eventosDia = ocorrencias.filter((o) => sameDay(o._inicio, dia));
    return (
      <div className={`agenda-col ${hoje ? 'agenda-col-hoje' : ''}`} key={toISOLocal(dia)}>
        {horas.map((h) => {
          const slotId = `slot-${dia.getFullYear()}-${pad2(dia.getMonth() + 1)}-${pad2(dia.getDate())}-${pad2(h)}`;
          return (
            <SlotDroppable
              key={slotId}
              id={slotId}
              onClick={() => handleNewAtSlot(dia, h)}
            />
          );
        })}
        {/* Eventos absolutamente posicionados sobre os slots */}
        <div className="agenda-col-events">
          {eventosDia.map((o) => {
            const startMin = o._inicio.getHours() * 60 + o._inicio.getMinutes();
            const endMin = o._fim.getHours() * 60 + o._fim.getMinutes();
            const baseMin = HORA_INICIO * 60;
            const top = ((startMin - baseMin) / 60) * SLOT_H;
            const height = Math.max(((endMin - startMin) / 60) * SLOT_H, 22);
            return (
              <EventoBloco
                key={`${o.id}-${o._inicio.getTime()}`}
                evento={o}
                top={top}
                height={height}
                onClick={handleOpenEvento}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // --------- Visão Mês ---------
  function renderMes() {
    const primeiro = startOfMonth(cursor);
    const offset = (primeiro.getDay() + 6) % 7; // segunda = 0
    const totalDias = daysInMonth(cursor);
    const cells = [];
    // dias do mês anterior preenchendo
    for (let i = 0; i < offset; i++) {
      const d = addDays(primeiro, i - offset);
      cells.push({ d, outro: true });
    }
    for (let i = 1; i <= totalDias; i++) {
      cells.push({ d: new Date(cursor.getFullYear(), cursor.getMonth(), i), outro: false });
    }
    // completa até múltiplo de 7
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].d;
      cells.push({ d: addDays(last, 1), outro: true });
    }

    const hoje = new Date();

    return (
      <div className="agenda-mes">
        <div className="agenda-mes-header">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="agenda-mes-header-cell">{d}</div>
          ))}
        </div>
        <div className="agenda-mes-grid">
          {cells.map(({ d, outro }, idx) => {
            const evs = ocorrencias.filter((o) => sameDay(o._inicio, d));
            return (
              <div
                key={idx}
                className={`agenda-mes-cell ${outro ? 'outro-mes' : ''} ${sameDay(d, hoje) ? 'hoje' : ''}`}
                onClick={() => handleNewOnDay(d)}
              >
                <div className="agenda-mes-cell-num">{d.getDate()}</div>
                <div className="agenda-mes-cell-events">
                  {evs.slice(0, 3).map((o) => (
                    <div
                      key={`${o.id}-${o._inicio.getTime()}`}
                      className="agenda-mes-pill"
                      style={{ background: o.cor || '#D97757' }}
                      onClick={(e) => { e.stopPropagation(); handleOpenEvento(o); }}
                      title={`${o.titulo} · ${formatHoraRange(o._inicio, o._fim)}`}
                    >
                      {o.titulo}
                    </div>
                  ))}
                  {evs.length > 3 && (
                    <div className="agenda-mes-mais">+{evs.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --------- Visão Semana ---------
  function renderSemana() {
    const inicioSemana = startOfWeek(cursor);
    const dias = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(inicioSemana, i));
    const hoje = new Date();
    return (
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="agenda-semana">
          <div className="agenda-semana-header">
            <div className="agenda-semana-gutter" />
            {dias.map((d) => (
              <div
                key={toISOLocal(d)}
                className={`agenda-semana-header-cell ${sameDay(d, hoje) ? 'hoje' : ''}`}
              >
                <div className="agenda-dia-nome">{DIAS_SEMANA[(d.getDay() + 6) % 7]}</div>
                <div className="agenda-dia-num">{d.getDate()}</div>
              </div>
            ))}
          </div>
          <div className="agenda-semana-body">
            <div className="agenda-semana-gutter">
              {horas.map((h) => (
                <div key={h} className="agenda-gutter-cell">{pad2(h)}:00</div>
              ))}
            </div>
            {dias.map((d) => renderColunaDia(d))}
          </div>
        </div>
      </DndContext>
    );
  }

  // --------- Visão Dia ---------
  function renderDia() {
    const hoje = new Date();
    return (
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="agenda-dia">
          <div className="agenda-semana-header">
            <div className="agenda-semana-gutter" />
            <div className={`agenda-semana-header-cell ${sameDay(cursor, hoje) ? 'hoje' : ''}`}>
              <div className="agenda-dia-nome">
                {cursor.toLocaleDateString('pt-BR', { weekday: 'long' })}
              </div>
              <div className="agenda-dia-num">{cursor.getDate()}</div>
            </div>
          </div>
          <div className="agenda-semana-body">
            <div className="agenda-semana-gutter">
              {horas.map((h) => (
                <div key={h} className="agenda-gutter-cell">{pad2(h)}:00</div>
              ))}
            </div>
            {renderColunaDia(cursor)}
          </div>
        </div>
      </DndContext>
    );
  }

  return (
    <div className="agenda-wrap">
      <div className="agenda-toolbar">
        <div className="agenda-toolbar-left">
          <button className="btn btn-sm" onClick={navHoje} title="Ir para hoje">Hoje</button>
          <button className="btn btn-sm btn-icon" onClick={navPrev} aria-label="Anterior">
            <ChevronLeft />
          </button>
          <button className="btn btn-sm btn-icon" onClick={navNext} aria-label="Próximo">
            <ChevronRight />
          </button>
          <span className="agenda-header-title">{headerTitle}</span>
        </div>
        <div className="agenda-toolbar-right">
          <div className="agenda-visao-switch" role="tablist">
            {['dia', 'semana', 'mes'].map((v) => (
              <button
                key={v}
                className={`agenda-visao-btn ${visao === v ? 'active' : ''}`}
                onClick={() => setVisao(v)}
                role="tab"
                aria-selected={visao === v}
              >
                {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              const inicio = new Date();
              inicio.setMinutes(0, 0, 0);
              const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
              setModal({ evento: null, inicio: toISOLocal(inicio), fim: toISOLocal(fim) });
            }}
          >
            + Novo evento
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state" style={{ marginTop: 24 }}>Carregando eventos…</div>
      ) : (
        <>
          {visao === 'mes' && renderMes()}
          {visao === 'semana' && renderSemana()}
          {visao === 'dia' && renderDia()}
        </>
      )}

      {modal && (
        <EventoModal
          evento={modal.evento
            ? modal.evento
            : { inicio: modal.inicio, fim: modal.fim }}
          clientes={clientes}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

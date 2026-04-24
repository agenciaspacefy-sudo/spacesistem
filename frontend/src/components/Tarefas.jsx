import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable
} from '@dnd-kit/core';
import { api } from '../api/client.js';
import { formatDate, todayISO } from '../utils.js';
import { useConfirm } from '../ConfirmContext.jsx';

const COLUNAS = [
  { id: 'A Fazer', label: 'A Fazer' },
  { id: 'Em Andamento', label: 'Em Andamento' },
  { id: 'Concluído', label: 'Concluído' }
];

const PRIORIDADES = ['Alta', 'Média', 'Baixa'];

function emptyForm() {
  return { titulo: '', descricao: '', prioridade: 'Média', data_limite: '', cliente_id: '' };
}

function nextStatus(status) {
  const idx = COLUNAS.findIndex((c) => c.id === status);
  return idx >= 0 && idx < COLUNAS.length - 1 ? COLUNAS[idx + 1].id : null;
}

function isVencida(dataLimite) {
  if (!dataLimite) return false;
  return dataLimite < todayISO();
}

function inThisWeek(dataLimite) {
  if (!dataLimite) return false;
  const hoje = new Date(todayISO());
  const alvo = new Date(dataLimite);
  const diff = (alvo - hoje) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 7;
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function TarefaCard({ tarefa, onDelete, onMoveNext, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tarefa-${tarefa.id}`,
    data: { tarefa }
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1
  };

  const vencida = isVencida(tarefa.data_limite) && tarefa.status !== 'Concluído';
  const concluida = tarefa.status === 'Concluído';
  const next = nextStatus(tarefa.status);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`tarefa-card prio-${tarefa.prioridade.toLowerCase().replace('é', 'e')} ${concluida ? 'concluida' : ''}`}
      title={tarefa.descricao || tarefa.titulo}
    >
      <div className="tarefa-drag" {...attributes} {...listeners}>
        <div
          className="tarefa-titulo tarefa-titulo-clickable"
          onClick={(e) => { e.stopPropagation(); onEdit(tarefa); }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Clique para editar"
        >
          {tarefa.titulo}
        </div>
        {tarefa.descricao && (
          <div className="tarefa-desc">{tarefa.descricao}</div>
        )}
        <div className="tarefa-meta">
          {tarefa.cliente_nome && (
            <span className="badge badge-cliente">{tarefa.cliente_nome}</span>
          )}
          {tarefa.data_limite && (
            <span className={`tarefa-data ${vencida ? 'vencida' : ''}`}>
              {vencida ? '⚠ ' : '📅 '}{formatDate(tarefa.data_limite)}
            </span>
          )}
        </div>
      </div>
      <div className="tarefa-actions">
        {next && (
          <button
            className="btn-icon-tiny"
            onClick={() => onMoveNext(tarefa, next)}
            title={`Mover para ${next}`}
          >
            <ArrowRightIcon />
          </button>
        )}
        <button
          className="btn-icon-tiny"
          onClick={() => onEdit(tarefa)}
          title="Editar tarefa"
        >
          <EditIcon />
        </button>
        <button
          className="btn-icon-tiny btn-danger-icon"
          onClick={() => onDelete(tarefa)}
          title="Excluir tarefa"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function Coluna({ coluna, tarefas, onDelete, onMoveNext, onEdit }) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });

  return (
    <div
      ref={setNodeRef}
      className={`kanban-col ${isOver ? 'over' : ''} ${coluna.id === 'Concluído' ? 'col-done' : ''}`}
    >
      <div className="kanban-col-header">
        <h3>{coluna.label}</h3>
        <span className="kanban-count">{tarefas.length}</span>
      </div>
      <div className="kanban-col-body">
        {tarefas.length === 0 && (
          <div className="kanban-empty">Solte uma tarefa aqui</div>
        )}
        {tarefas.map((t) => (
          <TarefaCard key={t.id} tarefa={t} onDelete={onDelete} onMoveNext={onMoveNext} onEdit={onEdit} />
        ))}
      </div>
    </div>
  );
}

export default function Tarefas() {
  const confirm = useConfirm();
  const [tarefas, setTarefas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [filterPrio, setFilterPrio] = useState('todas');
  const [filterData, setFilterData] = useState('todas');
  const [editingTarefa, setEditingTarefa] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function load() {
    const [ts, cls] = await Promise.all([api.listTarefas(), api.listClientes()]);
    setTarefas(ts);
    setClientes(cls);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    const created = await api.createTarefa({
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      prioridade: form.prioridade,
      data_limite: form.data_limite || null,
      cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
      status: 'A Fazer'
    });
    setTarefas((ts) => [created, ...ts]);
    setForm(emptyForm());
    setShowForm(false);
  }

  async function handleDelete(tarefa) {
    const ok = await confirm({
      message: (
        <>
          Tem certeza que deseja excluir esta tarefa?
          <br /><strong>{tarefa.titulo}</strong>
        </>
      )
    });
    if (!ok) return;
    await api.deleteTarefa(tarefa.id);
    setTarefas((ts) => ts.filter((t) => t.id !== tarefa.id));
  }

  function handleOpenEdit(tarefa) {
    setEditingTarefa({
      id: tarefa.id,
      form: {
        titulo: tarefa.titulo || '',
        descricao: tarefa.descricao || '',
        prioridade: tarefa.prioridade || 'Média',
        data_limite: tarefa.data_limite || '',
        cliente_id: tarefa.cliente_id != null ? String(tarefa.cliente_id) : ''
      }
    });
  }

  function updateEditForm(patch) {
    setEditingTarefa((prev) => prev ? { ...prev, form: { ...prev.form, ...patch } } : prev);
  }

  async function handleSaveEdit() {
    if (!editingTarefa) return;
    const { id, form: ef } = editingTarefa;
    if (!ef.titulo.trim()) { alert('Informe um título.'); return; }

    setSavingEdit(true);
    try {
      const updated = await api.updateTarefa(id, {
        titulo: ef.titulo.trim(),
        descricao: ef.descricao.trim() || null,
        prioridade: ef.prioridade,
        data_limite: ef.data_limite || null,
        cliente_id: ef.cliente_id ? Number(ef.cliente_id) : null
      });
      setTarefas((ts) => ts.map((t) => (t.id === id ? updated : t)));
      setEditingTarefa(null);
    } catch (e) {
      alert('Erro ao salvar: ' + (e?.message || e));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleMove(tarefa, novoStatus) {
    if (tarefa.status === novoStatus) return;
    setTarefas((ts) => ts.map((t) => (t.id === tarefa.id ? { ...t, status: novoStatus } : t)));
    try {
      await api.updateTarefa(tarefa.id, { status: novoStatus });
    } catch {
      setTarefas((ts) => ts.map((t) => (t.id === tarefa.id ? { ...t, status: tarefa.status } : t)));
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const tarefa = active.data.current?.tarefa;
    if (!tarefa) return;
    handleMove(tarefa, over.id);
  }

  const filtradas = useMemo(() => {
    return tarefas.filter((t) => {
      if (filterPrio !== 'todas' && t.prioridade !== filterPrio) return false;
      if (filterData === 'hoje') {
        if (!t.data_limite || t.data_limite !== todayISO()) return false;
      } else if (filterData === 'semana') {
        if (!inThisWeek(t.data_limite)) return false;
      }
      return true;
    });
  }, [tarefas, filterPrio, filterData]);

  const porColuna = useMemo(() => {
    const map = {};
    for (const c of COLUNAS) map[c.id] = [];
    for (const t of filtradas) {
      if (map[t.status]) map[t.status].push(t);
      else map['A Fazer'].push(t);
    }
    return map;
  }, [filtradas]);

  const clientesAtivos = clientes.filter((c) => c.ativo);

  return (
    <div>
      <div className="toolbar" style={{ padding: 0, marginBottom: 12 }}>
        <div className="toolbar-left">
          <span className="label">Prioridade</span>
          <select value={filterPrio} onChange={(e) => setFilterPrio(e.target.value)}>
            <option value="todas">Todas</option>
            {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="label">Data</span>
          <select value={filterData} onChange={(e) => setFilterData(e.target.value)}>
            <option value="todas">Todas</option>
            <option value="hoje">Hoje</option>
            <option value="semana">Esta semana</option>
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancelar' : '+ Nova tarefa'}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="form-row" onSubmit={handleCreate}>
          <div className="field field-full">
            <label>Título</label>
            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex.: Enviar proposta para cliente X"
              required
              autoFocus
            />
          </div>
          <div className="field field-full">
            <label>Descrição (opcional)</label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Detalhes da tarefa…"
              rows={2}
            />
          </div>
          <div className="field">
            <label>Prioridade</label>
            <select
              value={form.prioridade}
              onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
            >
              {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Data limite (opcional)</label>
            <input
              type="date"
              value={form.data_limite}
              onChange={(e) => setForm({ ...form, data_limite: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Cliente vinculado (opcional)</label>
            <select
              value={form.cliente_id}
              onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
            >
              <option value="">— Nenhum —</option>
              {clientesAtivos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button className="btn btn-primary" type="submit">Salvar tarefa</button>
          </div>
        </form>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="kanban">
          {COLUNAS.map((c) => (
            <Coluna
              key={c.id}
              coluna={c}
              tarefas={porColuna[c.id] || []}
              onDelete={handleDelete}
              onMoveNext={handleMove}
              onEdit={handleOpenEdit}
            />
          ))}
        </div>
      </DndContext>

      {editingTarefa && (
        <div className="modal-backdrop" onClick={() => !savingEdit && setEditingTarefa(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 4 }}>Editar tarefa</h3>
            <p className="hint" style={{ marginBottom: 16 }}>
              Atualize os campos abaixo e clique em Salvar.
            </p>

            <div className="form-grid">
              <div className="field field-full">
                <label>Título</label>
                <input
                  value={editingTarefa.form.titulo}
                  onChange={(e) => updateEditForm({ titulo: e.target.value })}
                  placeholder="Ex.: Enviar proposta para cliente X"
                  autoFocus
                />
              </div>
              <div className="field field-full">
                <label>Descrição</label>
                <textarea
                  value={editingTarefa.form.descricao}
                  onChange={(e) => updateEditForm({ descricao: e.target.value })}
                  placeholder="Detalhes da tarefa…"
                  rows={3}
                />
              </div>
              <div className="field">
                <label>Prioridade</label>
                <select
                  value={editingTarefa.form.prioridade}
                  onChange={(e) => updateEditForm({ prioridade: e.target.value })}
                >
                  {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Data limite</label>
                <input
                  type="date"
                  value={editingTarefa.form.data_limite}
                  onChange={(e) => updateEditForm({ data_limite: e.target.value })}
                />
              </div>
              <div className="field field-full">
                <label>Cliente vinculado</label>
                <select
                  value={editingTarefa.form.cliente_id}
                  onChange={(e) => updateEditForm({ cliente_id: e.target.value })}
                >
                  <option value="">— Nenhum —</option>
                  {clientesAtivos.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 18 }}>
              <button
                className="btn btn-ghost"
                onClick={() => setEditingTarefa(null)}
                disabled={savingEdit}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

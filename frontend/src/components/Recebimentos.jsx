import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useSettings } from '../SettingsContext.jsx';
import {
  buildVencimento,
  buildWaUrl,
  currentMonth,
  formatBRL,
  formatDate,
  todayISO
} from '../utils.js';
import EditableCell from './EditableCell.jsx';
import { useConfirm } from '../ConfirmContext.jsx';
import { useFormatBRL } from '../PrivacyContext.jsx';
import RecebimentosChart from './RecebimentosChart.jsx';

const STATUS_OPTIONS = ['Pago', 'Pendente', 'Atrasado'];

function StatusBadge({ value }) {
  const cls = value === 'Pago' ? 'badge-pago' : value === 'Atrasado' ? 'badge-atrasado' : 'badge-pendente';
  return <span className={`badge ${cls}`}>{value || 'Pendente'}</span>;
}

export default function Recebimentos({ mesFiltro }) {
  const { settings } = useSettings();
  const confirm = useConfirm();
  const fmtBRL = useFormatBRL();
  const [rows, setRows] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());

  function emptyForm() {
    return {
      cliente_id: '',
      data: todayISO(),
      cliente: '',
      servico: '',
      mes_ref: mesFiltro || currentMonth(),
      valor: '',
      vencimento: '',
      status: 'Pendente'
    };
  }

  async function load() {
    setLoading(true);
    try {
      const [recs, cls] = await Promise.all([api.listRecebimentos(mesFiltro), api.listClientes()]);
      setRows(recs);
      setClientes(cls);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [mesFiltro]);

  useEffect(() => {
    setForm((f) => ({ ...f, mes_ref: mesFiltro || f.mes_ref }));
  }, [mesFiltro]);

  function handleClienteSelect(e) {
    const id = e.target.value;
    setForm((f) => ({ ...f, cliente_id: id }));
    if (!id) return;
    const c = clientes.find((x) => String(x.id) === String(id));
    if (!c) return;
    setForm((f) => ({
      ...f,
      cliente_id: id,
      cliente: c.nome,
      servico: c.servico_padrao || f.servico,
      valor: c.valor_padrao != null ? c.valor_padrao : f.valor,
      vencimento: c.dia_vencimento ? buildVencimento(f.mes_ref || currentMonth(), c.dia_vencimento) : f.vencimento
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.cliente || !form.servico || !form.valor || !form.mes_ref || !form.data) return;
    await api.createRecebimento({
      ...form,
      cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
      valor: Number(form.valor)
    });
    setForm(emptyForm());
    setShowForm(false);
    load();
  }

  async function handleUpdate(id, field, value) {
    await api.updateRecebimento(id, { [field]: value });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleDelete(id) {
    const rec = rows.find((r) => r.id === id);
    const ok = await confirm({
      message: (
        <>
          Tem certeza que deseja excluir este recebimento?
          {rec?.cliente && <><br /><strong>{rec.cliente}</strong>{rec.servico ? ` — ${rec.servico}` : ''}</>}
        </>
      )
    });
    if (!ok) return;
    await api.deleteRecebimento(id);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  function notifyOwner(rec) {
    if (!settings.whatsapp_dono) return;
    const msg =
      `✅ Pagamento recebido!\n` +
      `Cliente: ${rec.cliente}\n` +
      `Serviço: ${rec.servico}\n` +
      `Valor: ${formatBRL(rec.valor)}\n` +
      `Data: ${formatDate(rec.data)}`;
    window.open(buildWaUrl(settings.whatsapp_dono, msg), '_blank');
  }

  async function handleMarcarPago(rec) {
    const updated = { ...rec, status: 'Pago' };
    await api.updateRecebimento(rec.id, { status: 'Pago' });
    setRows((rs) => rs.map((r) => (r.id === rec.id ? updated : r)));
    notifyOwner(updated);
  }

  const totais = useMemo(() => {
    const pago = rows.filter((r) => r.status === 'Pago').reduce((s, r) => s + r.valor, 0);
    const pendente = rows.filter((r) => r.status === 'Pendente').reduce((s, r) => s + r.valor, 0);
    const atrasado = rows.filter((r) => r.status === 'Atrasado').reduce((s, r) => s + r.valor, 0);
    return { pago, pendente, atrasado, total: pago + pendente + atrasado };
  }, [rows]);

  return (
    <div>
      <div className="cards">
        <div className="card">
          <div className="card-label">Recebido</div>
          <div className="card-value pos">{fmtBRL(totais.pago)}</div>
        </div>
        <div className="card">
          <div className="card-label">A receber</div>
          <div className="card-value">{fmtBRL(totais.pendente)}</div>
        </div>
        <div className="card">
          <div className="card-label">Atrasado</div>
          <div className="card-value neg">{fmtBRL(totais.atrasado)}</div>
        </div>
        <div className="card">
          <div className="card-label">Total</div>
          <div className="card-value">{fmtBRL(totais.total)}</div>
        </div>
      </div>

      <RecebimentosChart defaultPeriodo="mes" titulo="Recebimentos no período" />

      <div className="toolbar" style={{ padding: 0, marginBottom: 12 }}>
        <div className="toolbar-left">
          <span className="label">{rows.length} lançamento{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancelar' : '+ Novo recebimento'}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="form-row" onSubmit={handleCreate}>
          <div className="field field-full">
            <label>Cliente cadastrado (opcional — preenche os campos)</label>
            <select value={form.cliente_id} onChange={handleClienteSelect}>
              <option value="">— Selecionar cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}{c.valor_padrao ? ` · ${fmtBRL(c.valor_padrao)}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Data</label>
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
          </div>
          <div className="field">
            <label>Cliente</label>
            <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} required />
          </div>
          <div className="field">
            <label>Serviço</label>
            <input value={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.value })} required />
          </div>
          <div className="field">
            <label>Mês ref.</label>
            <input type="month" value={form.mes_ref} onChange={(e) => setForm({ ...form, mes_ref: e.target.value })} required />
          </div>
          <div className="field">
            <label>Valor</label>
            <input type="number" step="0.01" value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
          </div>
          <div className="field">
            <label>Vencimento</label>
            <input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button className="btn btn-primary" type="submit">Salvar</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 120 }}>Data</th>
              <th>Cliente</th>
              <th>Serviço</th>
              <th style={{ width: 110 }}>Mês ref.</th>
              <th style={{ width: 140 }} className="right">Valor</th>
              <th style={{ width: 120 }}>Vencimento</th>
              <th style={{ width: 140 }}>Status</th>
              <th style={{ width: 230 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8}><div className="empty-state">Carregando…</div></td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8}><div className="empty-state">Nenhum recebimento para este filtro.</div></td></tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.id}>
                <EditableCell value={r.data} type="date" onSave={(v) => handleUpdate(r.id, 'data', v)} />
                <EditableCell value={r.cliente} onSave={(v) => handleUpdate(r.id, 'cliente', v)} />
                <EditableCell value={r.servico} onSave={(v) => handleUpdate(r.id, 'servico', v)} />
                <EditableCell value={r.mes_ref} type="month" onSave={(v) => handleUpdate(r.id, 'mes_ref', v)} />
                <EditableCell value={r.valor} type="number" align="right" onSave={(v) => handleUpdate(r.id, 'valor', v)} />
                <EditableCell value={r.vencimento} type="date" onSave={(v) => handleUpdate(r.id, 'vencimento', v)} />
                <td>
                  <StatusCellEditor value={r.status} onSave={(v) => handleUpdate(r.id, 'status', v)} />
                </td>
                <td className="actions-cell">
                  {r.status !== 'Pago' && (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleMarcarPago(r)}
                      title={settings.whatsapp_dono ? 'Marca como pago e notifica o dono via WhatsApp' : 'Marca como pago'}
                    >
                      ✓ Marcar pago
                    </button>
                  )}
                  <button className="btn btn-sm btn-ghost btn-danger" onClick={() => handleDelete(r.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusCellEditor({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <select
        autoFocus
        className="cell-edit"
        defaultValue={value || 'Pendente'}
        onBlur={(e) => {
          setEditing(false);
          if (e.target.value !== value) onSave(e.target.value);
        }}
        onChange={(e) => {
          setEditing(false);
          if (e.target.value !== value) onSave(e.target.value);
        }}
      >
        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }
  return (
    <div className="cell" onClick={() => setEditing(true)}>
      <StatusBadge value={value || 'Pendente'} />
    </div>
  );
}

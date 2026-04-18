import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import EditableCell from './EditableCell.jsx';

export default function Clientes() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());

  function emptyForm() {
    return { nome: '', cnpj: '', whatsapp: '', ativo: 1 };
  }

  async function load() {
    setLoading(true);
    try { setRows(await api.listClientes()); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.nome) return;
    await api.createCliente(form);
    setForm(emptyForm());
    setShowForm(false);
    load();
  }

  async function handleUpdate(id, field, value) {
    await api.updateCliente(id, { [field]: value });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este cliente? Cobranças já cadastradas permanecem.')) return;
    await api.deleteCliente(id);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  const ativos = rows.filter((r) => r.ativo).length;

  return (
    <div>
      <div className="cards">
        <div className="card">
          <div className="card-label">Clientes ativos</div>
          <div className="card-value">{ativos}</div>
        </div>
        <div className="card">
          <div className="card-label">Total cadastrados</div>
          <div className="card-value">{rows.length}</div>
        </div>
      </div>

      <div className="toolbar" style={{ padding: 0, marginBottom: 12 }}>
        <div className="toolbar-left">
          <span className="label">{rows.length} cliente{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancelar' : '+ Novo cliente'}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="form-row" onSubmit={handleCreate}>
          <div className="field">
            <label>Nome</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
          </div>
          <div className="field">
            <label>CNPJ</label>
            <input
              placeholder="00.000.000/0000-00"
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
            />
          </div>
          <div className="field">
            <label>WhatsApp</label>
            <input
              placeholder="(11) 99999-9999"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
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
              <th>Nome</th>
              <th style={{ width: 200 }}>CNPJ</th>
              <th style={{ width: 180 }}>WhatsApp</th>
              <th style={{ width: 120 }}>Ativo</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5}><div className="empty-state">Carregando…</div></td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5}><div className="empty-state">Nenhum cliente cadastrado ainda.</div></td></tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.id}>
                <EditableCell value={r.nome} onSave={(v) => handleUpdate(r.id, 'nome', v)} />
                <EditableCell value={r.cnpj} placeholder="—" onSave={(v) => handleUpdate(r.id, 'cnpj', v)} />
                <EditableCell value={r.whatsapp} placeholder="—" onSave={(v) => handleUpdate(r.id, 'whatsapp', v)} />
                <td>
                  <div className="cell">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!r.ativo}
                        onChange={(e) => handleUpdate(r.id, 'ativo', e.target.checked ? 1 : 0)}
                      />
                      <span className={`badge ${r.ativo ? 'badge-pago' : 'badge-neutral'}`}>
                        {r.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </label>
                  </div>
                </td>
                <td className="actions-cell">
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

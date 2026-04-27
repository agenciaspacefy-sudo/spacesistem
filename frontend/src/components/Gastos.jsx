import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { todayISO, currentMonth } from '../utils.js';
import EditableCell from './EditableCell.jsx';
import { useConfirm } from '../ConfirmContext.jsx';
import { useFormatBRL } from '../PrivacyContext.jsx';

const CATEGORIAS = [
  'Funcionários',
  'Fornecedores',
  'Compras para Empresa',
  'Ferramentas e Software',
  'Impostos e Taxas',
  'Marketing',
  'Outros'
];

const FORMAS = ['PIX', 'Cartão', 'Boleto', 'Dinheiro', 'Transferência'];

export default function Gastos({ mesFiltro }) {
  const confirm = useConfirm();
  const fmtBRL = useFormatBRL();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());

  function emptyForm() {
    return {
      data: todayISO(),
      categoria: 'Funcionários',
      descricao: '',
      mes_ref: mesFiltro || currentMonth(),
      valor: '',
      forma_pagamento: 'PIX'
    };
  }

  async function load() {
    setLoading(true);
    try {
      setRows(await api.listGastos(mesFiltro));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [mesFiltro]);

  useEffect(() => {
    setForm((f) => ({ ...f, mes_ref: mesFiltro || f.mes_ref }));
  }, [mesFiltro]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.categoria || !form.valor || !form.mes_ref || !form.data) return;
    await api.createGasto({ ...form, valor: Number(form.valor) });
    setForm(emptyForm());
    setShowForm(false);
    load();
  }

  async function handleUpdate(id, field, value) {
    await api.updateGasto(id, { [field]: value });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleDelete(id) {
    const g = rows.find((r) => r.id === id);
    const ok = await confirm({
      message: (
        <>
          Tem certeza que deseja excluir este pagamento?
          {g && (
            <><br /><strong>{g.categoria}</strong>{g.descricao ? ` — ${g.descricao}` : ''}{g.valor ? ` · ${fmtBRL(g.valor)}` : ''}</>
          )}
        </>
      )
    });
    if (!ok) return;
    await api.deleteGasto(id);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  const total = useMemo(() => rows.reduce((s, r) => s + r.valor, 0), [rows]);
  const porCategoria = useMemo(() => {
    const map = new Map();
    for (const r of rows) map.set(r.categoria, (map.get(r.categoria) || 0) + r.valor);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [rows]);

  return (
    <div>
      <div className="cards">
        <div className="card">
          <div className="card-label">Total pagamentos</div>
          <div className="card-value neg">{fmtBRL(total)}</div>
        </div>
        {porCategoria.map(([cat, val]) => (
          <div className="card" key={cat}>
            <div className="card-label">{cat}</div>
            <div className="card-value">{fmtBRL(val)}</div>
          </div>
        ))}
      </div>

      <div className="toolbar" style={{ padding: 0, marginBottom: 12 }}>
        <div className="toolbar-left">
          <span className="label">{rows.length} lançamento{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancelar' : '+ Novo pagamento'}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="form-row" onSubmit={handleCreate}>
          <div className="field">
            <label>Data</label>
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
          </div>
          <div className="field">
            <label>Categoria</label>
            <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Descrição</label>
            <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="field">
            <label>Mês ref.</label>
            <input type="month" value={form.mes_ref} onChange={(e) => setForm({ ...form, mes_ref: e.target.value })} required />
          </div>
          <div className="field">
            <label>Valor</label>
            <input
              type="number"
              step="0.01"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Forma pgto.</label>
            <select value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}>
              {FORMAS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button className="btn btn-primary" type="submit">
              Salvar
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 120 }}>Data</th>
              <th style={{ width: 160 }}>Categoria</th>
              <th>Descrição</th>
              <th style={{ width: 110 }}>Mês ref.</th>
              <th style={{ width: 140 }} className="right">
                Valor
              </th>
              <th style={{ width: 140 }}>Forma pgto.</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">Carregando…</div>
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">Nenhum pagamento para este filtro.</div>
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id}>
                  <EditableCell value={r.data} type="date" onSave={(v) => handleUpdate(r.id, 'data', v)} />
                  <EditableCell
                    value={r.categoria}
                    type="select"
                    options={CATEGORIAS}
                    onSave={(v) => handleUpdate(r.id, 'categoria', v)}
                  />
                  <EditableCell
                    value={r.descricao}
                    placeholder="Sem descrição"
                    onSave={(v) => handleUpdate(r.id, 'descricao', v)}
                  />
                  <EditableCell value={r.mes_ref} type="month" onSave={(v) => handleUpdate(r.id, 'mes_ref', v)} />
                  <EditableCell
                    value={r.valor}
                    type="number"
                    align="right"
                    onSave={(v) => handleUpdate(r.id, 'valor', v)}
                  />
                  <EditableCell
                    value={r.forma_pagamento}
                    type="select"
                    options={FORMAS}
                    onSave={(v) => handleUpdate(r.id, 'forma_pagamento', v)}
                  />
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

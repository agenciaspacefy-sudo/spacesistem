import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import EditableCell from './EditableCell.jsx';
import { useConfirm } from '../ConfirmContext.jsx';
import { useFormatCnpj, useFormatWhatsapp } from '../PrivacyContext.jsx';
import ClienteHistoricoDrawer from './ClienteHistoricoDrawer.jsx';
import ClienteDetalheDrawer from './ClienteDetalheDrawer.jsx';

export default function Clientes() {
  const confirm = useConfirm();
  const fmtCnpj = useFormatCnpj();
  const fmtWhatsapp = useFormatWhatsapp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [drawerCliente, setDrawerCliente] = useState(null);
  const [detalheCliente, setDetalheCliente] = useState(null);
  const [linkCliente, setLinkCliente] = useState(null);

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
    const cli = rows.find((r) => r.id === id);
    const ok = await confirm({
      message: (
        <>
          Tem certeza que deseja excluir este cliente?
          {cli?.nome && <><br /><strong>{cli.nome}</strong></>}
          <br />
          <span style={{ fontSize: 12 }}>As cobranças já cadastradas deste cliente permanecem no histórico.</span>
        </>
      )
    });
    if (!ok) return;
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
              <th style={{ width: 160 }}>Relatório</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6}><div className="empty-state">Carregando…</div></td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6}><div className="empty-state">Nenhum cliente cadastrado ainda.</div></td></tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="cell cliente-nome-cell">
                    <button
                      className="cliente-nome-link"
                      onClick={() => setDetalheCliente(r)}
                      title="Ver detalhes do cliente"
                    >
                      {r.nome}
                    </button>
                    {r.servicos_count > 0 && (
                      <span className="cliente-servicos-badge" title={`${r.servicos_count} serviço${r.servicos_count === 1 ? '' : 's'} contratado${r.servicos_count === 1 ? '' : 's'}`}>
                        {r.servicos_count} serviço{r.servicos_count === 1 ? '' : 's'}
                      </span>
                    )}
                    <button
                      className="cliente-historico-icon"
                      onClick={() => setDrawerCliente(r)}
                      title="Ver histórico financeiro"
                      aria-label="Ver histórico financeiro"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    </button>
                  </div>
                </td>
                <EditableCell value={r.cnpj} placeholder="—" displayFormat={fmtCnpj} onSave={(v) => handleUpdate(r.id, 'cnpj', v)} />
                <EditableCell value={r.whatsapp} placeholder="—" displayFormat={fmtWhatsapp} onSave={(v) => handleUpdate(r.id, 'whatsapp', v)} />
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
                <td>
                  <div className="cell">
                    <button
                      className={`btn btn-sm ${r.relatorio_token ? 'btn-ghost' : 'btn-primary'}`}
                      onClick={() => setLinkCliente(r)}
                      title={r.relatorio_token ? 'Ver/copiar link' : 'Gerar link de relatório'}
                    >
                      {r.relatorio_token ? 'Ver link' : 'Gerar link'}
                    </button>
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

      {drawerCliente && (
        <ClienteHistoricoDrawer
          cliente={drawerCliente}
          onClose={() => setDrawerCliente(null)}
        />
      )}

      {detalheCliente && (
        <ClienteDetalheDrawer
          cliente={detalheCliente}
          onClose={() => setDetalheCliente(null)}
          onChangeServicosCount={(id, count) => {
            setRows((rs) => rs.map((r) => (r.id === id ? { ...r, servicos_count: count } : r)));
          }}
          onChangeObservacoes={(id, obs) => {
            setRows((rs) => rs.map((r) => (r.id === id ? { ...r, observacoes: obs } : r)));
            setDetalheCliente((c) => (c && c.id === id ? { ...c, observacoes: obs } : c));
          }}
        />
      )}

      {linkCliente && (
        <RelatorioLinkModal
          cliente={linkCliente}
          onClose={() => setLinkCliente(null)}
          onTokenChange={(token) => {
            setRows((rs) => rs.map((r) => (r.id === linkCliente.id ? { ...r, relatorio_token: token } : r)));
            setLinkCliente((c) => (c ? { ...c, relatorio_token: token } : c));
          }}
        />
      )}
    </div>
  );
}

// --------------- Modal de link do relatório público ---------------
function RelatorioLinkModal({ cliente, onClose, onTokenChange }) {
  const confirm = useConfirm();
  const [token, setToken] = useState(cliente.relatorio_token || null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = token ? `${window.location.origin}/relatorio/${token}` : '';

  async function handleGerar() {
    setBusy(true);
    try {
      const { relatorio_token } = await api.gerarRelatorioToken(cliente.id);
      setToken(relatorio_token);
      onTokenChange?.(relatorio_token);
    } finally { setBusy(false); }
  }

  async function handleRevogar() {
    const ok = await confirm({
      message: (
        <>
          Revogar o link atual? O cliente <strong>{cliente.nome}</strong> deixará de acessar o relatório.
          <br />
          <span style={{ fontSize: 12 }}>Você pode gerar um novo link depois, com outro endereço.</span>
        </>
      )
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.revogarRelatorioToken(cliente.id);
      setToken(null);
      onTokenChange?.(null);
    } finally { setBusy(false); }
  }

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: select via prompt
      window.prompt('Copie o link:', link);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="modal-title">Link público do relatório</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="modal-body">
          <div className="modal-sub">
            Cliente: <strong>{cliente.nome}</strong>
          </div>

          {!token ? (
            <>
              <p className="modal-text">
                Ainda não há link gerado para este cliente. Ao gerar, qualquer pessoa com o endereço
                poderá visualizar as campanhas ativas e o histórico de ROAS, <strong>sem precisar de login</strong>.
              </p>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleGerar} disabled={busy}>
                  {busy ? 'Gerando…' : 'Gerar link'}
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="label" style={{ marginTop: 4 }}>Link do relatório</label>
              <div className="link-row">
                <input
                  className="link-input"
                  value={link}
                  readOnly
                  onFocus={(e) => e.target.select()}
                />
                <button className="btn btn-primary btn-sm" onClick={handleCopy}>
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="modal-text" style={{ fontSize: 12, marginTop: 8 }}>
                Qualquer pessoa com este link verá as campanhas ativas. Ao revogar, o link para de funcionar
                imediatamente.
              </p>

              <div className="modal-actions modal-actions-split">
                <button
                  className="btn btn-ghost btn-danger"
                  onClick={handleRevogar}
                  disabled={busy}
                >
                  Revogar link
                </button>
                <div className="modal-actions-right">
                  <button className="btn btn-ghost" onClick={handleGerar} disabled={busy} title="Gerar um novo token (invalida o atual)">
                    Gerar novo
                  </button>
                  <button className="btn btn-primary" onClick={onClose}>Concluir</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { api } from '../api/client.js';
import { useConfirm } from '../ConfirmContext.jsx';

const VARS = ['{nome_cliente}', '{valor}', '{vencimento}', '{chave_pix}'];

export default function Configuracoes() {
  const { settings, save } = useSettings();
  const [form, setForm] = useState(settings);
  const [savedFlash, setSavedFlash] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await save(form);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2200);
    } finally {
      setSalvando(false);
    }
  }

  function insertVar(varName) {
    setForm((f) => ({ ...f, template_cobranca: (f.template_cobranca || '') + ' ' + varName }));
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert('Logo deve ter até 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, logo_data: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    setForm((f) => ({ ...f, logo_data: '' }));
  }

  return (
    <form className="config-card" onSubmit={handleSubmit}>
      {/* Logo */}
      <div className="config-field">
        <label>Logo da agência</label>
        <p className="hint">PNG/JPG até 1 MB. Aparece no cabeçalho e nos PDFs.</p>
        <div className="config-logo-row">
          <div className="config-logo-preview">
            {form.logo_data
              ? <img src={form.logo_data} alt="Logo" />
              : <span className="muted">Sem logo</span>}
          </div>
          <div className="config-logo-actions">
            <label className="btn btn-sm">
              {form.logo_data ? 'Trocar' : 'Escolher arquivo'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
            </label>
            {form.logo_data && (
              <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={clearLogo}>
                Remover
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nome da agência */}
      <div className="config-field">
        <label htmlFor="cfg-nome">Nome da agência</label>
        <input
          id="cfg-nome"
          type="text"
          placeholder="Ex.: Spacefy Marketing"
          value={form.nome_agencia || ''}
          onChange={(e) => setForm({ ...form, nome_agencia: e.target.value })}
        />
      </div>

      {/* Chave PIX */}
      <div className="config-field">
        <label htmlFor="cfg-pix">Chave PIX</label>
        <p className="hint">Usada nas mensagens de cobrança via WhatsApp.</p>
        <input
          id="cfg-pix"
          type="text"
          placeholder="ex.: contato@spacefy.com.br"
          value={form.chave_pix || ''}
          onChange={(e) => setForm({ ...form, chave_pix: e.target.value })}
        />
      </div>

      {/* WhatsApp do dono */}
      <div className="config-field">
        <label htmlFor="cfg-wa">Número WhatsApp</label>
        <p className="hint">Recebe notificação automática quando um pagamento é marcado como Pago.</p>
        <input
          id="cfg-wa"
          type="tel"
          placeholder="(11) 99999-9999"
          value={form.whatsapp_dono || ''}
          onChange={(e) => setForm({ ...form, whatsapp_dono: e.target.value })}
        />
      </div>

      {/* Template */}
      <div className="config-field">
        <label htmlFor="cfg-tpl">Template de mensagem de cobrança</label>
        <p className="hint">Variáveis disponíveis (clique para inserir):</p>
        <div className="template-vars">
          {VARS.map((v) => (
            <button type="button" key={v} className="template-var" onClick={() => insertVar(v)}>{v}</button>
          ))}
        </div>
        <textarea
          id="cfg-tpl"
          rows={8}
          value={form.template_cobranca || ''}
          onChange={(e) => setForm({ ...form, template_cobranca: e.target.value })}
        />
      </div>

      <div className="config-card-actions">
        <button className="btn btn-primary" type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar configurações'}
        </button>
        {savedFlash && <span className="config-saved-flash">✓ Salvo com sucesso</span>}
      </div>

      <FuncionariosSection />
    </form>
  );
}

// ---------- Seção: Funcionários convidados ----------
const ABA_LABELS = { conteudo: 'Conteúdo', tarefas: 'Tarefas', agenda: 'Agenda', notas: 'Notas' };

function FuncionariosSection() {
  const confirm = useConfirm();
  const [convites, setConvites] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try { setConvites(await api.listConvites()); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function statusOf(c) {
    if (c.revogado_em) return { txt: 'Revogado',  cls: 'badge-neutral' };
    if (c.aceito_em)   return { txt: 'Ativo',     cls: 'badge-pago' };
    if (Date.parse(c.expires_at.replace(' ', 'T') + 'Z') < Date.now()) return { txt: 'Expirado', cls: 'badge-atrasado' };
    return { txt: 'Pendente', cls: 'badge-pendente' };
  }

  async function revogar(c) {
    const ok = await confirm({
      message: <>Revogar acesso de <strong>{c.email}</strong>? O funcionário não poderá mais acessar o sistema.</>
    });
    if (!ok) return;
    await api.revogarConvite(c.id);
    load();
  }

  return (
    <div className="config-funcionarios">
      <div className="config-funcionarios-head">
        <div>
          <h3 className="config-funcionarios-title">Funcionários convidados</h3>
          <p className="hint">Pessoas com acesso parcial ao sistema. Use o botão "Convidar funcionário" nas abas Conteúdo/Tarefas/Agenda/Notas.</p>
        </div>
      </div>

      {loading && <div className="empty-state">Carregando…</div>}
      {!loading && convites.length === 0 && (
        <div className="empty-state">Nenhum convite enviado ainda.</div>
      )}
      {!loading && convites.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Áreas</th>
                <th style={{ width: 110 }}>Permissão</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {convites.map((c) => {
                const st = statusOf(c);
                return (
                  <tr key={c.id}>
                    <td><div className="cell" style={{ fontWeight: 600 }}>{c.nome}</div></td>
                    <td><div className="cell">{c.email}</div></td>
                    <td>
                      <div className="cell" style={{ fontSize: 12.5 }}>
                        {(c.abas_acesso || []).map((a) => ABA_LABELS[a] || a).join(', ') || '—'}
                      </div>
                    </td>
                    <td>
                      <div className="cell">
                        <span className="badge badge-neutral">
                          {c.permissao === 'editar' ? 'Editar' : 'Visualizar'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="cell"><span className={`badge ${st.cls}`}>{st.txt}</span></div>
                    </td>
                    <td className="actions-cell">
                      {!c.revogado_em && (
                        <button className="btn btn-sm btn-ghost btn-danger" onClick={() => revogar(c)}>
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

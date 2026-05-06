import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../ToastContext.jsx';
import { copyToClipboard } from '../utils.js';

const ABAS = [
  { id: 'conteudo', label: 'Conteúdo' },
  { id: 'tarefas',  label: 'Tarefas' },
  { id: 'agenda',   label: 'Agenda' },
  { id: 'notas',    label: 'Notas' }
];

export default function InviteFuncionarioModal({ aba, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    nome: '',
    email: '',
    permissao: 'editar',
    abas: aba ? [aba] : []
  });
  const [busy, setBusy] = useState(false);
  const [conviteCriado, setConviteCriado] = useState(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggleAba(id) {
    setForm((f) => {
      const set = new Set(f.abas);
      if (set.has(id)) set.delete(id); else set.add(id);
      return { ...f, abas: [...set] };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim()) {
      toast?.error('Preencha nome e e-mail.');
      return;
    }
    if (form.abas.length === 0) {
      toast?.error('Selecione pelo menos uma aba.');
      return;
    }
    setBusy(true);
    try {
      const conv = await api.createConvite({
        nome: form.nome.trim(),
        email: form.email.trim(),
        permissao: form.permissao,
        abas_acesso: form.abas
      });
      setConviteCriado(conv);
      toast?.success('Convite gerado!');
    } catch (err) {
      toast?.error('Falha ao criar convite: ' + (err?.message || err));
    } finally { setBusy(false); }
  }

  function buildLink(token) {
    return `${window.location.origin}/convite/${token}`;
  }

  function abrirEmail() {
    if (!conviteCriado) return;
    const link = buildLink(conviteCriado.token);
    const subject = 'Convite de acesso — SpaceSystem';
    const body =
      `Olá ${form.nome},\n\n` +
      `Você foi convidado(a) para colaborar no SpaceSystem.\n\n` +
      `Acesse pelo link abaixo (válido por 7 dias):\n${link}\n\n` +
      `Permissão: ${form.permissao === 'editar' ? 'editar' : 'visualizar'}\n` +
      `Áreas: ${form.abas.map((a) => ABAS.find((x) => x.id === a)?.label || a).join(', ')}\n\n` +
      `— Spacefy Marketing`;
    window.location.href =
      `mailto:${encodeURIComponent(form.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function copiar() {
    if (!conviteCriado) return;
    const link = buildLink(conviteCriado.token);
    const ok = await copyToClipboard(link);
    if (ok) toast?.success('Link copiado!');
    else toast?.warn('Não foi possível copiar — selecione o link manualmente.');
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-head">
          <h3 className="modal-title">Convidar funcionário</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="modal-body">
          {!conviteCriado ? (
            <>
              <p className="modal-text" style={{ fontSize: 12.5, marginBottom: 12 }}>
                O convite expira em 7 dias. Após aceitar, o funcionário verá apenas as áreas selecionadas.
              </p>
              <div className="form-grid">
                <div className="field field-full">
                  <label>Nome</label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Nome completo"
                    required
                    autoFocus
                  />
                </div>
                <div className="field field-full">
                  <label>E-mail</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@empresa.com"
                    required
                  />
                </div>
                <div className="field field-full">
                  <label>Permissão</label>
                  <select
                    value={form.permissao}
                    onChange={(e) => setForm({ ...form, permissao: e.target.value })}
                  >
                    <option value="visualizar">Visualizar (apenas leitura)</option>
                    <option value="editar">Editar (criar e modificar)</option>
                  </select>
                </div>
                <div className="field field-full">
                  <label>Áreas que terá acesso</label>
                  <div className="invite-abas-grid">
                    {ABAS.map((a) => {
                      const ativa = form.abas.includes(a.id);
                      return (
                        <button
                          type="button"
                          key={a.id}
                          className={`invite-aba-btn ${ativa ? 'is-active' : ''}`}
                          onClick={() => toggleAba(a.id)}
                        >
                          <span className="invite-aba-check">{ativa ? '✓' : ''}</span>
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: 18 }}>
                <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Gerando…' : 'Gerar convite'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="modal-text">
                Convite gerado para <strong>{conviteCriado.email}</strong>. Compartilhe o link abaixo:
              </p>
              <label className="label" style={{ marginTop: 10 }}>Link do convite</label>
              <div className="link-row">
                <input
                  className="link-input"
                  value={buildLink(conviteCriado.token)}
                  readOnly
                  onFocus={(e) => e.target.select()}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={copiar}>
                  Copiar
                </button>
              </div>
              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
                <button type="button" className="btn btn-primary" onClick={abrirEmail}>
                  Enviar por e-mail
                </button>
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

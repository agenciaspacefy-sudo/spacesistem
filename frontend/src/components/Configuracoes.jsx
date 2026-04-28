import { useEffect, useState } from 'react';
import { useSettings } from '../SettingsContext.jsx';

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
    </form>
  );
}

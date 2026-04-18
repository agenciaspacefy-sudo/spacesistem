import { useEffect, useState } from 'react';
import { useSettings } from '../SettingsContext.jsx';

const VARS = ['{nome_cliente}', '{valor}', '{vencimento}', '{chave_pix}'];

export default function Configuracoes() {
  const { settings, save } = useSettings();
  const [form, setForm] = useState(settings);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);

  async function handleSubmit(e) {
    e.preventDefault();
    await save(form);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
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
    <form onSubmit={handleSubmit}>
      <div className="settings-grid">
        <div className="settings-section">
          <h3>Chave PIX da agência</h3>
          <p className="hint">Usada nas mensagens de cobrança via WhatsApp.</p>
          <input
            placeholder="ex.: contato@spacefy.com.br"
            value={form.chave_pix || ''}
            onChange={(e) => setForm({ ...form, chave_pix: e.target.value })}
          />
        </div>

        <div className="settings-section">
          <h3>WhatsApp do dono</h3>
          <p className="hint">Recebe notificação automática quando um pagamento é marcado como Pago.</p>
          <input
            placeholder="(11) 99999-9999"
            value={form.whatsapp_dono || ''}
            onChange={(e) => setForm({ ...form, whatsapp_dono: e.target.value })}
          />
        </div>

        <div className="settings-section" style={{ gridColumn: '1 / -1' }}>
          <h3>Template de cobrança</h3>
          <p className="hint">Variáveis disponíveis (clique para inserir):</p>
          <div className="template-vars" style={{ marginBottom: 10 }}>
            {VARS.map((v) => (
              <button type="button" key={v} className="template-var" onClick={() => insertVar(v)}>{v}</button>
            ))}
          </div>
          <textarea
            rows={8}
            value={form.template_cobranca || ''}
            onChange={(e) => setForm({ ...form, template_cobranca: e.target.value })}
          />
        </div>

        <div className="settings-section">
          <h3>Logo da agência</h3>
          <p className="hint">PNG/JPG até 1 MB. Aparece no cabeçalho.</p>
          <div className="logo-preview">
            {form.logo_data ? <img src={form.logo_data} alt="Logo" /> : <span className="muted">Sem logo — usando padrão Spacefy</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <label className="btn btn-sm">
              Escolher arquivo
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

      <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-primary" type="submit">Salvar configurações</button>
        {savedFlash && <span style={{ color: 'var(--green)', fontSize: 13 }}>✓ Salvo</span>}
      </div>
    </form>
  );
}

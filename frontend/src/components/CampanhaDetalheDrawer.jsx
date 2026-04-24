import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useConfirm } from '../ConfirmContext.jsx';
import { useFormatBRL } from '../PrivacyContext.jsx';
import { formatDate, todayISO } from '../utils.js';
import {
  PLATAFORMAS,
  OBJETIVOS,
  STATUS_CAMP,
  calcRoas,
  formatRoas,
  RoasBadge
} from './Campanhas.jsx';

export default function CampanhaDetalheDrawer({ campanha, clientes, onClose, onSave, onDelete }) {
  const fmtBRL = useFormatBRL();
  const confirm = useConfirm();
  const [form, setForm] = useState(() => ({
    cliente_id: campanha.cliente_id ?? '',
    nome: campanha.nome ?? '',
    plataforma: campanha.plataforma ?? 'Meta Ads',
    objetivo: campanha.objetivo ?? 'Conversão',
    orcamento_mensal: campanha.orcamento_mensal ?? 0,
    investimento_mes: campanha.investimento_mes ?? 0,
    resultado_mes: campanha.resultado_mes ?? 0,
    status: campanha.status ?? 'Ativa',
    data_inicio: campanha.data_inicio ?? ''
  }));
  const [saving, setSaving] = useState(false);

  const [reunioes, setReunioes] = useState([]);
  const [loadingReu, setLoadingReu] = useState(false);
  const [reuForm, setReuForm] = useState(null); // null | {modo:'new'|'edit', data:{...}}

  const roas = calcRoas(form.investimento_mes, form.resultado_mes);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { loadReunioes(); }, [campanha.id]);

  async function loadReunioes() {
    setLoadingReu(true);
    try {
      setReunioes(await api.listReunioes(campanha.id));
    } finally {
      setLoadingReu(false);
    }
  }

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        orcamento_mensal: Number(form.orcamento_mensal) || 0,
        investimento_mes: Number(form.investimento_mes) || 0,
        resultado_mes: Number(form.resultado_mes) || 0
      };
      const updated = await api.updateCampanha(campanha.id, payload);
      onSave(updated);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function openNewReuniao() {
    setReuForm({
      modo: 'new',
      data: {
        data: todayISO(),
        pauta: '',
        decisoes: '',
        ajustes_orcamento: '',
        proximos_passos: ''
      }
    });
  }

  function openEditReuniao(r) {
    setReuForm({ modo: 'edit', data: { ...r } });
  }

  async function saveReuniao(e) {
    e.preventDefault();
    const { modo, data } = reuForm;
    try {
      if (modo === 'new') {
        const created = await api.createReuniao(campanha.id, data);
        setReunioes((rs) => [created, ...rs]);
      } else {
        const updated = await api.updateReuniao(data.id, data);
        setReunioes((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      }
      setReuForm(null);
    } catch (err) {
      alert('Erro ao salvar reunião: ' + err.message);
    }
  }

  async function removeReuniao(id) {
    const ok = await confirm({ message: 'Excluir esta reunião?' });
    if (!ok) return;
    await api.deleteReuniao(id);
    setReunioes((rs) => rs.filter((r) => r.id !== id));
  }

  const pct = form.orcamento_mensal > 0
    ? Math.min(100, (Number(form.investimento_mes) / Number(form.orcamento_mensal)) * 100)
    : 0;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="drawer drawer-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Detalhes da campanha"
      >
        <header className="drawer-header">
          <div>
            <div className="drawer-title">{form.nome || 'Campanha'}</div>
            <div className="drawer-sub">
              {campanha.cliente_nome || 'Sem cliente'} · {form.plataforma}
            </div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="drawer-body">
          {/* --- Métricas rápidas --- */}
          <div className="drawer-stats">
            <div className="drawer-stat">
              <div className="drawer-stat-label">Orçamento</div>
              <div className="drawer-stat-value">{fmtBRL(form.orcamento_mensal)}</div>
            </div>
            <div className="drawer-stat">
              <div className="drawer-stat-label">Investido</div>
              <div className="drawer-stat-value">{fmtBRL(form.investimento_mes)}</div>
              <div className="drawer-stat-sub">{pct.toFixed(0)}% do orçamento</div>
            </div>
            <div className="drawer-stat">
              <div className="drawer-stat-label">ROAS</div>
              <div className="drawer-stat-value"><RoasBadge roas={roas} /></div>
            </div>
          </div>

          {/* --- Edição da campanha --- */}
          <form className="drawer-section" onSubmit={handleSave}>
            <h4>Dados da campanha</h4>
            <div className="form-grid">
              <div className="field">
                <label>Cliente</label>
                <select value={form.cliente_id ?? ''} onChange={(e) => set('cliente_id', e.target.value)}>
                  <option value="">— Sem cliente —</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Nome</label>
                <input value={form.nome} onChange={(e) => set('nome', e.target.value)} required />
              </div>
              <div className="field">
                <label>Plataforma</label>
                <select value={form.plataforma} onChange={(e) => set('plataforma', e.target.value)}>
                  {PLATAFORMAS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Objetivo</label>
                <select value={form.objetivo} onChange={(e) => set('objetivo', e.target.value)}>
                  {OBJETIVOS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Orçamento mensal (R$)</label>
                <input type="number" step="0.01" min="0"
                  value={form.orcamento_mensal}
                  onChange={(e) => set('orcamento_mensal', e.target.value)} />
              </div>
              <div className="field">
                <label>Investimento atual (R$)</label>
                <input type="number" step="0.01" min="0"
                  value={form.investimento_mes}
                  onChange={(e) => set('investimento_mes', e.target.value)} />
              </div>
              <div className="field">
                <label>Resultado gerado (R$)</label>
                <input type="number" step="0.01" min="0"
                  value={form.resultado_mes}
                  onChange={(e) => set('resultado_mes', e.target.value)} />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUS_CAMP.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Data de início</label>
                <input type="date" value={form.data_inicio || ''} onChange={(e) => set('data_inicio', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-ghost btn-danger"
                onClick={() => onDelete(campanha.id)}
              >
                Excluir campanha
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </form>

          {/* --- Histórico de reuniões --- */}
          <section className="drawer-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h4 style={{ margin: 0 }}>Histórico de reuniões</h4>
              <button className="btn btn-sm btn-primary" onClick={openNewReuniao}>+ Nova reunião</button>
            </div>

            {reuForm && (
              <form className="reuniao-form" onSubmit={saveReuniao}>
                <div className="form-grid">
                  <div className="field">
                    <label>Data</label>
                    <input
                      type="date"
                      required
                      value={reuForm.data.data || ''}
                      onChange={(e) => setReuForm((rf) => ({ ...rf, data: { ...rf.data, data: e.target.value } }))}
                    />
                  </div>
                  <div className="field field-full">
                    <label>Pauta discutida</label>
                    <textarea
                      rows="2"
                      value={reuForm.data.pauta || ''}
                      onChange={(e) => setReuForm((rf) => ({ ...rf, data: { ...rf.data, pauta: e.target.value } }))}
                    />
                  </div>
                  <div className="field field-full">
                    <label>Decisões tomadas</label>
                    <textarea
                      rows="2"
                      value={reuForm.data.decisoes || ''}
                      onChange={(e) => setReuForm((rf) => ({ ...rf, data: { ...rf.data, decisoes: e.target.value } }))}
                    />
                  </div>
                  <div className="field field-full">
                    <label>Ajustes de orçamento</label>
                    <textarea
                      rows="2"
                      value={reuForm.data.ajustes_orcamento || ''}
                      onChange={(e) => setReuForm((rf) => ({ ...rf, data: { ...rf.data, ajustes_orcamento: e.target.value } }))}
                    />
                  </div>
                  <div className="field field-full">
                    <label>Próximos passos</label>
                    <textarea
                      rows="2"
                      value={reuForm.data.proximos_passos || ''}
                      onChange={(e) => setReuForm((rf) => ({ ...rf, data: { ...rf.data, proximos_passos: e.target.value } }))}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReuForm(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary btn-sm">Salvar reunião</button>
                </div>
              </form>
            )}

            {loadingReu ? (
              <div className="empty-state">Carregando reuniões…</div>
            ) : reunioes.length === 0 ? (
              <div className="empty-state">
                Nenhuma reunião registrada. Clique em “+ Nova reunião” para começar.
              </div>
            ) : (
              <ul className="reunioes-list">
                {reunioes.map((r) => (
                  <li key={r.id} className="reuniao-item">
                    <div className="reuniao-item-head">
                      <div className="reuniao-item-date">{formatDate(r.data)}</div>
                      <div className="reuniao-item-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => openEditReuniao(r)}>Editar</button>
                        <button className="btn btn-sm btn-ghost btn-danger" onClick={() => removeReuniao(r.id)}>Excluir</button>
                      </div>
                    </div>
                    {r.pauta && (
                      <div className="reuniao-item-block">
                        <span className="reuniao-item-label">Pauta</span>
                        <div>{r.pauta}</div>
                      </div>
                    )}
                    {r.decisoes && (
                      <div className="reuniao-item-block">
                        <span className="reuniao-item-label">Decisões</span>
                        <div>{r.decisoes}</div>
                      </div>
                    )}
                    {r.ajustes_orcamento && (
                      <div className="reuniao-item-block">
                        <span className="reuniao-item-label">Ajustes de orçamento</span>
                        <div>{r.ajustes_orcamento}</div>
                      </div>
                    )}
                    {r.proximos_passos && (
                      <div className="reuniao-item-block">
                        <span className="reuniao-item-label">Próximos passos</span>
                        <div>{r.proximos_passos}</div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="drawer-footer">
          <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
        </footer>
      </aside>
    </div>
  );
}

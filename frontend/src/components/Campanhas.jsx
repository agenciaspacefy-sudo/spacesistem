import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useFormatBRL } from '../PrivacyContext.jsx';
import { useConfirm } from '../ConfirmContext.jsx';
import CampanhaDetalheDrawer from './CampanhaDetalheDrawer.jsx';

// -------------- Constantes --------------
export const PLATAFORMAS = ['Meta Ads', 'Google Ads', 'TikTok Ads'];
export const OBJETIVOS = ['Conversão', 'Tráfego', 'Alcance', 'Engajamento', 'Leads'];
export const STATUS_CAMP = ['Ativa', 'Pausada', 'Encerrada'];

// -------------- Helpers --------------
export function calcRoas(invest, resultado) {
  const i = Number(invest) || 0;
  const r = Number(resultado) || 0;
  return i > 0 ? r / i : 0;
}

export function roasTier(roas) {
  if (roas >= 6) return 'alto';
  if (roas >= 3) return 'medio';
  return 'baixo';
}

export function formatRoas(roas) {
  return `${roas.toFixed(2).replace('.', ',')}x`;
}

function percentUsado(invest, orcamento) {
  const i = Number(invest) || 0;
  const o = Number(orcamento) || 0;
  return o > 0 ? Math.min(100, (i / o) * 100) : 0;
}

// Badge visual do ROAS
export function RoasBadge({ roas, inline }) {
  const tier = roasTier(roas);
  const cls = `roas-badge roas-badge-${tier}${inline ? ' roas-badge-inline' : ''}`;
  return <span className={cls}>ROAS {formatRoas(roas)}</span>;
}

// -------------- Form de nova campanha --------------
function emptyForm() {
  return {
    cliente_id: '',
    nome: '',
    plataforma: 'Meta Ads',
    objetivo: 'Conversão',
    orcamento_mensal: '',
    investimento_mes: '',
    resultado_mes: '',
    status: 'Ativa',
    data_inicio: new Date().toISOString().slice(0, 10)
  };
}

function CampanhaFormModal({ clientes, onClose, onSave }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        orcamento_mensal: Number(form.orcamento_mensal) || 0,
        investimento_mes: Number(form.investimento_mes) || 0,
        resultado_mes: Number(form.resultado_mes) || 0
      };
      const created = await api.createCampanha(payload);
      onSave(created);
      onClose();
    } catch (err) {
      alert('Erro ao criar campanha: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()} role="dialog">
        <h3>Nova campanha de tráfego</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Cliente</label>
              <select value={form.cliente_id} onChange={(e) => set('cliente_id', e.target.value)}>
                <option value="">— Sem cliente —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Nome da campanha *</label>
              <input
                required autoFocus
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Ex.: Black Friday — Conversão"
              />
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
              <input
                type="number" step="0.01" min="0"
                value={form.orcamento_mensal}
                onChange={(e) => set('orcamento_mensal', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Investimento atual no mês (R$)</label>
              <input
                type="number" step="0.01" min="0"
                value={form.investimento_mes}
                onChange={(e) => set('investimento_mes', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Resultado gerado no mês (R$)</label>
              <input
                type="number" step="0.01" min="0"
                value={form.resultado_mes}
                onChange={(e) => set('resultado_mes', e.target.value)}
              />
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
          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Criar campanha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------- Card de campanha --------------
function CampanhaCard({ c, onOpen, onInvite, fmtBRL }) {
  const roas = calcRoas(c.investimento_mes, c.resultado_mes);
  const pct = percentUsado(c.investimento_mes, c.orcamento_mensal);
  const orcamentoAlto = pct >= 90 && c.status === 'Ativa';
  const cardCls = [
    'campanha-card',
    orcamentoAlto ? 'campanha-card-alert' : '',
    c.status !== 'Ativa' ? 'campanha-card-inativa' : ''
  ].filter(Boolean).join(' ');

  return (
    <button className={cardCls} onClick={() => onOpen(c)}>
      <div className="campanha-card-header">
        <div className="campanha-card-title">
          <div className="campanha-card-nome">{c.nome}</div>
          <div className="campanha-card-cliente">
            {c.cliente_nome || 'Sem cliente'}
          </div>
        </div>
        <span className={`badge badge-plataforma plat-${c.plataforma.split(' ')[0].toLowerCase()}`}>
          {c.plataforma}
        </span>
      </div>

      <div className="campanha-card-body">
        <div className="campanha-metric">
          <div className="campanha-metric-label">Orçamento / mês</div>
          <div className="campanha-metric-value mono">{fmtBRL(c.orcamento_mensal)}</div>
        </div>
        <div className="campanha-metric">
          <div className="campanha-metric-label">Investido</div>
          <div className="campanha-metric-value mono">{fmtBRL(c.investimento_mes)}</div>
        </div>
        <div className="campanha-metric">
          <div className="campanha-metric-label">Resultado</div>
          <div className="campanha-metric-value mono pos">{fmtBRL(c.resultado_mes)}</div>
        </div>
      </div>

      {c.orcamento_mensal > 0 && (
        <div className="campanha-progress" title={`${pct.toFixed(0)}% do orçamento`}>
          <div
            className={`campanha-progress-bar ${pct >= 90 ? 'alto' : pct >= 70 ? 'medio' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="campanha-card-footer">
        <RoasBadge roas={roas} />
        <span className={`badge badge-status-${c.status.toLowerCase()}`}>{c.status}</span>
        <span
          className="campanha-card-invite"
          role="button"
          tabIndex={0}
          title={c.acesso_token ? 'Ver/copiar link do cliente' : 'Convidar cliente para ver os resultados'}
          onClick={(e) => { e.stopPropagation(); onInvite?.(c); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault(); e.stopPropagation(); onInvite?.(c);
            }
          }}
        >
          {c.acesso_token ? '🔗 Link do cliente' : '✉ Convidar cliente'}
        </span>
      </div>

      {orcamentoAlto && (
        <div className="campanha-card-flag">⚠ Orçamento em {pct.toFixed(0)}%</div>
      )}
    </button>
  );
}

function CampanhaInviteModal({ campanha, onClose, onTokenChange }) {
  const [email, setEmail] = useState(campanha.acesso_email || '');
  const [token, setToken] = useState(campanha.acesso_token || null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = token
    ? `${window.location.origin}/campanha/${token}`
    : '';

  async function handleGerar() {
    setBusy(true);
    try {
      const r = await api.gerarAcessoCampanhaToken(campanha.id, email || null);
      setToken(r.acesso_token);
      onTokenChange?.(r.acesso_token, r.acesso_email);
    } finally { setBusy(false); }
  }

  async function handleRevogar() {
    setBusy(true);
    try {
      await api.revogarAcessoCampanhaToken(campanha.id);
      setToken(null);
      onTokenChange?.(null, null);
    } finally { setBusy(false); }
  }

  function handleCopy() {
    if (!link) return;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => window.prompt('Copie o link:', link));
  }

  function abrirEmail() {
    if (!email || !link) return;
    const subject = 'Acesso aos resultados da sua campanha — SpaceSystem';
    const body =
      `Olá!\n\n` +
      `Acesse os resultados em tempo real da sua campanha "${campanha.nome}" pelo link abaixo:\n\n` +
      `${link}\n\n` +
      `O link mantém você atualizado com investimento, resultado e ROAS.\n\n` +
      `— Spacefy Marketing`;
    window.location.href =
      `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="modal-title">Convidar cliente</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="modal-body">
          <div className="modal-sub">
            Campanha: <strong>{campanha.nome}</strong>
          </div>

          <label className="label" style={{ marginTop: 12 }}>E-mail do cliente</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@exemplo.com"
            disabled={busy}
          />

          {!token ? (
            <>
              <p className="modal-text" style={{ marginTop: 12, fontSize: 12.5 }}>
                Ao gerar o link, qualquer pessoa com o endereço pode visualizar
                os resultados desta campanha em tempo real, sem precisar de login.
              </p>
              <div className="modal-actions" style={{ marginTop: 14 }}>
                <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleGerar} disabled={busy}>
                  {busy ? 'Gerando…' : 'Gerar link'}
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="label" style={{ marginTop: 12 }}>Link do cliente</label>
              <div className="link-row">
                <input className="link-input" value={link} readOnly onFocus={(e) => e.target.select()} />
                <button className="btn btn-primary btn-sm" onClick={handleCopy}>
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="modal-actions modal-actions-split" style={{ marginTop: 14 }}>
                <button className="btn btn-ghost btn-danger" onClick={handleRevogar} disabled={busy}>
                  Revogar
                </button>
                <div className="modal-actions-right">
                  <button
                    className="btn btn-primary"
                    onClick={abrirEmail}
                    disabled={!email || busy}
                    title={email ? 'Abrir cliente de email com mensagem pronta' : 'Preencha o e-mail antes'}
                  >
                    Enviar por e-mail
                  </button>
                  <button className="btn btn-ghost" onClick={onClose}>Concluir</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------- Componente principal --------------
export default function Campanhas() {
  const fmtBRL = useFormatBRL();
  const confirm = useConfirm();
  const [campanhas, setCampanhas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [resumo, setResumo] = useState({ total_investido: 0, total_resultado: 0, roas_medio: 0, ativas: 0 });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [inviteCamp, setInviteCamp] = useState(null);

  // Filtros
  const [fCliente, setFCliente] = useState('');
  const [fPlataforma, setFPlataforma] = useState('');
  const [fStatus, setFStatus] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [camps, clis, res] = await Promise.all([
        api.listCampanhas(),
        api.listClientes(),
        api.campanhasResumo()
      ]);
      setCampanhas(camps);
      setClientes(clis);
      setResumo(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtradas = useMemo(() => {
    return campanhas.filter((c) => {
      if (fCliente && String(c.cliente_id ?? '') !== String(fCliente)) return false;
      if (fPlataforma && c.plataforma !== fPlataforma) return false;
      if (fStatus && c.status !== fStatus) return false;
      return true;
    });
  }, [campanhas, fCliente, fPlataforma, fStatus]);

  const alertas = useMemo(() => {
    return campanhas.filter((c) => {
      if (c.status !== 'Ativa' || !c.orcamento_mensal) return false;
      return percentUsado(c.investimento_mes, c.orcamento_mensal) >= 90;
    });
  }, [campanhas]);

  function handleCreated(created) {
    setCampanhas((cs) => [created, ...cs]);
    // Recarrega resumo (totais)
    api.campanhasResumo().then(setResumo).catch(() => {});
  }

  async function handleSaved(updated) {
    setCampanhas((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
    api.campanhasResumo().then(setResumo).catch(() => {});
  }

  async function handleDelete(id) {
    const ok = await confirm({ message: 'Excluir esta campanha e todas as reuniões associadas?' });
    if (!ok) return;
    await api.deleteCampanha(id);
    setCampanhas((cs) => cs.filter((c) => c.id !== id));
    setDetalhe(null);
    api.campanhasResumo().then(setResumo).catch(() => {});
  }

  return (
    <div className="campanhas-wrap">
      {/* Cards de resumo */}
      <div className="cards">
        <div className="card">
          <div className="card-label">Total investido no mês</div>
          <div className="card-value">{fmtBRL(resumo.total_investido)}</div>
        </div>
        <div className="card">
          <div className="card-label">Resultado gerado</div>
          <div className="card-value pos">{fmtBRL(resumo.total_resultado)}</div>
        </div>
        <div className="card">
          <div className="card-label">ROAS médio</div>
          <div className={`card-value ${resumo.roas_medio >= 3 ? 'pos' : 'neg'}`}>
            {formatRoas(resumo.roas_medio || 0)}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Campanhas ativas</div>
          <div className="card-value">{resumo.ativas || 0}</div>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="campanha-alerts">
          {alertas.map((c) => {
            const pct = percentUsado(c.investimento_mes, c.orcamento_mensal);
            return (
              <div key={c.id} className="campanha-alert">
                <span className="campanha-alert-icon">⚠</span>
                <div className="campanha-alert-text">
                  <strong>{c.nome}</strong>
                  {c.cliente_nome && <> — {c.cliente_nome}</>}
                  {' '}está em <strong>{pct.toFixed(0)}%</strong> do orçamento mensal.
                </div>
                <button className="btn btn-sm" onClick={() => setDetalhe(c)}>Abrir</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar" style={{ padding: 0, marginBottom: 12 }}>
        <div className="toolbar-left" style={{ flexWrap: 'wrap', gap: 8 }}>
          <select value={fCliente} onChange={(e) => setFCliente(e.target.value)}>
            <option value="">Todos clientes</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select value={fPlataforma} onChange={(e) => setFPlataforma(e.target.value)}>
            <option value="">Todas plataformas</option>
            {PLATAFORMAS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Todos status</option>
            {STATUS_CAMP.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {(fCliente || fPlataforma || fStatus) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setFCliente(''); setFPlataforma(''); setFStatus(''); }}>
              Limpar filtros
            </button>
          )}
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Nova campanha
          </button>
        </div>
      </div>

      {/* Grid de campanhas */}
      {loading ? (
        <div className="empty-state">Carregando campanhas…</div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state">
          {campanhas.length === 0
            ? 'Nenhuma campanha cadastrada ainda. Clique em "+ Nova campanha" para começar.'
            : 'Nenhuma campanha corresponde aos filtros aplicados.'}
        </div>
      ) : (
        <div className="campanhas-grid">
          {filtradas.map((c) => (
            <CampanhaCard key={c.id} c={c} onOpen={setDetalhe} onInvite={setInviteCamp} fmtBRL={fmtBRL} />
          ))}
        </div>
      )}

      {showForm && (
        <CampanhaFormModal
          clientes={clientes}
          onClose={() => setShowForm(false)}
          onSave={handleCreated}
        />
      )}

      {detalhe && (
        <CampanhaDetalheDrawer
          campanha={detalhe}
          clientes={clientes}
          onClose={() => setDetalhe(null)}
          onSave={handleSaved}
          onDelete={handleDelete}
        />
      )}

      {inviteCamp && (
        <CampanhaInviteModal
          campanha={inviteCamp}
          onClose={() => setInviteCamp(null)}
          onTokenChange={(token, email) => {
            setCampanhas((cs) => cs.map((c) =>
              c.id === inviteCamp.id ? { ...c, acesso_token: token, acesso_email: email } : c
            ));
            setInviteCamp((c) => c ? { ...c, acesso_token: token, acesso_email: email } : c);
          }}
        />
      )}
    </div>
  );
}

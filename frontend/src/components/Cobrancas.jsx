import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useSettings } from '../SettingsContext.jsx';
import {
  applyTemplate,
  buildWaUrl,
  formatBRL,
  formatDate,
  todayISO
} from '../utils.js';
import { generateReceipt } from '../receipt.js';
import { showPaymentNotification } from '../notifications.js';
import { useConfirm } from '../ConfirmContext.jsx';
import { useFormatBRL, useFormatCnpj } from '../PrivacyContext.jsx';
import { useToast } from '../ToastContext.jsx';

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: 'transform 160ms ease',
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)'
      }}
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function StatusBadge({ value }) {
  const cls =
    value === 'Pago' ? 'badge-pago' :
    value === 'Atrasado' ? 'badge-atrasado' : 'badge-pendente';
  return <span className={`badge ${cls}`}>{value || 'Pendente'}</span>;
}

function GroupStatusBadge({ status }) {
  const cls =
    status === 'Em dia' ? 'badge-pago' :
    status === 'Atrasado' ? 'badge-atrasado' : 'badge-pendente';
  return <span className={`badge ${cls}`}>{status}</span>;
}

function TipoLabel({ value }) {
  const isRecorrente = value === 'Recorrente';
  return (
    <span className={`cob-tipo-text ${isRecorrente ? 'cob-tipo-recorrente' : 'cob-tipo-unico'}`}>
      {isRecorrente ? 'Recorrência Mensal' : 'Pagamento Único'}
    </span>
  );
}

export default function Cobrancas() {
  const { settings } = useSettings();
  const confirm = useConfirm();
  const toast = useToast();
  const fmtBRL = useFormatBRL();
  const fmtCnpj = useFormatCnpj();
  const [rows, setRows] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [preview, setPreview] = useState(null);
  const [receiptModal, setReceiptModal] = useState(null);
  const [filter, setFilter] = useState('todas');
  const [expanded, setExpanded] = useState({});
  const [editingGroup, setEditingGroup] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  function emptyForm() {
    return {
      cliente_id: '',
      valor: '',
      vencimento: '',
      descricao: '',
      status: 'Pendente',
      tipo: 'Pagamento Único',
      duracao_preset: '12',
      duracao_custom: ''
    };
  }

  async function load() {
    setLoading(true);
    try {
      const [cobs, cls] = await Promise.all([api.listCobrancas(), api.listClientes()]);
      setRows(cobs);
      setClientes(cls);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.cliente_id || !form.valor || !form.vencimento) return;

    const payload = {
      cliente_id: Number(form.cliente_id),
      valor: Number(form.valor),
      vencimento: form.vencimento,
      descricao: form.descricao || null,
      status: form.status,
      tipo: form.tipo
    };

    if (form.tipo === 'Recorrência Mensal') {
      const n = form.duracao_preset === 'custom'
        ? parseInt(form.duracao_custom, 10)
        : parseInt(form.duracao_preset, 10);
      if (!n || n < 1) {
        alert('Informe uma duração válida em meses (mínimo 1).');
        return;
      }
      payload.duracao_meses = n;
    }

    await api.createCobranca(payload);
    setForm(emptyForm());
    setShowForm(false);
    load();
  }

  async function handleDelete(id) {
    const cob = rows.find((r) => r.id === id);
    const ok = await confirm({
      message: (
        <>
          Tem certeza que deseja excluir esta cobrança?
          {cob && (
            <><br /><strong>{cob.cliente_nome || 'Cliente'}</strong>
            {cob.valor ? ` · ${fmtBRL(cob.valor)}` : ''}
            {cob.vencimento ? ` · venc. ${formatDate(cob.vencimento)}` : ''}</>
          )}
        </>
      )
    });
    if (!ok) return;
    await api.deleteCobranca(id);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  async function handleMarcarPago(cob) {
    try {
      const updated = await api.updateCobranca(cob.id, {
        status: 'Pago',
        data_pagamento: todayISO()
      });
      setRows((rs) => rs.map((r) => (r.id === cob.id ? updated : r)));
      // Dispara notificação push do navegador (funciona mesmo com a aba minimizada)
      showPaymentNotification(updated);
      // Notifica o resto do sistema para refetch (Dashboard, Recebimentos, Resumo)
      window.dispatchEvent(new CustomEvent('spacefy:cobranca-paga', { detail: updated }));
      toast.success(`Pagamento de ${fmtBRL(updated.valor)} registrado!`);
      setReceiptModal(updated);
    } catch (e) {
      toast.error('Falha ao registrar pagamento: ' + (e?.message || e));
    }
  }

  function handleDownloadReceipt(cob) {
    generateReceipt(cob, settings);
  }

  function buildMessageFor(cob) {
    return applyTemplate(settings.template_cobranca || '', {
      nome_cliente: cob.cliente_nome || '',
      valor: formatBRL(cob.valor).replace('R$', '').trim(),
      vencimento: cob.vencimento ? formatDate(cob.vencimento) : '',
      chave_pix: settings.chave_pix || ''
    });
  }

  async function handleSendWa(cob) {
    if (!cob.cliente_whatsapp) {
      alert('Cliente sem WhatsApp cadastrado.');
      return;
    }
    window.open(buildWaUrl(cob.cliente_whatsapp, buildMessageFor(cob)), '_blank');
    // Registra último envio (não bloqueia reenvio)
    try {
      const updated = await api.marcarCobrancaEnviada(cob.id);
      setRows((rs) => rs.map((r) => (r.id === cob.id ? updated : r)));
    } catch (e) {
      // falha no registro não interrompe o envio; WhatsApp já abriu
      console.warn('Falha ao registrar envio:', e);
    }
  }

  const totais = useMemo(() => {
    const sum = (s) => rows.filter((r) => r.status === s).reduce((acc, r) => acc + r.valor, 0);
    return { pendente: sum('Pendente'), pago: sum('Pago'), atrasado: sum('Atrasado') };
  }, [rows]);

  // Agrupar cobranças por cliente
  const grupos = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.cliente_id ?? `removido-${r.id}`;
      if (!map.has(key)) {
        map.set(key, {
          cliente_id: r.cliente_id,
          cliente_nome: r.cliente_nome || 'Cliente removido',
          cliente_cnpj: r.cliente_cnpj,
          cliente_whatsapp: r.cliente_whatsapp,
          cobrancas: []
        });
      }
      map.get(key).cobrancas.push(r);
    }
    // Ordena cobranças de cada grupo por vencimento
    for (const g of map.values()) {
      g.cobrancas.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.cliente_nome || '').localeCompare(b.cliente_nome || '', 'pt-BR')
    );
  }, [rows]);

  // Helpers por grupo
  function groupTipo(g) {
    return g.cobrancas.some((c) => c.tipo === 'Recorrência Mensal') ? 'Recorrente' : 'Única';
  }

  function groupValorMensal(g) {
    // Usa o valor mais frequente entre as cobranças; fallback = primeira
    if (g.cobrancas.length === 0) return 0;
    const counts = new Map();
    for (const c of g.cobrancas) {
      const v = Number(c.valor) || 0;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    let best = g.cobrancas[0].valor;
    let bestCount = 0;
    for (const [v, n] of counts) {
      if (n > bestCount) { best = v; bestCount = n; }
    }
    return best;
  }

  function groupPagas(g) {
    return g.cobrancas.filter((c) => c.status === 'Pago').length;
  }

  function groupStatus(g) {
    if (g.cobrancas.some((c) => c.status === 'Atrasado')) return 'Atrasado';
    if (g.cobrancas.some((c) => c.status === 'Pendente')) return 'Pendente';
    return 'Em dia';
  }

  // Filtrar grupos (mantém grupo se alguma cobrança corresponder ao filtro)
  const gruposFiltrados = useMemo(() => {
    if (filter === 'todas') return grupos;
    const alvo = filter === 'pago' ? 'Pago' : filter === 'atrasado' ? 'Atrasado' : 'Pendente';
    return grupos
      .map((g) => ({ ...g, cobrancas: g.cobrancas }))
      .filter((g) => g.cobrancas.some((c) => c.status === alvo));
  }, [grupos, filter]);

  function toggleExpand(key) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleOpenEdit(g) {
    const tipoAtual = groupTipo(g); // 'Recorrente' | 'Única'
    const tipoRaw = tipoAtual === 'Recorrente' ? 'Recorrência Mensal' : 'Pagamento Único';
    const valorAtual = groupValorMensal(g);
    const pagasCount = groupPagas(g);

    // Próximo vencimento = primeira pendente/atrasada; fallback = última cobrança
    const proxima = g.cobrancas.find((c) => c.status !== 'Pago') || g.cobrancas[g.cobrancas.length - 1];
    const vencimentoBase = proxima?.vencimento || todayISO();

    // Duração total = total de cobranças do grupo (pagas + não pagas)
    const totalAtual = g.cobrancas.length;
    const presets = ['3', '6', '12'];
    const duracao_preset = presets.includes(String(totalAtual)) ? String(totalAtual) : 'custom';
    const duracao_custom = duracao_preset === 'custom' ? String(totalAtual) : '';

    setEditingGroup({
      grupo: g,
      pagasCount,
      totalAtual,
      form: {
        valor: String(valorAtual ?? ''),
        tipo: tipoRaw,
        duracao_preset,
        duracao_custom,
        vencimento: vencimentoBase
      }
    });
  }

  function updateEditForm(patch) {
    setEditingGroup((prev) => prev ? { ...prev, form: { ...prev.form, ...patch } } : prev);
  }

  async function handleSaveEdit() {
    if (!editingGroup) return;
    const { grupo, form: ef, pagasCount } = editingGroup;

    const valor = Number(ef.valor);
    if (!valor || valor <= 0) { alert('Informe um valor válido.'); return; }
    if (!ef.vencimento) { alert('Informe a data de vencimento base.'); return; }

    let duration = 1;
    if (ef.tipo === 'Recorrência Mensal') {
      duration = ef.duracao_preset === 'custom'
        ? parseInt(ef.duracao_custom, 10)
        : parseInt(ef.duracao_preset, 10);
      if (!duration || duration < 1) {
        alert('Informe uma duração válida em meses (mínimo 1).');
        return;
      }
    }

    // Cobranças não pagas serão recriadas; já pagas permanecem intactas
    const naopagas = grupo.cobrancas.filter((c) => c.status !== 'Pago');
    const novaQtdPendente = Math.max(0, duration - pagasCount);

    if (duration < pagasCount) {
      const ok = await confirm({
        title: 'Confirmar alteração',
        message: (
          <>
            Este cliente já tem <strong>{pagasCount}</strong> cobrança(s) paga(s), maior que a nova duração (<strong>{duration}</strong>).
            <br />As cobranças pagas serão mantidas e nenhuma nova pendente será criada. Continuar?
          </>
        ),
        confirmLabel: 'Continuar',
        variant: 'default'
      });
      if (!ok) return;
    }

    setSavingEdit(true);
    try {
      // 1) Apagar todas as não-pagas existentes
      for (const c of naopagas) {
        await api.deleteCobranca(c.id);
      }

      // 2) Criar novas pendentes (se aplicável)
      if (novaQtdPendente > 0) {
        const payload = {
          cliente_id: grupo.cliente_id,
          valor,
          vencimento: ef.vencimento,
          descricao: null,
          status: 'Pendente',
          tipo: ef.tipo
        };
        if (ef.tipo === 'Recorrência Mensal') {
          payload.duracao_meses = novaQtdPendente;
        }
        await api.createCobranca(payload);
      }

      setEditingGroup(null);
      await load();
    } catch (e) {
      alert('Erro ao salvar alterações: ' + (e?.message || e));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleOpenDeleteGroup(g) {
    const count = g.cobrancas.length;
    const ids = g.cobrancas.map((c) => c.id);
    await confirm({
      title: 'Excluir cobranças',
      message: (
        <>
          Tem certeza que deseja excluir todas as cobranças deste cliente?
          <br />
          <strong>{g.cliente_nome}</strong> — {count} {count === 1 ? 'cobrança' : 'cobranças'}
        </>
      ),
      // onConfirm roda async: o modal mostra "Excluindo…" enquanto as requests
      // estão em andamento, e só fecha quando todas terminam (ou jogam erro).
      onConfirm: async () => {
        for (const id of ids) {
          await api.deleteCobranca(id);
        }
        setRows((rs) => rs.filter((r) => !ids.includes(r.id)));
      }
    });
  }

  const clientesAtivos = clientes.filter((c) => c.ativo);

  return (
    <div>
      <div className="cards">
        <div className="card">
          <div className="card-label">Pendente</div>
          <div className="card-value">{fmtBRL(totais.pendente)}</div>
        </div>
        <div className="card">
          <div className="card-label">Atrasado</div>
          <div className="card-value neg">{fmtBRL(totais.atrasado)}</div>
        </div>
        <div className="card">
          <div className="card-label">Recebido</div>
          <div className="card-value pos">{fmtBRL(totais.pago)}</div>
        </div>
        <div className="card">
          <div className="card-label">Total cobranças</div>
          <div className="card-value">{rows.length}</div>
        </div>
      </div>

      <div className="toolbar" style={{ padding: 0, marginBottom: 12 }}>
        <div className="toolbar-left">
          <span className="label">Filtrar</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="todas">Todas</option>
            <option value="pendente">Pendentes</option>
            <option value="atrasado">Atrasadas</option>
            <option value="pago">Pagas</option>
          </select>
          {(!settings.chave_pix || !settings.template_cobranca) && (
            <span style={{ color: 'var(--yellow)', fontSize: 12 }}>
              ⚠️ Configure PIX e template em Configurações
            </span>
          )}
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancelar' : '+ Nova cobrança'}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="form-row" onSubmit={handleCreate}>
          <div className="field">
            <label>Cliente</label>
            <select
              value={form.cliente_id}
              onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
              required
            >
              <option value="">— Selecionar —</option>
              {clientesAtivos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            {clientesAtivos.length === 0 && (
              <small style={{ color: 'var(--yellow)', fontSize: 11.5 }}>Cadastre clientes na aba Clientes.</small>
            )}
          </div>
          <div className="field">
            <label>Tipo de Cobrança</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              <option value="Pagamento Único">Pagamento Único</option>
              <option value="Recorrência Mensal">Recorrência Mensal</option>
            </select>
          </div>
          {form.tipo === 'Recorrência Mensal' && (
            <div className="field">
              <label>Duração da recorrência</label>
              <select
                value={form.duracao_preset}
                onChange={(e) => setForm({ ...form, duracao_preset: e.target.value })}
              >
                <option value="3">3 meses</option>
                <option value="6">6 meses</option>
                <option value="12">12 meses</option>
                <option value="custom">Personalizado</option>
              </select>
              {form.duracao_preset === 'custom' && (
                <input
                  type="number"
                  min="1"
                  max="120"
                  step="1"
                  placeholder="Quantidade de meses"
                  value={form.duracao_custom}
                  onChange={(e) => setForm({ ...form, duracao_custom: e.target.value })}
                  style={{ marginTop: 6 }}
                  required
                />
              )}
              <small style={{ color: 'var(--text-dim)', fontSize: 11.5, marginTop: 4 }}>
                Gera uma cobrança por mês a partir do vencimento informado.
              </small>
            </div>
          )}
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
            <label>Vencimento</label>
            <input
              type="date"
              value={form.vencimento}
              onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
              required
            />
          </div>
          <div className="field field-full">
            <label>Descrição (opcional)</label>
            <input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex.: Mensalidade de Abril — tráfego pago"
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
              <th style={{ width: 36 }}></th>
              <th>Cliente</th>
              <th style={{ width: 180 }}>Tipo</th>
              <th className="right" style={{ width: 140 }}>Valor mensal</th>
              <th style={{ width: 120 }}>Parcelas</th>
              <th style={{ width: 120 }}>Pagas</th>
              <th style={{ width: 130 }}>Status</th>
              <th style={{ width: 180 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8}><div className="empty-state">Carregando…</div></td></tr>}
            {!loading && gruposFiltrados.length === 0 && (
              <tr><td colSpan={8}><div className="empty-state">
                {rows.length === 0 ? 'Nenhuma cobrança cadastrada. Clique em “+ Nova cobrança”.' : 'Nenhuma cobrança para este filtro.'}
              </div></td></tr>
            )}
            {!loading && gruposFiltrados.map((g) => {
              const key = g.cliente_id ?? g.cliente_nome;
              const isOpen = !!expanded[key];
              const tipo = groupTipo(g);
              const valorMensal = groupValorMensal(g);
              const total = g.cobrancas.length;
              const pagas = groupPagas(g);
              const status = groupStatus(g);
              return (
                <Fragment key={`grp-${key}`}>
                  <tr
                    className="grupo-row"
                    onClick={() => toggleExpand(key)}
                  >
                    <td className="grupo-chevron">
                      <ChevronIcon open={isOpen} />
                    </td>
                    <td>
                      <div className="cell cob-cliente-cell">
                        <span className="cob-cliente-nome">{g.cliente_nome}</span>
                        {g.cliente_cnpj && (
                          <span className="cob-cliente-cnpj">{fmtCnpj(g.cliente_cnpj)}</span>
                        )}
                      </div>
                    </td>
                    <td><TipoLabel value={tipo} /></td>
                    <td className="right">{fmtBRL(valorMensal)}</td>
                    <td>
                      <span style={{ color: 'var(--text-dim)' }}>
                        {tipo === 'Recorrente' ? `${total} ${total === 1 ? 'mês' : 'meses'}` : `${total} ${total === 1 ? 'parcela' : 'parcelas'}`}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{pagas}/{total}</span>
                      <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>pagas</span>
                    </td>
                    <td>
                      <GroupStatusBadge status={status} />
                    </td>
                    <td className="grupo-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleOpenEdit(g)}
                        title="Editar cobranças pendentes deste cliente"
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-sm btn-ghost btn-danger"
                        onClick={() => handleOpenDeleteGroup(g)}
                        title="Excluir todas as cobranças deste cliente"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="sub-row">
                      <td colSpan={8}>
                        <div className="sub-row-inner">
                          {g.cobrancas.map((c) => (
                            <div key={c.id} className="sub-item">
                              <div className="sub-item-info">
                                <div className="sub-item-venc">{c.vencimento ? formatDate(c.vencimento) : '—'}</div>
                                <div className="sub-item-desc">{c.descricao || <em style={{ color: 'var(--text-mute)' }}>Sem descrição</em>}</div>
                              </div>
                              <div className="sub-item-valor">{fmtBRL(c.valor)}</div>
                              <div className="sub-item-status">
                                <StatusBadge value={c.status} />
                                {c.enviado_em && (
                                  <span
                                    className="badge badge-enviado"
                                    title={`Enviado em ${formatDate(c.enviado_em.slice(0, 10))}`}
                                    style={{ marginLeft: 6 }}
                                  >
                                    ✓ Enviado {formatDate(c.enviado_em.slice(0, 10))}
                                  </span>
                                )}
                              </div>
                              <div className="sub-item-actions">
                                {c.status !== 'Pago' && (
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => handleMarcarPago(c)}
                                    title="Marca como pago e envia notificação push"
                                  >
                                    ✓ Marcar pago
                                  </button>
                                )}
                                {c.status === 'Pago' && (
                                  <button
                                    className="btn btn-sm btn-icon"
                                    onClick={() => handleDownloadReceipt(c)}
                                    title={`Baixar comprovante${c.numero_comprovante ? ` (${c.numero_comprovante})` : ''}`}
                                  >
                                    <DownloadIcon />
                                  </button>
                                )}
                                <button
                                  className="btn btn-sm btn-wa"
                                  disabled={!c.cliente_whatsapp}
                                  onClick={() => handleSendWa(c)}
                                  title={c.cliente_whatsapp ? 'Enviar cobrança via WhatsApp' : 'Cliente sem WhatsApp cadastrado'}
                                >
                                  WhatsApp
                                </button>
                                <button
                                  className="btn btn-sm btn-ghost"
                                  onClick={() => setPreview({ cob: c, message: buildMessageFor(c) })}
                                >
                                  Prévia
                                </button>
                                <button
                                  className="btn btn-sm btn-ghost btn-danger"
                                  onClick={() => handleDelete(c.id)}
                                >
                                  Excluir
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>



      {editingGroup && (
        <div className="modal-backdrop" onClick={() => !savingEdit && setEditingGroup(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 4 }}>Editar cobranças — {editingGroup.grupo.cliente_nome}</h3>
            <p className="hint" style={{ marginBottom: 16 }}>
              {editingGroup.pagasCount > 0
                ? `${editingGroup.pagasCount} cobrança(s) já paga(s) não serão alteradas.`
                : 'Nenhuma cobrança paga ainda neste grupo.'}
            </p>

            <div className="edit-modal-note">
              ⚠️ As cobranças já pagas não serão alteradas. Pendentes e atrasadas serão recriadas com os novos valores.
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Valor mensal</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingGroup.form.valor}
                  onChange={(e) => updateEditForm({ valor: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Tipo de cobrança</label>
                <select
                  value={editingGroup.form.tipo}
                  onChange={(e) => updateEditForm({ tipo: e.target.value })}
                >
                  <option value="Pagamento Único">Única</option>
                  <option value="Recorrência Mensal">Recorrente</option>
                </select>
              </div>
              {editingGroup.form.tipo === 'Recorrência Mensal' && (
                <div className="field">
                  <label>Duração</label>
                  <select
                    value={editingGroup.form.duracao_preset}
                    onChange={(e) => updateEditForm({ duracao_preset: e.target.value })}
                  >
                    <option value="3">3 meses</option>
                    <option value="6">6 meses</option>
                    <option value="12">12 meses</option>
                    <option value="custom">Personalizado</option>
                  </select>
                  {editingGroup.form.duracao_preset === 'custom' && (
                    <input
                      type="number"
                      min="1"
                      max="120"
                      step="1"
                      placeholder="Meses"
                      value={editingGroup.form.duracao_custom}
                      onChange={(e) => updateEditForm({ duracao_custom: e.target.value })}
                      style={{ marginTop: 6 }}
                    />
                  )}
                </div>
              )}
              <div className="field">
                <label>Data de vencimento base</label>
                <input
                  type="date"
                  value={editingGroup.form.vencimento}
                  onChange={(e) => updateEditForm({ vencimento: e.target.value })}
                />
                <small style={{ color: 'var(--text-dim)', fontSize: 11.5, marginTop: 4 }}>
                  {editingGroup.form.tipo === 'Recorrência Mensal'
                    ? 'Primeira parcela pendente; as demais serão geradas mês a mês.'
                    : 'Vencimento desta cobrança única.'}
                </small>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 18 }}>
              <button
                className="btn btn-ghost"
                onClick={() => setEditingGroup(null)}
                disabled={savingEdit}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptModal && (
        <div className="modal-backdrop" onClick={() => setReceiptModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">✓</div>
            <h3>Pagamento registrado!</h3>
            <p>
              Cobrança de <strong>{receiptModal.cliente_nome}</strong> no valor de{' '}
              <strong>{fmtBRL(receiptModal.valor)}</strong> marcada como paga.
              <br />
              Deseja baixar o comprovante{receiptModal.numero_comprovante ? ` ${receiptModal.numero_comprovante}` : ''}?
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setReceiptModal(null)}>
                Agora não
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  handleDownloadReceipt(receiptModal);
                  setReceiptModal(null);
                }}
              >
                Baixar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="settings-section" style={{ marginTop: 20 }}>
          <h3>Prévia da mensagem — {preview.cob.cliente_nome}</h3>
          <p className="hint">Edite em Configurações → Template de cobrança para mudar o formato.</p>
          <pre
            style={{
              background: 'var(--bg-3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 14,
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              fontSize: 13.5,
              margin: 0
            }}
          >
            {preview.message}
          </pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              className="btn btn-wa"
              disabled={!preview.cob.cliente_whatsapp}
              onClick={() => handleSendWa(preview.cob)}
            >
              Abrir WhatsApp
            </button>
            <button className="btn btn-ghost" onClick={() => setPreview(null)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

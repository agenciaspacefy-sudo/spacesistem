import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useFormatCnpj, useFormatWhatsapp } from '../PrivacyContext.jsx';

// Catálogo fixo de serviços oferecidos pela Spacefy
export const SERVICOS_CATALOGO = [
  { id: 'meta_ads',          label: 'Gestão Meta Ads' },
  { id: 'google_ads',        label: 'Gestão Google Ads' },
  { id: 'tiktok_ads',        label: 'Gestão TikTok Ads' },
  { id: 'criacao_conteudo',  label: 'Criação de Conteúdo' },
  { id: 'edicao_videos',     label: 'Edição de Vídeos' },
  { id: 'gestao_redes',      label: 'Gestão de Redes Sociais' },
  { id: 'criacao_criativos', label: 'Criação de Criativos' },
  { id: 'estrategia_trafego', label: 'Estratégia de Tráfego' },
  { id: 'consultoria',       label: 'Consultoria de Marketing' },
  { id: 'gmn',               label: 'Google Meu Negócio' },
  { id: 'email_marketing',   label: 'Email Marketing' }
];

const SERVICO_OUTROS = 'outros';

export default function ClienteDetalheDrawer({ cliente, onClose, onChangeServicosCount, onChangeObservacoes }) {
  const fmtCnpj = useFormatCnpj();
  const fmtWhatsapp = useFormatWhatsapp();
  const [servicos, setServicos] = useState([]); // [{ servico, custom_text }]
  const [loadingServicos, setLoadingServicos] = useState(true);
  const [observacoes, setObservacoes] = useState(cliente.observacoes || '');
  const [obsStatus, setObsStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [outrosTexto, setOutrosTexto] = useState('');
  const obsTimeoutRef = useRef(null);
  const outrosTimeoutRef = useRef(null);

  // Carrega serviços ao abrir
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingServicos(true);
      try {
        const rows = await api.listClienteServicos(cliente.id);
        if (!cancelled) {
          setServicos(rows);
          const outros = rows.find((r) => r.servico === SERVICO_OUTROS);
          setOutrosTexto(outros?.custom_text || '');
        }
      } finally {
        if (!cancelled) setLoadingServicos(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [cliente.id]);

  // Atualiza observações local quando o cliente muda
  useEffect(() => {
    setObservacoes(cliente.observacoes || '');
  }, [cliente.id]);

  // Esc fecha
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Trava o scroll do body enquanto o drawer está aberto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const ativosMap = useMemo(() => {
    const m = new Set();
    for (const s of servicos) m.add(s.servico);
    return m;
  }, [servicos]);

  const totalAtivos = servicos.length;

  async function handleToggle(servicoId, currentAtivo) {
    const novoAtivo = !currentAtivo;
    // Otimista: atualiza local primeiro
    setServicos((prev) => {
      if (novoAtivo) {
        return [...prev, { servico: servicoId, custom_text: null }];
      } else {
        return prev.filter((s) => s.servico !== servicoId);
      }
    });
    try {
      const { servicos: rows } = await api.toggleClienteServico(cliente.id, servicoId, novoAtivo);
      setServicos(rows);
      onChangeServicosCount?.(cliente.id, rows.length);
    } catch (e) {
      // Reverte em caso de erro
      setServicos((prev) => {
        if (novoAtivo) return prev.filter((s) => s.servico !== servicoId);
        return [...prev, { servico: servicoId, custom_text: null }];
      });
      alert('Falha ao salvar: ' + e.message);
    }
  }

  function handleOutrosToggle() {
    const ativo = ativosMap.has(SERVICO_OUTROS);
    handleToggle(SERVICO_OUTROS, ativo);
  }

  function handleOutrosTexto(novo) {
    setOutrosTexto(novo);
    if (outrosTimeoutRef.current) clearTimeout(outrosTimeoutRef.current);
    outrosTimeoutRef.current = setTimeout(async () => {
      // Garante que o serviço "outros" exista antes de salvar o texto
      if (!ativosMap.has(SERVICO_OUTROS)) {
        await api.toggleClienteServico(cliente.id, SERVICO_OUTROS, true, novo);
        const rows = await api.listClienteServicos(cliente.id);
        setServicos(rows);
        onChangeServicosCount?.(cliente.id, rows.length);
      } else {
        await api.updateClienteServicoCustom(cliente.id, SERVICO_OUTROS, novo);
        setServicos((prev) =>
          prev.map((s) => (s.servico === SERVICO_OUTROS ? { ...s, custom_text: novo } : s))
        );
      }
    }, 500);
  }

  function handleObservacoesChange(novo) {
    setObservacoes(novo);
    setObsStatus('saving');
    if (obsTimeoutRef.current) clearTimeout(obsTimeoutRef.current);
    obsTimeoutRef.current = setTimeout(async () => {
      try {
        await api.updateCliente(cliente.id, { observacoes: novo });
        onChangeObservacoes?.(cliente.id, novo);
        setObsStatus('saved');
        setTimeout(() => setObsStatus('idle'), 1200);
      } catch (e) {
        setObsStatus('idle');
        alert('Falha ao salvar observações: ' + e.message);
      }
    }, 600);
  }

  const outrosAtivo = ativosMap.has(SERVICO_OUTROS);

  return (
    <>
      <div className="cli-detalhe-overlay" onClick={onClose} />
      <aside className="cli-detalhe-drawer" role="dialog" aria-label={`Detalhes de ${cliente.nome}`}>
        <header className="cli-detalhe-head">
          <div className="cli-detalhe-head-info">
            <div className="cli-detalhe-avatar" aria-hidden="true">
              {(cliente.nome || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="cli-detalhe-nome">{cliente.nome}</h2>
              <div className="cli-detalhe-sub">
                {totalAtivos === 0 ? 'Nenhum serviço marcado'
                  : `${totalAtivos} ${totalAtivos === 1 ? 'serviço contratado' : 'serviços contratados'}`}
              </div>
            </div>
          </div>
          <button className="cli-detalhe-close" onClick={onClose} aria-label="Fechar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="cli-detalhe-body">

          {/* ----- DADOS DO CLIENTE ----- */}
          <section className="cli-detalhe-section">
            <h3 className="cli-detalhe-section-title">Dados do cliente</h3>
            <dl className="cli-detalhe-info">
              <div>
                <dt>CNPJ</dt>
                <dd>{cliente.cnpj ? fmtCnpj(cliente.cnpj) : <span className="muted">—</span>}</dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>{cliente.whatsapp ? fmtWhatsapp(cliente.whatsapp) : <span className="muted">—</span>}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`badge ${cliente.ativo ? 'badge-pago' : 'badge-neutral'}`}>
                    {cliente.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          {/* ----- SERVIÇOS CONTRATADOS ----- */}
          <section className="cli-detalhe-section">
            <h3 className="cli-detalhe-section-title">
              Serviços contratados
              <span className="cli-detalhe-section-count">{totalAtivos}</span>
            </h3>
            {loadingServicos ? (
              <div className="muted" style={{ fontSize: 13 }}>Carregando…</div>
            ) : (
              <ul className="cli-servicos-list">
                {SERVICOS_CATALOGO.map(({ id, label }) => {
                  const ativo = ativosMap.has(id);
                  return (
                    <li key={id}>
                      <label className={`cli-servico-item ${ativo ? 'is-ativo' : ''}`}>
                        <input
                          type="checkbox"
                          checked={ativo}
                          onChange={() => handleToggle(id, ativo)}
                        />
                        <span className="cli-servico-check" aria-hidden="true">
                          {ativo && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <span className="cli-servico-label">{label}</span>
                      </label>
                    </li>
                  );
                })}

                {/* Item "Outros" com input livre */}
                <li>
                  <label className={`cli-servico-item ${outrosAtivo ? 'is-ativo' : ''}`}>
                    <input
                      type="checkbox"
                      checked={outrosAtivo}
                      onChange={handleOutrosToggle}
                    />
                    <span className="cli-servico-check" aria-hidden="true">
                      {outrosAtivo && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span className="cli-servico-label">Outros</span>
                  </label>
                  {outrosAtivo && (
                    <input
                      className="cli-servico-outros-input"
                      type="text"
                      placeholder="Especifique o serviço…"
                      value={outrosTexto}
                      onChange={(e) => handleOutrosTexto(e.target.value)}
                    />
                  )}
                </li>
              </ul>
            )}
          </section>

          {/* ----- OBSERVAÇÕES ----- */}
          <section className="cli-detalhe-section">
            <h3 className="cli-detalhe-section-title">
              Observações do cliente
              <span className="cli-detalhe-status-flag">
                {obsStatus === 'saving' && 'Salvando…'}
                {obsStatus === 'saved' && '✓ Salvo'}
              </span>
            </h3>
            <textarea
              className="cli-detalhe-obs"
              placeholder="Notas, preferências, contatos secundários, particularidades…"
              value={observacoes}
              onChange={(e) => handleObservacoesChange(e.target.value)}
            />
          </section>
        </div>
      </aside>
    </>
  );
}

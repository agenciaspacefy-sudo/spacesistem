import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useConfirm } from '../ConfirmContext.jsx';

function formatData(iso) {
  if (!iso) return '';
  // Backend guarda como 'YYYY-MM-DD HH:MM:SS' (UTC) via datetime('now')
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return iso;
  const hoje = new Date();
  const sameDay =
    d.getFullYear() === hoje.getFullYear() &&
    d.getMonth() === hoje.getMonth() &&
    d.getDate() === hoje.getDate();
  if (sameDay) {
    return `Hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function previa(texto) {
  if (!texto) return 'Sem conteúdo';
  const clean = texto.replace(/\s+/g, ' ').trim();
  return clean.length > 120 ? clean.slice(0, 120) + '…' : clean;
}

export default function Notas() {
  const confirm = useConfirm();
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null); // { id?, titulo, corpo }
  const [salvando, setSalvando] = useState(false);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const saveTimeoutRef = useRef(null);

  async function load(q = '') {
    setLoading(true);
    try {
      const incluir = verConcluidas ? 'apenas' : undefined;
      setNotas(await api.listNotas(q || undefined, incluir));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [verConcluidas]);

  // Filtro client-side também, pra ser instantâneo enquanto digita
  const filtradas = useMemo(() => {
    if (!busca.trim()) return notas;
    const q = busca.toLowerCase();
    return notas.filter(
      (n) =>
        (n.titulo || '').toLowerCase().includes(q) ||
        (n.corpo || '').toLowerCase().includes(q)
    );
  }, [notas, busca]);

  function abrirNova() {
    setEditando({ titulo: '', corpo: '' });
  }

  function abrirEditar(nota) {
    setEditando({ id: nota.id, titulo: nota.titulo || '', corpo: nota.corpo || '' });
  }

  function fecharEditor() {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setEditando(null);
  }

  async function salvar(patch) {
    // Salvamento otimista: atualiza o estado local e persiste em background
    const snapshot = editando;
    const novoEditando = { ...snapshot, ...patch };
    setEditando(novoEditando);

    // Debounce 500ms
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSalvando(true);
      try {
        if (novoEditando.id) {
          const updated = await api.updateNota(novoEditando.id, {
            titulo: novoEditando.titulo,
            corpo: novoEditando.corpo
          });
          setNotas((ns) => ns.map((n) => (n.id === updated.id ? updated : n)));
        } else {
          // Só cria quando tem algum conteúdo (evita notas fantasmas)
          if (novoEditando.titulo.trim() || novoEditando.corpo.trim()) {
            const created = await api.createNota({
              titulo: novoEditando.titulo,
              corpo: novoEditando.corpo
            });
            setEditando((cur) => (cur ? { ...cur, id: created.id } : cur));
            setNotas((ns) => [created, ...ns]);
          }
        }
      } finally { setSalvando(false); }
    }, 500);
  }

  async function excluir(nota) {
    const ok = await confirm({
      message: (
        <>
          Excluir esta nota?
          {nota.titulo && <><br /><strong>{nota.titulo}</strong></>}
          <br />
          <span style={{ fontSize: 12 }}>Essa ação não pode ser desfeita.</span>
        </>
      )
    });
    if (!ok) return;
    await api.deleteNota(nota.id);
    setNotas((ns) => ns.filter((n) => n.id !== nota.id));
    if (editando?.id === nota.id) setEditando(null);
  }

  async function concluir(nota) {
    const ok = await confirm({
      title: 'Concluir nota',
      message: (
        <>
          Marcar nota como concluída? Ela será removida da listagem.
          {nota.titulo && <><br /><strong>{nota.titulo}</strong></>}
          <br />
          <span style={{ fontSize: 12 }}>A nota continua salva e pode ser recuperada em "Ver concluídas".</span>
        </>
      ),
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      variant: 'default',
      busyLabel: 'Concluindo…'
    });
    if (!ok) return;
    await api.concluirNota(nota.id);
    setNotas((ns) => ns.filter((n) => n.id !== nota.id));
  }

  async function reabrir(nota) {
    await api.concluirNota(nota.id, true);
    setNotas((ns) => ns.filter((n) => n.id !== nota.id));
  }

  return (
    <div>
      <div className="cards">
        <div className="card">
          <div className="card-label">Total de notas</div>
          <div className="card-value">{notas.length}</div>
        </div>
      </div>

      <div className="toolbar" style={{ padding: 0, marginBottom: 12 }}>
        <div className="toolbar-left" style={{ flex: 1, maxWidth: 380 }}>
          <input
            type="search"
            className="notas-search"
            placeholder="Buscar por título ou conteúdo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="toolbar-right">
          <button
            type="button"
            className={`btn btn-sm ${verConcluidas ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setVerConcluidas((v) => !v)}
            title={verConcluidas ? 'Voltar para notas ativas' : 'Mostrar notas concluídas'}
          >
            {verConcluidas ? '← Voltar para ativas' : 'Ver concluídas'}
          </button>
          {!verConcluidas && (
            <button className="btn btn-primary" onClick={abrirNova}>+ Nova nota</button>
          )}
        </div>
      </div>

      {loading && <div className="empty-state">Carregando…</div>}
      {!loading && filtradas.length === 0 && (
        <div className="empty-state">
          {busca
            ? 'Nenhuma nota encontrada para essa busca.'
            : verConcluidas
              ? 'Nenhuma nota concluída ainda.'
              : 'Nenhuma nota ainda. Crie a primeira!'}
        </div>
      )}

      {!loading && filtradas.length > 0 && (
        <div className="notas-grid">
          {filtradas.map((n) => (
            <div
              key={n.id}
              className="nota-card"
              role="button"
              tabIndex={0}
              onClick={() => abrirEditar(n)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  abrirEditar(n);
                }
              }}
            >
              <div className="nota-card-head">
                <h3 className="nota-card-titulo">{n.titulo || 'Sem título'}</h3>
                <span
                  className="nota-card-delete"
                  role="button"
                  tabIndex={0}
                  title="Excluir nota"
                  onClick={(e) => { e.stopPropagation(); excluir(n); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      excluir(n);
                    }
                  }}
                >×</span>
              </div>
              <p className="nota-card-previa">{previa(n.corpo)}</p>
              <div className="nota-card-foot">
                <div className="nota-card-data">
                  {n.concluido_em
                    ? `Concluída · ${formatData(n.concluido_em)}`
                    : formatData(n.updated_at || n.created_at)}
                </div>
                {verConcluidas ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost nota-card-action"
                    onClick={(e) => { e.stopPropagation(); reabrir(n); }}
                    title="Reabrir nota"
                  >
                    Reabrir
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary nota-card-action"
                    onClick={(e) => { e.stopPropagation(); concluir(n); }}
                    title="Marcar como concluída"
                  >
                    ✓ Concluído
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <NotaEditor
          nota={editando}
          salvando={salvando}
          onChange={salvar}
          onClose={fecharEditor}
          onDelete={editando.id ? () => {
            const atual = notas.find((n) => n.id === editando.id);
            if (atual) excluir(atual);
          } : null}
        />
      )}
    </div>
  );
}

// --------------- Editor (drawer/modal) ---------------
function NotaEditor({ nota, salvando, onChange, onClose, onDelete }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide nota-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="modal-title">{nota.id ? 'Editar nota' : 'Nova nota'}</h3>
          <div className="nota-editor-status">
            {salvando ? 'Salvando…' : (nota.id ? 'Salvo' : 'Rascunho')}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="modal-body">
          <input
            className="nota-editor-titulo"
            placeholder="Título"
            value={nota.titulo}
            onChange={(e) => onChange({ titulo: e.target.value })}
            autoFocus
          />
          <textarea
            className="nota-editor-corpo"
            placeholder="Comece a escrever…"
            value={nota.corpo}
            onChange={(e) => onChange({ corpo: e.target.value })}
          />

          <div className="modal-actions modal-actions-split">
            {onDelete ? (
              <button className="btn btn-ghost btn-danger" onClick={onDelete}>
                Excluir
              </button>
            ) : <span />}
            <div className="modal-actions-right">
              <button className="btn btn-primary" onClick={onClose}>Concluído</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

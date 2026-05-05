import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { api } from '../api/client.js';
import { useConfirm } from '../ConfirmContext.jsx';
import { useToast } from '../ToastContext.jsx';

const NODE_TIPOS = [
  { id: 'estrategia', label: 'Estratégia', cor: '#1B6FEE' },
  { id: 'acao',       label: 'Ação',       cor: '#16A34A' },
  { id: 'problema',   label: 'Problema',   cor: '#DC2626' },
  { id: 'ideia',      label: 'Ideia',      cor: '#D97757' },
  { id: 'resultado',  label: 'Resultado',  cor: '#7C3AED' }
];
const TIPO_BY_ID = Object.fromEntries(NODE_TIPOS.map((t) => [t.id, t]));

let _id = 1;
function nextId() {
  return `n_${Date.now().toString(36)}_${(_id++).toString(36)}`;
}

function makeNode({ id, x, y, label, tipo = 'estrategia' }) {
  const t = TIPO_BY_ID[tipo] || TIPO_BY_ID.estrategia;
  return {
    id: id || nextId(),
    type: 'mapaNode',
    position: { x, y },
    data: { label, tipo, cor: t.cor }
  };
}

// ---------- Custom node ----------
function MapaNode({ data, selected }) {
  return (
    <div
      className={`mapa-node ${selected ? 'is-selected' : ''}`}
      style={{ borderColor: data.cor, color: data.cor }}
      title={`${TIPO_BY_ID[data.tipo]?.label || ''}`}
    >
      <span className="mapa-node-dot" style={{ background: data.cor }} />
      <span className="mapa-node-label">{data.label || 'Sem texto'}</span>
    </div>
  );
}
const NODE_TYPES = { mapaNode: MapaNode };

// ---------- Componente principal ----------
export default function MapaMental() {
  const confirm = useConfirm();
  const toast = useToast();
  const [clientes, setClientes] = useState([]);
  const [mapas, setMapas] = useState([]);
  const [fCliente, setFCliente] = useState('');
  const [editandoMapa, setEditandoMapa] = useState(null);
  const [novoNome, setNovoNome] = useState('');
  const [novoCliente, setNovoCliente] = useState('');
  const [showNovo, setShowNovo] = useState(false);

  async function load() {
    try {
      const [cls, ms] = await Promise.all([
        api.listClientes(),
        api.listMapas(fCliente || undefined)
      ]);
      setClientes(cls);
      setMapas(ms);
    } catch (e) {
      toast?.error('Falha ao carregar: ' + (e?.message || e));
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [fCliente]);

  async function criarMapa(e) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    const cli = clientes.find((c) => String(c.id) === novoCliente);
    const centroLabel = cli?.nome || novoNome.trim();
    const initial = {
      nodes: [makeNode({ x: 200, y: 200, label: centroLabel, tipo: 'estrategia' })],
      edges: []
    };
    const m = await api.createMapa({
      cliente_id: novoCliente ? Number(novoCliente) : null,
      nome: novoNome.trim(),
      data: initial
    });
    setShowNovo(false);
    setNovoNome('');
    setNovoCliente('');
    toast?.success('Mapa criado!');
    await load();
    setEditandoMapa(m.id);
  }

  async function excluirMapa(m) {
    const ok = await confirm({
      message: <>Excluir o mapa <strong>{m.nome}</strong>?</>
    });
    if (!ok) return;
    await api.deleteMapa(m.id);
    setMapas((arr) => arr.filter((x) => x.id !== m.id));
    if (editandoMapa === m.id) setEditandoMapa(null);
  }

  if (editandoMapa) {
    return (
      <ReactFlowProvider>
        <MapaEditor
          mapaId={editandoMapa}
          onClose={() => { setEditandoMapa(null); load(); }}
        />
      </ReactFlowProvider>
    );
  }

  return (
    <div>
      <div className="toolbar" style={{ padding: 0, marginBottom: 14 }}>
        <div className="toolbar-left">
          <select value={fCliente} onChange={(e) => setFCliente(e.target.value)}>
            <option value="">Todos clientes</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <span className="label">{mapas.length} {mapas.length === 1 ? 'mapa' : 'mapas'}</span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => setShowNovo(true)}>+ Novo mapa</button>
        </div>
      </div>

      {mapas.length === 0 ? (
        <div className="empty-state">
          Nenhum mapa criado ainda. Clique em &quot;+ Novo mapa&quot; para começar.
        </div>
      ) : (
        <div className="mapas-grid">
          {mapas.map((m) => (
            <div key={m.id} className="mapa-card">
              <button
                className="mapa-card-thumb"
                onClick={() => setEditandoMapa(m.id)}
                title="Abrir mapa"
              >
                {m.thumbnail
                  ? <img src={m.thumbnail} alt="" />
                  : <span className="mapa-card-placeholder">🧠</span>}
              </button>
              <div className="mapa-card-body">
                <h4 className="mapa-card-name">{m.nome}</h4>
                <div className="mapa-card-meta">
                  {m.cliente_nome ? `${m.cliente_nome} · ` : ''}
                  {new Date(m.updated_at?.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR')}
                </div>
                <div className="mapa-card-actions">
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditandoMapa(m.id)}>Editar</button>
                  <button className="btn btn-sm btn-ghost btn-danger" onClick={() => excluirMapa(m)}>Excluir</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNovo && (
        <div className="modal-backdrop" onClick={() => setShowNovo(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={criarMapa}>
            <div className="modal-head">
              <h3 className="modal-title">Novo mapa mental</h3>
              <button type="button" className="modal-close" onClick={() => setShowNovo(false)} aria-label="Fechar">×</button>
            </div>
            <div className="modal-body">
              <div className="field field-full">
                <label>Cliente</label>
                <select value={novoCliente} onChange={(e) => setNovoCliente(e.target.value)}>
                  <option value="">— Sem cliente —</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="field field-full">
                <label>Nome do mapa</label>
                <input
                  type="text"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex.: Estratégia de tráfego Q1"
                  required
                  autoFocus
                />
              </div>
              <div className="modal-actions" style={{ marginTop: 14 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowNovo(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Criar</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// =========================================================
// Editor do mapa
// =========================================================
function MapaEditor({ mapaId, onClose }) {
  const toast = useToast();
  const confirm = useConfirm();
  const wrapRef = useRef(null);
  const [mapa, setMapa] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [tipoAtual, setTipoAtual] = useState('estrategia');
  const [salvando, setSalvando] = useState(false);
  const [exporting, setExporting] = useState(false);
  const rf = useReactFlow();
  const initialLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await api.getMapa(mapaId);
      if (cancelled) return;
      setMapa(m);
      const data = m.data || {};
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      initialLoaded.current = true;
    })();
    return () => { cancelled = true; };
  }, [mapaId]);

  // Auto-save debounced
  const saveRef = useRef(null);
  useEffect(() => {
    if (!initialLoaded.current) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      setSalvando(true);
      try {
        await api.updateMapa(mapaId, { data: { nodes, edges } });
      } catch (e) {
        toast?.error('Falha ao salvar: ' + (e?.message || e));
      } finally { setSalvando(false); }
    }, 800);
    return () => clearTimeout(saveRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)), []);

  function adicionarNo() {
    const t = TIPO_BY_ID[tipoAtual] || TIPO_BY_ID.estrategia;
    const novo = makeNode({
      x: 250 + Math.random() * 300,
      y: 200 + Math.random() * 200,
      label: t.label,
      tipo: tipoAtual
    });
    setNodes((nds) => [...nds, novo]);
    if (selecionado) {
      setEdges((eds) => addEdge({
        id: `e_${selecionado}_${novo.id}`,
        source: selecionado,
        target: novo.id,
        animated: true
      }, eds));
    }
  }

  function deletarSelecionado() {
    if (!selecionado) return;
    setEdges((eds) => eds.filter((e) => e.source !== selecionado && e.target !== selecionado));
    setNodes((nds) => nds.filter((n) => n.id !== selecionado));
    setSelecionado(null);
  }

  async function limparTudo() {
    const ok = await confirm({
      message: 'Apagar todos os nós e conexões deste mapa?'
    });
    if (!ok) return;
    setNodes([]);
    setEdges([]);
  }

  function onNodeDoubleClick(e, node) {
    const novo = window.prompt('Texto do nó:', node.data.label);
    if (novo == null) return;
    setNodes((nds) => nds.map((n) =>
      n.id === node.id ? { ...n, data: { ...n.data, label: novo } } : n
    ));
  }

  function onNodeClick(_e, node) {
    setSelecionado(node.id);
    setTipoAtual(node.data.tipo || 'estrategia');
  }

  function trocarTipoSelecionado(tipo) {
    setTipoAtual(tipo);
    if (!selecionado) return;
    const t = TIPO_BY_ID[tipo];
    setNodes((nds) => nds.map((n) =>
      n.id === selecionado ? { ...n, data: { ...n.data, tipo, cor: t.cor } } : n
    ));
  }

  async function exportarPng() {
    if (!wrapRef.current) return;
    setExporting(true);
    try {
      const node = wrapRef.current.querySelector('.react-flow__viewport') || wrapRef.current;
      const dataUrl = await toPng(node, {
        backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-2') || '#1C1C1E',
        cacheBust: true,
        pixelRatio: 2
      });
      // Atualiza thumbnail no banco (opcional, fire-and-forget)
      try { await api.updateMapa(mapaId, { thumbnail: dataUrl }); } catch {}
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${mapa?.nome || 'mapa'}.png`;
      a.click();
      toast?.success('Exportado!');
    } catch (e) {
      toast?.error('Falha ao exportar: ' + (e?.message || e));
    } finally { setExporting(false); }
  }

  if (!mapa) {
    return <div className="empty-state">Carregando mapa…</div>;
  }

  return (
    <div className="mapa-editor">
      <div className="mapa-editor-toolbar">
        <div className="mapa-editor-tb-left">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>← Voltar</button>
          <h3 className="mapa-editor-title">{mapa.nome}</h3>
          <span className="mapa-editor-status">
            {salvando ? 'Salvando…' : '✓ Salvo'}
          </span>
        </div>
        <div className="mapa-editor-tb-right">
          <div className="mapa-tipo-pills" role="radiogroup" aria-label="Tipo de nó">
            {NODE_TIPOS.map((t) => (
              <button
                key={t.id}
                className={`mapa-tipo-pill ${tipoAtual === t.id ? 'is-active' : ''}`}
                style={tipoAtual === t.id ? { background: t.cor, borderColor: t.cor, color: '#fff' } : { color: t.cor }}
                onClick={() => trocarTipoSelecionado(t.id)}
                title={t.label}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button className="btn btn-sm btn-primary" onClick={adicionarNo}>+ Nó</button>
          <button className="btn btn-sm btn-ghost btn-danger" onClick={deletarSelecionado} disabled={!selecionado}>
            Deletar
          </button>
          <button className="btn btn-sm btn-ghost" onClick={limparTudo}>Limpar</button>
          <button className="btn btn-sm" onClick={exportarPng} disabled={exporting}>
            {exporting ? 'Exportando…' : '↓ PNG'}
          </button>
        </div>
      </div>

      <div className="mapa-editor-canvas" ref={wrapRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onPaneClick={() => setSelecionado(null)}
          fitView
          deleteKeyCode={['Delete', 'Backspace']}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant="dots" gap={18} size={1.4} color="var(--border)" />
          <Controls position="bottom-left" />
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            nodeColor={(n) => n.data?.cor || '#1B6FEE'}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

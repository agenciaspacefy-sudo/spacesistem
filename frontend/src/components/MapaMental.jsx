import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  ConnectionMode,
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

let _idSeed = 1;
function nextId() {
  return `n_${Date.now().toString(36)}_${(_idSeed++).toString(36)}`;
}

// Chave canônica por par de nós (independente da direção) — usada para
// deduplicar conexões. Garante que A->B e B->A são tratadas como o mesmo par.
function edgePairKey(source, target) {
  return source < target ? `${source}|${target}` : `${target}|${source}`;
}

// Remove arestas duplicadas mantendo apenas a primeira ocorrência por par.
function dedupeEdges(edges) {
  const seen = new Set();
  const out = [];
  for (const e of (edges || [])) {
    if (!e?.source || !e?.target) continue;
    if (e.source === e.target) continue; // ignora self-loops
    const key = edgePairKey(e.source, e.target);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

// Garante o estilo padrão (smoothstep + animated) em arestas vindas do banco
function normalizeEdge(e) {
  return {
    ...e,
    type: e?.type || 'smoothstep',
    animated: e?.animated !== false
  };
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

// =========================================================
// Custom node — com handles + edição inline + botão "+"
// =========================================================
function MapaNode({ id, data, selected }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(data.label || '');
  const inputRef = useRef(null);

  // Mantém o valor sincronizado se a label mudar externamente
  useEffect(() => { setValor(data.label || ''); }, [data.label]);

  // Foca no input ao começar a editar e seleciona texto
  useEffect(() => {
    if (editando && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editando]);

  function comecarEdicao(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setEditando(true);
  }

  function confirmar() {
    const limpo = valor.trim() || 'Sem texto';
    data.onLabelChange?.(id, limpo);
    setValor(limpo);
    setEditando(false);
  }

  function cancelar() {
    setValor(data.label || '');
    setEditando(false);
  }

  function onInputKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmar();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelar();
    }
    // Bloqueia delete/backspace de propagar para React Flow (que apaga o nó)
    e.stopPropagation();
  }

  function handleAddChild(e) {
    e.stopPropagation();
    data.onAddChild?.(id);
  }

  return (
    <div
      className={`mapa-node ${selected ? 'is-selected' : ''}`}
      style={{ borderColor: data.cor, color: data.cor }}
      onDoubleClick={comecarEdicao}
      title={editando ? '' : 'Duplo clique para editar'}
    >
      {/* Handles invisíveis em todos os lados (source + target) */}
      <Handle type="target" position={Position.Top}    id="t" className="mapa-handle" />
      <Handle type="target" position={Position.Left}   id="l" className="mapa-handle" />
      <Handle type="source" position={Position.Right}  id="r" className="mapa-handle" />
      <Handle type="source" position={Position.Bottom} id="b" className="mapa-handle" />

      <span className="mapa-node-dot" style={{ background: data.cor }} />

      {editando ? (
        <input
          ref={inputRef}
          className="mapa-node-input"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={onInputKeyDown}
          onBlur={confirmar}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ color: data.cor }}
          maxLength={120}
        />
      ) : (
        <span className="mapa-node-label">{data.label || 'Sem texto'}</span>
      )}

      {/* Botão "+" para criar nó filho conectado automaticamente */}
      <button
        type="button"
        className="mapa-node-add"
        title="Adicionar nó conectado"
        aria-label="Adicionar nó conectado"
        onClick={handleAddChild}
        onMouseDown={(e) => e.stopPropagation()}
      >
        +
      </button>
    </div>
  );
}
const NODE_TYPES = { mapaNode: MapaNode };

// =========================================================
// Listagem de mapas + roteador para o editor
// =========================================================
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
    try {
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
    } catch (err) {
      toast?.error('Falha ao criar: ' + (err?.message || err));
    }
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
                  {m.updated_at
                    ? new Date(m.updated_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR')
                    : ''}
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
  const [edgeMenu, setEdgeMenu] = useState(null); // { x, y, edgeId } | null
  const rf = useReactFlow();
  const initialLoaded = useRef(false);
  const connectingFromRef = useRef(null); // nodeId do qual o usuário está puxando uma conexão

  // Wrappers que enriquecem cada node com callbacks (label change + add child)
  const onLabelChange = useCallback((nodeId, novaLabel) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, label: novaLabel } } : n
    ));
  }, []);

  const onAddChildRef = useRef(null);
  const onAddChild = useCallback((parentId) => {
    onAddChildRef.current?.(parentId);
  }, []);

  // Liga nodes -> data com callbacks (mantém referência viva ao tipo atual)
  const enrichedNodes = useMemo(() =>
    nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onLabelChange,
        onAddChild
      }
    })),
    [nodes, onLabelChange, onAddChild]
  );

  // Carrega mapa
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await api.getMapa(mapaId);
        if (cancelled) return;
        setMapa(m);
        const data = m.data || {};
        setNodes(data.nodes || []);
        // Normaliza tipo + animacao e remove duplicatas que existam no banco
        const edgesLimpo = dedupeEdges((data.edges || []).map(normalizeEdge));
        setEdges(edgesLimpo);
        initialLoaded.current = true;
      } catch (e) {
        toast?.error('Falha ao abrir: ' + (e?.message || e));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapaId]);

  // Auto-save debounced
  const saveRef = useRef(null);
  useEffect(() => {
    if (!initialLoaded.current) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      setSalvando(true);
      try {
        // Sempre persiste sem duplicatas (uma conexao por par de nos)
        await api.updateMapa(mapaId, { data: { nodes, edges: dedupeEdges(edges) } });
      } catch (e) {
        toast?.error('Falha ao salvar: ' + (e?.message || e));
      } finally { setSalvando(false); }
    }, 800);
    return () => clearTimeout(saveRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  // Botao direito em uma edge abre menu contextual interno
  const onEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault();
    event.stopPropagation();
    setEdgeMenu({
      x: event.clientX,
      y: event.clientY,
      edgeId: edge.id
    });
  }, []);

  function deletarEdge(edgeId) {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setEdgeMenu(null);
  }

  // Fecha o menu contextual com clique fora ou Escape
  useEffect(() => {
    if (!edgeMenu) return;
    function onDocDown(e) {
      // Se clicar dentro do menu, ignora; fora, fecha
      const m = document.querySelector('.mapa-edge-menu');
      if (m && !m.contains(e.target)) setEdgeMenu(null);
    }
    function onKey(e) { if (e.key === 'Escape') setEdgeMenu(null); }
    // Usa capture true para pegar antes do React Flow
    document.addEventListener('mousedown', onDocDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [edgeMenu]);

  const onConnect = useCallback((params) => {
    if (!params.source || !params.target) return;
    if (params.source === params.target) return; // bloqueia self-loop
    setEdges((eds) => {
      const key = edgePairKey(params.source, params.target);
      const exists = eds.some((e) => edgePairKey(e.source, e.target) === key);
      if (exists) return eds; // ignora duplicata
      return addEdge({ ...params, animated: true, type: 'smoothstep' }, eds);
    });
  }, []);

  const onConnectStart = useCallback((_e, { nodeId }) => {
    connectingFromRef.current = nodeId;
  }, []);

  // Cria nó "no vazio" quando o usuário arrasta a conexão para fora de qualquer nó
  const onConnectEnd = useCallback((event) => {
    const sourceId = connectingFromRef.current;
    connectingFromRef.current = null;
    if (!sourceId) return;
    // Se soltou em cima de um handle, o React Flow trata via onConnect
    const target = event?.target;
    const droppedOnPane = target?.classList?.contains?.('react-flow__pane');
    if (!droppedOnPane) return;

    const t = TIPO_BY_ID[tipoAtual] || TIPO_BY_ID.estrategia;
    // Posiciona onde o mouse soltou (em coordenadas do flow)
    const clientX = event?.clientX ?? event?.changedTouches?.[0]?.clientX;
    const clientY = event?.clientY ?? event?.changedTouches?.[0]?.clientY;
    const pos = rf.screenToFlowPosition({ x: clientX, y: clientY });

    const novo = makeNode({
      x: pos.x - 60,
      y: pos.y - 18,
      label: t.label,
      tipo: tipoAtual
    });
    setNodes((nds) => [...nds, novo]);
    setEdges((eds) => addEdge({
      id: `e_${sourceId}_${novo.id}`,
      source: sourceId,
      target: novo.id,
      animated: true,
      type: 'smoothstep'
    }, eds));
  }, [rf, tipoAtual]);

  function adicionarNoSolto() {
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
        animated: true,
        type: 'smoothstep'
      }, eds));
    }
  }

  // Adiciona nó filho conectado a partir do botão "+" do node
  const adicionarFilhoDe = useCallback((parentId) => {
    setNodes((curNodes) => {
      const parent = curNodes.find((n) => n.id === parentId);
      if (!parent) return curNodes;
      const t = TIPO_BY_ID[tipoAtual] || TIPO_BY_ID.estrategia;
      const novo = makeNode({
        x: parent.position.x + 180,
        y: parent.position.y + 60 + Math.random() * 40 - 20,
        label: t.label,
        tipo: tipoAtual
      });
      // Conecta via setEdges em outro effect (melhor garantir node existe)
      setEdges((eds) => addEdge({
        id: `e_${parentId}_${novo.id}`,
        source: parentId,
        target: novo.id,
        animated: true,
        type: 'smoothstep'
      }, eds));
      return [...curNodes, novo];
    });
  }, [tipoAtual]);

  useEffect(() => { onAddChildRef.current = adicionarFilhoDe; }, [adicionarFilhoDe]);

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
                type="button"
                className={`mapa-tipo-pill ${tipoAtual === t.id ? 'is-active' : ''}`}
                style={tipoAtual === t.id ? { background: t.cor, borderColor: t.cor, color: '#fff' } : { color: t.cor }}
                onClick={() => trocarTipoSelecionado(t.id)}
                title={t.label}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button className="btn btn-sm btn-primary" onClick={adicionarNoSolto}>+ Nó</button>
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
          nodes={enrichedNodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onNodeClick={onNodeClick}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneClick={() => { setSelecionado(null); setEdgeMenu(null); }}
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

        {edgeMenu && (
          <div
            className="mapa-edge-menu"
            style={{ left: edgeMenu.x, top: edgeMenu.y }}
            onClick={(e) => e.stopPropagation()}
            role="menu"
          >
            <button
              type="button"
              className="mapa-edge-menu-item is-danger"
              onClick={() => deletarEdge(edgeMenu.edgeId)}
            >
              <span className="mapa-edge-menu-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                </svg>
              </span>
              Deletar conexão
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const API = '/api';

async function request(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (res.status === 401) {
    if (url.startsWith(API)) {
      window.dispatchEvent(new CustomEvent('spacefy:unauthenticated'));
    }
    const err = new Error('Não autenticado');
    err.status = 401;
    throw err;
  }
  // 402 = Payment Required — trial expirado / sem assinatura
  if (res.status === 402) {
    let payload = null;
    try { payload = await res.json(); } catch {}
    window.dispatchEvent(new CustomEvent('spacefy:payment-required', { detail: payload }));
    const err = new Error(payload?.error || 'Acesso bloqueado — faça seu plano');
    err.status = 402;
    err.billing = payload?.billing;
    throw err;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  if (res.status === 204) return null;
  return res.json();
}

// Fetch público sem credentials e sem dispatch de evento (não precisa de auth)
export async function fetchRelatorioPublico(token) {
  const res = await fetch(`/api/public/relatorio/${encodeURIComponent(token)}`, {
    headers: { 'Content-Type': 'application/json' }
  });
  if (res.status === 404) {
    const err = new Error('Relatório não encontrado');
    err.status = 404;
    throw err;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const auth = {
  me: () => request('/auth/me'),
  config: () => request('/auth/config'),
  login: (email, senha) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  updateProfile: (data) => request('/auth/me', { method: 'PUT', body: JSON.stringify(data) })
};

export const api = {
  // Recebimentos
  listRecebimentos: (mes) => request(`${API}/recebimentos${mes ? `?mes=${mes}` : ''}`),
  createRecebimento: (data) => request(`${API}/recebimentos`, { method: 'POST', body: JSON.stringify(data) }),
  updateRecebimento: (id, data) => request(`${API}/recebimentos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRecebimento: (id) => request(`${API}/recebimentos/${id}`, { method: 'DELETE' }),

  // Gastos
  listGastos: (mes) => request(`${API}/gastos${mes ? `?mes=${mes}` : ''}`),
  createGasto: (data) => request(`${API}/gastos`, { method: 'POST', body: JSON.stringify(data) }),
  updateGasto: (id, data) => request(`${API}/gastos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGasto: (id) => request(`${API}/gastos/${id}`, { method: 'DELETE' }),

  // Clientes
  listClientes: () => request(`${API}/clientes`),
  createCliente: (data) => request(`${API}/clientes`, { method: 'POST', body: JSON.stringify(data) }),
  updateCliente: (id, data) => request(`${API}/clientes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCliente: (id) => request(`${API}/clientes/${id}`, { method: 'DELETE' }),
  gerarRelatorioToken: (id) => request(`${API}/clientes/${id}/relatorio-token`, { method: 'POST' }),
  revogarRelatorioToken: (id) => request(`${API}/clientes/${id}/relatorio-token`, { method: 'DELETE' }),
  listClienteServicos: (id) => request(`${API}/clientes/${id}/servicos`),
  toggleClienteServico: (id, servico, ativo, custom_text) =>
    request(`${API}/clientes/${id}/servicos/toggle`, {
      method: 'POST',
      body: JSON.stringify({ servico, ativo, custom_text })
    }),
  updateClienteServicoCustom: (id, servico, custom_text) =>
    request(`${API}/clientes/${id}/servicos/${encodeURIComponent(servico)}`, {
      method: 'PUT',
      body: JSON.stringify({ custom_text })
    }),

  // Cobranças
  listCobrancas: () => request(`${API}/cobrancas`),
  createCobranca: (data) => request(`${API}/cobrancas`, { method: 'POST', body: JSON.stringify(data) }),
  updateCobranca: (id, data) => request(`${API}/cobrancas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCobranca: (id) => request(`${API}/cobrancas/${id}`, { method: 'DELETE' }),
  marcarCobrancaEnviada: (id) => request(`${API}/cobrancas/${id}/marcar-enviada`, { method: 'POST' }),

  // Agenda (eventos)
  listAgenda: (de, ate) => {
    const qs = (de && ate) ? `?de=${de}&ate=${ate}` : '';
    return request(`${API}/agenda${qs}`);
  },
  createEvento: (data) => request(`${API}/agenda`, { method: 'POST', body: JSON.stringify(data) }),
  updateEvento: (id, data) => request(`${API}/agenda/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvento: (id) => request(`${API}/agenda/${id}`, { method: 'DELETE' }),

  // Tarefas
  listTarefas: () => request(`${API}/tarefas`),
  createTarefa: (data) => request(`${API}/tarefas`, { method: 'POST', body: JSON.stringify(data) }),
  updateTarefa: (id, data) => request(`${API}/tarefas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTarefa: (id) => request(`${API}/tarefas/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request(`${API}/settings`),
  saveSettings: (data) => request(`${API}/settings`, { method: 'PUT', body: JSON.stringify(data) }),

  // Resumo
  resumo: () => request(`${API}/resumo`),

  // Campanhas (tráfego pago)
  listCampanhas: () => request(`${API}/campanhas`),
  createCampanha: (data) => request(`${API}/campanhas`, { method: 'POST', body: JSON.stringify(data) }),
  updateCampanha: (id, data) => request(`${API}/campanhas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCampanha: (id) => request(`${API}/campanhas/${id}`, { method: 'DELETE' }),
  campanhasResumo: () => request(`${API}/campanhas/resumo`),

  // Notas
  listNotas: (q, incluir) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (incluir) params.set('incluir_concluidas', incluir);
    const qs = params.toString();
    return request(`${API}/notas${qs ? '?' + qs : ''}`);
  },
  createNota: (data) => request(`${API}/notas`, { method: 'POST', body: JSON.stringify(data) }),
  updateNota: (id, data) => request(`${API}/notas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNota: (id) => request(`${API}/notas/${id}`, { method: 'DELETE' }),
  concluirNota: (id, desfazer = false) =>
    request(`${API}/notas/${id}/concluir`, { method: 'POST', body: JSON.stringify({ desfazer }) }),

  // Reuniões de campanha
  listReunioes: (campanhaId) => request(`${API}/campanhas/${campanhaId}/reunioes`),
  createReuniao: (campanhaId, data) => request(`${API}/campanhas/${campanhaId}/reunioes`, { method: 'POST', body: JSON.stringify(data) }),
  updateReuniao: (id, data) => request(`${API}/reunioes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReuniao: (id) => request(`${API}/reunioes/${id}`, { method: 'DELETE' })
};

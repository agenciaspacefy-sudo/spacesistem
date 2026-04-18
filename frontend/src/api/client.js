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
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  if (res.status === 204) return null;
  return res.json();
}

export const auth = {
  me: () => request('/auth/me'),
  config: () => request('/auth/config'),
  login: (email, senha) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' })
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

  // Cobranças
  listCobrancas: () => request(`${API}/cobrancas`),
  createCobranca: (data) => request(`${API}/cobrancas`, { method: 'POST', body: JSON.stringify(data) }),
  updateCobranca: (id, data) => request(`${API}/cobrancas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCobranca: (id) => request(`${API}/cobrancas/${id}`, { method: 'DELETE' }),

  // Tarefas
  listTarefas: () => request(`${API}/tarefas`),
  createTarefa: (data) => request(`${API}/tarefas`, { method: 'POST', body: JSON.stringify(data) }),
  updateTarefa: (id, data) => request(`${API}/tarefas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTarefa: (id) => request(`${API}/tarefas/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request(`${API}/settings`),
  saveSettings: (data) => request(`${API}/settings`, { method: 'PUT', body: JSON.stringify(data) }),

  // Resumo
  resumo: () => request(`${API}/resumo`)
};

export function formatBRL(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ---------- Máscaras do modo privacidade (👁) ----------
// Usadas APENAS em telas de exibição. Exports (PDF/WhatsApp) continuam com
// o valor real via formatBRL / cob.cliente_whatsapp / cob.cliente_cnpj.
export const MASKED_BRL = 'R$ ••••••';
export const MASKED_CNPJ = '••.•••.•••/••••-••';
export const MASKED_WHATSAPP = '•• •••••-••••';

export function maskBRL() { return MASKED_BRL; }
export function maskCnpj(value) { return value ? MASKED_CNPJ : ''; }
export function maskWhatsapp(value) { return value ? MASKED_WHATSAPP : ''; }

export function formatNumber(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR');
}

export function monthLabel(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || '';
  const [y, m] = ym.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(m, 10) - 1]}/${y}`;
}

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Strip all non-digits; if a number has no country code, prefix Brazil's 55
export function normalizeWhatsapp(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

export function applyTemplate(template, vars) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : ''));
}

export function buildWaUrl(phoneRaw, message) {
  const phone = normalizeWhatsapp(phoneRaw);
  const text = encodeURIComponent(message || '');
  return `https://wa.me/${phone}${text ? `?text=${text}` : ''}`;
}

// Build vencimento date in YYYY-MM-DD from mes_ref (YYYY-MM) + day
export function buildVencimento(mesRef, dia) {
  if (!mesRef || !dia) return '';
  const [y, m] = mesRef.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const safeDia = Math.min(Math.max(1, Number(dia)), lastDay);
  return `${y}-${String(m).padStart(2, '0')}-${String(safeDia).padStart(2, '0')}`;
}

// Generate array of last N months as YYYY-MM (oldest first)
export function lastNMonths(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const ref = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

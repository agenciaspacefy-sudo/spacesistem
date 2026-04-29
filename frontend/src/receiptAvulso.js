import jsPDF from 'jspdf';
import { formatBRL, formatDate, todayISO } from './utils.js';

const COLORS = {
  text: [28, 28, 28],
  dim: [107, 107, 107],
  line: [229, 229, 226],
  accent: [27, 111, 238],
  green: [22, 163, 74],
  white: [255, 255, 255]
};

function setColor(doc, setter, rgb) {
  doc[setter](rgb[0], rgb[1], rgb[2]);
}

function detectImageFormat(dataUrl) {
  const m = /^data:image\/(\w+);/.exec(dataUrl || '');
  if (!m) return null;
  const fmt = m[1].toUpperCase();
  if (fmt === 'JPG' || fmt === 'JPEG') return 'JPEG';
  if (fmt === 'PNG') return 'PNG';
  return null;
}

function drawLogoFallback(doc, x, y, size) {
  setColor(doc, 'setFillColor', COLORS.accent);
  doc.circle(x + size / 2, y + size / 2, size / 3, 'F');
}

// Gera próximo número de recibo avulso baseado em localStorage
// (não persiste no banco — apenas garante numeração crescente local)
function nextAvulsoNumber() {
  const KEY = 'spacefy-recibo-avulso-counter';
  const cur = Number(localStorage.getItem(KEY) || '0');
  const next = cur + 1;
  localStorage.setItem(KEY, String(next));
  return `REC-AVULSO-${String(next).padStart(3, '0')}`;
}

export function generateReceiptAvulso(data, settings) {
  const {
    cliente_nome,
    descricao,
    valor,
    data_pagamento,
    forma_pagamento
  } = data;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const MARGIN = 20;
  const numero = nextAvulsoNumber();
  const dataDoc = data_pagamento || todayISO();
  const nomeAgencia = settings?.nome_agencia || 'Spacefy Marketing';
  const chavePix = settings?.chave_pix || '';

  // ------ Cabeçalho ------
  let y = 18;

  // Logo
  const logoData = settings?.logo_data;
  const fmt = detectImageFormat(logoData);
  if (logoData && fmt) {
    try {
      doc.addImage(logoData, fmt, MARGIN, y, 18, 18);
    } catch {
      drawLogoFallback(doc, MARGIN, y, 18);
    }
  } else {
    drawLogoFallback(doc, MARGIN, y, 18);
  }

  // Texto SpaceSystem + agência
  setColor(doc, 'setTextColor', COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SpaceSystem', MARGIN + 24, y + 7);
  setColor(doc, 'setTextColor', COLORS.dim);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(nomeAgencia, MARGIN + 24, y + 13);

  // Box do número à direita
  setColor(doc, 'setFillColor', COLORS.accent);
  doc.roundedRect(PAGE_W - MARGIN - 60, y, 60, 18, 3, 3, 'F');
  setColor(doc, 'setTextColor', COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('RECIBO', PAGE_W - MARGIN - 30, y + 6, { align: 'center' });
  doc.setFontSize(11);
  doc.text(numero, PAGE_W - MARGIN - 30, y + 13, { align: 'center' });

  y += 30;

  // ------ Título ------
  setColor(doc, 'setTextColor', COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Recibo de Pagamento', MARGIN, y);
  y += 6;
  setColor(doc, 'setDrawColor', COLORS.line);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  y += 14;

  // ------ Bloco "Recebemos de" ------
  setColor(doc, 'setTextColor', COLORS.dim);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Recebemos de', MARGIN, y);
  y += 6;
  setColor(doc, 'setTextColor', COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(cliente_nome || '—', MARGIN, y);

  y += 14;

  // ------ Valor (destaque verde) ------
  setColor(doc, 'setTextColor', COLORS.dim);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('A importância de', MARGIN, y);
  y += 7;
  setColor(doc, 'setTextColor', COLORS.green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(formatBRL(Number(valor) || 0), MARGIN, y);

  y += 12;

  // ------ Descrição ------
  setColor(doc, 'setTextColor', COLORS.dim);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Referente a', MARGIN, y);
  y += 6;
  setColor(doc, 'setTextColor', COLORS.text);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.5);
  const descLines = doc.splitTextToSize(descricao || '—', PAGE_W - MARGIN * 2);
  doc.text(descLines, MARGIN, y);
  y += descLines.length * 5.5 + 8;

  // ------ Tabela de detalhes (forma + data) ------
  setColor(doc, 'setFillColor', [248, 248, 246]);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 22, 3, 3, 'F');
  setColor(doc, 'setTextColor', COLORS.dim);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('FORMA DE PAGAMENTO', MARGIN + 6, y + 7);
  doc.text('DATA DO PAGAMENTO', MARGIN + 90, y + 7);
  setColor(doc, 'setTextColor', COLORS.text);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(forma_pagamento || '—', MARGIN + 6, y + 15);
  doc.text(formatDate(dataDoc), MARGIN + 90, y + 15);

  y += 30;

  if (chavePix) {
    setColor(doc, 'setTextColor', COLORS.dim);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Chave PIX: ${chavePix}`, MARGIN, y);
    y += 8;
  }

  // ------ Rodapé ------
  const footY = 270;
  setColor(doc, 'setDrawColor', COLORS.line);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, footY, PAGE_W - MARGIN, footY);
  setColor(doc, 'setTextColor', COLORS.dim);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emitido em ${formatDate(todayISO())}`, MARGIN, footY + 6);
  doc.text('Obrigado pela preferência', PAGE_W - MARGIN, footY + 6, { align: 'right' });

  doc.save(`${numero}.pdf`);
  return numero;
}

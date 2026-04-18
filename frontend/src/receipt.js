import jsPDF from 'jspdf';
import { formatBRL, formatDate, todayISO } from './utils.js';

const COLORS = {
  text: [20, 25, 40],
  dim: [110, 120, 140],
  line: [220, 225, 235],
  green: [14, 155, 96],
  brandA: [76, 138, 255],
  brandB: [161, 124, 255]
};

function setColor(doc, setter, rgb) {
  doc[setter](rgb[0], rgb[1], rgb[2]);
}

function drawDefaultMark(doc, x, y, size) {
  // Gradient-ish: two overlapping rounded squares
  setColor(doc, 'setFillColor', COLORS.brandB);
  doc.roundedRect(x + 2, y + 2, size, size, 2.5, 2.5, 'F');
  setColor(doc, 'setFillColor', COLORS.brandA);
  doc.roundedRect(x, y, size, size, 2.5, 2.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SF', x + size / 2, y + size / 2 + 1.5, { align: 'center' });
}

function detectImageFormat(dataUrl) {
  const m = /^data:image\/(\w+);/.exec(dataUrl || '');
  if (!m) return null;
  const fmt = m[1].toUpperCase();
  if (fmt === 'JPG' || fmt === 'JPEG') return 'JPEG';
  if (fmt === 'PNG') return 'PNG';
  return null;
}

export function generateReceipt(cobranca, settings) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 22;

  // ---- HEADER ----
  let y = 22;
  const logo = settings.logo_data;
  const fmt = detectImageFormat(logo);
  if (logo && fmt) {
    try {
      doc.addImage(logo, fmt, MARGIN, y - 2, 40, 14);
    } catch {
      drawDefaultMark(doc, MARGIN, y - 2, 14);
      setColor(doc, 'setTextColor', COLORS.text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Spacefy Marketing', MARGIN + 20, y + 7);
    }
  } else {
    drawDefaultMark(doc, MARGIN, y - 2, 14);
    setColor(doc, 'setTextColor', COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Spacefy Marketing', MARGIN + 20, y + 7);
  }

  // Document number — top right
  setColor(doc, 'setTextColor', COLORS.dim);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('DOCUMENTO', PAGE_W - MARGIN, y, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(doc, 'setTextColor', COLORS.text);
  doc.text(cobranca.numero_comprovante || '—', PAGE_W - MARGIN, y + 6, { align: 'right' });

  // Separator
  y = 42;
  setColor(doc, 'setDrawColor', COLORS.line);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  // ---- TITLE ----
  y = 58;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  setColor(doc, 'setTextColor', COLORS.text);
  doc.text('Comprovante de Recebimento', PAGE_W / 2, y, { align: 'center' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, 'setTextColor', COLORS.dim);
  doc.text(
    `Emitido em ${formatDate(todayISO())}`,
    PAGE_W / 2,
    y,
    { align: 'center' }
  );

  // ---- INFO GRID ----
  y = 82;
  const rows = [
    ['Cliente', cobranca.cliente_nome || '—'],
    ['CNPJ', cobranca.cliente_cnpj || '—'],
    ['Descrição / Serviço', cobranca.descricao || '—'],
    ['Data de vencimento', cobranca.vencimento ? formatDate(cobranca.vencimento) : '—'],
    ['Data de pagamento', cobranca.data_pagamento ? formatDate(cobranca.data_pagamento) : formatDate(todayISO())]
  ];

  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, 'setTextColor', COLORS.dim);
    doc.text(label.toUpperCase(), MARGIN, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    setColor(doc, 'setTextColor', COLORS.text);
    const wrapped = doc.splitTextToSize(String(value), PAGE_W - MARGIN * 2);
    doc.text(wrapped, MARGIN, y + 6);
    y += 6 + wrapped.length * 5 + 6;
  }

  // Separator
  y += 2;
  setColor(doc, 'setDrawColor', COLORS.line);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  // ---- VALOR PAGO (destaque verde) ----
  y += 14;
  doc.setFontSize(10);
  setColor(doc, 'setTextColor', COLORS.dim);
  doc.text('VALOR PAGO', MARGIN, y);

  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  setColor(doc, 'setTextColor', COLORS.green);
  doc.text(formatBRL(cobranca.valor), MARGIN, y);

  // Separator
  y += 10;
  setColor(doc, 'setDrawColor', COLORS.line);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  // ---- PIX ----
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, 'setTextColor', COLORS.dim);
  doc.text('CHAVE PIX DA AGÊNCIA', MARGIN, y);

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  setColor(doc, 'setTextColor', COLORS.text);
  doc.text(settings.chave_pix || '—', MARGIN, y);

  // ---- FOOTER ----
  const footerY = PAGE_H - 25;
  setColor(doc, 'setDrawColor', COLORS.line);
  doc.line(MARGIN, footerY - 8, PAGE_W - MARGIN, footerY - 8);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  setColor(doc, 'setTextColor', COLORS.text);
  doc.text(
    'Agradecemos a confiança. Qualquer dúvida entre em contato.',
    PAGE_W / 2,
    footerY - 2,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, 'setTextColor', COLORS.dim);
  doc.text(
    `Spacefy Marketing · Documento nº ${cobranca.numero_comprovante || '—'}`,
    PAGE_W / 2,
    footerY + 4,
    { align: 'center' }
  );

  const filename = `${cobranca.numero_comprovante || 'comprovante'}-${(cobranca.cliente_nome || 'cliente').replace(/[^\w]+/g, '_')}.pdf`;
  doc.save(filename);
}

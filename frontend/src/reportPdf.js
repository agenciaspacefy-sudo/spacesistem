import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBRL, formatDate, monthLabel, todayISO } from './utils.js';

const COLORS = {
  text: [28, 28, 28],       // #1C1C1C
  dim: [107, 107, 107],     // #6B6B6B
  line: [229, 229, 226],    // #E5E5E2
  accent: [27, 111, 238],   // #1B6FEE SpaceSystem
  green: [22, 163, 74],
  red: [220, 38, 38]
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
  // Círculo azul SpaceSystem com tracinho = satélite
  setColor(doc, 'setFillColor', COLORS.accent);
  doc.circle(x + size / 2, y + size / 2, size / 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('S', x + size / 2, y + size / 2 + 1.2, { align: 'center' });
}

export function generateMonthlyReport({ resumoRows, recebimentos, gastos, mesFiltro, settings }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 18;

  // ---- HEADER ----
  let y = 18;
  const logo = settings?.logo_data;
  const fmt = detectImageFormat(logo);
  if (logo && fmt) {
    try { doc.addImage(logo, fmt, MARGIN, y - 2, 14, 14); }
    catch { drawLogoFallback(doc, MARGIN, y - 2, 14); }
  } else {
    drawLogoFallback(doc, MARGIN, y - 2, 14);
  }

  setColor(doc, 'setTextColor', COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SpaceSystem', MARGIN + 18, y + 4);

  setColor(doc, 'setTextColor', COLORS.dim);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Relatório financeiro mensal', MARGIN + 18, y + 9);

  // Título do mês (direita)
  setColor(doc, 'setTextColor', COLORS.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const tituloMes = mesFiltro ? `Referência: ${monthLabel(mesFiltro)}` : 'Resumo anual completo';
  doc.text(tituloMes, PAGE_W - MARGIN, y + 7, { align: 'right' });

  // Separador
  y = 32;
  setColor(doc, 'setDrawColor', COLORS.line);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  // ---- TABELA RESUMO MENSAL ----
  y += 8;
  setColor(doc, 'setTextColor', COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Resumo mensal', MARGIN, y);

  y += 4;
  const resumoOrdenado = [...(resumoRows || [])].sort((a, b) => a.mes.localeCompare(b.mes));
  const totalAnual = resumoOrdenado.reduce(
    (acc, r) => {
      acc.receita += Number(r.receita || 0);
      acc.gastos += Number(r.gastos || 0);
      acc.lucro += Number(r.lucro || 0);
      return acc;
    },
    { receita: 0, gastos: 0, lucro: 0 }
  );
  const margemAnual = totalAnual.receita > 0 ? (totalAnual.lucro / totalAnual.receita) * 100 : 0;

  autoTable(doc, {
    startY: y + 2,
    head: [['Mês', 'Receita', 'Pagamentos', 'Lucro', 'Margem']],
    body: [
      ...resumoOrdenado.map((r) => [
        monthLabel(r.mes),
        formatBRL(r.receita),
        formatBRL(r.gastos),
        formatBRL(r.lucro),
        `${Number(r.margem || 0).toFixed(1).replace('.', ',')}%`
      ]),
      [
        { content: 'Total anual', styles: { fontStyle: 'bold' } },
        { content: formatBRL(totalAnual.receita), styles: { fontStyle: 'bold', textColor: COLORS.green } },
        { content: formatBRL(totalAnual.gastos), styles: { fontStyle: 'bold', textColor: COLORS.red } },
        { content: formatBRL(totalAnual.lucro), styles: { fontStyle: 'bold' } },
        { content: `${margemAnual.toFixed(1).replace('.', ',')}%`, styles: { fontStyle: 'bold' } }
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: COLORS.accent, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
    bodyStyles: { textColor: COLORS.text, fontSize: 9.5 },
    alternateRowStyles: { fillColor: [249, 246, 240] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' }
    },
    margin: { left: MARGIN, right: MARGIN }
  });

  y = doc.lastAutoTable.finalY + 10;

  // ---- RECEBIMENTOS DO MÊS FILTRADO ----
  if (mesFiltro && recebimentos && recebimentos.length > 0) {
    if (y > PAGE_H - 60) { doc.addPage(); y = 20; }

    setColor(doc, 'setTextColor', COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Recebimentos detalhados — ${monthLabel(mesFiltro)}`, MARGIN, y);

    autoTable(doc, {
      startY: y + 4,
      head: [['Data', 'Cliente', 'Serviço', 'Status', 'Valor']],
      body: recebimentos.map((r) => [
        r.data ? formatDate(r.data) : '—',
        r.cliente || '—',
        r.servico || '—',
        r.status || 'Pendente',
        formatBRL(r.valor)
      ]),
      theme: 'striped',
      headStyles: { fillColor: [60, 145, 90], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 4: { halign: 'right' } },
      margin: { left: MARGIN, right: MARGIN }
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  // ---- GASTOS DO MÊS FILTRADO ----
  if (mesFiltro && gastos && gastos.length > 0) {
    if (y > PAGE_H - 60) { doc.addPage(); y = 20; }

    setColor(doc, 'setTextColor', COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Pagamentos detalhados — ${monthLabel(mesFiltro)}`, MARGIN, y);

    autoTable(doc, {
      startY: y + 4,
      head: [['Data', 'Categoria', 'Descrição', 'Forma', 'Valor']],
      body: gastos.map((g) => [
        g.data ? formatDate(g.data) : '—',
        g.categoria || '—',
        g.descricao || '—',
        g.forma_pagamento || '—',
        formatBRL(g.valor)
      ]),
      theme: 'striped',
      headStyles: { fillColor: [195, 70, 70], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 4: { halign: 'right' } },
      margin: { left: MARGIN, right: MARGIN }
    });
  }

  // ---- FOOTER em todas as páginas ----
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setColor(doc, 'setDrawColor', COLORS.line);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);

    setColor(doc, 'setTextColor', COLORS.dim);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Gerado em ${formatDate(todayISO())} · SpaceSystem`,
      MARGIN,
      PAGE_H - 8
    );
    doc.text(
      `Página ${i} de ${pageCount}`,
      PAGE_W - MARGIN,
      PAGE_H - 8,
      { align: 'right' }
    );
  }

  const filename = mesFiltro
    ? `relatorio-${mesFiltro}.pdf`
    : `relatorio-spacesystem-${todayISO()}.pdf`;
  doc.save(filename);
}

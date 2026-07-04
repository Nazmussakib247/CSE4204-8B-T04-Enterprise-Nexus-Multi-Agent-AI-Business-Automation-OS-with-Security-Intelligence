const PDFDocument = require('pdfkit');

// Brand palette (matches frontend Material theme)
const C = {
  primary: '#006b5c',
  accent: '#00c2a8',
  dark: '#16191a',
  text: '#1a1c1e',
  muted: '#6b7280',
  line: '#e3e3e3',
  critical: '#b3261e',
  warn: '#a16207',
};

const money = (n) => `$${Number(n || 0).toLocaleString('en-US')}`;
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '-');

/**
 * Build an Executive Daily Briefing PDF.
 * Returns a PDFDocument (a readable stream) - pipe it to res or a file stream.
 *
 * @param {Object}  opts
 * @param {Object}  opts.user        { name, email }
 * @param {Object}  opts.briefing    { hr:{recent[]}, finance:{recent[]}, support:{recent[]}, analytics:{latest} }
 * @param {string}  opts.generatedAt ISO timestamp
 */
function buildExecutivePdf({ user = {}, briefing = {}, generatedAt = new Date().toISOString() }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;

  // Header band
  doc.rect(0, 0, doc.page.width, 96).fill(C.dark);
  doc.fillColor(C.accent).fontSize(20).font('Helvetica-Bold').text('Enterprise NeXus', left, 30);
  doc.fillColor('#ffffff').fontSize(12).font('Helvetica').text('Executive Daily Intelligence Briefing', left, 56);

  const dateStr = new Date(generatedAt).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  doc.fillColor('#9ca3af').fontSize(9)
    .text(`Generated ${dateStr}  -  Prepared for ${user.name || user.email || 'User'}`, left, 74);

  doc.fillColor(C.text).y = 120;

  // Section heading helper
  const section = (title) => {
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.moveDown(0.5);
    doc.fillColor(C.primary).font('Helvetica-Bold').fontSize(13).text(title, left, doc.y);
    doc.moveTo(left, doc.y + 2).lineTo(left + pageWidth, doc.y + 2)
      .strokeColor(C.line).lineWidth(1).stroke();
    doc.moveDown(0.6);
    doc.fontSize(10).font('Helvetica').fillColor(C.text);
  };

  const empty = (msg) => {
    doc.fillColor(C.muted).font('Helvetica-Oblique').fontSize(10).text(msg, left, doc.y);
    doc.font('Helvetica').fillColor(C.text);
    doc.moveDown(0.4);
  };

  const row = (cols, widths, opts = {}) => {
    const { bold = false, color = C.text, colors = null } = opts;
    if (doc.y > doc.page.height - 80) doc.addPage();
    const y = doc.y;
    let x = left;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5);
    cols.forEach((c, i) => {
      doc.fillColor(colors && colors[i] ? colors[i] : color);
      doc.text(String(c), x + 2, y, { width: widths[i] - 4, ellipsis: true });
      x += widths[i];
    });
    doc.y = y + 16;
    doc.fillColor(C.text);
  };

  // Analytics summary banner
  const latest = briefing.analytics && briefing.analytics.latest;
  if (latest) {
    const bannerY = doc.y;
    doc.rect(left, bannerY, pageWidth, 50).fill('#e6f7f4');
    doc.fillColor(C.primary).font('Helvetica-Bold').fontSize(9)
      .text('LATEST PERFORMANCE SCORE', left + 14, bannerY + 9);
    doc.fillColor(C.text).fontSize(22)
      .text(`${latest.overall_score != null ? latest.overall_score : '-'}`, left + 14, bannerY + 22, { continued: true })
      .fontSize(11).fillColor(C.muted).text(`   ${cap(latest.performance_rating)}`);
    doc.y = bannerY + 50;
    doc.moveDown(0.6);
  }

  // HR
  section('HR - Recent Candidates');
  const hr = (briefing.hr && briefing.hr.recent) || [];
  if (!hr.length) empty('No candidates screened yet.');
  else {
    const w = [pageWidth * 0.5, pageWidth * 0.25, pageWidth * 0.25];
    row(['Candidate', 'AI Score', 'Recommendation'], w, { bold: true, color: C.muted });
    hr.forEach((c) =>
      row([c.candidate_name || '-', `${c.ai_score != null ? c.ai_score : '-'}%`, cap(c.recommendation)], w)
    );
  }

  // Finance
  section('Finance - Recent Transactions');
  const fin = (briefing.finance && briefing.finance.recent) || [];
  if (!fin.length) empty('No finance records yet.');
  else {
    const w = [pageWidth * 0.5, pageWidth * 0.25, pageWidth * 0.25];
    row(['Category', 'Amount', 'Severity'], w, { bold: true, color: C.muted });
    fin.forEach((f) => {
      const sevColor = ['critical', 'high'].includes(f.severity) ? C.critical
        : f.severity === 'medium' ? C.warn : C.text;
      row([f.category || '-', money(f.amount), cap(f.severity)], w, {
        colors: [C.text, C.text, sevColor],
      });
    });
  }

  // Support
  section('Support - Recent Tickets');
  const sup = (briefing.support && briefing.support.recent) || [];
  if (!sup.length) empty('No support tickets yet.');
  else {
    const w = [pageWidth * 0.2, pageWidth * 0.3, pageWidth * 0.25, pageWidth * 0.25];
    row(['Ticket', 'Urgency', 'Status', 'Escalated'], w, { bold: true, color: C.muted });
    sup.forEach((t, i) =>
      row([`#${i + 1}`, cap(t.urgency), cap(t.status), t.escalated ? 'Yes' : 'No'], w)
    );
  }

  // Footer with page numbers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fontSize(8).fillColor(C.muted).font('Helvetica').text(
      `Enterprise NeXus  -  Confidential  -  Page ${i + 1} of ${range.count}`,
      left, doc.page.height - 40, { width: pageWidth, align: 'center' }
    );
  }

  doc.end();
  return doc;
}

module.exports = { buildExecutivePdf };

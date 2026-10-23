const PDFDocument = require('pdfkit');

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-';
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '-');

const COLS = [
  { key: 'seat', title: 'Seat', w: 30 },
  { key: 'name', title: 'Name', w: 112 },
  { key: 'sid', title: 'Student ID', w: 66 },
  { key: 'dept', title: 'Department', w: 118 },
  { key: 'cy', title: 'Course / Year', w: 64 },
  { key: 'status', title: 'Status', w: 48 },
  { key: 'time', title: 'Checked in', w: 77 }
];

const send = (report, res) => {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.pdf"');
  doc.pipe(res);

  const left = doc.page.margins.left;
  const width = COLS.reduce((n, c) => n + c.w, 0);
  const bottom = () => doc.page.height - doc.page.margins.bottom - 30;

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#1d1a3b').text('Attendance Report', left, 40);
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(13).text(report.event_title, { width });
  doc.font('Helvetica').fontSize(9).fillColor('#55527a');
  [
    ['Organization', report.org_name],
    ['Venue', report.venue],
    ['Date', fmt(report.event_date)],
    ['School year', report.school_year],
    ['Registered', report.total_registered],
    ['Walk-ins', report.total_walk_ins || 0],
    ['Present', report.total_present],
    ['Absent', report.total_absent],
    ['Attendance rate', report.rate + '%'],
    ['Generated', fmt(report.generated_at) + ' by ' + report.generated_by]
  ].forEach((r) => {
    doc.font('Helvetica-Bold').text(r[0] + ': ', { continued: true, width }).font('Helvetica').text(String(r[1] === undefined ? '' : r[1]));
  });
  doc.moveDown(0.8);

  const header = (y) => {
    doc.rect(left, y, width, 20).fill('#f06ad8');
    let x = left;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    COLS.forEach((c) => {
      doc.text(c.title, x + 4, y + 6, { width: c.w - 8, lineBreak: false });
      x += c.w;
    });
    return y + 20;
  };

  let y = header(doc.y);
  report.rows.forEach((r, i) => {
    const cells = {
      seat: String(r.seat_no),
      name: r.name,
      sid: r.student_id,
      dept: r.department,
      cy: (r.course || '') + (r.year ? ' / Y' + r.year : ''),
      status: r.status,
      time: r.attended_at ? fmtTime(r.attended_at) : '-'
    };
    doc.font('Helvetica').fontSize(8);
    const h = Math.max(...COLS.map((c) => doc.heightOfString(cells[c.key] || '', { width: c.w - 8 }))) + 10;
    if (y + h > bottom()) {
      doc.addPage();
      y = header(doc.page.margins.top);
    }
    if (i % 2) doc.rect(left, y, width, h).fill('#f6f4fd');
    let x = left;
    COLS.forEach((c) => {
      const color = c.key === 'status' ? (r.status === 'Present' ? '#15803d' : '#b91c1c') : '#1d1a3b';
      doc.font(c.key === 'status' ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(color).text(cells[c.key] || '', x + 4, y + 5, { width: c.w - 8 });
      x += c.w;
    });
    y += h;
  });

  if (!report.rows.length) {
    doc.font('Helvetica').fontSize(10).fillColor('#55527a').text('No registrations for this event.', left, y + 10);
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.font('Helvetica').fontSize(8).fillColor('#8a88a8').text('Page ' + (i + 1) + ' of ' + range.count, left, doc.page.height - 56, { width, align: 'center', lineBreak: false });
  }
  doc.end();
};

module.exports = { send };
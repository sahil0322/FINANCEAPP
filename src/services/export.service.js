import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { Transaction } from '../models/Transaction.model.js';
import { Account } from '../models/Account.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';

// ─────────────────────────────────────────────────────────────
// HELPER: fetch transactions for export based on filters
// Shared by both CSV and PDF export
// ─────────────────────────────────────────────────────────────
const getExportData = async (userId, { accountId, startDate, endDate }) => {
  const filter = { userId, status: 'success' };

  if (accountId) filter.accountId = accountId;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const [user, transactions] = await Promise.all([
    User.findById(userId).select('name email'),
    Transaction.find(filter)
      .sort({ createdAt: 1 }) // chronological order for statements
      .populate('accountId', 'bankName accountNumberLast4'),
  ]);

  if (!transactions.length) {
    throw new ApiError(404, 'No transactions found for the selected criteria.');
  }

  // Calculate summary totals
  const totalIncome = transactions
    .filter((t) => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  return { user, transactions, totalIncome, totalExpenses };
};

// ─────────────────────────────────────────────────────────────
// CSV EXPORT
// Returns a buffer/string — controller streams it to client
// ─────────────────────────────────────────────────────────────
export const generateCSV = async (userId, filters) => {
  const { transactions } = await getExportData(userId, filters);

  // Shape data for CSV — flatten nested account info
  const csvData = transactions.map((t) => ({
    Date: t.createdAt.toISOString().split('T')[0],
    Time: t.createdAt.toLocaleTimeString('en-IN'),
    Account: `${t.accountId.bankName} ••••${t.accountId.accountNumberLast4}`,
    Type: t.type.toUpperCase(),
    Category: t.category,
    Description: t.description || '-',
    Amount: t.amount,
    Status: t.status,
    Channel: t.channel,
  }));

  // json2csv Parser converts array of objects to CSV string
  // fields defines column order explicitly — don't rely on object key order
  const fields = [
    'Date', 'Time', 'Account', 'Type',
    'Category', 'Description', 'Amount', 'Status', 'Channel',
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(csvData);

  return csv;
};

// ─────────────────────────────────────────────────────────────
// PDF STATEMENT EXPORT
// Builds a PDF document using pdfkit, returns it as a stream
// ─────────────────────────────────────────────────────────────
export const generatePDFStatement = async (userId, filters, res) => {
  const { user, transactions, totalIncome, totalExpenses } =
    await getExportData(userId, filters);

  // Create PDF document — this is a readable stream
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Pipe directly to the HTTP response — no temp file written to disk
  // WHY this matters: at scale, writing temp files to disk creates
  // cleanup overhead and disk I/O bottlenecks. Piping is more efficient.
  doc.pipe(res);

  // ── Header ──
  doc
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('Account Statement', { align: 'center' });

  doc.moveDown(0.5);
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#666666')
    .text(`Generated on ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });

  doc.moveDown(1.5);

  // ── Account Holder Info ──
  doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold').text('Account Holder');
  doc.font('Helvetica').fontSize(10);
  doc.text(`Name: ${user.name}`);
  doc.text(`Email: ${user.email}`);

  const dateRange = filters.startDate && filters.endDate
    ? `${filters.startDate} to ${filters.endDate}`
    : 'All available transactions';
  doc.text(`Statement Period: ${dateRange}`);

  doc.moveDown(1);

  // ── Summary Box ──
  doc.font('Helvetica-Bold').fontSize(11).text('Summary');
  doc.font('Helvetica').fontSize(10);
  doc.text(`Total Income: Rs. ${totalIncome.toLocaleString('en-IN')}`);
  doc.text(`Total Expenses: Rs. ${totalExpenses.toLocaleString('en-IN')}`);
  doc.text(`Net: Rs. ${(totalIncome - totalExpenses).toLocaleString('en-IN')}`);

  doc.moveDown(1.5);

  // ── Transaction Table ──
  doc.font('Helvetica-Bold').fontSize(11).text('Transaction History');
  doc.moveDown(0.5);

  // Table column positions (x-coordinates)
  const tableTop = doc.y;
  const columns = {
    date: 50,
    type: 130,
    category: 190,
    description: 270,
    amount: 420,
    status: 500,
  };

  // Draw table header
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Date', columns.date, tableTop);
  doc.text('Type', columns.type, tableTop);
  doc.text('Category', columns.category, tableTop);
  doc.text('Description', columns.description, tableTop);
  doc.text('Amount', columns.amount, tableTop);
  doc.text('Status', columns.status, tableTop);

  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

  // Draw each transaction row
  // WHY manual page-break check? pdfkit doesn't auto-paginate tables —
  // we must check remaining space and add a new page ourselves
  let currentY = tableTop + 25;
  doc.font('Helvetica').fontSize(8);

  transactions.forEach((t) => {
    // If we're near the bottom of the page, start a new page
    if (currentY > 720) {
      doc.addPage();
      currentY = 50;
    }

    const amountText = `${t.type === 'credit' ? '+' : '-'}Rs.${t.amount.toLocaleString('en-IN')}`;
    const amountColor = t.type === 'credit' ? '#16a34a' : '#dc2626';

    doc.fillColor('#000000').text(
      t.createdAt.toISOString().split('T')[0],
      columns.date, currentY, { width: 75 }
    );
    doc.text(t.type.toUpperCase(), columns.type, currentY, { width: 55 });
    doc.text(t.category, columns.category, currentY, { width: 75 });
    doc.text(
      (t.description || '-').substring(0, 25),
      columns.description, currentY, { width: 145 }
    );
    doc.fillColor(amountColor).text(amountText, columns.amount, currentY, { width: 75 });
    doc.fillColor('#000000').text(t.status, columns.status, currentY, { width: 50 });

    currentY += 18;
  });

  // ── Footer ──
  doc.moveDown(2);
  doc
    .fontSize(8)
    .fillColor('#999999')
    .text(
      'This is a system-generated statement and does not require a signature.',
      50, currentY + 20, { align: 'center', width: 500 }
    );

  // Finalize the PDF — this triggers the stream to flush and end
  doc.end();
};
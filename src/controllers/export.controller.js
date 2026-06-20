import { asyncHandler } from '../utils/asyncHandler.js';
import * as exportService from '../services/export.service.js';

export const exportCSV = asyncHandler(async (req, res) => {
  const csv = await exportService.generateCSV(req.user._id, req.query);

  // Set headers to trigger browser file download
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="statement_${Date.now()}.csv"`
  );

  return res.status(200).send(csv);
});

export const exportPDF = asyncHandler(async (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="statement_${Date.now()}.pdf"`
  );

  // Note: generatePDFStatement pipes directly to res — no return value
  // The response is handled inside the service via doc.pipe(res)
  await exportService.generatePDFStatement(req.user._id, req.query, res);
});
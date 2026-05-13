/**
 * POST /api/onedrive/save-report
 *
 * Generates a CSV receive report and saves it to OneDrive.
 *
 * Request body:
 * {
 *   reference: string,
 *   receivedBy: string,
 *   locationName: string,
 *   items: [
 *     {
 *       name: string,
 *       orderedQty: number,
 *       receivedQty: number,
 *       unit: string,
 *       note: string       // optional
 *     }
 *   ]
 * }
 *
 * Response:
 * { success: true, filename: string, webUrl: string }
 */

import { saveFile, buildReceiveCsv } from '../../../lib/onedrive';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // If OneDrive is not configured, skip gracefully
  if (!process.env.ONEDRIVE_CLIENT_ID || !process.env.ONEDRIVE_CLIENT_SECRET) {
    console.warn('[save-report] OneDrive env vars not set — skipping upload');
    return res.status(200).json({
      success: true,
      skipped: true,
      reason: 'OneDrive not configured — add ONEDRIVE_CLIENT_ID and ONEDRIVE_CLIENT_SECRET in Vercel',
    });
  }

  const { reference, receivedBy, locationName, items } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }

  // Build a filename: "Receive_YYYY-MM-DD_HHmm.csv"
  const now = new Date();
  const yymmdd = now.toISOString().slice(0, 10);
  const hhmm = now.toTimeString().slice(0, 5).replace(':', '');
  const filename = `Receive_${yymmdd}_${hhmm}.csv`;

  try {
    const csv = buildReceiveCsv({ reference, receivedBy, locationName, items });

    const { webUrl } = await saveFile(filename, csv, 'text/csv');

    return res.status(200).json({ success: true, filename, webUrl });
  } catch (err) {
    console.error('[save-report]', err.message);
    // Return 200 with error detail so the UI can show a warning rather than
    // blocking a successful stock receive.
    return res.status(200).json({
      success: false,
      skipped: true,
      reason: err.message,
    });
  }
}

/**
 * POST /api/square/receive-inventory
 *
 * Receives stock into Square Inventory using ADJUSTMENT changes.
 * Supports partial receives — caller sends only items with qty > 0.
 *
 * Request body:
 * {
 *   locationId: string,
 *   items: [
 *     {
 *       catalogObjectId: string,   // variation ID
 *       quantity: number,          // units received (may be decimal for nips→bottles)
 *       name: string,              // for logging only
 *       unit: string               // 'EACH' | 'nip' | etc.
 *     }
 *   ],
 *   reference: string              // e.g. "Receive 2025-05-10 PO#42"
 * }
 *
 * Response:
 * { success: true, changes: [...squareResponseChanges] }
 */

import { randomUUID } from 'crypto';

const SQUARE_BASE =
  process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

async function squarePost(path, body) {
  const res = await fetch(`${SQUARE_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      'Square-Version': '2024-10-17',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok || data.errors?.length) {
    const msg = data.errors?.[0]?.detail ?? `Square error ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { locationId, items, reference } = req.body ?? {};

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'items array required' });

  const validItems = items.filter(
    (it) => it.catalogObjectId && Number(it.quantity) > 0
  );

  if (validItems.length === 0)
    return res.status(400).json({ error: 'No items with quantity > 0' });

  // ── Build Square inventory changes ──────────────────────────────────────────
  const occurredAt = new Date().toISOString();
  const idempotencyKey = randomUUID();

  const changes = validItems.map((item) => ({
    type: 'ADJUSTMENT',
    adjustment: {
      // NONE → IN_STOCK is the standard "receive from supplier" pattern
      from_state: 'NONE',
      to_state: 'IN_STOCK',
      catalog_object_id: item.catalogObjectId,
      location_id: locationId,
      // Square quantity must be a string-formatted decimal
      quantity: String(Number(item.quantity).toFixed(4)),
      occurred_at: occurredAt,
      reference_no: reference ?? 'Paynter Bar Hub Receive',
    },
  }));

  try {
    const data = await squarePost('/v2/inventory/changes/batch-create', {
      idempotency_key: idempotencyKey,
      changes,
    });

    return res.status(200).json({
      success: true,
      changes: data.changes ?? [],
      counts: data.counts ?? [],
    });
  } catch (err) {
    console.error('[receive-inventory]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

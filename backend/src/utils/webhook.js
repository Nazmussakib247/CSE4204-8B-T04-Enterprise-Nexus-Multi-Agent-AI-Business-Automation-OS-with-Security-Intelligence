/**
 * n8n Webhook Notifier
 * Fire-and-forget POSTs to n8n webhook URLs.
 * Never blocks the main request — errors are only logged.
 */

const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || ''; // e.g. https://your-n8n.app.n8n.cloud/webhook
const N8N_SECRET   = process.env.N8N_SECRET || 'nexus-n8n-secret';

/**
 * notifyN8n(path, payload)
 * path  — webhook path, e.g. 'hr-report'
 * payload — JSON body
 */
async function notifyN8n(path, payload) {
  if (!N8N_BASE_URL) {
    // n8n not configured — skip silently
    return;
  }

  const url = `${N8N_BASE_URL}/${path}`;

  // Fire and forget — we don't await this
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nexus-secret': N8N_SECRET,
    },
    body: JSON.stringify(payload),
  }).catch(err => {
    console.warn(`[n8n] Webhook to ${url} failed:`, err.message);
  });
}

module.exports = { notifyN8n };

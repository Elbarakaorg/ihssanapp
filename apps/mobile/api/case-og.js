// Serves link-preview tags (WhatsApp, Facebook, Telegram, X, iMessage…) for a case page. Crawlers do not run JavaScript,
// so vercel.json routes their requests for /cases/<id-or-name> here; people get the normal app.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clip = (value, max) => { const text = String(value ?? '').replace(/\s+/g, ' ').trim(); return text.length > max ? `${text.slice(0, max - 1)}…` : text; };
const mad = (n) => `${Number(n || 0).toLocaleString('en-US')} MAD`;

module.exports = async function handler(req, res) {
  const key = String(req.query.key || '').trim().slice(0, 120);
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const pageUrl = `${origin}/cases/${encodeURIComponent(key)}`;
  let item = null;
  try {
    if (key && base && anon) {
      const fn = UUID.test(key) ? 'get_donation_case' : 'get_donation_case_by_slug';
      const body = UUID.test(key) ? { p_id: key } : { p_slug: key.toLowerCase() };
      const response = await fetch(`${base}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (response.ok) item = await response.json();
    }
  } catch { item = null; }

  const found = item && item.title && ['published', 'funded', 'closed'].includes(item.status);
  const title = found ? `${item.title} | Ihssan` : 'Ihssan — give with purpose';
  const percent = found && item.goal_mad ? Math.min(100, Math.round((item.raised_mad / item.goal_mad) * 100)) : 0;
  const description = found
    ? clip(`${mad(item.raised_mad)} raised of ${mad(item.goal_mad)} (${percent}%). ${item.bio || item.summary || ''}`, 200)
    : 'Verified cases. Your gift goes straight to the family’s own bank account.';
  const image = found && item.photo_path && base ? `${base}/storage/v1/object/public/case-media/${item.photo_path.split('/').map(encodeURIComponent).join('/')}` : null;

  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(pageUrl)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Ihssan">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(pageUrl)}">`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    image ? `<meta property="og:image" content="${esc(image)}"><meta name="twitter:image" content="${esc(image)}">` : '',
  ].join('\n');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  res.status(found ? 200 : 404).send(`<!doctype html><html lang="en"><head><meta charset="utf-8">${tags}</head><body><p><a href="${esc(pageUrl)}">${esc(title)}</a></p></body></html>`);
};

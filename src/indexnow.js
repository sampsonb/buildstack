// IndexNow (SEO item 7). The key is public by design: search engines fetch /<key>.txt from this
// host to confirm a submission came from the site owner. It is not a secret and grants no access.
// Submit with: node scripts/indexnow.mjs (dry run) or node scripts/indexnow.mjs --send [--since YYYY-MM-DD]
export const INDEXNOW_KEY = '18e580b66d52237e5be90522f30a3160'
export const INDEXNOW_HOST = 'buildstack.tier11.com'
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
export const INDEXNOW_MAX = 10000

// Parse <loc> and <lastmod> pairs out of our own sitemap.xml.
export function sitemapEntries(xml) {
  const out = []
  const re = /<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g
  let m
  while ((m = re.exec(String(xml)))) out.push({ loc: m[1], lastmod: m[2] || '' })
  return out
}

// Build the IndexNow JSON body. Only URLs on our own host are allowed, and with `since`
// only pages whose sitemap lastmod is on or after that date are sent (honest change pings).
export function buildPayload(entries, { since = '' } = {}) {
  const prefix = `https://${INDEXNOW_HOST}/`
  const seen = new Set()
  const urlList = []
  for (const e of entries) {
    const loc = typeof e === 'string' ? e : e.loc
    const lastmod = typeof e === 'string' ? '' : (e.lastmod || '')
    if (!loc || !(loc === `https://${INDEXNOW_HOST}` || loc.startsWith(prefix))) continue
    if (since && !(lastmod && lastmod >= since)) continue
    if (seen.has(loc)) continue
    seen.add(loc)
    urlList.push(loc)
  }
  return {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
    urlList: urlList.slice(0, INDEXNOW_MAX),
  }
}

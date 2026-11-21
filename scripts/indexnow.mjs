// Ping IndexNow (Bing, Yandex, Seznam, Naver and others share submissions) with BuildStack URLs
// from the live sitemap. Dry run by default; add --send to POST. --since YYYY-MM-DD sends only
// pages whose sitemap lastmod is on or after that date.
import { INDEXNOW_ENDPOINT, INDEXNOW_HOST, buildPayload, sitemapEntries } from '../src/indexnow.js'

const args = process.argv.slice(2)
const send = args.includes('--send')
const i = args.indexOf('--since')
const since = i >= 0 ? args[i + 1] : ''
if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error('--since must be YYYY-MM-DD')

const res = await fetch(`https://${INDEXNOW_HOST}/sitemap.xml`)
if (!res.ok) throw new Error(`sitemap ${res.status}`)
const payload = buildPayload(sitemapEntries(await res.text()), { since })
const key = await fetch(payload.keyLocation)
const keyText = (await key.text()).trim()
if (!key.ok || keyText !== payload.key) throw new Error(`key file check failed (${key.status})`)
console.log(`urls ${payload.urlList.length}${since ? ` since ${since}` : ''}; key file ok`)
if (!send) { console.log('dry run; add --send to submit'); process.exit(0) }
if (!payload.urlList.length) { console.log('nothing to send'); process.exit(0) }
const r = await fetch(INDEXNOW_ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
})
console.log(`IndexNow ${r.status} ${r.statusText}`)
if (r.status !== 200 && r.status !== 202) process.exit(1)

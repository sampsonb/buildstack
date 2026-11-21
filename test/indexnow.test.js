import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { INDEXNOW_KEY, INDEXNOW_HOST, INDEXNOW_ENDPOINT, buildPayload, sitemapEntries } from '../src/indexnow.js'

const app = (await import('../src/index.js')).default

test('IndexNow key is a valid key and its file is served as plain text from the site root', async () => {
  assert.match(INDEXNOW_KEY, /^[a-f0-9]{32}$/)
  const r = await app.request(`http://local/${INDEXNOW_KEY}.txt`)
  assert.equal(r.status, 200)
  assert.match(r.headers.get('content-type') || '', /^text\/plain/)
  assert.equal((await r.text()).trim(), INDEXNOW_KEY)
  assert.equal((await app.request('http://local/00000000000000000000000000000000.txt')).status, 404)
})

test('IndexNow payload uses the sitemap, our host only, and the key location', async () => {
  const xml = await (await app.request('http://local/sitemap.xml')).text()
  const entries = sitemapEntries(xml)
  assert.ok(entries.length > 200)
  assert.equal(entries.length, (xml.match(/<url>/g) || []).length)
  assert.ok(entries.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.lastmod)))
  const p = buildPayload([...entries, { loc: 'https://evil.example/x', lastmod: '2026-11-21' }, entries[0]])
  assert.equal(p.host, INDEXNOW_HOST)
  assert.equal(p.key, INDEXNOW_KEY)
  assert.equal(p.keyLocation, `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`)
  assert.equal(p.urlList.length, entries.length)
  assert.ok(p.urlList.every((u) => u.startsWith(`https://${INDEXNOW_HOST}`)))
  assert.equal(INDEXNOW_ENDPOINT, 'https://api.indexnow.org/indexnow')
})

test('IndexNow --since sends only pages whose lastmod is on or after the date', async () => {
  const entries = [
    { loc: `https://${INDEXNOW_HOST}/a`, lastmod: '2026-11-20' },
    { loc: `https://${INDEXNOW_HOST}/b`, lastmod: '2026-11-21' },
    { loc: `https://${INDEXNOW_HOST}/c`, lastmod: '' },
  ]
  assert.deepEqual(buildPayload(entries, { since: '2026-11-21' }).urlList, [`https://${INDEXNOW_HOST}/b`])
  const xml = await (await app.request('http://local/sitemap.xml')).text()
  const today = buildPayload(sitemapEntries(xml), { since: '2026-11-21' }).urlList
  for (const s of ['semantic-scholar', 'scite', 'undermind', 'genie-4', 'inkling-2-mini']) assert.ok(today.includes(`https://${INDEXNOW_HOST}/tool/${s}`), s)
  assert.ok(today.includes(`https://${INDEXNOW_HOST}/best/ai-research-assistant`))
})

test('IndexNow script is a dry run unless --send is passed', () => {
  const src = readFileSync(new URL('../scripts/indexnow.mjs', import.meta.url), 'utf8')
  assert.ok(src.includes("args.includes('--send')"))
  assert.ok(src.includes('dry run'))
  assert.ok(!src.includes('\u2014'))
})

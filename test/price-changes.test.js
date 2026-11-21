import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const app = (await import('../src/index.js')).default
const get = async (p) => { const r = await app.request(`http://local${p}`); return { status: r.status, text: await r.text() } }

test('price changes page lists dated entries with old, new and official source', async () => {
  const { status, text } = await get('/price-changes')
  assert.equal(status, 200)
  assert.match(text, /<h1>AI Price Changes Log<\/h1>/)
  assert.match(text, /Edited by <a href="\/about">Sampson Brueher<\/a>/)
  assert.match(text, /<tr id="deepseek-2026-11-18"><td><a href="\/price-changes\/deepseek-2026-11-18">2026-11-18<\/a><\/td><td><a href="\/tool\/deepseek">DeepSeek<\/a>/)
  assert.ok(text.includes('$0.75 per 1,000 searches and $0.75 per 1,000 fetches'))
  assert.ok(text.includes('href="https://api-docs.deepseek.com/quick_start/pricing/"'))
  assert.ok(text.includes('href="https://web.archive.org/web/20261116200941/https://api-docs.deepseek.com/quick_start/pricing/"'))
  assert.ok(!text.includes('\u2014'), 'no em dash')
  const ld = [...text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
  const art = ld.flatMap((x) => x['@graph'] || [x]).find((x) => x['@type'] === 'Article')
  assert.equal(art.author.name, 'Sampson Brueher')
  assert.equal(art.dateModified, '2026-11-21')
})

test('every logged change points at a listed tool and an official https source, with no future dates', () => {
  const block = src.slice(src.indexOf('const PRICE_CHANGES = ['), src.indexOf('const PRICE_RECHECK'))
  const slugs = [...block.matchAll(/slug: '([^']+)'/g)].map((m) => m[1])
  const dates = [...block.matchAll(/date: '(\d{4}-\d{2}-\d{2})'/g)].map((m) => m[1])
  assert.ok(slugs.length >= 1 && slugs.length === dates.length)
  for (const s of slugs) assert.ok(tools.some((t) => t.slug === s), s)
  for (const d of dates) assert.ok(d <= '2026-11-20', d)
  for (const m of block.matchAll(/source: '([^']+)'/g)) assert.match(m[1], /^https:\/\//)
})

test('price changes page is in the sitemap with its own date, llms files, home, methodology and tool page', async () => {
  const sm = (await get('/sitemap.xml')).text
  assert.match(sm, /<loc>https:\/\/buildstack\.tier11\.com\/price-changes<\/loc><lastmod>2026-11-21<\/lastmod>/)
  assert.ok((await get('/llms.txt')).text.includes('https://buildstack.tier11.com/price-changes'))
  assert.ok((await get('/llms-full.txt')).text.includes('2026-11-18, DeepSeek:'))
  assert.ok((await get('/')).text.includes('href="/price-changes"'))
  assert.ok((await get('/methodology')).text.includes('href="/price-changes"'))
  assert.ok((await get('/tool/deepseek')).text.includes('href="/price-changes/deepseek-2026-11-18"'))
  assert.ok(!(await get('/tool/cursor')).text.includes('Price changes:'))
})

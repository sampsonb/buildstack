import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// SEO item 5 part 2 (2026-11-19): "X alternatives" pages. Alternatives must be the same-category
// tools from tools.json in rank order, with the editor byline, Article + ItemList + FAQ + breadcrumb
// JSON-LD, no em dash, and links from the sitemap, llms.txt, the hub, and the tool page.
const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const bySlug = Object.fromEntries(tools.map((t) => [t.slug, t]))

async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}
function ld(html) {
  return JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
}

test('hub lists every alternatives page and each page lists same-category tools in rank order', async () => {
  const { status, html } = await get('/alternatives')
  assert.equal(status, 200)
  assert.ok(html.includes('href="/alternatives/cursor"'))
  const paths = [...new Set([...html.matchAll(/href="(\/alternatives\/[a-z0-9-]+)"/g)].map((m) => m[1]))].filter((p) => p !== '/alternatives/cursor')
  assert.ok(paths.length >= 8, String(paths.length))
  for (const p of paths) {
    const slug = p.slice(14)
    const t = bySlug[slug]
    assert.ok(t, slug)
    const page = await get(p)
    assert.equal(page.status, 200, p)
    assert.match(page.html, /Edited by <a href="\/about">Sampson Brueher<\/a>/, p)
    assert.ok(!page.html.includes('\u2014'), p)
    const g = ld(page.html)['@graph']
    assert.equal(g[0]['@type'], 'Article', p)
    assert.equal(g[0].author['@id'], 'https://buildstack.tier11.com/about#sampson', p)
    assert.ok(g.some((n) => n['@type'] === 'FAQPage'), p)
    assert.ok(g.some((n) => n['@type'] === 'BreadcrumbList'), p)
    const list = g.find((n) => n['@type'] === 'ItemList').itemListElement.map((x) => x.url.split('/tool/')[1])
    const expected = tools.filter((x) => x.category === t.category && x.slug !== slug).sort((a, b) => a.rank - b.rank).slice(0, 10).map((x) => x.slug)
    assert.deepEqual(list, expected, p)
    const dates = [t, ...expected.map((s) => bySlug[s])].flatMap((x) => [x.updated, x.priceChecked]).filter(Boolean).concat('2026-11-19')
    assert.equal(g[0].dateModified, dates.sort().at(-1), p)
  }
})

test('unknown alternatives page 404s, cursor guide unchanged', async () => {
  assert.equal((await get('/alternatives/not-a-tool')).status, 404)
  assert.match((await get('/alternatives/cursor')).html, /Sorted by How You Code/)
})

test('alternatives pages are in the sitemap, llms.txt, and linked from tool pages', async () => {
  const sm = (await get('/sitemap.xml')).html
  assert.match(sm, /\/alternatives<\/loc>/)
  assert.match(sm, /\/alternatives\/chatgpt<\/loc>/)
  const llms = (await get('/llms.txt')).html
  assert.match(llms, /## Alternatives pages/)
  assert.match(llms, /\/alternatives\/midjourney/)
  assert.match((await get('/tool/chatgpt')).html, /href="\/alternatives\/chatgpt"/)
  assert.match((await get('/category/writing')).html, /href="\/alternatives\/claude"/)
})

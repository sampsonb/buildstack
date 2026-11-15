import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Phase 3 redesign: the results page is the answer (no New, Top ranked, or Featured repeats),
// the home page is shorter (compact lists, folded FAQ) with nothing lost, and tool pages drop
// the "Price." line that the price tag now shows.
const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const byRank = [...tools].sort((a, b) => a.rank - b.rank)
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}
const ldOf = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
const nodes = (ld) => ld.flatMap((x) => x['@graph'] || [x])

test('results page: the answer only, no New, Top ranked, or Featured repeats', async () => {
  for (const q of ['write blog posts', 'edit a podcast', 'build an app']) {
    const { status, html } = await get(`/?q=${encodeURIComponent(q)}`)
    assert.equal(status, 200)
    assert.ok(html.includes('Best fit for'), q)
    assert.equal(html.includes('id="new"'), false, q)
    assert.equal(html.includes('<h2>Top ranked</h2>'), false, q)
    assert.equal(html.includes('<h2>Featured</h2>'), false, q)
    assert.ok(html.includes('id="best-for"'), q)
    assert.ok(html.includes('data-source="home"'), `${q}: newsletter kept`)
  }
})

test('home: New lists every new tool newest first, first 6 open, rest behind Show all', async () => {
  const data = (JSON.parse((await get('/tools.json')).html).tools)
  const fresh = data.filter((t) => t.newRelease).sort((a, b) => (b.added > a.added ? 1 : b.added < a.added ? -1 : a.rank - b.rank))
  const { html } = await get('/')
  const start = html.indexOf('id="new"')
  const sec = html.slice(start, html.indexOf('</section>', start))
  const slugs = [...sec.matchAll(/<h3><a href="\/tool\/([^"]+)">/g)].map((m) => m[1])
  assert.deepEqual(slugs, fresh.map((t) => t.slug))
  const [open, rest] = sec.split('<details class="more">')
  assert.equal((open.match(/<li>/g) || []).length, Math.min(6, fresh.length))
  if (fresh.length > 6) assert.match(rest, new RegExp(`<summary>Show all ${fresh.length} new tools</summary>`))
  for (const t of fresh) assert.ok(sec.includes(`Added ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(t.added.slice(5, 7)) - 1]} ${Number(t.added.slice(8))}, ${t.added.slice(0, 4)}`), t.slug)
})

test('home: no full cards, every guide and category still linked, top 12 linked in rank order', async () => {
  const { html } = await get('/')
  assert.equal(html.includes('<article class="card">'), false)
  const sm = (await get('/sitemap.xml')).html
  const guides = [...sm.matchAll(/<loc>https:\/\/buildstack\.tier11\.com(\/(?:best|alternatives|guides)\/[^<]+)<\/loc>/g)].map((m) => m[1])
  assert.ok(guides.length >= 14)
  for (const g of guides) assert.ok(html.includes(`href="${g}"`), g)
  for (const c of new Set(tools.map((t) => t.category))) assert.ok(html.includes(`href="/category/${c}"`), c)
  for (const t of byRank.slice(0, 12)) assert.ok(html.includes(`href="/tool/${t.slug}"`), t.slug)
})

test('home FAQ: folded, and every FAQPage question and answer is still in the HTML', async () => {
  const { html } = await get('/')
  const faq = nodes(ldOf(html)).find((n) => n['@type'] === 'FAQPage')
  assert.ok(faq && faq.mainEntity.length >= 4)
  const sec = html.slice(html.indexOf('id="faq"'), html.indexOf('</section>', html.indexOf('id="faq"')))
  const rows = [...sec.matchAll(/<details><summary><h3>([^<]*)<\/h3><\/summary>\s*<p>([^<]*)<\/p><\/details>/g)].map((m) => [unesc(m[1]), unesc(m[2])])
  assert.deepEqual(rows, faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]))
})

test('tool pages: Price line gone, pricing note shown once (in the price box) and still matches JSON-LD', async () => {
  for (const t of tools) {
    const { html } = await get(`/tool/${t.slug}`)
    assert.equal(html.includes('<strong>Price.</strong>'), false, t.slug)
    const visible = unesc(html.slice(html.indexOf('<body>')).replace(/<script[\s\S]*?<\/script>/g, ''))
    const note = t.pricingNote.replace(/[\s.]+$/, '')
    assert.equal(visible.split(note).length - 1, 1, `${t.slug}: pricing note visible once`)
    const ldText = JSON.stringify(ldOf(html))
    assert.ok(ldText.includes(JSON.stringify(t.pricingNote).slice(1, -1)), `${t.slug}: pricing note in JSON-LD`)
    assert.ok(html.includes('class="shelfedge big"'), t.slug)
  }
})

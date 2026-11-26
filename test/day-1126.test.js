import assert from 'node:assert/strict'
import { test } from 'node:test'
import tools from '../src/tools.json' with { type: 'json' }

const by = Object.fromEntries(tools.map((t) => [t.slug, t]))
async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const free = (t) => (typeof t.freePlan === 'boolean' ? t.freePlan : t.freeTier === true)
const CAT_LISTS = [
  ['coding', 'free-ai-coding-tools'], ['writing', 'free-ai-writing-tools'], ['images', 'free-ai-image-tools'],
  ['video', 'free-ai-video-tools'], ['agents', 'free-ai-agents'], ['research', 'free-ai-research-tools'], ['voice', 'free-ai-voice-tools'],
]

test('Nov 26 coding coverage adds are checked, placed below the top 30, and never read affiliate', () => {
  assert.equal(by.base44.rank, by.netlify.rank + 1)
  assert.equal(by.amp.rank, by.aider.rank + 1)
  assert.equal(by.factory.rank, by.amp.rank + 1)
  for (const s of ['base44', 'amp', 'factory']) {
    assert.equal(by[s].category, 'coding', s)
    assert.equal(by[s].added, '2026-11-26', s)
    assert.equal(by[s].priceChecked, '2026-11-26', s)
    assert.ok(by[s].pricingUrl.startsWith('https://'), s)
    assert.equal(by[s].affiliate, false, s)
    assert.equal(by[s].featured, false, s)
    assert.ok(by[s].rank > 30, s)
  }
  assert.ok(tools.every((t, i) => t.rank === i + 1))
  assert.ok(!/[\u2013\u2014]/.test(JSON.stringify(tools)))
})

test('Deepgram note names the streaming promo and keeps the regular rates', () => {
  assert.match(by.deepgram.pricingNote, /\$0\.0077 per minute streaming at the regular rate/)
  assert.match(by.deepgram.pricingNote, /promo price of \$0\.0048 per minute \(\$0\.0058 multilingual\)/)
  assert.equal(by.deepgram.priceChecked, '2026-11-26')
})

test('free-plan price lists by category: checked tools only, one category, rank order, capped at 15', async () => {
  for (const [cat, slug] of CAT_LISTS) {
    const { status, html } = await get(`/pricing/${slug}`)
    assert.equal(status, 200, slug)
    const rows = [...html.matchAll(/<tr><td>#(\d+)<\/td><td><a href="\/tool\/([a-z0-9-]+)"/g)].map((m) => m[2])
    const expected = tools.filter((t) => t.category === cat && t.priceChecked && t.pricingUrl && free(t)).sort((a, b) => a.rank - b.rank).map((t) => t.slug).slice(0, 15)
    assert.ok(rows.length >= 5, slug)
    assert.deepEqual(rows, expected, slug)
    assert.match(html, /<title>AI [^<]+ with a free plan: prices checked/, slug)
    assert.ok(!/\u2014/.test(text(html)), slug)
    assert.ok(!/Featured/.test(text(html)), slug)
  }
})

test('hub, home, category pages, sitemap, and llms.txt link the new lists', async () => {
  const hub = (await get('/pricing')).html
  assert.ok(hub.includes('id="by-category"'))
  for (const [cat, slug] of CAT_LISTS) {
    assert.ok(hub.includes(`href="/pricing/${slug}"`), slug)
    const c = (await get(`/category/${cat}`)).html
    assert.ok(c.includes(`href="/pricing/${slug}"`), cat)
  }
  const home = (await get('/')).html
  assert.ok(home.includes('href="/pricing#by-category"'))
  assert.ok(home.includes('href="/pricing/free-plan"'))
  assert.ok(!home.includes('href="/pricing/free-ai-coding-tools"'))
  const sm = (await get('/sitemap.xml')).html
  for (const [, slug] of CAT_LISTS) assert.ok(sm.includes(`/pricing/${slug}</loc>`), slug)
  const llms = (await get('/llms.txt')).html
  assert.ok(llms.includes('/pricing/free-ai-voice-tools'))
  const pc = (await get('/price-changes')).html
  assert.ok(pc.includes('href="/pricing#by-category"'))
  assert.equal((await get('/pricing/free-ai-nothing')).status, 404)
})

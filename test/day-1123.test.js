import assert from 'node:assert/strict'
import { test } from 'node:test'
import tools from '../src/tools.json' with { type: 'json' }

const by = Object.fromEntries(tools.map((t) => [t.slug, t]))
async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}

test('voice adds: Read AI, Rev, Cartesia are checked, honest and in voice', () => {
  for (const s of ['read-ai', 'rev', 'cartesia']) {
    const t = by[s]
    assert.ok(t, s)
    assert.equal(t.category, 'voice')
    assert.equal(t.priceChecked, '2026-11-23')
    assert.match(t.pricingUrl, /^https:\/\//)
    assert.equal(t.affiliate, false)
  }
  assert.equal(by['read-ai'].rank, by.tldv.rank + 1)
  assert.equal(by.rev.rank, by.notta.rank + 1)
  assert.equal(by.cartesia.rank, by.deepgram.rank + 1)
})

test('Netlify: coding, after Junie (still rolling out), free plan, checked prices', () => {
  const t = by.netlify
  assert.ok(t)
  assert.equal(t.category, 'coding')
  assert.equal(t.rank, by.junie.rank + 1)
  assert.equal(t.freeTier, true)
  assert.equal(t.pricingUrl, 'https://www.netlify.com/pricing/')
  assert.match(t.pricingNote, /Personal \$9 a month .*Pro \$20 a month/)
})

test('price corrections: Topaz Studio yearly and OpenBot for Business', () => {
  assert.match(by['topaz-labs'].pricingNote, /\$69 a month or \$499 a year \(\$299 for the first year/)
  assert.ok(!by['topaz-labs'].pricingNote.includes('$399'))
  assert.match(by.openbot.pricingNote, /up to \$29 per active user a month/)
})

test('vs pages with a smaller tool lead with a dated price table', async () => {
  const { status, html } = await get('/vs/otter-vs-fireflies')
  assert.equal(status, 200)
  const d = by.otter.priceChecked < by.fireflies.priceChecked ? by.otter.priceChecked : by.fireflies.priceChecked
  assert.match(html, /<title>Otter\.ai vs Fireflies\.ai Pricing, Checked [A-Z][a-z]{2} \d{1,2}, 2026: Free Plans, Starting Prices/)
  assert.ok(html.indexOf('id="prices"') > 0)
  assert.ok(html.indexOf('id="prices"') < html.indexOf('at a glance'))
  assert.ok(html.includes(by.otter.pricingUrl) && html.includes(by.fireflies.pricingUrl))
  assert.ok(html.includes(by.otter.priceFrom) && html.includes(by.fireflies.priceFrom))
  assert.ok(d)
  assert.ok(!html.includes('\u2014'))
})

test('a pair with an unchecked tool shows the table but keeps the old title', async () => {
  const { html } = await get('/vs/runway-vs-kling')
  assert.ok(html.includes('id="prices"'))
  assert.ok(html.includes('Not yet checked'))
  assert.match(html, /<title>Runway vs Kling[^<]*\(2026\): Ranks, Pricing, Which to Pick/)
})

test('giant vs giant pages have no price table', async () => {
  const { html } = await get('/vs/chatgpt-vs-claude')
  assert.ok(!html.includes('id="prices"'))
})

test('price re-check of Nov 23 is reflected on the log', async () => {
  const { html } = await get('/price-changes')
  assert.ok(html.includes('Nov 23, 2026'))
})

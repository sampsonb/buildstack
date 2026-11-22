import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const tools = JSON.parse(readFileSync(new URL('../data/tools.json', import.meta.url), 'utf8'))
const by = Object.fromEntries(tools.map((t) => [t.slug, t]))
const app = (await import('../src/index.js')).default
async function get(path) {
  const r = await app.request(`http://local${path}`)
  return { status: r.status, html: await r.text() }
}
const LISTS = ['/pricing/free-plan', '/pricing/up-to-10-a-month', '/pricing/up-to-20-a-month']

test('2026-11-22 video coverage adds: VEED, Captions, D-ID with checked prices and honest flags', () => {
  assert.equal(tools.length, 201)
  assert.ok(tools.every((t, i) => t.rank === i + 1))
  for (const [slug, url, free] of [['veed', 'https://www.veed.io/pricing', true], ['captions', 'https://www.captions.ai/pricing', true], ['d-id', 'https://www.d-id.com/pricing/studio/', false]]) {
    const t = by[slug]
    assert.ok(t, slug)
    assert.equal(t.category, 'video')
    assert.equal(t.added, '2026-11-22')
    assert.equal(t.pricingUrl, url)
    assert.equal(t.priceChecked, '2026-11-22')
    assert.equal(t.freeTier, free)
    assert.equal(t.affiliate, false)
    assert.equal(t.featured, false)
  }
  assert.equal(by.invideo.rank, by.descript.rank + 1)
  assert.equal(by.veed.rank, by.invideo.rank + 1)
  assert.equal(by.captions.rank, by.opusclip.rank + 1)
  assert.equal(by['d-id'].rank, by.synthesia.rank + 1)
})

test('2026-11-22 note corrections: Otter Business yearly and Kino Editor plan', () => {
  assert.match(by.otter.pricingNote, /Business \$30 per user a month billed monthly or \$19\.99 billed yearly/)
  assert.equal(by.otter.priceChecked, '2026-11-22')
  assert.match(by.kino.pricingNote, /Editor is \$25 per editor a month, or \$20 a month billed yearly \(\$240 a year\)/)
  assert.equal(by.kino.priceChecked, '2026-11-22')
})

test('Muse from Meta: agents, free with usage limit, no unverified pricing link', () => {
  const t = by['muse-from-meta']
  assert.ok(t)
  assert.equal(t.category, 'agents')
  assert.equal(t.rank, by.genspark.rank + 1)
  assert.equal(t.freeTier, true)
  assert.equal(t.priceFrom, 'Free')
  assert.equal(t.pricingUrl, undefined)
  assert.equal(t.priceChecked, undefined)
  assert.match(t.pricingNote, /Power plan \$20 a month .*Maximum plan \$100 a month/)
})

test('price lists: checked tools only, rank order, capped at 15, filters hold', async () => {
  for (const p of LISTS) {
    const { status, html } = await get(p)
    assert.equal(status, 200, p)
    assert.ok(!/[\u2013\u2014]/.test(html), p)
    assert.ok(html.includes('"@type":"ItemList"'), p)
    assert.ok(html.includes('id="newsletter"') && html.includes('/price-changes/rss.xml'), p)
    const slugs = [...html.matchAll(/<tr><td>#(\d+)<\/td><td><a href="\/tool\/([^"]+)">/g)].map((m) => [Number(m[1]), m[2]])
    assert.ok(slugs.length >= 3 && slugs.length <= 15, `${p} ${slugs.length}`)
    for (let i = 1; i < slugs.length; i++) assert.ok(slugs[i][0] > slugs[i - 1][0], p)
    for (const [rank, slug] of slugs) {
      const t = by[slug]
      assert.equal(t.rank, rank)
      assert.ok(t.priceChecked && t.pricingUrl, slug)
      const m = /^from \$(\d+(?:\.\d+)?)\/mo$/.exec(t.priceFrom)
      if (p.endsWith('free-plan')) assert.ok(typeof t.freePlan === 'boolean' ? t.freePlan : t.freeTier === true, slug)
      if (p.endsWith('10-a-month')) assert.ok(m && Number(m[1]) <= 10, slug)
      if (p.endsWith('20-a-month')) assert.ok(m && Number(m[1]) <= 20, slug)
    }
    assert.match(html, /<title>[^<]*prices checked [A-Z][a-z]{2} \d{1,2}, 2026 \| BuildStack<\/title>/)
  }
  assert.equal((await get('/pricing/nope')).status, 404)
  const hub = await get('/pricing')
  assert.equal(hub.status, 200)
  for (const p of LISTS) assert.ok(hub.html.includes(`href="${p}"`))
})

test('price lists are linked from sitemap, home, price log and llms.txt; re-check is dated today', async () => {
  const sitemap = (await get('/sitemap.xml')).html
  for (const p of ['/pricing', ...LISTS]) assert.ok(sitemap.includes(`<loc>https://buildstack.tier11.com${p}</loc>`), p)
  const home = (await get('/')).html
  const log = (await get('/price-changes')).html
  const llms = (await get('/llms.txt')).html
  for (const p of LISTS) {
    assert.ok(home.includes(`href="${p}"`), p)
    assert.ok(log.includes(`href="${p}"`), p)
    assert.ok(llms.includes(`https://buildstack.tier11.com${p}`), p)
  }
  assert.ok(log.includes('Nov 22, 2026 we compared the prices in our notes with 55 official pricing pages'))
  assert.ok(llms.includes('Tools: 201'))
})

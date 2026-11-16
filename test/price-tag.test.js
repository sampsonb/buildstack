import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools } from '../src/search.js'

// Phase 2 redesign: price tags on search results and tool pages. The tag shows only what the
// data has: priceFrom, freeTier, priceChecked, pricingUrl. A checked date gets a solid panel;
// no date gets the dashed "Price not yet checked" panel.
const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const bySlug = Object.fromEntries(tools.map((t) => [t.slug, t]))
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmt = (d) => { const [y, m, day] = d.split('-'); return `${MONTHS[Number(m) - 1]} ${Number(day)}, ${y}` }
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}
function tags(html) {
  return [...html.matchAll(/<div class="shelfedge( big)?"><div class="ptag">([\s\S]*?)<\/div>(<div class="pcheck( missing)?">[\s\S]*?<\/div>)<\/div>/g)]
    .map((m) => ({ big: !!m[1], ptag: m[2], check: m[3], missing: !!m[4] }))
}
function assertTag(tag, t, noFree) {
  const where = t.slug
  // price: "from $20/mo" splits into From + amount + unit; anything else is shown as written
  const m = String(t.priceFrom).match(/^from (\$[\d.,]+|[\d.,]+ euros)(\/[a-z]+)$/i)
  if (m) assert.ok(tag.ptag.includes(`<span class="pfrom">From</span><b>${m[1]}<small>${m[2]}</small></b>`), `${where}: ${tag.ptag}`)
  else if (/^free$/i.test(t.priceFrom)) assert.ok(tag.ptag.includes('<b>Free</b>'), where)
  else assert.equal(unesc(tag.ptag.match(/<b class="txt">([^<]*)<\/b>/)[1]), t.priceFrom || 'See pricing', where)
  // free tier: straight from the data, never invented
  if (noFree) assert.equal(tag.ptag.includes('Free tier'), false, where)
  else if (typeof t.freeTier === 'boolean') assert.ok(tag.ptag.includes(`<span class="pfree">Free tier: ${t.freeTier ? 'yes' : 'no'}</span>`), where)
  else assert.equal(tag.ptag.includes('Free tier'), false, where)
  // checked panel
  if (t.priceChecked) {
    assert.equal(tag.missing, false, where)
    assert.ok(tag.check.includes(`<strong>Price checked ${fmt(t.priceChecked)}</strong>`), where)
    assert.ok(tag.check.includes(`href="${t.pricingUrl}"`), where)
  } else {
    assert.equal(tag.missing, true, where)
    assert.ok(tag.check.includes('<strong>Price not yet checked</strong>'), where)
    if (t.pricingUrl) assert.ok(tag.check.includes(`href="${t.pricingUrl}"`), where)
    else assert.ok(tag.check.includes('We will date it once we confirm it'), where)
  }
  if (t.pricingUrl) assert.ok(tag.check.includes('rel="noopener noreferrer" target="_blank">Official pricing</a>'), where)
}

test('every search result card ends on a price tag that matches the data', async () => {
  let checked = 0, missing = 0
  for (const q of ['write blog posts', 'code editor', 'edit a podcast', 'make a logo', 'transcribe a meeting', 'video', 'research papers']) {
    const expected = rankTools(tools, q)
    const { html } = await get(`/?q=${encodeURIComponent(q)}`)
    const start = html.indexOf('Best fit for')
    const section = html.slice(start, html.indexOf('</section>', start))
    const cards = [...section.matchAll(/<article class="card">([\s\S]*?)<\/article>/g)].map((x) => x[1])
    assert.equal(cards.length, expected.length, q)
    cards.forEach((c, i) => {
      const t = expected[i]
      const ts = tags(c)
      assert.equal(ts.length, 1, `${q} ${t.slug}`)
      assert.equal(ts[0].big, false)
      assert.equal(c.includes('<dt>Price</dt>'), false, `${q} ${t.slug} still has the Price row`)
      assertTag(ts[0], t)
      if (ts[0].missing) missing++; else checked++
    })
  }
  assert.ok(checked > 0 && missing > 0, 'both tag states covered')
})

test('every tool page shows one large price tag in the side box, above the Visit button', async () => {
  for (const t of tools) {
    const { status, html } = await get(`/tool/${t.slug}`)
    assert.equal(status, 200)
    const hero = html.slice(html.indexOf('<aside class="side"'), html.indexOf('</aside>'))
    const ts = tags(hero)
    assert.equal(ts.length, 1, t.slug)
    assert.equal(ts[0].big, true, t.slug)
    // v2: the free tier is stated first in the price box, so the tag carries only the price
    assertTag(ts[0], t, true)
    if (typeof t.freeTier === 'boolean') assert.ok(hero.indexOf(`Free tier: ${t.freeTier ? 'yes' : 'no'}</p>`) < hero.indexOf('class="shelfedge big"') && hero.includes('<p class="freefirst'), t.slug)
    assert.ok(hero.indexOf('class="shelfedge big"') < hero.indexOf('class="btn"'), t.slug)
    assert.equal(tags(html).length, 1, `${t.slug}: tag outside the hero`)
  }
})

test('cards outside search results and category pages keep the Price row and get no tag', async () => {
  for (const p of ['/best/ai-coding-assistant']) {
    const { html } = await get(p)
    const cards = [...html.matchAll(/<article class="card">([\s\S]*?)<\/article>/g)].map((x) => x[1])
    assert.ok(cards.length > 0, p)
    for (const c of cards) {
      assert.equal(c.includes('shelfedge'), false, p)
      assert.ok(c.includes('<dt>Price</dt>'), p)
    }
  }
})

test('price tag text has no em dashes and no invented prices', async () => {
  const { html } = await get('/?q=write%20blog%20posts')
  assert.equal(html.includes('\u2014'), false)
  for (const t of tags(html)) assert.equal(/\$\d/.test(t.check), false, 'price amounts only on the yellow tag')
})

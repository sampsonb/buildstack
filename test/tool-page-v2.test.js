import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Tool page v2 (2026-11-15, Paper mockup reviewed with Impeccable): header with the category rank
// set large, price box with the free tier first, plan table only from structured data, ranked
// alternatives as a table with this tool pinned on top, a closing decision strip, and an
// On this page list. Everything comes from tools.json.
const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const byRank = [...tools].sort((a, b) => a.rank - b.rank)
const inCat = (t) => byRank.filter((x) => x.category === t.category)
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const EMPTY = '<span aria-hidden="true">\u2013</span><span class="sr-only">Not listed</span>'
async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}
const between = (h, a, b) => { const i = h.indexOf(a); return i < 0 ? '' : h.slice(i, h.indexOf(b, i)) }

test('alternatives table: this tool pinned first as This page, then category rank order, labeled columns', async () => {
  for (const t of tools) {
    const { html } = await get(`/tool/${t.slug}`)
    const others = inCat(t).filter((x) => x.slug !== t.slug).slice(0, 4)
    const sec = between(html, '<section class="tsec" id="alternatives">', '</section>')
    if (!others.length) { assert.equal(sec, '', t.slug); continue }
    const rows = [...sec.matchAll(/<tr( class="here" aria-current="page")?>([\s\S]*?)<\/tr>/g)].filter((m) => !m[2].includes('scope="col"'))
    assert.equal(rows.length, others.length + 1, t.slug)
    assert.ok(rows[0][1], `${t.slug}: first row pinned`)
    assert.ok(rows[0][2].includes('<span class="herechip">This page</span>') && !rows[0][2].includes('href="/tool/'), t.slug)
    assert.equal(rows.slice(1).some((r) => r[1]), false, `${t.slug}: only one pinned row`)
    const slugs = rows.slice(1).map((r) => r[2].match(/href="\/tool\/([^"]+)"/)[1])
    assert.deepEqual(slugs, others.map((x) => x.slug), t.slug)
    const n = inCat(t).length
    assert.ok(rows[0][2].includes(`>${ord(inCat(t).indexOf(t) + 1)} of ${n}</td>`), t.slug)
    for (const h of [`Rank in `, '>Tool<', '>Price<', '>Free tier<', '>Pricing source<']) assert.ok(sec.includes(h), `${t.slug} ${h}`)
    // pricing source: a link when the data has one, otherwise the en dash marker, never blank
    ;[t, ...others].forEach((x, i) => {
      const last = rows[i][2].match(/<td data-label="Pricing source">([\s\S]*?)<\/td>/)[1]
      if (x.pricingUrl) assert.ok(last.includes(`href="${x.pricingUrl}"`), `${t.slug} row ${x.slug}`)
      else assert.equal(last, EMPTY, `${t.slug} row ${x.slug}`)
      const free = rows[i][2].match(/<td data-label="Free tier">([\s\S]*?)<\/td>/)[1]
      assert.equal(free, typeof x.freeTier === 'boolean' ? (x.freeTier ? 'Yes' : 'No') : EMPTY, `${t.slug} row ${x.slug}`)
    })
  }
})

test('price box: free tier stated first, then the one yellow tag, then Visit; jump list after it', async () => {
  for (const t of tools) {
    const { html } = await get(`/tool/${t.slug}`)
    const side = between(html, '<aside class="side"', '</aside>')
    const f = side.indexOf(`<p class="freefirst${t.freeTier ? ' yes' : ''}">Free tier: ${t.freeTier ? 'yes' : 'no'}</p>`)
    assert.ok(f > 0, t.slug)
    assert.ok(f < side.indexOf('<div class="ptag">'), t.slug)
    assert.ok(side.indexOf('<div class="ptag">') < side.indexOf('class="btn"'), t.slug)
    assert.ok(side.indexOf('Paid placement: none.') > 0 || t.featured, t.slug)
    assert.ok(side.indexOf('<nav class="toc" aria-label="On this page">') > side.indexOf('class="btn"'), t.slug)
    assert.equal((html.match(/class="ptag"/g) || []).length, 1, `${t.slug}: yellow only on the one price tag`)
    for (const id of [...side.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])) assert.ok(html.includes(` id="${id}"`), `${t.slug} #${id}`)
  }
})

test('no em dashes anywhere on tool pages; en dash only as the empty-cell marker', async () => {
  for (const t of tools) {
    const { html } = await get(`/tool/${t.slug}`)
    assert.equal(html.includes('\u2014'), false, t.slug)
    const body = html.slice(html.indexOf('<body>'))
    assert.equal(body.replaceAll(EMPTY, '').includes('\u2013'), false, t.slug)
  }
})

test('plan table only from structured plans data, and every plan figure is in the checked pricing note', async () => {
  let withPlans = 0
  for (const t of tools) {
    const { html } = await get(`/tool/${t.slug}`)
    const sec = between(html, '<section class="tsec" id="pricing">', '</section>')
    assert.ok(sec.includes(`<h2>How much does ${t.name.replace(/&/g, '&amp;')} cost?</h2>`), t.slug)
    if (Array.isArray(t.plans) && t.plans.length) {
      withPlans++
      assert.ok(sec.includes('<table class="plans">'), t.slug)
      const note = t.pricingNote.toLowerCase()
      for (const p of t.plans) {
        assert.ok(note.includes(p.name.toLowerCase()) || (p.name === 'Free' && note.includes('free')), `${t.slug} plan ${p.name}`)
        for (const amt of `${p.price} ${p.note || ''}`.match(/\$[\d.,]+/g) || []) assert.ok(note.includes(amt), `${t.slug} ${amt}`)
        assert.ok(sec.includes(`<th scope="row">${p.name}</th>`), `${t.slug} row ${p.name}`)
      }
      assert.ok(t.priceChecked, `${t.slug}: plans only for price-checked tools`)
    } else {
      assert.equal(sec.includes('<table class="plans">'), false, t.slug)
      assert.ok(sec.includes('<p class="pnote">'), t.slug)
    }
    if (t.apiPricing) {
      assert.ok(sec.includes('<h3>Developer API pricing</h3>'), t.slug)
      for (const amt of t.apiPricing.match(/\$[\d.,]+/g) || []) assert.ok(`${t.description} ${t.pricingNote}`.includes(amt), `${t.slug} api ${amt}`)
    } else assert.equal(sec.includes('Developer API pricing'), false, t.slug)
  }
  assert.ok(withPlans >= 1, 'at least one tool exercises the plan table')
})

test('closing strip repeats the decision: name, category place, free tier, price, checked date, two actions', async () => {
  for (const t of tools) {
    const { html } = await get(`/tool/${t.slug}`)
    const c = unesc(between(html, '<section class="closer"', '</section>'))
    const n = inCat(t).length
    assert.ok(c.includes(`<strong>${t.name}</strong> · ${ord(inCat(t).indexOf(t) + 1)} of ${n} in `), t.slug)
    assert.ok(c.includes(`Free tier: ${t.freeTier ? 'yes' : 'no'} · `), t.slug)
    assert.ok(c.includes(t.priceChecked && t.pricingUrl ? 'Price checked ' : 'Price not yet checked'), t.slug)
    assert.ok(c.includes(`href="/category/${t.category}">See the full `), t.slug)
    assert.ok(c.includes(`<a class="btn" href="${t.url}"`), t.slug)
  }
})

test('visible FAQ labels the overall ranks it cites; JSON-LD answers unchanged', async () => {
  const { html } = await get('/tool/claude')
  const faq = between(html, '<section class="tsec" id="faq">', '</section>')
  assert.match(faq, /\(#\d+ overall\)/)
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1])
  const alt = ld['@graph'].find((n) => n['@type'] === 'FAQPage').mainEntity.find((q) => q.name.startsWith('What are the best alternatives'))
  assert.match(alt.acceptedAnswer.text, /\(#\d+\)/)
  assert.equal(/overall\)/.test(alt.acceptedAnswer.text), false)
})

test('tool page CSS ships only on tool pages, with design tokens and 44px mobile targets', async () => {
  const { html } = await get('/tool/claude')
  assert.ok(html.includes('--bs-tap: 44px'))
  assert.ok(/@media \(max-width: 820px\)[\s\S]*min-height: var\(--bs-tap\)/.test(html))
  for (const p of ['/', '/categories', '/best/ai-writing-tool']) assert.equal((await get(p)).html.includes('--bs-tap'), false, p)
})

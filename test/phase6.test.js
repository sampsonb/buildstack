import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Phase 6 redesign: the home page opens with the live top 3 for a sample job on price tags,
// a short honesty strip and a directory table; category pages are ranked rows with price tags.
const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}
const slugsIn = (html) => [...html.matchAll(/<article class="card">[\s\S]*?<h3><a href="\/tool\/([^"]+)"/g)].map((m) => m[1])

test('home sample shelf is the live top 3 the results page shows, with price tags', async () => {
  const home = (await get('/')).html
  const res = (await get('/?q=write%20blog%20posts')).html
  const shelf = home.slice(home.indexOf('<ol class="shelf">'), home.indexOf('</ol>', home.indexOf('<ol class="shelf">')))
  const slots = [...shelf.matchAll(/<li class="slot">([\s\S]*?)<\/li>/g)].map((m) => m[1])
  assert.equal(slots.length, 3)
  const homeSlugs = slots.map((x) => x.match(/<h3><a href="\/tool\/([^"]+)"/)[1])
  assert.deepEqual(homeSlugs, slugsIn(res).slice(0, 3))
  slots.forEach((x, i) => {
    assert.ok(x.includes(`<span class="pos" aria-hidden="true">${i + 1}</span><span class="sr-only">Best fit number ${i + 1}. </span>`))
    assert.ok(x.includes('<div class="shelfedge">'))
  })
  const n = res.match(/(\d+) matching tools, ranked from/)[1]
  assert.ok(home.includes(`<a href="/?q=write%20blog%20posts">See all ${n}</a>`))
  assert.ok(home.indexOf('<ol class="shelf">') < home.indexOf('id="best-for"'))
})

test('home honesty strip uses real counts and no invented claims', async () => {
  const { html } = await get('/')
  const strip = html.match(/<section class="trust"[\s\S]*?<\/section>/)[0]
  const checked = tools.filter((t) => t.priceChecked && t.pricingUrl).length
  assert.ok(strip.includes(`${checked} of ${tools.length} prices are matched to the official pricing page`))
  assert.ok(strip.includes(`From #1 to #${tools.length}, edited by Sampson Brueher.`))
  assert.ok(strip.includes('Ranks are never for sale.'))
  assert.equal(tools.filter((t) => t.featured).length, 0)
  const meth = (await get('/methodology')).html
  assert.ok(meth.includes('no payment can change a tool'))
  assert.ok(meth.includes('Sampson Brueher'))
})

test('home and /categories directory tables link every category with its top three in rank order', async () => {
  const cats = [...new Set(tools.map((t) => t.category))]
  for (const p of ['/', '/categories']) {
    const { html } = await get(p)
    const table = html.match(/<table class="dir">[\s\S]*?<\/table>/)[0]
    assert.ok(table.includes('<th scope="col">'), p)
    if (p === '/categories') {
      for (const c of cats) {
        const row = table.match(new RegExp(`<tr><td><a href="/category/${c}">[\\s\\S]*?</tr>`))[0]
        const top = [...row.matchAll(/href="\/tool\/([^"]+)"/g)].map((m) => m[1])
        const want = tools.filter((t) => t.category === c).sort((a, b) => a.rank - b.rank).slice(0, 3).map((t) => t.slug)
        assert.deepEqual(top, want, c)
        assert.ok(row.includes(`<td class="n">${tools.filter((t) => t.category === c).length}</td>`), c)
      }
    }
  }
})

test('category pages are ranked rows: big number is the place in the category, price tag, no Price row', async () => {
  const { html } = await get('/category/writing')
  assert.ok(html.includes('<div class="rows catrows">'))
  const cards = [...html.matchAll(/<article class="card">([\s\S]*?)<\/article>/g)].map((x) => x[1])
  const n = tools.filter((t) => t.category === 'writing').length
  assert.equal(cards.length, n)
  cards.forEach((c, i) => {
    assert.ok(c.includes(`<span class="pos" aria-hidden="true">${i + 1}</span><span class="sr-only">Number ${i + 1} in Writing. </span>`), String(i))
    assert.ok(c.includes('<div class="shelfedge">'))
    assert.equal(c.includes('<dt>Price</dt>'), false)
  })
})

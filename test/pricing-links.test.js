import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools } from '../src/search.js'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))

async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, text: await res.text() }
}

test('pricing fields: https only, dates only with a link, src and data identical', () => {
  assert.equal(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'), readFileSync(new URL('../data/tools.json', import.meta.url), 'utf8'))
  for (const t of tools) {
    if (t.pricingUrl) assert.match(t.pricingUrl, /^https:\/\/[^\s"<>]+$/, t.slug)
    if (t.priceChecked) {
      assert.ok(t.pricingUrl, `${t.slug} has a date but no link`)
      assert.match(t.priceChecked, /^\d{4}-\d\d-\d\d$/)
    }
  }
})

test('tool page links the official pricing page with the checked date', async () => {
  const t = tools.find((x) => x.priceChecked)
  const { status, text } = await get(`/tool/${t.slug}`)
  assert.equal(status, 200)
  assert.ok(text.includes(`href="${t.pricingUrl}"`), 'link')
  assert.match(text, /price checked [A-Z][a-z]{2} \d{1,2}, \d{4}/i)
  const u = tools.find((x) => x.pricingUrl && !x.priceChecked)
  const page = (await get(`/tool/${u.slug}`)).text
  assert.ok(page.includes(`href="${u.pricingUrl}"`))
  const none = tools.find((x) => !x.pricingUrl)
  const nonePage = (await get(`/tool/${none.slug}`)).text
  assert.equal(/<a href="[^"]+"[^>]*>Official pricing( page)?<\/a>/.test(nonePage), false)
})

test('search result price line carries the pricing link', async () => {
  const t = tools.find((x) => x.slug === 'cursor')
  const { text } = await get('/?q=code+editor')
  assert.ok(text.includes(`href="${t.pricingUrl}"`))
})

test('tools.json exposes pricingUrl and priceChecked; sitemap tool date includes the price check', async () => {
  const j = JSON.parse((await get('/tools.json')).text)
  const list = j.tools || j
  const c = list.find((x) => x.slug === 'cursor')
  assert.equal(c.pricingUrl, tools.find((x) => x.slug === 'cursor').pricingUrl)
  const t = tools.find((x) => x.priceChecked && x.priceChecked > x.updated)
  if (t) assert.ok((await get('/sitemap.xml')).text.includes(`/tool/${t.slug}</loc><lastmod>${t.priceChecked}</lastmod>`))
})

test('ranking ignores pricing fields', () => {
  const strip = tools.map(({ pricingUrl, priceChecked, ...x }) => x)
  for (const q of ['code editor', 'video', 'phone calls agent', 'blog post']) {
    assert.deepEqual(rankTools(tools, q).map((x) => x.slug), rankTools(strip, q).map((x) => x.slug), q)
  }
})

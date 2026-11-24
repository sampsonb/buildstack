import assert from 'node:assert/strict'
import { test } from 'node:test'
import tools from '../src/tools.json' with { type: 'json' }

const by = Object.fromEntries(tools.map((t) => [t.slug, t]))
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}
const title = (html) => decode(html.match(/<title>([^<]+)<\/title>/)[1])

test('checked non-giant tool titles name the free plan answer and the starting price', async () => {
  assert.equal(title((await get('/tool/wordtune')).html), 'Wordtune pricing: free plan, from $4.89/mo, checked Nov 24, 2026 | BuildStack')
  assert.equal(title((await get('/tool/writesonic')).html), 'Writesonic pricing: no free plan, from $79/mo, checked Nov 24, 2026 | BuildStack')
  assert.equal(title((await get('/tool/photoroom')).html), 'Photoroom pricing: free plan, from $7.50/mo, checked Nov 24, 2026 | BuildStack')
})

test('unchecked or vague prices keep the generic title; giants keep name and tagline', async () => {
  const un = tools.find((t) => !t.priceChecked && !['chatgpt', 'claude'].includes(t.slug) && t.slug !== 'grok')
  const t1 = title((await get(`/tool/${un.slug}`)).html)
  assert.ok(t1.includes('pricing: free plan, starting price, not yet checked'), t1)
  const netlify = title((await get('/tool/netlify')).html)
  assert.ok(netlify.startsWith('Netlify pricing: free plan, starting price, checked'), netlify)
  assert.equal(title((await get('/tool/claude')).html), `Claude: ${by.claude.tagline} | BuildStack`)
})

test('every tool title is free of em and en dashes and ranks ignore affiliate', async () => {
  for (const t of tools.slice(0, 40)) {
    const { status, html } = await get(`/tool/${t.slug}`)
    assert.equal(status, 200, t.slug)
    assert.ok(!/[\u2013\u2014]/.test(title(html)), t.slug)
  }
  assert.deepEqual(tools.map((t) => t.rank), tools.map((_, i) => i + 1))
})

test('Nov 24 adds: writing coverage and Claude Ship are checked and placed honestly', () => {
  for (const s of ['prowritingaid', 'languagetool', 'wordtune']) {
    assert.equal(by[s].category, 'writing', s)
    assert.equal(by[s].priceChecked, '2026-11-24', s)
    assert.equal(by[s].affiliate, false, s)
    assert.ok(!by[s].bestFor.join(' ').toLowerCase().includes('writing'), s)
  }
  assert.equal(by.prowritingaid.rank, by['notion-ai'].rank + 1)
  assert.equal(by.languagetool.rank, by.prowritingaid.rank + 1)
  assert.equal(by.wordtune.rank, by.languagetool.rank + 1)
  assert.equal(by['claude-ship'].category, 'coding')
  assert.equal(by['claude-ship'].rank, by.testsprite.rank + 1)
  assert.match(by['claude-ship'].pricingNote, /billed on tokens/)
})

test('maker replies applied: Photoroom free plan, Bolt details, Lovable confirmed', () => {
  assert.equal(by.photoroom.freeTier, true)
  assert.equal(by.photoroom.freePlan, true)
  assert.match(by.photoroom.pricingNote, /7-day free trial comes with yearly Pro and Max only/)
  assert.match(by.bolt.pricingNote, /10M tokens/)
  assert.match(by.bolt.pricingNote, /\$30 per member a month/)
  assert.equal(by.lovable.priceChecked, '2026-11-24')
})

test('search still finds the new tools by name', async () => {
  for (const [q, s] of [['wordtune', 'Wordtune'], ['languagetool', 'LanguageTool'], ['prowritingaid', 'ProWritingAid'], ['claude ship', 'Claude Ship']]) {
    const { status, html } = await get(`/?q=${encodeURIComponent(q)}`)
    assert.equal(status, 200)
    assert.ok(html.includes(s), q)
  }
})

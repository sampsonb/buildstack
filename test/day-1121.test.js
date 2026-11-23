import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools } from '../src/search.js'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const app = (await import('../src/index.js')).default

// slug, category, name query, natural use case query
const ADDED = [
  ['semantic-scholar', 'research', 'semantic scholar', 'find scientific papers for free'],
  ['scite', 'research', 'scite', 'check whether a finding held up'],
  ['undermind', 'research', 'undermind', 'find niche papers'],
  ['genie-4', 'video', 'genie 4', 'explore a world made from a prompt'],
  ['inkling-2-mini', 'agents', 'inkling 2 mini', 'open weights model to run on a laptop'],
]

test('2026-11-21 tools exist with full fields, honest flags and consecutive ranks', () => {
  assert.ok(tools.every((t, i) => t.rank === i + 1))
  assert.ok(tools.length >= 162)
  assert.ok(tools.every((t) => t.affiliate === false))
  for (const [slug, cat] of ADDED) {
    const t = tools.find((x) => x.slug === slug)
    assert.ok(t, slug)
    assert.equal(t.category, cat)
    assert.equal(t.affiliate, false)
    assert.equal(t.featured, false)
    assert.equal(t.added, '2026-11-21')
    assert.equal(t.updated, '2026-11-21')
    for (const k of ['name', 'url', 'tagline', 'description', 'pricingNote', 'strength', 'watchOut', 'priceFrom']) assert.ok(String(t[k] || '').trim(), `${slug}.${k}`)
    assert.equal(t.bestFor.length, 3)
    assert.ok(!t.bestFor.join(' ').match(/\b(research|writing|coding|images|video|voice|agents)\b/i), `${slug} bestFor has no category words`)
    assert.equal(typeof t.freeTier, 'boolean')
    if (t.priceChecked) assert.ok(t.pricingUrl, `${slug} checked price needs a pricing link`)
    assert.ok(!JSON.stringify(t).includes('\u2014'))
  }
  // Semantic Scholar has no pricing page, so no pricing link or checked date is claimed.
  const ss = tools.find((t) => t.slug === 'semantic-scholar')
  assert.equal(ss.pricingUrl, undefined)
  assert.equal(ss.priceChecked, undefined)
})

test('2026-11-21 research adds sit right after the paper tools they relate to', () => {
  const rank = (s) => tools.find((t) => t.slug === s).rank
  assert.equal(rank('semantic-scholar'), rank('elicit') + 1)
  assert.equal(rank('scite'), rank('scispace') + 1)
  assert.equal(rank('undermind'), rank('scite') + 1)
  assert.equal(rank('genie-4'), rank('sora') + 1)
  assert.equal(rank('inkling-2-mini'), rank('inkling-2-small') + 1)
})

test('2026-11-21 tools are found by name and by a natural use case', () => {
  for (const [slug, , nameQ, useQ] of ADDED) {
    assert.equal(rankTools(tools, nameQ)[0].slug, slug, nameQ)
    assert.ok(rankTools(tools, useQ).slice(0, 8).some((t) => t.slug === slug), useQ)
  }
})

test('2026-11-21 tool pages return 200 without em dashes', async () => {
  for (const [slug] of ADDED) {
    const r = await app.request(`http://local/tool/${slug}`)
    assert.equal(r.status, 200, slug)
    assert.ok(!(await r.text()).includes('\u2014'), slug)
  }
})

test('research guide covers Semantic Scholar, Scite and Undermind with honest pricing wording', async () => {
  const r = await app.request('http://local/best/ai-research-assistant')
  const html = await r.text()
  for (const s of ['semantic-scholar', 'scite', 'undermind']) assert.ok(html.includes(`href="/tool/${s}"`), s)
  assert.ok(html.includes('id="find-and-check-papers"'))
  assert.ok(html.includes('How do I check whether a paper still holds up?'))
  assert.ok(html.includes('What is the best free tool to find research papers?'))
  assert.ok(!html.includes('Pricing notes were checked on each official pricing page on'))
  assert.ok(html.includes('13 research picks'))
  assert.ok(!html.includes('\u2014'))
  const tool = await (await app.request('http://local/tool/scite')).text()
  assert.ok(tool.includes('href="/best/ai-research-assistant"'))
})

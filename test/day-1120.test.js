import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools } from '../src/search.js'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const app = (await import('../src/index.js')).default

// slug, category, name query, natural use case query
const ADDED = [
  ['mai-image-2-7', 'images', 'mai image', 'mai labs image model'],
  ['magnific', 'images', 'magnific', 'upscale an image'],
  ['photoroom', 'images', 'photoroom', 'product photos'],
  ['testsprite', 'coding', 'testsprite', 'test my web app'],
  ['hermes-agent', 'agents', 'hermes agent', 'personal agent with memory'],
]

test('2026-11-20 tools exist with full fields, honest flags and consecutive ranks', () => {
  assert.ok(tools.every((t, i) => t.rank === i + 1))
  for (const [slug, cat] of ADDED) {
    const t = tools.find((x) => x.slug === slug)
    assert.ok(t, slug)
    assert.equal(t.category, cat)
    assert.equal(t.affiliate, false)
    assert.equal(t.featured, false)
    assert.equal(t.added, '2026-11-20')
    for (const k of ['name', 'url', 'tagline', 'description', 'pricingNote', 'strength', 'watchOut', 'priceFrom']) assert.ok(String(t[k] || '').trim(), `${slug}.${k}`)
    assert.equal(t.bestFor.length, 3)
    assert.equal(typeof t.freeTier, 'boolean')
    if (t.priceChecked) assert.ok(t.pricingUrl, `${slug} checked price needs a pricing link`)
    assert.ok(!JSON.stringify(t).includes('\u2014'))
  }
})

test('2026-11-20 tools are found by name and by a natural use case', () => {
  for (const [slug, , nameQ, useQ] of ADDED) {
    assert.equal(rankTools(tools, nameQ)[0].slug, slug, nameQ)
    assert.ok(rankTools(tools, useQ).slice(0, 8).some((t) => t.slug === slug), useQ)
  }
})

test('2026-11-20 tool pages return 200', async () => {
  for (const [slug] of ADDED) assert.equal((await app.request(`http://local/tool/${slug}`)).status, 200, slug)
})

test('image guide covers Nano Banana, ChatGPT Images and Photoroom and no longer calls Midjourney the top ranked', async () => {
  const r = await app.request('http://local/best/ai-image-generator')
  const html = await r.text()
  for (const s of ['nano-banana', 'chatgpt-images', 'photoroom']) assert.ok(html.includes(`href="/tool/${s}"`), s)
  assert.ok(html.includes('id="best-photo-editing"') && html.includes('id="best-in-chatgpt"') && html.includes('id="best-product-photos"'))
  assert.ok(!/Midjourney[^.]{0,40}highest-ranked/.test(html))
  assert.ok(html.includes('The highest-ranked image tool on BuildStack is'))
  assert.ok(!html.includes('\u2014'))
  const nb = tools.find((t) => t.slug === 'nano-banana')
  assert.ok(tools.filter((t) => t.category === 'images').every((t) => t.rank >= nb.rank), 'Nano Banana is the top image tool')
})

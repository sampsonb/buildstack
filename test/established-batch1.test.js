import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools } from '../src/search.js'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))

// slug, category, a query by name, a natural use case query
const BATCH = [
  ['microsoft-copilot', 'writing', 'microsoft copilot', 'summarize my outlook emails'],
  ['mistral-vibe', 'writing', 'le chat', 'mistral assistant'],
  ['meta-ai', 'writing', 'meta ai', 'free assistant in whatsapp'],
  ['gamma', 'writing', 'gamma', 'make a presentation'],
  ['junie', 'coding', 'junie', 'jetbrains coding agent'],
  ['recraft', 'images', 'recraft', 'make a vector logo'],
  ['stable-diffusion', 'images', 'stable diffusion', 'run an image model locally'],
  ['hailuo-ai', 'video', 'hailuo', 'video with sound from text'],
  ['perplexity-comet', 'agents', 'comet browser', 'browser agent'],
  ['chatgpt-work', 'agents', 'chatgpt work', 'make a spreadsheet and slides from one request'],
  ['granola', 'voice', 'granola', 'meeting notes without a bot'],
  ['wispr-flow', 'voice', 'wispr flow', 'dictate emails'],
  ['udio', 'voice', 'udio', 'make a song'],
]

test('batch 1 established tools exist with consistent fields and ranks', () => {
  assert.ok(tools.every((t, i) => t.rank === i + 1), 'ranks are consecutive')
  for (const [slug, cat] of BATCH) {
    const t = tools.find((x) => x.slug === slug)
    assert.ok(t, slug)
    assert.equal(t.category, cat, slug)
    for (const k of ['name', 'url', 'tagline', 'description', 'pricingNote', 'strength', 'watchOut', 'priceFrom']) assert.ok(String(t[k] || '').trim(), `${slug}.${k}`)
    assert.ok(Array.isArray(t.bestFor) && t.bestFor.length === 3, slug)
    assert.equal(typeof t.freeTier, 'boolean')
    assert.ok(!JSON.stringify(t).includes('\u2014'), `${slug} has an em dash`)
  }
})

test('batch 1 tools show up for their name and a natural use case', () => {
  for (const [slug, , nameQ, useQ] of BATCH) {
    assert.equal(rankTools(tools, nameQ)[0].slug, slug, `name query "${nameQ}"`)
    const top = rankTools(tools, useQ).slice(0, 8).map((t) => t.slug)
    assert.ok(top.includes(slug), `use case "${useQ}": ${top.join(',')}`)
  }
})

test('renamed or retired products are not listed under their old names', () => {
  assert.ok(!tools.some((t) => ['gemini-cli', 'chatgpt-agent', 'chatgpt-atlas', 'le-chat', 'copilot-pro'].includes(t.slug)))
})

test('batch 1 tool pages return 200', async () => {
  const app = (await import('../src/index.js')).default
  for (const [slug] of BATCH) assert.equal((await app.request(`http://local/tool/${slug}`)).status, 200, slug)
})

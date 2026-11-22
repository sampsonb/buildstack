import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const by = Object.fromEntries(tools.map((t) => [t.slug, t]))

test('src and data tools.json stay identical', () => {
  assert.equal(
    readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'),
    readFileSync(new URL('../data/tools.json', import.meta.url), 'utf8'),
  )
})

test('Perplexity, ChatGPT, Meta AI, and Wix Studio have confirmed Nov 21 prices', () => {
  const p = by.perplexity
  assert.equal(p.pricingUrl, 'https://www.perplexity.ai/pro')
  assert.equal(p.priceChecked, '2026-11-21')
  assert.equal(p.priceFrom, 'from $17/mo')
  assert.match(p.pricingNote, /Free is \$0/)
  assert.match(p.pricingNote, /Pro is \$17 a month billed yearly/)
  assert.match(p.pricingNote, /Max is \$200 a month or \$2,000 a year/)
  assert.match(p.pricingNote, /\$167 a month billed yearly/)
  assert.match(p.pricingNote, /Enterprise Pro is \$40 per seat a month or \$400 per seat a year/)
  assert.match(p.pricingNote, /Enterprise Max is listed, but its price is not shown/)
  assert.equal(p.pricingNote.includes('Education Pro'), false)

  const c = by.chatgpt
  assert.equal(c.pricingUrl, 'https://chatgpt.com/pricing/')
  assert.equal(c.priceChecked, '2026-11-21')
  assert.equal(c.priceFrom, 'from $8/mo')
  assert.match(c.pricingNote, /Go is \$8 a month/)
  assert.match(c.pricingNote, /Plus is \$20 a month/)
  assert.match(c.pricingNote, /Pro starts at \$100 a month/)
  assert.match(c.pricingNote, /Business Standard is \$20 per seat a month billed yearly or \$25 billed monthly/)
  assert.match(c.pricingNote, /Business Premium is \$100 per seat a month billed yearly or \$125 billed monthly/)

  const m = by['meta-ai']
  assert.equal(m.priceFrom, 'Free')
  assert.equal(m.pricingUrl, 'https://www.meta.com/meta-one-plans/')
  assert.equal(m.priceChecked, '2026-11-21')
  assert.match(m.pricingNote, /Core at \$7\.99 a month/)
  assert.match(m.pricingNote, /Premium at \$19\.99 a month/)
  assert.match(m.pricingNote, /limited testing/)
  assert.equal(m.pricingNote.includes('$2.99'), false)

  const w = by['wix-studio-two']
  assert.equal(w.pricingUrl, 'https://www.wix.com/studio/plans')
  assert.equal(w.priceChecked, '2026-11-21')
  assert.equal(w.priceFrom, 'from $19/mo')
  assert.match(w.pricingNote, /Basic at \$19 a month/)
  assert.match(w.pricingNote, /Standard at \$27 a month/)
  assert.match(w.pricingNote, /Plus at \$34 a month/)
  assert.match(w.pricingNote, /Elite at \$159 a month/)
  assert.match(w.pricingNote, /billed yearly and paid upfront/)
  assert.match(w.pricingNote, /Enterprise is listed, but its price is not shown/)
})

test('ChatGPT Work and Images keep their own official pricing pages', () => {
  assert.equal(by['chatgpt-work'].pricingUrl, 'https://learn.chatgpt.com/docs/pricing')
  assert.equal(by['chatgpt-images'].pricingUrl, 'https://developers.openai.com/api/docs/pricing')
  assert.notEqual(by['chatgpt-work'].priceChecked, undefined)
  assert.notEqual(by['chatgpt-images'].priceChecked, undefined)
})

test('checked count is 90 of 174, and copy has no em or en dashes', () => {
  const checked = tools.filter((t) => t.priceChecked && t.pricingUrl).length
  assert.equal(checked, 90)
  assert.equal(tools.length, 174)
  const json = readFileSync(fileURLToPath(new URL('../src/tools.json', import.meta.url)), 'utf8')
  assert.equal(/[\u2013\u2014]/.test(json), false)
  for (const slug of ['perplexity', 'chatgpt', 'meta-ai', 'wix-studio-two']) {
    const t = by[slug]
    assert.equal(/[\u2013\u2014]/.test(`${t.pricingNote} ${t.watchOut}`), false, slug)
  }
})

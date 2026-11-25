import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools, topShown } from '../src/search.js'
import { buildPayload, sitemapEntries, INDEXNOW_HOST } from '../src/indexnow.js'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const app = (await import('../src/index.js')).default

const ADDED = [
  ['chatbase', 'agents', 'chatbase', 'customer support chatbot'],
  ['tidio', 'agents', 'tidio', 'customer support chatbot'],
  ['zendesk-ai', 'agents', 'zendesk ai', 'customer support chatbot'],
  ['voiceflow', 'agents', 'voiceflow', 'customer support chatbot'],
  ['retell-ai', 'agents', 'retell ai', 'phone calls'],
  ['bland-ai', 'agents', 'bland ai', 'phone calls'],
  ['dia', 'agents', 'dia browser', 'ai browser'],
  ['opera-neon', 'agents', 'opera neon', 'ai browser'],
  ['acrobat-ai-assistant', 'research', 'acrobat ai assistant', 'summarize a pdf'],
  ['chatpdf', 'research', 'chatpdf', 'summarize a pdf'],
  ['google-translate', 'writing', 'google translate', 'translate a document'],
  ['adobe-express', 'images', 'adobe express', 'make a presentation'],
]

test('2026-11-21 catalog adds exist with full fields, honest flags and consecutive ranks', () => {
  assert.ok(tools.every((t, i) => t.rank === i + 1))
  assert.equal(tools.length, 213)
  assert.ok(tools.every((t) => t.affiliate === false))
  assert.ok(!tools.some((t) => t.slug === 'gemini-code-assist' || t.slug === 'remove-bg' || t.slug === 'removebg'))
  for (const [slug, cat] of ADDED) {
    const t = tools.find((x) => x.slug === slug)
    assert.ok(t, slug)
    assert.equal(t.category, cat)
    assert.equal(t.affiliate, false)
    assert.equal(t.featured, false)
    assert.equal(t.added, '2026-11-21')
    assert.equal(t.updated, '2026-11-21')
    assert.equal(typeof t.freePlan, 'boolean')
    assert.equal(t.byoModel, false)
    for (const k of ['name', 'url', 'tagline', 'description', 'pricingNote', 'strength', 'watchOut', 'priceFrom']) assert.ok(String(t[k] || '').trim(), `${slug}.${k}`)
    assert.equal(t.bestFor.length, 3)
    assert.ok(!t.bestFor.join(' ').match(/\b(research|writing|coding|images|video|voice|agents)\b/i), `${slug} bestFor has no category words`)
    assert.equal(typeof t.freeTier, 'boolean')
    if (t.priceChecked) assert.ok(t.pricingUrl, `${slug} checked price needs a pricing link`)
    assert.ok(!JSON.stringify(t).includes('\u2014'), slug)
  }
  const chatpdf = tools.find((t) => t.slug === 'chatpdf')
  assert.equal(chatpdf.priceChecked, undefined)
  assert.equal(chatpdf.pricingUrl, undefined)
  assert.equal(chatpdf.freePlan, true)
  assert.equal(tools.find((t) => t.slug === 'voiceflow').priceFrom, 'Contact sales')
  assert.equal(tools.find((t) => t.slug === 'google-translate').priceFrom, 'Free')
  assert.equal(tools.find((t) => t.slug === 'dia').type, 'browser')
  assert.equal(tools.find((t) => t.slug === 'opera-neon').type, 'browser')
  assert.equal(tools.find((t) => t.slug === 'opera-neon').freePlan, true)
  assert.equal(tools.find((t) => t.slug === 'dia').freePlan, false)
  assert.equal(tools.find((t) => t.slug === 'tidio').freePlan, true)
  assert.equal(tools.find((t) => t.slug === 'chatbase').freePlan, false)
})

test('2026-11-21 catalog adds sit next to the tools they relate to', () => {
  const rank = (s) => tools.find((t) => t.slug === s).rank
  assert.equal(rank('chatbase'), rank('intercom-fin') + 1)
  assert.equal(rank('tidio'), rank('chatbase') + 1)
  assert.equal(rank('zendesk-ai'), rank('tidio') + 1)
  assert.equal(rank('voiceflow'), rank('zendesk-ai') + 1)
  assert.equal(rank('retell-ai'), rank('vapi') + 1)
  assert.equal(rank('bland-ai'), rank('retell-ai') + 1)
  assert.equal(rank('dia'), rank('perplexity-comet') + 1)
  assert.equal(rank('opera-neon'), rank('dia') + 1)
  assert.equal(rank('acrobat-ai-assistant'), rank('notebooklm') + 1)
  assert.equal(rank('chatpdf'), rank('acrobat-ai-assistant') + 1)
  assert.equal(rank('google-translate'), rank('deepl-translator') + 1)
  assert.equal(rank('adobe-express'), rank('canva') + 1)
})

test('2026-11-21 catalog adds are found by name and by a natural use case', () => {
  for (const [slug, , nameQ, useQ] of ADDED) {
    assert.equal(rankTools(tools, nameQ)[0].slug, slug, nameQ)
    assert.ok(rankTools(tools, useQ).slice(0, 8).some((t) => t.slug === slug), `${useQ} should include ${slug}: ${topShown(rankTools(tools, useQ), 8).map((t) => t.slug).join(', ')}`)
  }
})

test('2026-11-21 catalog add pages, sitemap and llms include the new tools, without em dashes', async () => {
  const slugs = ADDED.map((x) => x[0])
  for (const slug of slugs) {
    const r = await app.request(`http://local/tool/${slug}`)
    assert.equal(r.status, 200, slug)
    const html = await r.text()
    assert.ok(!html.includes('\u2014'), slug)
  }
  const sitemap = await (await app.request('http://local/sitemap.xml')).text()
  const llms = await (await app.request('http://local/llms.txt')).text()
  const full = await (await app.request('http://local/llms-full.txt')).text()
  assert.ok(llms.includes('Tools: 213'))
  assert.ok(full.includes('Tools: 213'))
  assert.ok(!sitemap.includes('\u2014') && !llms.includes('\u2014') && !full.includes('\u2014'))
  for (const slug of slugs) {
    assert.ok(sitemap.includes(`/tool/${slug}`), `sitemap ${slug}`)
    assert.ok(llms.includes(`/tool/${slug}`), `llms ${slug}`)
    assert.ok(full.includes(`/tool/${slug}`), `llms-full ${slug}`)
  }
  const today = buildPayload(sitemapEntries(sitemap), { since: '2026-11-21' }).urlList
  for (const slug of slugs) assert.ok(today.includes(`https://${INDEXNOW_HOST}/tool/${slug}`), `indexnow ${slug}`)
})

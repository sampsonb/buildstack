// Behavior tests for the Nov 21, 2026 release 4 search rules: the review synonym map,
// fill-to-3 when R1 would leave fewer than 3 numbered results, and note taker intent.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools, topShown } from '../src/search.js'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
let n = 0
function tool(over) {
  n += 1
  return { slug: `t${n}`, name: `Tool ${n}`, category: 'writing', rank: n, tagline: '', description: '', bestFor: [], pricingNote: '', priceFrom: 'See pricing', freeTier: false, ...over }
}
const slugs = (list) => list.map((t) => t.slug)
const shown = (q) => slugs(topShown(rankTools(tools, q), 6))
const app = async () => (await import('../src/index.js')).default

test('synonyms: presentation matches PowerPoint and pitch deck; pdf scores document but paper does not steal coverage', () => {
  const ppt = tool({ slug: 'ppt', name: 'Deckly', bestFor: ['PowerPoint from a prompt'], rank: 2 })
  const loose = tool({ slug: 'loose', name: 'Quill', bestFor: ['plain writing'], rank: 1 })
  assert.equal(rankTools([ppt, loose], 'make a presentation')[0].slug, 'ppt')
  const pdf = tool({ slug: 'pdf', name: 'Binder', bestFor: ['summarizing PDFs'], rank: 2, category: 'research' })
  const paper = tool({ slug: 'paper', name: 'Folio', bestFor: ['summarizing academic papers'], rank: 1, category: 'research' })
  const list = rankTools([pdf, paper], 'summarize a pdf')
  assert.equal(list[0].slug, 'pdf')
  assert.deepEqual(slugs(topShown(list, 6)), ['pdf', 'paper'], 'paper can fill, but does not outrank a literal PDF match')
})

test('synonyms: chatbot matches helpdesk and live chat; without code credits website plus build', () => {
  const help = tool({ slug: 'help', name: 'Desk', bestFor: ['helpdesk replies'], category: 'agents', rank: 2 })
  const other = tool({ slug: 'other', name: 'Bay', bestFor: ['website widgets'], category: 'agents', rank: 1 })
  assert.equal(rankTools([help, other], 'customer support chatbot')[0].slug, 'help')
  const v = tool({ slug: 'v', category: 'coding', name: 'Vee', bestFor: ['building a website from a prompt'], rank: 2 })
  const raw = tool({ slug: 'raw', category: 'coding', name: 'Raw', bestFor: ['a website from a screenshot'], rank: 1 })
  const list = rankTools([v, raw], 'build a website without code')
  assert.equal(list[0].slug, 'v')
  assert.deepEqual(slugs(topShown(list, 6)), ['v', 'raw'])
})

test('R1 fills to 3 from the best 1-term matches, and does not fill a description-only leftover', () => {
  const strong1 = tool({ slug: 's1', name: 'North', bestFor: ['harbor tide charts'], rank: 3 })
  const mid = tool({ slug: 'mid', name: 'East', tagline: 'harbor maps', rank: 2 })
  const desc = tool({ slug: 'desc', name: 'West', description: 'mentions harbor in passing', rank: 1 })
  const list = rankTools([strong1, mid, desc], 'harbor tide')
  assert.deepEqual(slugs(topShown(list, 6)), ['s1', 'mid'])
  assert.ok(!slugs(topShown(list, 6)).includes('desc'))
})

test('real catalog: note taker leads with meeting notetakers, not Scholarcy', () => {
  const t3 = shown('note taker').slice(0, 3)
  const ok = new Set(['granola', 'otter', 'fathom', 'fireflies', 'wispr-flow', 'read-ai'])
  assert.ok(t3.every((s) => ok.has(s)), t3.join(', '))
  assert.ok(t3.length === 3, t3.join(', '))
  assert.notEqual(shown('note taker')[0], 'scholarcy')
  assert.ok(!t3.includes('scholarcy'))
})

test('real catalog: sparse searches keep at least 3 numbered results', () => {
  const qs = ['write marketing copy', 'translate a pdf', 'pitch deck', 'write an essay', 'refactor code', 'voiceover for a podcast', 'edit and polish prose', 'clone a voice', 'automate workflows', 'upscale a photo', 'automate email', 'make a pitch deck']
  for (const q of qs) {
    const n = shown(q)
    assert.ok(n.length >= 3, `${q} numbered ${n.length}: ${n.join(', ')}`)
  }
})

test('real catalog: the 10 regression queries stay good after the synonym map', () => {
  assert.equal(shown('ai browser')[0], 'perplexity-comet')
  assert.ok(shown('ai browser').includes('genspark'))
  assert.ok(!shown('ai browser').includes('chatgpt-work'))
  assert.deepEqual(shown('translate a document').slice(0, 3), ['deepl-translator', 'google-translate', 'claude'])
  assert.ok(!shown('summarize a pdf').slice(0, 3).includes('scholarcy'))
  assert.ok(!shown('summarize a pdf').slice(0, 3).includes('scispace'))
  assert.equal(shown('build a website without code')[0], 'v0')
  assert.ok(['lovable', 'bolt', 'v0'].every((s) => shown('build a website without code').includes(s)))
  assert.ok(!shown('build a website without code').includes('opencode-browse'))
  assert.equal(shown('make a presentation')[0], 'gamma')
  assert.ok(!shown('phone calls').includes('nod'))
  assert.equal(shown('customer support chatbot for my website')[0], 'chatbase')
  assert.ok(['tidio', 'intercom-fin', 'zendesk-ai', 'voiceflow'].some((s) => shown('customer support chatbot for my website').includes(s)))
  assert.ok(!shown('customer support chatbot for my website').includes('nod'))
})

test('keywords stay set and /methodology describes the synonym map and fill-to-3', async () => {
  const t = (s) => tools.find((x) => x.slug === s)
  assert.deepEqual(t('gamma').keywords, ['slide deck', 'pitch deck', 'presentation'])
  assert.deepEqual(t('perplexity-comet').keywords, ['ai browser', 'web browser'])
  assert.deepEqual(t('intercom-fin').keywords, ['live chat', 'helpdesk'])
  assert.deepEqual(t('deepl-translator').keywords, ['translate pdf', 'translate word document'])
  assert.equal(t('google-antigravity').priceFrom, 'Free')
  const html = await (await (await app()).request('http://local/methodology')).text()
  for (const phrase of ['PowerPoint', 'filled up to three', 'without code matches no-code', 'paper or article does not count', 'website and build']) {
    assert.ok(html.includes(phrase), phrase)
  }
  assert.ok(!html.includes('\u2014'))
})

// Behavior tests for the Nov 21, 2026 release 3 search rules: synonyms, keywords, R5 (type),
// R6 (price words), and R7 (status), on fixtures, plus checks on the real catalog and pages.
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
const app = async () => (await import('../src/index.js')).default

test('synonyms: presentation matches slides and deck; an input-only mention does not count', () => {
  const deck = tool({ slug: 'deck', name: 'Ledger', bestFor: ['slide decks for a pitch'], rank: 2 })
  const input = tool({ slug: 'input', category: 'video', name: 'Reel', bestFor: ['turning decks into avatar videos'], rank: 1 })
  const list = rankTools([deck, input], 'make a presentation')
  assert.equal(list[0].slug, 'deck')
  assert.ok(!list.some((t) => t.slug === 'input'))
})

test('keywords score like a best-for tag', () => {
  const plain = tool({ slug: 'plain', name: 'Birch', bestFor: ['helpdesk replies'], rank: 1 })
  const kw = tool({ slug: 'kw', name: 'Cedar', bestFor: ['helpdesk replies'], keywords: ['helpdesk'], rank: 2 })
  assert.deepEqual(slugs(rankTools([plain, kw], 'helpdesk')), ['kw', 'plain'])
})

test('AI browser counts as one matched idea and also matches agentic browser', () => {
  const a = tool({ slug: 'a', category: 'agents', name: 'Arc', bestFor: ['a built-in agentic browser'], rank: 3 })
  const b = tool({ slug: 'b', category: 'agents', name: 'Bay', tagline: 'agent that opens a browser for you', rank: 1 })
  const list = rankTools([a, b], 'ai browser')
  assert.equal(list[0].slug, 'a')
  // With only one strong match, a 1-term tool may fill the numbered list.
  assert.deepEqual(slugs(topShown(list, 6)), ['a', 'b'])
  const c = tool({ slug: 'c', category: 'agents', name: 'Cape', bestFor: ['an AI browser for tabs'], rank: 4 })
  const d = tool({ slug: 'd', category: 'agents', name: 'Dock', bestFor: ['an agentic browser with a side panel'], rank: 5 })
  const many = topShown(rankTools([a, b, c, d], 'ai browser'), 6)
  assert.deepEqual(slugs(many), ['c', 'a', 'd'])
})

test('R5: models and developer tools follow apps unless the search asks for them', () => {
  const appT = tool({ slug: 'app', name: 'Quill', bestFor: ['harbor reports'], rank: 9 })
  const model = tool({ slug: 'model', name: 'Wave', type: 'api-model', bestFor: ['harbor reports'], rank: 1 })
  const ext = tool({ slug: 'ext', name: 'Clip', type: 'extension', bestFor: ['harbor reports'], rank: 2 })
  const list = rankTools([appT, model, ext], 'harbor reports')
  assert.deepEqual(slugs(list), ['app', 'ext', 'model'])
  assert.deepEqual(slugs(topShown(list, 6)), ['app', 'ext'])
  assert.equal(rankTools([appT, model, ext], 'harbor reports api')[0].slug, 'model')
  assert.equal(rankTools([appT, model, ext], 'harbor reports chrome extension')[0].slug, 'ext')
  const better = tool({ slug: 'better', name: 'Dock', type: 'developer-tool', bestFor: ['harbor reports with tide tables'], rank: 3 })
  assert.equal(rankTools([appT, better], 'harbor reports tide')[0].slug, 'better', 'a tool matching more words keeps its place')
})

test('R6: price words sort by plan, then the lowest starting price', () => {
  const byo = tool({ slug: 'byo', name: 'One', bestFor: ['coding help'], category: 'coding', freePlan: true, byoModel: true, priceFrom: 'Free', freeTier: true, rank: 1 })
  const pricey = tool({ slug: 'pricey', name: 'Two', bestFor: ['coding help'], category: 'coding', freePlan: true, byoModel: false, priceFrom: 'from $20/mo', freeTier: true, rank: 2 })
  const cheap = tool({ slug: 'cheap', name: 'Three', bestFor: ['coding help'], category: 'coding', freePlan: true, byoModel: false, priceFrom: 'from $8/mo', freeTier: true, rank: 3 })
  const paid = tool({ slug: 'paid', name: 'Four', bestFor: ['coding help'], category: 'coding', priceFrom: 'from $5/mo', rank: 0 })
  assert.deepEqual(slugs(rankTools([byo, pricey, cheap, paid], 'cheapest coding')), ['cheap', 'pricey', 'byo', 'paid'])
  assert.deepEqual(slugs(rankTools([byo, pricey, cheap, paid], 'low cost coding')), ['cheap', 'pricey', 'byo', 'paid'])
  assert.deepEqual(slugs(rankTools([byo, pricey, cheap, paid], 'coding')), ['paid', 'byo', 'pricey', 'cheap'], 'no price word, rank order')
})

test('R7: discontinued tools are left out; waitlists and APIs that are not live come after live tools', () => {
  const gone = tool({ slug: 'gone', name: 'Gone', status: 'discontinued', bestFor: ['harbor maps'], rank: 1 })
  const wait = tool({ slug: 'wait', name: 'Later', status: 'waitlist', bestFor: ['harbor maps'], rank: 2 })
  const live = tool({ slug: 'live', name: 'Now', bestFor: ['harbor maps'], rank: 3 })
  assert.deepEqual(slugs(rankTools([gone, wait, live], 'harbor maps')), ['live', 'wait'])
  assert.equal(rankTools([gone, wait, live], 'Gone')[0].slug, 'gone', 'a name search still finds it')
})

test('real catalog: release 3 data fields', () => {
  const t = (s) => tools.find((x) => x.slug === s)
  assert.equal(t('sora').status, 'discontinued')
  assert.equal(t('seedream-5-5').status, 'api-not-live')
  assert.equal(t('claude-duet').status, 'waitlist')
  assert.equal(t('perplexity-comet').type, 'browser')
  assert.equal(t('opencode-browse').type, 'extension')
  assert.ok(t('gamma').keywords.includes('pitch deck'))
  for (const x of tools) {
    if ('freePlan' in x) assert.equal(typeof x.freePlan, 'boolean', x.slug)
    if ('byoModel' in x) assert.equal(typeof x.byoModel, 'boolean', x.slug)
    if (x.type) assert.ok(['app', 'browser', 'api-model', 'open-weight-model', 'infrastructure', 'developer-tool', 'extension'].includes(x.type), x.slug)
    if (x.status) assert.ok(['live', 'discontinued', 'api-not-live', 'waitlist', 'retiring'].includes(x.status), x.slug)
  }
  const shown = (q) => slugs(topShown(rankTools(tools, q), 6))
  assert.equal(shown('run coding agents in parallel')[0], 'harness-autonomous')
  assert.equal(shown('snapchat lenses')[0], 'easy-lens-cli')
  assert.equal(shown('website to markdown')[0], 'firecrawl')
  assert.ok(!shown('transparent background images').includes('seedream-5-5'))
  assert.equal(shown('seedream 5.5')[0], 'seedream-5-5')
})

test('/tools.json publishes the new fields and /methodology describes them', async () => {
  const a = await app()
  const api = await (await a.request('http://local/tools.json')).json()
  const list = api.tools || api.items || api
  const g = list.find((x) => x.slug === 'gamma')
  assert.equal(g.type, 'app')
  assert.equal(g.status, 'live')
  assert.deepEqual(g.keywords, ['slide deck', 'pitch deck', 'presentation'])
  const c = list.find((x) => x.slug === 'github-copilot')
  assert.equal(c.freePlan, true)
  assert.equal(c.byoModel, false)
  assert.equal(list.find((x) => x.slug === 'claude').freePlan, null)
  const m = await (await a.request('http://local/methodology')).text()
  for (const phrase of ['presentation matches slides', 'Each listing has a type', 'Discontinued tools are left out', 'low cost', 'bring and pay for your own model']) assert.ok(m.includes(phrase), phrase)
  assert.ok(!m.includes('\u2014'))
})

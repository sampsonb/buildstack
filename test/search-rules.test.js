// Behavior tests for the Nov 21, 2026 search rules (R1-R4, R8), on small fixtures where possible
// so each rule is checked on its own, plus rendered results pages for related searches.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools, topShown } from '../src/search.js'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
let n = 0
function tool(over) {
  n += 1
  return { slug: `t${n}`, name: `Tool ${n}`, category: 'writing', rank: n, tagline: '', description: '', bestFor: [], pricingNote: '', priceFrom: 'Free', freeTier: true, ...over }
}
const slugs = (list) => list.map((t) => t.slug)
async function page(q) {
  const app = (await import('../src/index.js')).default
  const html = await (await app.request(`http://local/?q=${encodeURIComponent(q)}`)).text()
  const rel = html.slice(html.indexOf('id="related"'), html.indexOf('</section>', html.indexOf('id="related"')))
  return { html, rel, links: [...rel.matchAll(/<a href="\/\?q=([^"]+)">/g)].map((m) => decodeURIComponent(m[1])) }
}

test('R1: tools matching more query words come first; single-word matches wait under Show all', () => {
  const one = tool({ slug: 'one', name: 'Lattice', bestFor: ['harbor maps'], rank: 1 })
  const two = tool({ slug: 'two', name: 'Quarry', bestFor: ['harbor maps with tide tables'], rank: 2 })
  const list = rankTools([one, two], 'harbor tide')
  assert.deepEqual(slugs(list), ['two', 'one'])
  // With only one 2-word match, the numbered list is filled to 3 from the next best matches.
  assert.deepEqual(slugs(topShown(list, 6)), ['two', 'one'])
  const third = tool({ slug: 'three', name: 'Reef', bestFor: ['harbor tide charts'], rank: 3 })
  const fourth = tool({ slug: 'four', name: 'Cove', bestFor: ['harbor maps'], rank: 4 })
  const fifth = tool({ slug: 'five', name: 'Shoal', bestFor: ['harbor tide logs'], rank: 5 })
  assert.deepEqual(slugs(topShown(rankTools([one, two, third, fourth, fifth], 'harbor tide'), 6)), ['three', 'five', 'two'])
  const flat = rankTools([one, two], 'harbor')
  assert.deepEqual(slugs(topShown(flat, 6)), ['one', 'two'])
})

test('R1: assistant still scores but does not count as a matched word', () => {
  const a = tool({ slug: 'a', category: 'coding', name: 'Hammer', bestFor: ['coding help'], rank: 1 })
  const b = tool({ slug: 'b', category: 'coding', name: 'Anvil', bestFor: ['coding help from your assistant'], rank: 2 })
  const list = rankTools([a, b], 'coding assistant')
  assert.deepEqual(slugs(list), ['b', 'a'])
  assert.deepEqual(slugs(topShown(list, 6)), ['b', 'a'], 'a is not pushed under Show all')
})

test('R2: a name match on the category word scores like a category match, not a name match', () => {
  const named = tool({ slug: 'named', category: 'coding', name: 'Fern Code', tagline: 'terminal agent', rank: 1 })
  const tagged = tool({ slug: 'tagged', category: 'coding', name: 'Moss', bestFor: ['coding in the terminal'], rank: 2 })
  assert.deepEqual(slugs(rankTools([named, tagged], 'coding')), ['tagged', 'named'])
  assert.equal(rankTools([named, tagged], 'Fern Code')[0].slug, 'named')
})

test('R3: two adjacent query words side by side, including ai, add a phrase bonus', () => {
  const loose = tool({ slug: 'loose', category: 'agents', name: 'Kite', tagline: 'an ai agent that can open a browser', rank: 1 })
  const phrase = tool({ slug: 'phrase', category: 'agents', name: 'Comet Lite', tagline: 'an AI browser for research', rank: 2 })
  assert.deepEqual(slugs(rankTools([loose, phrase], 'ai browser')), ['phrase', 'loose'])
})

test('R4: no category group when the narrowest word spreads across categories with no two-thirds lead', () => {
  const w = [1, 2, 3].map((i) => tool({ slug: `w${i}`, category: 'writing', name: `Quill ${i}`, bestFor: ['plain text deck notes'], rank: i }))
  const img = [4, 5].map((i) => tool({ slug: `i${i}`, category: 'images', name: `Deck Studio ${i}`, bestFor: ['deck design'], rank: i }))
  const top = slugs(rankTools([...w, ...img], 'deck').slice(0, 2))
  assert.deepEqual(top, ['i4', 'i5'])
  const strong = [1, 2, 3, 4].map((i) => tool({ slug: `s${i}`, category: 'voice', name: `Speak ${i}`, bestFor: ['speech for podcasts'], rank: i + 10 }))
  const odd = tool({ slug: 'odd', category: 'video', name: 'Reel Speech', bestFor: ['speech in videos'], rank: 1 })
  assert.equal(rankTools([...strong, odd], 'speech')[0].category, 'voice')
})

test('apps come before raw models unless the query asks for a model', () => {
  const app = tool({ slug: 'app', category: 'voice', name: 'Caller', bestFor: ['phone calls for shops'], rank: 9 })
  const model = tool({ slug: 'model', category: 'voice', name: 'Wave', tagline: 'voice agent model for phone calls', bestFor: ['phone calls at scale'], priceFrom: 'API from $1/1M in', rank: 1 })
  const list = rankTools([app, model], 'phone calls')
  assert.deepEqual(slugs(list), ['app', 'model'])
  assert.deepEqual(slugs(topShown(list, 6)), ['app'])
  assert.equal(rankTools([app, model], 'phone calls model')[0].slug, 'model')
})

test('real catalog: R1 to R4 fix the stray matches the review found', () => {
  const shown = (q) => slugs(topShown(rankTools(tools, q), 6))
  assert.deepEqual(shown('phone calls').slice(0, 4), ['retell-ai', 'bland-ai', 'call-e', 'vapi'])
  assert.ok(!shown('phone calls').includes('phonic-1'))
  assert.equal(shown('translate a document')[0], 'deepl-translator')
  assert.ok(!shown('translate a document').includes('gamma'))
  assert.ok(rankTools(tools, 'translate a document').some((t) => t.slug === 'gamma'), 'weak matches stay under Show all')
  assert.equal(shown('ai browser')[0], 'perplexity-comet')
  assert.ok(!shown('customer support chatbot for my website').includes('nod'))
  assert.equal(rankTools(tools, 'text to speech')[0].category, 'voice')
})

test('R8: related searches follow the top result and link the matching guide', async () => {
  const tr = await page('translate a document')
  assert.equal(tr.links.length, 3)
  assert.ok(tr.links.includes('translate a pdf'), tr.links.join(', '))
  assert.ok(!tr.links.includes('write blog posts'), tr.links.join(', '))
  assert.ok(tr.rel.includes('href="/best/ai-writing-tool"'))
  const ph = await page('phone calls')
  assert.ok(!ph.links.includes('phone calls'))
  assert.ok(ph.rel.includes('href="/category/agents"'))
  assert.ok(ph.rel.includes('href="/best/ai-agent-builder"'))
  assert.ok((await page('transcribe meetings')).rel.includes('href="/best/ai-transcription-tool"'))
})

test('R8: every related search shown for the regression queries returns the same category first', async () => {
  const qs = ['ai for writing blog posts', 'ai browser', 'cheapest coding assistant', 'phone calls', 'make a presentation', 'summarize a pdf', 'remove background from a photo', 'build a website without code', 'translate a document', 'customer support chatbot for my website', 'write blog posts', 'make a logo', 'edit a podcast', 'text to speech']
  for (const q of qs) {
    const { links } = await page(q)
    const cat = rankTools(tools, q)[0].category
    assert.equal(links.length, 3, q)
    for (const r of links) assert.equal(rankTools(tools, r)[0].category, cat, `${q} -> ${r}`)
  }
})

test('results page numbers only the strong matches and keeps the rest under Show all', async () => {
  const { html } = await page('translate a document')
  const numbered = html.slice(0, html.indexOf('<details class="more">'))
  assert.ok(numbered.includes('href="/tool/deepl-translator"'))
  assert.ok(!numbered.includes('href="/tool/gamma"'))
  assert.ok(html.includes(`Show all ${rankTools(tools, 'translate a document').length} results`))
})

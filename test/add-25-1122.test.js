import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const srcJson = readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8')
const dataJson = readFileSync(new URL('../data/tools.json', import.meta.url), 'utf8')
const tools = JSON.parse(srcJson)
const by = Object.fromEntries(tools.map((t) => [t.slug, t]))
const app = (await import('../src/index.js')).default
async function get(path) {
  const r = await app.request(`http://local${path}`)
  return { status: r.status, html: await r.text() }
}

const ADDED = [
  ['researchrabbit', 'ResearchRabbit', 'https://www.researchrabbit.ai', 'research', true, false],
  ['litmaps', 'Litmaps', 'https://www.litmaps.com', 'research', true, true],
  ['julius', 'Julius AI', 'https://julius.ai', 'research', true, true],
  ['paperpal', 'Paperpal', 'https://paperpal.com', 'research', false, false],
  ['playground', 'Playground AI', 'https://playgroundai.com', 'images', true, true],
  ['getimg', 'getimg.ai', 'https://getimg.ai', 'images', false, true],
  ['picsart', 'Picsart', 'https://picsart.com', 'images', false, true],
  ['invideo', 'InVideo', 'https://invideo.io', 'video', false, true],
  ['pictory', 'Pictory', 'https://pictory.ai', 'video', false, true],
  ['hyperframes', 'HyperFrames', 'https://hyperframes.studio', 'video', true, true],
  ['remotion', 'Remotion', 'https://www.remotion.dev', 'video', true, true],
  ['warp', 'Warp', 'https://www.warp.dev', 'coding', true, true],
  ['aider', 'Aider', 'https://aider.chat', 'coding', true, false],
  ['coderabbit', 'CodeRabbit', 'https://www.coderabbit.ai', 'coding', false, true],
  ['krisp', 'Krisp', 'https://krisp.ai', 'voice', false, true],
  ['tldv', 'tl;dv', 'https://tldv.io', 'voice', true, false],
  ['notta', 'Notta', 'https://www.notta.ai', 'voice', true, true],
  ['murf', 'Murf', 'https://murf.ai', 'voice', true, false],
  ['speechify', 'Speechify', 'https://speechify.com', 'voice', true, true],
  ['jenni', 'Jenni', 'https://jenni.ai', 'writing', true, true],
  ['copy-ai', 'Copy.ai', 'https://www.copy.ai', 'writing', false, true],
  ['writesonic', 'Writesonic', 'https://writesonic.com', 'writing', false, true],
  ['sudowrite', 'Sudowrite', 'https://www.sudowrite.com', 'writing', false, true],
]

test('2026-11-22 catalog add: 23 tools, 201 total, unique contiguous ranks, src matches data', () => {
  assert.equal(tools.length, 213)
  assert.equal(srcJson, dataJson)
  assert.ok(tools.every((t, i) => t.rank === i + 1))
  assert.equal(new Set(tools.map((t) => t.slug)).size, 213)
  assert.equal(/[\u2013\u2014]/.test(srcJson), false)
  assert.equal(tools.filter((t) => t.rankReason).every((t) => t.rank <= 30), true)
  assert.equal(tools[29].rank, 30)
})

test('2026-11-22 added tools have official urls, honest flags, and checked prices only from today', () => {
  assert.equal(ADDED.length, 23)
  for (const [slug, name, url, category, freeTier, checked] of ADDED) {
    const t = by[slug]
    assert.ok(t, slug)
    assert.equal(t.name, name)
    assert.equal(t.url, url)
    assert.equal(t.category, category)
    assert.equal(t.freeTier, freeTier)
    assert.equal(t.added, '2026-11-22')
    assert.equal(t.updated, '2026-11-22')
    assert.equal(t.featured, false)
    assert.equal(t.affiliate, false)
    assert.equal(t.rankReason, undefined)
    assert.ok(t.rank > 30, slug)
    assert.ok(t.tagline && t.description && t.strength && t.watchOut && t.pricingNote, slug)
    assert.equal(t.bestFor.length, 3)
    const copy = `${t.tagline} ${t.description} ${t.pricingNote} ${t.strength} ${t.watchOut} ${t.bestFor.join(' ')}`
    assert.equal(/[\u2013\u2014]/.test(copy), false, slug)
    if (checked) {
      assert.ok(t.priceChecked >= '2026-11-22', slug)
      assert.ok(t.pricingUrl && t.pricingUrl.startsWith('https://'), slug)
    } else {
      assert.equal(t.priceChecked, undefined, slug)
    }
  }
  assert.equal(tools.filter((t) => t.priceChecked && t.pricingUrl).length, 126)
})

test('2026-11-22 added tools sit in the intended bands, with neighbors in order', () => {
  assert.equal(by.researchrabbit.rank, by['semantic-scholar'].rank + 1)
  assert.equal(by.litmaps.rank, by.researchrabbit.rank + 1)
  assert.equal(by.scispace.rank, by.litmaps.rank + 1)
  assert.equal(by.julius.rank, by.scholarcy.rank + 1)
  assert.equal(by.paperpal.rank, by.julius.rank + 1)
  assert.equal(by.sciground.rank, by.paperpal.rank + 1)
  assert.equal(by.playground.rank, by['adobe-firefly'].rank + 1)
  assert.equal(by.getimg.rank, by.playground.rank + 1)
  assert.equal(by.magnific.rank, by.getimg.rank + 1)
  assert.equal(by.picsart.rank, by['adobe-express'].rank + 1)
  assert.equal(by.photoroom.rank, by.picsart.rank + 1)
  assert.equal(by.invideo.rank, by.descript.rank + 1)
  assert.equal(by.veed.rank, by.invideo.rank + 1)
  assert.equal(by.pictory.rank, by.captions.rank + 1)
  assert.equal(by.riverside.rank, by.pictory.rank + 1)
  assert.equal(by.hyperframes.rank, by.kino.rank + 1)
  assert.equal(by.remotion.rank, by.hyperframes.rank + 1)
  assert.equal(by.sora.rank, by.remotion.rank + 1)
  assert.equal(by.warp.rank, by['gemini-4-neon'].rank - 2)
  assert.equal(by.aider.rank, by.warp.rank + 1)
  assert.equal(by['gemini-4-neon'].rank, by.aider.rank + 1)
  assert.equal(by.testsprite.rank, by.coderabbit.rank + 1)
  assert.equal(by.krisp.rank, by['wispr-flow'].rank + 1)
  assert.equal(by.tldv.rank, by.krisp.rank + 1)
  assert.equal(by.notta.rank, by['read-ai'].rank + 1)
  assert.equal(by.murf.rank, by.rev.rank + 1)
  assert.equal(by.speechify.rank, by.murf.rank + 1)
  assert.equal(by['deepl-voice'].rank, by.speechify.rank + 1)
  assert.equal(by.jenni.rank, by.wordtune.rank + 1)
  assert.equal(by['copy-ai'].rank, by.jenni.rank + 1)
  assert.equal(by.jasper.rank, by['copy-ai'].rank + 1)
  assert.equal(by.writesonic.rank, by.jasper.rank + 1)
  assert.equal(by.sudowrite.rank, by['tk-medium'].rank + 1)
  assert.equal(by.kudonovel.rank, by.sudowrite.rank + 1)
})

test('Muse from Meta still points at Meta official muse.ai, with prices unchecked', () => {
  const t = by['muse-from-meta']
  assert.equal(t.url, 'https://muse.ai')
  assert.equal(t.category, 'agents')
  assert.equal(t.pricingUrl, undefined)
  assert.equal(t.priceChecked, undefined)
  assert.equal(t.priceFrom, 'Free')
  assert.match(t.pricingNote, /Power plan \$20 a month .*Maximum plan \$100 a month/)
})

test('rank changelog leads with the 23-tool add, and new tool pages and counts work', async () => {
  const log = await get('/rank-changelog')
  assert.equal(log.status, 200)
  const text = log.html.replace(/<[^>]+>/g, ' ')
  assert.ok(text.includes('Nov 22, 2026: Catalog add: 23 tools'))
  assert.ok(text.includes('178 to 201'))
  for (const [slug] of ADDED) {
    const t = by[slug]
    assert.ok(log.html.includes(`<a href="/tool/${slug}">${t.name}</a>, now #${t.rank} overall`), slug)
  }
  const llms = (await get('/llms.txt')).html
  assert.ok(llms.includes('Tools: 213'))
  const home = await get('/')
  assert.equal(home.status, 200)
  assert.ok(home.html.includes('213') || home.html.replace(/<[^>]+>/g, ' ').includes('213'))
  for (const slug of ['invideo', 'hyperframes', 'remotion', 'warp', 'jenni', 'researchrabbit']) {
    const page = await get(`/tool/${slug}`)
    assert.equal(page.status, 200, slug)
    assert.equal(/\u2014/.test(page.html), false, slug)
  }
})

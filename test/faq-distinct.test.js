import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// SEO item 4 (2026-11-17): tool FAQ answers must not repeat the page's Best for list or the
// overview. Free-tier and head-to-head answers come only from tools.json fields.
const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
async function faqOf(slug) {
  const app = (await import('../src/index.js')).default
  const html = await (await app.request(`http://local/tool/${slug}`)).text()
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1])
  return ld['@graph'].find((n) => n['@type'] === 'FAQPage').mainEntity
}

test('no tool FAQ repeats the Best for list or the description', async () => {
  for (const t of tools) {
    const faq = await faqOf(t.slug)
    for (const q of faq) {
      assert.equal(q.name.endsWith(' best for?'), false, t.slug)
      assert.equal(q.acceptedAnswer.text.includes(t.description), false, t.slug)
      assert.equal(/\u2014/.test(q.name + q.acceptedAnswer.text), false, t.slug)
    }
  }
})

test('free-tier answer matches tools.json, head-to-head names a real category neighbour', async () => {
  for (const t of tools) {
    const faq = await faqOf(t.slug)
    const free = faq.find((q) => q.name === `Is there a free version of ${t.name}?`)
    if (typeof t.freeTier === 'boolean') assert.ok(free.acceptedAnswer.text.startsWith(t.freeTier ? 'Yes.' : 'No.'), t.slug)
    const inCat = tools.filter((x) => x.category === t.category).sort((a, b) => a.rank - b.rank)
    const i = inCat.findIndex((x) => x.slug === t.slug)
    const rival = i > 0 ? inCat[i - 1] : inCat[1]
    const vs = faq.find((q) => q.name.startsWith(`${t.name} or `))
    if (rival && t.bestFor.length && rival.bestFor.length) assert.equal(vs.name, `${t.name} or ${rival.name}: which should I pick?`, t.slug)
  }
})

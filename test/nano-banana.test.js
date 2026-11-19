import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools } from '../src/search.js'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))

test('Nano Banana and ChatGPT Images are listed in images, ranked above Midjourney', () => {
  const nb = tools.find((t) => t.slug === 'nano-banana')
  const ci = tools.find((t) => t.slug === 'chatgpt-images')
  const mj = tools.find((t) => t.slug === 'midjourney')
  assert.ok(nb && ci && mj)
  assert.equal(nb.category, 'images')
  assert.equal(ci.category, 'images')
  assert.ok(nb.rank < ci.rank && ci.rank < mj.rank)
  assert.ok(tools.every((t, i) => t.rank === i + 1), 'ranks are consecutive')
})

test('image editing queries surface the new image tools', () => {
  for (const q of ['nano banana', 'edit a photo', 'image editing', 'chatgpt images']) {
    const slugs = rankTools(tools, q).slice(0, 5).map((t) => t.slug)
    const want = q === 'chatgpt images' ? 'chatgpt-images' : 'nano-banana'
    assert.ok(slugs.includes(want), `${q}: ${slugs.join(',')}`)
  }
  assert.equal(rankTools(tools, 'nano banana')[0].slug, 'nano-banana')
})

test('tool pages return 200 for the new tools', async () => {
  const app = (await import('../src/index.js')).default
  for (const s of ['nano-banana', 'chatgpt-images']) {
    const res = await app.request(`http://local/tool/${s}`)
    assert.equal(res.status, 200)
    assert.ok(!(await res.text()).includes('\u2014'))
  }
})

import assert from 'node:assert/strict'
import { test } from 'node:test'

async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text(), loc: res.headers.get('location') }
}

test('vs pages render from tools.json with editor, FAQ schema and no em dash', async () => {
  const { html: idx, status: s0 } = await get('/vs')
  assert.equal(s0, 200)
  const paths = [...idx.matchAll(/href="(\/vs\/[a-z0-9-]+-vs-[a-z0-9-]+)"/g)].map((m) => m[1])
  assert.ok(paths.length >= 10, String(paths.length))
  for (const p of paths) {
    const { status, html } = await get(p)
    assert.equal(status, 200, p)
    assert.match(html, /Edited by <a href="\/about">Sampson Brueher<\/a>/, p)
    assert.match(html, /"@type":"FAQPage"/, p)
    assert.ok(!html.includes('\u2014'), p)
  }
})

test('reverse order redirects and unknown pairs 404', async () => {
  const r = await get('/vs/claude-vs-chatgpt')
  assert.equal(r.status, 301)
  assert.match(r.loc, /\/vs\/chatgpt-vs-claude$/)
  assert.equal((await get('/vs/foo-vs-bar')).status, 404)
})

test('vs pages are in the sitemap, llms.txt and linked from tool pages', async () => {
  const sm = (await get('/sitemap.xml')).html
  assert.match(sm, /\/vs\/cursor-vs-github-copilot<\/loc>/)
  assert.match(sm, /\/vs<\/loc>/)
  assert.match((await get('/llms.txt')).html, /## Head to head comparisons/)
  assert.match((await get('/tool/cursor')).html, /href="\/vs\/cursor-vs-windsurf"/)
})

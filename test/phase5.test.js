import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools } from '../src/search.js'

// Phase 5 redesign: results are ranked rows with a free-tier filter and related searches;
// tool pages have a breadcrumb, a rank placard, one price box, and Strength/Watch-out up top.
const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}
const ldOf = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
const slugsIn = (html) => [...html.matchAll(/<article class="card">[\s\S]*?<h3><a href="\/tool\/([^"]+)"/g)].map((m) => m[1])

test('results: one h1, rows, count line, filter and clear links, canonical stays the plain query', async () => {
  const q = 'write blog posts'
  const { status, html } = await get(`/?q=${encodeURIComponent(q)}`)
  assert.equal(status, 200)
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1)
  assert.ok(html.includes('<h1>Best fit for “write blog posts”</h1>'))
  assert.ok(html.includes('<div class="rows">'))
  assert.ok(html.includes(`${rankTools(tools, q).length} matching tools, ranked from ${tools.length}.`))
  assert.ok(html.includes('<a href="/?q=write%20blog%20posts&amp;free=1">Free tier only</a>'))
  assert.ok(html.includes('<a href="/">Clear search</a>'))
  assert.ok(html.includes('<meta name="robots" content="noindex, follow"/>'))
  assert.ok(html.includes('<link rel="canonical" href="https://buildstack.tier11.com/?q=write%20blog%20posts"/>'))
})

test('free-tier filter keeps fit order and shows only tools with a free tier', async () => {
  for (const q of ['write blog posts', 'edit a podcast', 'make short videos', 'build an app']) {
    const all = rankTools(tools, q)
    const want = all.filter((t) => t.freeTier === true).map((t) => t.slug)
    const { html } = await get(`/?q=${encodeURIComponent(q)}&free=1`)
    const sec = html.slice(html.indexOf('<section class="section results">'), html.indexOf('id="related"'))
    assert.deepEqual(slugsIn(sec), want, q)
    assert.ok(sec.includes(`${want.length} of ${all.length} matches have a free tier`), q)
    assert.ok(sec.includes('aria-current="true">Free tier only'), q)
    assert.ok(html.includes(`<link rel="canonical" href="https://buildstack.tier11.com/?q=${encodeURIComponent(q)}"/>`), q)
    assert.ok(html.includes('<meta name="robots" content="noindex, follow"/>'), q)
  }
})

test('related searches: three per results page, never the current query, plus the category link', async () => {
  for (const q of ['write blog posts', 'refactor code', 'transcribe a meeting', 'make a logo']) {
    const { html } = await get(`/?q=${encodeURIComponent(q)}`)
    const rel = html.slice(html.indexOf('id="related"'), html.indexOf('</section>', html.indexOf('id="related"')))
    const links = [...rel.matchAll(/<a href="\/\?q=([^"]+)">/g)].map((m) => decodeURIComponent(m[1]))
    assert.equal(links.length, 3, q)
    assert.equal(links.includes(q), false, q)
    const top = rankTools(tools, q)[0]
    assert.ok(rel.includes(`href="/category/${top.category}"`), q)
    for (const r of links) assert.equal(rankTools(tools, r)[0].category, top.category, `${q} -> ${r}`)
  }
  const { html } = await get('/?q=zzzzqqqq')
  assert.ok(html.includes('No matches. Try a broader phrase.'))
  assert.ok(html.includes('id="related"'))
})

test('tool page: breadcrumb, placard, Strength and Watch-out up top, honest placement line', async () => {
  for (const t of tools) {
    const { html } = await get(`/tool/${t.slug}`)
    assert.ok(html.includes(`<nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/category/${t.category}">`), t.slug)
    assert.ok(html.indexOf('<div class="sw">') < html.indexOf('<h2>What it is</h2>'), t.slug)
    assert.ok(html.includes('Paid placement: none. <a href="/methodology">Rank and search position are never sold</a>'), t.slug)
    assert.equal((html.match(/<h1>/g) || []).length, 1, t.slug)
  }
})

test('tool page: every FAQPage question in JSON-LD is still visible, the cost answer once, in the pricing section', async () => {
  for (const t of tools) {
    const { html } = await get(`/tool/${t.slug}`)
    const faq = ldOf(html)[0]['@graph'].find((n) => n['@type'] === 'FAQPage')
    const visible = unesc(html.slice(html.indexOf('<body>')).replace(/<script[\s\S]*?<\/script>/g, ''))
    for (const q of faq.mainEntity) assert.equal(visible.split(q.name).length - 1, 1, `${t.slug}: ${q.name}`)
    const cost = faq.mainEntity.find((q) => q.name.startsWith('How much does '))
    const strip = (x) => unesc(x.replace(/<[^>]+>/g, ''))
    const sec = html.slice(html.indexOf('<section class="tsec" id="pricing">'), html.indexOf('</section>', html.indexOf('id="pricing"')))
    assert.ok(strip(sec).includes(cost.acceptedAnswer.text), t.slug)
    assert.equal(strip(html.slice(html.indexOf('<body>')).replace(/<script[\s\S]*?<\/script>/g, '')).split(cost.acceptedAnswer.text).length - 1, 1, t.slug)
  }
})

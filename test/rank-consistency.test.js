import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools } from '../src/search.js'

// Phase 1 redesign: one rank meaning per surface, and every rank number on a page agrees
// with tools.json. Results: big number = fit for this query. Tool page: big number = place in
// category. Guides: prose, table, and glance cards all use the overall rank.
const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const byRank = [...tools].sort((a, b) => a.rank - b.rank)
const bySlug = Object.fromEntries(tools.map((t) => [t.slug, t]))
const LABEL = { coding: 'Coding', writing: 'Writing', images: 'Images', video: 'Video', agents: 'Agents', research: 'Research', voice: 'Voice' }
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
const inCat = (t) => byRank.filter((x) => x.category === t.category)
const catPos = (t) => inCat(t).findIndex((x) => x.slug === t.slug) + 1
const catPlace = (t) => `${ord(catPos(t))} of ${inCat(t).length} in ${LABEL[t.category]}`
const overallPlace = (t) => `${ord(t.rank)} of ${byRank.length} overall`

async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}
function cards(html) {
  return [...html.matchAll(/<article class="card">([\s\S]*?)<\/article>/g)].map((m) => {
    const meta = m[1].match(/<div class="meta">([\s\S]*?)<\/div>/)[1]
    return {
      slug: m[1].match(/<h3><a href="\/tool\/([^"]+)"/)[1],
      pos: (meta.match(/<span class="pos" aria-hidden="true">(\d+)<\/span>/) || [])[1],
      line: (meta.match(/<span class="rankline">([^<]*)<\/span>/) || [])[1],
      meta,
    }
  })
}
async function guidePaths() {
  const { html } = await get('/sitemap.xml')
  return [...html.matchAll(/<loc>https:\/\/buildstack\.tier11\.com(\/(?:best|alternatives)\/[^<]+)<\/loc>/g)].map((m) => m[1])
}

test('results: big number is the fit rank, category place is small text, no second # number', async () => {
  for (const q of ['write blog posts', 'edit a podcast', 'build an app', 'make a logo', 'transcribe a meeting']) {
    const expected = rankTools(tools, q)
    const { html } = await get(`/?q=${encodeURIComponent(q)}`)
    const start = html.indexOf('Best fit for')
    const section = html.slice(start, html.indexOf('</section>', start))
    const cs = cards(section)
    assert.deepEqual(cs.map((c) => c.slug), expected.map((t) => t.slug), q)
    cs.forEach((c, i) => {
      assert.equal(Number(c.pos), i + 1, q)
      assert.equal(c.meta.includes('#'), false, `${q}: ${c.slug} meta has a # number`)
      assert.equal(c.line, `${i === 0 ? 'Top pick for this search. ' : ''}${catPlace(bySlug[c.slug])}`, q)
    })
  }
})

test('Descript on a podcast search reads as best fit 1, not a clashing #10 in Video', async () => {
  const { html } = await get('/?q=edit%20a%20podcast')
  const c = cards(html).find((x) => x.slug === 'descript')
  assert.ok(c)
  assert.equal(c.meta.includes('#'), false)
  assert.match(c.line, / of \d+ in Video$/)
})

test('tool pages: one big rank (place in category) and overall only as small text', async () => {
  for (const t of tools) {
    const { status, html } = await get(`/tool/${t.slug}`)
    assert.equal(status, 200)
    const meta = html.match(/<section class="hero">\s*<div class="meta">([\s\S]*?)<\/div>/)[1]
    assert.equal((meta.match(/#\d+/g) || []).length, 1, t.slug)
    assert.ok(meta.includes(`<a class="rank" href="/category/${t.category}">#${catPos(t)} in ${LABEL[t.category]}</a>`), t.slug)
    assert.ok(meta.includes(`<span class="rankline">${overallPlace(t)}</span>`), t.slug)
    for (const c of cards(html)) assert.equal(c.line, catPlace(bySlug[c.slug]), `${t.slug} related ${c.slug}`)
  }
})

test('guides: prose, table, and glance cards all use the same overall rank', async () => {
  const paths = await guidePaths()
  assert.ok(paths.length >= 12)
  for (const p of paths) {
    const { status, html } = await get(p)
    assert.equal(status, 200, p)
    const body = html.slice(html.indexOf('<main'))
    for (const c of cards(body.slice(body.indexOf('id="decide"'), body.indexOf('</section>', body.indexOf('id="decide"'))))) {
      assert.equal(c.pos, undefined, `${p} ${c.slug}`)
      assert.equal(c.line, overallPlace(bySlug[c.slug]), `${p} ${c.slug}`)
    }
    // linked name followed by (#N ...) in prose and headings
    for (const m of body.matchAll(/href="\/tool\/([^"]+)">[^<]*<\/a>\)? ?\(#(\d+)/g)) assert.equal(Number(m[2]), bySlug[m[1]].rank, `${p} prose ${m[1]}`)
    // table rows: tool link then #N cell
    for (const m of body.matchAll(/<td><a href="\/tool\/([^"]+)">[^<]*<\/a><\/td><td>#(\d+)<\/td>/g)) assert.equal(Number(m[2]), bySlug[m[1]].rank, `${p} table ${m[1]}`)
  }
})

test('coding guide: GitHub Copilot reads the same number in prose, table, and card', async () => {
  const cop = bySlug['github-copilot']
  const { html } = await get('/best/ai-coding-assistant')
  assert.ok(html.includes(`github-copilot">GitHub Copilot</a> (#${cop.rank})`))
  assert.ok(html.includes(`<td><a href="/tool/github-copilot">GitHub Copilot</a></td><td>#${cop.rank}</td>`))
  const c = cards(html).find((x) => x.slug === 'github-copilot')
  assert.equal(c.line, overallPlace(cop))
  assert.equal(html.includes(`#${catPos(cop)} in Coding`), false)
})

test('home Top ranked: big number is the overall rank', async () => {
  const { html } = await get('/')
  const start = html.indexOf('<h2>Top ranked</h2>')
  const rows = [...html.slice(start, html.indexOf('</section>', start)).matchAll(/<li><span class="pos" aria-hidden="true">(\d+)<\/span><span class="sr-only">Number (\d+) overall\. <\/span><div><h3><a href="\/tool\/([^"]+)">[^<]*<\/a><\/h3><p class="rankline">([^<]*)<\/p>/g)]
  assert.equal(rows.length, 12)
  rows.forEach((r, i) => { assert.equal(Number(r[1]), i + 1); assert.equal(Number(r[2]), i + 1); assert.equal(r[3], byRank[i].slug); assert.equal(r[4], catPlace(byRank[i])) })
})

test('a11y basics: one main landmark, labeled search, visible focus, no outline reset', async () => {
  const pages = ['/', '/?q=write%20blog%20posts', '/tool/claude', '/best/ai-coding-assistant', '/guides/how-celebrity-deepfakes-are-made', '/about', '/methodology', '/categories', '/category/coding', '/alternatives/cursor', '/get-featured']
  for (const p of pages) {
    const { status, html } = await get(p)
    assert.equal(status, 200, p)
    assert.equal((html.match(/<main id="main">/g) || []).length, 1, p)
    assert.equal((html.match(/<\/main>/g) || []).length, 1, p)
    assert.ok(html.includes('<a class="skip" href="#main">Skip to content</a>'), p)
    assert.equal(/outline:\s*0/.test(html), false, p)
    assert.ok(html.includes(':focus-visible { outline: 2px solid'), p)
    for (const m of html.matchAll(/<input ([^>]*)>/g)) {
      const id = (m[1].match(/id="([^"]+)"/) || [])[1]
      assert.ok(id && html.includes(`<label class="`) && new RegExp(`<label [^>]*for="${id}"`).test(html), `${p}: input without label`)
    }
    assert.equal(html.includes('\u2014'), false, p)
  }
  const { html } = await get('/')
  assert.match(html, /<label class="searchlabel" for="q">Describe the job you need an AI tool for<\/label>/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools } from '../src/search.js'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const byRank = [...tools].sort((a, b) => a.rank - b.rank)
const GUIDE = '/guides/how-celebrity-deepfakes-are-made'

async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}

function navOf(html) {
  return html.match(/<div class="navlinks">([\s\S]*?)<\/div>/)[1]
}

function footerOf(html) {
  return html.match(/<footer class="footer">([\s\S]*?)<\/footer>/)[1]
}

function bodyOf(html) {
  return html.slice(html.indexOf('<body>'))
}

test('nav and footer: no Get featured, one footer row with List your tool', async () => {
  for (const path of ['/', '/tool/claude', '/category/writing', GUIDE, '/methodology']) {
    const { html } = await get(path)
    const nav = navOf(html)
    const labels = [...nav.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[2], m[1]])
    assert.deepEqual(labels, [['Best for', '/#best-for'], ['Categories', '/categories'], ['New', '/#new'], ['How we rank', '/methodology'], ['About', '/about']], path)
    const foot = footerOf(html)
    assert.equal((foot.match(/List your tool/g) || []).length, 1, path)
    assert.match(foot, /href="https:\/\/itsbuildstack\.substack\.com"/)
    assert.match(foot, /href="\/about#chatbots">For chatbots</)
    assert.ok((foot.match(/<a /g) || []).length <= 10, path)
    assert.equal(foot.includes('/best/'), false, path)
    assert.equal(bodyOf(html).includes('Get featured'), false, path)
    assert.equal(bodyOf(html).includes('For chatbots</a>\n'), false, path)
  }
})

test('get-featured page is neutral: no Stripe, no test-mode wording, ranks not for sale', async () => {
  const { status, html } = await get('/get-featured')
  assert.equal(status, 200)
  const body = bodyOf(html)
  assert.equal(/stripe/i.test(body), false)
  assert.equal(/test mode|live charges|Sampson approves/i.test(body), false)
  assert.match(body, /Paid placements are not offered yet, and ranks are never for sale\./)
  assert.match(body, /mailto:buildstack@tier11\.com/)
})

test('tool page: no Get featured button, overall rank only here, no repeated FAQ answer', async () => {
  const claude = byRank.find((t) => t.slug === 'claude')
  const { html } = await get('/tool/claude')
  assert.match(html, new RegExp(`<span class="rank">#${claude.rank} overall</span>`))
  assert.match(html, /#1 in Writing/)
  assert.equal(html.includes('btn secondary'), false)
  assert.equal(html.includes('What is Claude?'), false)
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1])
  const faq = ld['@graph'].find((n) => n['@type'] === 'FAQPage')
  for (const q of faq.mainEntity) assert.notEqual(q.acceptedAnswer.text, claude.description)
  assert.match(html, /Listing last changed: [A-Z][a-z]{2} \d{1,2}, 2026/)
  assert.match(html, /<meta name="description" content="#1 in Writing on BuildStack\./)
})

test('search results: numbered 1..N, category chip, top 6 then Show all N', async () => {
  const q = 'blog post'
  const expected = rankTools(tools, q)
  assert.ok(expected.length > 6)
  const { html } = await get('/?q=blog%20post')
  const start = html.indexOf('Best fit for')
  const section = html.slice(start, html.indexOf('</section>', start))
  const positions = [...section.matchAll(/<span class="pos" aria-label="Result (\d+)">(\d+)<\/span>/g)].map((m) => Number(m[2]))
  assert.deepEqual(positions, expected.map((_, i) => i + 1))
  const [top, rest] = section.split('<details class="more">')
  assert.equal((top.match(/<article class="card">/g) || []).length, 6)
  assert.match(rest, new RegExp(`<summary>Show all ${expected.length} results</summary>`))
  assert.match(top, /<span class="tag cat">#1 in Writing<\/span>/)
  for (const t of expected) assert.equal(section.includes(`<span class="rank">#${t.rank}</span>`), false)
  // ranking order unchanged
  const slugs = [...section.matchAll(/href="\/tool\/([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(slugs, expected.map((t) => t.slug))
})

test('short result lists have no Show all control', async () => {
  const q = 'React app'
  const n = rankTools(tools, q).length
  const { html } = await get('/?q=React%20app')
  assert.equal(html.includes('<details class="more">'), n > 6)
})

test('category page cards show category rank in order', async () => {
  const { html } = await get('/category/video')
  const chips = [...html.matchAll(/<span class="tag cat">#(\d+) in Video<\/span>/g)].map((m) => Number(m[1]))
  const n = tools.filter((t) => t.category === 'video').length
  assert.deepEqual(chips, Array.from({ length: n }, (_, i) => i + 1))
})

test('New tag only for tools added in the last 14 days', async () => {
  const app = (await import('../src/index.js')).default
  const data = await (await app.request('http://local/tools.json')).json()
  const today = new Date().toISOString().slice(0, 10)
  const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 14)
  const cutoff = d.toISOString().slice(0, 10)
  for (const t of data.tools) {
    assert.match(t.added, /^\d{4}-\d{2}-\d{2}$/, t.slug)
    assert.equal(t.newRelease, t.added > cutoff && t.added <= today, t.slug)
  }
  assert.ok(data.tools.filter((t) => t.newRelease).length < 73)
  const { html } = await get('/')
  const cards = (html.match(/<span class="tag new">New<\/span>/g) || []).length
  assert.ok(cards <= data.tools.filter((t) => t.newRelease).length * 2)
})

test('homepage copy: headline, live count, placeholder, task pills to /best, 1-2-3 quick answers', async () => {
  const { html } = await get('/')
  assert.match(html, /<h1>Type the job\. Get the best AI tool for it\.<\/h1>/)
  assert.match(html, new RegExp(`<p>${tools.length} AI tools, ranked\\. Every pick shows who it's for, what it costs, and the catch\\. Free, and ranks can't be bought\\.</p>`))
  assert.match(html, /placeholder="e\.g\. edit a podcast, write a blog post, build an app"/)
  assert.equal(html.includes('Built for humans and chatbots'), false)
  const best = html.match(/id="best-for"[\s\S]*?<\/section>/)[0]
  assert.equal(best.includes('?q='), false)
  assert.equal((best.match(/href="\/best\//g) || []).length, 8)
  assert.equal(/ first in [A-Z][a-z]+ \(#\d+ overall\)/.test(html), false)
  assert.match(html, /<ol class="top3"><li><a href="\/tool\/[^"]+">/)
  assert.match(html, /Last updated: [A-Z][a-z]{2} \d{1,2}, 2026/)
})

test('trust cleanup across pages: no real AI tools, no unshipped promises, no ISO dates in visible copy, no em dash', async () => {
  const paths = ['/', '/?q=blog%20post', '/tool/claude', '/category/writing', '/categories', GUIDE, '/about', '/get-featured', '/methodology', '/best/ai-writing-tool', '/best/free-ai-tools', '/alternatives/cursor']
  for (const path of paths) {
    const { status, html } = await get(path)
    assert.equal(status, 200, path)
    const body = bodyOf(html)
    assert.equal(/real AI tools/i.test(html), false, path)
    assert.equal(/when sends begin|newsletter mention/i.test(html), false, path)
    assert.equal(html.includes('\u2014'), false, path)
    const text = body.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')
    assert.equal(/\b2026-\d{2}-\d{2}\b/.test(text), false, `${path}: ${(text.match(/.{40}\b2026-\d{2}-\d{2}\b.{10}/) || [''])[0]}`)
  }
  for (const path of ['/llms.txt', '/llms-full.txt']) {
    const { html } = await get(path)
    assert.equal(/real AI tools/i.test(html), false, path)
    assert.equal(html.includes('?q='), false, path)
    assert.equal(html.includes('\u2014'), false, path)
  }
})

test('deepfake guide first screen and structure', async () => {
  const { html } = await get(GUIDE)
  assert.match(html, /\.hero-art\.capped img \{ height: 300px; max-height: 300px; object-fit: cover; \}/)
  assert.match(html, /<figure class="hero-art capped">/)
  assert.match(html, /\.article \{ max-width: 68ch; font-size: 17px;/)
  assert.match(html, /<p class="byline-note">BuildStack is a free ranked directory of AI tools\. Ranks aren't for sale\.<\/p>/)
  const article = html.slice(html.indexOf('<div class="article">'))
  assert.ok(article.indexOf('mid-50s and mid-70s') < article.indexOf('<div class="checks"'))
  assert.ok(article.indexOf('mid-50s and mid-70s') < 400)
  const checks = html.match(/<div class="checks" id="checks">([\s\S]*?)<\/div>/)[1]
  assert.match(checks, /<h2>6 checks before you share<\/h2>/)
  assert.equal((checks.match(/<li>/g) || []).length, 6)
  assert.equal(html.includes('we will not walk through'), false)
  assert.equal(html.includes('we will not name those sites here'), false)
  assert.equal((bodyOf(html).match(/not a how-to/gi) || []).length, 1) // one closing line in the body
  const hosted = html.indexOf('<strong>Hosted video apps')
  const strip = html.indexOf('id="likeness-rules"')
  assert.ok(hosted > 0 && strip > hosted)
  const stripHtml = html.slice(strip, html.indexOf('<div class="article">', strip))
  assert.equal((stripHtml.match(/<article class="card">/g) || []).length, 3)
  for (const slug of ['veo-3-1', 'runway', 'kling']) assert.match(stripHtml, new RegExp(`href="/tool/${slug}"`))
  const find = html.indexOf('What are you trying to make? Type the job.')
  const sources = html.indexOf('<details class="sources">')
  assert.ok(find > 0 && sources > find)
  for (const href of ['/best/ai-video-generator', '/category/video', '/best/ai-voice-generator']) assert.ok(html.slice(find, sources).includes(`href="${href}"`), href)
  assert.match(html, /<summary>Sources \(\d+\)<\/summary>/)
  assert.equal(html.includes('ComfyUI a deepfake tool'), false)
})
